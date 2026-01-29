'use client';

import { useMemo, useState } from 'react';
import { PackageCheck, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function ReceivePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { getByStatus, updateStatus } = useMaterialUsage();
  const { session } = useAuth();

  // 발송 상태 데이터
  const shippedData = useMemo(() => getByStatus('발송'), [getByStatus]);

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
        item.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === 'all' || item.branch_code === branchFilter;

      return matchesSearch && matchesBranch;
    });
  }, [shippedData, searchTerm, branchFilter]);

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredData.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택
  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // 입고완료 처리
  const handleReceive = () => {
    if (selectedIds.size === 0 || !session) return;

    selectedIds.forEach((id) => {
      updateStatus(id, '입고완료', session.userCode);
    });

    toast.success(`${selectedIds.size}건 입고완료 처리되었습니다.`);
    setSelectedIds(new Set());
    setShowConfirmModal(false);
  };

  // 단건 입고완료 처리
  const handleSingleReceive = (id: string) => {
    if (!session) return;

    updateStatus(id, '입고완료', session.userCode);
    toast.success('입고완료 처리되었습니다.');
  };

  const isAllSelected = filteredData.length > 0 && selectedIds.size === filteredData.length;
  const isPartialSelected = selectedIds.size > 0 && selectedIds.size < filteredData.length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">입고완료 처리</h1>
        <p className="text-muted-foreground">발송된 부품의 입고를 확인하고 완료 처리합니다.</p>
      </div>

      {/* 필터 및 일괄 처리 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>발송 목록 ({filteredData.length}건)</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="검색 (요청번호, 자재코드, 송장번호)"
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
            </div>
          </div>

          {/* 일괄 처리 버튼 */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size}건 선택됨
              </span>
              <Button onClick={() => setShowConfirmModal(true)}>
                <PackageCheck className="h-4 w-4 mr-2" />
                선택 항목 입고완료
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        // @ts-ignore - indeterminate is valid HTML attribute
                        indeterminate={isPartialSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>요청번호</TableHead>
                    <TableHead>이관처</TableHead>
                    <TableHead>자재코드</TableHead>
                    <TableHead>자재명</TableHead>
                    <TableHead>운송회사</TableHead>
                    <TableHead>송장번호</TableHead>
                    <TableHead>발송일시</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-[100px]">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) => handleSelect(item.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.request_number}</TableCell>
                      <TableCell>{item.branch_code}</TableCell>
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
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSingleReceive(item.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              입고 대기 중인 건이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 일괄 입고완료 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleReceive}
        title="입고완료 처리"
        description={`선택한 ${selectedIds.size}건을 입고완료 처리하시겠습니까?`}
        confirmText="입고완료"
      />
    </div>
  );
}
