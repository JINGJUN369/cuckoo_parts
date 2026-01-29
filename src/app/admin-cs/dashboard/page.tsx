'use client';

import { useMemo } from 'react';
import { Package, TruckIcon, PackageCheck, Clock } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const STATUS_COLORS = {
  '회수대기': '#ef4444',
  '회수완료': '#f59e0b',
  '발송': '#3b82f6',
  '입고완료': '#22c55e',
};

export default function AdminCSDashboardPage() {
  const { data, getStats, getRecoveryTargets } = useMaterialUsage();

  const stats = useMemo(() => getStats(), [getStats]);
  const recoveryTargets = useMemo(() => getRecoveryTargets(), [getRecoveryTargets]);

  // 상태별 분포 (파이 차트용)
  const statusDistribution = useMemo(() => [
    { name: '회수대기', value: stats.waiting, color: STATUS_COLORS['회수대기'] },
    { name: '회수완료', value: stats.collected, color: STATUS_COLORS['회수완료'] },
    { name: '발송', value: stats.shipped, color: STATUS_COLORS['발송'] },
    { name: '입고완료', value: stats.received, color: STATUS_COLORS['입고완료'] },
  ], [stats]);

  // 법인별 현황 (바 차트용)
  const branchStats = useMemo(() => {
    const branchMap: Record<string, { waiting: number; collected: number; shipped: number; received: number }> = {};

    recoveryTargets.forEach((item) => {
      if (!branchMap[item.branch_code]) {
        branchMap[item.branch_code] = { waiting: 0, collected: 0, shipped: 0, received: 0 };
      }

      switch (item.status) {
        case '회수대기':
          branchMap[item.branch_code].waiting++;
          break;
        case '회수완료':
          branchMap[item.branch_code].collected++;
          break;
        case '발송':
          branchMap[item.branch_code].shipped++;
          break;
        case '입고완료':
          branchMap[item.branch_code].received++;
          break;
      }
    });

    return Object.entries(branchMap)
      .map(([branch, counts]) => ({
        branch,
        ...counts,
        total: counts.waiting + counts.collected + counts.shipped + counts.received,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [recoveryTargets]);

  // 최근 활동
  const recentActivity = useMemo(() => {
    return [...recoveryTargets]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [recoveryTargets]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">전체 현황 대시보드</h1>
        <p className="text-muted-foreground">회수 자재 전체 현황을 확인합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 회수대상"
          value={stats.total.toLocaleString()}
          icon={Package}
          description="전체 회수대상 건수"
        />
        <StatCard
          title="회수대기"
          value={stats.waiting.toLocaleString()}
          icon={Clock}
          description="회수 대기 중인 건수"
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="발송중"
          value={stats.shipped.toLocaleString()}
          icon={TruckIcon}
          description="발송 진행 중인 건수"
          className="border-l-4 border-l-blue-500"
        />
        <StatCard
          title="입고완료"
          value={stats.received.toLocaleString()}
          icon={PackageCheck}
          description="입고 완료된 건수"
          className="border-l-4 border-l-green-500"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 상태별 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">상태별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                데이터가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* 법인별 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">법인별 현황 (상위 10개)</CardTitle>
          </CardHeader>
          <CardContent>
            {branchStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="branch" type="category" width={60} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="waiting" name="회수대기" stackId="a" fill={STATUS_COLORS['회수대기']} />
                  <Bar dataKey="collected" name="회수완료" stackId="a" fill={STATUS_COLORS['회수완료']} />
                  <Bar dataKey="shipped" name="발송" stackId="a" fill={STATUS_COLORS['발송']} />
                  <Bar dataKey="received" name="입고완료" stackId="a" fill={STATUS_COLORS['입고완료']} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                데이터가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 활동 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최근 활동</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>요청번호</TableHead>
                  <TableHead>이관처</TableHead>
                  <TableHead>자재코드</TableHead>
                  <TableHead>자재명</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>최종 수정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.request_number}</TableCell>
                    <TableCell>{item.branch_code}</TableCell>
                    <TableCell>{item.material_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.material_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.updated_at).toLocaleString('ko-KR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              아직 데이터가 없습니다. 엑셀 파일을 업로드해주세요.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
