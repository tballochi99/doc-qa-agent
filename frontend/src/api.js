import axios from "axios";

// In dev, Vite proxies /api -> backend. In production set VITE_API_URL.
const baseURL = import.meta.env.VITE_API_URL || "";

const client = axios.create({ baseURL });

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
