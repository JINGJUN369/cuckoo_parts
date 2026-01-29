'use client';

import { useMemo, useState, useCallback } from 'react';
import { Package, TruckIcon, PackageCheck, Clock, Search, ChevronLeft } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { MaterialUsage, RecoveryStatus } from '@/types';
import { toast } from 'sonner';

const STATUS_COLORS = {
  '회수대기': '#ef4444',
  '회수완료': '#f59e0b',
  '발송': '#3b82f6',
  '입고완료': '#22c55e',
};

export default function AdminCSDashboardPage() {
  const { data, getStats, getRecoveryTargets, updateStatus } = useMaterialUsage();
  const { session } = useAuth();

  // 법인 상세 보기 상태
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [isSearched, setIsSearched] = useState(false);

  const stats = useMemo(() => getStats(), [getStats]);
  const recoveryTargets = useMemo(() => getRecoveryTargets(), [getRecoveryTargets]);

  // 법인 목록
  const branchList = useMemo(() => {
    const branches = new Set<string>();
    recoveryTargets.forEach(item => branches.add(item.branch_code));
    return Array.from(branches).sort();
  }, [recoveryTargets]);

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
      .sort((a, b) => b.total - a.total);
  }, [recoveryTargets]);

  // 법인 선택 시 오늘 날짜 기본값 설정
  const handleSelectBranch = (branch: string) => {
    setSelectedBranch(branch);
    const today = new Date().toISOString().split('T')[0];
    setSearchDateFrom(today);
    setSearchDateTo(today);
    setIsSearched(false);
  };

  // 검색 실행
  const handleSearch = () => {
    setAppliedDateFrom(searchDateFrom);
    setAppliedDateTo(searchDateTo);
    setIsSearched(true);
  };

  // 선택된 법인의 데이터
  const branchData = useMemo(() => {
    if (!selectedBranch) return [];
    return recoveryTargets.filter(item => item.branch_code === selectedBranch);
  }, [recoveryTargets, selectedBranch]);

  // 검색된 데이터
  const searchedData = useMemo(() => {
    if (!isSearched) return [];

    return branchData.filter(item => {
      const itemDate = item.process_time || item.receipt_time || item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedDateFrom && itemDateOnly < appliedDateFrom) return false;
        if (appliedDateTo && itemDateOnly > appliedDateTo) return false;
      }
      return true;
    });
  }, [branchData, appliedDateFrom, appliedDateTo, isSearched]);

  // 상태별 데이터
  const waitingData = useMemo(() => searchedData.filter(item => item.status === '회수대기'), [searchedData]);
  const collectedData = useMemo(() => searchedData.filter(item => item.status === '회수완료'), [searchedData]);
  const shippedData = useMemo(() => searchedData.filter(item => item.status === '발송'), [searchedData]);

  // 기사코드별 그룹화
  const waitingByTechnician = useMemo(() => {
    const groups: Record<string, MaterialUsage[]> = {};
    waitingData.forEach(item => {
      const key = item.technician_code || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [waitingData]);

  // 상태 강제 변경
  const handleForceStatusChange = async (item: MaterialUsage, newStatus: RecoveryStatus) => {
    if (!session) return;

    try {
      await updateStatus(item.id, newStatus, session.userCode);
      toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);
    } catch (error) {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 법인별 통계
  const branchTotalStats = useMemo(() => {
    const waiting = branchData.filter(item => item.status === '회수대기').length;
    const collected = branchData.filter(item => item.status === '회수완료').length;
    const shipped = branchData.filter(item => item.status === '발송').length;
    const received = branchData.filter(item => item.status === '입고완료').length;
    return { total: branchData.length, waiting, collected, shipped, received };
  }, [branchData]);

  // 검색 결과 통계
  const searchStats = useMemo(() => ({
    total: searchedData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
  }), [searchedData, waitingData, collectedData, shippedData]);

  // 법인 상세 보기 모드
  if (selectedBranch) {
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedBranch(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            돌아가기
          </Button>
          <div>
            <h1 className="text-2xl font-bold">법인 상세 현황: {selectedBranch}</h1>
            <p className="text-muted-foreground">관리자 모드 - 상태 강제 변경 가능</p>
          </div>
        </div>

        {/* 법인 전체 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="전체" value={branchTotalStats.total.toLocaleString()} icon={Package} />
          <StatCard title="회수대기" value={branchTotalStats.waiting.toLocaleString()} icon={Clock} className="border-l-4 border-l-red-500" />
          <StatCard title="회수완료" value={branchTotalStats.collected.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-amber-500" />
          <StatCard title="발송" value={branchTotalStats.shipped.toLocaleString()} icon={TruckIcon} className="border-l-4 border-l-blue-500" />
          <StatCard title="입고완료" value={branchTotalStats.received.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-green-500" />
        </div>

        {/* 날짜 검색 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">날짜 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">시작일</label>
                <Input type="date" value={searchDateFrom} onChange={(e) => setSearchDateFrom(e.target.value)} className="w-44" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">종료일</label>
                <Input type="date" value={searchDateTo} onChange={(e) => setSearchDateTo(e.target.value)} className="w-44" />
              </div>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                검색
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 검색 결과 */}
        {isSearched && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">검색 기간: {appliedDateFrom} ~ {appliedDateTo}</p>
              <div className="flex gap-6 text-sm">
                <span>회수대기: <strong className="text-red-600">{searchStats.waiting}건</strong></span>
                <span>회수완료: <strong className="text-amber-600">{searchStats.collected}건</strong></span>
                <span>발송: <strong className="text-blue-600">{searchStats.shipped}건</strong></span>
              </div>
            </div>

            <Tabs defaultValue="waiting">
              <TabsList>
                <TabsTrigger value="waiting">회수대기 ({searchStats.waiting})</TabsTrigger>
                <TabsTrigger value="collected">회수완료 ({searchStats.collected})</TabsTrigger>
                <TabsTrigger value="shipped">발송 ({searchStats.shipped})</TabsTrigger>
              </TabsList>

              {/* 회수대기 탭 */}
              <TabsContent value="waiting">
                <Card>
                  <CardHeader>
                    <CardTitle>회수대기 목록 (기사별)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {waitingByTechnician.length > 0 ? (
                      <div className="space-y-6">
                        {waitingByTechnician.map(([techCode, items]) => (
                          <div key={techCode} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                              <Badge className="text-base px-3 py-1">{techCode}</Badge>
                              <span className="text-muted-foreground">({items.length}건)</span>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>요청번호</TableHead>
                                  <TableHead>처리시간</TableHead>
                                  <TableHead>모델명</TableHead>
                                  <TableHead>자재코드</TableHead>
                                  <TableHead>자재명</TableHead>
                                  <TableHead>수량</TableHead>
                                  <TableHead>상태변경</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.request_number}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </TableCell>
                                    <TableCell>{item.model_name}</TableCell>
                                    <TableCell>{item.material_code}</TableCell>
                                    <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                                    <TableCell>{item.output_quantity}</TableCell>
                                    <TableCell>
                                      <Select onValueChange={(value) => handleForceStatusChange(item, value as RecoveryStatus)}>
                                        <SelectTrigger className="w-28 h-8">
                                          <SelectValue placeholder="변경" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="회수완료">회수완료</SelectItem>
                                          <SelectItem value="발송">발송</SelectItem>
                                          <SelectItem value="입고완료">입고완료</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 회수대기 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 회수완료 탭 */}
              <TabsContent value="collected">
                <Card>
                  <CardHeader>
                    <CardTitle>회수완료 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {collectedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>요청번호</TableHead>
                            <TableHead>처리시간</TableHead>
                            <TableHead>기사코드</TableHead>
                            <TableHead>자재코드</TableHead>
                            <TableHead>자재명</TableHead>
                            <TableHead>회수일시</TableHead>
                            <TableHead>상태변경</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collectedData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.request_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell><Badge variant="outline">{item.technician_code || '-'}</Badge></TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Select onValueChange={(value) => handleForceStatusChange(item, value as RecoveryStatus)}>
                                  <SelectTrigger className="w-28 h-8">
                                    <SelectValue placeholder="변경" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="회수대기">회수대기</SelectItem>
                                    <SelectItem value="발송">발송</SelectItem>
                                    <SelectItem value="입고완료">입고완료</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 회수완료 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 발송 탭 */}
              <TabsContent value="shipped">
                <Card>
                  <CardHeader>
                    <CardTitle>발송 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {shippedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>요청번호</TableHead>
                            <TableHead>처리시간</TableHead>
                            <TableHead>기사코드</TableHead>
                            <TableHead>자재코드</TableHead>
                            <TableHead>운송회사</TableHead>
                            <TableHead>송장번호</TableHead>
                            <TableHead>발송일시</TableHead>
                            <TableHead>상태변경</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shippedData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.request_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell><Badge variant="outline">{item.technician_code || '-'}</Badge></TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell>{item.carrier}</TableCell>
                              <TableCell>{item.tracking_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Select onValueChange={(value) => handleForceStatusChange(item, value as RecoveryStatus)}>
                                  <SelectTrigger className="w-28 h-8">
                                    <SelectValue placeholder="변경" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="회수대기">회수대기</SelectItem>
                                    <SelectItem value="회수완료">회수완료</SelectItem>
                                    <SelectItem value="입고완료">입고완료</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 발송 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {!isSearched && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">날짜를 선택하고 검색 버튼을 눌러주세요.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // 기본 대시보드 모드
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">전체 현황 대시보드</h1>
        <p className="text-muted-foreground">회수 자재 전체 현황을 확인합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="총 회수대상" value={stats.total.toLocaleString()} icon={Package} description="전체 회수대상 건수" />
        <StatCard title="회수대기" value={stats.waiting.toLocaleString()} icon={Clock} description="회수 대기 중인 건수" className="border-l-4 border-l-red-500" />
        <StatCard title="발송중" value={stats.shipped.toLocaleString()} icon={TruckIcon} description="발송 진행 중인 건수" className="border-l-4 border-l-blue-500" />
        <StatCard title="입고완료" value={stats.received.toLocaleString()} icon={PackageCheck} description="입고 완료된 건수" className="border-l-4 border-l-green-500" />
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
                  <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">데이터가 없습니다.</div>
            )}
          </CardContent>
        </Card>

        {/* 법인별 현황 차트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">법인별 현황 (상위 10개)</CardTitle>
          </CardHeader>
          <CardContent>
            {branchStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchStats.slice(0, 10)} layout="vertical">
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
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">데이터가 없습니다.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 법인별 현황 테이블 - 클릭하여 상세보기 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">법인별 현황 (클릭하여 상세보기)</CardTitle>
        </CardHeader>
        <CardContent>
          {branchStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>법인코드</TableHead>
                  <TableHead className="text-center">회수대기</TableHead>
                  <TableHead className="text-center">회수완료</TableHead>
                  <TableHead className="text-center">발송</TableHead>
                  <TableHead className="text-center">입고완료</TableHead>
                  <TableHead className="text-center">합계</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchStats.map((branch) => (
                  <TableRow key={branch.branch} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSelectBranch(branch.branch)}>
                    <TableCell className="font-medium">{branch.branch}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-50 text-red-700">{branch.waiting}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">{branch.collected}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">{branch.shipped}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50 text-green-700">{branch.received}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{branch.total}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">상세보기</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">아직 데이터가 없습니다.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
