export default function MainLoading() {
  return (
    <div className="animate-pulse space-y-6 px-4 lg:px-6">
      <div className="h-36 rounded-2xl border bg-card sm:h-44" />
      <div className="space-y-3">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 rounded-xl border bg-card" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-64 rounded-xl border bg-card" />
        <div className="h-64 rounded-xl border bg-card" />
      </div>
    </div>
  );
}
