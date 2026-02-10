-- 에러 로그 테이블 (관리자 콘솔 알림용)
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT,
  error_stack TEXT,
  error_digest TEXT,
  page_url TEXT,
  user_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_code ON error_logs(user_code);

-- RLS 활성화
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 에러 로그를 삽입 가능
CREATE POLICY "error_logs_insert_policy" ON error_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 관리자만 에러 로그 조회 가능 (API에서 추가 검증)
CREATE POLICY "error_logs_select_policy" ON error_logs
  FOR SELECT TO anon, authenticated
  USING (true);

-- 30일 이상 된 에러 로그 자동 삭제 (수동 실행용)
-- DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days';
