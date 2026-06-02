export default function SourceCard({ source, index }) {
  const scorePct = Math.round((source.score ?? 0) * 100);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-navy bg-blue-50 px-2 py-0.5 rounded">
          Source {index + 1} · Page {source.page}
        </span>
        <span className="text-xs text-slate-500" title="Similarity score">
          {scorePct}% match
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700">
        <span className="source-highlight">{source.text}</span>
      </p>
    </div>
  );
}
