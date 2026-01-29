'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useRecoveryMaterials } from '@/hooks/useRecoveryMaterials';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { toast } from 'sonner';

export default function MaterialsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<{ code: string; name: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [materialToRemove, setMaterialToRemove] = useState<string | null>(null);

  const { data } = useMaterialUsage();
  const { materials, addMaterial, removeMaterial, getActiveMaterials, getHistory } = useRecoveryMaterials();
  const { session } = useAuth();

  // 활성 회수대상 자재 목록
  const activeMaterials = useMemo(() => getActiveMaterials(), [getActiveMaterials]);

  // 이력
  const history = useMemo(() => getHistory(), [getHistory]);

  // 업로드된 데이터에서 고유 자재 목록 추출
  const uniqueMaterials = useMemo(() => {
    const materialMap = new Map<string, string>();
    data.forEach((item) => {
      if (!materialMap.has(item.material_code)) {
        materialMap.set(item.material_code, item.material_name || '');
      }
    });
    return Array.from(materialMap.entries()).map(([code, name]) => ({ code, name }));
  }, [data]);

  // 검색 필터링
  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return uniqueMaterials.filter(
      (m) =>
        m.code.toLowerCase().includes(term) ||
        m.name.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [uniqueMaterials, searchTerm]);

  // 등록된 자재인지 확인
  const isRegistered = (code: string) => {
    return activeMaterials.some((m) => m.material_code === code);
  };

  // 자재 등록
  const handleAdd = () => {
    if (!selectedMaterial || !session) return;

    const result = addMaterial(selectedMaterial.code, selectedMaterial.name, session.userCode);
    if (result.success) {
      toast.success(result.message);
      setShowAddModal(false);
      setSelectedMaterial(null);
      setSearchTerm('');
    } else {
      toast.error(result.message);
    }
  };

  // 자재 해제
  const handleRemove = () => {
    if (!materialToRemove || !session) return;

    const result = removeMaterial(materialToRemove, session.userCode);
    if (result.success) {
      toast.success(result.message);
      setShowRemoveModal(false);
      setMaterialToRemove(null);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">회수대상 자재 설정</h1>
        <p className="text-muted-foreground">회수대상 자재를 등록하거나 해제합니다.</p>
      </div>

      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">자재 목록</TabsTrigger>
          <TabsTrigger value="history">설정 이력</TabsTrigger>
        </TabsList>

        {/* 자재 목록 탭 */}
        <TabsContent value="materials" className="space-y-4">
          {/* 검색 및 등록 */}
          <Card>
            <CardHeader>
              <CardTitle>자재 검색 및 등록</CardTitle>
              <CardDescription>
                업로드된 데이터에서 자재를 검색하여 회수대상으로 등록합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="자재코드 또는 자재명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 검색 결과 */}
              {filteredMaterials.length > 0 && (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>자재코드</TableHead>
                        <TableHead>자재명</TableHead>
                        <TableHead className="w-[100px]">상태</TableHead>
                        <TableHead className="w-[100px]">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaterials.map((m) => (
                        <TableRow key={m.code}>
                          <TableCell className="font-medium">{m.code}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{m.name}</TableCell>
                          <TableCell>
                            {isRegistered(m.code) ? (
                              <Badge variant="default">등록됨</Badge>
                            ) : (
                              <Badge variant="outline">미등록</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!isRegistered(m.code) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMaterial(m);
                                  setShowAddModal(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {searchTerm && filteredMaterials.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  검색 결과가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 등록된 회수대상 자재 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>등록된 회수대상 자재 ({activeMaterials.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
              {activeMaterials.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>자재코드</TableHead>
                      <TableHead>자재명</TableHead>
                      <TableHead>등록자</TableHead>
                      <TableHead>등록일시</TableHead>
                      <TableHead className="w-[100px]">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMaterials.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.material_code}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{m.material_name}</TableCell>
                        <TableCell>{m.created_by}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(m.created_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setMaterialToRemove(m.material_code);
                              setShowRemoveModal(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  등록된 회수대상 자재가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 이력 탭 */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                자재 설정 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>자재코드</TableHead>
                      <TableHead>자재명</TableHead>
                      <TableHead>작업</TableHead>
                      <TableHead>처리자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 100).map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(h.action_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell className="font-medium">{h.material_code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{h.material_name}</TableCell>
                        <TableCell>
                          <Badge variant={h.action === '등록' ? 'default' : 'secondary'}>
                            {h.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{h.action_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  설정 이력이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 등록 확인 모달 */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회수대상 자재 등록</DialogTitle>
            <DialogDescription>
              다음 자재를 회수대상으로 등록하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {selectedMaterial && (
            <div className="py-4">
              <p><strong>자재코드:</strong> {selectedMaterial.code}</p>
              <p><strong>자재명:</strong> {selectedMaterial.name}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              취소
            </Button>
            <Button onClick={handleAdd}>
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 해제 확인 모달 */}
      <ConfirmModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={handleRemove}
        title="회수대상 자재 해제"
        description="이 자재를 회수대상에서 해제하시겠습니까? 기존에 등록된 회수대기 건은 유지됩니다."
        confirmText="해제"
        variant="destructive"
      />
    </div>
  );
}
