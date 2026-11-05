export default function InsanKuOutletPlacements({ placements, insanku_uuid, nowrap = false }) {
  const active_placements = Array.isArray(placements) ? placements.filter((placement) => placement.is_active !== false) : [];
  if (!active_placements.length) {
    return "-";
  }

  return (
    <ul className="list-disc space-y-1 pl-4">
      {active_placements.map((placement) => (
        <li key={`${insanku_uuid}-${placement.uuid || placement.outlet_uuid}`}>
          <div className={nowrap ? "flex flex-nowrap items-center gap-1.5 whitespace-nowrap" : "flex flex-wrap items-center gap-1.5"}>
            <span className="font-medium">{placement.outlet_name || "-"}</span>
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{placement.pharmapp_account || "-"}</span>
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            {(placement.jabatan_list ?? [{
              uuid_jabatan_master: placement.uuid_jabatan_master,
              jabatan_name: placement.jabatan_name,
              is_active: placement.jabatan_is_active,
            }]).filter((jabatan) => jabatan.is_active !== false).map((jabatan, index) => (
              <span key={jabatan.uuid_jabatan_master || index} data-slot="badge" className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                {jabatan.jabatan_name || jabatan.uuid_jabatan_master || "-"}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
