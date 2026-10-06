import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/api/v1/') || pathname.startsWith('/live/')) {
    const targetUrl = `${apiUrl}${pathname}${request.nextUrl.search}`;
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        host: new URL(apiUrl).host,
      },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob(),
      redirect: 'manual',
    });

    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('transfer-encoding');
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*', '/live/:path*'],
};