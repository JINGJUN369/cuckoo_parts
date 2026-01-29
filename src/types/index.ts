// 사용자 역할 타입
export type UserType = 'admin_cs' | 'admin_quality' | 'branch';

// 회수 상태 타입
export type RecoveryStatus = '회수대기' | '회수완료' | '발송' | '입고완료';

// 세션 정보
export interface UserSession {
  userCode: string;
  userType: UserType;
  branchCode?: string; // 설치법인인 경우
  loginAt: string;
}

// 자재사용 원본 데이터
export interface MaterialUsage {
  id: string;
  request_number: string;
  branch_code: string;
  receipt_time?: string;
  model_name?: string;
  serial_number?: string;
  receipt_type?: string;
  inquiry_content?: string;
  process_time?: string;
  process_type?: string;
  repair_type?: string;
  technician_code?: string;
  process_content?: string;
  fault_category_large?: string;
  fault_category_medium?: string;
  fault_category_small?: string;
  fault_cause?: string;
  parts_cost: number;
  repair_cost: number;
  visit_cost: number;
  warranty_type?: string;
  material_code: string;
  material_name?: string;
  warranty_type2?: string;
  output_quantity: number;

  // 회수 관련
  status: RecoveryStatus;
  collected_at?: string;
  collected_by?: string;
  shipped_at?: string;
  shipped_by?: string;
  carrier?: string;
  tracking_number?: string;
  received_at?: string;
  received_by?: string;

  is_recovery_target: boolean;
  created_at: string;
  updated_at: string;
}

// 회수대상 자재
export interface RecoveryMaterial {
  id: string;
  material_code: string;
  material_name?: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  deactivated_at?: string;
  deactivated_by?: string;
}

// 회수자재 설정 이력
export interface RecoveryMaterialHistory {
  id: string;
  material_code: string;
  material_name?: string;
  action: '등록' | '해제';
  action_by?: string;
  action_at: string;
}

// 상태 변경 이력
export interface StatusChangeHistory {
  id: string;
  material_usage_id: string;
  request_number: string;
  branch_code: string;
  material_code: string;
  previous_status: RecoveryStatus;
  new_status: RecoveryStatus;
  carrier?: string;
  tracking_number?: string;
  changed_by?: string;
  changed_at: string;
}

// 로그인 이력
export interface LoginHistory {
  id: string;
  user_code: string;
  user_type: UserType;
  ip_address?: string;
  user_agent?: string;
  login_at: string;
}

// 업로드 이력
export interface UploadHistory {
  id: string;
  file_name: string;
  total_rows: number;
  new_rows: number;           // 호환성 유지
  saved_rows?: number;        // 저장된 건수 (회수대상)
  discarded_rows?: number;    // 폐기된 건수 (비회수대상)
  duplicate_rows: number;
  recovery_target_rows: number;
  by_date_detail?: Record<string, { saved: number; discarded: number }>; // 날짜별 상세
  uploaded_by?: string;
  uploaded_at: string;
}

// 운송회사
export interface Carrier {
  id: string;
  name: string;
  is_active: boolean;
}

// 엑셀 업로드용 파싱된 데이터
export interface ParsedExcelRow {
  request_number: string;
  branch_code: string;
  receipt_time?: string;
  model_name?: string;
  serial_number?: string;
  receipt_type?: string;
  inquiry_content?: string;
  process_time?: string;
  process_type?: string;
  repair_type?: string;
  technician_code?: string;
  process_content?: string;
  fault_category_large?: string;
  fault_category_medium?: string;
  fault_category_small?: string;
  fault_cause?: string;
  parts_cost?: number;
  repair_cost?: number;
  visit_cost?: number;
  warranty_type?: string;
  material_code: string;
  material_name?: string;
  warranty_type2?: string;
  output_quantity?: number;
}

// 중복 처리 옵션
export type DuplicateAction = 'skip' | 'overwrite' | 'skip_all' | 'overwrite_all';

// 통계 데이터
export interface RecoveryStats {
  total: number;
  waiting: number;
  collected: number;
  shipped: number;
  received: number;
}

// 차트용 일자별 데이터
export interface DailyStats {
  date: string;
  waiting: number;
  collected: number;
  shipped: number;
  received: number;
}

// 차트용 자재별 데이터
export interface MaterialStats {
  material_code: string;
  material_name: string;
  count: number;
}

// 차트용 법인별 데이터
export interface BranchStats {
  branch_code: string;
  waiting: number;
  collected: number;
  shipped: number;
  received: number;
}
