-- 성능 최적화: 자주 사용되는 쿼리 패턴에 인덱스 추가

-- material_usage 테이블
CREATE INDEX IF NOT EXISTS idx_material_usage_branch_code ON material_usage(branch_code);
CREATE INDEX IF NOT EXISTS idx_material_usage_status ON material_usage(status);
CREATE INDEX IF NOT EXISTS idx_material_usage_material_code ON material_usage(material_code);
CREATE INDEX IF NOT EXISTS idx_material_usage_is_recovery ON material_usage(is_recovery_target);
CREATE INDEX IF NOT EXISTS idx_material_usage_shipped_at ON material_usage(shipped_at);
CREATE INDEX IF NOT EXISTS idx_material_usage_process_time ON material_usage(process_time);
CREATE INDEX IF NOT EXISTS idx_material_usage_created_at ON material_usage(created_at);
-- 복합 인덱스: 중복 체크용 (request_number + branch_code + material_code)
CREATE INDEX IF NOT EXISTS idx_material_usage_dup_check ON material_usage(request_number, branch_code, material_code);

-- product_recovery 테이블
CREATE INDEX IF NOT EXISTS idx_product_recovery_branch_code ON product_recovery(branch_code);
CREATE INDEX IF NOT EXISTS idx_product_recovery_status ON product_recovery(recovery_status);
CREATE INDEX IF NOT EXISTS idx_product_recovery_model_name ON product_recovery(model_name);
CREATE INDEX IF NOT EXISTS idx_product_recovery_shipped_at ON product_recovery(shipped_at);
CREATE INDEX IF NOT EXISTS idx_product_recovery_created_at ON product_recovery(created_at);
-- 복합 인덱스: 중복 체크용
CREATE INDEX IF NOT EXISTS idx_product_recovery_dup_check ON product_recovery(customer_number, model_name, termination_request_date);

-- recovery_materials 테이블
CREATE INDEX IF NOT EXISTS idx_recovery_materials_active ON recovery_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_recovery_materials_code ON recovery_materials(material_code);

-- status_change_history 테이블
CREATE INDEX IF NOT EXISTS idx_status_history_material_id ON status_change_history(material_usage_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON status_change_history(changed_at);

-- login_history 테이블
CREATE INDEX IF NOT EXISTS idx_login_history_user_code ON login_history(user_code);
CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at);

-- upload_history 테이블
CREATE INDEX IF NOT EXISTS idx_upload_history_uploaded_at ON upload_history(uploaded_at);

-- users 테이블
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_branch_code ON users(branch_code);
