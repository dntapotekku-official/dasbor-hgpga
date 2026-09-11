# Dasbor HGPGA

Aplikasi pelaporan performa berbasis Next.js, Prisma, MariaDB, dan Socket.IO.

## Menjalankan secara lokal

Prasyarat: Node.js 22, MariaDB/MySQL, dan Python 3 untuk parser impor Excel.

```bash
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Isi seluruh konfigurasi yang diperlukan di `.env`. Gunakan `JWT_SECRET` acak dengan panjang minimal 32 karakter dan jangan commit file `.env`.

## Verifikasi sebelum rilis

```bash
npm run lint
npx prisma validate
npx prisma migrate status
npm run build
npm audit --omit=dev --audit-level=high
```

Untuk membuat atau mereset superadmin, isi `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan opsional `ADMIN_NAME`, lalu jalankan `npm run create-admin`. Password minimal 12 karakter dan tidak akan dicetak ke terminal.

## Target GoFitKu per InsanKU

Menu **Pengaturan → Target → GoFitKu** menyediakan dua cara pengisian banyak data:

- **Impor** menerima berkas `.xlsx` maksimal 10 MB dengan identitas InsanKU, nilai target, tanggal mulai, dan tanggal selesai.
- **Tambah Massal** meminta satu range tanggal dan satu nilai target, lalu menerapkannya ke seluruh InsanKU aktif tanpa berkas Excel.

Target disimpan per InsanKU; target lama berbasis outlet diarsipkan saat migrasi dan perlu diinput ulang.

## Deployment

Server produksi memerlukan `.env` yang lengkap, Docker, dan Docker Compose. Skrip `deploy.sh` menarik branch `main`, menjalankan migrasi bila ada perubahan, membangun image, dan me-restart container.

Sebelum deploy:

1. Backup database.
2. Rotasi kredensial yang pernah tersimpan di source control.
3. Pastikan HTTPS dan reverse proxy sudah aktif.
4. Jalankan checklist verifikasi di atas.
5. Siapkan file target GoFitKu per InsanKU untuk diimpor setelah migrasi.

Rollback aplikasi dilakukan dengan deploy commit sebelumnya. Rollback database harus menggunakan backup karena migrasi produksi bersifat maju (`migrate deploy`).
