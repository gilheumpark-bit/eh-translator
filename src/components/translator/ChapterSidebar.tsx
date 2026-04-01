'use client';

import type { ChangeEvent } from 'react';
import type { ChapterEntry } from '@/types/translator';

type Props = {
  chapters: ChapterEntry[];
  activeChapterIndex: number | null;
  loading: boolean;
  showExportOptions: boolean;
  onToggleExport: () => void;
  onBatchTranslate: () => void;
  onImportDocument: (e: ChangeEvent<HTMLInputElement>) => void;
  onDownloadAll: (format: 'txt' | 'md' | 'json' | 'html' | 'csv') => void;
  onOpenChapter: (index: number) => void;
  onRemoveChapter: (e: React.MouseEvent, idx: number) => void;
};

export function ChapterSidebar({
  chapters,
  activeChapterIndex,
  loading,
  showExportOptions,
  onToggleExport,
  onBatchTranslate,
  onImportDocument,
  onDownloadAll,
  onOpenChapter,
  onRemoveChapter,
}: Props) {
  return (
    <>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="theme-kicker">Chapters</h3>
            <label
              className="theme-pill cursor-pointer rounded-xl px-3 py-2 text-[10px] font-bold transition-colors hover:brightness-105"
              title="지원 형식: txt, md, epub, pdf, docx"
            >
              <span className="text-[10px]">➕ 문서 읽어오기</span>
              <input type="file" multiple onChange={onImportDocument} className="hidden" accept=".txt,.md,.epub,.pdf,.docx" />
            </label>
          </div>
          <div className="text-[8px] opacity-60 text-right uppercase tracking-widest mt-1">5개 대표형식 (TXT, MD, EPUB, PDF, DOCX)</div>
        </div>
      </div>

      {chapters.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBatchTranslate}
              disabled={loading}
              className="flex-1 rounded-xl bg-linear-to-r from-blue-600/80 to-indigo-600/80 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white transition-all hover:brightness-110"
            >
              ALL BATCH
            </button>
            <button
              type="button"
              onClick={onToggleExport}
              className="theme-pill flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:brightness-105"
            >
              EXPORT (5형식)
            </button>
          </div>
          {showExportOptions && (
            <div className="grid grid-cols-5 gap-1 animate-in fade-in slide-in-from-top-2">
              {(['txt', 'md', 'json', 'html', 'csv'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onDownloadAll(fmt)}
                  className="theme-pill text-[8px] py-1.5 rounded-lg font-bold uppercase hover:bg-white/10 transition-colors"
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        {chapters.length === 0 && (
          <div className="theme-text-secondary py-10 text-center text-[10px] italic">불러온 파일이 없습니다.</div>
        )}
        {chapters.map((ch, idx) => (
          <div
            key={idx}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenChapter(idx);
            }}
            onClick={() => onOpenChapter(idx)}
            className={`chapter-item group flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all ${activeChapterIndex === idx ? 'chapter-item-active' : ''} ${ch.error ? 'ring-1 ring-red-500/50' : ''}`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span
                className={`chapter-index rounded px-1 text-[9px] font-mono ${ch.isDone ? 'chapter-index-done' : 'opacity-70'}`}
              >
                {ch.isDone ? '✓' : idx + 1}
              </span>
              <span className="truncate text-xs font-medium">{ch.name}</span>
              {ch.error && <span className="text-[8px] text-red-500 shrink-0">!</span>}
            </div>
            <button
              type="button"
              onClick={(e) => onRemoveChapter(e, idx)}
              className="theme-text-secondary p-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
