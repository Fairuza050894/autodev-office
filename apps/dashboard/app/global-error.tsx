'use client';
export default function GlobalError({reset}:{error:Error & {digest?:string};reset:()=>void}) { return <html lang="id"><body><main className="portal"><section className="panel"><h1>Kantor gagal dimuat.</h1><p>Data proyek tetap tersimpan di server. Coba muat ulang tampilan.</p><button className="primary" onClick={reset}>Muat ulang kantor</button></section></main></body></html>; }
