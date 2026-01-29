import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// 세션용 로컬 스토리지 키
export const STORAGE_KEYS = {
  SESSION: 'parts_recovery_session',
  RECOVERY_MATERIALS: 'parts_recovery_materials',
  RECOVERY_MATERIAL_HISTORY: 'parts_recovery_material_history',
  MATERIAL_USAGE: 'parts_material_usage',
  UPLOAD_HISTORY: 'parts_upload_history',
  LOGIN_HISTORY: 'parts_login_history',
  STATUS_CHANGE_HISTORY: 'parts_status_change_history',
};

// 초기 운송회사 데이터
export const DEFAULT_CARRIERS = [
  { id: '1', name: 'CJ대한통운', is_active: true },
  { id: '2', name: '롯데택배', is_active: true },
  { id: '3', name: '한진택배', is_active: true },
  { id: '4', name: '로젠택배', is_active: true },
  { id: '5', name: '우체국택배', is_active: true },
  { id: '6', name: '경동택배', is_active: true },
];
