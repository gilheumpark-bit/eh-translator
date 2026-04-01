export const PROJECT_LIBRARY_KEY = 'eh_translator_project_library';
export const MAX_LOCAL_PROJECTS = 18;
export const REFERENCE_PROJECT_LIMIT = 4;
export const REFERENCE_CHAPTER_LIMIT = 3;
export const REFERENCE_TEXT_LIMIT = 12000;
export const STORY_BIBLE_LIMIT = 12000;

export const LANGUAGES = [
  { code: 'ja', label: '日本語 (JAPANESE)' },
  { code: 'ko', label: '한국어 (KOREAN)' },
  { code: 'en', label: 'ENGLISH' },
  { code: 'zh', label: 'CHINESE' },
] as const;

export const PROVIDERS = [
  { id: 'openai', label: 'GPT-4o (OAI)', role: 'Ensemble Base' },
  { id: 'claude', label: 'CLAUDE 3.5 (ANT)', role: 'Creative Refinement' },
  { id: 'gemini', label: 'GEMINI 1.5 (GOOG)', role: 'Context Analyst' },
  { id: 'deepseek', label: 'DEEPSEEK (DS)', role: 'Fast Draft' },
] as const;

export const BACKGROUND_MODES = [
  { id: 'nebula', label: 'NEBULA (DEEP)', note: '오로라 딥스페이스 - 집중형 컨텍스트' },
  { id: 'glacial', label: 'GLACIAL (WHITE)', note: '화이트 글래스 - 문서 작업 최적화' },
] as const;

/** Rough token estimate for UI (chars / 4) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
