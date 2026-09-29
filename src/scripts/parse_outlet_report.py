import json
import sys
from datetime import datetime, timedelta
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
target_col_2 = "Kunjungan"
fallback_target_col_2 = "Dilayani"

target_sheet_3 = "BASKET SIZE"
target_col_3 = "Sum of sku_hari"
target_col_4 = "kunjungan"
target_sheet_4 = "Rekap Penjualan"
target_col_5 = "Tanggal Penjualan"
target_col_6 = "Jumlah Sku"

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


def findFirstColumnIndex(header_row, target_columns):
    for target_column in target_columns:
        try:
            return findColumnIndex(header_row, target_column)
        except ValueError:
            continue

    raise ValueError(f"Kolom wajib tidak ditemukan: {' atau '.join(target_columns)}")


def normalizeDate(value):
    normalized_value = str(value or "").strip()

    if not normalized_value:
        return ""

    # Excel dapat menyimpan tanggal sebagai serial number, bukan teks ISO.
    try:
        serial_value = float(normalized_value)
        if serial_value > 0:
            return (datetime(1899, 12, 30) + timedelta(days=serial_value)).date().isoformat()
    except ValueError:
        pass

    normalized_value = normalized_value[:10]

    try:
        return datetime.strptime(normalized_value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        return ""


def main(file_path, import_date=None):
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File tidak ditemukan: {path}")

    with ZipFile(path) as archive:
        shared_strings = readSharedString(archive)
        targets = readSheetTargets(archive)

        penjualan_rows = readSheetRows(
            archive,
            targets[target_sheet_1],
            shared_strings,
        ) if target_sheet_1 in targets else []
        kunjungan_rows = readSheetRows(
            archive,
            targets[target_sheet_2],
            shared_strings,
        ) if target_sheet_2 in targets else []
        basket_size_rows = readSheetRows(
            archive,
            targets[target_sheet_3],
            shared_strings,
        ) if target_sheet_3 in targets else []
        rekap_penjualan_rows = readSheetRows(
            archive,
            targets[target_sheet_4],
            shared_strings,
        ) if target_sheet_4 in targets else []

    output_map = {}

    if penjualan_rows and kunjungan_rows:
        penjualan_header = penjualan_rows[0]
        kunjungan_header = kunjungan_rows[0]
        outlet_col_penjualan = 0
        outlet_col_kunjungan = 0
        target_col_penjualan_index = findColumnIndex(penjualan_header, target_col_1)
        target_col_kunjungan_index = findFirstColumnIndex(
            kunjungan_header,
            [target_col_2, fallback_target_col_2],
        )

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

            output_map.setdefault(outlet_name, {"outlet_name": outlet_name}).update(
                {
                    "total_penerimaan_pendapatan": penjualan["total_penerimaan_pendapatan"],
                    "kunjungan": toNumber(row[target_col_kunjungan_index]),
                    "kunjungan_nilai_transaksi": toNumber(row[target_col_kunjungan_index]),
                    "served": toNumber(row[target_col_kunjungan_index]),
                    "served_nilai_transaksi": toNumber(row[target_col_kunjungan_index]),
                }
            )

    if rekap_penjualan_rows:
        rekap_header = rekap_penjualan_rows[0]
        outlet_col_rekap = findColumnIndex(rekap_header, "Outlet")
        date_col_rekap = findColumnIndex(rekap_header, target_col_5)
        sku_qty_col_rekap = findColumnIndex(rekap_header, target_col_6)
        normalized_import_date = normalizeDate(import_date)

        for row in rekap_penjualan_rows[1:]:
            if not row:
                continue

            if len(row) <= max(outlet_col_rekap, date_col_rekap, sku_qty_col_rekap):
                continue

            outlet_name = str(row[outlet_col_rekap]).strip()
            if isTotalRow(outlet_name):
                break

            if not outlet_name:
                continue

            row_date = normalizeDate(row[date_col_rekap])

            if not row_date:
                continue

            if normalized_import_date and row_date != normalized_import_date:
                continue

            output_key = f"{outlet_name}\0{row_date}"
            current_row = output_map.setdefault(
                output_key,
                {
                    "outlet_name": outlet_name,
                    "date": row_date,
                    "sku_qty": 0,
                },
            )
            current_row["sku_qty"] = current_row.get("sku_qty", 0) + toNumber(row[sku_qty_col_rekap])

    elif basket_size_rows:
        normalized_import_date = normalizeDate(import_date)

        if not normalized_import_date:
            raise ValueError(
                "File Basket Size wajib memiliki sheet Rekap Penjualan dengan kolom Tanggal Penjualan."
            )

        basket_header = basket_size_rows[0]
        outlet_col_basket = 0
        sku_qty_col_index = findColumnIndex(basket_header, target_col_3)
        kunjungan_col_index = findColumnIndex(basket_header, target_col_4)

        for row in basket_size_rows[1:]:
            if not row:
                continue

            if len(row) <= max(outlet_col_basket, sku_qty_col_index, kunjungan_col_index):
                continue

            outlet_name = str(row[outlet_col_basket]).strip()
            if isTotalRow(outlet_name):
                break

            if not outlet_name:
                continue

            output_map.setdefault(outlet_name, {"outlet_name": outlet_name}).update(
                {
                    "date": normalized_import_date,
                    "sku_qty": toNumber(row[sku_qty_col_index]),
                    "kunjungan": toNumber(row[kunjungan_col_index]),
                    "kunjungan_basket_size": toNumber(row[kunjungan_col_index]),
                    "served_basket_size": toNumber(row[kunjungan_col_index]),
                }
            )

    output_rows = list(output_map.values())

    if not output_rows:
        raise ValueError("Data sheet pada file Excel kosong atau tidak sesuai format.")

    print(json.dumps({"rows": output_rows}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
