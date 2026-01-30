-- =============================================
-- 제품 회수 (Product Recovery) 테이블
-- 철거/불량교환 데이터 관리
-- =============================================

-- 1. 제품 회수 원본 테이블
CREATE TABLE IF NOT EXISTS product_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 엑셀 원본 데이터
  request_date DATE NOT NULL,                    -- 요청일자
  request_branch TEXT NOT NULL,                  -- 요청지점 (법인명)
  customer_number TEXT NOT NULL,                 -- 고객번호
  customer_name TEXT,                            -- 고객명
  orderer_name TEXT,                             -- 주문자명
  model_name TEXT NOT NULL,                      -- 모델명

  -- 철거 전용 필드
  penalty_fee TEXT,                              -- 위약금
  registration_fee TEXT,                         -- 등록비
  other_discount TEXT,                           -- 기타할인
  consumable_fee TEXT,                           -- 소모품비
  removal_fee TEXT,                              -- 철거비
  fault_code TEXT,                               -- 고장코드

  -- 공통 필드
  new_request TEXT,                              -- 신규접수
  termination_request_date DATE NOT NULL,        -- 계약해지요청일
  work_request_large TEXT,                       -- 작업의뢰(대)
  work_request_medium TEXT,                      -- 작업의뢰(중)
  work_request_small TEXT,                       -- 작업의뢰(소)
  special_notes TEXT,                            -- 특이사항
  request_notes TEXT,                            -- 요청사항
  rejection_reason TEXT,                         -- 반려사유
  sales_deduction TEXT,                          -- 매출차감
  misc_profit_deduction TEXT,                    -- 잡이익차감
  approval_status TEXT NOT NULL,                 -- 품의진행상태
  employee_number TEXT NOT NULL,                 -- 사원번호
  status_raw TEXT,                               -- 원본 상태

  -- 회수 유형
  recovery_type TEXT NOT NULL CHECK (recovery_type IN ('철거', '불량교환')),

  -- 자동선택 관련
  contract_date DATE NOT NULL,                   -- 계약일 (고객번호에서 추출)
  is_within_one_year BOOLEAN NOT NULL DEFAULT false,    -- 1년 이내 여부
  is_auto_recovery_model BOOLEAN NOT NULL DEFAULT false, -- CBT-/CWS- 모델 여부
  is_auto_selected BOOLEAN NOT NULL DEFAULT false,      -- 자동선택 대상 여부
  selection_type TEXT CHECK (selection_type IN ('자동', '수동')),

  -- 법인 배정
  branch_code TEXT NOT NULL,                     -- 법인코드 (사원번호에서 추출)

  -- 회수 진행 상태
  recovery_status TEXT NOT NULL DEFAULT '미선택' CHECK (recovery_status IN ('미선택', '회수대기', '회수완료', '발송', '입고완료', '발송불가')),
  selected_at TIMESTAMPTZ,
  selected_by TEXT,

  -- 회수완료
  collected_at TIMESTAMPTZ,
  collected_by TEXT,

  -- 발송
  shipped_at TIMESTAMPTZ,
  shipped_by TEXT,
  carrier TEXT,
  tracking_number TEXT,

  -- 입고완료
  received_at TIMESTAMPTZ,
  received_by TEXT,

  -- 발송불가
  cancel_reason TEXT CHECK (cancel_reason IN ('분실', '파손', '재사용', '기타')),
  cancel_reason_detail TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 중복 방지 (고객번호 + 회수유형으로 유니크)
  CONSTRAINT unique_product_recovery UNIQUE (customer_number, recovery_type)
);

-- 2. 제품 회수 업로드 이력
CREATE TABLE IF NOT EXISTS product_recovery_upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  recovery_type TEXT NOT NULL CHECK (recovery_type IN ('철거', '불량교환')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  approved_rows INTEGER NOT NULL DEFAULT 0,
  auto_selected_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 자동 회수 대상 모델 설정
CREATE TABLE IF NOT EXISTS auto_recovery_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_prefix TEXT NOT NULL UNIQUE,             -- CBT-, CWS- 등
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- 4. 제품 회수 상태 변경 이력
CREATE TABLE IF NOT EXISTS product_recovery_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_recovery_id UUID NOT NULL REFERENCES product_recovery(id) ON DELETE CASCADE,
  customer_number TEXT NOT NULL,
  branch_code TEXT NOT NULL,
  model_name TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_recovery_customer_number ON product_recovery(customer_number);
CREATE INDEX IF NOT EXISTS idx_product_recovery_branch_code ON product_recovery(branch_code);
CREATE INDEX IF NOT EXISTS idx_product_recovery_model_name ON product_recovery(model_name);
CREATE INDEX IF NOT EXISTS idx_product_recovery_recovery_type ON product_recovery(recovery_type);
CREATE INDEX IF NOT EXISTS idx_product_recovery_recovery_status ON product_recovery(recovery_status);
CREATE INDEX IF NOT EXISTS idx_product_recovery_is_auto_selected ON product_recovery(is_auto_selected);
CREATE INDEX IF NOT EXISTS idx_product_recovery_termination_date ON product_recovery(termination_request_date);
CREATE INDEX IF NOT EXISTS idx_product_recovery_created_at ON product_recovery(created_at);

-- 기본 자동회수 모델 설정 추가
INSERT INTO auto_recovery_model_config (model_prefix, description, is_active)
VALUES
  ('CBT-', '비데', true),
  ('CWS-', '버블클렌저', true)
ON CONFLICT (model_prefix) DO NOTHING;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_product_recovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_recovery_updated_at ON product_recovery;
CREATE TRIGGER trigger_update_product_recovery_updated_at
  BEFORE UPDATE ON product_recovery
  FOR EACH ROW
  EXECUTE FUNCTION update_product_recovery_updated_at();

-- RLS 정책 (선택적)
-- ALTER TABLE product_recovery ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE product_recovery_upload_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE auto_recovery_model_config ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE product_recovery_status_history ENABLE ROW LEVEL SECURITY;
