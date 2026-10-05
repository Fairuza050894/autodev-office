# Runbook operasi

## Startup, seed, log

`docker compose up --build` membangun image, menjalankan DB/Redis, MinIO private bucket, Gitea bootstrap, migrasi dan seed idempoten sebelum API/worker. `docker compose up --build --wait` menunggu health service; init sekali-jalan harus exit 0. `scripts/seed` mengisi ulang data demo tanpa menghapus proyek operator.

Gunakan `docker compose ps` dan `docker compose logs --tail=100 init gitea-init runner worker api dashboard`. Jangan mempublikasikan log yang berisi data klien. Gagal build/network bukan bukti fitur selesai. Pastikan DNS/proxy Docker dan akses npm/apt/registry berfungsi.

- **Login gagal:** gunakan ADMIN_EMAIL/ADMIN_PASSWORD yang berlaku saat user pertama dibuat. Seed tidak dimaksudkan menimpa password user yang sudah diubah.
- **Dashboard API gagal:** API_URL untuk build dashboard harus `http://api:4000`; bukan localhost dari container. Rebuild saat rewrite berubah.
- **Runner 401:** RUNNER_TOKEN API/worker/runner harus identik dan minimal 32 karakter.
- **Sandbox gagal:** image `autodev-sandbox:local` dibangun; Docker daemon mendukung volume-subpath; workspaces bernama `autodev-workspaces`. Chromium membutuhkan memory yang cukup. Jangan menghapus sandbox restriction agar test tampak sukses.
- **Gitea init gagal:** lihat CLI log, konfigurasi `/data/gitea/conf/app.ini`, user, volume integration token. Token tidak boleh masuk repo project. Gitea credential bootstrap bukan secret produksi.
- **Email tidak masuk Mailpit:** SMTP_HOST=mailpit, SMTP_PORT=1025, SMTP_SECURE=false; Mailpit hanya menangkap lokal. Provider nyata harus dikonfigurasi terpisah.
- **Project menunggu:** cek gate/mode otonomi, budget, worker heartbeat, DLQ, task error. Approve hanya setelah melihat artifact. Retry bukan penghapusan audit.

## Recovery

`docker compose stop worker`, lalu `docker compose start worker` melanjutkan state durable. Gunakan halaman task/DLQ untuk kegagalan permanen; jangan mengubah status langsung menjadi DONE/DELIVERED. Email SMTP bisa memiliki keadaan ambigu setelah crash pada saat server menerima pesan: rekonsiliasi dengan provider/Mailpit sebelum mengirim ulang; SMTP tidak menyediakan exactly-once delivery universal.

Mengubah Settings tidak otomatis mengganti environment worker. Perbarui `.env` yang sesuai dan jalankan `docker compose up -d --force-recreate worker api`; provider/settings yang hanya berlaku saat startup memerlukan restart.

## Backup

Pause worker, buat dump PostgreSQL konsisten menggunakan `docker compose exec -T postgres pg_dump -U autodev autodev` ke media backup terenkripsi. Backup volume workspaces, runner-state, gitea-data, integration, minio-data, redis-data bersama versi image/config. Jangan hanya membackup Redis. Restore diuji pada lingkungan terisolasi; validasi checkpoint, file artifact, token portal, repository, dan bukti email sebelum resume. Enkripsi, retensi, lokasi backup, dan uji restore dijadwalkan operator.

## Deployment dan rollback

Broker `/deploy` menyalin snapshot immutable source, menjalankan node server.mjs pada 8080 dengan jaringan none, mengukur `/health`, lalu mengganti pointer live. Versi sebelumnya tetap ada (berhenti) untuk rollback. API meneruskan request live lewat broker; source project tidak memperoleh jaringan platform/secret.

Rollback melalui dashboard/API menjalankan kembali container sebelumnya dan mengecek health sebelum penggantian pointer. Ini rollback aplikasi stateless, bukan reverse migration DB atau rollback pembayaran eksternal. Snapshot/container menghabiskan disk; operator menentukan retensi setelah delivery/garansi.

Container hasil project bukan service Compose. Inventarisasi dengan `docker ps -a --filter label=autodev.project`. Hapus hanya container project yang retensinya berakhir setelah backup; jangan memakai prune global pada host bersama. `docker compose down` tidak menghentikan container tersebut. Volume tidak dihapus otomatis. Penghapusan data klien harus meliputi DB, workspace, snapshot, repository, object storage, email, backup sesuai kebijakan retensi.

## Demonstrasi

Jalankan alur klinik atau Kopi Senja dari README, tampilkan screen Office View → timeline/DAG → QA/recovery → deployment → Mailpit → portal. Rekam layar lokal jika diperlukan; jangan mengklaim video, hasil Lighthouse, coverage, atau durasi yang belum diukur.
