# Ringkasan API Eksternal Performance Report

Dokumen ini merangkum API eksternal yang tersedia untuk Nilai Transaksi, Basket Size, dan Penjualan GoFitKu.

## Autentikasi

Semua API eksternal wajib menggunakan API key melalui salah satu header berikut:

```http
x-api-key: <API_KEY>
```

atau:

```http
Authorization: Bearer <API_KEY>
```

## Nilai Transaksi & Basket Size

> **Baru diperbarui**

### Endpoint

```http
GET /api/external/nilai-transaksi-basket-size
```

### Query Parameter

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `date` | Ya | `YYYY-MM-DD` | Tanggal acuan data harian, bulan berjalan, dan pembanding bulan sebelumnya. |
| `uuid_outlet` | Tidak | UUID | Filter outlet berdasarkan UUID. |
| `outlet_name` | Tidak | String | Filter outlet berdasarkan nama. Mendukung normalized search. |

### Contoh Request

```bash
curl -X GET "https://domain-anda.com/api/external/nilai-transaksi-basket-size?date=2026-10-09" \
  -H "x-api-key: <API_KEY>"
```

```bash
curl -X GET "https://domain-anda.com/api/external/nilai-transaksi-basket-size?date=2026-10-09&uuid_outlet=<UUID_OUTLET>" \
  -H "x-api-key: <API_KEY>"
```

### Ringkasan Response

```json
{
  "success": true,
  "tanggal": "2026-10-09",
  "summary_nt": {},
  "summary_bs": {},
  "rows": []
}
```

## Penjualan GoFitKu

> **Baru diperbarui**

### Endpoint

```http
GET /api/external/penjualan-gofitku
```

### Query Parameter

Semua parameter bersifat opsional.

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `date` | Tidak | `YYYY-MM` | Filter bulan dan tahun penjualan. |
| `uuid_outlet` | Tidak | UUID | Filter outlet berdasarkan UUID. |
| `outlet_name` | Tidak | String | Filter outlet berdasarkan nama. Mendukung normalized search. |
| `insanku_name` | Tidak | String | Filter InsanKu berdasarkan nama. Mendukung normalized search. |

### Contoh Request

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku?date=2026-10" \
  -H "x-api-key: <API_KEY>"
```

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku?date=2026-10&outlet_name=apotekku9renon&insanku_name=imadeadi" \
  -H "x-api-key: <API_KEY>"
```

### Ringkasan Response

```json
{
  "success": true,
  "data": [
    {
      "uuid_outlet": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "nama_outlet": "ApotekKu 9 Renon",
      "tanggal": "2026-10",
      "insanku": [
        {
          "uuid_insanku": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          "nama": "Nama InsanKu",
          "total": 10
        }
      ]
    }
  ]
}
```

## Rekap Produk GoFitKu

> **Baru diperbarui**

### Endpoint

```http
GET /api/external/penjualan-gofitku/produk
```

### Query Parameter

Semua parameter bersifat opsional.

| Parameter | Wajib | Format | Keterangan |
| --- | --- | --- | --- |
| `date` | Tidak | `YYYY-MM` | Filter bulan dan tahun penjualan. Jika kosong, total dihitung dari seluruh data. |
| `uuid_outlet` | Tidak | UUID | Filter outlet berdasarkan UUID. |
| `outlet_name` | Tidak | String | Filter outlet berdasarkan nama. Mendukung normalized search. |

### Contoh Request

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/produk?date=2026-10" \
  -H "x-api-key: <API_KEY>"
```

```bash
curl -X GET "https://domain-anda.com/api/external/penjualan-gofitku/produk?date=2026-10&outlet_name=apotekku9renon" \
  -H "x-api-key: <API_KEY>"
```

### Ringkasan Response

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

### Catatan Rekap Produk

- Semua master produk GoFitKu aktif tetap muncul.
- Produk tanpa transaksi tetap muncul dengan `total: 0`.
- `total` adalah akumulasi `qty`.

## Normalized Search

Parameter `outlet_name` dan `insanku_name` dinormalisasi sebelum dicocokkan:

- huruf besar/kecil diabaikan
- spasi diabaikan
- simbol/tanda baca diabaikan
- angka tetap dihitung

Contoh outlet `ApotekKu 9 Renon`:

```text
outlet_name=ApotekKu 9 Renon
outlet_name=apotekku9renon
outlet_name=Renon
```

Contoh InsanKu `I Made Adi`:

```text
insanku_name=I Made Adi
insanku_name=imadeadi
insanku_name=Adi
```

Untuk integrasi sistem, gunakan `uuid_outlet` jika memungkinkan karena lebih stabil daripada nama.

## Ringkasan Parameter Wajib

| Endpoint | Parameter Query Wajib |
| --- | --- |
| `/api/external/nilai-transaksi-basket-size` | `date` |
| `/api/external/penjualan-gofitku` | Tidak ada |
| `/api/external/penjualan-gofitku/produk` | Tidak ada |

## Ringkasan Format Date

| Endpoint | Parameter | Format |
| --- | --- | --- |
| `/api/external/nilai-transaksi-basket-size` | `date` | `YYYY-MM-DD` |
| `/api/external/penjualan-gofitku` | `date` | `YYYY-MM` |
| `/api/external/penjualan-gofitku/produk` | `date` | `YYYY-MM` |
