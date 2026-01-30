'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Package, Clock, TruckIcon, CheckCircle2, AlertTriangle, Search, Printer, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ShippingModal } from '@/components/modals/ShippingModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useAuth } from '@/hooks/useAuth';
import { MaterialUsage, Carrier } from '@/types';
import { toast } from 'sonner';

// 날짜 프리셋 타입
type DatePreset = 'today' | 'yesterday' | 'week' | 'thisMonth' | 'lastMonth' | 'last30days';

// 날짜 프리셋 계산 함수
function getDateRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: formatDate(yesterday), to: formatDate(yesterday) };
    }
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return { from: formatDate(weekAgo), to: formatDate(today) };
    }
    case 'thisMonth': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDate(firstDay), to: formatDate(today) };
    }
    case 'lastMonth': {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: formatDate(lastMonthStart), to: formatDate(lastMonthEnd) };
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      return { from: formatDate(thirtyDaysAgo), to: formatDate(today) };
    }
  }
}

export default function BranchDashboardPage() {
  const [selectedItem, setSelectedItem] = useState<MaterialUsage | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showBulkShippingModal, setShowBulkShippingModal] = useState(false);
  const [showOverdueWarning, setShowOverdueWarning] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  // 검색 상태
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [isSearched, setIsSearched] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset | null>('last30days');

  const { getByBranch, updateStatus, updateStatusBulk, getCarriers } = useMaterialUsage();
  const { session } = useAuth();

  // 운송회사 목록 로드
  const loadCarriers = useCallback(async () => {
    const carrierList = await getCarriers();
    setCarriers(carrierList);
  }, [getCarriers]);

  useEffect(() => {
    loadCarriers();
  }, [loadCarriers]);

  // 기본 날짜 설정 (최근 30일)
  useEffect(() => {
    const range = getDateRange('last30days');
    setSearchDateFrom(range.from);
    setSearchDateTo(range.to);
    // 자동 검색 실행
    setAppliedDateFrom(range.from);
    setAppliedDateTo(range.to);
    setIsSearched(true);
  }, []);

  // 본인 법인 데이터
  const branchData = useMemo(() => {
    if (!session?.branchCode) return [];
    return getByBranch(session.branchCode);
  }, [getByBranch, session]);

  // 날짜 프리셋 선택
  const handlePresetSelect = (preset: DatePreset) => {
    const range = getDateRange(preset);
    setSearchDateFrom(range.from);
    setSearchDateTo(range.to);
    setSelectedPreset(preset);
  };

  // 검색 실행
  const handleSearch = () => {
    setAppliedDateFrom(searchDateFrom);
    setAppliedDateTo(searchDateTo);
    setIsSearched(true);
  };

  // 검색된 데이터 (날짜 필터 적용)
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
  const waitingData = useMemo(() => searchedData.filter((item) => item.status === '회수대기'), [searchedData]);
  const collectedData = useMemo(() => searchedData.filter((item) => item.status === '회수완료'), [searchedData]);
  const shippedData = useMemo(() => searchedData.filter((item) => item.status === '발송'), [searchedData]);

  // 기사코드별 회수대기 그룹화
  const waitingByTechnician = useMemo(() => {
    const groups: Record<string, MaterialUsage[]> = {};
    waitingData.forEach(item => {
      const key = item.technician_code || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // 기사코드 정렬
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [waitingData]);

  // 기사별 현황 통계 (필터된 데이터 기준)
  const technicianStats = useMemo(() => {
    const stats: Record<string, { waiting: number; collected: number; shipped: number; total: number }> = {};

    searchedData.forEach(item => {
      const tech = item.technician_code || '미지정';
      if (!stats[tech]) {
        stats[tech] = { waiting: 0, collected: 0, shipped: 0, total: 0 };
      }
      stats[tech].total++;

      switch (item.status) {
        case '회수대기':
          stats[tech].waiting++;
          break;
        case '회수완료':
          stats[tech].collected++;
          break;
        case '발송':
        case '입고완료':
          stats[tech].shipped++;
          break;
      }
    });

    // 정렬: 회수대기 많은 순 → 전체 많은 순
    return Object.entries(stats)
      .map(([tech, data]) => ({ tech, ...data }))
      .sort((a, b) => b.waiting - a.waiting || b.total - a.total);
  }, [searchedData]);

  // 6일 경과 회수완료 건 체크
  const overdueItems = useMemo(() => {
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    return collectedData.filter(item => {
      if (!item.collected_at) return false;
      const collectedDate = new Date(item.collected_at);
      return collectedDate < sixDaysAgo;
    });
  }, [collectedData]);

  // 경고 팝업 표시
  useEffect(() => {
    if (overdueItems.length > 0) {
      setShowOverdueWarning(true);
    }
  }, [overdueItems]);

  // 전체 선택
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(collectedData.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // 개별 선택
  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  // 회수완료 처리
  const handleCollect = async () => {
    if (!selectedItem || !session) return;

    try {
      await updateStatus(selectedItem.id, '회수완료', session.userCode);
      toast.success('회수완료 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowCollectModal(false);
    setSelectedItem(null);
  };

  // 단건 발송 처리
  const handleShip = async (carrier: string, trackingNumber: string) => {
    if (!selectedItem || !session) return;

    try {
      await updateStatus(selectedItem.id, '발송', session.userCode, { carrier, tracking_number: trackingNumber });
      toast.success('발송 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowShippingModal(false);
    setSelectedItem(null);
  };

  // 일괄 발송 처리
  const handleBulkShip = async (carrier: string, trackingNumber: string) => {
    if (selectedItems.size === 0 || !session) return;

    try {
      const ids = Array.from(selectedItems);
      await updateStatusBulk(ids, '발송', session.userCode, { carrier, tracking_number: trackingNumber });
      toast.success(`${ids.length}건이 일괄 발송 처리되었습니다.`);
      setSelectedItems(new Set());
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowBulkShippingModal(false);
  };

  // 인쇄
  const handlePrint = () => {
    window.print();
  };

  // 상태별 통계 (필터된 데이터 기준)
  const totalStats = useMemo(() => ({
    total: searchedData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
  }), [searchedData, waitingData, collectedData, shippedData]);

  // 검색 결과 통계
  const searchStats = useMemo(() => ({
    total: searchedData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
    overdue: overdueItems.length,
  }), [searchedData, waitingData, collectedData, shippedData, overdueItems]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">회수 관리 대시보드</h1>
        <p className="text-muted-foreground">법인코드: {session?.branchCode}</p>
      </div>

      {/* 날짜 검색 (최상단) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            조회 기간
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 빠른 선택 버튼 */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedPreset === 'last30days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('last30days')}
              >
                최근 30일
              </Button>
              <Button
                variant={selectedPreset === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('today')}
              >
                오늘
              </Button>
              <Button
                variant={selectedPreset === 'yesterday' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('yesterday')}
              >
                어제
              </Button>
              <Button
                variant={selectedPreset === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('week')}
              >
                1주일
              </Button>
              <Button
                variant={selectedPreset === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('thisMonth')}
              >
                이번달
              </Button>
              <Button
                variant={selectedPreset === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('lastMonth')}
              >
                저번달
              </Button>
            </div>

            {/* 날짜 입력 */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">시작일</label>
                <Input
                  type="date"
                  value={searchDateFrom}
                  onChange={(e) => {
                    setSearchDateFrom(e.target.value);
                    setSelectedPreset(null);
                  }}
                  className="w-44"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">종료일</label>
                <Input
                  type="date"
                  value={searchDateTo}
                  onChange={(e) => {
                    setSearchDateTo(e.target.value);
                    setSelectedPreset(null);
                  }}
                  className="w-44"
                />
              </div>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                검색
              </Button>
              {isSearched && (
                <Button variant="outline" onClick={handlePrint} className="print:hidden">
                  <Printer className="h-4 w-4 mr-2" />
                  인쇄
                </Button>
              )}
            </div>

            {/* 조회 기간 표시 */}
            {isSearched && (
              <p className="text-sm text-muted-foreground pt-2 border-t">
                조회 기간: <strong>{appliedDateFrom}</strong> ~ <strong>{appliedDateTo}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6일 경과 경고 */}
      {overdueItems.length > 0 && showOverdueWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>발송 필요 알림</AlertTitle>
          <AlertDescription>
            회수 후 6일이 경과한 부품이 {overdueItems.length}건 있습니다.
            빠른 시일 내 발송해주세요.
            <Button
              variant="link"
              className="p-0 h-auto ml-2 text-red-700 underline"
              onClick={() => setShowOverdueWarning(false)}
            >
              닫기
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 현황 통계 (필터 적용) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="전체 회수대상"
          value={totalStats.total.toLocaleString()}
          icon={Package}
        />
        <StatCard
          title="회수대기"
          value={totalStats.waiting.toLocaleString()}
          icon={Clock}
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="회수완료 (발송대기)"
          value={totalStats.collected.toLocaleString()}
          icon={CheckCircle2}
          className="border-l-4 border-l-amber-500"
        />
        <StatCard
          title="발송완료"
          value={totalStats.shipped.toLocaleString()}
          icon={TruckIcon}
          className="border-l-4 border-l-blue-500"
        />
      </div>

      {/* 기사별 회수 현황 (필터 적용) */}
      {technicianStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              기사별 회수 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {technicianStats.slice(0, 9).map(({ tech, waiting, collected, shipped, total }) => {
                const completedRate = total > 0 ? Math.round(((collected + shipped) / total) * 100) : 0;
                return (
                  <div
                    key={tech}
                    className={`p-3 rounded-lg border ${waiting > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="font-semibold">{tech}</Badge>
                      <span className="text-xs text-muted-foreground">총 {total}건</span>
                    </div>
                    {/* 진행률 바 */}
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                        style={{ width: `${completedRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600 font-medium">대기 {waiting}</span>
                      <span className="text-amber-600">완료 {collected}</span>
                      <span className="text-blue-600">발송 {shipped}</span>
                      <span className="text-green-600 font-medium">{completedRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {technicianStats.length > 9 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                외 {technicianStats.length - 9}명의 기사
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 상세 데이터 탭 */}
      {isSearched && (
        <>
          {/* 탭 */}
          <Tabs defaultValue="waiting">
            <TabsList className="print:hidden">
              <TabsTrigger value="waiting">
                회수대기 ({searchStats.waiting})
              </TabsTrigger>
              <TabsTrigger value="collected">
                회수완료 ({searchStats.collected})
                {searchStats.overdue > 0 && (
                  <Badge variant="destructive" className="ml-1">{searchStats.overdue}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="shipped">
                발송완료 ({searchStats.shipped})
              </TabsTrigger>
            </TabsList>

            {/* 회수대기 탭 - 기사별 그룹화 */}
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
                                <TableHead className="w-[130px]">요청번호</TableHead>
                                <TableHead>처리시간</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>자재코드</TableHead>
                                <TableHead>자재명</TableHead>
                                <TableHead className="w-[60px]">수량</TableHead>
                                <TableHead className="w-[100px] print:hidden">액션</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.request_number}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.process_time
                                      ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                      : '-'}
                                  </TableCell>
                                  <TableCell>{item.model_name}</TableCell>
                                  <TableCell>{item.material_code}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{item.material_name}</TableCell>
                                  <TableCell>{item.output_quantity}</TableCell>
                                  <TableCell className="print:hidden">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setShowCollectModal(true);
                                      }}
                                    >
                                      회수완료
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 회수대기 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 회수완료 탭 */}
            <TabsContent value="collected">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>회수완료 목록 (발송 대기)</CardTitle>
                    {selectedItems.size > 0 && (
                      <Button onClick={() => setShowBulkShippingModal(true)}>
                        <TruckIcon className="h-4 w-4 mr-2" />
                        선택 일괄발송 ({selectedItems.size})
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {collectedData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={collectedData.length > 0 && collectedData.every(item => selectedItems.has(item.id))}
                              onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            />
                          </TableHead>
                          <TableHead>요청번호</TableHead>
                          <TableHead>처리시간</TableHead>
                          <TableHead>기사코드</TableHead>
                          <TableHead>자재코드</TableHead>
                          <TableHead>자재명</TableHead>
                          <TableHead>수량</TableHead>
                          <TableHead>회수일시</TableHead>
                          <TableHead>경과일</TableHead>
                          <TableHead className="w-[100px]">액션</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collectedData.map((item) => {
                          const daysPassed = item.collected_at
                            ? Math.floor((new Date().getTime() - new Date(item.collected_at).getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                          const isOverdue = daysPassed >= 6;

                          return (
                            <TableRow key={item.id} className={isOverdue ? 'bg-red-50' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedItems.has(item.id)}
                                  onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{item.request_number}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.process_time
                                  ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.technician_code || '-'}</Badge>
                              </TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                              <TableCell>{item.output_quantity}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                  D+{daysPassed}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setShowShippingModal(true);
                                  }}
                                >
                                  발송
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 발송 대기 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 발송완료 탭 */}
            <TabsContent value="shipped">
              <Card>
                <CardHeader>
                  <CardTitle>발송완료 목록</CardTitle>
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
                          <TableHead>자재명</TableHead>
                          <TableHead>운송회사</TableHead>
                          <TableHead>송장번호</TableHead>
                          <TableHead>발송일시</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shippedData.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.request_number}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.process_time
                                ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.technician_code || '-'}</Badge>
                            </TableCell>
                            <TableCell>{item.material_code}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                            <TableCell>{item.carrier}</TableCell>
                            <TableCell>{item.tracking_number}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.shipped_at
                                ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={item.status} size="sm" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 발송 완료 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* 검색 전 안내 */}
      {!isSearched && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">날짜를 선택하고 검색 버튼을 눌러주세요.</p>
            <p className="text-sm mt-2">검색 결과가 기사별로 그룹화되어 표시됩니다.</p>
          </CardContent>
        </Card>
      )}

      {/* 회수완료 확인 모달 */}
      <ConfirmModal
        isOpen={showCollectModal}
        onClose={() => {
          setShowCollectModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleCollect}
        title="회수완료 처리"
        description={`요청번호 ${selectedItem?.request_number}의 부품을 회수완료 처리하시겠습니까?`}
        confirmText="회수완료"
      />

      {/* 단건 발송 정보 모달 */}
      <ShippingModal
        isOpen={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleShip}
        carriers={carriers}
        requestNumber={selectedItem?.request_number || ''}
      />

      {/* 일괄 발송 모달 */}
      <ShippingModal
        isOpen={showBulkShippingModal}
        onClose={() => setShowBulkShippingModal(false)}
        onConfirm={handleBulkShip}
        carriers={carriers}
        requestNumber={`일괄 발송 (${selectedItems.size}건)`}
        isBulk={true}
      />

      {/* 인쇄용 전용 영역 */}
      <div className="hidden print:block print-area">
        <div className="print-header">
          <h1>부품 회수 목록</h1>
          <div className="print-meta">
            <span>법인코드: {session?.branchCode}</span>
            <span>검색기간: {appliedDateFrom} ~ {appliedDateTo}</span>
            <span>출력일시: {new Date().toLocaleString('ko-KR')}</span>
          </div>
          <div className="print-summary">
            <span>회수대기: {searchStats.waiting}건</span>
            <span>회수완료: {searchStats.collected}건</span>
            <span>발송완료: {searchStats.shipped}건</span>
          </div>
        </div>

        {/* 회수대기 목록 - 기사별 */}
        {waitingByTechnician.length > 0 && (
          <div className="print-section">
            <h2>■ 회수대기 목록</h2>
            {waitingByTechnician.map(([techCode, items]) => (
              <div key={techCode} className="print-group">
                <h3>기사코드: {techCode} ({items.length}건)</h3>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>요청번호</th>
                      <th style={{ width: '15%' }}>처리시간</th>
                      <th style={{ width: '15%' }}>모델명</th>
                      <th style={{ width: '15%' }}>자재코드</th>
                      <th style={{ width: '30%' }}>자재명</th>
                      <th style={{ width: '10%' }}>수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.request_number}</td>
                        <td>{item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td>{item.model_name}</td>
                        <td>{item.material_code}</td>
                        <td>{item.material_name}</td>
                        <td>{item.output_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* 회수완료 목록 */}
        {collectedData.length > 0 && (
          <div className="print-section">
            <h2>■ 회수완료 목록 (발송대기)</h2>
            <table>
              <thead>
                <tr>
                  <th>요청번호</th>
                  <th>처리시간</th>
                  <th>기사코드</th>
                  <th>자재코드</th>
                  <th>자재명</th>
                  <th>수량</th>
                  <th>회수일시</th>
                  <th>경과일</th>
                </tr>
              </thead>
              <tbody>
                {collectedData.map((item) => {
                  const daysPassed = item.collected_at
                    ? Math.floor((new Date().getTime() - new Date(item.collected_at).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <tr key={item.id}>
                      <td>{item.request_number}</td>
                      <td>{item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td>{item.technician_code || '-'}</td>
                      <td>{item.material_code}</td>
                      <td>{item.material_name}</td>
                      <td>{item.output_quantity}</td>
                      <td>{item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td>D+{daysPassed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 발송완료 목록 */}
        {shippedData.length > 0 && (
          <div className="print-section">
            <h2>■ 발송완료 목록</h2>
            <table>
              <thead>
                <tr>
                  <th>요청번호</th>
                  <th>처리시간</th>
                  <th>기사코드</th>
                  <th>자재코드</th>
                  <th>자재명</th>
                  <th>운송회사</th>
                  <th>송장번호</th>
                  <th>발송일시</th>
                </tr>
              </thead>
              <tbody>
                {shippedData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.request_number}</td>
                    <td>{item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>{item.technician_code || '-'}</td>
                    <td>{item.material_code}</td>
                    <td>{item.material_name}</td>
                    <td>{item.carrier}</td>
                    <td>{item.tracking_number}</td>
                    <td>{item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          /* 기본 페이지 숨김 */
          body * {
            visibility: hidden;
          }

          /* 인쇄 영역만 표시 */
          .print-area, .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10mm;
            font-size: 10pt;
          }

          /* 인쇄용 헤더 */
          .print-header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
          }

          .print-header h1 {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 8px;
          }

          .print-meta {
            display: flex;
            justify-content: center;
            gap: 20px;
            font-size: 9pt;
            color: #555;
            margin-bottom: 8px;
          }

          .print-summary {
            display: flex;
            justify-content: center;
            gap: 30px;
            font-size: 10pt;
            font-weight: 500;
          }

          /* 섹션 */
          .print-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .print-section h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #999;
          }

          /* 기사별 그룹 */
          .print-group {
            margin-bottom: 15px;
            page-break-inside: avoid;
          }

          .print-group h3 {
            font-size: 10pt;
            font-weight: bold;
            background: #f0f0f0;
            padding: 5px 8px;
            margin-bottom: 5px;
          }

          /* 테이블 스타일 */
          .print-area table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          .print-area th,
          .print-area td {
            border: 1px solid #333;
            padding: 4px 6px;
            text-align: left;
          }

          .print-area th {
            background: #e0e0e0;
            font-weight: bold;
            text-align: center;
          }

          .print-area td {
            word-break: break-all;
          }

          /* 페이지 나눔 */
          .print-section {
            break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }

        /* 화면에서는 인쇄 영역 숨김 */
        @media screen {
          .print-area {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
