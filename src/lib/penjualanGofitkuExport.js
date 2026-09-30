export function export_penjualan_gofitku(export_groups) {
  const export_font_name = "Aptos";
  const export_font_size = 12;
  const month_names = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];
  const escape_xml_value = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const get_cell = (value, type = "String", style_id = "") => {
    const normalized_value = type === "Number" ? Number(value || 0) : value;
    const style_attribute = style_id ? ` ss:StyleID="${style_id}"` : "";
    const escaped_value = escape_xml_value(normalized_value);

    return `<Cell${style_attribute}><Data ss:Type="${type}">${escaped_value}</Data></Cell>`;
  };
  const get_merged_title_cell = (value) => {
    const escaped_value = escape_xml_value(value);

    return `<Cell ss:StyleID="Title" ss:MergeAcross="5"><Data ss:Type="String">${escaped_value}</Data></Cell>`;
  };
  const get_row = (cells) => `<Row>${cells.join("")}</Row>`;
  const get_worksheet = (name, rows, column_widths) => `
    <Worksheet ss:Name="${escape_xml_value(name)}">
      <Table>
        ${column_widths
          .map((width) => `<Column ss:Width="${width}"/>`)
          .join("")}
        ${rows.join("")}
      </Table>
    </Worksheet>
  `;
  const used_sheet_names = new Set();
  const get_sheet_name = (outlet_name, index) => {
    const fallback_name = `Outlet ${index + 1}`;
    const cleaned_name = String(outlet_name || fallback_name)
      .replaceAll(/[\\/?*:[\]]/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim() || fallback_name;
    let sheet_name = cleaned_name.slice(0, 31);
    let duplicate_index = 2;

    while (used_sheet_names.has(sheet_name)) {
      const suffix = ` ${duplicate_index}`;
      sheet_name = cleaned_name.slice(0, 31 - suffix.length) + suffix;
      duplicate_index += 1;
    }

    used_sheet_names.add(sheet_name);

    return sheet_name;
  };
  const get_month_label = (month_key) => {
    const [year, month] = String(month_key).split("-").map(Number);

    return `${month_names[month - 1] ?? ""} ${year}`.trim();
  };
  const get_status_label = (monthly_total, target, today_input) => {
    if (Number(today_input ?? monthly_total) <= 0) {
      return "Belum input";
    }

    if (Number(monthly_total || 0) >= Number(target || 0)) {
      return "Target tercapai";
    }

    return "Perlu dikejar";
  };
  const get_percentage_label = (monthly_total, target) => {
    if (!Number(target || 0)) {
      return "0%";
    }

    return `${Math.round((Number(monthly_total || 0) / Number(target)) * 100)}%`;
  };
  const get_ringkasan_title_cell = (value, merge_across) => {
    const escaped_value = escape_xml_value(value);

    return `<Cell ss:StyleID="Title" ss:MergeAcross="${merge_across}"><Data ss:Type="String">${escaped_value}</Data></Cell>`;
  };
  const get_month_keys_from_groups = (groups) => {
    const month_keys = new Set();

    for (const group of groups ?? []) {
      for (const monthly_group of group.monthly_groups ?? []) {
        if (monthly_group.month_key) {
          month_keys.add(monthly_group.month_key);
        }
      }
    }

    return Array.from(month_keys).sort().reverse();
  };
  const get_monthly_group_for = (group, month_key) =>
    (group.monthly_groups ?? []).find((item) => item.month_key === month_key) ??
    null;
  const get_month_data_cells = (monthly_total, target) => [
    get_cell(monthly_total, "Number", "Cell"),
    get_cell(target, "Number", "Cell"),
    get_cell(get_percentage_label(monthly_total, target), "String", "Cell"),
    get_cell(get_status_label(monthly_total, target, null), "String", "Cell"),
  ];
  const get_header_row = (labels) =>
    get_row(labels.map((label) => get_cell(label, "String", "Header")));
  const sum_month_rows = (rows) =>
    rows.reduce(
      (totals, row) => ({
        monthly_total: totals.monthly_total + Number(row.monthly_total || 0),
        target: totals.target + Number(row.target || 0),
      }),
      { monthly_total: 0, target: 0 },
    );
  const get_month_total_row = (label_cells, monthly_total, target) => {
    const cells = [...label_cells];

    cells.push(
      get_cell(monthly_total, "Number", "BlueTotal"),
      get_cell(target, "Number", "BlueTotal"),
      get_cell(get_percentage_label(monthly_total, target), "String", "BlueTotal"),
      get_cell(get_status_label(monthly_total, target, null), "String", "BlueTotal"),
    );

    return get_row(cells);
  };
  const get_ringkasan_outlet_insanku_sheet = (groups) => {
    const rows = [];
    const sorted_groups = [...(groups ?? [])].sort((a, b) =>
      String(a.outlet_name ?? "").localeCompare(String(b.outlet_name ?? ""), "id"),
    );
    const month_keys = get_month_keys_from_groups(sorted_groups);

    if (!month_keys.length) {
      rows.push(get_row([get_cell("Data ringkasan belum tersedia.", "String", "")]));

      return get_worksheet(
        "Ringkasan Outlet & InsanKu",
        rows,
        [160, 160, 90, 70, 80, 100],
      );
    }

    for (const month_key of month_keys) {
      rows.push(
        get_row([get_ringkasan_title_cell(get_month_label(month_key), 5)]),
      );
      rows.push(
        get_header_row([
          "NAMA",
          "OUTLET",
          "TOTAL BULAN",
          "TARGET",
          "PERSENTASE",
          "STATUS",
        ]),
      );

      const month_totals = { monthly_total: 0, target: 0 };

      for (const group of sorted_groups) {
        const monthly_group = get_monthly_group_for(group, month_key);
        const group_rows = [...(monthly_group?.rows ?? [])].sort((a, b) =>
          String(a.name ?? "").localeCompare(String(b.name ?? ""), "id"),
        );

        for (const row of group_rows) {
          rows.push(
            get_row([
              get_cell(row.name, "String", "Cell"),
              get_cell(group.outlet_name, "String", "Cell"),
              ...get_month_data_cells(row.monthly_total, row.target),
            ]),
          );
        }

        const group_totals = sum_month_rows(group_rows);

        month_totals.monthly_total += group_totals.monthly_total;
        month_totals.target += group_totals.target;

        rows.push(
          get_row([
            get_cell("TOTAL", "String", "BlueTotal"),
            get_cell(group.outlet_name, "String", "BlueTotal"),
            get_cell(group_totals.monthly_total, "Number", "BlueTotal"),
            get_cell(group_totals.target, "Number", "BlueTotal"),
            get_cell(
              get_percentage_label(group_totals.monthly_total, group_totals.target),
              "String",
              "BlueTotal",
            ),
            get_cell(
              get_status_label(group_totals.monthly_total, group_totals.target, null),
              "String",
              "BlueTotal",
            ),
          ]),
        );
      }

      rows.push(
        get_month_total_row(
          [get_cell("TOTAL", "String", "BlueTotal"), get_cell("", "String", "BlueTotal")],
          month_totals.monthly_total,
          month_totals.target,
        ),
      );
      rows.push(get_row([]));
      rows.push(get_row([]));
    }

    return get_worksheet(
      "Ringkasan Outlet & InsanKu",
      rows,
      [160, 160, 90, 70, 80, 100],
    );
  };
  const get_ringkasan_outlet_sheet = (groups) => {
    const rows = [];
    const sorted_groups = [...(groups ?? [])].sort((a, b) =>
      String(a.outlet_name ?? "").localeCompare(String(b.outlet_name ?? ""), "id"),
    );
    const month_keys = get_month_keys_from_groups(sorted_groups);

    if (!month_keys.length) {
      rows.push(get_row([get_cell("Data ringkasan belum tersedia.", "String", "")]));

      return get_worksheet(
        "Ringkasan Outlet",
        rows,
        [160, 90, 70, 80, 100],
      );
    }

    for (const month_key of month_keys) {
      rows.push(
        get_row([get_ringkasan_title_cell(get_month_label(month_key), 4)]),
      );
      rows.push(
        get_header_row([
          "OUTLET",
          "TOTAL BULAN",
          "TARGET",
          "PERSENTASE",
          "STATUS",
        ]),
      );

      const month_totals = { monthly_total: 0, target: 0 };

      for (const group of sorted_groups) {
        const monthly_group = get_monthly_group_for(group, month_key);
        const group_totals = sum_month_rows(monthly_group?.rows ?? []);

        month_totals.monthly_total += group_totals.monthly_total;
        month_totals.target += group_totals.target;

        rows.push(
          get_row([
            get_cell(group.outlet_name, "String", "Cell"),
            ...get_month_data_cells(group_totals.monthly_total, group_totals.target),
          ]),
        );
      }

      rows.push(
        get_month_total_row(
          [get_cell("TOTAL", "String", "BlueTotal")],
          month_totals.monthly_total,
          month_totals.target,
        ),
      );
      rows.push(get_row([]));
      rows.push(get_row([]));
    }

    return get_worksheet(
      "Ringkasan Outlet",
      rows,
      [160, 90, 70, 80, 100],
    );
  };
  const get_ringkasan_insanku_sheet = (groups) => {
    const rows = [];
    const sorted_groups = [...(groups ?? [])].sort((a, b) =>
      String(a.outlet_name ?? "").localeCompare(String(b.outlet_name ?? ""), "id"),
    );
    const month_keys = get_month_keys_from_groups(sorted_groups);

    if (!month_keys.length) {
      rows.push(get_row([get_cell("Data ringkasan belum tersedia.", "String", "")]));

      return get_worksheet(
        "Ringkasan InsanKu",
        rows,
        [160, 160, 90, 70, 80, 100],
      );
    }

    for (const month_key of month_keys) {
      rows.push(
        get_row([get_ringkasan_title_cell(get_month_label(month_key), 5)]),
      );
      rows.push(
        get_header_row([
          "NAMA",
          "OUTLET",
          "TOTAL BULAN",
          "TARGET",
          "PERSENTASE",
          "STATUS",
        ]),
      );

      const aggregated = new Map();

      for (const group of sorted_groups) {
        const monthly_group = get_monthly_group_for(group, month_key);

        for (const row of monthly_group?.rows ?? []) {
          const key = String(row.uuid ?? row.name ?? "");
          const existing = aggregated.get(key);

          if (!existing) {
            aggregated.set(key, {
              name: row.name,
              outlet_names: new Set([group.outlet_name]),
              monthly_total: Number(row.monthly_total || 0),
              target: Number(row.target || 0),
            });
          } else {
            existing.outlet_names.add(group.outlet_name);
            existing.monthly_total += Number(row.monthly_total || 0);
            existing.target = Math.max(existing.target, Number(row.target || 0));
          }
        }
      }

      const month_rows = Array.from(aggregated.values())
        .map((item) => ({
          ...item,
          outlet_label: Array.from(item.outlet_names)
            .sort((a, b) => String(a).localeCompare(String(b), "id"))
            .join(", "),
        }))
        .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "id"));

      for (const row of month_rows) {
        rows.push(
          get_row([
            get_cell(row.name, "String", "Cell"),
            get_cell(row.outlet_label, "String", "Cell"),
            ...get_month_data_cells(row.monthly_total, row.target),
          ]),
        );
      }

      const month_totals = sum_month_rows(month_rows);

      rows.push(
        get_month_total_row(
          [get_cell("TOTAL", "String", "BlueTotal"), get_cell("", "String", "BlueTotal")],
          month_totals.monthly_total,
          month_totals.target,
        ),
      );
      rows.push(get_row([]));
      rows.push(get_row([]));
    }

    return get_worksheet(
      "Ringkasan InsanKu",
      rows,
      [160, 160, 90, 70, 80, 100],
    );
  };
  const get_export_columns = (total_days) => {
    const day_columns = Array.from({ length: total_days }, (_, index) => index + 1);

    return [
      { label: "NO", type: "no" },
      { label: "NAMA", type: "name" },
      ...day_columns.flatMap((day) => {
        const columns = [{ label: String(day), type: "day", day }];

        if (day % 7 === 0) {
          columns.push({
            label: `TOTAL MINGGU ${day / 7}`,
            type: "week",
            start_day: day - 6,
            end_day: day,
          });
        }

        return columns;
      }),
      { label: "TOTAL BULAN", type: "month" },
      { label: "TARGET", type: "target" },
      { label: "PERSENTASE", type: "percentage" },
    ];
  };
  const get_column_width = (column_type, name_column_width) => {
    if (column_type === "no") {
      return 36;
    }

    if (column_type === "name") {
      return name_column_width;
    }

    if (column_type === "week") {
      return 90;
    }

    if (column_type === "month") {
      return 78;
    }

    if (column_type === "percentage") {
      return 76;
    }

    if (column_type === "target") {
      return 68;
    }

    return 36;
  };
  const get_sheet_column_widths = (monthly_groups) => {
    const column_widths = [];
    const longest_name_length = monthly_groups.reduce(
      (maximum_length, monthly_group) => (monthly_group.rows ?? []).reduce(
        (group_maximum, row) => Math.max(
          group_maximum,
          String(row.name ?? "").length,
        ),
        maximum_length,
      ),
      0,
    );
    const name_column_width = Math.min(
      210,
      Math.max(120, (longest_name_length + 2) * 6.5),
    );

    for (const monthly_group of monthly_groups) {
      const export_columns = get_export_columns(monthly_group.total_days);

      export_columns.forEach((column, index) => {
        column_widths[index] = Math.max(
          column_widths[index] ?? 0,
          get_column_width(column.type, name_column_width),
        );
      });
    }

    return column_widths;
  };
  const get_month_section_rows = (monthly_group) => {
    const export_columns = get_export_columns(monthly_group.total_days);
    const day_columns = Array.from(
      { length: monthly_group.total_days },
      (_, index) => index + 1,
    );

    return [
      get_row([get_merged_title_cell(get_month_label(monthly_group.month_key))]),
      get_row([]),
      get_row(export_columns.map((column) => get_cell(column.label, "String", "Header"))),
      ...monthly_group.rows.map((row, row_index) =>
        get_row(
          export_columns.map((column) => {
            const daily_totals = row.daily_totals ?? {};

            if (column.type === "no") {
              return get_cell(row_index + 1, "Number", "Cell");
            }

            if (column.type === "name") {
              return get_cell(row.name, "String", "Cell");
            }

            if (column.type === "day") {
              const daily_total = daily_totals[column.day];

              return daily_total
                ? get_cell(daily_total, "Number", "Cell")
                : get_cell("", "String", "Cell");
            }

            if (column.type === "week") {
              const weekly_total = day_columns
                .filter((day) => day >= column.start_day && day <= column.end_day)
                .reduce((total, day) => total + Number(daily_totals[day] || 0), 0);

              return get_cell(weekly_total, "Number", "Cell");
            }

            if (column.type === "month") {
              return get_cell(row.monthly_total, "Number", "Cell");
            }

            if (column.type === "target") {
              return get_cell(row.target, "Number", "Cell");
            }

            return get_cell(
              row.target ? `${Math.round((row.monthly_total / row.target) * 100)}%` : "0%",
              "String",
              "Cell",
            );
          }),
        ),
      ),
      get_row(
        export_columns.map((column) => {
          if (column.type === "name") {
            return get_cell("TOTAL", "String", "Total");
          }

          if (column.type === "day") {
            const daily_total = monthly_group.rows.reduce(
              (total, row) => total + Number(row.daily_totals?.[column.day] || 0),
              0,
            );

            return get_cell(daily_total || "", daily_total ? "Number" : "String", "Total");
          }

          if (column.type === "week") {
            const weekly_total = monthly_group.rows.reduce((group_total, row) => {
              const employee_total = day_columns
                .filter((day) => day >= column.start_day && day <= column.end_day)
                .reduce(
                  (total, day) => total + Number(row.daily_totals?.[day] || 0),
                  0,
                );

              return group_total + employee_total;
            }, 0);

            return get_cell(weekly_total, "Number", "GrandTotal");
          }

          if (column.type === "month") {
            const monthly_total = monthly_group.rows.reduce(
              (total, row) => total + Number(row.monthly_total || 0),
              0,
            );

            return get_cell(monthly_total, "Number", "GrandTotal");
          }

          if (column.type === "target") {
            const target_total = monthly_group.rows.reduce(
              (total, row) => total + Number(row.target || 0),
              0,
            );

            return get_cell(target_total, "Number", "GrandTotal");
          }

          return get_cell("", "String", "Total");
        }),
      ),
      get_row([]),
      get_row([]),
    ];
  };
  used_sheet_names.add("Ringkasan Outlet & InsanKu");
  used_sheet_names.add("Ringkasan Outlet");
  used_sheet_names.add("Ringkasan InsanKu");
  const worksheets = [
    get_ringkasan_outlet_insanku_sheet(export_groups),
    get_ringkasan_outlet_sheet(export_groups),
    get_ringkasan_insanku_sheet(export_groups),
    ...export_groups.map((group, index) => {
      const monthly_groups = group.monthly_groups ?? [];
      const rows = monthly_groups.flatMap(get_month_section_rows);
      const column_widths = get_sheet_column_widths(monthly_groups);

      return get_worksheet(
        get_sheet_name(group.outlet_name, index),
        rows,
        column_widths,
      );
    }),
  ];
  const workbook = `<?xml version="1.0"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook
      xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:html="http://www.w3.org/TR/REC-html40"
    >
      <Styles>
        <Style ss:ID="Default" ss:Name="Normal">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}"/>
        </Style>
        <Style ss:ID="Title">
          <Font ss:FontName="${export_font_name}" ss:Bold="1" ss:Size="18"/>
        </Style>
        <Style ss:ID="Header">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}" ss:Bold="1"/>
          <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
          <Interior ss:Color="#FFFF00" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Cell">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}"/>
          <Alignment ss:Vertical="Center" ss:WrapText="1"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="WeekTotal">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}"/>
          <Interior ss:Color="#FFFF00" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Total">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}" ss:Bold="1"/>
          <Interior ss:Color="#BDD7EE" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="GrandTotal">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}" ss:Bold="1"/>
          <Interior ss:Color="#BDD7EE" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="BlueCell">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}"/>
          <Interior ss:Color="#BDD7EE" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="BlueTotal">
          <Font ss:FontName="${export_font_name}" ss:Size="${export_font_size}" ss:Bold="1"/>
          <Interior ss:Color="#BDD7EE" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
      </Styles>
      ${worksheets.join("")}
    </Workbook>`;
  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "penjualan-gofitku.xls";
  link.click();
  URL.revokeObjectURL(url);
}
