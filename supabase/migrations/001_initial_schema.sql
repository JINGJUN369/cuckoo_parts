-- 1. 자재사용 원본 데이터
CREATE TABLE material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(20) NOT NULL,        -- 요청번호
  branch_code VARCHAR(10) NOT NULL,           -- 이관처
  receipt_time TIMESTAMP,                      -- 접수시간
  model_name VARCHAR(50),                      -- 모델명
  serial_number VARCHAR(30),                   -- 제조번호
  receipt_type VARCHAR(20),                    -- 접수구분
  inquiry_content TEXT,                        -- 문의내용
  process_time TIMESTAMP,                      -- 처리시간
  process_type VARCHAR(20),                    -- 처리구분
  repair_type VARCHAR(20),                     -- 수리구분
  technician_code VARCHAR(20),                 -- 기사코드
  process_content TEXT,                        -- 처리내용
  fault_category_large VARCHAR(30),           -- 고장대분류
  fault_category_medium VARCHAR(30),          -- 고장중분류
  fault_category_small VARCHAR(30),           -- 고장소분류
  fault_cause VARCHAR(50),                     -- 고장원인
  parts_cost INTEGER DEFAULT 0,                -- 부품비
  repair_cost INTEGER DEFAULT 0,               -- 수리비
  visit_cost INTEGER DEFAULT 0,                -- 출장료
  warranty_type VARCHAR(5),                    -- 유무상처리
  material_code VARCHAR(20) NOT NULL,          -- 자재코드
  material_name VARCHAR(100),                  -- 품명 및 규격
  warranty_type2 VARCHAR(5),                   -- 유무상처리2
  output_quantity INTEGER DEFAULT 0,           -- 출고수량

  -- 회수 관련 추가 컬럼
  status VARCHAR(20) DEFAULT '회수대기',       -- 상태: 회수대기/회수완료/발송/입고완료
  collected_at TIMESTAMP,                      -- 회수완료 시간
  collected_by VARCHAR(50),                    -- 회수완료 처리자
  shipped_at TIMESTAMP,                        -- 발송 시간
  shipped_by VARCHAR(50),                      -- 발송 처리자
  carrier VARCHAR(30),                         -- 운송회사
  tracking_number VARCHAR(50),                 -- 송장번호
  received_at TIMESTAMP,                       -- 입고완료 시간
  received_by VARCHAR(50),                     -- 입고완료 처리자

  is_recovery_target BOOLEAN DEFAULT FALSE,   -- 회수대상 여부
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(request_number, branch_code, material_code)
);

-- 2. 회수대상 자재 설정
CREATE TABLE recovery_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code VARCHAR(20) NOT NULL UNIQUE,
  material_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50),
  deactivated_at TIMESTAMP,
  deactivated_by VARCHAR(50)
);

-- 3. 회수자재 설정 이력
CREATE TABLE recovery_material_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code VARCHAR(20) NOT NULL,
  material_name VARCHAR(100),
  action VARCHAR(20) NOT NULL,                -- 등록/해제
  action_by VARCHAR(50),
  action_at TIMESTAMP DEFAULT NOW()
);

-- 4. 상태 변경 이력
CREATE TABLE status_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_usage_id UUID REFERENCES material_usage(id),
  request_number VARCHAR(20),
  branch_code VARCHAR(10),
  material_code VARCHAR(20),
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  carrier VARCHAR(30),
  tracking_number VARCHAR(50),
  changed_by VARCHAR(50),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 5. 로그인 이력
CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code VARCHAR(50) NOT NULL,             -- SA01, 고객만족팀CS 등
  user_type VARCHAR(20),                       -- admin_cs/admin_quality/branch
  ip_address VARCHAR(50),
  user_agent TEXT,
  login_at TIMESTAMP DEFAULT NOW()
);

-- 6. 업로드 이력
CREATE TABLE upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(200),
  total_rows INTEGER,
  new_rows INTEGER,
  duplicate_rows INTEGER,
  recovery_target_rows INTEGER,
  uploaded_by VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- 7. 운송회사 목록
CREATE TABLE carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE
);

-- 초기 운송회사 데이터
INSERT INTO carriers (name) VALUES
  ('CJ대한통운'), ('롯데택배'), ('한진택배'),
  ('로젠택배'), ('우체국택배'), ('경동택배');

-- 인덱스 생성
CREATE INDEX idx_material_usage_branch ON material_usage(branch_code);
CREATE INDEX idx_material_usage_status ON material_usage(status);
CREATE INDEX idx_material_usage_recovery ON material_usage(is_recovery_target);
CREATE INDEX idx_material_usage_material ON material_usage(material_code);
CREATE INDEX idx_recovery_materials_code ON recovery_materials(material_code);
CREATE INDEX idx_status_history_usage ON status_change_history(material_usage_id);
CREATE INDEX idx_login_history_user ON login_history(user_code);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_material_usage_updated_at
    BEFORE UPDATE ON material_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
