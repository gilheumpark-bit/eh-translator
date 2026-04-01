import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    new URL(url); // Validate URL format
  } catch {
    return NextResponse.json({ error: '유효하지 않은 URL 형식입니다.' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EH-Translator/3.1; +https://github.com/gilheumpark-bit/eh-translator)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `외부 사이트 응답 오류 (${response.status})` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let rawText = '';

    if (contentType.includes('text/plain')) {
      rawText = await response.text();
    } else {
      // HTML: strip tags, decode entities, extract body text
      const html = await response.text();

      // Remove <script>, <style>, <nav>, <header>, <footer>, <aside>
      let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '');

      // Convert <br>, <p>, <h1-6>, <li>, <tr> to newlines for readability
      cleaned = cleaned
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n');

      // Strip all remaining HTML tags
      cleaned = cleaned.replace(/<[^>]+>/g, '');

      // Decode common HTML entities
      cleaned = cleaned
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…');

      // Collapse excessive whitespace/blank lines
      rawText = cleaned
        .split('\n')
        .map(line => line.trim())
        .filter((line, i, arr) => line || (arr[i - 1] && arr[i - 1] !== ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    if (!rawText) {
      return NextResponse.json({ error: '본문 텍스트를 추출할 수 없습니다.' }, { status: 422 });
    }

    // Cap at ~50,000 chars to prevent context overflow
    const MAX_CHARS = 50000;
    const isTruncated = rawText.length > MAX_CHARS;
    const text = isTruncated ? rawText.slice(0, MAX_CHARS) + '\n\n[... 내용이 너무 길어 잘렸습니다 ...]' : rawText;

    return NextResponse.json({ 
      text, 
      charCount: text.length,
      truncated: isTruncated,
      sourceUrl: url 
    });

  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return NextResponse.json({ error: '요청 시간 초과 (15초). 해당 사이트가 응답하지 않습니다.' }, { status: 504 });
    }
    console.error('fetch-url error:', err);
    return NextResponse.json(
      { error: 'URL 본문을 읽는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
