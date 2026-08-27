import json
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


namespaces = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def read_shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values = []

    for item in root.findall("a:si", namespaces):
        texts = []
        for node in item.iterfind(".//a:t", namespaces):
            texts.append(node.text or "")
        values.append("".join(texts))

    return values


def read_sheet_targets(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {}

    for rel in relationships:
        rel_map[rel.attrib["Id"]] = rel.attrib["Target"]

    targets = []
    for sheet in workbook.find("a:sheets", namespaces):
        rel_id = sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        target = rel_map[rel_id]
        targets.append(f"xl/{target}" if not target.startswith("xl/") else target)

    return targets


def cell_value(cell, shared_strings):
    cell_type = cell.attrib.get("t")

    if cell_type == "s":
        node = cell.find("a:v", namespaces)
        return shared_strings[int(node.text)] if node is not None and node.text else ""

    if cell_type == "inlineStr":
        return "".join((node.text or "") for node in cell.findall(".//a:t", namespaces))

    node = cell.find("a:v", namespaces)
    return node.text if node is not None else ""


def read_sheet_rows(archive, sheet_path, shared_strings):
    root = ET.fromstring(archive.read(sheet_path))
    rows = []

    for row in root.findall(".//a:sheetData/a:row", namespaces):
        values = []
        for cell in row.findall("a:c", namespaces):
          values.append(cell_value(cell, shared_strings))
        rows.append(values)

    return rows


def normalize_header(value):
    return str(value or "").strip().casefold()


def find_column_index(header_row, target_column):
    normalized_target = normalize_header(target_column)

    for index, cell_value in enumerate(header_row):
        if normalize_header(cell_value) == normalized_target:
            return index

    raise ValueError(f"Kolom wajib tidak ditemukan: {target_column}")


def main(file_path):
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {path}")

    with ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive)
        targets = read_sheet_targets(archive)

        if not targets:
            raise ValueError("Sheet pada file Excel tidak ditemukan.")

        rows = read_sheet_rows(archive, targets[0], shared_strings)

    if not rows:
        raise ValueError("Data sheet pada file Excel kosong.")

    header_row = rows[0]
    outlet_col_index = find_column_index(header_row, "outlet")
    target_col_index = find_column_index(header_row, "target")

    output_rows = []
    for row in rows[1:]:
        if not row:
            continue

        if len(row) <= max(outlet_col_index, target_col_index):
            continue

        outlet_name = str(row[outlet_col_index]).strip()
        target_value = str(row[target_col_index]).strip()

        if not outlet_name and not target_value:
            continue

        output_rows.append(
            {
                "outlet_name": outlet_name,
                "target": target_value,
            }
        )

    print(json.dumps({"rows": output_rows}))


if __name__ == "__main__":
    main(sys.argv[1])
