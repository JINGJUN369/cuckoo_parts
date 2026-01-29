'use client';

import { useMemo, useState } from 'react';
import { TruckIcon, PackageCheck, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { exportToExcel } from '@/lib/excel';

export default function AdminQualityDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const { getByStatus, getStats } = useMaterialUsage();

  // 발송 상태 데이터
  const shippedData = useMemo(() => getByStatus('발송'), [getByStatus]);
  const stats = useMemo(() => getStats(), [getStats]);

  // 고유 법인 목록
  const branches = useMemo(() => {
    const branchSet = new Set(shippedData.map((item) => item.branch_code));
    return Array.from(branchSet).sort();
  }, [shippedData]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return shippedData.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.material_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === 'all' || item.branch_code === branchFilter;

      return matchesSearch && matchesBranch;
    });
  }, [shippedData, searchTerm, branchFilter]);

  // 엑셀 내보내기
  const handleExport = () => {
    exportToExcel(filteredData, 'shipped_data');
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">발송현황 대시보드</h1>
        <p className="text-muted-foreground">설치법인에서 발송한 부품 현황을 확인합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="발송중"
          value={stats.shipped.toLocaleString()}
          icon={TruckIcon}
          description="현재 발송 진행 중인 건수"
          className="border-l-4 border-l-blue-500"
        />
        <StatCard
          title="입고완료"
          value={stats.received.toLocaleString()}
          icon={PackageCheck}
          description="입고 완료된 건수"
          className="border-l-4 border-l-green-500"
        />
        <StatCard
          title="전체 회수대상"
          value={stats.total.toLocaleString()}
          description="전체 회수대상 건수"
        />
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>발송 목록 ({filteredData.length}건)</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="검색 (요청번호, 자재코드, 자재명)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[300px]"
              />
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="전체 법인" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 법인</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                엑셀 내보내기
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>요청번호</TableHead>
                    <TableHead>이관처</TableHead>
                    <TableHead>자재코드</TableHead>
                    <TableHead>자재명</TableHead>
                    <TableHead>운송회사</TableHead>
                    <TableHead>송장번호</TableHead>
                    <TableHead>발송일시</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.request_number}</TableCell>
                      <TableCell>{item.branch_code}</TableCell>
                      <TableCell>{item.material_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.material_name}</TableCell>
                      <TableCell>{item.carrier}</TableCell>
                      <TableCell>{item.tracking_number}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.shipped_at
                          ? new Date(item.shipped_at).toLocaleString('ko-KR')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              발송된 건이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
