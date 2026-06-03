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

export async function listDocuments() {
  const { data } = await client.get("/api/documents");
  return data;
}

export async function deleteDocument(documentId) {
  const { data } = await client.delete(`/api/documents/${documentId}`);
  return data;
}
