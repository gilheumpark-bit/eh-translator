/**
 * Calls EH Universe `/api/network-agent/*` from the translator app.
 * Requires NEXT_PUBLIC_EH_UNIVERSE_ORIGIN and the same Firebase project as Universe for ID tokens.
 */

const MAX_INDEX_CHARS = 400_000;

export function normalizeUniverseOrigin(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  return raw.replace(/\/$/, '');
}

export function buildTranslationIndexContent(parts: {
  projectName: string;
  chapters: { name: string; content: string; result: string }[];
  worldContext: string;
  characterProfiles: string;
  storySummary: string;
  glossaryText: string;
}): string {
  const lines: string[] = [];
  lines.push(`# ${parts.projectName || 'Translation project'}\n`);
  if (parts.worldContext.trim()) lines.push(`## World\n${parts.worldContext.trim()}\n`);
  if (parts.characterProfiles.trim()) lines.push(`## Characters\n${parts.characterProfiles.trim()}\n`);
  if (parts.storySummary.trim()) lines.push(`## Story Bible\n${parts.storySummary.trim()}\n`);
  if (parts.glossaryText.trim()) lines.push(`## Glossary\n${parts.glossaryText.trim()}\n`);
  for (const ch of parts.chapters) {
    lines.push(`## ${ch.name}\n`);
    if (ch.content.trim()) lines.push(`### Source\n${ch.content.trim()}\n`);
    if (ch.result.trim()) lines.push(`### Translation\n${ch.result.trim()}\n`);
  }
  const full = lines.join('\n');
  if (full.length <= MAX_INDEX_CHARS) return full;
  return `${full.slice(0, MAX_INDEX_CHARS)}\n\n[truncated]`;
}

export async function ingestTranslationDocument(
  universeOrigin: string,
  idToken: string,
  payload: {
    documentId: string;
    title: string;
    content: string;
    translationProjectId: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const base = normalizeUniverseOrigin(universeOrigin);
  if (!base) return { ok: false, error: 'NEXT_PUBLIC_EH_UNIVERSE_ORIGIN이 설정되지 않았습니다.' };

  const res = await fetch(`${base}/api/network-agent/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      documentId: payload.documentId,
      title: payload.title,
      content: payload.content,
      documentType: 'translation',
      translationProjectId: payload.translationProjectId,
      isPublic: false,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true };
}

export async function searchTranslationNetwork(
  universeOrigin: string,
  idToken: string,
  query: string,
  translationProjectId: string,
): Promise<{ ok: boolean; summary?: string; results?: unknown[]; error?: string }> {
  const base = normalizeUniverseOrigin(universeOrigin);
  if (!base) return { ok: false, error: 'NEXT_PUBLIC_EH_UNIVERSE_ORIGIN이 설정되지 않았습니다.' };

  const res = await fetch(`${base}/api/network-agent/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      query,
      narrowDocumentType: 'translation',
      translationProjectId,
      onlyPublic: false,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    summary?: string;
    results?: unknown[];
  };
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, summary: data.summary, results: data.results };
}
