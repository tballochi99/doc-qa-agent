"""FastAPI app for the Document Q&A Agent.

Exposes upload, ask, list and delete endpoints. The RAG logic lives in
rag_engine.py; document text extraction in doc_processor.py.
"""
from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import rag_engine

MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
CHROMA_PERSIST_PATH = os.getenv("CHROMA_PERSIST_PATH", "./chroma_db")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Simple persistent registry of document metadata (filename, pages).
# Chunks themselves live in ChromaDB; this just tracks human-facing info.
REGISTRY_PATH = Path(CHROMA_PERSIST_PATH) / "documents.json"

app = FastAPI(title="Document Q&A Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_registry() -> dict:
    if REGISTRY_PATH.exists():
        try:
            return json.loads(REGISTRY_PATH.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _save_registry(registry: dict) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2))


class Turn(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    question: str
    document_id: str
    history: list[Turn] = []


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    """Accept a PDF, extract + chunk + embed it, store in ChromaDB."""
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported in V1. (docx/txt/md coming in V2.)",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    document_id = str(uuid.uuid4())
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        result = rag_engine.process_document(tmp_path, document_id)

        registry = _load_registry()
        registry[document_id] = {
            "id": document_id,
            "filename": filename,
            "pages": result["pages"],
            "chunks_count": result["chunks_count"],
        }
        _save_registry(registry)

        return {
            "document_id": document_id,
            "chunks_count": result["chunks_count"],
            "pages": result["pages"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to process document: {exc}") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/ask")
def ask(req: AskRequest) -> dict:
    """Answer a question against a previously indexed document."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    registry = _load_registry()
    if req.document_id not in registry:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        history = [turn.model_dump() for turn in req.history]
        return rag_engine.ask_question(req.question, req.document_id, history)
    except rag_engine.QuotaExceededError as exc:
        # Shared free-tier quota temporarily exhausted. Tell the client when
        # it resets so it can show a friendly "come back later" message.
        headers = {}
        if exc.retry_after:
            headers["Retry-After"] = str(int(exc.retry_after))
        raise HTTPException(
            status_code=429,
            detail={
                "code": "quota_exceeded",
                "retry_after_seconds": exc.retry_after,
            },
            headers=headers,
        ) from exc
    except RuntimeError as exc:
        # Missing/invalid Groq API key.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {exc}") from exc


@app.get("/api/documents")
def list_documents() -> list[dict]:
    """List all indexed documents."""
    registry = _load_registry()
    return [
        {"id": d["id"], "filename": d["filename"], "pages": d["pages"]}
        for d in registry.values()
    ]


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str) -> dict:
    """Remove a document and its chunks from ChromaDB."""
    registry = _load_registry()
    if document_id not in registry:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        rag_engine.delete_document(document_id)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {exc}") from exc

    del registry[document_id]
    _save_registry(registry)
    return {"deleted": document_id}
