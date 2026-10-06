# API Eksternal Penjualan GoFitKu

Dokumen ini menjelaskan endpoint untuk mengambil rekap penjualan GoFitKu per outlet dan InsanKu.

## Endpoint

```http
GET /api/external/penjualan-gofitku
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

1. `PENJUALAN_GOFITKU_API_KEY`
2. fallback ke `API_KEY_PERFORMANCE_REPORT`

## Query Parameter

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `uuid_outlet` | Tidak | UUID | Filter data untuk satu outlet. Jika kosong, API mengembalikan semua outlet aktif. |
| `tanggal` | Tidak | `YYYY-MM` | Filter bulan dan tahun penjualan. Contoh: `2026-10`. |

## Contoh Request

Ambil semua outlet:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku" \
  -H "x-api-key: <API_KEY>"
```

Ambil satu outlet untuk bulan tertentu:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku?uuid_outlet=<UUID_OUTLET>&tanggal=2026-10" \
  -H "x-api-key: <API_KEY>"
```

## Response Sukses

```json
{
  "success": true,
  "data": [
    {
      "uuid_outlet": "8f4a5b78-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "tanggal": "2026-10",
      "insanku": [
        {
          "uuid_insanku": "e7b1f4a2-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          "nama": "Nama InsanKu A",
          "total": 12
        },
        {
          "uuid_insanku": "9c2a7d31-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          "nama": "Nama InsanKu B",
          "total": 0
        }
      ]
    }
  ]
}
```

Jika `tanggal` tidak dikirim, field `tanggal` tidak muncul dan `total` dihitung dari seluruh data penjualan yang tersedia.

## Aturan Perhitungan

- Data InsanKu diambil dari penempatan aktif di `tbl_outlet_insanku`.
- InsanKu yang belum memiliki penjualan tetap dikembalikan dengan `total: 0`.
- `total` adalah akumulasi `qty` dari semua produk GoFitKu milik InsanKu tersebut.
- Jika `tanggal=YYYY-MM` dikirim, perhitungan hanya mencakup tanggal dari awal bulan sampai sebelum awal bulan berikutnya.
- Jika `tanggal=YYYY-MM` dikirim, penempatan/InsanKu hanya dikembalikan jika tersedia pada minimal satu hari di bulan tersebut.
- Penjualan pada tanggal ketika penempatan atau InsanKu sedang nonaktif tidak dihitung.
- Penjualan pada tanggal ketika InsanKu sedang masuk periode pengecualian GoFitKu tidak dihitung.
- Data yang `deleted_at` terisi tidak dihitung.
- Outlet, penempatan, atau InsanKu yang tidak aktif, deleted, atau outlet `excep` tidak dikembalikan.

## Response Error

API key tidak valid:

```json
{
  "success": false,
  "message": "API key tidak valid."
}
```

Format tanggal salah:

```json
{
  "success": false,
  "message": "Format tanggal harus YYYY-MM."
}
```

Outlet tidak ditemukan:

```json
{
  "success": false,
  "message": "Outlet tidak ditemukan."
}
```

## Status Code

| Status | Keterangan |
| --- | --- |
| `200` | Request berhasil. |
| `400` | Parameter tidak valid atau outlet tidak ditemukan. |
| `401` | API key tidak valid atau tidak dikirim. |
| `500` | Konfigurasi server belum lengkap atau terjadi kesalahan server. |
