# Kontrak sandbox

Runner adalah satu-satunya pemegang Docker daemon. Port 4100 hanya jaringan Compose, setiap request perlu `Authorization: Bearer RUNNER_TOKEN`. API/worker tidak memiliki socket Docker. Token minimal 32 karakter; default hanya lokal. Payload JSON divalidasi Zod; project ID allowlist, path relatif, traversal/absolute/symlink dan direktori Git internal ditolak untuk file input.

| Endpoint | Input | Output |
|---|---|---|
| POST /run | project_id, files [{path,content}], command string[], timeout_ms, branch opsional | exit_code, stdout, stderr, files teks terbatas |
| POST /deploy | project_id, version, target opsional | url, internal_url, container_id, healthy, setup_url private opsional |
| POST /rollback | project_id, container_id opsional | status, container_id, healthy |
| POST /archive | project_id | path, checksum SHA256, size |
| POST /git/publish | project_id, repo_name | repo_url, commits |
| POST /uat | project_id | exit_code, stdout, stderr, files |
| POST /scan | project_id | critical, high, findings, scanner |
| GET /live/:project_id/* | HTTP request | Respons deployment melalui proxy tepercaya |
| GET /health | — | health Docker |

`/run` hanya executable node/git/zip/sh dalam container. Shell diizinkan karena workflow merge membutuhkan chaining; shell **tidak dijalankan host**. Tidak ada arbitrary Docker arguments/image/mount/network/env dari request. Workspace persist per project, operasi mutasi serialized per project. Root filesystem read-only, uid 1000, cap-drop ALL, no-new-privileges, memory 768 MB, 1 CPU, pids 128, timeout maksimal 180 detik, output 4 MB. `/tmp` tmpfs 128 MB, noexec/nosuid. Jaringan none; tidak ada credential platform dalam env sandbox.
Workspace dicek setelah command: maksimum 10.000 entries/256 MB termasuk snapshot. Ini mendeteksi pelanggaran, bukan hard filesystem quota selama command. `branch` opsional melakukan checkout sandbox sebelum menerapkan file. `/scan` fixed basic rules tidak mengeksekusi scanner hasil model; dependency project tidak dapat dianggap aman bila advisory audit belum tersedia.

Deploy menyalin snapshot immutable tanpa symlink, start node server.mjs:8080, mengukur health, lalu memperbarui state pointer. Retry versi healthy yang sama tidak membongkar container. Gunakan version baru untuk perubahan source. Rollback mengukur health versi sebelumnya. `/uat` menjalankan Chromium dengan network namespace container deployment, tetap terisolasi platform; script tidak menghidupkan server baru. Broker proxy menjalankan node fetch di dalam deployment melalui docker exec, tidak membuka port aplikasi ke jaringan platform.

Gateway public terpisah port 4400, host **127.0.0.1**, sementara session dashboard berada pada **localhost**. Gateway tidak meneruskan cookie platform, tidak menyediakan API platform, dan memasang CSP restrictive. Jangan mengubah keduanya menjadi hostname sama. Public production wajib domain aplikasi terpisah dari dashboard, HTTPS, policy CORS/cookie/CSRF.

Batas: Docker berbagi kernel host; root broker/socket memberi kendali besar. Gunakan daemon/VM khusus, jangan host berisi workload/secret lain. Sandbox jaringan none mencegah npm/pip online dan integrasi eksternal langsung; template memakai dependensi preinstalled. Allowlist registry memerlukan proxy egress terpisah, bukan membuka jaringan default. Volume Docker tidak otomatis memiliki hard disk quota: operator wajib filesystem quota/disk monitoring dan daemon storage terpisah; pembatasan output bukan pembatasan disk. Chromium memakai --no-sandbox di dalam container karena user-namespace tidak tersedia; isolasi utama Docker/VM. Ini bukan sandbox yang telah diaudit untuk adversarial multi-tenant production.
