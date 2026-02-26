'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Users, UserCheck, Clock, Building, Download, RefreshCw, CalendarDays,
} from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { useAnalyticsData, EVENT_TYPE_LABELS, ROLE_LABELS, DAY_LABELS } from '@/hooks/useAnalyticsData';
import { exportGenericToExcel } from '@/lib/excel';
import { useAnalytics } from '@/hooks/useAnalytics';
import { UserType } from '@/types';

// 날짜 프리셋
type DatePreset = 'today' | 'yesterday' | 'week' | 'thisMonth' | 'lastMonth' | 'last30days';

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: formatDate(y), to: formatDate(y) };
    }
    case 'week': {
      const w = new Date(today); w.setDate(w.getDate() - 6);
      return { from: formatDate(w), to: formatDate(today) };
    }
    case 'thisMonth': {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDate(m), to: formatDate(today) };
    }
    case 'lastMonth': {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lme = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: formatDate(lm), to: formatDate(lme) };
    }
    case 'last30days': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { from: formatDate(d), to: formatDate(today) };
    }
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `${min}분 ${sec}초`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 ${min % 60}분`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 히트맵 색상
function getHeatmapColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#f3f4f6';
  const intensity = Math.min(value / max, 1);
  const r = Math.round(239 - intensity * 180);
  const g = Math.round(246 - intensity * 180);
  const b = Math.round(255 - intensity * 25);
  return `rgb(${r}, ${g}, ${b})`;
}

const ROLE_COLORS: Record<string, string> = {
  admin_cs: '#3b82f6',
  admin_quality: '#22c55e',
  branch: '#f59e0b',
};

const PRESET_BUTTONS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'yesterday', label: '어제' },
  { key: 'week', label: '최근 7일' },
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난 달' },
  { key: 'last30days', label: '최근 30일' },
];

export default function AnalyticsPage() {
  const defaultRange = getDateRange('last30days');
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('last30days');

  const { trackEvent } = useAnalytics();

  const {
    isLoading, summary, dailyVisitors, roleDistribution, hourlyDistribution,
    featureUsage, pageViewRanking, branchAccess, heatmapData, branchFeatureHeatmap,
    efficiencyMetrics, pageViews, events, refresh,
  } = useAnalyticsData({ dateFrom, dateTo });

  const handlePreset = (preset: DatePreset) => {
    const range = getDateRange(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
    setSelectedPreset(preset);
  };

  // 히트맵 최대값
  const heatmapMax = useMemo(() => Math.max(...heatmapData.map(c => c.value), 1), [heatmapData]);
  const branchFeatureMax = useMemo(
    () => Math.max(...branchFeatureHeatmap.cells.map(c => c.value), 1),
    [branchFeatureHeatmap]
  );

  // 엑셀 내보내기
  const handleExportPageViews = useCallback(() => {
    const data = pageViews.map(pv => ({
      '사용자': pv.user_code,
      '역할': ROLE_LABELS[pv.user_type as UserType] || pv.user_type,
      '법인': pv.branch_code || '-',
      '페이지': pv.page_title || pv.page_path,
      '체류시간(초)': pv.duration_seconds,
      '접속일시': formatDateTime(pv.created_at),
    }));
    exportGenericToExcel(data, `페이지뷰_${dateFrom}_${dateTo}`);
    trackEvent('export_data', 'action', { type: 'analytics_page_views' });
  }, [pageViews, dateFrom, dateTo, trackEvent]);

  const handleExportEvents = useCallback(() => {
    const data = events.map(ev => ({
      '사용자': ev.user_code,
      '역할': ROLE_LABELS[ev.user_type as UserType] || ev.user_type,
      '법인': ev.branch_code || '-',
      '이벤트': EVENT_TYPE_LABELS[ev.event_type] || ev.event_type,
      '카테고리': ev.event_category,
      '페이지': ev.page_path || '-',
      '일시': formatDateTime(ev.created_at),
    }));
    exportGenericToExcel(data, `이벤트_${dateFrom}_${dateTo}`);
    trackEvent('export_data', 'action', { type: 'analytics_events' });
  }, [events, dateFrom, dateTo, trackEvent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">사용 분석</h1>
          <p className="text-sm text-muted-foreground mt-1">시스템 활용도 및 사용자 행동 분석</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPageViews}>
            <Download className="h-4 w-4 mr-1" />
            페이지뷰 내보내기
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportEvents}>
            <Download className="h-4 w-4 mr-1" />
            이벤트 내보내기
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 날짜 필터 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_BUTTONS.map(btn => (
              <Button
                key={btn.key}
                variant={selectedPreset === btn.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePreset(btn.key)}
              >
                {btn.label}
              </Button>
            ))}
            <div className="flex items-center gap-1 ml-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setSelectedPreset('' as DatePreset); }}
                className="w-36 h-8 text-sm"
              />
              <span className="text-gray-400">~</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setSelectedPreset('' as DatePreset); }}
                className="w-36 h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 탭 */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="access">접속 분석</TabsTrigger>
          <TabsTrigger value="features">기능 사용</TabsTrigger>
          <TabsTrigger value="efficiency">업무 효율</TabsTrigger>
          <TabsTrigger value="heatmap">활동 히트맵</TabsTrigger>
        </TabsList>

        {/* ===== 개요 탭 ===== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard title="총 방문" value={summary.totalVisits.toLocaleString()} icon={Users} description="페이지뷰 수" />
            <StatCard title="순 방문자" value={summary.uniqueVisitors.toLocaleString()} icon={UserCheck} description="고유 사용자 수" />
            <StatCard title="평균 체류시간" value={formatDuration(summary.avgSessionDuration)} icon={Clock} description="세션 기준" />
            <StatCard title="활성 법인" value={summary.activeBranches.toLocaleString()} icon={Building} description="접속한 법인 수" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* 일별 방문 추이 */}
            <Card>
              <CardHeader><CardTitle className="text-base">일별 방문 추이</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyVisitors}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="총 방문" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="unique" name="순 방문자" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 역할 분포 */}
            <Card>
              <CardHeader><CardTitle className="text-base">역할별 사용자 분포</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(props) => `${props.name || ''}: ${props.value}명`}
                    >
                      {roleDistribution.map((entry) => (
                        <Cell key={entry.role} fill={ROLE_COLORS[entry.role] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== 접속 분석 탭 ===== */}
        <TabsContent value="access" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* 일별 방문자 추이 */}
            <Card>
              <CardHeader><CardTitle className="text-base">일별 방문자 추이</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyVisitors}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="총 방문" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="unique" name="순 방문자" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 시간대별 분포 */}
            <Card>
              <CardHeader><CardTitle className="text-base">시간대별 접속 분포</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}시`} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(h) => `${h}시`} />
                    <Bar dataKey="count" name="접속 수" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 법인별 접속 빈도 */}
          <Card>
            <CardHeader><CardTitle className="text-base">법인별 접속 빈도</CardTitle></CardHeader>
            <CardContent>
              {branchAccess.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">법인 접속 데이터가 없습니다.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>순위</TableHead>
                      <TableHead>법인코드</TableHead>
                      <TableHead className="text-right">접속 횟수</TableHead>
                      <TableHead className="text-right">마지막 접속</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchAccess.slice(0, 20).map((item, idx) => (
                      <TableRow key={item.branch_code}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>{item.branch_code}</TableCell>
                        <TableCell className="text-right">{item.count.toLocaleString()}회</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{formatDateTime(item.last_access)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== 기능 사용 탭 ===== */}
        <TabsContent value="features" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* 기능별 사용 순위 */}
            <Card>
              <CardHeader><CardTitle className="text-base">기능별 사용 순위</CardTitle></CardHeader>
              <CardContent>
                {featureUsage.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">이벤트 데이터가 없습니다.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={featureUsage} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="count" name="사용 횟수" fill="#f59e0b" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 페이지 조회 순위 */}
            <Card>
              <CardHeader><CardTitle className="text-base">페이지 조회 순위</CardTitle></CardHeader>
              <CardContent>
                {pageViewRanking.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">페이지뷰 데이터가 없습니다.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>페이지</TableHead>
                        <TableHead className="text-right">조회수</TableHead>
                        <TableHead className="text-right">평균 체류</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageViewRanking.map(item => (
                        <TableRow key={item.page_path}>
                          <TableCell className="font-medium">{item.page_title}</TableCell>
                          <TableCell className="text-right">{item.count.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm text-gray-500">{formatDuration(item.avg_duration)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== 업무 효율 탭 ===== */}
        <TabsContent value="efficiency" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">평균 회수 처리일</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-4xl font-bold text-blue-600">
                    {efficiencyMetrics.avgProcessingDays > 0 ? `${efficiencyMetrics.avgProcessingDays}일` : '-'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">회수대기 → 입고완료</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">처리 건수</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-4xl font-bold text-green-600">
                    {efficiencyMetrics.dailyProcessingVolume.reduce((a, b) => a + b.count, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">기간 내 상태 변경</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">참여 법인</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-4xl font-bold text-amber-600">
                    {efficiencyMetrics.branchResponseTimes.length}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">회수 처리 참여</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* 일별 처리량 */}
            <Card>
              <CardHeader><CardTitle className="text-base">일별 처리량 추이</CardTitle></CardHeader>
              <CardContent>
                {efficiencyMetrics.dailyProcessingVolume.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">처리 데이터가 없습니다.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={efficiencyMetrics.dailyProcessingVolume}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="처리 건수" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 법인 응답 시간 */}
            <Card>
              <CardHeader><CardTitle className="text-base">법인별 평균 응답 시간</CardTitle></CardHeader>
              <CardContent>
                {efficiencyMetrics.branchResponseTimes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">응답 데이터가 없습니다.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>법인코드</TableHead>
                        <TableHead className="text-right">평균 응답(일)</TableHead>
                        <TableHead className="text-right">처리 건수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {efficiencyMetrics.branchResponseTimes.slice(0, 15).map(item => (
                        <TableRow key={item.branch_code}>
                          <TableCell className="font-medium">{item.branch_code}</TableCell>
                          <TableCell className="text-right">{item.avg_days}일</TableCell>
                          <TableCell className="text-right">{item.total_changes}건</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== 활동 히트맵 탭 ===== */}
        <TabsContent value="heatmap" className="space-y-6">
          {/* 요일 x 시간 히트맵 */}
          <Card>
            <CardHeader><CardTitle className="text-base">요일 x 시간대 활동 히트맵</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {/* 시간 레이블 */}
                <div className="flex items-center mb-1">
                  <div className="w-10 shrink-0" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="w-6 text-center text-[10px] text-gray-400 shrink-0">
                      {h}
                    </div>
                  ))}
                </div>

                {/* 히트맵 그리드 — 월~일 순서 */}
                {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => (
                  <div key={dayIdx} className="flex items-center mb-0.5">
                    <div className="w-10 text-xs text-gray-500 shrink-0 text-right pr-2">
                      {DAY_LABELS[dayIdx]}
                    </div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const cell = heatmapData.find(c => c.day === dayIdx && c.hour === h);
                      const value = cell?.value || 0;
                      return (
                        <div
                          key={h}
                          className="w-6 h-6 rounded-sm shrink-0 cursor-pointer transition-transform hover:scale-110"
                          style={{ backgroundColor: getHeatmapColor(value, heatmapMax), margin: '0.5px' }}
                          title={`${DAY_LABELS[dayIdx]} ${h}시: ${value}회`}
                        />
                      );
                    })}
                  </div>
                ))}

                {/* 범례 */}
                <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                  <span>적음</span>
                  {[0, 0.25, 0.5, 0.75, 1].map(intensity => (
                    <div
                      key={intensity}
                      className="w-4 h-4 rounded-sm"
                      style={{
                        backgroundColor: intensity === 0
                          ? '#f3f4f6'
                          : `rgb(${Math.round(239 - intensity * 180)}, ${Math.round(246 - intensity * 180)}, ${Math.round(255 - intensity * 25)})`,
                      }}
                    />
                  ))}
                  <span>많음</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 법인 x 기능 히트맵 */}
          <Card>
            <CardHeader><CardTitle className="text-base">법인 x 기능 사용 히트맵</CardTitle></CardHeader>
            <CardContent>
              {branchFeatureHeatmap.branches.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">법인 이벤트 데이터가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  {/* 기능 레이블 */}
                  <div className="flex items-center mb-1">
                    <div className="w-16 shrink-0" />
                    {branchFeatureHeatmap.featureTypes.map(ft => (
                      <div key={ft} className="w-20 text-center text-[10px] text-gray-400 shrink-0 truncate px-0.5">
                        {EVENT_TYPE_LABELS[ft] || ft}
                      </div>
                    ))}
                  </div>

                  {/* 히트맵 그리드 */}
                  {branchFeatureHeatmap.branches.map(branch => (
                    <div key={branch} className="flex items-center mb-0.5">
                      <div className="w-16 text-xs text-gray-500 shrink-0 text-right pr-2 truncate">
                        {branch}
                      </div>
                      {branchFeatureHeatmap.featureTypes.map(ft => {
                        const cell = branchFeatureHeatmap.cells.find(c => c.branch === branch && c.feature === ft);
                        const value = cell?.value || 0;
                        return (
                          <div
                            key={ft}
                            className="w-20 h-7 rounded-sm shrink-0 cursor-pointer flex items-center justify-center text-[10px] transition-transform hover:scale-105"
                            style={{
                              backgroundColor: getHeatmapColor(value, branchFeatureMax),
                              margin: '0.5px',
                              color: value > branchFeatureMax * 0.5 ? 'white' : '#6b7280',
                            }}
                            title={`${branch} - ${EVENT_TYPE_LABELS[ft] || ft}: ${value}회`}
                          >
                            {value > 0 ? value : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* 범례 */}
                  <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                    <span>적음</span>
                    {[0, 0.25, 0.5, 0.75, 1].map(intensity => (
                      <div
                        key={intensity}
                        className="w-4 h-4 rounded-sm"
                        style={{
                          backgroundColor: intensity === 0
                            ? '#f3f4f6'
                            : `rgb(${Math.round(239 - intensity * 180)}, ${Math.round(246 - intensity * 180)}, ${Math.round(255 - intensity * 25)})`,
                        }}
                      />
                    ))}
                    <span>많음</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
