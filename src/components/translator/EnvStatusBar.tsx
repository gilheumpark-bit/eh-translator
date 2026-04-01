'use client';

import { useMemo } from 'react';
import { getTranslatorEnvStatus } from '@/lib/translator-env-status';

function Chip({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div
      className="theme-pill flex min-w-0 items-center gap-2 rounded-2xl px-3 py-2 text-[11px] font-semibold"
      title={detail}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
        aria-hidden
      />
      <span className="min-w-0 truncate theme-text-primary">{label}</span>
      {detail ? (
        <span className="truncate text-[10px] font-medium opacity-70 theme-text-secondary">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

export function EnvStatusBar() {
  const s = useMemo(() => getTranslatorEnvStatus(), []);

  return (
    <div
      className="mb-5 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
      role="region"
      aria-label="환경 변수 연결 상태"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] theme-text-secondary">
          환경 연결
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[10px] font-bold ${
            s.networkBridgeReady && s.supabaseOk
              ? 'bg-emerald-500/15 theme-text-primary'
              : 'bg-amber-500/15 theme-text-primary'
          }`}
        >
          {s.networkBridgeReady && s.supabaseOk
            ? '번역·네트워크·클라우드 준비됨'
            : '일부만 설정됨 — 아래 항목 확인'}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip
          ok={s.firebaseOk}
          label="Firebase"
          detail={s.firebaseOk ? '로그인·ID 토큰' : '.env에 NEXT_PUBLIC_FIREBASE_*'}
        />
        <Chip
          ok={s.universeOk}
          label="EH Universe"
          detail={
            s.universeOk
              ? (s.universeHost || 'origin 설정됨')
              : 'NEXT_PUBLIC_EH_UNIVERSE_ORIGIN'
          }
        />
        <Chip
          ok={s.supabaseOk}
          label="Supabase"
          detail={s.supabaseOk ? '클라우드 동기화' : 'NEXT_PUBLIC_SUPABASE_*'}
        />
        <Chip
          ok={s.networkBridgeReady}
          label="네트워크 브릿지"
          detail={s.networkBridgeReady ? 'ingest / search 가능' : 'Firebase+Universe 필요'}
        />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed opacity-80 theme-text-secondary">
        Universe 쪽 서버는{' '}
        <code className="rounded bg-black/10 px-1 py-0.5 text-[9px]">AGENT_BUILDER_NETWORK_ID</code>,{' '}
        <code className="rounded bg-black/10 px-1 py-0.5 text-[9px]">VERTEX_AI_CREDENTIALS</code> 등이
        배포 환경에 있어야 네트워크 검색이 동작합니다. (이 앱 화면에는 비밀 값을 표시하지 않습니다.)
      </p>
    </div>
  );
}
