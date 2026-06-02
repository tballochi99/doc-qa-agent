import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

function Message({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${
            isUser
              ? "bg-navy text-white rounded-br-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
          }`}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
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
      <div className="scroll-area flex-1 overflow-y-auto p-4 space-y-4">
        {!activeDoc ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
            <div className="text-5xl mb-3">💬</div>
            <p className="font-medium text-slate-500">No document selected</p>
            <p className="text-sm">Upload a PDF on the left to start asking questions.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
            <div className="text-5xl mb-3">✨</div>
            <p className="font-medium text-slate-500">Ask anything about</p>
            <p className="text-sm text-navy font-medium">{activeDoc.filename}</p>
          </div>
        ) : (
          messages.map((m, i) => <Message key={i} message={m} />)
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3 flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeDoc ? "Ask a question…" : "Upload a document first"}
          disabled={!activeDoc || loading}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={!activeDoc || loading || !input.trim()}
          className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
