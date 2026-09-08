export default function PageHeading({ title, description, action }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary via-primary to-rose-700 px-5 py-4 text-primary-foreground shadow-md dark:from-red-900 dark:via-red-950 dark:to-rose-950">
      <div className="pointer-events-none absolute -top-10 -right-8 size-24 rounded-full bg-white/10 blur-2xl" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative border-l-2 border-white/70 pl-4">
          <h1 className="text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-white/75">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
