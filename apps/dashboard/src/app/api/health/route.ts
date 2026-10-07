import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;

export async function GET() {
  if (!API_URL) {
    return NextResponse.json(
      { status: 'degraded', api: 'not configured', timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  try:
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_URL}/api/v1/health`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return NextResponse.json(
        { status: 'degraded', api: `http ${response.status}`, timestamp: new Date().toISOString() },
        { status: 503 }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({
      status: data.status === 'healthy' ? 'healthy' : 'degraded',
      api: data.status,
      services: data.services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'down', 
        api: 'unreachable', 
        error: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString() 
      },
      { status: 503 }
    );
  }
}