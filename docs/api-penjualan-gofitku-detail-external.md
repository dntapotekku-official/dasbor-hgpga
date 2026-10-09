# API Eksternal Detail Penjualan GoFitKu

Dokumen ini menjelaskan endpoint untuk mengambil total qty penjualan GoFitKu per tanggal.

## Endpoint

```http
GET /api/external/penjualan-gofitku/detail
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
| `date` | Ya | `YYYY-MM` atau `YYYY-MM-DD` | Bulan atau tanggal acuan. Jika berisi bulan, API mengembalikan seluruh tanggal di bulan tersebut. Jika berisi tanggal harian, API hanya mengembalikan tanggal tersebut. |
| `uuid_outlet` | Tidak | UUID | Filter data untuk satu outlet berdasarkan UUID outlet. |
| `outlet_name` | Tidak | String | Filter data berdasarkan nama outlet. Bisa diisi nama lengkap, sebagian nama, atau versi normalized tanpa spasi/simbol. |

Alias `tanggal` masih diterima untuk kompatibilitas, tetapi integrasi baru disarankan memakai `date`.

Jika `uuid_outlet` dan `outlet_name` dikirim bersamaan, data harus cocok dengan kedua filter tersebut.

## Contoh Request

Filter berdasarkan bulan:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/detail?date=2026-10&uuid_outlet=<UUID_OUTLET>" \
  -H "x-api-key: <API_KEY>"
```

Filter berdasarkan tanggal harian:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/detail?date=2026-10-09&uuid_outlet=<UUID_OUTLET>" \
  -H "x-api-key: <API_KEY>"
```

Filter berdasarkan nama outlet:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/detail?date=2026-10&outlet_name=apotekku9renon" \
  -H "x-api-key: <API_KEY>"
```

## Response Sukses

Jika `date=2026-10` dikirim, response berisi seluruh tanggal pada bulan tersebut:

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-10-01",
      "qty": 0
    },
    {
      "date": "2026-10-02",
      "qty": 4
    },
    {
      "date": "2026-10-03",
      "qty": 0
    },
    {
      "date": "2026-10-31",
      "qty": 12
    }
  ]
}
```

Jika `date=2026-10-09` dikirim, response hanya berisi tanggal tersebut:

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-10-09",
      "qty": 12
    }
  ]
}
```

## Struktur Response

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `success` | Boolean | Status request. |
| `data` | Array | Daftar rekap tanggal. |
| `data[].date` | String | Tanggal rekap dalam format `YYYY-MM-DD`. |
| `data[].qty` | Number | Total qty penjualan GoFitKu pada tanggal tersebut. |

## Aturan Perhitungan

- `date` wajib dikirim.
- `date` boleh berformat `YYYY-MM` atau `YYYY-MM-DD`.
- Jika `date=YYYY-MM` dikirim, response mengembalikan seluruh tanggal kalender pada bulan tersebut.
- Jika `date=YYYY-MM-DD` dikirim, response hanya mengembalikan tanggal tersebut.
- Tanggal tanpa transaksi tetap dikembalikan dengan `qty: 0`.
- `qty` adalah akumulasi `qty` dari semua produk GoFitKu pada tanggal response.
- Jika filter outlet dikirim, total hanya menghitung penjualan outlet yang cocok.
- Penjualan pada tanggal ketika penempatan atau InsanKu sedang nonaktif tidak dihitung.
- Penjualan pada tanggal ketika InsanKu sedang masuk periode pengecualian GoFitKu tidak dihitung.
- Data penjualan yang `deleted_at` terisi tidak dihitung.
- Outlet, penempatan, atau InsanKu yang tidak aktif, deleted, atau outlet `excep` tidak dihitung.

## Response Error

API key tidak valid:

```json
{
  "success": false,
  "message": "API key tidak valid."
}
```

Parameter `date` tidak dikirim:

```json
{
  "success": false,
  "message": "Date wajib diisi."
}
```

Format `date` salah:

```json
{
  "success": false,
  "message": "Format date harus YYYY-MM atau YYYY-MM-DD."
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
