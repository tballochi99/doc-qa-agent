import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import UploadZone from "./components/UploadZone.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import SourceCard from "./components/SourceCard.jsx";
import { FileIcon, TrashIcon, CloseIcon, AlertIcon } from "./components/Icons.jsx";
import {
  uploadDocument,
  askQuestionStream,
  listDocuments,
  deleteDocument,
} from "./api.js";

// Human-friendly "come back in …" from a reset delay in seconds.
function formatWait(secs) {
  if (!secs || secs <= 0) return "in a little while";
  if (secs >= 3600) {
    const h = Math.round(secs / 3600);
    return `in about ${h} hour${h > 1 ? "s" : ""}`;
  }
  const m = Math.max(1, Math.round(secs / 60));
  return `in about ${m} minute${m > 1 ? "s" : ""}`;
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Track viewport so we don't auto-pop the sources overlay on mobile.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
      setSidebarOpen(false);
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

  // Load the bundled sample PDF so visitors can try Greg without a file
  // of their own. Served from the frontend origin (public/), then run
  // through the normal upload flow.
  const handleTrySample = async () => {
    if (uploading) return;
    setError("");
    try {
      const res = await fetch("/sample.pdf");
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const file = new File([blob], "greg-cafe-handbook.pdf", {
        type: "application/pdf",
      });
      await handleUpload(file);
    } catch {
      setError("Couldn't load the sample PDF.");
    }
  };

  const handleSelect = (id) => {
    setActiveId(id);
    setMessages([]);
    setSources([]);
    setShowSources(false);
    setSidebarOpen(false);
  };

  // Ask a question on top of `base` turns (the conversation prefix kept
  // as context). `base` is the prior turns; the new question is appended.
  // Append text to the last (assistant) message — used while streaming.
  const appendToLast = (text) =>
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, content: last.content + text };
      return copy;
    });
  const setLast = (content) =>
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], content };
      return copy;
    });

  const submitQuestion = async (question, base) => {
    setError("");
    setAsking(true);
    const history = base.map((m) => ({ role: m.role, content: m.content }));
    // Add the user turn plus an empty assistant turn that fills in as the
    // tokens stream in (the empty bubble shows the typing indicator).
    setMessages([
      ...base,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    try {
      await askQuestionStream(question, activeId, history, {
        onSources: (s) => {
          setSources(s);
          // Desktop: slide the panel in. Mobile: leave it behind the header
          // "Sources" button so it doesn't cover the answer.
          if (s.length && isDesktop) setShowSources(true);
        },
        onDelta: (text) => appendToLast(text),
      });
    } catch (err) {
      const data = err.response?.data?.detail;
      let detail;
      if (err.response?.status === 429 || data?.code === "quota_exceeded") {
        detail =
          "**Greg stepped out for a latte.**\n\n" +
          "He's run dry on free tokens for the moment — this is a free, shared demo " +
          `running on a single Greg key. He'll be back ${formatWait(
            data?.retry_after_seconds
          )}, once the quota refills (and the espresso machine cools down).`;
      } else {
        detail = (typeof data === "string" && data) || "Failed to get an answer.";
      }
      setLast(detail);
    } finally {
      setAsking(false);
    }
  };

  const handleAsk = (question) => submitQuestion(question, messages);

  // Editing a question re-asks it: drop that turn and everything after,
  // then resubmit the edited text with the preceding turns as context.
  const handleEdit = (index, newText) => submitQuestion(newText, messages.slice(0, index));

  const hasSources = sources.length > 0;

  return (
    <div className="flex flex-col h-screen bg-bg text-neutral-200">
      <Header
        onOpenSidebar={() => setSidebarOpen(true)}
        sourcesCount={sources.length}
        onOpenSources={() => setShowSources(true)}
      />

      {error && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-border bg-surface text-sm text-neutral-300 animate-fade-up">
          <span className="flex items-center gap-2 min-w-0">
            <AlertIcon size={14} className="text-neutral-400 shrink-0" />
            <span className="truncate">{error}</span>
          </span>
          <button
            onClick={() => setError("")}
            className="text-neutral-500 hover:text-white transition shrink-0"
            aria-label="Dismiss"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {/* Backdrop for the mobile documents drawer. */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ZONE 1 — Sidebar: static column on desktop, slide-in drawer on mobile. */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-40 w-[82%] max-w-xs md:w-[26%]
            bg-bg md:bg-transparent border-r border-border flex flex-col p-4 gap-5
            overflow-y-auto scroll-area transition-transform duration-200 ease-out
            md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between md:hidden">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              Documents
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-neutral-500 hover:text-white transition"
              aria-label="Close"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <UploadZone onUpload={handleUpload} uploading={uploading} progress={progress} />

          <button
            onClick={handleTrySample}
            disabled={uploading}
            className="-mt-3 text-[11px] font-mono text-neutral-500 hover:text-accent transition disabled:opacity-40 self-start"
          >
            or try a sample PDF →
          </button>

          <div className="flex-1">
            <h2 className="hidden md:block text-[11px] font-mono uppercase tracking-widest text-neutral-600 mb-3">
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
                        className="md:opacity-0 md:group-hover:opacity-100 transition shrink-0 text-neutral-600 hover:text-white"
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

          <blockquote className="text-[10px] font-mono text-accent pt-3 border-t border-border leading-relaxed">
            “You can’t make a Tomlette without breaking some Greggs.”
            <span className="block text-neutral-600 mt-1">— Tom Wambsgans</span>
          </blockquote>
        </aside>

        {/* ZONE 2 — Chat (always full-width primary view). */}
        <main className="flex-1 flex flex-col min-h-0">
          <ChatInterface
            activeDoc={activeDoc}
            messages={messages}
            onAsk={handleAsk}
            onEdit={handleEdit}
            onTrySample={handleTrySample}
            loading={asking}
          />
        </main>

        {/* Backdrop for the mobile sources drawer. */}
        {showSources && hasSources && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSources(false)}
          />
        )}

        {/* ZONE 3 — Sources: static column on desktop, slide-in drawer on mobile. */}
        {hasSources && (
          <aside
            className={`fixed md:static inset-y-0 right-0 z-40 w-[88%] max-w-sm md:w-[30%]
              bg-bg md:bg-transparent border-l border-border flex flex-col overflow-hidden
              transition-transform duration-200 ease-out
              ${showSources ? "translate-x-0" : "translate-x-full md:translate-x-0 md:hidden"}`}
          >
            <div className="flex items-center justify-between px-4 h-14 md:h-12 border-b border-border shrink-0">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">
                Sources · {sources.length}
              </h2>
              <button
                onClick={() => setShowSources(false)}
                className="text-neutral-600 hover:text-white transition"
                aria-label="Close sources"
              >
                <CloseIcon size={16} />
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
