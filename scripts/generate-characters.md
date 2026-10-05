# Panduan Karakter 3D — 19 agen AutoDev Office

Aturan: DILARANG primitif (Capsule/Box/Sphere/Cylinder) untuk karakter.
Wajib `.glb` rig humanoid di `apps/dashboard/public/assets/characters/{agent_id}.glb`.

## Pipeline aktif (offline, tanpa unduh)

`node scripts/gen-chars/generate.mjs` — build 19 `.glb` rig humanoid lokal:
`scripts/gen-chars/builder.js` (SkinnedMesh + 11 bones + 8 klip) → `GLTFExporter`
→ validasi reload `GLTFLoader` (skeleton + semua klip playable) → `public/assets/characters/`.
Lisensi: karya sendiri untuk repo ini — bebas komersial. Hasil: ~14MB, 3.4–3.8k poly/file (<40k).
Regenerasi tiap ubah builder: `node scripts/gen-chars/generate.mjs`, lalu rebuild dashboard.

## Opsi sumber (pilih satu per batch)

| Opsi | Cara | Rig | Kisaran biaya | Lisensi |
|---|---|---|---|---|
| Quaternius (disarankan sbg placeholder) | Unduh pack Humanoids di quaternius.com, pilih 19 varian, rename ke `{agent_id}.glb` | Rig dasar humanoid | Gratis | CC0 — komersial OK, tanpa atribusi |
| Mixamo + Blender | Unduh karakter+animasi di mixamo.com, ekspor `.glb` via Blender | Rig Mixamo penuh | Gratis (akun Adobe) | Cek ketentuan Adobe Mixamo per aset |
| VRoid Studio | Rancang 19 wajah/rambut/outfit, ekspor `.vrm` → konversi `.glb` | VRM humanoid | Gratis | VRoid Hub license — verifikasi tiap model |
| AI 3D + auto-rig | Generator mesh (Meshy/Tripo) → rig otomatis (AccuRIG/Mixamo) | Bervariasi | Berbayar | Wajib lisensi komersial tertulis |

CATATAN: Jangan memasukkan aset tanpa lisensi komersial yang jelas ke repo.

## Tabel 19 agen

| agent_id | file | aksesori profesi | warna role |
|---|---|---|---|
| cs_agent | cs_agent.glb | headset+mic | #22d3ee |
| account_agent | account_agent.glb | tablet+tas | #22d3ee |
| architect_agent | architect_agent.glb | topi-proyek+lampu | #f59e0b |
| ba_agent | ba_agent.glb | papan-kerja+dasi | #a78bfa |
| backend_dev | backend_dev.glb | laptop+headset | #6366f1 |
| frontend_dev | frontend_dev.glb | laptop+headset | #6366f1 |
| mobile_dev | mobile_dev.glb | ponsel-uji+headset | #6366f1 |
| data_agent | data_agent.glb | ransel+kacamata | #6366f1 |
| designer_agent | designer_agent.glb | baret+kacamata-bulat | #e879f9 |
| writer_agent | writer_agent.glb | baret+buku | #e879f9 |
| qa_agent | qa_agent.glb | kacamata+kamera-uji | #22c55e |
| security_agent | security_agent.glb | helm+visor | #ef4444 |
| devops_agent | devops_agent.glb | topi-proyek+tablet | #f59e0b |
| release_agent | release_agent.glb | topi-proyek+stempel | #f59e0b |
| pm_agent | pm_agent.glb | topi-datar+dasi | #a78bfa |
| po_agent | po_agent.glb | topi-datar+papan | #a78bfa |
| tech_lead | tech_lead.glb | headset+jubah-lead | #6366f1 |
| compliance_agent | compliance_agent.glb | helm+perisai | #ef4444 |
| estimator_agent | estimator_agent.glb | kalkulator+kacamata | #f59e0b |

Detail: `apps/dashboard/src/character-manifest.ts`.

## Pipeline aset (per file)

1. Turunkan poligon: maksimal 40k (Decimate Blender bila perlu).
2. Kompres: Draco/Meshopt + tekstur KTX2 (Basis Universal).
3. Simpan: `apps/dashboard/public/assets/characters/{agent_id}.glb` (+ `.vrm` bila VRoid).
4. Animasi yang dipakai runtime: `idle, typing, thinking, walking, talking, celebrate, error`
   (nama klip bebas — runtime petakan via `animFor`, crossfade 0.3s).
5. Verifikasi: buka `/office` — bila `.glb` ada ia dipakai, bila belum ada placeholder tampil.

## Status → animasi

RUNNING→typing, BLOCKED→thinking, DONE→celebrate, FAILED→error,
handoff/VALIDATING→walking, TALKING→talking, lain→idle.
