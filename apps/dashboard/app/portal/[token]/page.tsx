import Portal from '@autodev/client-portal';
export default async function Page({params}:{params:Promise<{token:string}>}) { const {token}=await params;return <Portal token={token}/>; }
