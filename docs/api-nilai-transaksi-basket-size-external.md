# API Eksternal Nilai Transaksi dan Basket Size

Dokumen ini menjelaskan endpoint untuk mengambil data pemantauan nilai transaksi dan basket size outlet berdasarkan satu tanggal.

## Endpoint

```http
GET /api/external/nilai-transaksi-basket-size
```

## Autentikasi

Kirim API key melalui salah satu header berikut:

```http
x-api-key: <API_KEY>
```

atau:

```http
Authorization: Bearer <API_KEY>
```

Server membaca API key dari environment variable berikut:

1. `NILAI_TRANSAKSI_BASKET_SIZE_API_KEY`
2. fallback ke `API_KEY_PERFORMANCE_REPORT`

## Query Parameter

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `tanggal` | Ya | `YYYY-MM-DD` | Tanggal acuan data harian, bulan berjalan, dan pembanding bulan sebelumnya. Contoh: `2026-10-07`. |

## Contoh Request

```bash
curl -X GET "https://domain-anda.com/api/external/nilai-transaksi-basket-size?tanggal=2026-10-07" \
  -H "x-api-key: <API_KEY>"
```

## Response Sukses

```json
{
  "success": true,
  "tanggal": "2026-10-07",
  "summary_nt": {
    "target": 105000,
    "harian": 102113,
    "bulan_sebelumnya": 104522,
    "bulan_berjalan": 102113,
    "persen_growth": 102.36,
    "gap_growth": 2.36,
    "persen_dari_target": 99.55,
    "gap_target": -0.45
  },
  "summary_bs": {
    "target": 2,
    "bulan_sebelumnya": 1.76,
    "capaian": 1.77,
    "persen_dibanding_bulan_sebelumnya": 100.57,
    "gap_growth": 0.57,
    "persen_dibanding_target": 88.5,
    "gap_target": -11.5
  },
  "rows": [
    {
      "no": 1,
      "outlet": "ApotekKu No. 52 Ampenan Mataram",
      "jenis": "Non Pariwisata",
      "nilai_transaksi": {
        "target": 77972,
        "harian": 83180,
        "bulan_sebelumnya": 76262,
        "bulan_berjalan": 154738,
        "persen_growth": 202.9,
        "gap_growth": 102.9,
        "persen_dari_target": 198.45,
        "gap_target": 98.45
      },
      "basket_size": {
        "target": 2.08,
        "bulan_sebelumnya": 1.83,
        "capaian": 1.85,
        "persen_dibanding_bulan_sebelumnya": 100.97,
        "gap_growth": 0.97,
        "persen_dibanding_target": 88.86,
        "gap_target": -11.14
      }
    }
  ]
}
```

## Struktur Response

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `success` | Boolean | Status request. |
| `tanggal` | String | Tanggal acuan sesuai query parameter. |
| `summary_nt` | Object | Ringkasan total/rata-rata nilai transaksi semua outlet. |
| `summary_bs` | Object | Ringkasan total/rata-rata basket size semua outlet. |
| `rows` | Array | Daftar outlet dengan kolom seperti laporan pemantauan. |

## Field Nilai Transaksi

| Field | Keterangan |
| --- | --- |
| `target` | Target nilai transaksi. |
| `harian` | Nilai transaksi pada tanggal yang dipilih. |
| `bulan_sebelumnya` | Nilai transaksi periode bulan sebelumnya. |
| `bulan_berjalan` | Nilai transaksi bulan berjalan sampai tanggal yang dipilih. |
| `persen_growth` | Persentase pertumbuhan dibanding bulan sebelumnya. |
| `gap_growth` | Selisih persentase growth dari 100%. |
| `persen_dari_target` | Persentase capaian terhadap target. |
| `gap_target` | Selisih persentase capaian target dari 100%. |

## Field Basket Size

| Field | Keterangan |
| --- | --- |
| `target` | Target basket size. |
| `bulan_sebelumnya` | Basket size periode bulan sebelumnya. |
| `capaian` | Basket size bulan berjalan sampai tanggal yang dipilih. |
| `persen_dibanding_bulan_sebelumnya` | Persentase capaian dibanding bulan sebelumnya. |
| `gap_growth` | Selisih persentase growth dari 100%. |
| `persen_dibanding_target` | Persentase capaian terhadap target. |
| `gap_target` | Selisih persentase capaian target dari 100%. |

## Catatan Perhitungan

- Semua nilai dikirim sebagai angka mentah, tanpa format `Rp`, `%`, atau pemisah ribuan.
- `nilai_transaksi.harian` dihitung dari total penerimaan pendapatan harian dibagi kunjungan harian.
- `nilai_transaksi.bulan_berjalan` dihitung dari total penerimaan pendapatan bulan berjalan dibagi kunjungan bulan berjalan sampai tanggal acuan.
- `basket_size.capaian` dihitung dari jumlah SKU bulan berjalan dibagi kunjungan basket size bulan berjalan sampai tanggal acuan.
- Outlet yang dikembalikan adalah outlet aktif, tidak deleted, dan tidak masuk pengecualian.
- Data yang `deleted_at` terisi tidak dihitung.

## Response Error

API key tidak valid:

```json
{
  "success": false,
  "message": "API key tidak valid."
}
```

Parameter tanggal tidak dikirim:

```json
{
  "success": false,
  "message": "Parameter tanggal wajib diisi."
}
```

Format tanggal salah:

```json
{
  "success": false,
  "message": "Tanggal filter tidak valid."
}
```

## Status Code

| Status | Keterangan |
| --- | --- |
| `200` | Request berhasil. |
| `400` | Parameter tidak valid. |
| `401` | API key tidak valid atau tidak dikirim. |
| `500` | Konfigurasi server belum lengkap atau terjadi kesalahan server. |
