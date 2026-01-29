-- 사용자 테이블 (비밀번호 관리용)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code VARCHAR(50) NOT NULL UNIQUE,      -- 로그인 ID (고객만족팀CS, CUCKOO품질팀, SA01 등)
  user_type VARCHAR(20) NOT NULL,              -- admin_cs / admin_quality / branch
  password_hash VARCHAR(255) NOT NULL,         -- 비밀번호 해시
  is_default_password BOOLEAN DEFAULT TRUE,    -- 초기 비밀번호 여부
  branch_code VARCHAR(10),                     -- 설치법인인 경우 법인코드
  email VARCHAR(100),                          -- 이메일 (알림용)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- 초기 관리자 계정 생성 (비밀번호는 ID와 동일)
-- 실제로는 해시값을 사용해야 하지만, 단순화를 위해 평문 저장 후 앱에서 해시 비교
INSERT INTO users (user_code, user_type, password_hash, is_default_password)
VALUES
  ('고객만족팀CS', 'admin_cs', '고객만족팀CS', true),
  ('CUCKOO품질팀', 'admin_quality', 'CUCKOO품질팀', true)
ON CONFLICT (user_code) DO NOTHING;

-- RLS 비활성화
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
