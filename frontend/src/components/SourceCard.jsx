export default function SourceCard({ source, index }) {
  const scorePct = Math.round((source.score ?? 0) * 100);

  return (
    <div className="rounded-lg border border-border bg-surface p-3.5 hover:border-neutral-700 transition-colors animate-fade-up">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-mono text-neutral-400">
          <span className="text-neutral-600">[{index + 1}]</span> page {source.page}
        </span>
        <span className="text-[11px] font-mono text-neutral-500">{scorePct}%</span>
      </div>

      {/* Monochrome similarity bar. */}
      <div className="w-full bg-neutral-900 rounded-full h-px mb-3">
        <div
          className="h-px rounded-full bg-neutral-400"
          style={{ width: `${scorePct}%` }}
        />
      </div>

      <p className="text-[13px] leading-relaxed text-neutral-300">
        <span className="source-highlight">{source.text}</span>
      </p>
    </div>
  );
}
