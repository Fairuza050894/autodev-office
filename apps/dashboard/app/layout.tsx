import type { Metadata } from 'next';
import '@autodev/ui/styles.css';
export const metadata: Metadata = { title: 'AutoDev Office — Kendali Misi', description: 'Kantor software otonom. Dari ide hingga aplikasi live.' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="id" suppressHydrationWarning><body>{children}</body></html>; }
