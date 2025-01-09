import { NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    const root = parse(html);
    const imgElements = root.querySelectorAll('img');

    const imageUrls = imgElements.map((img) => {
      const src = img.getAttribute('src');
      if (!src) return '';
      if(src.startsWith('/image')){
        return `https://www.notion.so${src}`
      }
    
      // 确保 URL 是绝对路径
      if (src.startsWith('http') || src.startsWith('https')) {
        return src;
      } else if (src.startsWith('//')) {
        return `https:${src}`;
      } else {
        return new URL(src, url).href;
      }
    }).filter(url => url !== '');

    return NextResponse.json({ images: imageUrls });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch or parse HTML' }, { status: 500 });
  }
}

export const runtime = 'edge';
