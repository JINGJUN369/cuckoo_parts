import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Supabase가 설정되지 않은 경우를 위한 더미 클라이언트
const isDummyMode = !supabaseUrl || !supabaseAnonKey;

export const supabase = isDummyMode
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = !isDummyMode;

// 더미 모드에서 사용할 로컬 스토리지 키
export const STORAGE_KEYS = {
  MATERIAL_USAGE: 'parts_recovery_material_usage',
  RECOVERY_MATERIALS: 'parts_recovery_recovery_materials',
  RECOVERY_MATERIAL_HISTORY: 'parts_recovery_recovery_material_history',
  STATUS_CHANGE_HISTORY: 'parts_recovery_status_change_history',
  LOGIN_HISTORY: 'parts_recovery_login_history',
  UPLOAD_HISTORY: 'parts_recovery_upload_history',
  CARRIERS: 'parts_recovery_carriers',
  SESSION: 'parts_recovery_session',
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
