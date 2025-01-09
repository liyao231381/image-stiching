import { NextResponse } from 'next/server';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // 构造新的 URL，指向你的自定义域名下的 /api/proxy-notion 路由
    const proxyUrl = new URL('/api/proxy-notion', req.url);
    proxyUrl.searchParams.set('url', url);

    // 使用 fetch API 请求新的路由
    const response = await fetch(proxyUrl.toString());

    if (!response.ok) {
      throw new Error(`Proxy request failed with status ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({ images: data.images });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch or parse HTML' }, { status: 500 });
  }
}

export const runtime = 'edge';
