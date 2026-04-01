import type { ChapterEntry, ExportProjectMeta, ProjectSnapshot } from '@/types/translator';
import {
  MAX_LOCAL_PROJECTS,
  REFERENCE_CHAPTER_LIMIT,
  REFERENCE_TEXT_LIMIT,
  STORY_BIBLE_LIMIT,
  REFERENCE_PROJECT_LIMIT,
} from '@/lib/translator-constants';

export function limitText(text: string, max: number): string {
  const normalized = text.trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}\n\n[...중략...]`;
}

export function normalizeChapter(raw: unknown, fallbackName = 'Untitled Part'): ChapterEntry {
  const r = raw as Record<string, unknown>;
  return {
    name: typeof r?.name === 'string' && r.name.trim() ? r.name : fallbackName,
    content: typeof r?.content === 'string' ? r.content : '',
    result: typeof r?.result === 'string' ? r.result : '',
    isDone: Boolean(r?.isDone),
    stageProgress: typeof r?.stageProgress === 'number' ? r.stageProgress : 0,
    storyNote: typeof r?.storyNote === 'string' ? r.storyNote : '',
    error: typeof r?.error === 'string' ? r.error : '',
  };
}

export function normalizeProjectSnapshots(value: unknown): ProjectSnapshot[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value
    .map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      const id = typeof r?.id === 'string' && r.id.trim() ? r.id : null;
      if (!id) return null;

      return {
        id,
        project_name:
          typeof r?.project_name === 'string' && r.project_name.trim()
            ? r.project_name
            : typeof r?.projectName === 'string' && r.projectName.trim()
              ? r.projectName
              : `Project ${id.slice(-4)}`,
        updated_at: typeof r?.updated_at === 'number' ? r.updated_at : Date.now(),
        chapters: Array.isArray(r?.chapters)
          ? r.chapters.map((chapter: unknown, index: number) =>
              normalizeChapter(chapter, `Part ${index + 1}`)
            )
          : [],
        worldContext: typeof r?.worldContext === 'string' ? r.worldContext : '',
        characterProfiles: typeof r?.characterProfiles === 'string' ? r.characterProfiles : '',
        storySummary: typeof r?.storySummary === 'string' ? r.storySummary : '',
        from: typeof r?.from === 'string' ? r.from : 'ja',
        to: typeof r?.to === 'string' ? r.to : 'ko',
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

export function mergeProjectSnapshots(primary: ProjectSnapshot[], secondary: ProjectSnapshot[]): ProjectSnapshot[] {
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

export function toProjectMeta(projects: ProjectSnapshot[]): ExportProjectMeta[] {
  return projects.map((project) => ({
    id: project.id,
    project_name: project.project_name,
    updated_at: project.updated_at,
  }));
}

export function projectFingerprint(snapshot: Omit<ProjectSnapshot, 'updated_at'>): string {
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

export function mergeStoryBible(existing: string, incoming: string): string {
  const nextBlock = incoming.trim();
  if (!nextBlock) return existing;
  if (existing.includes(nextBlock)) return limitText(existing, STORY_BIBLE_LIMIT);

  const merged = existing.trim() ? `${existing.trim()}\n\n---\n${nextBlock}` : nextBlock;

  return limitText(merged, STORY_BIBLE_LIMIT);
}

export function buildReferenceBundle(
  referenceIds: string[],
  projectList: ProjectSnapshot[],
  currentProjectId: string
) {
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

/** Split long text into chunks with overlap for translation (characters). */
export function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (!t.length) return [];
  if (t.length <= chunkSize) return [t];

  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + chunkSize, t.length);
    let slice = t.slice(start, end);
    if (end < t.length) {
      const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'));
      if (breakAt > chunkSize * 0.4) {
        slice = slice.slice(0, breakAt + 1);
      }
    }
    chunks.push(slice.trim());
    const advance = slice.length - overlap;
    start += Math.max(advance, 1);
  }
  return chunks.filter(Boolean);
}
