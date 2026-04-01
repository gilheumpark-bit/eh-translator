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
