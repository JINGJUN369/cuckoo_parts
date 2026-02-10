-- ============================================
-- RLS (Row Level Security) 활성화
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 모든 테이블에 RLS 활성화
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

-- ============================================
-- 2. anon 역할에 대한 기본 정책
--    (이 앱은 anon key를 사용하므로 anon 역할에 정책 부여)
-- ============================================

-- material_usage: 전체 읽기/쓰기 허용 (앱 내부 인증 사용)
CREATE POLICY "material_usage_all" ON material_usage
  FOR ALL USING (true) WITH CHECK (true);

-- product_recovery: 전체 읽기/쓰기 허용
CREATE POLICY "product_recovery_all" ON product_recovery
  FOR ALL USING (true) WITH CHECK (true);

-- users: 전체 읽기/쓰기 허용 (로그인 API에서 사용)
CREATE POLICY "users_all" ON users
  FOR ALL USING (true) WITH CHECK (true);

-- recovery_materials: 전체 읽기/쓰기 허용
CREATE POLICY "recovery_materials_all" ON recovery_materials
  FOR ALL USING (true) WITH CHECK (true);

-- recovery_material_history: 전체 읽기/쓰기 허용
CREATE POLICY "recovery_material_history_all" ON recovery_material_history
  FOR ALL USING (true) WITH CHECK (true);

-- status_change_history: 전체 읽기/쓰기 허용
CREATE POLICY "status_change_history_all" ON status_change_history
  FOR ALL USING (true) WITH CHECK (true);

-- login_history: 전체 읽기/쓰기 허용
CREATE POLICY "login_history_all" ON login_history
  FOR ALL USING (true) WITH CHECK (true);

-- upload_history: 전체 읽기/쓰기 허용
CREATE POLICY "upload_history_all" ON upload_history
  FOR ALL USING (true) WITH CHECK (true);

-- product_recovery_upload_history: 전체 읽기/쓰기 허용
CREATE POLICY "product_recovery_upload_history_all" ON product_recovery_upload_history
  FOR ALL USING (true) WITH CHECK (true);

-- product_recovery_status_history: 전체 읽기/쓰기 허용
CREATE POLICY "product_recovery_status_history_all" ON product_recovery_status_history
  FOR ALL USING (true) WITH CHECK (true);

-- carriers: 전체 읽기/쓰기 허용
CREATE POLICY "carriers_all" ON carriers
  FOR ALL USING (true) WITH CHECK (true);

-- auto_recovery_model_config: 전체 읽기/쓰기 허용
CREATE POLICY "auto_recovery_model_config_all" ON auto_recovery_model_config
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 3. system_settings: 읽기만 허용 (API 키 보호)
--    쓰기는 서버 API에서만 service_role key로 처리
-- ============================================
CREATE POLICY "system_settings_read" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 참고: 현재는 anon key에 전체 허용 상태입니다.
-- Supabase Auth를 도입하면 아래와 같이 법인별 격리가 가능합니다:
--
-- CREATE POLICY "branch_isolation" ON material_usage
--   FOR SELECT USING (
--     auth.jwt() ->> 'user_type' = 'admin_cs'
--     OR auth.jwt() ->> 'user_type' = 'admin_quality'
--     OR branch_code = auth.jwt() ->> 'branch_code'
--   );
-- ============================================
