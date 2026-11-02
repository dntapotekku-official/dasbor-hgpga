export default function InsanKuOutletPlacements({ placements, insanku_uuid, nowrap = false }) {
  if (!Array.isArray(placements) || !placements.length) {
    return "-";
  }

  return (
    <ul className="list-disc space-y-1 pl-4">
      {placements.map((placement) => (
        <li key={`${insanku_uuid}-${placement.uuid || placement.outlet_uuid}`}>
          <div className={nowrap ? "flex flex-nowrap items-center gap-1.5 whitespace-nowrap" : "flex flex-wrap items-center gap-1.5"}>
            <span className="font-medium">{placement.outlet_name || "-"}</span>
            <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {placement.jabatan_name || placement.uuid_jabatan_master || "-"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
