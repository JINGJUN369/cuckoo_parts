'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Package, Clock, TruckIcon, CheckCircle2, Calendar, AlertTriangle, Filter } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export default function BranchDashboardPage() {
  const [selectedItem, setSelectedItem] = useState<MaterialUsage | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showBulkShippingModal, setShowBulkShippingModal] = useState(false);
  const [showOverdueWarning, setShowOverdueWarning] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  // 필터 상태
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [groupByTechnician, setGroupByTechnician] = useState(false);

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

  // 본인 법인 데이터
  const branchData = useMemo(() => {
    if (!session?.branchCode) return [];
    return getByBranch(session.branchCode);
  }, [getByBranch, session]);

  // 기사코드 목록
  const technicianCodes = useMemo(() => {
    const codes = new Set<string>();
    branchData.forEach(item => {
      if (item.technician_code) {
        codes.add(item.technician_code);
      }
    });
    return Array.from(codes).sort();
  }, [branchData]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return branchData.filter(item => {
      // 날짜 필터
      if (dateFrom || dateTo) {
        const itemDate = item.process_time || item.receipt_time || item.created_at;
        if (itemDate) {
          const itemDateOnly = itemDate.split('T')[0];
          if (dateFrom && itemDateOnly < dateFrom) return false;
          if (dateTo && itemDateOnly > dateTo) return false;
        }
      }
      // 기사코드 필터
      if (technicianFilter !== 'all' && item.technician_code !== technicianFilter) {
        return false;
      }
      return true;
    });
  }, [branchData, dateFrom, dateTo, technicianFilter]);

  // 상태별 데이터
  const waitingData = useMemo(() => filteredData.filter((item) => item.status === '회수대기'), [filteredData]);
  const collectedData = useMemo(() => filteredData.filter((item) => item.status === '회수완료'), [filteredData]);
  const shippedData = useMemo(() => filteredData.filter((item) => item.status === '발송'), [filteredData]);

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

  // 기사코드별 그룹화
  const groupedByTechnician = useMemo(() => {
    if (!groupByTechnician) return null;

    const groups: Record<string, MaterialUsage[]> = {};
    collectedData.forEach(item => {
      const key = item.technician_code || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [collectedData, groupByTechnician]);

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

  // 필터 초기화
  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTechnicianFilter('all');
  };

  // 상태별 통계
  const stats = useMemo(() => ({
    total: filteredData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
    overdue: overdueItems.length,
  }), [filteredData, waitingData, collectedData, shippedData, overdueItems]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">회수 관리 대시보드</h1>
        <p className="text-muted-foreground">회수대상 부품을 관리하고 발송합니다.</p>
      </div>

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

      {/* 필터 영역 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-base">필터</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">시작일</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">종료일</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">기사코드</label>
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {technicianCodes.map(code => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleResetFilters}>
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="전체 회수대상"
          value={stats.total.toLocaleString()}
          icon={Package}
        />
        <StatCard
          title="회수대기"
          value={stats.waiting.toLocaleString()}
          icon={Clock}
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="회수완료"
          value={stats.collected.toLocaleString()}
          icon={CheckCircle2}
          className="border-l-4 border-l-amber-500"
        />
        <StatCard
          title="발송완료"
          value={stats.shipped.toLocaleString()}
          icon={TruckIcon}
          className="border-l-4 border-l-blue-500"
        />
        {stats.overdue > 0 && (
          <StatCard
            title="6일 경과"
            value={stats.overdue.toLocaleString()}
            icon={AlertTriangle}
            className="border-l-4 border-l-red-600 bg-red-50"
          />
        )}
      </div>

      {/* 탭 */}
      <Tabs defaultValue="waiting">
        <TabsList>
          <TabsTrigger value="waiting">
            회수대기 ({stats.waiting})
          </TabsTrigger>
          <TabsTrigger value="collected">
            회수완료 ({stats.collected})
            {stats.overdue > 0 && (
              <Badge variant="destructive" className="ml-1">{stats.overdue}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="shipped">
            발송완료 ({stats.shipped})
          </TabsTrigger>
        </TabsList>

        {/* 회수대기 탭 */}
        <TabsContent value="waiting">
          <Card>
            <CardHeader>
              <CardTitle>회수대기 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {waitingData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>요청번호</TableHead>
                      <TableHead>기사코드</TableHead>
                      <TableHead>모델명</TableHead>
                      <TableHead>자재코드</TableHead>
                      <TableHead>자재명</TableHead>
                      <TableHead>수량</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="w-[120px]">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waitingData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.request_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.technician_code || '-'}</Badge>
                        </TableCell>
                        <TableCell>{item.model_name}</TableCell>
                        <TableCell>{item.material_code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.material_name}</TableCell>
                        <TableCell>{item.output_quantity}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} size="sm" />
                        </TableCell>
                        <TableCell>
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
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  회수대기 중인 건이 없습니다.
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
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={groupByTechnician}
                      onCheckedChange={(checked) => setGroupByTechnician(!!checked)}
                    />
                    기사코드별 그룹화
                  </label>
                  {selectedItems.size > 0 && (
                    <Button onClick={() => setShowBulkShippingModal(true)}>
                      <TruckIcon className="h-4 w-4 mr-2" />
                      선택 일괄발송 ({selectedItems.size})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {collectedData.length > 0 ? (
                <>
                  {groupByTechnician && groupedByTechnician ? (
                    // 기사코드별 그룹화 뷰
                    Object.entries(groupedByTechnician).map(([techCode, items]) => (
                      <div key={techCode} className="mb-6">
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <Badge>{techCode}</Badge>
                          <span className="text-muted-foreground text-sm">({items.length}건)</span>
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">
                                <Checkbox
                                  checked={items.every(item => selectedItems.has(item.id))}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedItems);
                                    items.forEach(item => {
                                      if (checked) {
                                        newSelected.add(item.id);
                                      } else {
                                        newSelected.delete(item.id);
                                      }
                                    });
                                    setSelectedItems(newSelected);
                                  }}
                                />
                              </TableHead>
                              <TableHead>요청번호</TableHead>
                              <TableHead>자재코드</TableHead>
                              <TableHead>자재명</TableHead>
                              <TableHead>수량</TableHead>
                              <TableHead>회수일시</TableHead>
                              <TableHead>경과일</TableHead>
                              <TableHead className="w-[100px]">액션</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => {
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
                                  <TableCell>{item.material_code}</TableCell>
                                  <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                                  <TableCell>{item.output_quantity}</TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR') : '-'}
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
                      </div>
                    ))
                  ) : (
                    // 일반 리스트 뷰
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
                          <TableHead>기사코드</TableHead>
                          <TableHead>자재코드</TableHead>
                          <TableHead>자재명</TableHead>
                          <TableHead>수량</TableHead>
                          <TableHead>회수일시</TableHead>
                          <TableHead>경과일</TableHead>
                          <TableHead>상태</TableHead>
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
                              <TableCell>
                                <Badge variant="outline">{item.technician_code || '-'}</Badge>
                              </TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                              <TableCell>{item.output_quantity}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR') : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                  D+{daysPassed}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={item.status} size="sm" />
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
                  )}
                </>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  발송 대기 중인 건이 없습니다.
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
                        <TableCell>
                          <Badge variant="outline">{item.technician_code || '-'}</Badge>
                        </TableCell>
                        <TableCell>{item.material_code}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
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
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  발송 완료된 건이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
