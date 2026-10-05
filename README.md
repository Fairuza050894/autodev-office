# AutoDev Office

Kantor pengembang virtual: satu permintaan chat menjadi requirement, rencana tugas, desain, source, hasil QA/security, aplikasi staging, dan handover melalui email. Dashboard berbahasa Indonesia; workflow, audit, dan antrean disimpan secara durable. **Mode mock hanya memalsukan respons LLM, bukan hasil eksekusi, health check, maupun SMTP.**

## Mulai dengan satu perintah

Prasyarat: Docker Engine/Docker Desktop aktif, Docker Compose v2 modern (dukungan `volume-subpath`), internet saat build pertama, sekitar 8 GB RAM dan ruang disk untuk Chromium/image.

```sh
docker compose up --build
```

Migrasi dan seed dijalankan otomatis oleh service `init`. Tidak perlu `.env` untuk demo. Konfigurasi opsional: salin `.env.example` menjadi `.env`, ubah nilainya, lalu jalankan ulang Compose. Jangan commit `.env`.

| Layanan | Alamat / akses lokal |
|---|---|
| Dashboard + portal klien | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Mailpit, email demo | http://localhost:8025 |
| Gitea | http://localhost:3001 |
| MinIO console | http://localhost:9001 |
| MinIO S3 | http://localhost:9000 |
| Aplikasi hasil agen, origin terpisah | http://127.0.0.1:4400/live/PROJECT_ID/ |

Login dashboard: **admin@autodev.local / AutoDevLocal2026!**. Login Gitea: **autodev / AutoDevGitLocal2026!**. MinIO: **autodev / autodev-local-storage**. Semuanya kredensial **demo**, wajib diganti sebelum jaringan nonlokal. DB/Redis/runner tidak menerbitkan port host. API/dashboard/console hanya bind loopback.

```sh
scripts/seed                 # Seed idempoten; gunakan setelah stack aktif
docker compose logs -f worker runner api
docker compose stop worker  # Demonstrasi jeda worker
docker compose start worker # Lanjut dari durable state
docker compose down         # Tidak menghapus volume
```

Jangan gunakan `down -v` kecuali bermaksud menghapus seluruh DB, artifact, repository, dan email terkait volume. Container aplikasi hasil agen dibuat broker di luar lifecycle Compose; lihat [runbook](docs/OPERATIONS.md) untuk pengelolaannya.

## Demo

1. Buka dashboard, login sebagai admin.
2. Kirim: `Buatkan website company profile untuk klinik gigi. Fitur profil dokter, daftar layanan, dan formulir kontak. Email saya demo@example.test.`
3. Pantau stage, DAG, Kanban, chat agen, artifact, QA, security, biaya, dan deployment secara live.
4. Buka URL aplikasi hanya setelah health check berhasil. Buka Mailpit untuk bukti email dan portal klien.
5. Ulangi dengan `GATED_PROPOSAL` atau `GATED_RELEASE`, lalu resolve gate di Approvals.
6. Permintaan `buat ransomware` harus ditolak; tidak ada deployment sukses palsu.

Mock menghasilkan proyek template deterministik. QRIS/pembayaran nyata memerlukan provider, kredensial merchant, dan validasi callback; jangan menganggap halaman demo sebagai pemrosesan pembayaran. Status SMTP `sent` berarti diterima server SMTP, **bukan bukti masuk inbox publik**; Mailpit tidak mengirim ke internet.

## Dashboard dan portal

Mulai intake pada `/new-project` atau widget chat. Halaman proyek menyediakan tab Timeline, DAG, Kanban, Gantt, Percakapan, Requirements, Artefak, Environments, Biaya, Email, dan Logs. `Cmd/Ctrl+K` membuka pencarian; pilihan tema gelap/terang disimpan pada browser. Controls mengikuti role; Kanban hanya mengubah status penjadwalan, bukan memalsukan status QA atau DONE.

Settings menyediakan editor JSON tervalidasi untuk model, brand, SMTP, budget, retry, dan template email. Perubahan konfigurasi runtime memerlukan `docker compose restart worker`; secret disimpan terenkripsi, tidak dikembalikan sebagai plaintext. Portal `/portal/[token]` memakai tautan kedaluwarsa dari email, unduhan artifact terikat proyek, aktivasi akses admin sekali-pakai, request change, dan survei.


## Arsitektur

```text
Browser → Next.js dashboard → API Fastify → PostgreSQL (state/audit/session)
                                      → Redis/BullMQ → worker → runtime LLM
                                                       → runner broker → sandbox Docker
                                                       → Gitea / SMTP / artifact
API /live/:projectId/ → redirect origin 127.0.0.1:4400 → runner → Docker exec HTTP proxy → server:8080
```

- `apps/api`: HTTP, RBAC, migrasi, seed, worker, persistence.
- `apps/dashboard`, `apps/client-portal`, `packages/ui`: UI operator/klien.
- `packages/shared`: schema/types; `packages/orchestrator`: state machine, DAG, gate, budget, recovery.
- `packages/agent-runtime`, `packages/agents`: gateway, context, definisi/prompt agen, pipeline bisnis.
- `packages/tools`: broker, git/email/deploy, izin tools.
- `templates`, `email-templates`: baseline source/email.
- `infra`, `scripts`: Dockerfile, broker tepercaya, bootstrap.

PostgreSQL adalah sumber kebenaran durable; Redis antrean, bukan pengganti checkpoint. Engine melakukan polling/recovery dan perubahan state dengan store kontrak. [ADR](docs/ARCHITECTURE.md) menjelaskan pilihan dan batas implementasi.

## Konfigurasi

Seluruh nilai dan default tersedia di `.env.example`. Compose memasang URL internal untuk DB, Redis, runner, Gitea, MinIO; jangan menggantinya dengan localhost dari dalam container. `PUBLIC_URL` adalah alamat API yang bisa dibuka penerima email; `DASHBOARD_URL` alamat portal/dashboard. Mengubah URL untuk host lain memerlukan reverse proxy HTTPS serta memperbarui CORS/cookie sesuai konfigurasi API. Rebuild dashboard bila `API_URL` berubah karena Next rewrite dibuat saat build.

`LLM_MODE=mock` untuk demo tanpa key. Untuk provider nyata, gunakan `LLM_MODE=live` serta provider/model/base URL dan key yang didukung gateway; detail [konfigurasi integrasi](docs/INTEGRATIONS.md). Jangan menaruh key dalam brief, source project, atau prompt. Deploy default adalah staging Docker lokal, bukan layanan publik produksi.

## Pengembangan dan ekstensi

Node 22, pnpm 10.30.3. Instal dependensi dengan `pnpm install`. Script API: `pnpm --filter @autodev/api dev`, `worker`, `migrate`, `seed`. Stack container disarankan; DB/Redis tidak dipublikasikan ke host, sehingga mode host memerlukan Compose override lokal untuk port tersebut.

Agen baru: ikuti definisi agen/prompt dan schema yang sudah ada di `packages/agents`; tambahkan stage/task assignment di runtime, izin tool sesuai role, DoD dan validator, lalu test schema/handoff serta retry. Jangan membuat stage sukses hanya berdasarkan teks LLM. Tool baru: registrasikan schema input/output di registry `packages/tools`, allowlist agen, validasi trust boundary, jalankan kode tidak tepercaya melalui runner; jangan menambahkan shell host atau Docker socket ke API/worker. Lihat [kontrak broker](docs/SANDBOX.md).

Perintah verifikasi yang harus dijalankan setelah integrasi: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `docker compose up --build --wait`, dan skenario E2E yang disediakan repository. Dokumen ini tidak menyatakan hasil pemeriksaan yang belum dilakukan.

## Troubleshooting dan produksi

[Runbook operasi](docs/OPERATIONS.md): bootstrap, log, seed, recovery, backup, rollback. [Keamanan](docs/SECURITY.md): batas sandbox, secret, kredensial, produksi. [Integrasi](docs/INTEGRATIONS.md): LLM, email SPF/DKIM/DMARC, Gitea, storage/deploy. [Changelog](CHANGELOG.md).

Stack ini adalah lingkungan lokal/staging, **bukan deployment produksi multi-tenant yang telah diaudit**. TLS, isolasi daemon/VM, backup teruji, observability eksternal, DNS email terverifikasi, egress allowlist, kredensial provider dan migrasi deployment publik merupakan tanggung jawab operator sebelum produksi. Tidak ada janji SLA atau sertifikasi keamanan.
