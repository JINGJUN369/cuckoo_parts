-- upload_history 테이블에 폐기 건수 컬럼 추가
ALTER TABLE upload_history ADD COLUMN IF NOT EXISTS discarded_rows INTEGER DEFAULT 0;

-- 저장된 건수 컬럼 추가 (기존 new_rows를 saved_rows로 대체)
ALTER TABLE upload_history ADD COLUMN IF NOT EXISTS saved_rows INTEGER DEFAULT 0;

-- 날짜별 상세 이력 (JSON 형태)
ALTER TABLE upload_history ADD COLUMN IF NOT EXISTS by_date_detail JSONB;

-- 기존 데이터 마이그레이션 (new_rows 값을 saved_rows로 복사)
UPDATE upload_history SET saved_rows = COALESCE(new_rows, 0) WHERE saved_rows = 0 OR saved_rows IS NULL;
