# Audit rilis 29 Oktober 2026

## Keputusan saat audit

Regresi aplikasi dan integritas data existing lulus pada salinan database lokal setelah perbaikan di bawah, termasuk pengujian ulang pada Node.js 22.23.4. Image Docker dan server/database produksi belum diuji langsung; histori migrasi lama juga tidak dapat membangun database kosong tanpa baseline yang benar.

Hasil audit lengkap di bawah mencakup working tree dengan pembaruan NT/BS. Untuk commit rilis terpisah, pembaruan NT/BS tetap lokal sesuai instruksi pengguna; schema yang disertakan hanya menambah status penempatan. Database sumber tidak disinkronkan atau dimigrasikan selama audit ini. Audit tidak menjalankan deploy.

## Bukti pemeriksaan

- 121 tes otomatis lulus, tanpa tes gagal atau dilewati. Meliputi NT/BS, export, impor/transaksi, bulan mulai sinkronisasi, status izin/praktek, penghapusan izin-only, pengecualian permanen, dan regresi penyimpanan profil/riwayat.
- ESLint, Prisma validate, production build, `git diff --check`, dan `bash -n deploy.sh` lulus.
- Node.js 22.23.4: seluruh 121 tes, build production, upgrade migrasi, perbandingan laporan, sinkronisasi berulang, pengujian integrasi tambahan, dan 19 pemeriksaan HTTP production diulang dan lulus. Server pengujian dijalankan menggunakan executable Node.js 22 yang sama. Instalasi sementara tidak mengubah `package.json` atau lockfile.
- `npm audit --omit=dev --audit-level=high`: tidak ada kerentanan yang dilaporkan.
- Paket commit di luar NT/BS juga diuji secara terpisah dari working tree: 114 tes, ESLint, Prisma generate, dan build production pada Node.js 22.23.4 lulus. Build memakai URL database dummy tanpa mengakses sumber.
- Versi pembanding sebelum pembaruan: commit `19efd44`.
- Salinan penuh 33 tabel dibuat untuk pengujian. Jumlah dan SHA-256 isi setiap tabel sumber diperiksa sebelum dan sesudah audit; seluruhnya identik.
- Pemeriksaan akhir setelah uji Node.js 22 kembali memastikan 33 tabel sumber identik. Server preview dihentikan dan database salinan pengujian dihapus.
- Baris sumber yang ikut dilindungi mencakup 3.475 penjualan GoFitKu, 4.674 penerimaan pendapatan, 1.617 data SKU, 6.291 kunjungan, 742 InsanKU, dan 905 penempatan.
- Upgrade menggunakan `prisma migrate deploy` berhasil pada salinan database existing. Penjualan, penerimaan, SKU, kunjungan, target, dan atribut yang sudah ada tetap identik setelah migrasi dan sinkronisasi.
- Dua sinkronisasi berurutan memakai respons API aktual berhasil; putaran kedua tidak menambah duplikat pengguna, penempatan, target, pengecualian, atau riwayat nonaktif. Sebanyak 602 penempatan diproses dalam snapshot audit.
- Alur aktual tambah, edit, dan soft delete penjualan GoFitKu diuji pada fixture di salinan database.
- Penghapusan izin-only diuji melalui service sinkronisasi aktual pada fixture. Penempatan dan jabatan terhapus sekali; akun karyawan, nilai target, dan baris penjualan tetap identik. Entri penjualan pada penempatan terhapus/terkecualikan ditolak.
- Respons API kosong diuji melalui kedua service aktual dan ditolak tanpa mengubah baris pengguna/penempatan. Pengecualian berdasarkan beberapa jabatan aktif juga diverifikasi langsung dengan Prisma pada salinan.
- Simpan profil aktual tidak mengubah periode nonaktif yang sudah selesai dalam bulan berjalan dan tidak mengaktifkan kembali pengguna ketika input aktif tidak dikirim.

## Hasil laporan dan export

Tanggal pembanding: 31 Agustus, 30 September, 7 Oktober, dan 29 Oktober 2026.

- Seluruh nilai `nt_*`, `bs_*`, ringkasan kategori, dan ringkasan keseluruhan pada data existing identik dengan versi pembanding.
- Total kuantitas harian dan bulanan GoFitKu identik pada keempat tanggal yang diuji.
- Daftar nama/kelayakan tampil historis GoFitKu tidak seluruhnya identik: aturan pengecualian permanen memang mengubah kelayakan nama lintas periode. Ini perubahan aturan tampilan/perhitungan, bukan penghapusan baris penjualan. Tidak menjanjikan semua laporan historis bit-for-bit identik untuk setiap konfigurasi pengecualian.
- Export NT/BS aktual dibuka kembali dan diperiksa untuk 90 outlet: BS berada di kiri, NT di kanan, nilai input dan hasil cache rumus cocok dengan laporan, dan urutan tetap memakai NT Gap Growth.
- Export Outlet Ditandai juga tercakup dalam tes regresi workbook dengan fixture.
- Export GoFitKu aktual berhasil dibentuk dan diparse sebagai SpreadsheetML yang valid. Ini tidak menggantikan verifikasi native Excel jika terdapat kebutuhan engine-specific.

## Browser dan HTTP production

Preview berjalan pada database salinan dengan akun uji, bukan akun operasional.

- 19 pemeriksaan HTTP lulus: login, penolakan akses tanpa sesi, endpoint pengguna/penempatan/pengecualian, NT/BS, GoFitKu, export, dan render halaman production.
- Browser memverifikasi Basket Size sebagai tab pertama/default dan urutan 64 outlet kategori yang sama di kedua tab berdasarkan NT Gap Growth menurun.
- Tombol Pengecualian Jabatan berada sebelum Atur Banyak dan memiliki warna yang sama dengan Sinkron.
- Modal jabatan memuat data dan pencarian; Atur Banyak menunjukkan 7 hari, semua 20 nama fixture snapshot terpilih, dan tidak memiliki input rentang tanggal.
- Badge izin/praktek/aktif serta input aktif sudah tidak tampil pada tabel/form pengguna dan penempatan.
- Pemilih penempatan menggunakan `month` dan default bulan Makassar yang benar.
- Halaman GoFitKu dirender dalam browser production.
- Komposisi tombol Batal pada modal bulan diperbaiki agar tidak menghasilkan tombol bersarang. Verifikasi browser pada build terakhir lulus: tidak ada tombol bersarang, hanya satu tombol Batal, dan aksi batal/tutup bekerja.

## Perbaikan selama audit

1. Simpan ulang profil dengan penempatan yang sama tidak lagi menutup/menghapus riwayat nonaktif sejak awal bulan.
2. Kolom aktif yang tidak dikirim mempertahankan nilai tersimpan; status tersembunyi tidak berubah menjadi aktif secara tidak sengaja.
3. Pengulangan status nonaktif mempertahankan UUID dan tanggal awal periode yang sama, tanpa menambah tombstone/riwayat duplikat.
4. Pengecualian lama yang sudah berakhir diarsipkan sebelum aturan permanen digunakan. Snapshot memiliki 12 catatan seperti ini. Migrasi mempertahankan baris, tanggal, dan field lain; hanya `deleted_at` diisi agar catatan berakhir tidak hidup kembali.
5. Penempatan tanpa jabatan menyiapkan jabatan berikutnya sebagai aktif; jabatan lama yang memang tidak aktif tetap dipertahankan.
6. Respons API karyawan/penempatan yang kosong atau tidak menghasilkan data valid membatalkan sinkronisasi sebelum menonaktifkan/menghapus data existing.
7. Tombol Batal pada modal penempatan memakai komposisi Base UI yang benar.
8. `deploy.sh` selalu menjalankan migrasi tertunda, sehingga percobaan ulang deploy setelah pull berhasil tetapi migrasi gagal tidak melewati migrasi.
9. Pemilihan jabatan mengabaikan riwayat `active=0`. API aktual memiliki 175 pasangan dengan riwayat nonaktif setelah jabatan aktif, dan 169 pasangan dengan beberapa jabatan aktif. Pengecualian otomatis sekarang memeriksa seluruh jabatan aktif pada penempatan yang disinkronkan; satu jabatan yang tersimpan untuk tampilan tidak boleh menyembunyikan jabatan aktif lain yang dipilih untuk pengecualian.

## Migrasi dan batasan sebelum rilis

- Wajib menyertakan `20261029003000_archive_expired_gofitku_exclusions` beserta pembaruan schema/status dan migrasi NT/BS yang dipilih untuk rilis. Migrasi arsip diuji di salinan saja; belum diterapkan pada sumber.
- Database sumber masih mempunyai dua migrasi atribut 27 Oktober yang tertunda dan satu catatan migrasi jabatan lama yang tidak ada filenya di repo. Upgrade seluruh migrasi tertunda berhasil pada salinan tersebut, tetapi status histori tidak boleh dilaporkan bersih.
- Replay dari database kosong gagal pada migrasi lama `20261001000000_add_kunjungan_metric`: `tbl_kunjungan` tidak dibuat oleh histori awal. Jangan reset/recreate database existing untuk rilis ini. Pemasangan baru memerlukan baseline/history bootstrap terpisah; migrasi historis yang sudah dipakai tidak diubah diam-diam.
- Docker daemon lokal tidak aktif, sehingga image Docker belum dijalankan. Pengujian selesai pada Node.js 24.18.0 dan diulang pada Node.js 22.23.4 dengan MariaDB lokal 10.4.28; versi MySQL/server produksi yang berbeda belum diuji langsung.
- Runtime Node.js 22 sementara dijalankan setelah pengguna menyetujui permintaan izin spesifik yang sebelumnya ditolak peninjauan otomatis. Seluruh pengujian database tetap menggunakan salinan terisolasi.
- Backup database produksi yang dapat dipulihkan tetap diperlukan sebelum menerapkan migrasi. Pengujian salinan tidak membuktikan kondisi database/server produksi yang belum diakses.

## Urutan rilis yang sesuai hasil audit

1. Tinjau dan masukkan perubahan yang dipilih ke commit rilis; perubahan NT/BS yang sebelumnya diminta tetap lokal tidak otomatis dipush oleh audit ini.
2. Buat backup database produksi dan verifikasi dapat dibaca/dipulihkan di lingkungan terpisah.
3. Periksa status migrasi pada lingkungan tujuan dan terapkan migrasi tertunda, termasuk pelindung pengecualian lama, sebelum menjalankan build baru.
4. Bangun/jalankan pada runtime produksi, lalu periksa login, laporan tanggal pembanding, export NT/BS, dan export GoFitKu sebelum trafik normal.
5. Simpan backup pra-rilis untuk rollback database. Rollback kode saja tidak membatalkan perubahan migrasi atau aturan data.
