'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}) { return <main className="portal"><section className="panel"><h1>Tampilan gagal dimuat.</h1><p>Data proyek tetap tersimpan di server. Coba muat tampilan kembali.</p><button className="primary" onClick={reset}>Coba lagi</button></section></main>; }
