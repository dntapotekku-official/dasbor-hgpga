# Cloud Storage bersama

`src/lib/cloudStorage.js` adalah lib server untuk file lintas fitur. Lib ini mengelola autentikasi service account dan satu koneksi bucket yang digunakan ulang selama proses server berjalan.

## Konfigurasi

Environment server:

```dotenv
CLOUD_STORAGE_BUCKET=performancereport
CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64=
```

`CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64` berisi JSON service account yang di-encode Base64. Base64 bukan enkripsi; nilainya tetap rahasia.

Nama lama `FIREBASE_STORAGE_BUCKET` dan `FIREBASE_SERVICE_ACCOUNT_BASE64` tetap didukung sebagai fallback. Nama `CLOUD_STORAGE_*` diprioritaskan bila tersedia. Restart proses server setelah mengganti konfigurasi atau key agar koneksi menggunakan kredensial baru.

Jangan memakai awalan `NEXT_PUBLIC_`, mengirim kredensial ke browser, atau commit `.env`. `.dockerignore` mengecualikan environment dan file lokal dari image build. Isi environment produksi secara terpisah saat deploy.

## Pemakaian

```js
import { uploadFile, downloadFile, deleteFile } from "@/lib/cloudStorage";

const reference = await uploadFile({
  folder: "bukti-kunjungan",
  filename: "identitas-file.pdf",
  buffer,
  contentType: "application/pdf",
  publicUrl: true,
});

const bytes = await downloadFile(reference, { folder: "bukti-kunjungan" });

await deleteFile(reference, { folder: "bukti-kunjungan" });
```

Folder dapat bertingkat, misalnya `kunjungan/bukti`. Nama file tidak boleh mengandung direktori. Operasi upload membuat objek baru dan menolak penimpaan objek yang sudah ada. Gunakan nama unik untuk setiap upload.

Secara default, `uploadFile` mengembalikan referensi `gs://<bucket>/<folder>/<filename>`. Opsi `publicUrl: true` mengembalikan URL HTTPS `https://storage.googleapis.com/<bucket>/<folder>/<filename>` yang dapat disimpan langsung ke database.

`getPublicFileUrl(reference, { folder })` mengubah referensi `gs://` menjadi URL HTTPS, atau memvalidasi URL HTTPS yang sudah ada. Download dan delete menerima kedua format. Nama objek di URL di-encode agar spasi dan karakter khusus tetap benar.

Lib tidak mengubah izin IAM bucket. URL HTTPS dapat dibuka tanpa autentikasi hanya bila bucket atau objek telah diberi akses publik. Pada bucket `performancereport` yang sudah dikonfigurasi publik, foto kegiatan ditampilkan langsung oleh browser; URL foto tidak lagi memerlukan sesi aplikasi.

Argumen `folder` pada download dan delete membatasi akses ke folder fitur tersebut, termasuk subfoldernya. Service fitur menentukan folder secara internal, bukan mempercayai folder dari request pengguna. Lib selalu menolak referensi bucket lain, path kosong, dan segmen traversal.

## Validasi dan aturan fitur

- `src/lib/imageUpload.js`: membaca upload JPG/PNG/WebP, memvalidasi signature, dan membatasi ukuran gambar.
- `src/services/jamKerjaInsanKuService.js`: memanggil lib storage secara langsung, memeriksa hak akses penempatan, mengatur kegiatan, menyimpan referensi ke database, dan membaca foto lokal lama.

Untuk gambar dari fitur lain, gunakan `readImageUpload(file, { maxSize })` sebelum memanggil `uploadFile`. Untuk dokumen lain, fitur menentukan validasi tipe dan batas ukurannya sendiri.
