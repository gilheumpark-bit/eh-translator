'use client';

import { ChangeEvent, startTransition, useEffect, useRef, useState } from 'react';
import { useAuth, UserButton, SignInButton } from '@clerk/nextjs';
import {
  loadProjectFromCloud,
  saveProjectToCloud,
  listUserProjects,
  supabaseAnonKey,
  supabaseUrl,
} from '@/lib/supabase';

const LANGUAGES = [
  { code: 'ja', label: '日本語 (JAPANESE)' },
  { code: 'ko', label: '한국어 (KOREAN)' },
  { code: 'en', label: 'ENGLISH' },
  { code: 'zh', label: 'CHINESE' }
];

const PROVIDERS = [
  { id: 'openai', label: 'GPT-4o (OAI)', role: 'Ensemble Base' },
  { id: 'claude', label: 'CLAUDE 3.5 (ANT)', role: 'Creative Refinement' },
  { id: 'gemini', label: 'GEMINI 1.5 (GOOG)', role: 'Context Analyst' },
  { id: 'deepseek', label: 'DEEPSEEK (DS)', role: 'Fast Draft' }
];

const BACKGROUND_MODES = [
  { id: 'nebula', label: 'NEBULA (DEEP)', note: '오로라 딥스페이스 - 집중형 컨텍스트' },
  { id: 'glacial', label: 'GLACIAL (WHITE)', note: '화이트 글래스 - 문서 작업 최적화' }
];

const PROJECT_LIBRARY_KEY = 'eh_translator_project_library';
const MAX_LOCAL_PROJECTS = 18;
const REFERENCE_PROJECT_LIMIT = 4;
const REFERENCE_CHAPTER_LIMIT = 3;
const REFERENCE_TEXT_LIMIT = 12000;
const STORY_BIBLE_LIMIT = 12000;

type ChapterEntry = {
  name: string;
  content: string;
  result: string;
  isDone: boolean;
  stageProgress: number;
  storyNote?: string;
  error?: string;
};

type ProjectSnapshot = {
  id: string;
  project_name: string;
  updated_at: number;
  chapters: ChapterEntry[];
  worldContext: string;
  characterProfiles: string;
  storySummary: string;
  from: string;
  to: string;
};

type ExportProjectMeta = {
  id: string;
  project_name: string;
  updated_at: number;
};

function limitText(text: string, max: number) {
  const normalized = text.trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}\n\n[...중략...]`;
}

function normalizeChapter(raw: any, fallbackName = 'Untitled Part'): ChapterEntry {
  return {
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name : fallbackName,
    content: typeof raw?.content === 'string' ? raw.content : '',
    result: typeof raw?.result === 'string' ? raw.result : '',
    isDone: Boolean(raw?.isDone),
    stageProgress: typeof raw?.stageProgress === 'number' ? raw.stageProgress : 0,
    storyNote: typeof raw?.storyNote === 'string' ? raw.storyNote : '',
    error: typeof raw?.error === 'string' ? raw.error : '',
  };
}

function normalizeProjectSnapshots(value: unknown) {
  if (!Array.isArray(value)) return [] as ProjectSnapshot[];

  const seen = new Set<string>();

  return value
    .map((raw: any) => {
      const id = typeof raw?.id === 'string' && raw.id.trim() ? raw.id : null;
      if (!id) return null;

      return {
        id,
        project_name:
          typeof raw?.project_name === 'string' && raw.project_name.trim()
            ? raw.project_name
            : typeof raw?.projectName === 'string' && raw.projectName.trim()
              ? raw.projectName
              : `Project ${id.slice(-4)}`,
        updated_at: typeof raw?.updated_at === 'number' ? raw.updated_at : Date.now(),
        chapters: Array.isArray(raw?.chapters)
          ? raw.chapters.map((chapter: any, index: number) => normalizeChapter(chapter, `Part ${index + 1}`))
          : [],
        worldContext: typeof raw?.worldContext === 'string' ? raw.worldContext : '',
        characterProfiles: typeof raw?.characterProfiles === 'string' ? raw.characterProfiles : '',
        storySummary: typeof raw?.storySummary === 'string' ? raw.storySummary : '',
        from: typeof raw?.from === 'string' ? raw.from : 'ja',
        to: typeof raw?.to === 'string' ? raw.to : 'ko',
      } satisfies ProjectSnapshot;
    })
    .filter((snapshot): snapshot is ProjectSnapshot => Boolean(snapshot))
    .filter((snapshot) => {
      if (seen.has(snapshot.id)) return false;
      seen.add(snapshot.id);
      return true;
    })
    .sort((left, right) => right.updated_at - left.updated_at)
    .slice(0, MAX_LOCAL_PROJECTS);
}

function mergeProjectSnapshots(primary: ProjectSnapshot[], secondary: ProjectSnapshot[]) {
  const merged = new Map<string, ProjectSnapshot>();

  for (const project of secondary) {
    merged.set(project.id, project);
  }

  for (const project of primary) {
    merged.set(project.id, project);
  }

  return Array.from(merged.values())
    .sort((left, right) => right.updated_at - left.updated_at)
    .slice(0, MAX_LOCAL_PROJECTS);
}

function toProjectMeta(projects: ProjectSnapshot[]): ExportProjectMeta[] {
  return projects.map((project) => ({
    id: project.id,
    project_name: project.project_name,
    updated_at: project.updated_at,
  }));
}

function projectFingerprint(snapshot: Omit<ProjectSnapshot, 'updated_at'>) {
  return JSON.stringify({
    id: snapshot.id,
    project_name: snapshot.project_name,
    chapters: snapshot.chapters.map((chapter) => ({
      name: chapter.name,
      content: chapter.content,
      result: chapter.result,
      isDone: chapter.isDone,
      stageProgress: chapter.stageProgress,
      storyNote: chapter.storyNote || '',
      error: chapter.error || '',
    })),
    worldContext: snapshot.worldContext,
    characterProfiles: snapshot.characterProfiles,
    storySummary: snapshot.storySummary,
    from: snapshot.from,
    to: snapshot.to,
  });
}

function mergeStoryBible(existing: string, incoming: string) {
  const nextBlock = incoming.trim();
  if (!nextBlock) return existing;
  if (existing.includes(nextBlock)) return limitText(existing, STORY_BIBLE_LIMIT);

  const merged = existing.trim()
    ? `${existing.trim()}\n\n---\n${nextBlock}`
    : nextBlock;

  return limitText(merged, STORY_BIBLE_LIMIT);
}

function buildReferenceBundle(referenceIds: string[], projectList: ProjectSnapshot[], currentProjectId: string) {
  const selectedProjects = projectList
    .filter((project) => project.id !== currentProjectId && referenceIds.includes(project.id))
    .slice(0, REFERENCE_PROJECT_LIMIT);

  if (!selectedProjects.length) {
    return {
      context: '',
      characterProfiles: '',
      storySummary: '',
      episodeContext: '',
      continuityNotes: '',
      projectNames: [] as string[],
    };
  }

  const worldBlocks: string[] = [];
  const profileBlocks: string[] = [];
  const summaryBlocks: string[] = [];
  const episodeBlocks: string[] = [];
  const noteBlocks: string[] = [];

  for (const project of selectedProjects) {
    if (project.worldContext.trim()) {
      worldBlocks.push(`[${project.project_name} · World Lore]\n${project.worldContext.trim()}`);
    }

    if (project.characterProfiles.trim()) {
      profileBlocks.push(`[${project.project_name} · Character Voices]\n${project.characterProfiles.trim()}`);
    }

    if (project.storySummary.trim()) {
      summaryBlocks.push(`[${project.project_name} · Story Bible]\n${project.storySummary.trim()}`);
    }

    const recentChapters = project.chapters
      .filter((chapter) => (chapter.result || chapter.content).trim())
      .slice(-REFERENCE_CHAPTER_LIMIT);

    for (const chapter of recentChapters) {
      episodeBlocks.push(
        `[${project.project_name} / ${chapter.name}]\n${limitText((chapter.result || chapter.content).trim(), 2600)}`
      );
    }

    noteBlocks.push(
      [
        `[${project.project_name}]`,
        project.storySummary.trim() && `최근 서사 요약:\n${limitText(project.storySummary.trim(), 1200)}`,
        project.characterProfiles.trim() && `말투 기준:\n${limitText(project.characterProfiles.trim(), 1000)}`,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return {
    context: limitText(worldBlocks.join('\n\n'), 4200),
    characterProfiles: limitText(profileBlocks.join('\n\n'), 4200),
    storySummary: limitText(summaryBlocks.join('\n\n'), 5200),
    episodeContext: limitText(episodeBlocks.join('\n\n---\n\n'), REFERENCE_TEXT_LIMIT),
    continuityNotes: limitText(noteBlocks.join('\n\n'), 5000),
    projectNames: selectedProjects.map((project) => project.project_name),
  };
}

export default function Home() {
  const { isLoaded: isAuthLoaded, userId } = useAuth();
  const isHydrated = useRef(false);
  
  // App States
  const [projectId, setProjectId] = useState(() => Date.now().toString());
  const [projectName, setProjectName] = useState('');
  const [projectList, setProjectList] = useState<ProjectSnapshot[]>([]);
  const [chapters, setChapters] = useState<ChapterEntry[]>([]);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number | null>(null);
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('ja');
  const [to, setTo] = useState('ko');
  const [provider, setProvider] = useState('openai');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  
  // UI States
  const [isZenMode, setIsZenMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState('glacial');
  const [isCatMode, setIsCatMode] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [translationMode, setTranslationMode] = useState<'novel' | 'general'>('novel');
  
  // Specialized Contexts
  const [worldContext, setWorldContext] = useState('');
  const [characterProfiles, setCharacterProfiles] = useState('');
  const [storySummary, setStorySummary] = useState('');
  const [styleAnalysis, setStyleAnalysis] = useState<any>(null);
  const [backResult, setBackResult] = useState('');
  const prevActiveChapterIndex = useRef<number | null>(activeChapterIndex);
  const storyBibleRequestCounter = useRef(0);

  useEffect(() => {
    const savedState = localStorage.getItem('eh_translator_ui_state');
    const savedProjectLibrary = localStorage.getItem(PROJECT_LIBRARY_KEY);
    if (!savedState) {
      if (savedProjectLibrary) {
        try {
          setProjectList(normalizeProjectSnapshots(JSON.parse(savedProjectLibrary)));
        } catch (error) {
          console.error('Failed to restore project library', error);
        }
      }
      isHydrated.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(savedState);
      const restoredProjects = normalizeProjectSnapshots(
        savedProjectLibrary ? JSON.parse(savedProjectLibrary) : parsed.projectList
      );
      if (parsed.projectId !== undefined) setProjectId(parsed.projectId);
      if (parsed.projectName !== undefined) setProjectName(parsed.projectName);
      if (restoredProjects.length) setProjectList(restoredProjects);
      if (parsed.chapters !== undefined && Array.isArray(parsed.chapters)) {
        setChapters(parsed.chapters.map((chapter: any, index: number) => normalizeChapter(chapter, `Part ${index + 1}`)));
      }
      if (parsed.activeChapterIndex !== undefined) setActiveChapterIndex(parsed.activeChapterIndex);
      if (parsed.source !== undefined) setSource(parsed.source);
      if (parsed.result !== undefined) setResult(parsed.result);
      if (parsed.from !== undefined) setFrom(parsed.from);
      if (parsed.to !== undefined) setTo(parsed.to);
      if (parsed.provider !== undefined) setProvider(parsed.provider);
      if (parsed.history !== undefined) setHistory(parsed.history);
      if (parsed.isZenMode !== undefined) setIsZenMode(parsed.isZenMode);
      if (parsed.backgroundMode !== undefined) setBackgroundMode(parsed.backgroundMode);
      if (parsed.isCatMode !== undefined) setIsCatMode(parsed.isCatMode);
      if (parsed.translationMode !== undefined) setTranslationMode(parsed.translationMode);
      if (parsed.worldContext !== undefined) setWorldContext(parsed.worldContext);
      if (parsed.characterProfiles !== undefined) setCharacterProfiles(parsed.characterProfiles);
      if (parsed.storySummary !== undefined) setStorySummary(parsed.storySummary);
      if (parsed.referenceIds !== undefined) setReferenceIds(parsed.referenceIds);
    } catch (error) {
      console.error('Failed to restore state', error);
    } finally {
      isHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isHydrated.current) return;

    const timeout = window.setTimeout(() => {
      localStorage.setItem('eh_translator_ui_state', JSON.stringify({
        projectId,
        projectName,
        chapters,
        activeChapterIndex,
        source,
        result,
        from,
        to,
        provider,
        history,
        isZenMode,
        backgroundMode,
        isCatMode,
        translationMode,
        worldContext,
        characterProfiles,
        storySummary,
        referenceIds,
      }));
      setLastSavedAt(Date.now());
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [projectId, projectName, chapters, activeChapterIndex, source, result, from, to, provider, history, isZenMode, backgroundMode, isCatMode, translationMode, worldContext, characterProfiles, storySummary, referenceIds]);

  useEffect(() => {
    if (!isHydrated.current) return;

    const timeout = window.setTimeout(() => {
      localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(projectList));
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [projectList]);

  // Sync current editor to chapters array to prevent data loss
  useEffect(() => {
    if (!isHydrated.current || activeChapterIndex === null) return;
    
    // 챕터가 전환되었을 경우, source가 갱신될 때까지 동기화를 1회 지연시킵니다. (Race Condition 방지)
    if (activeChapterIndex !== prevActiveChapterIndex.current) {
      prevActiveChapterIndex.current = activeChapterIndex;
      return;
    }

    const activeChapter = chapters[activeChapterIndex];
    if (!activeChapter) return;
    if (activeChapter.content === source && activeChapter.result === result) return;

    const timeout = window.setTimeout(() => {
      patchActiveChapter({ content: source, result });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [source, result, activeChapterIndex, chapters]);

  useEffect(() => {
    if (!isHydrated.current) return;

    const hasMeaningfulData =
      Boolean(projectName.trim()) ||
      Boolean(chapters.length) ||
      Boolean(worldContext.trim()) ||
      Boolean(characterProfiles.trim()) ||
      Boolean(storySummary.trim());

    if (!hasMeaningfulData) return;

    const snapshotBase = {
      id: projectId,
      project_name: projectName.trim() || `Project ${projectId.slice(-4)}`,
      chapters: chapters.map((chapter, index) => normalizeChapter(chapter, `Part ${index + 1}`)),
      worldContext,
      characterProfiles,
      storySummary,
      from,
      to,
    } satisfies Omit<ProjectSnapshot, 'updated_at'>;

    setProjectList(prev => {
      const existingIndex = prev.findIndex((project) => project.id === projectId);
      const nextFingerprint = projectFingerprint(snapshotBase);
      const existingFingerprint =
        existingIndex >= 0
          ? projectFingerprint({
              id: prev[existingIndex].id,
              project_name: prev[existingIndex].project_name,
              chapters: prev[existingIndex].chapters,
              worldContext: prev[existingIndex].worldContext,
              characterProfiles: prev[existingIndex].characterProfiles,
              storySummary: prev[existingIndex].storySummary,
              from: prev[existingIndex].from,
              to: prev[existingIndex].to,
            })
          : '';

      if (existingFingerprint === nextFingerprint) return prev;

      const nextSnapshot: ProjectSnapshot = {
        ...snapshotBase,
        updated_at: Date.now(),
      };

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = nextSnapshot;
        return next.sort((left, right) => right.updated_at - left.updated_at);
      }

      return [nextSnapshot, ...prev].slice(0, MAX_LOCAL_PROJECTS);
    });
  }, [projectId, projectName, chapters, worldContext, characterProfiles, storySummary, from, to]);

  useEffect(() => {
    if (!isHydrated.current) return;

    setReferenceIds((previous) =>
      previous.filter((referenceId) => referenceId !== projectId && projectList.some((project) => project.id === referenceId))
    );
  }, [projectId, projectList]);

  useEffect(() => {
    if (!isHydrated.current || !isAuthLoaded || !userId || !supabaseUrl || !supabaseAnonKey) return;

    let cancelled = false;

    const loadCloudProjects = async () => {
      try {
        const metadata = await listUserProjects(userId);
        if (!metadata.length || cancelled) return;

        const loadedProjects = await Promise.all(
          metadata.slice(0, MAX_LOCAL_PROJECTS).map(async (projectMeta: any) => {
            const projectData = await loadProjectFromCloud(userId, projectMeta.id);
            if (!projectData) return null;

            const normalized = normalizeProjectSnapshots([
              {
                id: projectMeta.id,
                project_name: projectMeta.projectName,
                updated_at: projectMeta.updatedAt ? Date.parse(projectMeta.updatedAt) : Date.now(),
                ...projectData,
              },
            ]);

            return normalized[0] || null;
          })
        );

        if (cancelled) return;

        const availableProjects = loadedProjects.filter((project): project is ProjectSnapshot => Boolean(project));
        if (!availableProjects.length) return;

        setProjectList((previous) => mergeProjectSnapshots(previous, availableProjects));
      } catch (error) {
        console.error('Failed to load cloud projects', error);
      }
    };

    loadCloudProjects();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoaded, userId]);

  useEffect(() => {
    if (!isHydrated.current || !isAuthLoaded || !userId || !supabaseUrl || !supabaseAnonKey) return;

    const hasMeaningfulData =
      Boolean(projectName.trim()) ||
      Boolean(chapters.length) ||
      Boolean(worldContext.trim()) ||
      Boolean(characterProfiles.trim()) ||
      Boolean(storySummary.trim());

    if (!hasMeaningfulData) return;

    const timeout = window.setTimeout(async () => {
      try {
        await saveProjectToCloud(userId, projectId, {
          projectId,
          projectName,
          chapters,
          activeChapterIndex,
          source,
          result,
          from,
          to,
          worldContext,
          characterProfiles,
          storySummary,
          referenceIds,
          translationMode,
        });
      } catch (error) {
        console.error('Failed to save project to cloud', error);
      }
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [
    isAuthLoaded,
    userId,
    projectId,
    projectName,
    chapters,
    activeChapterIndex,
    source,
    result,
    from,
    to,
    worldContext,
    characterProfiles,
    storySummary,
    referenceIds,
    translationMode,
  ]);

  const requestTranslation = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
      }

      throw new Error((await res.text()) || '요청 처리 중 오류가 발생했습니다.');
    }

    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data.result || '';
    }

    return res.text();
  };

  const patchChapterAtIndex = (index: number, patch: Record<string, unknown>) => {
    setChapters((previous) => {
      if (!previous[index]) return previous;

      const currentChapter = previous[index];
      const currentChapterRecord = currentChapter as Record<string, unknown>;
      const shouldUpdate = Object.entries(patch).some(([key, value]) => currentChapterRecord[key] !== value);
      if (!shouldUpdate) return previous;

      const next = [...previous];
      next[index] = { ...currentChapter, ...patch };
      return next;
    });
  };

  const patchActiveChapter = (patch: Record<string, unknown>) => {
    if (activeChapterIndex === null) return;
    patchChapterAtIndex(activeChapterIndex, patch);
  };

  const openChapter = (index: number | null, chapterList = chapters) => {
    if (index === null) {
      startTransition(() => {
        setActiveChapterIndex(null);
        setSource('');
        setResult('');
      });
      return;
    }

    const chapter = chapterList[index];
    if (!chapter) return;

    startTransition(() => {
      setActiveChapterIndex(index);
      setSource(chapter.content || '');
      setResult(chapter.result || '');
    });
  };

  const referenceBundle = buildReferenceBundle(referenceIds, projectList, projectId);

  const buildEpisodeContext = (chapterIndex = activeChapterIndex) => {
    const continuityBlocks: string[] = [];

    if (chapterIndex !== null && chapterIndex > 0 && chapters[chapterIndex - 1]) {
      const previousChapter = chapters[chapterIndex - 1];
      const previousChapterText = (previousChapter.result || previousChapter.content).trim();

      if (previousChapterText) {
        continuityBlocks.push(
          `[현재 프로젝트 이전 화 / ${previousChapter.name}]\n${limitText(previousChapterText, 5000)}`
        );
      }
    }

    if (referenceBundle.episodeContext) {
      continuityBlocks.push(referenceBundle.episodeContext);
    }

    return limitText(continuityBlocks.join('\n\n---\n\n'), REFERENCE_TEXT_LIMIT);
  };

  const buildContinuityBundle = (storySummaryBase = storySummary, chapterIndex = activeChapterIndex) => ({
    context: limitText([worldContext.trim(), referenceBundle.context].filter(Boolean).join('\n\n'), 6500),
    characterProfiles: limitText(
      [characterProfiles.trim(), referenceBundle.characterProfiles].filter(Boolean).join('\n\n'),
      6500
    ),
    storySummary: limitText(
      [storySummaryBase.trim(), referenceBundle.storySummary].filter(Boolean).join('\n\n'),
      STORY_BIBLE_LIMIT
    ),
    continuityNotes: referenceBundle.continuityNotes,
    episodeContext: buildEpisodeContext(chapterIndex),
  });

  const buildTranslationPayload = (
    payload: Record<string, unknown>,
    options?: { storySummaryBase?: string; chapterIndex?: number | null }
  ) => {
    const continuity = buildContinuityBundle(options?.storySummaryBase, options?.chapterIndex ?? activeChapterIndex);

    return {
      tone: 'natural',
      genre: translationMode === 'novel' ? 'Novel' : 'General',
      context: continuity.context,
      characterProfiles: continuity.characterProfiles,
      storySummary: continuity.storySummary,
      continuityNotes: continuity.continuityNotes,
      episodeContext: continuity.episodeContext,
      referenceIds,
      ...payload,
    };
  };

  const updateStoryBibleAfterTranslation = async (options: {
    translatedText: string;
    chapterName: string;
    chapterIndex?: number | null;
    storySummaryBase?: string;
  }) => {
    const { translatedText, chapterName, chapterIndex = activeChapterIndex, storySummaryBase = storySummary } = options;

    if (translationMode !== 'novel' || !translatedText.trim()) {
      return storySummaryBase;
    }

    const summaryProvider =
      (apiKeys.gemini && 'gemini') ||
      (apiKeys.openai && 'openai') ||
      (apiKeys.claude && 'claude') ||
      provider;

    const requestId = ++storyBibleRequestCounter.current;
    setStatusMsg('UPDATING STORY BIBLE');

    try {
      const summary = await requestTranslation(
        buildTranslationPayload(
          {
            text: `[${chapterName}]\n\n${translatedText}`,
            from: to,
            to,
            provider: summaryProvider,
            apiKey: apiKeys[summaryProvider] || '',
            stage: 10,
            mode: 'novel',
          },
          { storySummaryBase, chapterIndex }
        )
      );

      const mergedStoryBible = mergeStoryBible(storySummaryBase, summary);

      if (storyBibleRequestCounter.current === requestId) {
        setStorySummary(mergedStoryBible);
      }

      if (chapterIndex !== null && typeof chapterIndex === 'number') {
        patchChapterAtIndex(chapterIndex, { storyNote: summary.trim() });
      }

      return mergedStoryBible;
    } catch (error) {
      console.error('Story Bible update failed:', error);
      return storySummaryBase;
    }
  };

  // Core Actions
  const translate = async () => {
    if (!source.trim()) return;
    setLoading(true);
    setStatusMsg('FAST DRAFT');
    try {
      const translated = await requestTranslation(
        buildTranslationPayload({
          text: source,
          from,
          to,
          provider,
          apiKey: apiKeys[provider] || '',
          mode: translationMode,
        })
      );
      setResult(translated);
      patchActiveChapter({ result: translated, isDone: true, stageProgress: 5 });
      const mergedStoryBible = await updateStoryBibleAfterTranslation({
        translatedText: translated,
        chapterName: activeChapter?.name || 'Current Chapter',
      });
      setHistory((prev) => [{ source, result: translated, time: Date.now(), from, to }, ...prev.slice(0, 19)]);
      if (translationMode === 'novel' && mergedStoryBible !== storySummary) {
        setStatusMsg('STORY BIBLE UPDATED');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '번역 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const deepTranslate = async () => {
    if (!source.trim()) return;
    setLoading(true);
    const stageSequence = translationMode === 'novel'
      ? [
          { stage: 1, label: 'FIRST DRAFT', providerId: apiKeys.gemini ? 'gemini' : provider },
          { stage: 2, label: 'LORE ALIGN', providerId: apiKeys.deepseek ? 'deepseek' : provider },
          { stage: 3, label: 'PROSE SHAPE', providerId: apiKeys.claude ? 'claude' : provider },
          { stage: 4, label: 'NATIVE RESONANCE', providerId: apiKeys.openai ? 'openai' : provider },
          { stage: 5, label: 'FINAL POLISH', providerId: apiKeys.claude ? 'claude' : provider },
        ]
      : [
          { stage: 1, label: 'STRUCTURAL ANALYSIS', providerId: provider },
          { stage: 5, label: 'FINAL ACCURACY', providerId: provider },
        ];
    try {
      let currentResult = source;
      for (const item of stageSequence) {
        setStatusMsg(item.label);
        currentResult = await requestTranslation(
          buildTranslationPayload({
            text: item.stage === 1 ? source : currentResult,
            sourceText: source,
            stage: item.stage,
            from,
            to,
            provider: item.providerId,
            apiKey: apiKeys[item.providerId] || '',
            mode: translationMode,
          })
        );
        setResult(currentResult);
        patchActiveChapter({
          result: currentResult,
          stageProgress: item.stage,
          isDone: item.stage === 5,
        });
      }
      const mergedStoryBible = await updateStoryBibleAfterTranslation({
        translatedText: currentResult,
        chapterName: activeChapter?.name || 'Current Chapter',
      });
      setHistory((prev) => [{ source, result: currentResult, time: Date.now(), from, to }, ...prev.slice(0, 19)]);
      if (translationMode === 'novel' && mergedStoryBible !== storySummary) {
        setStatusMsg('STORY BIBLE UPDATED');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Deep Pipeline 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const importUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    setStatusMsg('FETCHING URL');
    try {
      const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(urlInput)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'URL 읽기 오류');
      }
      if (data.text) {
        const parsedUrl = new URL(urlInput);
        const rawSlug = decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || parsedUrl.hostname);
        const chapterName = rawSlug
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() || `Web Episode ${chapters.length + 1}`;
        const importedChapter = normalizeChapter({
          name: chapterName,
          content: data.text,
          result: '',
          isDone: false,
          stageProgress: 0,
          storyNote: '',
        }, chapterName);

        if (activeChapterIndex !== null && chapters[activeChapterIndex] && !chapters[activeChapterIndex].content.trim()) {
          patchActiveChapter({
            name: importedChapter.name,
            content: importedChapter.content,
            result: '',
            isDone: false,
            stageProgress: 0,
          });
          setSource(importedChapter.content);
          setResult('');
        } else {
          const newIndex = Math.min(chapters.length, 29);
          setChapters((prev) => [...prev, importedChapter].slice(0, 30));
          openChapter(newIndex, [...chapters, importedChapter].slice(0, 30));
        }

        setShowUrlImport(false);
        setUrlInput('');
      } else {
        alert('내용을 가져오지 못했습니다.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'URL 읽기 오류');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const analyzeStyle = () => {
    if (!source.trim()) return;

    const quoteCount = (source.match(/[“"'「『]/g) || []).length;
    const longSentenceCount = source
      .split(/[.!?。！？]/)
      .filter((line) => line.trim().length > 90).length;

    setStyleAnalysis({
      genre: /마법|검|왕국|황제|용/i.test(source) ? '판타지' : /보고서|가이드|정책/i.test(source) ? '정보형' : '서사형',
      tone: quoteCount >= 6 ? '대사 중심' : longSentenceCount >= 3 ? '문장 밀도 높음' : '균형형',
      metric: {
        fluency: `${Math.min(96, 72 + longSentenceCount * 4)}%`,
        immersion: `${Math.min(95, 68 + quoteCount * 3)}%`,
      },
    });
  };

  const exportData = () => {
    if (!confirm('현재 프로젝트의 핵심 번역 데이터만 JSON 파일로 추출하시겠습니까?\n보안상 API 키와 참조 프로젝트 원문은 포함되지 않습니다.')) return;
    const blob = new Blob([JSON.stringify({
      projectName,
      chapters,
      projectLibrary: toProjectMeta(projectList),
      activeChapterIndex,
      referenceIds,
      source,
      result,
      from,
      to,
      provider,
      history,
      worldContext,
      characterProfiles,
      storySummary,
      backgroundMode,
      isZenMode,
      isCatMode,
      translationMode,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eh-translator-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('새 프로젝트 파일을 불러오시겠습니까?\n현재 작업 중인 모든 데이터가 덮어씌워집니다. 이 작업은 되돌릴 수 없습니다.')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        startTransition(() => {
          if (parsed.projectName !== undefined) setProjectName(parsed.projectName);
          if (parsed.chapters !== undefined && Array.isArray(parsed.chapters)) {
            setChapters(parsed.chapters.map((chapter: any, index: number) => normalizeChapter(chapter, `Part ${index + 1}`)));
          }
          if (parsed.projectList !== undefined) setProjectList(normalizeProjectSnapshots(parsed.projectList));
          if (parsed.projectLibrary !== undefined) setProjectList(normalizeProjectSnapshots(parsed.projectLibrary));
          if (parsed.activeChapterIndex !== undefined) setActiveChapterIndex(parsed.activeChapterIndex);
          if (parsed.source !== undefined) setSource(parsed.source);
          if (parsed.result !== undefined) setResult(parsed.result);
          if (parsed.from !== undefined) setFrom(parsed.from);
          if (parsed.to !== undefined) setTo(parsed.to);
          if (parsed.provider !== undefined) setProvider(parsed.provider);
          if (parsed.history !== undefined) setHistory(parsed.history);
          if (parsed.worldContext !== undefined) setWorldContext(parsed.worldContext);
          if (parsed.characterProfiles !== undefined) setCharacterProfiles(parsed.characterProfiles);
          if (parsed.storySummary !== undefined) setStorySummary(parsed.storySummary);
          if (parsed.referenceIds !== undefined) setReferenceIds(Array.isArray(parsed.referenceIds) ? parsed.referenceIds : []);
          if (parsed.backgroundMode !== undefined) setBackgroundMode(parsed.backgroundMode);
          if (parsed.isZenMode !== undefined) setIsZenMode(parsed.isZenMode);
          if (parsed.isCatMode !== undefined) setIsCatMode(parsed.isCatMode);
          if (parsed.translationMode !== undefined) setTranslationMode(parsed.translationMode);
        });
      } catch {
        alert('JSON 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    if (!confirm(`${files.length}개의 문서를 현재 프로젝트 챕터 목록에 추가하시겠습니까?`)) {
      event.target.value = '';
      return;
    }

    setLoading(true);
    setStatusMsg('IMPORTING FILES');
    try {
      const newChapters: any[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `${file.name} 파싱 실패`);

        const parsedChapters = Array.isArray(data.chapters) ? data.chapters : [];
        if (!parsedChapters.length) {
          throw new Error(`${file.name}에서 가져올 본문을 찾지 못했습니다.`);
        }

        const useBareFileName =
          parsedChapters.length === 1 &&
          typeof parsedChapters[0]?.title === 'string' &&
          /^split part \d+$/i.test(parsedChapters[0].title.trim());

        for (const chapter of parsedChapters) {
          const chapterTitle =
            typeof chapter?.title === 'string' && chapter.title.trim()
              ? chapter.title.trim()
              : 'Imported Part';

          newChapters.push({
            name: useBareFileName ? file.name : `${file.name} - ${chapterTitle}`,
            content: typeof chapter?.content === 'string' ? chapter.content : '',
            result: '',
            isDone: false,
            stageProgress: 0,
            storyNote: '',
          });
        }
      }

      if (newChapters.length) {
        const nextIndex = Math.min(chapters.length, 29);
        startTransition(() => {
          setChapters((prev) => [...prev, ...newChapters].slice(0, 30));
          setActiveChapterIndex(nextIndex);
          setSource(newChapters[0].content || '');
          setResult('');
        });
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '문서 가져오기 실패');
    } finally {
      setLoading(false);
      setStatusMsg('');
      event.target.value = '';
    }
  };

  const batchTranslateAll = async () => {
    if (!chapters.length) return;
    if (!confirm(`${chapters.length}개 챕터를 순차 번역할까요?`)) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    let rollingStorySummary = storySummary;
    try {
      for (let index = 0; index < chapters.length; index += 1) {
        const chapter = chapters[index];
        if (chapter.isDone && !confirm(`${chapter.name}은(는) 이미 완료되었습니다. 재번역할까요?`)) continue;
        
        openChapter(index);
        setStatusMsg(`BATCH ${index + 1}/${chapters.length}`);
        
        try {
          const translated = await requestTranslation(
            buildTranslationPayload(
              {
                text: chapter.content,
                from,
                to,
                provider,
                apiKey: apiKeys[provider] || '',
                mode: translationMode,
              },
              { storySummaryBase: rollingStorySummary, chapterIndex: index }
            )
          );
          setResult(translated);
          patchChapterAtIndex(index, { result: translated, isDone: true, stageProgress: 5 });

          if (translationMode === 'novel') {
            rollingStorySummary = await updateStoryBibleAfterTranslation({
              translatedText: translated,
              chapterName: chapter.name,
              chapterIndex: index,
              storySummaryBase: rollingStorySummary,
            });
          }

          successCount++;
        } catch (err: any) {
          console.error(`Batch error at idx ${index}:`, err);
          patchChapterAtIndex(index, { error: err.message || 'Error' });
          failCount++;
        }
      }
      alert(`일괄 번역 종료: 성공 ${successCount}, 실패 ${failCount}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '일괄 작업 중 치명적 오류 발생');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const [showExportOptions, setShowExportOptions] = useState(false);

  const downloadAllResults = (format: 'txt' | 'md' | 'json' | 'html' | 'csv' = 'md') => {
    if (!chapters.length) return;

    let content = '';
    let mimeType = 'text/plain';

    if (format === 'md') {
      content = chapters.map((chapter: any) => `# ${chapter.name}\n\n${chapter.result || '(미번역)'}`).join('\n\n---\n\n');
      mimeType = 'text/markdown';
    } else if (format === 'txt') {
      content = chapters.map((chapter: any) => `[ ${chapter.name} ]\n\n${chapter.result || '(미번역)'}`).join('\n\n====================\n\n');
      mimeType = 'text/plain';
    } else if (format === 'json') {
      content = JSON.stringify(chapters.map((c: any) => ({ title: c.name, content: c.result || '' })), null, 2);
      mimeType = 'application/json';
    } else if (format === 'html') {
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Translation Results</title></head><body style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif;">` + 
        chapters.map((c: any) => `<h2>${c.name}</h2><p>${(c.result || '').replace(/\\n/g, '<br>')}</p>`).join('<hr>') + 
        `</body></html>`;
      mimeType = 'text/html';
    } else if (format === 'csv') {
      content = '\\uFEFF"Chapter","Content"\\n' + chapters.map((c: any) => `"${c.name.replace(/"/g, '""')}","${(c.result || '').replace(/"/g, '""')}"`).join('\\n');
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eh-translator-results-${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportOptions(false);
  };

  const refineResult = async () => {
    if (!result.trim()) return;

    setLoading(true);
    setStatusMsg('FINAL POLISH');
    try {
      const refined = await requestTranslation(
        buildTranslationPayload({
          text: result,
          sourceText: source,
          stage: 5,
          from,
          to,
          provider: apiKeys.claude ? 'claude' : provider,
          apiKey: apiKeys.claude || apiKeys[provider] || '',
          mode: translationMode,
        })
      );
      setResult(refined);
      patchActiveChapter({ result: refined, isDone: true, stageProgress: 5 });
    } catch (error) {
      alert(error instanceof Error ? error.message : '다듬기 실패');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const backTranslate = async () => {
    if (!result.trim()) return;

    setLoading(true);
    setStatusMsg('BACK CHECK');
    try {
      const reversed = await requestTranslation({
        text: result,
        from: to,
        to: from,
        provider,
        apiKey: apiKeys[provider] || '',
        mode: 'general',
      });
      setBackResult(reversed);
    } catch (error) {
      alert(error instanceof Error ? error.message : '역번역 검사 실패');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const headerTextColor = backgroundMode === 'glacial' ? '#0f172a' : '#f8fafc';
  const headerMutedColor = backgroundMode === 'glacial' ? '#64748b' : '#cbd5e1';
  const headerChipSurface = backgroundMode === 'glacial' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.06)';
  const accentTextColor = backgroundMode === 'glacial' ? '#2563eb' : '#93c5fd';
  const activeChapter = activeChapterIndex !== null ? chapters[activeChapterIndex] : null;
  const completedChapters = chapters.filter((chapter: any) => chapter.isDone).length;
  const completionRate = chapters.length ? Math.round((completedChapters / chapters.length) * 100) : 0;
  const workspaceName = projectName.trim() || 'Untitled Narrative Workspace';
  const providerLabel = PROVIDERS.find((item) => item.id === provider)?.label || provider.toUpperCase();
  const autoSaveLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '준비 완료';
  const atmosphereLabel = backgroundMode === 'glacial' ? 'Editorial White' : 'Nebula Depth';
  const pipelineLabel = translationMode === 'novel' ? 'Narrative Pipeline' : 'Auxiliary General';
  const cloudSyncEnabled = Boolean(isAuthLoaded && userId && supabaseUrl && supabaseAnonKey);
  const referenceStatusLabel = referenceBundle.projectNames.length
    ? `참조 중: ${referenceBundle.projectNames.join(', ')}`
    : '참조 프로젝트 없음';
  const storyBibleStatusLabel = storySummary.trim()
    ? `Story Bible 누적 ${storySummary.split('\n---\n').length}블록`
    : 'Story Bible 아직 비어 있음';

  return (
    <div className={`min-h-screen theme-${backgroundMode} font-body ${isZenMode ? 'zen-mode' : ''}`}>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-20 items-center justify-between px-4 lg:px-6 glass-panel border-t-0 border-x-0 rounded-none">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-indigo-500 text-sm font-black text-white shadow-lg shadow-blue-500/20">
            EH
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: headerMutedColor }}>Narrative Translation Engine</div>
            <h1 className="truncate text-xl font-black tracking-tight" style={{ color: headerTextColor }}>
              EH Translator <span className="ml-2 text-[11px] font-medium" style={{ color: headerMutedColor }}>final</span>
            </h1>
          </div>
          <div className="hidden lg:flex items-center gap-2 rounded-full px-3 py-2 backdrop-blur-xl" style={{ background: headerChipSurface }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: headerMutedColor }}>Plan</span>
            <span className="text-xs font-bold" style={{ color: accentTextColor }}>Personal</span>
          </div>
          {activeChapter && (
            <div className="hidden md:flex items-center gap-3 rounded-full px-4 py-2 backdrop-blur-xl" style={{ background: headerChipSurface }}>
               <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
               <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-tight" style={{ color: headerTextColor }}>{activeChapter.name}</span>
                 <span className="text-[8px] opacity-60 font-bold" style={{ color: headerMutedColor }}>SAVED {autoSaveLabel}</span>
               </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden lg:flex items-center gap-1 rounded-full p-1 shadow-sm backdrop-blur-xl" style={{ background: headerChipSurface }}>
            {BACKGROUND_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setBackgroundMode(mode.id)}
                className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
                  backgroundMode === mode.id
                    ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'hover:brightness-110'
                }`}
                style={backgroundMode === mode.id ? undefined : { color: headerMutedColor }}
                title={mode.note}
              >
                {mode.id === 'glacial' ? 'White' : 'Nebula'}
              </button>
            ))}
          </div>
          {isAuthLoaded && !userId && (
            <SignInButton mode="modal">
              <button className="rounded-full bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110">
                시작하기
              </button>
            </SignInButton>
          )}
          {isAuthLoaded && userId && (
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'shadow-lg w-9 h-9' } }} />
          )}

          <button 
            onClick={() => setIsZenMode(!isZenMode)}
            className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              isZenMode
                ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                : 'backdrop-blur-xl hover:brightness-110'
            }`}
            style={isZenMode ? undefined : { background: headerChipSurface, color: headerMutedColor }}
          >
            {isZenMode ? 'Focus On' : 'Focus Mode'}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} 
            className="rounded-full p-2.5 backdrop-blur-xl transition-all hover:brightness-110"
            style={{ background: headerChipSurface, color: headerMutedColor }}>
            ⚙️
          </button>
        </div>
      </header>

      <main className="flex h-[calc(100vh-80px)] overflow-hidden pt-20">
        {/* Left Sidebar: Chapters */}
        {!isZenMode && (
          <aside className="w-64 border-r border-gray-900/50 bg-sidebar overflow-y-auto p-4 hidden lg:block glass-panel border-y-0 border-l-0 rounded-none">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="theme-kicker">Chapters</h3>
                  <label className="theme-pill cursor-pointer rounded-xl px-3 py-2 text-[10px] font-bold transition-colors hover:brightness-105" title="지원 형식: txt, md, epub, pdf, docx">
                    <span className="text-[10px]">➕ 문서 읽어오기</span>
                    <input type="file" multiple onChange={importDocument} className="hidden" accept=".txt,.md,.epub,.pdf,.docx" />
                  </label>
                </div>
                <div className="text-[8px] opacity-60 text-right uppercase tracking-widest mt-1">
                  5개 대표형식 (TXT, MD, EPUB, PDF, DOCX)
                </div>
              </div>
            </div>

            {chapters.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex gap-2">
                  <button onClick={batchTranslateAll} disabled={loading} className="flex-1 rounded-xl bg-linear-to-r from-blue-600/80 to-indigo-600/80 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white transition-all hover:brightness-110">
                    ALL BATCH
                  </button>
                  <button onClick={() => setShowExportOptions(!showExportOptions)} className="theme-pill flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:brightness-105">
                    EXPORT (5형식)
                  </button>
                </div>
                {showExportOptions && (
                  <div className="grid grid-cols-5 gap-1 animate-in fade-in slide-in-from-top-2">
                    {['txt', 'md', 'json', 'html', 'csv'].map((fmt) => (
                      <button key={fmt} onClick={() => downloadAllResults(fmt as any)} className="theme-pill text-[8px] py-1.5 rounded-lg font-bold uppercase hover:bg-white/10 transition-colors">
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
                  onClick={() => openChapter(idx)}
                  className={`chapter-item group flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all ${activeChapterIndex === idx ? 'chapter-item-active' : ''}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={`chapter-index rounded px-1 text-[9px] font-mono ${ch.isDone ? 'chapter-index-done' : 'opacity-70'}`}>
                      {ch.isDone ? '✓' : (idx + 1)}
                    </span>
                    <span className="truncate text-xs font-medium">{ch.name}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextChapters = chapters.filter((_: any, chapterIndex: number) => chapterIndex !== idx);
                      setChapters(nextChapters);

                      if (activeChapterIndex === idx) {
                        const fallbackIndex = nextChapters.length ? Math.min(idx, nextChapters.length - 1) : null;
                        openChapter(fallbackIndex, nextChapters);
                        return;
                      }

                      if (activeChapterIndex !== null && activeChapterIndex > idx) {
                        setActiveChapterIndex(activeChapterIndex - 1);
                      }
                    }}
                    className="theme-text-secondary p-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  >✕</button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center: Editor Area */}
        <section className={`flex-1 overflow-y-auto px-6 pb-20 transition-all ${isZenMode ? 'max-w-5xl mx-auto' : ''}`}>
          {!isZenMode && (
            <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.75fr)_minmax(240px,0.8fr)]">
              <div className="workspace-hero glass-panel rounded-4xl p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="theme-kicker">Premium Narrative Workspace</div>
                    <h2 className="mt-3 truncate text-2xl font-black tracking-tight theme-text-primary">{workspaceName}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed theme-text-secondary">
                      장편 번역에서 문체 일관성, 캐릭터 보존, 빠른 편집 흐름을 함께 잡는 에디토리얼 작업실입니다.
                    </p>
                  </div>
                  <div className="theme-pill shrink-0 rounded-3xl px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] theme-text-secondary">{atmosphereLabel}</div>
                    <div className="mt-1 text-sm font-bold theme-text-primary">{pipelineLabel}</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <div className="theme-pill rounded-full px-3 py-2 text-[11px] font-semibold">
                    {from.toUpperCase()} → {to.toUpperCase()}
                  </div>
                  <div className="theme-pill rounded-full px-3 py-2 text-[11px] font-semibold">{providerLabel}</div>
                  <div className="theme-pill rounded-full px-3 py-2 text-[11px] font-semibold">
                    {chapters.length ? `${chapters.length}개 챕터 관리 중` : '문서를 불러오면 챕터가 여기에 쌓입니다.'}
                  </div>
                  <div className="theme-pill rounded-full px-3 py-2 text-[11px] font-semibold">{referenceStatusLabel}</div>
                  <div className="theme-pill rounded-full px-3 py-2 text-[11px] font-semibold">
                    {cloudSyncEnabled ? 'Cloud Sync 활성' : '로컬 작업 모드'}
                  </div>
                </div>
              </div>

              <div className="metric-card glass-panel rounded-4xl p-5">
                <div className="theme-kicker">Autosave</div>
                <div className="mt-3 text-3xl font-black tracking-tight theme-text-primary">{autoSaveLabel}</div>
                <p className="mt-3 text-sm leading-relaxed theme-text-secondary">
                  {loading ? `${statusMsg || 'PROCESSING'} 단계가 진행 중입니다.` : '자동 저장을 지연 처리해서 타이핑과 이동이 더 가볍게 유지됩니다.'}
                </p>
                <div className={`mt-4 rounded-2xl px-3 py-3 text-[11px] font-semibold ${loading ? 'loading-ribbon' : 'theme-pill'}`}>
                  {loading ? '엔진이 결과를 정리하는 중입니다.' : '변경 내용은 조용히 로컬 상태와 동기화됩니다.'}
                </div>
              </div>

              <div className="metric-card glass-panel rounded-4xl p-5">
                <div className="theme-kicker">Progress</div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-black tracking-tight theme-text-primary">{completionRate}%</span>
                  <span className="pb-1 text-[11px] font-semibold theme-text-secondary">{completedChapters}/{chapters.length || 0} ready</span>
                </div>
                <div className="metric-bar mt-4">
                  <span style={{ width: `${completionRate}%` }} />
                </div>
                <p className="mt-3 text-sm leading-relaxed theme-text-secondary">
                  {activeChapter
                    ? `${activeChapter.name}${activeChapter.stageProgress ? ` · Stage ${activeChapter.stageProgress}` : ''}`
                    : '활성 챕터를 선택하면 진행 단계가 여기 표시됩니다.'}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed theme-text-secondary">{storyBibleStatusLabel}</p>
              </div>
            </div>
          )}

          {/* Style Analysis Result (Compact) */}
          {styleAnalysis && !isZenMode && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
               <div className="themed-insight glass-panel flex items-center justify-between gap-5 rounded-4xl p-5">
                 <div>
                    <h4 className="theme-kicker mb-2">AI Style Feedback</h4>
                    <p className="text-sm font-medium theme-text-primary">
                      이 글은 <span style={{ color: accentTextColor }}>{styleAnalysis.genre}</span> 장르의{' '}
                      <span style={{ color: accentTextColor }}>{styleAnalysis.tone}</span> 톤을 가지고 있습니다.
                    </p>
                 </div>
                 <div className="flex gap-2">
                    <div className="border-r px-3 text-center border-white/10">
                      <div className="text-[9px] uppercase theme-text-secondary">Fluency</div>
                      <div className="text-xs font-bold theme-text-primary">{styleAnalysis.metric.fluency}</div>
                    </div>
                    <div className="text-center px-3">
                      <div className="text-[9px] uppercase theme-text-secondary">Immersive</div>
                      <div className="text-xs font-bold theme-text-primary">{styleAnalysis.metric.immersion}</div>
                    </div>
                 </div>
               </div>
            </div>
          )}

          {/* Settings Overlay */}
          {showSettings && (
            <div className="mb-6 p-6 rounded-5xl glass-panel shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-3 p-5 bg-purple-500/5 rounded-2xl border border-purple-500/10 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="theme-kicker mb-3 block">Visual Atmosphere (테마)</label>
                      <div className="flex gap-3">
                        {BACKGROUND_MODES.map((m) => (
                          <button key={m.id} onClick={() => setBackgroundMode(m.id)}
                            className={`flex-1 rounded-xl border p-3 text-left transition-all ${backgroundMode === m.id ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'theme-pill hover:brightness-105'}`}>
                            <div className="text-[10px] font-black uppercase tracking-tight">{m.label}</div>
                            <div className="text-[8px] opacity-70 mt-0.5">{m.note}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="theme-kicker mb-3 block">현재 프로젝트 (볼륨 30화 제한)</label>
                      <div className="flex gap-2 items-center">
                        <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} 
                          placeholder="프로젝트명" className="theme-field flex-1 rounded-lg px-3 py-2 text-xs outline-none" />
                        <button onClick={() => { if(confirm('초기화 하시겠습니까?')) { setProjectId(Date.now().toString()); setProjectName(''); setChapters([]); setSource(''); setResult(''); setStorySummary(''); setWorldContext(''); setCharacterProfiles(''); setReferenceIds([]); } }}
                          className="rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-3 py-2 text-[10px] font-bold text-white transition-all hover:brightness-110">신규 생성</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="theme-kicker mb-2 block">이전 프로젝트 참조 (Cross-Reference)</label>
                    <div className="flex flex-wrap gap-2 text-white">
                       {projectList.filter((p:any) => p.id !== projectId).map((p:any) => (
                          <button key={p.id} onClick={() => setReferenceIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                             className={`rounded-full border px-3 py-1 text-[10px] transition-all ${referenceIds.includes(p.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'theme-pill hover:brightness-105'}`}>
                             {p.project_name || p.id.slice(0,4)}
                          </button>
                       ))}
                    </div>
                    {projectList.filter((project) => project.id !== projectId).length === 0 && (
                      <p className="mt-2 text-[11px] theme-text-secondary">아직 저장된 다른 프로젝트가 없습니다. 프로젝트명을 붙이고 작업하면 자동으로 참조 목록에 쌓입니다.</p>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <label className="theme-kicker mb-2 block">Ensemble API Keys</label>
                  <div className="space-y-2">
                    {PROVIDERS.map(p => (
                      <div key={p.id} className="flex gap-2 items-center">
                        <span className="theme-text-secondary w-24 text-[9px] uppercase">{p.label}</span>
                        <input type="password" value={apiKeys[p.id] || ''} onChange={(e) => setApiKeys({...apiKeys, [p.id]: e.target.value})} 
                          className="theme-field flex-1 rounded-lg px-3 py-2 text-xs outline-none" placeholder={p.role} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                   <label className="theme-kicker block">Settings</label>
                   <select value={provider} onChange={(e) => setProvider(e.target.value)} className="theme-field w-full rounded-lg px-3 py-2 text-xs outline-none">
                      {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                   </select>
                   <div className="flex gap-2">
                      <button onClick={exportData} className="theme-pill flex-1 rounded-lg py-2 text-[9px] font-bold hover:brightness-105">EXTRACT</button>
                      <label className="theme-pill flex-1 cursor-pointer rounded-lg py-2 text-center text-[9px] font-bold hover:brightness-105">INJECT<input type="file" onChange={importData} className="hidden" /></label>
                   </div>
                </div>
              </div>
            </div>
          )}

         {isCatMode ? (
            <div className="col-span-1 lg:col-span-2 space-y-3 h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
              {source.split('\n').map((sLine, idx) => {
                 const rLines = result.split('\n');
                 const rLine = rLines[idx] || '';
                 if(!sLine.trim() && !rLine.trim()) return null;
                 return (
                   <div key={idx} className="flex flex-col md:flex-row gap-2 glass-panel p-4 rounded-3xl animate-fade-in">
                  <textarea value={sLine} readOnly className="editor-pane w-full resize-none bg-transparent text-xs leading-relaxed outline-none" />
                     <textarea value={rLine} readOnly className="result-pane w-full bg-transparent text-xs font-bold resize-none outline-none leading-relaxed" />
                   </div>
                 )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <select value={from} onChange={(e) => setFrom(e.target.value)} className="theme-pill rounded-full px-3 py-2 text-xs font-bold outline-none">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                  <span className="theme-text-secondary">→</span>
                  <select value={to} onChange={(e) => setTo(e.target.value)} className="theme-pill rounded-full px-3 py-2 text-xs font-bold outline-none" style={{ color: accentTextColor }}>
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <textarea value={source} onChange={(e) => setSource(e.target.value)} placeholder="원고 입력..."
                    className="editor-pane w-full h-[65vh] glass-panel rounded-4xl p-8 text-sm leading-loose resize-none outline-none transition-all scrollbar-hide font-headline focus:ring-2 focus:ring-blue-500/20" />
                  <div className="theme-text-secondary absolute bottom-4 right-6 text-[9px] font-mono">{source.length} chars</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-7 mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentTextColor }}>Result Draft</span>
                </div>
                <div className="relative">
                  <textarea value={result} readOnly className="result-pane w-full h-[65vh] glass-panel rounded-4xl p-8 text-sm leading-loose resize-none outline-none transition-all scrollbar-hide font-headline" />
                  <div className="theme-text-secondary absolute bottom-4 right-6 text-[9px] font-mono">{result.length} chars</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="mt-8 max-w-4xl mx-auto space-y-3">
            <div className="flex items-center gap-2 p-1 glass-panel rounded-2xl">
              <button onClick={() => setTranslationMode('novel')} className={`flex-1 rounded-xl py-3 text-[10px] font-black tracking-widest transition-all ${translationMode === 'novel' ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'theme-text-secondary hover:brightness-110'}`}>📖 NOVEL WORKSPACE</button>
              <button onClick={() => setTranslationMode('general')} className={`flex-1 rounded-xl py-3 text-[10px] font-black tracking-widest transition-all ${translationMode === 'general' ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20' : 'theme-text-secondary hover:brightness-110'}`}>📄 GENERAL ASSIST</button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowUrlImport(!showUrlImport)} className="theme-pill px-4 py-3 rounded-xl text-[10px] font-bold">🌐 웹 회차 가져오기</button>
              {showUrlImport && (
                <div className="flex-1 flex gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                  <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="공개 연재 페이지 URL" className="theme-field flex-1 rounded-xl px-4 py-2 text-xs outline-none" />
                  <button onClick={importUrl} disabled={loading} className="px-6 py-2 bg-emerald-600 rounded-xl text-[10px] font-bold text-white">FETCH</button>
                </div>
              )}
            </div>
            {showUrlImport && (
              <p className="px-1 text-[11px] leading-relaxed theme-text-secondary">
                범용 웹 번역이 아니라 공개 웹소설/연재 회차의 본문을 가져오는 보조 기능으로 두었습니다.
              </p>
            )}

            <div className="flex gap-4">
              <button onClick={translate} disabled={loading || !source.trim()} className="theme-pill flex-1 rounded-2xl py-5 text-[11px] font-black tracking-widest transition-all hover:brightness-105">FAST DRAFT</button>
              <button onClick={deepTranslate} disabled={loading || !source.trim()} 
                 className={`flex-2 py-5 rounded-2xl text-[11px] font-black tracking-widest text-white shadow-2xl transition-all ${translationMode === 'novel' ? 'bg-linear-to-r from-purple-600 to-indigo-600' : 'bg-linear-to-r from-emerald-600 to-teal-600'}`}>
                 {statusMsg || (translationMode === 'novel' ? 'DEEP NOVEL PIPELINE' : 'ACCURATE GENERAL')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={analyzeStyle} disabled={!source.trim()} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">문체 분석</button>
              <button onClick={refineResult} disabled={!result.trim() || loading} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">최종 다듬기</button>
              <button onClick={backTranslate} disabled={!result.trim() || loading} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">역검수</button>
              <button onClick={() => setIsCatMode((previous) => !previous)} className={`rounded-xl px-4 py-3 text-[10px] font-bold transition-all ${isCatMode ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'theme-pill hover:brightness-105'}`}>
                {isCatMode ? '통합 보기' : '라인 비교'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Sidebar */}
        {!isZenMode && (
          <aside className="w-80 glass-panel border-y-0 border-r-0 rounded-none overflow-y-auto p-6 hidden xl:block space-y-10 bg-sidebar">
            <div className="space-y-4">
              <h3 className="theme-kicker">World Lore</h3>
              <textarea value={worldContext} onChange={(e) => setWorldContext(e.target.value)} className="theme-field editor-pane w-full h-32 rounded-xl p-4 text-[11px] leading-relaxed resize-none outline-none" />
            </div>
            <div className="space-y-4">
              <h3 className="theme-kicker flex justify-between">Characters <button onClick={() => setShowCharacters(!showCharacters)} style={{ color: accentTextColor }}>Edit</button></h3>
              {showCharacters && <textarea value={characterProfiles} onChange={(e) => setCharacterProfiles(e.target.value)} className="theme-field editor-pane w-full h-40 rounded-xl p-4 text-[10px] outline-none" />}
            </div>
            <div className="space-y-4">
              <h3 className="theme-kicker flex justify-between">Story Bible <button onClick={() => setShowSummary(!showSummary)} style={{ color: accentTextColor }}>Edit</button></h3>
              <p className="text-[11px] leading-relaxed theme-text-secondary">소설 모드 번역 후 자동 요약이 이어붙여집니다. 필요하면 여기서 직접 다듬을 수 있습니다.</p>
              {showSummary && <textarea value={storySummary} onChange={(e) => setStorySummary(e.target.value)} className="theme-field editor-pane w-full h-40 rounded-xl p-4 text-[10px] outline-none" />}
            </div>
            <div className="pt-8 border-t border-white/5">
              <HistoryComponent history={history} setFrom={setFrom} setTo={setTo} setHistory={setHistory} />
            </div>
          </aside>
        )}
      </main>

      {/* Overlays */}
      {backResult && <div className="fixed bottom-10 right-10 z-50 w-96 glass-panel p-6 animate-in fade-in slide-in-from-bottom-5"><h4 className="theme-kicker mb-2" style={{ color: '#10b981' }}>Integrity Check</h4><div className="theme-text-primary max-h-60 overflow-y-auto text-xs leading-relaxed">{backResult}</div><button onClick={() => setBackResult('')} className="theme-text-secondary mt-4 text-[9px]">CLOSE</button></div>}
    </div>
  );
}

function HistoryComponent({ history, setFrom, setTo, setHistory }: any) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="theme-kicker">Logs</h3>
        <button onClick={() => setHistory([])} className="theme-text-secondary text-[9px]">CLEAR</button>
      </div>
      <div className="space-y-3">
        {history.map((h: any, i: number) => (
          <div key={i} className="p-4 glass-panel rounded-xl cursor-pointer group hover:border-purple-500/30 transition-all" onClick={() => { setFrom(h.from); setTo(h.to); }}>
             <div className="theme-text-secondary mb-2 flex justify-between text-[8px]"><span>{new Date(h.time).toLocaleTimeString()}</span><span>{h.from}→{h.to}</span></div>
             <p className="theme-text-primary truncate text-[10px]">{h.source}</p>
          </div>
        ))}
        {history.length === 0 && <p className="theme-text-secondary py-4 text-center text-[10px] italic">최근 기록이 없습니다.</p>}
      </div>
    </div>
  );
}
