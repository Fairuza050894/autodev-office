# Integrasi dan konfigurasi

## LLM

Default `LLM_MODE=mock` memakai fixture terlabel. `LLM_MODE=live` mengaktifkan panggilan nyata. `LLM_PROVIDER`, `LLM_MODEL` memengaruhi definisi agen; ikuti nama model provider. OpenAI/OpenAI-compatible: OPENAI_API_KEY dan OPENAI_BASE_URL (default https://api.openai.com/v1). Anthropic: ANTHROPIC_API_KEY. Gemini: GEMINI_API_KEY. Biaya berdasarkan tarif input/output konfigurasi gateway, bukan invoice provider; sesuaikan harga model dan budget. Simpan key hanya di secret environment/operator, jangan di brief atau source klien.

## Email

Default SMTP ke Mailpit: SMTP_HOST=mailpit, SMTP_PORT=1025, SMTP_SECURE=false. Mailpit menangkap email lokal, tidak mengirim publik. SMTP produksi: isi host/port/TLS/user/password dan EMAIL_FROM terverifikasi. EMAIL_PROVIDER=resend memakai RESEND_API_KEY; mode provider nyata dapat gagal karena domain belum diverifikasi.

DNS domain pengirim sebelum produksi:

1. **SPF:** tambahkan TXT sesuai provider, hanya satu record SPF domain; gabungkan include yang diperlukan. Jangan menggunakan contoh include provider lain.
2. **DKIM:** pasang selector/record yang diterbitkan provider, cek signature dari email nyata.
3. **DMARC:** TXT `_dmarc.domain` dengan alignment SPF/DKIM. Mulai `p=none` dan alamat agregasi milik operator, setelah observasi naikkan quarantine/reject.
4. SMTP TLS, domain MAIL FROM/Return-Path, bounce, suppression list, unsubscribe status non-esensial harus ditangani provider/operator.

`sent` berarti provider menerima pesan. `delivered` hanya dari bukti event provider, bukan UI mengasumsikan inbox. SMTP Message-ID bukan deduplikasi universal. Event webhook harus diverifikasi dengan credential/signature provider; tidak boleh mengubah DELIVERED atas payload tidak autentik. Endpoint `POST /api/v1/webhooks/email` memakai `EMAIL_WEBHOOK_SECRET` via header `x-webhook-secret` (constant-time compare); tanpa secret → 503 disabled. Handover/download portal memakai token terbatas waktu; jangan mempublikasikan bucket. Jangan menaruh password klien dalam email; gunakan reset/password bootstrap melalui saluran aman.

## Git

Gitea otomatis membuat user autodev dan token pada volume integration melalui CLI bootstrap; registrasi publik dimatikan. GITEA_TOKEN_FILE=/integration/gitea-token hanya pada container tepercaya. Broker `/git/publish` memakai API contents untuk menulis file dan commit asli tanpa menjalankan konfigurasi Git project di host. Branch dan merge pengembang berlangsung di sandbox, publish menyalin hasil final. Token tidak disimpan di remote project. Untuk eksternal ganti URL/user/token secara konsisten, gunakan account least-privilege; token bootstrap default `all` khusus demo lokal.

## Artifact dan storage

MinIO menyediakan bucket private autodev-artifacts. S3_ENDPOINT/access key/secret/region tersedia untuk integrasi; artifact pipeline lokal disimpan pada volume workspaces dan diakses API readonly dengan pemeriksaan path/token. Kehadiran MinIO bukan klaim semua file otomatis direplikasi ke S3. Backup workspace tetap wajib. Signed portal/download tidak membolehkan path arbitrer dan bukan akses bucket anonymous.

## Deployment

Default docker-local menjalankan snapshot Node server.mjs pada 8080. PUBLIC_LIVE_URL default **http://127.0.0.1:4400** berbeda hostname dari dashboard **localhost**. Jangan menyatukan origin aplikasi hasil agen dengan API/portal. API /live melakukan redirect ke gateway terpisah. Browser UAT broker `/uat` berjalan pada namespace jaringan deployment sebenarnya; tidak menghidupkan server duplikat untuk mengklaim keberhasilan live.

Untuk public/VPS, operator perlu DNS hostname aplikasi yang terpisah, reverse proxy HTTPS, firewall, kredensial target, policy egress, health dan rollback teruji. Deployment provider tambahan mengikuti adapter tools yang tersedia; jangan menganggap credential kosong atau URL yang belum lolos health sebagai produksi. Pembayaran QRIS/layanan eksternal tetap memerlukan credential klien; demo tidak menyelesaikan settlement nyata.

### Coolify

Set DEPLOY_TARGET=coolify, COOLIFY_URL, COOLIFY_TOKEN, COOLIFY_APP_UUID, COOLIFY_PUBLIC_URL pada runner. Operator wajib membuat aplikasi Coolify yang memakai repo generated yang benar, Dockerfile/build command dan health `/health` yang mencantumkan versi release; broker menolak health versi yang belum sesuai. Coolify harus bisa membaca Gitea privat dengan credential least-privilege. Jangan menggunakan UUID app bersama lintas project.

External browser UAT memerlukan UAT_EGRESS_NETWORK: Docker network internal khusus yang hanya terhubung ke proxy allowlist; UAT_PROXY_URL alamat proxy. Proxy hanya boleh meneruskan host COOLIFY_PUBLIC_URL, blok metadata/IP privat/platform dan redirect host lain. Fixed trusted browser script juga memblok request origin lain. Tanpa kedua konfigurasi, UAT gagal dengan jujur. Broker tidak membuka jaringan default untuk generated script. Rollback provider eksternal dilakukan mengikuti runbook Coolify, bukan local Docker rollback.

Setup admin lokal berasal dari link sekali-pakai 15 menit di portal bertoken; broker random APP_ADMIN_TOKEN/APP_SETUP_TOKEN dan tidak mengirim token admin polos melalui email. Container restart dapat menghapus marker consumed `/tmp`, tetapi masa berlaku setup tetap terbatas; production membutuhkan credential bootstrap durable/key rotation dan reset flow provider yang teruji.
