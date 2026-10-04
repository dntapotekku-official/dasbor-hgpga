import json
import posixpath
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
        target = rel_map[rel_id].replace("\\", "/")

        if target.startswith("/"):
            resolved_target = target.lstrip("/")
        else:
            resolved_target = posixpath.normpath(posixpath.join("xl", target))

        targets.append(resolved_target)

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


def find_optional_column_index(header_row, target_columns):
    normalized_targets = {normalize_header(column) for column in target_columns}

    for index, value in enumerate(header_row):
        if normalize_header(value) in normalized_targets:
            return index

    return None


def main(file_path, subject="outlet"):
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
    target_col_index = find_column_index(header_row, "target")
    if subject == "insanku":
        subject_col_index = find_optional_column_index(
            header_row,
            ["insanku", "insan ku", "nama insanku", "nama insan ku"],
        )
        nik_col_index = find_optional_column_index(header_row, ["nik"])
        outlet_col_index = find_optional_column_index(header_row, ["outlet", "nama outlet"])

        if subject_col_index is None and nik_col_index is None:
            raise ValueError("Kolom wajib tidak ditemukan: InsanKU atau NIK")
    else:
        subject_col_index = find_column_index(header_row, "outlet")
        nik_col_index = None
        outlet_col_index = None

    output_rows = []
    for row in rows[1:]:
        if not row:
            continue

        required_indexes = [target_col_index]
        if subject_col_index is not None:
            required_indexes.append(subject_col_index)
        if nik_col_index is not None:
            required_indexes.append(nik_col_index)
        if outlet_col_index is not None:
            required_indexes.append(outlet_col_index)

        if len(row) <= max(required_indexes):
            continue

        subject_name = (
            str(row[subject_col_index]).strip()
            if subject_col_index is not None
            else ""
        )
        nik = str(row[nik_col_index]).strip() if nik_col_index is not None else ""
        outlet_name = (
            str(row[outlet_col_index]).strip()
            if outlet_col_index is not None
            else ""
        )
        target_value = str(row[target_col_index]).strip()

        if not subject_name and not nik and not outlet_name and not target_value:
            continue

        output_row = {"target": target_value}
        if subject == "insanku":
            output_row["insanku_name"] = subject_name
            output_row["nik"] = nik
            output_row["outlet_name"] = outlet_name
        else:
            output_row["outlet_name"] = subject_name

        output_rows.append(output_row)

    print(json.dumps({"rows": output_rows}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "outlet")
