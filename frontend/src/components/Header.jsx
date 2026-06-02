import { Mark } from "./Icons.jsx";

export default function Header() {
  return (
    <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-border">
      <div className="flex items-center gap-2.5">
        <Mark size={16} className="text-white" />
        <span className="text-sm font-medium tracking-tight text-white">
          Document Q&amp;A
        </span>
        <span className="text-neutral-700">/</span>
        <span className="text-sm text-neutral-400">Agent</span>
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
          Llama 3.3 70B
        </span>
      </div>
    </header>
  );
}
