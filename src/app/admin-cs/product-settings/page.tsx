'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  CheckSquare,
  Package,
  Info,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useProductRecovery } from '@/hooks/useProductRecovery';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function ProductSettingsPage() {
  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hooks
  const {
    selectForRecovery,
    getUnselected,
    getStats: getProductStats,
    autoRecoveryPrefixes,
  } = useProductRecovery();
  const { session } = useAuth();

  // 미선택 제품 데이터
  const unselectedData = useMemo(() => getUnselected(), [getUnselected]);
  const productStats = useMemo(() => getProductStats(), [getProductStats]);

  // 제품 모델 목록 (필터용)
  const modelList = useMemo(() => {
    const models = new Set(unselectedData.map(item => item.model_name));
    return Array.from(models).sort();
  }, [unselectedData]);

  // 필터링된 미선택 제품 데이터
  const filteredUnselected = useMemo(() => {
    return unselectedData.filter(item => {
      const matchesSearch = !searchTerm ||
        item.customer_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesModel = modelFilter === 'all' || item.model_name === modelFilter;
      const matchesType = typeFilter === 'all' || item.recovery_type === typeFilter;

      return matchesSearch && matchesModel && matchesType;
    });
  }, [unselectedData, searchTerm, modelFilter, typeFilter]);

  // 선택 핸들러
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredUnselected.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUnselected.map(item => item.id)));
    }
  }, [selectedIds.size, filteredUnselected]);

  const handleRegisterRecovery = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('선택된 항목이 없습니다.');
      return;
    }

    try {
      await selectForRecovery(Array.from(selectedIds), session?.userCode || 'ADMIN');
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size}건이 회수대상으로 등록되었습니다.`);
    } catch (error) {
      console.error('Register error:', error);
      toast.error('등록 중 오류가 발생했습니다.');
    }
  }, [selectedIds, selectForRecovery, session]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6" />
          회수대상 제품설정
        </h1>
        <p className="text-muted-foreground">자동선택 조건에 해당하지 않는 제품을 수동으로 회수대상으로 등록합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-800">{productStats.total}</div>
            <div className="text-sm text-muted-foreground">전체</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{productStats.unselected}</div>
            <div className="text-sm text-muted-foreground">미선택</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{productStats.waiting}</div>
            <div className="text-sm text-muted-foreground">회수대기</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{productStats.received}</div>
            <div className="text-sm text-muted-foreground">입고완료</div>
          </CardContent>
        </Card>
      </div>

      {/* 자동선택 기준 안내 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>자동 회수대상 선택 기준</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-1 text-sm">
            <p>다음 조건을 <strong>모두 만족</strong>하면 업로드 시 자동으로 회수대상에 등록됩니다:</p>
            <ul className="list-disc list-inside ml-2">
              <li>모델명이 <strong>{autoRecoveryPrefixes.join(', ')}</strong>로 시작 (비데, 버블클렌저)</li>
              <li>계약일로부터 해지요청일까지 <strong>1년 이내</strong></li>
            </ul>
            <p className="text-muted-foreground mt-2">아래 목록은 자동선택 조건에 해당하지 않아 수동 검토가 필요한 항목입니다.</p>
          </div>
        </AlertDescription>
      </Alert>

      {/* 미선택 항목 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                미선택 항목 ({filteredUnselected.length}건)
              </CardTitle>
              <CardDescription>체크박스로 선택 후 회수대상으로 등록할 수 있습니다.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 유형</SelectItem>
                  <SelectItem value="철거">철거</SelectItem>
                  <SelectItem value="불량교환">불량교환</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="모델 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 모델</SelectItem>
                  {modelList.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleRegisterRecovery} disabled={selectedIds.size === 0}>
                선택 항목 회수대상 등록 ({selectedIds.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUnselected.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.size === filteredUnselected.length && filteredUnselected.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>고객번호</TableHead>
                    <TableHead>고객명</TableHead>
                    <TableHead>모델명</TableHead>
                    <TableHead>요청지점</TableHead>
                    <TableHead>작업의뢰</TableHead>
                    <TableHead>계약일</TableHead>
                    <TableHead>해지요청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnselected.slice(0, 100).map((item) => (
                    <TableRow key={item.id} className={selectedIds.has(item.id) ? 'bg-blue-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => handleToggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                          {item.recovery_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                      <TableCell>{item.customer_name}</TableCell>
                      <TableCell>
                        {item.model_name}
                        {item.is_auto_recovery_model && (
                          <Badge variant="outline" className="ml-1 text-xs">회수모델</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{item.request_branch}</TableCell>
                      <TableCell className="text-sm">{item.work_request_medium}</TableCell>
                      <TableCell className="text-sm">{item.contract_date}</TableCell>
                      <TableCell className="text-sm">
                        {item.termination_request_date}
                        {item.is_within_one_year && (
                          <Badge variant="outline" className="ml-1 text-xs text-orange-600">1년이내</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {unselectedData.length === 0 ? (
                <>
                  <p className="text-lg font-medium">미선택 항목이 없습니다.</p>
                  <p className="text-sm mt-1">모든 제품이 회수대상으로 선택되었거나, 아직 업로드된 데이터가 없습니다.</p>
                </>
              ) : (
                <p>검색 결과가 없습니다.</p>
              )}
            </div>
          )}
          {filteredUnselected.length > 100 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              처음 100건만 표시됩니다. 검색을 활용해주세요.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
