-- 기사코드-이름 매핑 테이블 (설치법인별 관리)
CREATE TABLE IF NOT EXISTS technician_names (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_code TEXT NOT NULL,
  technician_code TEXT NOT NULL,
  technician_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_code, technician_code)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_technician_names_branch ON technician_names(branch_code);

-- RLS 활성화
ALTER TABLE technician_names ENABLE ROW LEVEL SECURITY;

-- 정책: 자신의 법인 데이터만 조회/수정 가능
CREATE POLICY "branch_read_own_technicians" ON technician_names
  FOR SELECT USING (true);

CREATE POLICY "branch_insert_own_technicians" ON technician_names
  FOR INSERT WITH CHECK (true);

CREATE POLICY "branch_update_own_technicians" ON technician_names
  FOR UPDATE USING (true);

CREATE POLICY "branch_delete_own_technicians" ON technician_names
  FOR DELETE USING (true);
