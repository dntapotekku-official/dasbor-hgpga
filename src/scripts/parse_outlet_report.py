import json
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


nilai_transaksi = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

target_sheet_1 = "Laporan Penjualan"
target_col_1 = "Total Penerimaan Pendapatan"

target_sheet_2 = "Statistik Kunjungan"
target_col_2 = "Dilayani"

def readSharedString(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values = []

    for item in root.findall("a:si", nilai_transaksi):
        texts = []
        for node in item.iterfind(".//a:t", nilai_transaksi):
            texts.append(node.text or "")
        values.append("".join(texts))

    return values


def readSheetTargets(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {}

    for rel in relationships:
        rel_map[rel.attrib["Id"]] = rel.attrib["Target"]

    targets = {}
    for sheet in workbook.find("a:sheets", nilai_transaksi):
        name = sheet.attrib["name"]
        rel_id = sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        target = rel_map[rel_id]
        targets[name] = f"xl/{target}" if not target.startswith("xl/") else target

    return targets


def cellValue(cell, shared_strings):
    cell_type = cell.attrib.get("t")

    if cell_type == "s":
        node = cell.find("a:v", nilai_transaksi)
        return shared_strings[int(node.text)] if node is not None and node.text else ""

    if cell_type == "inlineStr":
        return "".join((node.text or "") for node in cell.findall(".//a:t", nilai_transaksi))

    node = cell.find("a:v", nilai_transaksi)
    return node.text if node is not None else ""


def readSheetRows(archive, sheet_path, shared_strings):
    root = ET.fromstring(archive.read(sheet_path))
    rows = []

    for row in root.findall(".//a:sheetData/a:row", nilai_transaksi):
        values = []
        for cell in row.findall("a:c", nilai_transaksi):
            values.append(cellValue(cell, shared_strings))
        rows.append(values)

    return rows


def toNumber(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def isTotalRow(value):
    return str(value or "").strip().casefold() == "total"


def normalizeHeader(value):
    return str(value or "").strip().casefold()


def findColumnIndex(header_row, target_column):
    normalized_target = normalizeHeader(target_column)

    for index, cell_value in enumerate(header_row):
        if normalizeHeader(cell_value) == normalized_target:
            return index

    raise ValueError(f"Kolom wajib tidak ditemukan: {target_column}")


def main(file_path):
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {path}")

    with ZipFile(path) as archive:
        shared_strings = readSharedString(archive)
        targets = readSheetTargets(archive)

        if target_sheet_1 not in targets or target_sheet_2 not in targets:
            raise ValueError("Sheet wajib tidak ditemukan pada file Excel.")

        penjualan_rows = readSheetRows(
            archive,
            targets[target_sheet_1],
            shared_strings,
        )
        kunjungan_rows = readSheetRows(
            archive,
            targets[target_sheet_2],
            shared_strings,
        )

    if not penjualan_rows or not kunjungan_rows:
        raise ValueError("Data sheet pada file Excel kosong.")

    penjualan_header = penjualan_rows[0]
    kunjungan_header = kunjungan_rows[0]
    outlet_col_penjualan = 0
    outlet_col_kunjungan = 0
    target_col_penjualan_index = findColumnIndex(penjualan_header, target_col_1)
    target_col_kunjungan_index = findColumnIndex(kunjungan_header, target_col_2)

    penjualan_map = {}
    for row in penjualan_rows[1:]:
        if not row:
            continue

        if len(row) <= max(outlet_col_penjualan, target_col_penjualan_index):
            continue

        outlet_name = str(row[outlet_col_penjualan]).strip()
        if isTotalRow(outlet_name):
            break

        if not outlet_name:
            continue

        penjualan_map[outlet_name] = {
            "outlet_name": outlet_name,
            "total_penerimaan_pendapatan": toNumber(row[target_col_penjualan_index]),
        }

    output_rows = []
    for row in kunjungan_rows[1:]:
        if not row:
            continue

        if len(row) <= max(outlet_col_kunjungan, target_col_kunjungan_index):
            continue

        outlet_name = str(row[outlet_col_kunjungan]).strip()
        if isTotalRow(outlet_name):
            break

        if not outlet_name:
            continue

        penjualan = penjualan_map.get(outlet_name)
        if not penjualan:
            continue

        output_rows.append(
            {
                "outlet_name": outlet_name,
                "total_penerimaan_pendapatan": penjualan["total_penerimaan_pendapatan"],
                "dilayani": toNumber(row[target_col_kunjungan_index]),
            }
        )

    print(json.dumps({"rows": output_rows}))


if __name__ == "__main__":
    main(sys.argv[1])
