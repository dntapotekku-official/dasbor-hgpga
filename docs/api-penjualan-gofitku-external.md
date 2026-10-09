# API Eksternal Penjualan GoFitKu

Dokumen ini menjelaskan endpoint untuk mengambil rekap penjualan GoFitKu per outlet dan InsanKu.

## Endpoint

```http
GET /api/external/penjualan-gofitku
```

Rekap produk:

```http
GET /api/external/penjualan-gofitku/produk
```

Detail tanggal:

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
| `uuid_outlet` | Tidak | UUID | Filter data untuk satu outlet. Jika kosong, API mengembalikan semua outlet aktif. |
| `outlet_name` | Tidak | String | Filter data berdasarkan nama outlet. Bisa diisi nama lengkap, sebagian nama, atau versi normalized tanpa spasi/simbol. |
| `insanku_name` | Tidak | String | Filter data berdasarkan nama InsanKu. Bisa diisi nama lengkap, sebagian nama, atau versi normalized tanpa spasi/simbol. |
| `date` | Tidak | `YYYY-MM` | Filter bulan dan tahun penjualan. Contoh: `2026-10`. |

Jika beberapa filter dikirim bersamaan, data harus cocok dengan semua filter tersebut.

## Format Pencarian Nama

`outlet_name` dan `insanku_name` dinormalisasi sebelum dicocokkan:

- huruf besar/kecil diabaikan
- spasi diabaikan
- simbol/tanda baca diabaikan
- angka tetap dihitung

Contoh berikut sama-sama bisa mencocokkan outlet `ApotekKu 9 Renon`:

```text
outlet_name=ApotekKu 9 Renon
outlet_name=apotekku9renon
outlet_name=Renon
```

Contoh berikut sama-sama bisa mencocokkan InsanKu `I Made Adi`:

```text
insanku_name=I Made Adi
insanku_name=imadeadi
insanku_name=Adi
```

Untuk integrasi sistem outlet, tetap disarankan memakai `uuid_outlet` karena lebih stabil daripada nama.

## Contoh Request

Ambil semua outlet:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku" \
  -H "x-api-key: <API_KEY>"
```

Ambil satu outlet untuk bulan tertentu:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku?uuid_outlet=<UUID_OUTLET>&date=2026-10" \
  -H "x-api-key: <API_KEY>"
```

Filter berdasarkan nama outlet:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku?date=2026-10&outlet_name=apotekku9renon" \
  -H "x-api-key: <API_KEY>"
```

Filter berdasarkan nama InsanKu:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku?date=2026-10&insanku_name=imadeadi" \
  -H "x-api-key: <API_KEY>"
```

## Response Sukses

```json
{
  "success": true,
  "data": [
    {
      "uuid_outlet": "8f4a5b78-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "nama_outlet": "ApotekKu No. 52 Ampenan Mataram",
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

Jika `date` tidak dikirim, field `tanggal` tidak muncul dan `total` dihitung dari seluruh data penjualan yang tersedia.

## Struktur Response

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `success` | Boolean | Status request. |
| `data` | Array | Daftar outlet beserta rekap penjualan GoFitKu. |
| `data[].uuid_outlet` | String | UUID outlet. |
| `data[].nama_outlet` | String | Nama outlet. |
| `data[].tanggal` | String | Bulan acuan sesuai query parameter `date`. Field ini hanya muncul jika `date` dikirim. |
| `data[].insanku` | Array | Daftar InsanKu pada outlet tersebut. |
| `data[].insanku[].uuid_insanku` | String | UUID InsanKu. |
| `data[].insanku[].nama` | String | Nama InsanKu. |
| `data[].insanku[].total` | Number | Total qty penjualan GoFitKu. |

## Aturan Perhitungan

- Data InsanKu diambil dari penempatan aktif di `tbl_outlet_insanku`.
- InsanKu yang belum memiliki penjualan tetap dikembalikan dengan `total: 0`.
- `total` adalah akumulasi `qty` dari semua produk GoFitKu milik InsanKu tersebut.
- Jika `date=YYYY-MM` dikirim, perhitungan hanya mencakup tanggal dari awal bulan sampai sebelum awal bulan berikutnya.
- Jika `date=YYYY-MM` dikirim, penempatan/InsanKu hanya dikembalikan jika tersedia pada minimal satu hari di bulan tersebut.
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

## Endpoint Rekap Produk

Endpoint ini mengembalikan seluruh master produk GoFitKu beserta total penjualan. Produk yang tidak memiliki penjualan pada filter yang dikirim tetap muncul dengan `total: 0`.

```http
GET /api/external/penjualan-gofitku/produk
```

### Query Parameter Rekap Produk

Semua parameter bersifat opsional.

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `date` | Tidak | `YYYY-MM` | Filter bulan dan tahun penjualan. Contoh: `2026-10`. Jika kosong, total dihitung dari seluruh data penjualan yang tersedia. |
| `uuid_outlet` | Tidak | UUID | Filter data untuk satu outlet. |
| `outlet_name` | Tidak | String | Filter data berdasarkan nama outlet. Bisa diisi nama lengkap, sebagian nama, atau versi normalized tanpa spasi/simbol. |

Jika `uuid_outlet` dan `outlet_name` dikirim bersamaan, data harus cocok dengan kedua filter tersebut.

### Contoh Request Rekap Produk

Ambil semua produk untuk seluruh data:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/produk" \
  -H "x-api-key: <API_KEY>"
```

Ambil semua produk pada bulan tertentu:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/produk?date=2026-10" \
  -H "x-api-key: <API_KEY>"
```

Filter outlet berdasarkan UUID:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/produk?date=2026-10&uuid_outlet=<UUID_OUTLET>" \
  -H "x-api-key: <API_KEY>"
```

Filter outlet berdasarkan nama normalized:

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/produk?date=2026-10&outlet_name=apotekku9renon" \
  -H "x-api-key: <API_KEY>"
```

### Response Sukses Rekap Produk

```json
{
  "success": true,
  "data": [
    {
      "product_name": "GoFitKu Basic",
      "total": 18
    },
    {
      "product_name": "GoFitKu Premium",
      "total": 0
    }
  ]
}
```

### Struktur Response Rekap Produk

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `success` | Boolean | Status request. |
| `data` | Array | Daftar seluruh master produk GoFitKu aktif. |
| `data[].product_name` | String | Nama produk GoFitKu. |
| `data[].total` | Number | Total qty penjualan produk. Bernilai `0` jika tidak ada penjualan pada filter yang dikirim. |

### Aturan Perhitungan Rekap Produk

- Produk diambil dari master `tbl_produk_gofitku` yang tidak deleted.
- Semua produk master tetap dikembalikan walaupun total penjualan `0`.
- `total` adalah akumulasi `qty` dari penjualan GoFitKu.
- Jika `date=YYYY-MM` dikirim, perhitungan hanya mencakup tanggal dari awal bulan sampai sebelum awal bulan berikutnya.
- Jika filter outlet dikirim, total hanya menghitung penjualan outlet yang cocok.
- Penjualan pada tanggal ketika penempatan atau InsanKu sedang nonaktif tidak dihitung.
- Penjualan pada tanggal ketika InsanKu sedang masuk periode pengecualian GoFitKu tidak dihitung.
- Data penjualan yang `deleted_at` terisi tidak dihitung.

## Endpoint Detail Tanggal

Endpoint ini mengembalikan total qty penjualan GoFitKu per tanggal. Parameter `date` wajib dikirim dan bisa berupa tanggal harian atau bulan.

```http
GET /api/external/penjualan-gofitku/detail
```

### Query Parameter Detail Tanggal

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `date` | Ya | `YYYY-MM` atau `YYYY-MM-DD` | Bulan atau tanggal acuan. Jika berisi bulan, API mengembalikan seluruh tanggal di bulan tersebut. Jika berisi tanggal harian, API hanya mengembalikan tanggal tersebut. Alias `tanggal` juga diterima. |
| `uuid_outlet` | Tidak | UUID | Filter data untuk satu outlet. |
| `outlet_name` | Tidak | String | Filter data berdasarkan nama outlet. Bisa diisi nama lengkap, sebagian nama, atau versi normalized tanpa spasi/simbol. |

Jika `uuid_outlet` dan `outlet_name` dikirim bersamaan, data harus cocok dengan kedua filter tersebut.

### Contoh Request Detail Tanggal

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/detail?uuid_outlet=<UUID_OUTLET>&date=2026-10-09" \
  -H "x-api-key: <API_KEY>"
```

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/detail?uuid_outlet=<UUID_OUTLET>&date=2026-10" \
  -H "x-api-key: <API_KEY>"
```

### Response Sukses Detail Tanggal

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
      "qty": 12
    }
  ]
}
```

### Struktur Response Detail Tanggal

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `success` | Boolean | Status request. |
| `data` | Array | Daftar rekap tanggal. |
| `data[].date` | String | Tanggal rekap dalam format `YYYY-MM-DD`. |
| `data[].qty` | Number | Total qty penjualan GoFitKu pada tanggal tersebut. |

### Aturan Perhitungan Detail Tanggal

- `date` wajib dikirim.
- Jika `date=YYYY-MM` dikirim, response mengembalikan seluruh tanggal kalender pada bulan tersebut.
- Jika `date=YYYY-MM-DD` dikirim, response hanya mengembalikan tanggal tersebut.
- Tanggal tanpa transaksi tetap dikembalikan dengan `qty: 0`.
- `qty` adalah akumulasi `qty` dari semua produk GoFitKu pada tanggal response.
- Jika filter outlet dikirim, total hanya menghitung penjualan outlet yang cocok.
- Penjualan pada tanggal ketika penempatan atau InsanKu sedang nonaktif tidak dihitung.
- Penjualan pada tanggal ketika InsanKu sedang masuk periode pengecualian GoFitKu tidak dihitung.
- Data penjualan yang `deleted_at` terisi tidak dihitung.
