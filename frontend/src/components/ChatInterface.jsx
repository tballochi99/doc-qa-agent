import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUpIcon, CopyIcon, CheckIcon, PencilIcon } from "./Icons.jsx";

function RoleLabel({ children }) {
  return (
    <span className="text-[11px] font-mono text-neutral-600 px-1">{children}</span>
  );
}

function UserMessage({ message, index, onEdit, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const cancel = () => {
    setEditing(false);
    setDraft(message.content);
  };
  const save = () => {
    const value = draft.trim();
    if (!value) return;
    setEditing(false);
    onEdit(index, value);
  };

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1.5 animate-fade-up">
        <RoleLabel>you</RoleLabel>
        <div className="w-[80%] rounded-xl border border-accent bg-surface p-2.5">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                cancel();
              }
            }}
            rows={Math.min(6, draft.split("\n").length + 1)}
            className="w-full bg-transparent text-sm text-neutral-100 resize-none focus:outline-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={cancel}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 transition"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="text-xs bg-white text-black rounded-md px-3 py-1 hover:bg-neutral-200 transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1.5 animate-fade-up">
      <RoleLabel>you</RoleLabel>
      <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-white text-black">
        {message.content}
      </div>
      <div className="flex justify-end px-1 h-4">
        <button
          onClick={() => {
            setDraft(message.content);
            setEditing(true);
          }}
          disabled={disabled}
          className="opacity-0 group-hover:opacity-100 transition text-neutral-600 hover:text-white disabled:opacity-0"
          aria-label="Edit message"
          title="Edit"
        >
          <PencilIcon size={13} />
        </button>
      </div>
    </div>
  );
}

function AgentMessage({ message }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group flex flex-col items-start gap-1.5 animate-fade-up">
      <RoleLabel>greg</RoleLabel>
      <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed border border-border bg-surface text-neutral-200">
        <div className="prose prose-sm prose-invert prose-agent max-w-none prose-p:my-1.5 prose-headings:text-white">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
      <div className="flex justify-start px-1 h-4">
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1 text-[11px] font-mono text-neutral-600 hover:text-white"
          aria-label="Copy answer"
          title="Copy"
        >
          {copied ? (
            <>
              <CheckIcon size={12} className="text-accent" /> copied
            </>
          ) : (
            <>
              <CopyIcon size={12} /> copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Message({ message, index, onEdit, disabled }) {
  return message.role === "user" ? (
    <UserMessage message={message} index={index} onEdit={onEdit} disabled={disabled} />
  ) : (
    <AgentMessage message={message} />
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

export default function ChatInterface({ activeDoc, messages, onAsk, onEdit, loading }) {
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
          messages.map((m, i) => (
            <Message key={i} message={m} index={i} onEdit={onEdit} disabled={loading} />
          ))
        )}

        {loading && (
          <div className="flex flex-col gap-1.5 items-start animate-fade-up">
            <RoleLabel>greg</RoleLabel>
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
