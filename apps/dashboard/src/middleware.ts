import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const apiUrl = process.env.API_URL;

  // Only proxy API and live routes
  if (!apiUrl) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Proxy API and live routes to the backend
  if (pathname.startsWith('/api/v1/') || pathname.startsWith('/live/')) {
    const targetUrl = `${apiUrl}${pathname.pathname}${request.nextUrl.search}`;

    try {
      const target = new URL(targetUrl);

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': request.headers.get('content-type'),
          'Authorization': request.headers.get('authorization'),
          'X-CSRF-Token': request.headers.get('x-csrf-token'),
          'host': target.host,
          'origin': request.headers.get('origin'),
        },
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
        redirect: 'manual',
      });

      const respHeaders = new Headers(response.headers);
      respHeaders.set('x-proxy', 'true');
      respHeaders.set('access-control-allow-origin', apiUrl);
      respHeaders.set('access-control-allow-credentials', 'true');

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      });
    } catch (error) {
      console.error('Proxy error:', error);
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

// Only match API and live routes, not _next/static, etc.
export const config = {
  matcher: ['/api/v1/:path*', '/live/:path*'],
};