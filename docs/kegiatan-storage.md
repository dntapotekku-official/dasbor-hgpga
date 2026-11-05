# Penyimpanan foto kegiatan

Foto baru menggunakan Firebase / Google Cloud Storage bila `CLOUD_STORAGE_BUCKET` (atau nama lama `FIREBASE_STORAGE_BUCKET`) dikonfigurasi.

Konfigurasi runtime server:

- `CLOUD_STORAGE_BUCKET`: nama bucket, misalnya `performancereport`.
- `CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64`: JSON service account yang di-encode Base64. Ini tetap rahasia; Base64 bukan enkripsi.

Nama environment lama `FIREBASE_STORAGE_BUCKET` dan `FIREBASE_SERVICE_ACCOUNT_BASE64` tetap didukung. Lib umum dan contoh penggunaan lintas fitur dijelaskan pada [cloud-storage.md](cloud-storage.md).

Simpan kredensial hanya di environment server atau secret manager. Jangan gunakan awalan `NEXT_PUBLIC_`, jangan commit `.env`, dan jangan menaruh private key di browser. `.dockerignore` mengecualikan `.env`, `.data`, serta `.secrets` dari build context.

Foto baru disimpan di `jam-kerja-kegiatan/<uuid>.<ekstensi>`. Database menyimpan URL HTTPS `https://storage.googleapis.com/<bucket>/jam-kerja-kegiatan/<uuid>.<ekstensi>`. Browser menampilkan foto dari GCS secara langsung, termasuk di modal preview. Bucket harus sudah dikonfigurasi untuk akses publik; kode upload tidak mengubah izin IAM.

Foto lama dengan referensi `gs://` tetap didukung: response kegiatan mengubahnya menjadi URL HTTPS tanpa menulis ulang database. Endpoint foto lama tetap tersedia untuk kompatibilitas, termasuk foto yang masih berada di disk lokal. Pemeriksaan hak akses aplikasi tetap berlaku untuk operasi tambah, edit, dan hapus; foto publik dapat dibaca siapa pun yang mengetahui URL-nya.

Foto lokal lama tetap dibaca dari `.data/jam-kerja-kegiatan/`. Konfigurasi Firebase yang tidak valid atau kegagalan upload tidak menyebabkan penyimpanan diam-diam ke lokal. Untuk penggunaan lokal tanpa Firebase, kosongkan kedua pengaturan Firebase.

Saat deploy, isi kedua variabel pada environment produksi secara terpisah; kredensial lokal tidak ikut Git atau image Docker. Jika masih memiliki foto lokal lama, folder `.data` perlu dipertahankan pada server asal atau dipindahkan melalui proses migrasi terpisah.

Jika key pernah dibagikan, buat key pengganti, perbarui environment server, lalu cabut key lama melalui IAM Google Cloud. Jangan mencatat private key atau token ke log.
