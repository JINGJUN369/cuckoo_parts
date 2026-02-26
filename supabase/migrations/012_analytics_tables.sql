-- =============================================
-- 012: 사용 분석 (Analytics) 테이블
-- =============================================

-- 페이지 방문 기록
CREATE TABLE IF NOT EXISTS analytics_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code VARCHAR(50) NOT NULL,
  user_type VARCHAR(20),
  branch_code VARCHAR(10),
  page_path VARCHAR(200) NOT NULL,
  page_title VARCHAR(100),
  session_id VARCHAR(50) NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  referrer_page VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apv_user_code ON analytics_page_views(user_code);
CREATE INDEX IF NOT EXISTS idx_apv_page_path ON analytics_page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_apv_created_at ON analytics_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_apv_session_id ON analytics_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_apv_user_type ON analytics_page_views(user_type);

-- 사용자 행동 이벤트
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code VARCHAR(50) NOT NULL,
  user_type VARCHAR(20),
  branch_code VARCHAR(10),
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(30),
  event_data JSONB,
  page_path VARCHAR(200),
  session_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ae_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ae_user_code ON analytics_events(user_code);
CREATE INDEX IF NOT EXISTS idx_ae_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ae_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ae_category ON analytics_events(event_category);

-- RLS 정책
ALTER TABLE analytics_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_page_views_all" ON analytics_page_views
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "analytics_events_all" ON analytics_events
  FOR ALL USING (true) WITH CHECK (true);
