// src/app/api/proxy-image/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('URL parameter is missing', { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9999); 

    const response = await fetch(url, {
      signal: controller.signal, // 将 signal 传递给 fetch
    });

    clearTimeout(timeoutId); // 清除超时计时器

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const res = new NextResponse(buffer, {
      status: 200,
      headers: new Headers({
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      }),
    });

    return res;
  } catch (error) {
    console.error(error);
    let errorMessage = 'Failed to proxy image';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Fetch request timed out';
      } else {
        errorMessage = error.message;
      }
    }
    return new NextResponse(errorMessage, { status: 500 });
  }
}
