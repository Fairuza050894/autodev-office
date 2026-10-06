import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const apiUrl = process.env.API_URL;
  
  // Add debug header to verify middleware runs
  const response = NextResponse.next();
  response.headers.set('x-middleware-debug', 'running');
  
  if (!apiUrl) {
    response.headers.set('x-middleware-debug', 'no-api-url');
    return response;
  }

  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/api/v1/') || pathname.startsWith('/live/')) {
    response.headers.set('x-middleware-debug', 'proxying');
    
    try {
      const targetUrl = `${apiUrl}${pathname}${request.nextUrl.search}`;
      
      const headers = new Headers(request.headers);
      headers.set('host', new URL(apiUrl).host);
      headers.delete('connection');
      
      const proxyResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob(),
        redirect: 'manual',
      });

      const proxyHeaders = new Headers(proxyResponse.headers);
      proxyHeaders.delete('content-encoding');
      proxyHeaders.delete('transfer-encoding');
      proxyHeaders.set('x-middleware-debug', 'proxied');
      
      return new NextResponse(proxyResponse.body, {
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        headers: proxyHeaders,
      });
    } catch (error) {
      response.headers.set('x-middleware-debug', `error:${error instanceof Error ? error.message : 'unknown'}`);
      return response;
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/v1/:path*', '/live/:path*'],
};