export function export_penjualan_gofitku(export_groups) {
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
  const get_column_width = (column_type) => {
    if (column_type === "no") {
      return 42;
    }

    if (column_type === "name") {
      return 300;
    }

    if (column_type === "week") {
      return 120;
    }

    if (column_type === "month") {
      return 110;
    }

    if (column_type === "percentage") {
      return 120;
    }

    if (column_type === "target") {
      return 80;
    }

    return 42;
  };
  const get_sheet_column_widths = (monthly_groups) => {
    const column_widths = [];

    for (const monthly_group of monthly_groups) {
      const export_columns = get_export_columns(monthly_group.total_days);

      export_columns.forEach((column, index) => {
        column_widths[index] = Math.max(
          column_widths[index] ?? 0,
          get_column_width(column.type),
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

              return get_cell(weekly_total, "Number", "WeekTotal");
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

          return get_cell("", "String", "Total");
        }),
      ),
      get_row([]),
      get_row([]),
    ];
  };
  const worksheets = export_groups.map((group, index) => {
    const monthly_groups = group.monthly_groups ?? [];
    const rows = monthly_groups.flatMap(get_month_section_rows);
    const column_widths = get_sheet_column_widths(monthly_groups);

    return get_worksheet(
      get_sheet_name(group.outlet_name, index),
      rows,
      column_widths,
    );
  });
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
        <Style ss:ID="Title">
          <Font ss:Bold="1" ss:Size="16"/>
        </Style>
        <Style ss:ID="Header">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#FFFF00" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Cell">
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="WeekTotal">
          <Interior ss:Color="#FFFF00" ss:Pattern="Solid"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="Total">
          <Font ss:Bold="1"/>
          <Borders>
            <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
            <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
          </Borders>
        </Style>
        <Style ss:ID="GrandTotal">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#00E5E5" ss:Pattern="Solid"/>
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
