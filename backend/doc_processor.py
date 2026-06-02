"""Document processing: text extraction and chunking.

V1 supports PDF only (PyPDF2). The roadmap (V2/V3) will add docx, txt,
markdown, and more — see README.
"""
from __future__ import annotations

from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader

# Roughly 500 tokens with 50 token overlap. We approximate tokens with
# characters (~4 chars/token) since the splitter works on characters.
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200


@dataclass
class Chunk:
    """A single chunk of a document with its source metadata."""

    text: str
    page: int
    chunk_index: int


def extract_pages(file_path: str) -> list[str]:
    """Extract text from a PDF, page by page.

    Returns a list where index i holds the text of page i+1.
    """
    reader = PdfReader(file_path)
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text.strip())
    return pages


def chunk_document(file_path: str) -> tuple[list[Chunk], int]:
    """Extract and chunk a PDF document.

    Keeps the page number in each chunk's metadata so answers can cite
    the exact page. Returns the chunks and the total page count.
    """
    pages = extract_pages(file_path)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks: list[Chunk] = []
    chunk_index = 0
    for page_number, page_text in enumerate(pages, start=1):
        if not page_text:
            continue
        for piece in splitter.split_text(page_text):
            piece = piece.strip()
            if not piece:
                continue
            chunks.append(Chunk(text=piece, page=page_number, chunk_index=chunk_index))
            chunk_index += 1

    return chunks, len(pages)
