-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  description VARCHAR(255),
  updated_by VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 초기 이메일 설정
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
  ('email_from', 'noreply@cuckoo.co.kr', '이메일 발송자 주소'),
  ('email_from_name', '쿠쿠 부품회수시스템', '이메일 발송자 이름'),
  ('resend_api_key', '', 'Resend API Key (비워두면 시뮬레이션)')
ON CONFLICT (setting_key) DO NOTHING;

-- RLS 비활성화
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
