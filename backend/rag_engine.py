"""RAG engine: embeddings, vector storage (ChromaDB) and answer generation (Groq)."""
from __future__ import annotations

import os
from functools import lru_cache

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from groq import Groq

from doc_processor import chunk_document

CHROMA_PERSIST_PATH = os.getenv("CHROMA_PERSIST_PATH", "./chroma_db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
COLLECTION_NAME = "documents"

SYSTEM_PROMPT = (
    "You are Greg, a precise document analyst. "
    "Answer based ONLY on the provided context. "
    "Always cite the page number of your sources. "
    "If the answer is not in the context, say so clearly. "
    "Reply in the same language as the user's latest question."
)

# Used to turn a follow-up (e.g. "in French?", "summarize that") into a
# standalone search query, so retrieval works on conversational turns.
CONDENSE_PROMPT = (
    "Given the conversation so far and a follow-up message, rewrite the "
    "follow-up as a standalone, self-contained search query in the language "
    "of the document. If the follow-up only changes the form of the answer "
    "(translation, summarize, shorter…) and not the topic, reuse the topic "
    "of the previous question. Reply with ONLY the rewritten query, nothing else."
)

# How many recent turns of history to keep in context.
MAX_HISTORY_TURNS = 6


@lru_cache(maxsize=1)
def _get_collection():
    """Return the persistent ChromaDB collection (created once, reused)."""
    client = chromadb.PersistentClient(
        path=CHROMA_PERSIST_PATH,
        settings=Settings(anonymized_telemetry=False, allow_reset=False),
    )
    embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedder,
        metadata={"hnsw:space": "cosine"},
    )


@lru_cache(maxsize=1)
def _get_groq() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your_groq_key_here":
        raise RuntimeError(
            "GROQ_API_KEY is not set. Copy backend/.env.example to backend/.env "
            "and add your Groq API key."
        )
    return Groq(api_key=api_key)


def process_document(file_path: str, document_id: str) -> dict:
    """Extract, chunk, embed and store a document in ChromaDB.

    Returns a summary: chunks_count and pages.
    """
    chunks, pages = chunk_document(file_path)
    if not chunks:
        raise ValueError(
            "No extractable text found in this document. "
            "Scanned PDFs (images) are not supported in V1."
        )

    collection = _get_collection()

    ids = [f"{document_id}:{c.chunk_index}" for c in chunks]
    documents = [c.text for c in chunks]
    metadatas = [
        {"document_id": document_id, "page": c.page, "chunk_index": c.chunk_index}
        for c in chunks
    ]

    # Embeddings are computed by the collection's embedding function.
    collection.add(ids=ids, documents=documents, metadatas=metadatas)

    return {"chunks_count": len(chunks), "pages": pages}


def _normalize_history(history: list[dict] | None) -> list[dict]:
    """Keep only the recent valid {role, content} turns."""
    if not history:
        return []
    clean = [
        {"role": h["role"], "content": h["content"]}
        for h in history
        if h.get("role") in ("user", "assistant") and h.get("content")
    ]
    return clean[-MAX_HISTORY_TURNS:]


def _condense_question(question: str, history: list[dict]) -> str:
    """Rewrite a follow-up into a standalone query using the conversation.

    No history → return the question unchanged (and skip the extra call).
    """
    if not history:
        return question
    convo = "\n".join(f"{h['role']}: {h['content']}" for h in history)
    try:
        completion = _get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": CONDENSE_PROMPT},
                {"role": "user", "content": f"Conversation:\n{convo}\n\nFollow-up: {question}"},
            ],
            temperature=0.0,
        )
        rewritten = (completion.choices[0].message.content or "").strip()
        return rewritten or question
    except Exception:
        # If reformulation fails, fall back to the raw question.
        return question


def ask_question(
    question: str,
    document_id: str,
    history: list[dict] | None = None,
    n_results: int = 5,
) -> dict:
    """Retrieve the most relevant chunks and generate a grounded answer.

    History-aware: follow-up turns are condensed into a standalone query
    for retrieval, and the recent conversation is given to the LLM so it
    can resolve references ("in French?", "summarize that"…).

    Returns the answer plus the source passages (text, page, score).
    """
    collection = _get_collection()
    history = _normalize_history(history)
    search_query = _condense_question(question, history)

    results = collection.query(
        query_texts=[search_query],
        n_results=n_results,
        where={"document_id": document_id},
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    sources = []
    context_blocks = []
    for text, meta, distance in zip(documents, metadatas, distances):
        page = meta.get("page", 0)
        # Cosine distance -> similarity score in [0, 1].
        score = round(max(0.0, 1.0 - distance), 4)
        sources.append({"text": text, "page": page, "score": score})
        context_blocks.append(f"[Page {page}]\n{text}")

    if not context_blocks:
        return {
            "answer": "I couldn't find any relevant content in this document to answer your question.",
            "sources": [],
        }

    context = "\n\n---\n\n".join(context_blocks)
    user_prompt = (
        f"Context from the document:\n\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer the question using only the context above and cite the page numbers."
    )

    # System prompt + recent conversation + the grounded current turn.
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})

    client = _get_groq()
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.2,
    )
    answer = completion.choices[0].message.content

    return {"answer": answer, "sources": sources}


def delete_document(document_id: str) -> None:
    """Remove all chunks belonging to a document from ChromaDB."""
    collection = _get_collection()
    collection.delete(where={"document_id": document_id})
