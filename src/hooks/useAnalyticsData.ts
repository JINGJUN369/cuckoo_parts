'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  AnalyticsPageView,
  AnalyticsEvent,
  AnalyticsSummary,
  DailyVisitors,
  RoleDistribution,
  HourlyDistribution,
  FeatureUsage,
  PageViewRanking,
  BranchAccessFrequency,
  HeatmapCell,
  UserType,
} from '@/types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  upload_excel: '엑셀 업로드',
  status_change: '상태 변경',
  bulk_status_change: '일괄 상태 변경',
  search: '검색',
  send_email: '이메일 발송',
  export_data: '데이터 내보내기',
  login: '로그인',
  logout: '로그아웃',
};

const ROLE_LABELS: Record<UserType, string> = {
  admin_cs: 'CS 관리자',
  admin_quality: '품질관리',
  branch: '설치법인',
};

const PAGE_TITLE_MAP: Record<string, string> = {
  '/admin-cs/dashboard': '대시보드',
  '/admin-cs/upload': '데이터 업로드',
  '/admin-cs/materials': '회수대상 자재설정',
  '/admin-cs/product-settings': '회수대상 제품설정',
  '/admin-cs/recovery-report': '회수현황 보고서',
  '/admin-cs/calendar': '달력',
  '/admin-cs/history': '이력 조회',
  '/admin-cs/users': '사용자 관리',
  '/admin-cs/settings': '이메일 설정',
  '/admin-cs/analytics': '사용 분석',
  '/admin-quality/dashboard': '품질관리 대시보드',
  '/admin-quality/receive': '입고 관리',
  '/branch/dashboard': '법인 대시보드',
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface UseAnalyticsDataParams {
  dateFrom: string;
  dateTo: string;
}

interface EfficiencyMetrics {
  avgProcessingDays: number;
  branchResponseTimes: { branch_code: string; avg_days: number; total_changes: number }[];
  dailyProcessingVolume: { date: string; count: number }[];
}

export { EVENT_TYPE_LABELS, ROLE_LABELS, PAGE_TITLE_MAP, DAY_LABELS };

export function useAnalyticsData({ dateFrom, dateTo }: UseAnalyticsDataParams) {
  const [pageViews, setPageViews] = useState<AnalyticsPageView[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [efficiencyMetrics, setEfficiencyMetrics] = useState<EfficiencyMetrics>({
    avgProcessingDays: 0,
    branchResponseTimes: [],
    dailyProcessingVolume: [],
  });

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pvRes, evRes] = await Promise.all([
        supabase
          .from('analytics_page_views')
          .select('*')
          .gte('created_at', dateFrom + 'T00:00:00')
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase
          .from('analytics_events')
          .select('*')
          .gte('created_at', dateFrom + 'T00:00:00')
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(10000),
      ]);

      setPageViews(pvRes.data || []);
      setEvents(evRes.data || []);
    } catch (e) {
      console.error('Analytics data load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  // 효율 지표 로드 (기존 status_change_history 활용)
  const loadEfficiencyMetrics = useCallback(async () => {
    try {
      const { data: changes } = await supabase
        .from('status_change_history')
        .select('*')
        .gte('changed_at', dateFrom + 'T00:00:00')
        .lte('changed_at', dateTo + 'T23:59:59')
        .order('changed_at', { ascending: true })
        .limit(5000);

      if (!changes || changes.length === 0) {
        setEfficiencyMetrics({ avgProcessingDays: 0, branchResponseTimes: [], dailyProcessingVolume: [] });
        return;
      }

      // 평균 처리일: 입고완료까지 걸린 시간
      const receivedItems = changes.filter(c => c.new_status === '입고완료');
      let totalDays = 0;
      let validCount = 0;
      for (const item of receivedItems) {
        // 같은 material_usage_id의 첫 기록 찾기
        const firstChange = changes.find(c => c.material_usage_id === item.material_usage_id);
        if (firstChange) {
          const days = (new Date(item.changed_at).getTime() - new Date(firstChange.changed_at).getTime()) / (1000 * 60 * 60 * 24);
          if (days > 0) {
            totalDays += days;
            validCount++;
          }
        }
      }
      const avgProcessingDays = validCount > 0 ? Math.round((totalDays / validCount) * 10) / 10 : 0;

      // 법인별 응답 시간 (회수완료 처리까지)
      const branchMap = new Map<string, { totalDays: number; count: number }>();
      const collectedItems = changes.filter(c => c.new_status === '회수완료');
      for (const item of collectedItems) {
        const firstChange = changes.find(c =>
          c.material_usage_id === item.material_usage_id && c.new_status === '회수대기'
        );
        if (firstChange && item.branch_code) {
          const days = (new Date(item.changed_at).getTime() - new Date(firstChange.changed_at).getTime()) / (1000 * 60 * 60 * 24);
          if (days >= 0) {
            const existing = branchMap.get(item.branch_code) || { totalDays: 0, count: 0 };
            existing.totalDays += days;
            existing.count++;
            branchMap.set(item.branch_code, existing);
          }
        }
      }
      const branchResponseTimes = Array.from(branchMap.entries())
        .map(([branch_code, data]) => ({
          branch_code,
          avg_days: Math.round((data.totalDays / data.count) * 10) / 10,
          total_changes: data.count,
        }))
        .sort((a, b) => a.avg_days - b.avg_days);

      // 일별 처리량
      const dailyMap = new Map<string, number>();
      for (const item of changes) {
        const date = item.changed_at.split('T')[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      }
      const dailyProcessingVolume = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setEfficiencyMetrics({ avgProcessingDays, branchResponseTimes, dailyProcessingVolume });
    } catch (e) {
      console.error('Efficiency metrics load error:', e);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
    loadEfficiencyMetrics();
  }, [loadData, loadEfficiencyMetrics]);

  // 요약 통계
  const summary: AnalyticsSummary = useMemo(() => {
    const uniqueUsers = new Set(pageViews.map(pv => pv.user_code));
    const uniqueBranches = new Set(
      pageViews.filter(pv => pv.branch_code).map(pv => pv.branch_code)
    );

    // 세션별 체류시간 합산
    const sessionDurations = new Map<string, number>();
    for (const pv of pageViews) {
      const current = sessionDurations.get(pv.session_id) || 0;
      sessionDurations.set(pv.session_id, current + (pv.duration_seconds || 0));
    }
    const durations = Array.from(sessionDurations.values()).filter(d => d > 0);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return {
      totalVisits: pageViews.length,
      uniqueVisitors: uniqueUsers.size,
      avgSessionDuration: avgDuration,
      activeBranches: uniqueBranches.size,
    };
  }, [pageViews]);

  // 일별 방문자
  const dailyVisitors: DailyVisitors[] = useMemo(() => {
    const dailyMap = new Map<string, { total: number; users: Set<string> }>();

    for (const pv of pageViews) {
      const date = pv.created_at.split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { total: 0, users: new Set() });
      }
      const entry = dailyMap.get(date)!;
      entry.total++;
      entry.users.add(pv.user_code);
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        total: data.total,
        unique: data.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [pageViews]);

  // 역할별 분포
  const roleDistribution: RoleDistribution[] = useMemo(() => {
    const roleMap = new Map<UserType, Set<string>>();
    for (const pv of pageViews) {
      if (!pv.user_type) continue;
      if (!roleMap.has(pv.user_type)) {
        roleMap.set(pv.user_type, new Set());
      }
      roleMap.get(pv.user_type)!.add(pv.user_code);
    }

    return Array.from(roleMap.entries()).map(([role, users]) => ({
      role,
      label: ROLE_LABELS[role] || role,
      count: users.size,
    }));
  }, [pageViews]);

  // 시간대별 분포
  const hourlyDistribution: HourlyDistribution[] = useMemo(() => {
    const hourMap = new Array(24).fill(0);
    for (const pv of pageViews) {
      const hour = new Date(pv.created_at).getHours();
      hourMap[hour]++;
    }
    return hourMap.map((count, hour) => ({ hour, count }));
  }, [pageViews]);

  // 기능 사용 순위
  const featureUsage: FeatureUsage[] = useMemo(() => {
    const typeMap = new Map<string, number>();
    for (const ev of events) {
      typeMap.set(ev.event_type, (typeMap.get(ev.event_type) || 0) + 1);
    }

    return Array.from(typeMap.entries())
      .map(([event_type, count]) => ({
        event_type,
        label: EVENT_TYPE_LABELS[event_type] || event_type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  // 페이지뷰 순위
  const pageViewRanking: PageViewRanking[] = useMemo(() => {
    const pageMap = new Map<string, { count: number; totalDuration: number }>();

    for (const pv of pageViews) {
      if (!pageMap.has(pv.page_path)) {
        pageMap.set(pv.page_path, { count: 0, totalDuration: 0 });
      }
      const entry = pageMap.get(pv.page_path)!;
      entry.count++;
      entry.totalDuration += pv.duration_seconds || 0;
    }

    return Array.from(pageMap.entries())
      .map(([page_path, data]) => ({
        page_path,
        page_title: PAGE_TITLE_MAP[page_path] || page_path,
        count: data.count,
        avg_duration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [pageViews]);

  // 법인별 접속 빈도
  const branchAccess: BranchAccessFrequency[] = useMemo(() => {
    const branchMap = new Map<string, { count: number; lastAccess: string }>();

    for (const pv of pageViews) {
      if (!pv.branch_code) continue;
      const existing = branchMap.get(pv.branch_code);
      if (!existing) {
        branchMap.set(pv.branch_code, { count: 1, lastAccess: pv.created_at });
      } else {
        existing.count++;
        if (pv.created_at > existing.lastAccess) {
          existing.lastAccess = pv.created_at;
        }
      }
    }

    return Array.from(branchMap.entries())
      .map(([branch_code, data]) => ({
        branch_code,
        count: data.count,
        last_access: data.lastAccess,
      }))
      .sort((a, b) => b.count - a.count);
  }, [pageViews]);

  // 활동 히트맵 (요일 x 시간)
  const heatmapData: HeatmapCell[] = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

    for (const pv of pageViews) {
      const dt = new Date(pv.created_at);
      const day = dt.getDay(); // 0=Sun
      const hour = dt.getHours();
      grid[day][hour]++;
    }

    const cells: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        cells.push({ day, hour, value: grid[day][hour] });
      }
    }
    return cells;
  }, [pageViews]);

  // 법인 x 기능 히트맵
  const branchFeatureHeatmap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const ev of events) {
      if (!ev.branch_code) continue;
      if (!map.has(ev.branch_code)) {
        map.set(ev.branch_code, new Map());
      }
      const featureMap = map.get(ev.branch_code)!;
      featureMap.set(ev.event_type, (featureMap.get(ev.event_type) || 0) + 1);
    }

    // 법인 목록
    const branches = Array.from(map.keys()).sort();
    // 이벤트 타입 목록
    const featureTypes = Array.from(new Set(events.map(e => e.event_type))).sort();

    const cells: { branch: string; feature: string; label: string; value: number }[] = [];
    for (const branch of branches) {
      const featureMap = map.get(branch)!;
      for (const feature of featureTypes) {
        cells.push({
          branch,
          feature,
          label: EVENT_TYPE_LABELS[feature] || feature,
          value: featureMap.get(feature) || 0,
        });
      }
    }

    return { branches, featureTypes, cells };
  }, [events]);

  return {
    isLoading,
    pageViews,
    events,
    summary,
    dailyVisitors,
    roleDistribution,
    hourlyDistribution,
    featureUsage,
    pageViewRanking,
    branchAccess,
    heatmapData,
    branchFeatureHeatmap,
    efficiencyMetrics,
    refresh: loadData,
  };
}
