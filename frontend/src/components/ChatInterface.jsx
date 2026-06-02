import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUpIcon } from "./Icons.jsx";

function Message({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-1.5 animate-fade-up ${isUser ? "items-end" : "items-start"}`}>
      <span className="text-[11px] font-mono text-neutral-600 px-1">
        {isUser ? "you" : "agent"}
      </span>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed
          ${
            isUser
              ? "bg-white text-black"
              : "border border-border bg-surface text-neutral-200"
          }`}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="prose prose-sm prose-invert prose-agent max-w-none prose-p:my-1.5 prose-headings:text-white">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ activeDoc }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      {activeDoc ? (
        <>
          <p className="text-sm text-neutral-300">Ask anything about</p>
          <p className="text-sm font-mono text-white mt-1.5">{activeDoc.filename}</p>
          <p className="text-xs text-neutral-600 mt-3 max-w-xs leading-relaxed">
            Answers are grounded in the document and cite the exact source pages.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-300">No document selected</p>
          <p className="text-xs text-neutral-600 mt-1.5">
            Upload a PDF on the left to start.
          </p>
        </>
      )}
    </div>
  );
}

export default function ChatInterface({ activeDoc, messages, onAsk, loading }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submit = (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading || !activeDoc) return;
    onAsk(q);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="scroll-area flex-1 overflow-y-auto p-5 space-y-5">
        {!activeDoc || messages.length === 0 ? (
          <EmptyState activeDoc={activeDoc} />
        ) : (
          messages.map((m, i) => <Message key={i} message={m} />)
        )}

        {loading && (
          <div className="flex flex-col gap-1.5 items-start animate-fade-up">
            <span className="text-[11px] font-mono text-neutral-600 px-1">agent</span>
            <div className="border border-border bg-surface rounded-xl px-4 py-3.5">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="p-4 shrink-0 border-t border-border">
        <div
          className={`flex items-center gap-2 rounded-xl border bg-surface pl-4 pr-1.5 py-1.5 transition-colors
            ${activeDoc ? "border-border focus-within:border-accent" : "border-border opacity-50"}`}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeDoc ? "Ask a question…" : "Upload a document first"}
            disabled={!activeDoc || loading}
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!activeDoc || loading || !input.trim()}
            className="bg-white text-black w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-200 disabled:opacity-20 disabled:cursor-not-allowed transition"
            aria-label="Send"
          >
            <ArrowUpIcon size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
