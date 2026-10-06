# Unity WebGL — Kantor Virtual AutoDev (slot build)

Web menyiapkan slot embed, **bukan** build Unity itu sendiri. Project Unity
(URP, Sims-like, 3 lantai, 16 ruangan) dibuat terpisah, diekspor WebGL,
lalu URL `index.html`-nya diisi ke `unity_build_url` di Pengaturan.

## Kontrak bridge (postMessage, dua arah)

Web → Unity (tiap 3 detik + saat ganti lantai):

```json
{ "type": "autodev:office", "agents": [{ "id": "backend_dev", "display_name": "Raka — Backend", "status": "working", "room": 5 }], "focusFloor": -1 }
{ "type": "autodev:focus", "floor": 0 }
```

Unity → web (klik agen → buka drawer):

```json
{ "type": "autodev:agent-selected", "agentId": "backend_dev" }
```

## Unity: file C# minimal

`Assets/AutoDev/AutoDevBridge.cs`:

```csharp
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

public class AutoDevBridge : MonoBehaviour
{
    [DllImport("__Internal")] private static extern void AutoDevReady();
    private readonly Dictionary<string, GameObject> agents = new();

    void Start()
    {
        Application.ExternalEval("window.addEventListener('message', function(e){ SendMessage('Bridge', 'OnWebMessage', JSON.stringify(e.data)); });");
#if !UNITY_EDITOR
        AutoDevReady();
#endif
    }

    // Dipanggil web via Application.ExternalEval / postMessage handler di atas
    void OnWebMessage(string json)
    {
        var msg = JsonUtility.FromJson<WebMsg>(json);
        if (msg.type == "autodev:focus") FocusFloor(msg.floor);
        if (msg.type == "autodev:office") SyncAgents(msg);
    }

    void SyncAgents(WebMsg msg) { /* pindahkan avatar / update nameplate per msg.agents */ }
    void FocusFloor(int f) { /* geser kamera ke lantai f, -1 = semua */ }

    // Dipanggil saat avatar diklik di Unity
    public void OnAgentClicked(string agentId)
    {
        Application.ExternalEval($"window.parent.postMessage({{type:'autodev:agent-selected',agentId:'{agentId}'}},'*')");
    }

    [System.Serializable] class WebMsg { public string type; public int floor; public int focusFloor; public AgentMsg[] agents; }
    [System.Serializable] class AgentMsg { public string id; public string display_name; public string status; public int room; }
}
```

`Assets/Plugins/WebGL/AutoDev.jslib`:

```js
mergeInto(LibraryManager.library, { AutoDevReady: function() {} });
```

## Denah acuan (sinkron dengan `office-data.ts`)

- L1 Operasional: RECEPTION, PM ROOM, BA & PO, DESIGN STUDIO, ARCHITECTURE, DEV FLOOR
- L2 Quality & Rilis: QA LAB, SECURITY, DEVOPS / SERVER, RELEASE DESK, LIBRARY
- L3 Leisure: PANTRY, GAME ROOM, REST ROOM, GYM, ROOFTOP LOUNGE
- Warna zona: L1 `#f59e0b` hangat, L2 `#22d3ee` cyan, L3 `#c084fc` ungu.
- Status ring: bekerja `#6366f1`, siap `#22c55e`, terhambat `#f59e0b`.

## Verifikasi

1. Build WebGL → hosting → isi `unity_build_url` → buka `/office` → mode Unity 3D.
2. Klik avatar di Unity → drawer agen terbuka di web.
3. Ganti tab lantai di web → kamera Unity meluncur ke lantai itu.
