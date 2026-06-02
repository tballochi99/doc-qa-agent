import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import UploadZone from "./components/UploadZone.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import SourceCard from "./components/SourceCard.jsx";
import {
  uploadDocument,
  askQuestion,
  listDocuments,
  deleteDocument,
} from "./api.js";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sources, setSources] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [showSources, setShowSources] = useState(false);

  const activeDoc = documents.find((d) => d.id === activeId) || null;

  useEffect(() => {
    listDocuments()
      .then((docs) => {
        setDocuments(docs);
        if (docs.length && !activeId) setActiveId(docs[0].id);
      })
      .catch(() => setError("Could not reach the backend. Is it running?"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (file) => {
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadDocument(file, setProgress);
      const newDoc = { id: res.document_id, filename: file.name, pages: res.pages };
      setDocuments((prev) => [...prev, newDoc]);
      setActiveId(res.document_id);
      setMessages([]);
      setSources([]);
      setShowSources(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
        setSources([]);
        setShowSources(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Delete failed.");
    }
  };

  const handleSelect = (id) => {
    setActiveId(id);
    setMessages([]);
    setSources([]);
    setShowSources(false);
  };

  const handleAsk = async (question) => {
    setError("");
    setAsking(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    try {
      const res = await askQuestion(question, activeId);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
      setSources(res.sources || []);
      if (res.sources?.length) setShowSources(true);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to get an answer.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${detail}` },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm px-4 py-2 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-bold">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* ZONE 1 — Sidebar */}
        <aside className="w-full md:w-[30%] md:max-w-sm border-r border-slate-200 bg-slate-50 flex flex-col p-4 gap-4 overflow-y-auto scroll-area">
          <UploadZone onUpload={handleUpload} uploading={uploading} progress={progress} />

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Documents ({documents.length})
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400">No documents yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    onClick={() => handleSelect(doc.id)}
                    className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm transition
                      ${
                        doc.id === activeId
                          ? "bg-navy text-white"
                          : "bg-white border border-slate-200 hover:border-navy/40"
                      }`}
                  >
                    <span className="truncate">
                      📄 {doc.filename}
                      <span className={`ml-1 text-xs ${doc.id === activeId ? "text-blue-200" : "text-slate-400"}`}>
                        · {doc.pages}p
                      </span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition shrink-0 ${
                        doc.id === activeId ? "text-blue-200 hover:text-white" : "text-slate-400 hover:text-red-500"
                      }`}
                      title="Delete document"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ZONE 2 — Chat */}
        <main className="flex-1 flex flex-col bg-slate-100 min-h-0">
          <ChatInterface
            activeDoc={activeDoc}
            messages={messages}
            onAsk={handleAsk}
            loading={asking}
          />
        </main>

        {/* ZONE 3 — Sources panel */}
        {showSources && sources.length > 0 && (
          <aside className="w-full md:w-[30%] md:max-w-sm border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
              <h2 className="text-sm font-semibold text-navy">Sources ({sources.length})</h2>
              <button
                onClick={() => setShowSources(false)}
                className="text-slate-400 hover:text-slate-700"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="scroll-area flex-1 overflow-y-auto p-3 space-y-3">
              {sources.map((s, i) => (
                <SourceCard key={i} source={s} index={i} />
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
