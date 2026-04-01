/**
 * Client-safe env checks for EH Translator (NEXT_PUBLIC_* + Supabase re-exports).
 * Does not expose secret values — only booleans and public host hints.
 */

import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { normalizeUniverseOrigin } from '@/lib/network-agent-client';

export type TranslatorEnvSnapshot = {
  firebaseOk: boolean;
  universeOk: boolean;
  universeHost: string;
  supabaseOk: boolean;
  /** Firebase + Universe origin — required for Network Agent bridge */
  networkBridgeReady: boolean;
};

function safeHostname(raw: string): string {
  const base = normalizeUniverseOrigin(raw);
  if (!base) return '';
  try {
    const u = base.startsWith('http') ? base : `https://${base}`;
    return new URL(u).hostname;
  } catch {
    return '';
  }
}

export function getTranslatorEnvStatus(): TranslatorEnvSnapshot {
  const firebaseOk = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
      && process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  );
  const rawUniverse = process.env.NEXT_PUBLIC_EH_UNIVERSE_ORIGIN?.trim() || '';
  const universeOk = Boolean(normalizeUniverseOrigin(rawUniverse));
  const universeHost = safeHostname(rawUniverse);
  const supabaseOk = Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim());
  const networkBridgeReady = firebaseOk && universeOk;

  return {
    firebaseOk,
    universeOk,
    universeHost,
    supabaseOk,
    networkBridgeReady,
  };
}
