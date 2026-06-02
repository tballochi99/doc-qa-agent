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
    return _strip_repeated_lines(pages)


# A line repeated on more than this fraction of pages is treated as a
# header/footer (page numbers, legal footers, Siret, "Docusign Envelope ID"…)
# and removed so it doesn't pollute chunks and dilute retrieval.
_BOILERPLATE_PAGE_FRACTION = 0.5


def _strip_repeated_lines(pages: list[str]) -> list[str]:
    """Drop lines that repeat across most pages (recurring headers/footers).

    Only kicks in for multi-page documents, where boilerplate is detectable.
    """
    if len(pages) < 3:
        return pages

    # Count, per normalized line, how many distinct pages it appears on.
    page_count: dict[str, int] = {}
    for page in pages:
        seen_here = set()
        for raw in page.splitlines():
            line = raw.strip()
            if len(line) < 8:  # keep short lines; too generic to judge
                continue
            if line not in seen_here:
                seen_here.add(line)
                page_count[line] = page_count.get(line, 0) + 1

    threshold = max(2, int(len(pages) * _BOILERPLATE_PAGE_FRACTION))
    boilerplate = {line for line, count in page_count.items() if count >= threshold}
    if not boilerplate:
        return pages

    cleaned: list[str] = []
    for page in pages:
        kept = [
            raw
            for raw in page.splitlines()
            if raw.strip() not in boilerplate
        ]
        cleaned.append("\n".join(kept).strip())
    return cleaned


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
