# Changelog

## Unreleased

- Monorepo AutoDev Office: dashboard/portal, API, worker, orchestrator, runtime dan tools dengan fixture LLM mock terlabel.
- Stack satu perintah Node 22/pnpm: PostgreSQL pgvector, Redis, MinIO source pinned, Mailpit, Gitea bootstrap, migrasi/seed otomatis idempoten.
- Runner Docker constrained dengan jaringan none, uid nonroot, resource/timeout limits, validasi schema/path, workspace serialized, output bounded, pemeriksaan quota setelah command.
- Deployment lokal snapshot immutable, retry versi healthy idempoten, health real, rollback; UAT Chromium pada deployment nyata. Gateway public origin berbeda dari session platform.
- Gitea publication via API tepercaya, source ZIP/checksum, private artifact, setup admin token expiring dan portal-protected.
- Adapter Coolify bersyarat credential/app/health version dan proxy egress allowlist; tidak menganggap provider kosong sukses.
- Dokumen Indonesia instalasi, demo, integrasi email/LLM, SMTP SPF/DKIM/DMARC, operasi/recovery, arsitektur dan batas produksi.
- Dashboard `/new-project`, tab proyek lengkap, command palette `Cmd/Ctrl+K`, tema persisten, controls berbasis role, Kanban scheduling-only dan Settings dengan pemberitahuan restart worker.
- Portal `/portal/[token]`: unduhan signed scope proyek, aktivasi admin sekali-pakai, request change dan survei.
- API preview source ZIP tanpa extraction: file tree, teks dan diff versi artifact; batas 50 MiB archive / 1 MiB file, binary tidak dipreview.

Verifikasi integrasi dijalankan pemilik root setelah seluruh perubahan tersinkronisasi; daftar ini bukan klaim build/test/E2E telah lulus.
