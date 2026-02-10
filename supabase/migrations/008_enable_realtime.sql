-- Supabase Realtime 활성화 (동시 접속 자동 갱신용)
-- material_usage, product_recovery, recovery_materials 테이블에 Realtime 구독 활성화

-- 이미 활성화되어 있으면 무시됨
ALTER PUBLICATION supabase_realtime ADD TABLE material_usage;
ALTER PUBLICATION supabase_realtime ADD TABLE product_recovery;
ALTER PUBLICATION supabase_realtime ADD TABLE recovery_materials;
