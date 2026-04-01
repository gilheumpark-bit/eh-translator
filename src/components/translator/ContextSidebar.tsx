'use client';

import type { HistoryEntry } from '@/types/translator';

type Props = {
  worldContext: string;
  setWorldContext: (v: string) => void;
  characterProfiles: string;
  setCharacterProfiles: (v: string) => void;
  storySummary: string;
  setStorySummary: (v: string) => void;
  showCharacters: boolean;
  setShowCharacters: (v: boolean | ((p: boolean) => boolean)) => void;
  showSummary: boolean;
  setShowSummary: (v: boolean | ((p: boolean) => boolean)) => void;
  accentTextColor: string;
  history: HistoryEntry[];
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
};

export function ContextSidebar({
  worldContext,
  setWorldContext,
  characterProfiles,
  setCharacterProfiles,
  storySummary,
  setStorySummary,
  showCharacters,
  setShowCharacters,
  showSummary,
  setShowSummary,
  accentTextColor,
  history,
  setFrom,
  setTo,
  setHistory,
}: Props) {
  return (
    <>
      <div className="space-y-4">
        <h3 className="theme-kicker">World Lore</h3>
        <textarea
          value={worldContext}
          onChange={(e) => setWorldContext(e.target.value)}
          className="theme-field editor-pane w-full h-32 rounded-xl p-4 text-[11px] leading-relaxed resize-none outline-none"
        />
      </div>
      <div className="space-y-4">
        <h3 className="theme-kicker flex justify-between">
          Characters{' '}
          <button type="button" onClick={() => setShowCharacters((p) => !p)} style={{ color: accentTextColor }}>
            Edit
          </button>
        </h3>
        {showCharacters && (
          <textarea
            value={characterProfiles}
            onChange={(e) => setCharacterProfiles(e.target.value)}
            className="theme-field editor-pane w-full h-40 rounded-xl p-4 text-[10px] outline-none"
          />
        )}
      </div>
      <div className="space-y-4">
        <h3 className="theme-kicker flex justify-between">
          Story Bible{' '}
          <button type="button" onClick={() => setShowSummary((p) => !p)} style={{ color: accentTextColor }}>
            Edit
          </button>
        </h3>
        <p className="text-[11px] leading-relaxed theme-text-secondary">
          소설 모드 번역 후 자동 요약이 이어붙여집니다. 필요하면 여기서 직접 다듬을 수 있습니다.
        </p>
        {showSummary && (
          <textarea
            value={storySummary}
            onChange={(e) => setStorySummary(e.target.value)}
            className="theme-field editor-pane w-full h-40 rounded-xl p-4 text-[10px] outline-none"
          />
        )}
      </div>
      <div className="pt-8 border-t border-white/5">
        <HistoryList history={history} setFrom={setFrom} setTo={setTo} setHistory={setHistory} />
      </div>
    </>
  );
}

function HistoryList({
  history,
  setFrom,
  setTo,
  setHistory,
}: {
  history: HistoryEntry[];
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="theme-kicker">Logs</h3>
        <button type="button" onClick={() => setHistory([])} className="theme-text-secondary text-[9px]">
          CLEAR
        </button>
      </div>
      <div className="space-y-3">
        {history.map((h, i) => (
          <button
            type="button"
            key={i}
            className="w-full p-4 glass-panel rounded-xl cursor-pointer group hover:border-purple-500/30 transition-all text-left"
            onClick={() => {
              setFrom(h.from);
              setTo(h.to);
            }}
          >
            <div className="theme-text-secondary mb-2 flex justify-between text-[8px]">
              <span>{new Date(h.time).toLocaleTimeString()}</span>
              <span>
                {h.from}→{h.to}
              </span>
            </div>
            <p className="theme-text-primary truncate text-[10px]">{h.source}</p>
          </button>
        ))}
        {history.length === 0 && (
          <p className="theme-text-secondary py-4 text-center text-[10px] italic">최근 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
