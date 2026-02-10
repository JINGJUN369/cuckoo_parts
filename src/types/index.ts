// 사용자 역할 타입
export type UserType = 'admin_cs' | 'admin_quality' | 'branch';

// 회수 상태 타입
export type RecoveryStatus = '회수대기' | '회수완료' | '발송' | '입고완료' | '발송불가';

// 발송불가 사유 타입
export type CancelReason = '분실' | '파손' | '재사용' | '기타';

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

  // 발송불가 관련
  cancel_reason?: CancelReason;
  cancel_reason_detail?: string;
  cancelled_at?: string;
  cancelled_by?: string;

  is_recovery_target: boolean;
  created_at: string;
  updated_at: string;
}

// 회수대상 자재
export interface RecoveryMaterial {
  id: string;
  material_code: string;
  material_name?: string;
  serial_number_start?: string;
  serial_number_end?: string;
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
  cancelled: number;
}

// 차트용 일자별 데이터
export interface DailyStats {
  date: string;
  waiting: number;
  collected: number;
  shipped: number;
  received: number;
  cancelled: number;
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
  cancelled: number;
}

// =============================================
// 제품 회수 (Product Recovery) 관련 타입
// =============================================

// 제품 회수 유형
export type ProductRecoveryType = '철거' | '불량교환';

// 제품 회수 선택 방식
export type ProductSelectionType = '자동' | '수동';

// 제품 회수 상태 (부품 회수와 동일한 플로우)
export type ProductRecoveryStatus = '미선택' | '회수대기' | '회수완료' | '발송' | '입고완료' | '발송불가';

// 제품 회수 원본 데이터 (철거/불량교환 엑셀에서 업로드)
export interface ProductRecovery {
  id: string;

  // 엑셀 원본 데이터
  request_date: string;                // 요청일자
  request_branch: string;              // 요청지점 (법인명)
  customer_number: string;             // 고객번호 (1-01-250201-0001 형식)
  customer_name?: string;              // 고객명
  orderer_name?: string;               // 주문자명
  model_name: string;                  // 모델명

  // 철거 전용 필드
  penalty_fee?: string;                // 위약금
  registration_fee?: string;           // 등록비
  other_discount?: string;             // 기타할인
  consumable_fee?: string;             // 소모품비
  removal_fee?: string;                // 철거비
  fault_code?: string;                 // 고장코드

  // 공통 필드
  new_request?: string;                // 신규접수
  termination_request_date: string;    // 계약해지요청일
  work_request_large?: string;         // 작업의뢰(대)
  work_request_medium?: string;        // 작업의뢰(중)
  work_request_small?: string;         // 작업의뢰(소)
  special_notes?: string;              // 특이사항
  request_notes?: string;              // 요청사항
  rejection_reason?: string;           // 반려사유
  sales_deduction?: string;            // 매출차감
  misc_profit_deduction?: string;      // 잡이익차감
  approval_status: string;             // 품의진행상태
  employee_number: string;             // 사원번호
  status_raw?: string;                 // 원본 상태

  // 회수 유형
  recovery_type: ProductRecoveryType;  // 철거 or 불량교환

  // 자동선택 관련
  contract_date: string;               // 계약일 (고객번호에서 추출)
  is_within_one_year: boolean;         // 1년 이내 여부
  is_auto_recovery_model: boolean;     // CBT-/CWS- 모델 여부
  is_auto_selected: boolean;           // 자동선택 대상 여부 (둘 다 만족)
  selection_type?: ProductSelectionType; // 선택 방식 (자동/수동)

  // 법인 배정
  branch_code: string;                 // 법인코드 (사원번호에서 추출)

  // 회수 진행 상태
  recovery_status: ProductRecoveryStatus;
  selected_at?: string;                // 회수대상 선택 일시
  selected_by?: string;                // 선택한 관리자

  // 회수완료
  collected_at?: string;
  collected_by?: string;

  // 발송
  shipped_at?: string;
  shipped_by?: string;
  carrier?: string;
  tracking_number?: string;

  // 입고완료
  received_at?: string;
  received_by?: string;

  // 발송불가
  cancel_reason?: CancelReason;
  cancel_reason_detail?: string;
  cancelled_at?: string;
  cancelled_by?: string;

  // 메타데이터
  created_at: string;
  updated_at: string;
}

// 제품 회수 엑셀 파싱용 (철거)
export interface ParsedRemovalExcelRow {
  request_date: string;
  request_branch: string;
  customer_number: string;
  customer_name?: string;
  orderer_name?: string;
  model_name: string;
  penalty_fee?: string;
  registration_fee?: string;
  other_discount?: string;
  consumable_fee?: string;
  removal_fee?: string;
  new_request?: string;
  termination_request_date: string;
  work_request_large?: string;
  work_request_medium?: string;
  work_request_small?: string;
  special_notes?: string;
  request_notes?: string;
  fault_code?: string;
  rejection_reason?: string;
  sales_deduction?: string;
  misc_profit_deduction?: string;
  approval_status: string;
  employee_number: string;
  status_raw?: string;
}

// 제품 회수 엑셀 파싱용 (불량교환)
export interface ParsedDefectExchangeExcelRow {
  request_date: string;
  request_branch: string;
  customer_number: string;
  customer_name?: string;
  orderer_name?: string;
  model_name: string;
  new_request?: string;
  termination_request_date: string;
  work_request_large?: string;
  work_request_medium?: string;
  work_request_small?: string;
  special_notes?: string;
  request_notes?: string;
  rejection_reason?: string;
  sales_deduction?: string;
  misc_profit_deduction?: string;
  approval_status: string;
  employee_number: string;
  status_raw?: string;
}

// 제품 회수 업로드 이력
export interface ProductRecoveryUploadHistory {
  id: string;
  file_name: string;
  recovery_type: ProductRecoveryType;
  total_rows: number;
  approved_rows: number;          // 승인 건수
  auto_selected_rows: number;     // 자동선택 건수
  duplicate_rows: number;
  uploaded_by?: string;
  uploaded_at: string;
}

// 제품 회수 통계
export interface ProductRecoveryStats {
  total: number;
  unselected: number;             // 미선택
  waiting: number;                // 회수대기
  collected: number;              // 회수완료
  shipped: number;                // 발송
  received: number;               // 입고완료
  cancelled: number;              // 발송불가
}

// 자동선택 대상 모델 설정
export interface AutoRecoveryModelConfig {
  id: string;
  model_prefix: string;           // CBT-, CWS- 등
  description?: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}
