import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

export const dynamic = 'force-dynamic';
// For multipart form body parsing, we do not need body parser false in Next.js App Router.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    
    let content = '';

    // DOCX PARSING
    if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } 
    // PDF PARSING
    else if (fileName.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      // Create a blob/buffer for pdf-parse
      const data = await pdfParse(buffer);
      content = data.text;
    } 
    // EPUB PARSING
    else if (fileName.endsWith('.epub')) {
      const EPub = require('epub2');
      // epub2 usually expects a file path, to use buffer, we might need a temp file or memfs.
      // But let's fallback to rudimentary regex extraction if epub2 requires file path.
      // Actually epub2 supports parsing from buffer via EPub constructor if we hack the prototype, but the easiest way in a NextJS edge/serverless is using a tmp directory or just basic AdmZip parsing.
      // For now, let's write the buffer to /tmp (Vercel allows write to /tmp)
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}.epub`);
      fs.writeFileSync(tempPath, buffer);
      
      const epubData = await new Promise<any[]>((resolve, reject) => {
        const epub = new EPub(tempPath, '/images/', '/links/');
        epub.on('end', () => {
          const chaptersData: any[] = [];
          const flow = epub.flow || [];
          let processed = 0;
          if (flow.length === 0) return resolve([]);
          flow.forEach((chapter: any, index: number) => {
            epub.getChapter(chapter.id || '', (err: any, text: string) => {
              if (!err && text) {
                const plain = text.replace(/<[^>]+>/g, '\n').trim();
                if (plain.length > 50) chaptersData[index] = { title: chapter.title || `Chapter ${index+1}`, content: plain };
              }
              processed++;
              if (processed === flow.length) resolve(chaptersData.filter(Boolean));
            });
          });
        });
        epub.parse();
      });
      fs.unlinkSync(tempPath);
      return NextResponse.json({ chapters: epubData });
    } 
    // TXT/MD
    else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      content = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
    }

    // Split content into basic chunks ensuring we DON'T ruin mid-sentence phrasing.
    // We split purely by double newlines or major paragraph breaks.
    const rawChunks = content.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 50);
    // Combine into chunks of roughly 4000 chars to maximize LLM context window while preventing cutoffs.
    const chapters: { title: string; content: string }[] = [];
    let currentChunk = '';
    let chIndex = 1;

    for (const paragraph of rawChunks) {
      if ((currentChunk.length + paragraph.length) > 4000) {
        chapters.push({ title: `Split Part ${chIndex++}`, content: currentChunk });
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    if (currentChunk) chapters.push({ title: `Split Part ${chIndex++}`, content: currentChunk });

    return NextResponse.json({ chapters });
  } catch (err: any) {
    console.error('File parsing error:', err);
    return NextResponse.json({ error: err.message || 'File parsing failed' }, { status: 500 });
  }
}
