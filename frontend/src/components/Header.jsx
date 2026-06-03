import { Mark, MenuIcon } from "./Icons.jsx";

export default function Header({ onOpenSidebar, sourcesCount = 0, onOpenSources }) {
  return (
    <header className="shrink-0 flex items-center justify-between px-3 sm:px-5 h-14 border-b border-border">
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {/* Mobile: open the documents drawer. */}
        <button
          onClick={onOpenSidebar}
          className="md:hidden text-neutral-300 hover:text-white p-1 -ml-1 transition"
          aria-label="Open documents"
        >
          <MenuIcon size={18} />
        </button>

        <Mark size={16} className="text-accent shrink-0" />
        <span className="text-sm font-medium tracking-tight text-white">Greg</span>
        <span className="text-neutral-700 hidden sm:inline">/</span>
        <span className="text-sm text-neutral-400 hidden sm:inline truncate">Document Q&amp;A</span>
        <span className="text-neutral-700 hidden md:inline">·</span>
        <span className="text-xs text-neutral-600 hidden md:inline">your personal agent</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Desktop: model badge. */}
        <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Llama 3.3 70B
        </span>

        {/* Mobile: open the sources drawer (only when there are sources). */}
        {sourcesCount > 0 && (
          <button
            onClick={onOpenSources}
            className="md:hidden text-[11px] font-mono text-accent border border-border rounded-md px-2.5 py-1 hover:border-accent/50 transition"
          >
            Sources · {sourcesCount}
          </button>
        )}
      </div>
    </header>
  );
}
