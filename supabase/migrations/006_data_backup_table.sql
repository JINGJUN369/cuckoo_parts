-- ============================================
-- 데이터 삭제 전 자동 백업 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 삭제된 데이터를 보관하는 백업 테이블
CREATE TABLE IF NOT EXISTS data_backup (
  id BIGSERIAL PRIMARY KEY,
  backup_type TEXT NOT NULL,           -- 'material_usage' 또는 'product_recovery'
  original_data JSONB NOT NULL,        -- 원본 데이터 전체 (JSON)
  deleted_count INTEGER NOT NULL DEFAULT 0,
  date_from TEXT,                      -- 삭제 대상 시작일
  date_to TEXT,                        -- 삭제 대상 종료일
  deleted_by TEXT NOT NULL,            -- 삭제 실행자
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE data_backup ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능 (읽기/쓰기)
CREATE POLICY "data_backup_all" ON data_backup
  FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_data_backup_type ON data_backup(backup_type);
CREATE INDEX idx_data_backup_deleted_at ON data_backup(deleted_at);
