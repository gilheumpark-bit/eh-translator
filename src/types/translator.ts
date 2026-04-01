export type ChapterEntry = {
  name: string;
  content: string;
  result: string;
  isDone: boolean;
  stageProgress: number;
  storyNote?: string;
  error?: string;
};

export type ProjectSnapshot = {
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

export type ExportProjectMeta = {
  id: string;
  project_name: string;
  updated_at: number;
};

export type HistoryEntry = {
  source: string;
  result: string;
  time: number;
  from: string;
  to: string;
};

export type StyleHeuristicAnalysis = {
  genre: string;
  tone: string;
  metric: { fluency: string; immersion: string };
};

export type TranslationMode = 'novel' | 'general';

export type DomainPreset = 'general' | 'legal' | 'it' | 'medical';
