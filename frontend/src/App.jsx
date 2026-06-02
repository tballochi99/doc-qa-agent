import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import UploadZone from "./components/UploadZone.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import SourceCard from "./components/SourceCard.jsx";
import { FileIcon, TrashIcon, CloseIcon, AlertIcon } from "./components/Icons.jsx";
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
    // Snapshot the prior turns as conversation history for the backend.
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    try {
      const res = await askQuestion(question, activeId, history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
      setSources(res.sources || []);
      if (res.sources?.length) setShowSources(true);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to get an answer.";
      setMessages((prev) => [...prev, { role: "assistant", content: detail }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg text-neutral-200">
      <Header />

      {error && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-2.5 border-b border-border bg-surface text-sm text-neutral-300 animate-fade-up">
          <span className="flex items-center gap-2">
            <AlertIcon size={14} className="text-neutral-400" />
            {error}
          </span>
          <button
            onClick={() => setError("")}
            className="text-neutral-500 hover:text-white transition"
            aria-label="Dismiss"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* ZONE 1 — Sidebar */}
        <aside className="w-full md:w-[26%] md:max-w-xs border-b md:border-b-0 md:border-r border-border flex flex-col p-4 gap-5 overflow-y-auto scroll-area">
          <UploadZone onUpload={handleUpload} uploading={uploading} progress={progress} />

          <div className="flex-1">
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-600 mb-3">
              Documents · {documents.length}
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-neutral-600">No documents yet.</p>
            ) : (
              <ul className="space-y-1">
                {documents.map((doc) => {
                  const active = doc.id === activeId;
                  return (
                    <li
                      key={doc.id}
                      onClick={() => handleSelect(doc.id)}
                      className={`group flex items-center justify-between gap-2 rounded-md px-2.5 py-2 cursor-pointer text-sm transition-colors border
                        ${
                          active
                            ? "bg-neutral-900 border-accent/40 text-white"
                            : "border-transparent text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200"
                        }`}
                    >
                      <span className="truncate flex items-center gap-2 min-w-0">
                        <FileIcon size={14} className="shrink-0 text-neutral-500" />
                        <span className="truncate">{doc.filename}</span>
                        <span className="text-[10px] font-mono text-neutral-600 shrink-0">
                          {doc.pages}p
                        </span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition shrink-0 text-neutral-600 hover:text-white"
                        aria-label="Delete document"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-[10px] font-mono text-accent pt-3 border-t border-border">
            built by Timoté Ballochi
          </p>
        </aside>

        {/* ZONE 2 — Chat */}
        <main className="flex-1 flex flex-col min-h-0">
          <ChatInterface
            activeDoc={activeDoc}
            messages={messages}
            onAsk={handleAsk}
            loading={asking}
          />
        </main>

        {/* ZONE 3 — Sources panel */}
        {showSources && sources.length > 0 && (
          <aside className="w-full md:w-[30%] md:max-w-sm border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
                Sources · {sources.length}
              </h2>
              <button
                onClick={() => setShowSources(false)}
                className="text-neutral-600 hover:text-white transition"
                aria-label="Close sources"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <div className="scroll-area flex-1 overflow-y-auto p-3 space-y-2.5">
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
