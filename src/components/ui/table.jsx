"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const default_fixed_column_labels = ["no", "nik", "nama", "outlet"];
const wrap_fixed_column_labels = ["nama", "outlet"];
const fixed_column_min_width = 768;
const fixed_column_widths = {
  nama: 208,
  outlet: 240,
};

function normalize_header_label(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function find_matching_fixed_label(label, configured_labels) {
  return configured_labels.find((configured_label) =>
    label === configured_label || label.startsWith(`${configured_label} `),
  );
}

function should_disable_default_fixed_columns() {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/nilai-transaksi-basket-size")
  );
}

function Table({
  className,
  containerClassName,
  fixedColumns = "default",
  ...props
}) {
  const table_ref = React.useRef(null);

  React.useLayoutEffect(() => {
    const table = table_ref.current;

    if (!table || fixedColumns === "none" || should_disable_default_fixed_columns()) {
      return undefined;
    }

    const configured_labels = fixedColumns === "default"
      ? default_fixed_column_labels
      : (
          (Array.isArray(fixedColumns) ? fixedColumns : [])
            .map(normalize_header_label)
            .filter(Boolean)
        );
    const reset_fixed_cell = (cell) => {
      cell.removeAttribute("data-table-fixed-column");
      cell.removeAttribute("data-table-layered-header");
      cell.style.position = "";
      cell.style.left = "";
      cell.style.zIndex = "";
      cell.style.background = "";
      cell.style.whiteSpace = "";
      cell.style.width = "";
      cell.style.minWidth = "";
      cell.style.maxWidth = "";
      cell.style.boxShadow = "";
    };

    const apply_fixed_columns = () => {
      table
        .querySelectorAll("[data-table-fixed-column], [data-table-layered-header]")
        .forEach((cell) => reset_fixed_cell(cell));

      const header_cells = Array.from(table.querySelectorAll("thead th"));
      const fixed_columns = [];
      let left_offset = 0;

      header_cells.forEach((header_cell) => {
        const computed_background = window.getComputedStyle(header_cell).backgroundColor;
        const has_background =
          computed_background &&
          computed_background !== "rgba(0, 0, 0, 0)" &&
          computed_background !== "transparent";

        header_cell.setAttribute("data-table-layered-header", "true");
        header_cell.style.zIndex = "30";
        header_cell.style.background = has_background
          ? computed_background
          : "var(--primary)";
      });

      if (window.innerWidth < fixed_column_min_width) {
        return;
      }

      for (const [index, header_cell] of header_cells.entries()) {
        const label = normalize_header_label(header_cell.innerText);
        const matched_label = find_matching_fixed_label(label, configured_labels);

        if (!matched_label) {
          break;
        }

        const configured_width = fixed_column_widths[matched_label];

        if (configured_width) {
          [
            header_cell,
            ...Array.from(table.querySelectorAll("tbody tr"))
              .map((row) => row.children[index])
              .filter((cell) => cell instanceof HTMLElement),
          ].forEach((cell) => {
            cell.style.width = `${configured_width}px`;
            cell.style.minWidth = `${configured_width}px`;
            cell.style.maxWidth = `${configured_width}px`;
            cell.style.whiteSpace = "normal";
          });
        }

        const rendered_width = header_cell.getBoundingClientRect().width;

        fixed_columns.push({
          index,
          label: matched_label,
          left: left_offset,
          width: rendered_width,
          configured_width,
        });
        left_offset += rendered_width;
      }

      if (!fixed_columns.length) {
        return;
      }

      const apply_cell_style = (cell, column, is_header) => {
        const can_wrap = wrap_fixed_column_labels.includes(column.label);
        const computed_background = window.getComputedStyle(cell).backgroundColor;
        const fallback_background = is_header ? "var(--primary)" : "var(--card)";
        const has_background =
          computed_background &&
          computed_background !== "rgba(0, 0, 0, 0)" &&
          computed_background !== "transparent";

        cell.setAttribute("data-table-fixed-column", column.label);
        cell.style.position = "sticky";
        cell.style.left = `${column.left}px`;
        cell.style.zIndex = is_header ? "50" : "20";
        cell.style.background = has_background
          ? computed_background
          : fallback_background;
        cell.style.whiteSpace = can_wrap ? "normal" : "nowrap";
        cell.style.width = column.configured_width
          ? `${column.configured_width}px`
          : "";
        cell.style.minWidth = `${Math.ceil(column.configured_width ?? column.width)}px`;
        cell.style.maxWidth = column.configured_width
          ? `${column.configured_width}px`
          : "";

        if (column.index === fixed_columns.at(-1).index) {
          cell.style.boxShadow = "1px 0 0 var(--border)";
        }
      };

      fixed_columns.forEach((column) => {
        const header_cell = header_cells[column.index];

        if (header_cell) {
          apply_cell_style(header_cell, column, true);
        }

        table.querySelectorAll("tbody tr").forEach((row) => {
          const cell = row.children[column.index];

          if (cell instanceof HTMLElement) {
            apply_cell_style(cell, column, false);
          }
        });
      });
    };

    apply_fixed_columns();
    const resize_observer = new ResizeObserver(apply_fixed_columns);

    resize_observer.observe(table);
    window.addEventListener("resize", apply_fixed_columns);

    return () => {
      resize_observer.disconnect();
      window.removeEventListener("resize", apply_fixed_columns);
      table
        .querySelectorAll("[data-table-fixed-column], [data-table-layered-header]")
        .forEach((cell) => reset_fixed_cell(cell));
    };
  }, [fixedColumns, props.children]);

  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        ref={table_ref}
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props} />
    </div>
  );
}

function TableHeader({
  className,
  sticky = true,
  variant = "primary",
  style,
  ...props
}) {
  return (
    <thead
      data-slot="table-header"
      style={sticky
        ? { ...style, position: "sticky", top: 0, zIndex: 40 }
        : style}
      className={cn(
        "[&_tr]:border-b",
        sticky && "[&_th]:sticky [&_th]:top-0 [&_th]:z-10",
        variant === "primary" &&
          "[&_th]:bg-primary [&_th]:text-primary-foreground",
        className
      )}
      {...props} />
  );
}

function TableBody({
  className,
  ...props
}) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  );
}

function TableRow({
  className,
  ...props
}) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props} />
  );
}

function TableHead({
  className,
  ...props
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props} />
  );
}

function TableCell({
  className,
  ...props
}) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props} />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
}
