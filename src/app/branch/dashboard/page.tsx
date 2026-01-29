'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Package, Clock, TruckIcon, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  const { getByBranch, updateStatus, getCarriers } = useMaterialUsage();
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

  // 상태별 데이터
  const waitingData = useMemo(() => branchData.filter((item) => item.status === '회수대기'), [branchData]);
  const collectedData = useMemo(() => branchData.filter((item) => item.status === '회수완료'), [branchData]);
  const shippedData = useMemo(() => branchData.filter((item) => item.status === '발송'), [branchData]);

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

  // 발송 처리
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

  // 상태별 통계
  const stats = useMemo(() => ({
    total: branchData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
  }), [branchData, waitingData, collectedData, shippedData]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">회수 관리 대시보드</h1>
        <p className="text-muted-foreground">회수대상 부품을 관리하고 발송합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      {/* 탭 */}
      <Tabs defaultValue="waiting">
        <TabsList>
          <TabsTrigger value="waiting">
            회수대기 ({stats.waiting})
          </TabsTrigger>
          <TabsTrigger value="collected">
            회수완료 ({stats.collected})
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
              <CardTitle>회수완료 목록 (발송 대기)</CardTitle>
            </CardHeader>
            <CardContent>
              {collectedData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>요청번호</TableHead>
                      <TableHead>모델명</TableHead>
                      <TableHead>자재코드</TableHead>
                      <TableHead>자재명</TableHead>
                      <TableHead>수량</TableHead>
                      <TableHead>회수일시</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="w-[100px]">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectedData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.request_number}</TableCell>
                        <TableCell>{item.model_name}</TableCell>
                        <TableCell>{item.material_code}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                        <TableCell>{item.output_quantity}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.collected_at
                            ? new Date(item.collected_at).toLocaleString('ko-KR')
                            : '-'}
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
                    ))}
                  </TableBody>
                </Table>
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

      {/* 발송 정보 모달 */}
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
    </div>
  );
}
