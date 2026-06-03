import axios from "axios";

// In dev, Vite proxies /api -> backend. In production set VITE_API_URL.
const baseURL = import.meta.env.VITE_API_URL || "";

// Opaque per-browser session id so each visitor only sees their own
// documents — no accounts needed. Persisted in localStorage.
function getSessionId() {
  const KEY = "greg.sessionId";
  let id = null;
  try {
    id = localStorage.getItem(KEY);
    if (!id) {
      id =
        crypto.randomUUID?.() ||
        `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
  } catch {
    id = "anonymous";
  }
  return id;
}

export const SESSION_ID = getSessionId();

const client = axios.create({
  baseURL,
  headers: { "X-Session-Id": SESSION_ID },
});

export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

export async function askQuestion(question, documentId, history = []) {
  const { data } = await client.post("/api/ask", {
    question,
    document_id: documentId,
    history,
  });
  return data;
}

// Streaming ask over Server-Sent Events. Calls handlers as events arrive:
//   onSources(sources[]) once, then onDelta(textChunk) repeatedly.
// Throws an axios-shaped error on HTTP failure or a streamed `error` event,
// so callers can reuse the same error handling as the non-streaming path.
export async function askQuestionStream(question, documentId, history, handlers = {}) {
  const res = await fetch(`${baseURL}/api/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": SESSION_ID },
    body: JSON.stringify({ question, document_id: documentId, history }),
  });

  if (!res.ok || !res.body) {
    let detail = "Failed to get an answer.";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON body */
    }
    throw { response: { status: res.status, data: { detail } } };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.replace(/^data:\s*/, "").trim();
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "sources") handlers.onSources?.(ev.sources || []);
      else if (ev.type === "delta") handlers.onDelta?.(ev.text || "");
      else if (ev.type === "error") {
        const status = ev.code === "quota_exceeded" ? 429 : 500;
        const detail = ev.code
          ? { code: ev.code, retry_after_seconds: ev.retry_after_seconds }
          : ev.message;
        throw { response: { status, data: { detail } } };
      }
    }
  }
}

export async function listDocuments() {
  const { data } = await client.get("/api/documents");
  return data;
}

export async function deleteDocument(documentId) {
  const { data } = await client.delete(`/api/documents/${documentId}`);
  return data;
}
