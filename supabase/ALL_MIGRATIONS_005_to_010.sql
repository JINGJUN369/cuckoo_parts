-- ============================================================
-- 쿠쿠 회수관리 시스템 - SQL 마이그레이션 (005~010)
-- Supabase SQL Editor에서 한번에 실행하세요
-- ============================================================


-- ============================================
-- 005. RLS (Row Level Security) 활성화
-- ============================================
ALTER TABLE material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_material_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recovery_upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recovery_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_recovery_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_usage_all" ON material_usage FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "product_recovery_all" ON product_recovery FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "recovery_materials_all" ON recovery_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "recovery_material_history_all" ON recovery_material_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "status_change_history_all" ON status_change_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "login_history_all" ON login_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "upload_history_all" ON upload_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "product_recovery_upload_history_all" ON product_recovery_upload_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "product_recovery_status_history_all" ON product_recovery_status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "carriers_all" ON carriers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auto_recovery_model_config_all" ON auto_recovery_model_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "system_settings_read" ON system_settings FOR SELECT USING (true);
CREATE POLICY "system_settings_write" ON system_settings FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- 006. 데이터 삭제 전 자동 백업 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS data_backup (
  id BIGSERIAL PRIMARY KEY,
  backup_type TEXT NOT NULL,
  original_data JSONB NOT NULL,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  date_from TEXT,
  date_to TEXT,
  deleted_by TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE data_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_backup_all" ON data_backup FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_data_backup_type ON data_backup(backup_type);
CREATE INDEX idx_data_backup_deleted_at ON data_backup(deleted_at);


-- ============================================
-- 007. 회수대상 자재에 제조번호 범위 컬럼 추가
-- ============================================
ALTER TABLE recovery_materials ADD COLUMN IF NOT EXISTS serial_number_start TEXT;
ALTER TABLE recovery_materials ADD COLUMN IF NOT EXISTS serial_number_end TEXT;


-- ============================================
-- 008. Supabase Realtime 활성화
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE material_usage;
ALTER PUBLICATION supabase_realtime ADD TABLE product_recovery;
ALTER PUBLICATION supabase_realtime ADD TABLE recovery_materials;


-- ============================================
-- 009. 성능 최적화 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_material_usage_branch_code ON material_usage(branch_code);
CREATE INDEX IF NOT EXISTS idx_material_usage_status ON material_usage(status);
CREATE INDEX IF NOT EXISTS idx_material_usage_material_code ON material_usage(material_code);
CREATE INDEX IF NOT EXISTS idx_material_usage_is_recovery ON material_usage(is_recovery_target);
CREATE INDEX IF NOT EXISTS idx_material_usage_shipped_at ON material_usage(shipped_at);
CREATE INDEX IF NOT EXISTS idx_material_usage_process_time ON material_usage(process_time);
CREATE INDEX IF NOT EXISTS idx_material_usage_created_at ON material_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_material_usage_dup_check ON material_usage(request_number, branch_code, material_code);

CREATE INDEX IF NOT EXISTS idx_product_recovery_branch_code ON product_recovery(branch_code);
CREATE INDEX IF NOT EXISTS idx_product_recovery_status ON product_recovery(recovery_status);
CREATE INDEX IF NOT EXISTS idx_product_recovery_model_name ON product_recovery(model_name);
CREATE INDEX IF NOT EXISTS idx_product_recovery_shipped_at ON product_recovery(shipped_at);
CREATE INDEX IF NOT EXISTS idx_product_recovery_created_at ON product_recovery(created_at);
CREATE INDEX IF NOT EXISTS idx_product_recovery_dup_check ON product_recovery(customer_number, model_name, termination_request_date);

CREATE INDEX IF NOT EXISTS idx_recovery_materials_active ON recovery_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_recovery_materials_code ON recovery_materials(material_code);

CREATE INDEX IF NOT EXISTS idx_status_history_material_id ON status_change_history(material_usage_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON status_change_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_login_history_user_code ON login_history(user_code);
CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at);

CREATE INDEX IF NOT EXISTS idx_upload_history_uploaded_at ON upload_history(uploaded_at);

CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_branch_code ON users(branch_code);


-- ============================================
-- 010. 에러 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT,
  error_stack TEXT,
  error_digest TEXT,
  page_url TEXT,
  user_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_code ON error_logs(user_code);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_logs_insert_policy" ON error_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "error_logs_select_policy" ON error_logs FOR SELECT TO anon, authenticated USING (true);


-- ============================================
-- 완료! users 테이블의 기존 행을 삭제하세요
-- (bcrypt 마이그레이션으로 기존 비밀번호가 호환 안됨)
-- ============================================
-- DELETE FROM users;
-- 위 줄의 주석을 해제하고 실행하면 users 테이블이 초기화됩니다.
-- 이후 고객만족팀CS / CUCKOO품질팀 계정으로 기본 비밀번호(12345678)로 로그인하면 자동 생성됩니다.
