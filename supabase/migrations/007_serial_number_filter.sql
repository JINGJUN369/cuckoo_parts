-- ============================================
-- 회수대상 자재에 제조번호 범위 필터 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- recovery_materials 테이블에 제조번호 범위 컬럼 추가
ALTER TABLE recovery_materials ADD COLUMN IF NOT EXISTS serial_number_start TEXT;
ALTER TABLE recovery_materials ADD COLUMN IF NOT EXISTS serial_number_end TEXT;
