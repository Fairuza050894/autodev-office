import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params);
}

async function proxy(request: NextRequest, params: { path: string[] }) {
  if (!API_URL) {
    return NextResponse.json({ error: 'API_URL not configured' }, { status: 500 });
  }

  const path = params.path.join('/');
  const targetUrl = `${API_URL}/api/v1/${path}${request.nextUrl.search}`;

  try {
    const headers = new Headers(request.headers);
    headers.set('host', new URL(API_URL).host);
    headers.delete('connection');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob(),
      redirect: 'manual',
    });

    const proxyHeaders = new Headers(response.headers);
    proxyHeaders.delete('content-encoding');
    proxyHeaders.delete('transfer-encoding');
    proxyHeaders.set('x-proxy-debug', 'proxied');

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: proxyHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy failed', detail: error instanceof Error ? error.message : 'unknown' },
      { status: 502, headers: { 'x-proxy-debug': `error:${error instanceof Error ? error.message : 'unknown'}` } }
    );
  }
}