'use client';

import { ChangeEvent, startTransition, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { NetworkBridgePanel } from '@/components/translator/NetworkBridgePanel';
import {
  loadProjectFromCloud,
  saveProjectToCloud,
  listUserProjects,
  supabaseAnonKey,
  supabaseUrl,
} from '@/lib/supabase';
import { useAppDialog } from '@/hooks/useAppDialog';
import { AppDialog } from '@/components/ui/AppDialog';
import { MobileWorkspaceDrawer } from '@/components/translator/MobileWorkspaceDrawer';
import { ChapterSidebar } from '@/components/translator/ChapterSidebar';
import { ContextSidebar } from '@/components/translator/ContextSidebar';
import {
  PROJECT_LIBRARY_KEY,
  MAX_LOCAL_PROJECTS,
  REFERENCE_TEXT_LIMIT,
  STORY_BIBLE_LIMIT,
  LANGUAGES,
  PROVIDERS,
  BACKGROUND_MODES,
  estimateTokens,
} from '@/lib/translator-constants';
import {
  limitText,
  normalizeChapter,
  normalizeProjectSnapshots,
  mergeProjectSnapshots,
  toProjectMeta,
  projectFingerprint,
  mergeStoryBible,
  buildReferenceBundle,
  splitTextIntoChunks,
} from '@/lib/project-normalize';
import type {
  ChapterEntry,
  ProjectSnapshot,
  HistoryEntry,
  StyleHeuristicAnalysis,
  DomainPreset,
} from '@/types/translator';

export default function Home() {
  const { dialog, alert, confirm, dismiss, confirmYes, alertOk } = useAppDialog();
  const { loading: authLoading, userId, user: authUser, signInWithGoogle, signOut, getIdToken, error: authError } = useAuth();
  const isAuthLoaded = !authLoading;
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
  const [glossaryText, setGlossaryText] = useState('');
  const [domainPreset, setDomainPreset] = useState<DomainPreset>('general');
  const [preserveDialogueLayout, setPreserveDialogueLayout] = useState(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [cloudSyncDetail, setCloudSyncDetail] = useState('');
  const [lastApproxTokens, setLastApproxTokens] = useState<number | null>(null);
  const [compareResultB, setCompareResultB] = useState('');
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chapters' | 'context'>('chapters');
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Specialized Contexts
  const [worldContext, setWorldContext] = useState('');
  const [characterProfiles, setCharacterProfiles] = useState('');
  const [storySummary, setStorySummary] = useState('');
  const [styleAnalysis, setStyleAnalysis] = useState<StyleHeuristicAnalysis | null>(null);
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
      if (parsed.glossaryText !== undefined) setGlossaryText(parsed.glossaryText);
      if (parsed.domainPreset !== undefined) setDomainPreset(parsed.domainPreset);
      if (parsed.preserveDialogueLayout !== undefined) setPreserveDialogueLayout(parsed.preserveDialogueLayout);
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
        glossaryText,
        domainPreset,
        preserveDialogueLayout,
      }));
      setLastSavedAt(Date.now());
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [projectId, projectName, chapters, activeChapterIndex, source, result, from, to, provider, history, isZenMode, backgroundMode, isCatMode, translationMode, worldContext, characterProfiles, storySummary, referenceIds, glossaryText, domainPreset, preserveDialogueLayout]);

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
      setCloudSyncStatus('saving');
      setCloudSyncDetail('동기화 중…');
      try {
        const { error } = await saveProjectToCloud(userId, projectId, {
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
          glossaryText,
          domainPreset,
          preserveDialogueLayout,
        });
        if (error && error !== 'DB_DISABLED') {
          setCloudSyncStatus('error');
          const msg =
            typeof error === 'object' && error !== null && 'message' in error
              ? String((error as { message?: string }).message)
              : '클라우드 저장 실패';
          setCloudSyncDetail(msg);
        } else {
          setCloudSyncStatus('ok');
          setCloudSyncDetail(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch (error) {
        console.error('Failed to save project to cloud', error);
        setCloudSyncStatus('error');
        setCloudSyncDetail(error instanceof Error ? error.message : '클라우드 저장 실패');
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
    glossaryText,
    domainPreset,
    preserveDialogueLayout,
  ]);

  const readStreamText = async (res: Response, onDelta: (s: string) => void) => {
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const dec = new TextDecoder();
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      onDelta(acc);
    }
    return acc;
  };

  const requestTranslation = async (
    payload: Record<string, unknown>,
    options?: { stream?: boolean; onDelta?: (s: string) => void }
  ) => {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const approx = res.headers.get('x-approx-prompt-tokens');
    if (approx) setLastApproxTokens(parseInt(approx, 10));

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
      }

      throw new Error((await res.text()) || '요청 처리 중 오류가 발생했습니다.');
    }

    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { result?: string };
      return data.result || '';
    }

    if (options?.stream && options?.onDelta) {
      return readStreamText(res, options.onDelta);
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
      glossary: glossaryText.trim() || undefined,
      domainPreset: translationMode === 'general' ? domainPreset : 'general',
      preserveDialogueLayout: translationMode === 'novel' ? preserveDialogueLayout : false,
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
      await alert(error instanceof Error ? error.message : '번역 오류가 발생했습니다.');
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
          }),
          { stream: true, onDelta: (s) => setResult(s) }
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
      await alert(error instanceof Error ? error.message : 'Deep Pipeline 중 오류가 발생했습니다.');
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
        await alert('내용을 가져오지 못했습니다.');
      }
    } catch (error) {
      await alert(error instanceof Error ? error.message : 'URL 읽기 오류');
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

  const exportData = async () => {
    const ok = await confirm(
      '현재 프로젝트의 핵심 번역 데이터만 JSON 파일로 추출하시겠습니까?\n보안상 API 키와 참조 프로젝트 원문은 포함되지 않습니다.',
      '데이터 추출'
    );
    if (!ok) return;
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
      glossaryText,
      domainPreset,
      preserveDialogueLayout,
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
    const input = event.target;
    if (!file) return;

    void (async () => {
      const proceed = await confirm(
        '새 프로젝트 파일을 불러오시겠습니까?\n현재 작업 중인 모든 데이터가 덮어씌워집니다. 이 작업은 되돌릴 수 없습니다.',
        '프로젝트 불러오기'
      );
      if (!proceed) {
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        void (async () => {
          try {
            const parsed = JSON.parse(String(reader.result)) as Record<string, unknown>;
            startTransition(() => {
              if (parsed.projectName !== undefined) setProjectName(parsed.projectName as string);
              if (parsed.chapters !== undefined && Array.isArray(parsed.chapters)) {
                setChapters(
                  parsed.chapters.map((chapter: unknown, index: number) =>
                    normalizeChapter(chapter, `Part ${index + 1}`)
                  )
                );
              }
              if (parsed.projectList !== undefined) setProjectList(normalizeProjectSnapshots(parsed.projectList));
              if (parsed.projectLibrary !== undefined) setProjectList(normalizeProjectSnapshots(parsed.projectLibrary));
              if (parsed.activeChapterIndex !== undefined) setActiveChapterIndex(parsed.activeChapterIndex as number);
              if (parsed.source !== undefined) setSource(parsed.source as string);
              if (parsed.result !== undefined) setResult(parsed.result as string);
              if (parsed.from !== undefined) setFrom(parsed.from as string);
              if (parsed.to !== undefined) setTo(parsed.to as string);
              if (parsed.provider !== undefined) setProvider(parsed.provider as string);
              if (parsed.history !== undefined) setHistory(parsed.history as HistoryEntry[]);
              if (parsed.worldContext !== undefined) setWorldContext(parsed.worldContext as string);
              if (parsed.characterProfiles !== undefined) setCharacterProfiles(parsed.characterProfiles as string);
              if (parsed.storySummary !== undefined) setStorySummary(parsed.storySummary as string);
              if (parsed.referenceIds !== undefined)
                setReferenceIds(Array.isArray(parsed.referenceIds) ? (parsed.referenceIds as string[]) : []);
              if (parsed.backgroundMode !== undefined) setBackgroundMode(parsed.backgroundMode as string);
              if (parsed.isZenMode !== undefined) setIsZenMode(parsed.isZenMode as boolean);
              if (parsed.isCatMode !== undefined) setIsCatMode(parsed.isCatMode as boolean);
              if (parsed.translationMode !== undefined) setTranslationMode(parsed.translationMode as 'novel' | 'general');
              if (parsed.glossaryText !== undefined) setGlossaryText(parsed.glossaryText as string);
              if (parsed.domainPreset !== undefined) setDomainPreset(parsed.domainPreset as DomainPreset);
              if (parsed.preserveDialogueLayout !== undefined) setPreserveDialogueLayout(parsed.preserveDialogueLayout as boolean);
            });
          } catch {
            await alert('JSON 파일 형식이 올바르지 않습니다.');
          } finally {
            input.value = '';
          }
        })();
      };
      reader.readAsText(file);
    })();
  };

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    const proceed = await confirm(`${files.length}개의 문서를 현재 프로젝트 챕터 목록에 추가하시겠습니까?`, '문서 가져오기');
    if (!proceed) {
      event.target.value = '';
      return;
    }

    setLoading(true);
    setStatusMsg('IMPORTING FILES');
    try {
      const newChapters: ChapterEntry[] = [];

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
      await alert(error instanceof Error ? error.message : '문서 가져오기 실패');
    } finally {
      setLoading(false);
      setStatusMsg('');
      event.target.value = '';
    }
  };

  const batchTranslateAll = async () => {
    if (!chapters.length) return;
    const startBatch = await confirm(`${chapters.length}개 챕터를 순차 번역할까요?`, '일괄 번역');
    if (!startBatch) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    let rollingStorySummary = storySummary;
    try {
      for (let index = 0; index < chapters.length; index += 1) {
        const chapter = chapters[index];
        if (chapter.isDone) {
          const redo = await confirm(`${chapter.name}은(는) 이미 완료되었습니다. 재번역할까요?`, '재번역');
          if (!redo) continue;
        }
        
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
        } catch (err: unknown) {
          console.error(`Batch error at idx ${index}:`, err);
          const msg = err instanceof Error ? err.message : 'Error';
          patchChapterAtIndex(index, { error: msg });
          failCount++;
        }
      }
      await alert(`일괄 번역 종료: 성공 ${successCount}, 실패 ${failCount}`, '일괄 번역');
    } catch (error) {
      await alert(error instanceof Error ? error.message : '일괄 작업 중 치명적 오류 발생');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

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
        }),
        { stream: true, onDelta: (s) => setResult(s) }
      );
      setResult(refined);
      patchActiveChapter({ result: refined, isDone: true, stageProgress: 5 });
    } catch (error) {
      await alert(error instanceof Error ? error.message : '다듬기 실패');
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
      await alert(error instanceof Error ? error.message : '역번역 검사 실패');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const runCompareB = async () => {
    if (!source.trim()) return;
    const altProvider = provider === 'openai' ? 'claude' : 'openai';
    if (!apiKeys[altProvider] && !apiKeys[provider]) {
      await alert('비교 B안을 만들려면 해당 엔진 API 키를 설정해 주세요.');
      return;
    }
    setLoading(true);
    setStatusMsg('COMPARE B');
    try {
      const b = await requestTranslation(
        buildTranslationPayload({
          text: source,
          from,
          to,
          provider: apiKeys[altProvider] ? altProvider : provider,
          apiKey: apiKeys[altProvider] ? apiKeys[altProvider] : apiKeys[provider] || '',
          mode: translationMode,
        })
      );
      setCompareResultB(b);
    } catch (error) {
      await alert(error instanceof Error ? error.message : '비교 B안 실패');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const runChunkedTranslate = async () => {
    if (!source.trim()) return;
    const ok = await confirm(
      '긴 원고를 약 6000자 단위로 나눠 순서대로 번역한 뒤 이어 붙입니다. 계속할까요?',
      '분할 번역'
    );
    if (!ok) return;
    const chunks = splitTextIntoChunks(source, 6000, 400);
    setLoading(true);
    let acc = '';
    try {
      for (let i = 0; i < chunks.length; i++) {
        setStatusMsg(`CHUNK ${i + 1}/${chunks.length}`);
        const part = await requestTranslation(
          buildTranslationPayload({
            text: chunks[i],
            from,
            to,
            provider,
            apiKey: apiKeys[provider] || '',
            mode: translationMode,
          })
        );
        acc += (acc ? '\n\n' : '') + part;
        setResult(acc);
      }
      patchActiveChapter({ result: acc, isDone: true, stageProgress: 5 });
    } catch (error) {
      await alert(error instanceof Error ? error.message : '분할 번역 실패');
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
  const completedChapters = chapters.filter((chapter) => chapter.isDone).length;
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

  const handleChapterRemove = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const nextChapters = chapters.filter((_, chapterIndex) => chapterIndex !== idx);
    setChapters(nextChapters);

    if (activeChapterIndex === idx) {
      const fallbackIndex = nextChapters.length ? Math.min(idx, nextChapters.length - 1) : null;
      openChapter(fallbackIndex, nextChapters);
      return;
    }

    if (activeChapterIndex !== null && activeChapterIndex > idx) {
      setActiveChapterIndex(activeChapterIndex - 1);
    }
  };

  return (
    <div className={`min-h-screen theme-${backgroundMode} font-body ${isZenMode ? 'zen-mode' : ''}`}>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-20 items-center justify-between px-4 lg:px-6 glass-panel border-t-0 border-x-0 rounded-none">
        <div className="flex min-w-0 items-center gap-4">
          {!isZenMode && (
            <button
              type="button"
              className="lg:hidden rounded-xl px-3 py-2 text-sm font-bold backdrop-blur-xl theme-pill"
              style={{ color: headerMutedColor }}
              aria-label="챕터 및 맥락 패널 열기"
              onClick={() => {
                setShowMobileDrawer(true);
                setMobileTab('chapters');
              }}
            >
              ☰
            </button>
          )}
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
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="rounded-full bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110"
            >
              시작하기
            </button>
          )}
          {isAuthLoaded && userId && authUser && (
            <div className="flex items-center gap-2">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-lg"
                  aria-hidden
                >
                  {(authUser.email ?? authUser.displayName ?? '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur-xl transition-all hover:brightness-110"
                style={{ background: headerChipSurface, color: headerMutedColor }}
              >
                로그아웃
              </button>
            </div>
          )}
          {authError ? (
            <span className="hidden max-w-[140px] truncate text-[9px] text-red-500 lg:inline" title={authError}>
              {authError}
            </span>
          ) : null}

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

      <MobileWorkspaceDrawer
        open={showMobileDrawer && !isZenMode}
        onClose={() => setShowMobileDrawer(false)}
        tab={mobileTab}
        onTab={setMobileTab}
        backgroundMode={backgroundMode}
        childrenChapters={
          <ChapterSidebar
            chapters={chapters}
            activeChapterIndex={activeChapterIndex}
            loading={loading}
            showExportOptions={showExportOptions}
            onToggleExport={() => setShowExportOptions((p) => !p)}
            onBatchTranslate={() => void batchTranslateAll()}
            onImportDocument={importDocument}
            onDownloadAll={downloadAllResults}
            onOpenChapter={(idx) => {
              openChapter(idx);
              setShowMobileDrawer(false);
            }}
            onRemoveChapter={handleChapterRemove}
          />
        }
        childrenContext={
          <ContextSidebar
            worldContext={worldContext}
            setWorldContext={setWorldContext}
            characterProfiles={characterProfiles}
            setCharacterProfiles={setCharacterProfiles}
            storySummary={storySummary}
            setStorySummary={setStorySummary}
            showCharacters={showCharacters}
            setShowCharacters={setShowCharacters}
            showSummary={showSummary}
            setShowSummary={setShowSummary}
            accentTextColor={accentTextColor}
            history={history}
            setFrom={setFrom}
            setTo={setTo}
            setHistory={setHistory}
          />
        }
      />

      <main className="flex h-[calc(100vh-80px)] overflow-hidden pt-20">
        {!isZenMode && (
          <aside className="w-64 border-r border-gray-900/50 bg-sidebar overflow-y-auto p-4 hidden lg:block glass-panel border-y-0 border-l-0 rounded-none">
            <ChapterSidebar
              chapters={chapters}
              activeChapterIndex={activeChapterIndex}
              loading={loading}
              showExportOptions={showExportOptions}
              onToggleExport={() => setShowExportOptions((p) => !p)}
              onBatchTranslate={() => void batchTranslateAll()}
              onImportDocument={importDocument}
              onDownloadAll={downloadAllResults}
              onOpenChapter={(idx) => openChapter(idx)}
              onRemoveChapter={handleChapterRemove}
            />
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
                  {lastApproxTokens != null && (
                    <div className="theme-pill rounded-full px-3 py-2 text-[11px] font-semibold">
                      직전 요청 ≈ {lastApproxTokens.toLocaleString()} 토큰 (추정)
                    </div>
                  )}
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
                {cloudSyncEnabled && (
                  <p className="mt-3 text-[11px] leading-relaxed theme-text-secondary">
                    클라우드:{' '}
                    {cloudSyncStatus === 'saving' && '저장 중…'}
                    {cloudSyncStatus === 'ok' && `마지막 성공 ${cloudSyncDetail}`}
                    {cloudSyncStatus === 'error' && <span className="text-red-500">{cloudSyncDetail}</span>}
                    {cloudSyncStatus === 'idle' && '대기 중'}
                  </p>
                )}
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
                    <h4 className="theme-kicker mb-2">휴리스틱 문체 스캔 (비 LLM)</h4>
                    <p className="text-sm font-medium theme-text-primary">
                      패턴 기반 추정: <span style={{ color: accentTextColor }}>{styleAnalysis.genre}</span> 계열,{' '}
                      <span style={{ color: accentTextColor }}>{styleAnalysis.tone}</span> 성향입니다.
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
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm('초기화 하시겠습니까?', '신규 프로젝트');
                              if (!ok) return;
                              setProjectId(Date.now().toString());
                              setProjectName('');
                              setChapters([]);
                              setSource('');
                              setResult('');
                              setStorySummary('');
                              setWorldContext('');
                              setCharacterProfiles('');
                              setReferenceIds([]);
                              setGlossaryText('');
                            })();
                          }}
                          className="rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 px-3 py-2 text-[10px] font-bold text-white transition-all hover:brightness-110"
                        >
                          신규 생성
                        </button>
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
                  <p className="mt-3 text-[10px] leading-relaxed theme-text-secondary">
                    BYOK: 키는 브라우저→서버로 전달되어 번역 API 호출에만 사용됩니다. 공용 PC에서는 자제하고 키를 안전하게 보관하세요.
                  </p>
                </div>
                <div className="lg:col-span-3">
                  <label className="theme-kicker mb-2 block">용어집 (한 줄에 하나: 원문 =&gt; 번역)</label>
                  <textarea
                    value={glossaryText}
                    onChange={(e) => setGlossaryText(e.target.value)}
                    rows={5}
                    className="theme-field w-full rounded-lg p-3 text-xs outline-none font-mono"
                    placeholder={'예:\n魔法少女 => 마법 소녀\n主人公 => 주인공'}
                  />
                </div>
                <div className="lg:col-span-3">
                  <NetworkBridgePanel
                    universeOrigin={process.env.NEXT_PUBLIC_EH_UNIVERSE_ORIGIN ?? ''}
                    getIdToken={getIdToken}
                    projectId={projectId}
                    projectName={projectName}
                    chapters={chapters}
                    worldContext={worldContext}
                    characterProfiles={characterProfiles}
                    storySummary={storySummary}
                    glossaryText={glossaryText}
                  />
                </div>
                <div className="space-y-4">
                  <label className="theme-kicker block">일반 모드 도메인</label>
                  <select
                    value={domainPreset}
                    onChange={(e) => setDomainPreset(e.target.value as DomainPreset)}
                    className="theme-field w-full rounded-lg px-3 py-2 text-xs outline-none"
                  >
                    <option value="general">일반</option>
                    <option value="legal">법률</option>
                    <option value="it">IT</option>
                    <option value="medical">의학</option>
                  </select>
                  <label className="flex items-start gap-2 text-[11px] theme-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={preserveDialogueLayout}
                      onChange={(e) => setPreserveDialogueLayout(e.target.checked)}
                    />
                    <span>소설 모드에서 대사/지문 구획·따옴표 보존 지시 강화</span>
                  </label>
                </div>
                <div className="space-y-4">
                   <label className="theme-kicker block">Settings</label>
                   <select value={provider} onChange={(e) => setProvider(e.target.value)} className="theme-field w-full rounded-lg px-3 py-2 text-xs outline-none">
                      {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                   </select>
                   <div className="flex gap-2">
                      <button type="button" onClick={() => void exportData()} className="theme-pill flex-1 rounded-lg py-2 text-[9px] font-bold hover:brightness-105">EXTRACT</button>
                      <label className="theme-pill flex-1 cursor-pointer rounded-lg py-2 text-center text-[9px] font-bold hover:brightness-105">INJECT<input type="file" onChange={importData} className="hidden" /></label>
                   </div>
                   <button
                     type="button"
                     className="theme-pill mt-2 w-full rounded-lg py-2 text-[9px] font-bold hover:brightness-105"
                     onClick={() => {
                       void (async () => {
                         const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                         const data = (await res.json()) as { url?: string; error?: string };
                         if (data.url) window.location.href = data.url;
                         else await alert(data.error || 'Stripe 가격 ID가 없거나 설정되지 않았습니다.');
                       })();
                     }}
                   >
                     Stripe 구독 (선택)
                   </button>
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
              <button type="button" onClick={() => void runCompareB()} disabled={!source.trim() || loading} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">
                비교 B안
              </button>
              <button type="button" onClick={() => void runChunkedTranslate()} disabled={!source.trim() || loading} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">
                분할 번역
              </button>
              <button type="button" onClick={analyzeStyle} disabled={!source.trim()} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">문체 분석</button>
              <button type="button" onClick={() => void refineResult()} disabled={!result.trim() || loading} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">최종 다듬기</button>
              <button type="button" onClick={() => void backTranslate()} disabled={!result.trim() || loading} className="theme-pill rounded-xl px-4 py-3 text-[10px] font-bold transition-all hover:brightness-105 disabled:opacity-40">역검수</button>
              <button type="button" onClick={() => setIsCatMode((previous) => !previous)} className={`rounded-xl px-4 py-3 text-[10px] font-bold transition-all ${isCatMode ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : 'theme-pill hover:brightness-105'}`}>
                {isCatMode ? '통합 보기' : '라인 비교'}
              </button>
            </div>
            {compareResultB.trim() ? (
              <div className="mt-4 rounded-3xl glass-panel p-4">
                <div className="theme-kicker mb-2">비교 B안 (별도 엔진)</div>
                <textarea readOnly value={compareResultB} className="result-pane theme-field w-full min-h-[120px] rounded-xl p-3 text-xs" />
                <button type="button" className="mt-2 text-[10px] theme-text-secondary" onClick={() => setCompareResultB('')}>
                  B안 지우기
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {!isZenMode && (
          <aside className="w-80 glass-panel border-y-0 border-r-0 rounded-none overflow-y-auto p-6 hidden xl:block space-y-10 bg-sidebar">
            <ContextSidebar
              worldContext={worldContext}
              setWorldContext={setWorldContext}
              characterProfiles={characterProfiles}
              setCharacterProfiles={setCharacterProfiles}
              storySummary={storySummary}
              setStorySummary={setStorySummary}
              showCharacters={showCharacters}
              setShowCharacters={setShowCharacters}
              showSummary={showSummary}
              setShowSummary={setShowSummary}
              accentTextColor={accentTextColor}
              history={history}
              setFrom={setFrom}
              setTo={setTo}
              setHistory={setHistory}
            />
          </aside>
        )}
      </main>

      {backResult && (
        <div className="fixed bottom-10 right-10 z-50 w-96 glass-panel p-6 animate-in fade-in slide-in-from-bottom-5 max-h-[70vh] flex flex-col">
          <h4 className="theme-kicker mb-2" style={{ color: '#10b981' }}>
            Integrity Check
          </h4>
          <div className="theme-text-primary max-h-60 overflow-y-auto text-xs leading-relaxed">{backResult}</div>
          <button type="button" onClick={() => setBackResult('')} className="theme-text-secondary mt-4 text-[9px] text-left">
            CLOSE
          </button>
        </div>
      )}

      {dialog && (
        <AppDialog
          open
          variant={dialog.kind === 'confirm' ? 'confirm' : 'alert'}
          title={dialog.title ?? '알림'}
          message={dialog.message}
          onClose={dismiss}
          onConfirm={confirmYes}
          onAlertOk={alertOk}
        />
      )}
    </div>
  );
}
