-- 사용자 테이블에 법인명(요청지점) 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100);

-- 코멘트
COMMENT ON COLUMN users.branch_name IS '법인명 (요청지점). 관리자가 수동 설정하거나 제품 회수 데이터에서 자동 추출';
