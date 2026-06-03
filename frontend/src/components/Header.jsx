import { Mark } from "./Icons.jsx";

export default function Header() {
  return (
    <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-border">
      <div className="flex items-center gap-2.5">
        <Mark size={16} className="text-accent" />
        <span className="text-sm font-medium tracking-tight text-white">
          Document Q&amp;A
        </span>
        <span className="text-neutral-700">/</span>
        <span className="text-sm text-neutral-400">Greg</span>
        <span className="text-neutral-700 hidden sm:inline">·</span>
        <span className="text-xs text-neutral-600 hidden sm:inline">
          your personal agent
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-accent">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Llama 3.3 70B
        </span>
      </div>
    </header>
  );
}
