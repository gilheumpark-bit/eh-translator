import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize the Supabase client
// Note: It will log warnings or fail if environment variables are missing,
// but we handle graceful fallback in the UI.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

/**
 * 챕터, 스토리 요약, 캐릭터 프로필 등 작업 내역 전체를 클라우드에 영구 저장합니다.
 */
export async function saveProjectToCloud(userId: string, projectId: string, state: any) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase DB credentials missing. Skipping cloud save.');
    return { error: 'DB_DISABLED' };
  }

  const { data, error } = await supabase
    .from('eh_projects')
    .upsert({
      id: projectId,
      user_id: userId,
      project_data: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  return { data, error };
}

/**
 * 클라우드에서 작업 내역을 불러옵니다.
 */
export async function loadProjectFromCloud(userId: string, projectId: string) {
  if (!supabaseUrl || !supabaseAnonKey || !userId) return null;

  const { data, error } = await supabase
    .from('eh_projects')
    .select('project_data')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.project_data;
}

/**
 * [V3.1] 사용자가 보유한 모든 프로젝트 목록(이름, 날짜 등 메타데이터)을 불러옵니다.
 */
export async function listUserProjects(userId: string) {
  if (!supabaseUrl || !supabaseAnonKey || !userId) return [];

  const { data, error } = await supabase
    .from('eh_projects')
    .select('id, updated_at, project_data') // name 추출을 위해 data 포함
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  
  // project_data 내부의 projectName을 추출하여 메타데이터만 반환
  return data.map((row: any) => ({
    id: row.id,
    updatedAt: row.updated_at,
    projectName: row.project_data?.projectName || row.id,
    chapterCount: row.project_data?.chapters?.length || 0,
  }));
}

/**
 * [V3.1] 참조(Cross-Reference)용으로 선택된 다수의 이전 프로젝트 데이터를 한 번에 불러옵니다.
 */
export async function getProjectsForReference(userId: string, referenceIds: string[]) {
  if (!supabaseUrl || !supabaseAnonKey || !userId || referenceIds.length === 0) return [];

  const { data, error } = await supabase
    .from('eh_projects')
    .select('project_data')
    .eq('user_id', userId)
    .in('id', referenceIds);

  if (error || !data) return [];
  return data.map((row: any) => row.project_data);
}
