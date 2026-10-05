# ADR: arsitektur lokal durable

## Keputusan

Node 22/TypeScript ESM, pnpm monorepo; Fastify API, Next dashboard, PostgreSQL authoritative state/audit, Redis/BullMQ dispatch. Engine state machine dan DAG deterministik dengan checkpoint store, gate otonomi, retry serta budget. Durable DB dipilih agar restart worker bukan reset proyek; Redis dipakai untuk antrean, bukan ledger artifact/email.

Store SQL menggunakan tabel entity dengan id/project_id, data JSONB terindeks dan timestamp, mengikuti kontrak engine; bukan ORM column-per-field dari seluruh contoh spec. Claim task/budget memakai operasi JSONB atomik. Audit trigger menjaga append-only dan approval tercatat. pgvector tersedia dari image, tetapi embedding/vector semantic retrieval belum diterapkan; context mengambil artifact relevan deterministik, bukan pencarian semantik.

Agen/provider deklaratif dan schema Zod memisahkan respons LLM dari side effect yang harus terukur. Mock hanyalah fixture LLM. Source template dijalankan nyata dalam sandbox untuk build/test/browser/security/deploy. Audit dan laporan tidak boleh berasal dari klaim sukses model saja.

Runner HTTP tepercaya memegang daemon; API/worker tidak. Generated aplikasi tidak memasuki jaringan platform, proxy menggunakan Docker exec HTTP dalam container. Public gateway hostname 127.0.0.1 memisahkan cookie localhost platform. Snapshot immutable mendukung rollback lokal; deployment versi sama idempoten jika healthy. Browser UAT memakai deployment sebenarnya, bukan proses server salinan. Basic security scan dijalankan broker fixed, bukan script hasil model.

Git memakai Gitea lokal. Branch/merge terjadi sandbox, publish commit memakai Gitea contents API tanpa mengeksekusi konfigurasi Git client di host. Artifact default workspace private readonly API; MinIO disediakan private bucket, bukan replika otomatis. SMTP default Mailpit; Resend/SMTP nyata memerlukan credential/domain terverifikasi.

## MinIO source build

Distribusi image release tidak selalu tersedia. Image dibangun dari source MinIO commit `0d7408fc9969caf07de6a8c3a84f9fbb10a6739e`, tag `RELEASE.2025-04-22T22-12-26Z`. Referensi resmi: [tag GitHub](https://github.com/minio/minio/releases/tag/RELEASE.2025-04-22T22-12-26Z), [commit](https://github.com/minio/minio/commit/0d7408fc9969caf07de6a8c3a84f9fbb10a6739e). Go multi-stage menghasilkan binary asli MinIO; bukan image lain yang diubah nama. MinIO AGPLv3: operator wajib review lisensi, kewajiban distribusi/source dan kebijakan perusahaan. Bootstrap bucket menggunakan AWS SigV4 native Node, tidak memerlukan image mc yang terpisah.

## Konsekuensi dan batas

Docker/volume berbagi kernel dan storage host, bukan isolasi VM per tenant atau quota disk hard otomatis. Worker budget reservation konservatif dapat tertinggal sesudah crash: rekonsiliasi audit/usage sebelum membuka budget, jangan reset semua reservation tanpa bukti. SMTP crash acceptance membutuhkan rekonsiliasi, tidak dapat menjamin exactly-once universal.

Coolify secondary adapter membutuhkan app yang telah disambungkan ke repo Gitea/generated Dockerfile, credential dan health payload mengandung versi release. Broker memicu deployment API, mengukur health versi, lalu browser UAT trusted melalui proxy allowlist pada isolated egress network. Tidak ada credential berarti gagal, bukan fallback produksi palsu. Rollback lokal tersedia; rollback provider eksternal mengikuti runbook provider, bukan `docker start`.

Tidak dipilih Temporal karena overhead operasi lokal; DB checkpoints + queue sesuai kebutuhan monorepo ini. Keputusan ini tidak menjamin SLA, scalability arbitrary atau security certification. Production perlu TLS, VM sandbox khusus, monitoring, quota, backup teruji dan egress firewall.
