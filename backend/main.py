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

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import rag_engine
import ratelimit

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


# Each visitor sends an opaque session id (header). Documents are scoped to
# it so users only ever see, query and delete their own uploads — without
# any accounts. Falls back to "anonymous" if the header is absent.
def _session(x_session_id: str = Header(default="anonymous", alias="X-Session-Id")) -> str:
    return x_session_id or "anonymous"


def _client_ip(request: Request) -> str:
    """Real client IP, honoring X-Forwarded-For behind a reverse proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit(retry_scope: tuple[int, str] | None) -> None:
    """Raise a 429 with a structured body if a limiter returned a hit."""
    if retry_scope is None:
        return
    retry_after, scope = retry_scope
    raise HTTPException(
        status_code=429,
        detail={
            "code": "rate_limited",
            "scope": scope,
            "retry_after_seconds": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


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
async def upload(
    request: Request,
    file: UploadFile = File(...),
    session: str = Depends(_session),
) -> dict:
    """Accept a PDF, extract + chunk + embed it, store in ChromaDB."""
    _rate_limit(ratelimit.hit_upload(_client_ip(request)))

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
            "session_id": session,
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
def ask(req: AskRequest, request: Request, session: str = Depends(_session)) -> dict:
    """Answer a question against a previously indexed document."""
    _rate_limit(ratelimit.hit_ask(_client_ip(request)))

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    registry = _load_registry()
    doc = registry.get(req.document_id)
    if not doc or doc.get("session_id") != session:
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


@app.post("/api/ask/stream")
def ask_stream(
    req: AskRequest, request: Request, session: str = Depends(_session)
) -> StreamingResponse:
    """Same as /api/ask but streams the answer token-by-token over SSE.

    Event stream (each line `data: {json}`): a `sources` event, then many
    `delta` events with `text`, then `done`. Quota/other failures are sent
    as an `error` event so a partially-rendered answer can recover.
    """
    _rate_limit(ratelimit.hit_ask(_client_ip(request)))

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    registry = _load_registry()
    doc = registry.get(req.document_id)
    if not doc or doc.get("session_id") != session:
        raise HTTPException(status_code=404, detail="Document not found.")

    history = [turn.model_dump() for turn in req.history]

    def event_stream():
        try:
            for event in rag_engine.ask_question_stream(
                req.question, req.document_id, history
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except rag_engine.QuotaExceededError as exc:
            payload = {
                "type": "error",
                "code": "quota_exceeded",
                "retry_after_seconds": exc.retry_after,
            }
            yield f"data: {json.dumps(payload)}\n\n"
        except RuntimeError as exc:  # missing/invalid Groq key
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        except Exception as exc:  # pragma: no cover - defensive
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to answer question: {exc}'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/documents")
def list_documents(session: str = Depends(_session)) -> list[dict]:
    """List the documents indexed by this session."""
    registry = _load_registry()
    return [
        {"id": d["id"], "filename": d["filename"], "pages": d["pages"]}
        for d in registry.values()
        if d.get("session_id") == session
    ]


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, session: str = Depends(_session)) -> dict:
    """Remove a document and its chunks from ChromaDB."""
    registry = _load_registry()
    doc = registry.get(document_id)
    if not doc or doc.get("session_id") != session:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        rag_engine.delete_document(document_id)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {exc}") from exc

    del registry[document_id]
    _save_registry(registry)
    return {"deleted": document_id}
