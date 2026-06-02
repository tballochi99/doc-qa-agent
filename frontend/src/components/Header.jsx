export default function Header() {
  return (
    <header className="bg-navy text-white px-4 py-3 flex items-center gap-3 shadow-md shrink-0">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 text-xl">
        🤖
      </div>
      <div>
        <h1 className="text-lg font-semibold leading-tight">Document Q&amp;A Agent</h1>
        <p className="text-xs text-blue-200">Ask anything. Get answers with sources.</p>
      </div>
    </header>
  );
}
