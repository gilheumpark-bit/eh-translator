'use client';

import { useState } from 'react';
import {
  buildTranslationIndexContent,
  ingestTranslationDocument,
  normalizeUniverseOrigin,
  searchTranslationNetwork,
} from '@/lib/network-agent-client';

type Chapter = { name: string; content: string; result: string };

type Props = {
  universeOrigin: string;
  getIdToken: () => Promise<string | null>;
  projectId: string;
  projectName: string;
  chapters: Chapter[];
  worldContext: string;
  characterProfiles: string;
  storySummary: string;
  glossaryText: string;
};

/**
 * EH Universe Vertex Search와 선택적으로만 연결. 네트워크 요약은 번역 API에 자동 주입하지 않음(오염 방지).
 */
export function NetworkBridgePanel({
  universeOrigin,
  getIdToken,
  projectId,
  projectName,
  chapters,
  worldContext,
  characterProfiles,
  storySummary,
  glossaryText,
}: Props) {
  const [busy, setBusy] = useState<'idle' | 'ingest' | 'search'>('idle');
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [summaryOut, setSummaryOut] = useState('');
  const baseOk = Boolean(normalizeUniverseOrigin(universeOrigin));

  const runIngest = async () => {
    setMsg('');
    const tok = await getIdToken();
    if (!tok) {
      setMsg('로그인이 필요합니다.');
      return;
    }
    setBusy('ingest');
    try {
      const content = buildTranslationIndexContent({
        projectName,
        chapters,
        worldContext,
        characterProfiles,
        storySummary,
        glossaryText,
      });
      const r = await ingestTranslationDocument(universeOrigin, tok, {
        documentId: `tr-${projectId}`,
        title: projectName.trim() || `Translation ${projectId.slice(-6)}`,
        content,
        translationProjectId: projectId,
      });
      setMsg(r.ok ? '네트워크 색인 요청이 완료되었습니다.' : r.error || '실패');
    } finally {
      setBusy('idle');
    }
  };

  const runSearch = async () => {
    setMsg('');
    setSummaryOut('');
    const tok = await getIdToken();
    if (!tok) {
      setMsg('로그인이 필요합니다.');
      return;
    }
    if (!query.trim()) {
      setMsg('검색어를 입력하세요.');
      return;
    }
    setBusy('search');
    try {
      const r = await searchTranslationNetwork(universeOrigin, tok, query.trim(), projectId);
      if (!r.ok) {
        setMsg(r.error || '검색 실패');
        return;
      }
      setSummaryOut(r.summary || '');
      setMsg('검색 완료 (아래는 참고용 — 번역 파이프라인에 넣지 않음)');
    } finally {
      setBusy('idle');
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <div className="theme-kicker text-amber-200/90">EH Universe 네트워크 (선택)</div>
      <p className="text-[11px] leading-relaxed theme-text-secondary">
        동일 Firebase 프로젝트·<code className="text-[10px]">NEXT_PUBLIC_EH_UNIVERSE_ORIGIN</code> 필요.
        네트워크 요약·검색 결과는 <strong>참고용</strong>이며 번역 API(/api/translate)에 <strong>자동으로 붙지 않습니다</strong>(오염 방지).
      </p>
      {!baseOk ? (
        <p className="text-[11px] text-amber-300/90">Universe API origin 미설정 — 패널 비활성.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== 'idle'}
              onClick={() => void runIngest()}
              className="rounded-lg bg-amber-600/80 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"
            >
              {busy === 'ingest' ? '색인 중…' : '이 프로젝트 네트워크 색인'}
            </button>
          </div>
          <div className="space-y-2">
            <label className="theme-kicker block">이 프로젝트만 검색 (translation 스코프)</label>
            <div className="flex gap-2 flex-wrap">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="맥락 질의…"
                className="theme-field flex-1 min-w-[160px] rounded-lg px-3 py-2 text-xs outline-none"
              />
              <button
                type="button"
                disabled={busy !== 'idle'}
                onClick={() => void runSearch()}
                className="rounded-lg theme-pill px-3 py-2 text-[10px] font-bold disabled:opacity-50"
              >
                {busy === 'search' ? '검색 중…' : '검색'}
              </button>
            </div>
          </div>
          {msg ? <p className="text-[11px] theme-text-secondary">{msg}</p> : null}
          {summaryOut ? (
            <div>
              <div className="theme-kicker mb-1">요약 (참고만)</div>
              <textarea
                readOnly
                value={summaryOut}
                className="theme-field w-full min-h-[100px] rounded-lg p-2 text-[11px] outline-none"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
