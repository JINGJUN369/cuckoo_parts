'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, Users, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicianNames } from '@/hooks/useTechnicianNames';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function BranchSettingsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { technicianNames, isLoading, saveName, removeName } = useTechnicianNames(session?.branchCode);
  const [techCodesFromData, setTechCodesFromData] = useState<string[]>([]);

  // 해당 법인의 기사코드 목록을 DB에서 직접 조회
  useEffect(() => {
    if (!session?.branchCode) return;
    const loadTechCodes = async () => {
      const { data } = await supabase
        .from('material_usage')
        .select('technician_code')
        .eq('branch_code', session.branchCode!)
        .eq('is_recovery_target', true)
        .not('technician_code', 'is', null);
      if (data) {
        const codes = [...new Set(data.map(d => d.technician_code as string))].sort();
        setTechCodesFromData(codes);
      }
    };
    loadTechCodes();
  }, [session?.branchCode]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const allTechCodes = techCodesFromData;

  const registeredCodes = new Set(technicianNames.map(t => t.technician_code));
  const unregisteredCodes = allTechCodes.filter(code => !registeredCodes.has(code));

  // 검색 필터
  const filteredNames = useMemo(() => {
    if (!searchTerm) return technicianNames;
    const term = searchTerm.toLowerCase();
    return technicianNames.filter(
      t => t.technician_code.toLowerCase().includes(term) || t.technician_name.toLowerCase().includes(term)
    );
  }, [technicianNames, searchTerm]);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) {
      toast.error('기사코드와 이름을 모두 입력해주세요.');
      return;
    }
    try {
      await saveName(newCode.trim(), newName.trim());
      toast.success(`${newName.trim()} (${newCode.trim()}) 등록되었습니다.`);
      setNewCode('');
      setNewName('');
      setShowAddModal(false);
    } catch {
      toast.error('등록 중 오류가 발생했습니다.');
    }
  };

  const handleEdit = async (code: string) => {
    if (!editName.trim()) {
      toast.error('이름을 입력해주세요.');
      return;
    }
    try {
      await saveName(code, editName.trim());
      toast.success('이름이 수정되었습니다.');
      setEditingCode(null);
      setEditName('');
    } catch {
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (code: string) => {
    try {
      await removeName(code);
      toast.success('삭제되었습니다.');
      setDeleteTarget(null);
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleQuickAdd = async (code: string) => {
    setNewCode(code);
    setNewName('');
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/branch/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          대시보드
        </Button>
        <div>
          <h1 className="text-xl font-bold">기사 코드-이름 설정</h1>
          <p className="text-sm text-muted-foreground">
            기사코드에 이름을 매핑하면 대시보드에서 이름으로 표시됩니다.
          </p>
        </div>
      </div>

      {/* 미등록 기사코드 안내 */}
      {unregisteredCodes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-800 flex items-center gap-2">
              <Users className="h-4 w-4" />
              이름 미등록 기사코드 ({unregisteredCodes.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unregisteredCodes.map(code => (
                <Badge
                  key={code}
                  variant="outline"
                  className="cursor-pointer hover:bg-amber-100 border-amber-300 text-amber-800"
                  onClick={() => handleQuickAdd(code)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {code}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              클릭하면 바로 이름을 등록할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 등록된 기사 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              등록된 기사 목록 ({technicianNames.length}건)
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="검색..."
                className="pl-8 w-[180px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto" />
            </div>
          ) : filteredNames.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기사코드</TableHead>
                  <TableHead>기사이름</TableHead>
                  <TableHead>대시보드 표시</TableHead>
                  <TableHead className="w-[120px] text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNames.map((item) => (
                  <TableRow key={item.technician_code}>
                    <TableCell>
                      <Badge variant="outline">{item.technician_code}</Badge>
                    </TableCell>
                    <TableCell>
                      {editingCode === item.technician_code ? (
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 w-[140px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEdit(item.technician_code);
                              if (e.key === 'Escape') setEditingCode(null);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(item.technician_code)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCode(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium">{item.technician_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {item.technician_name}({item.technician_code})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingCode !== item.technician_code && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCode(item.technician_code);
                              setEditName(item.technician_name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(item.technician_code)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? '검색 결과가 없습니다.' : '등록된 기사가 없습니다. 위에서 추가해주세요.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 추가 모달 */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>기사 이름 등록</DialogTitle>
            <DialogDescription>기사코드에 매핑할 이름을 입력해주세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>기사코드</Label>
              <Input
                value={newCode}
                readOnly
                className="bg-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label>기사이름</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 홍길동"
                autoFocus={!!newCode}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
              />
            </div>
            {newCode && newName && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <span className="text-muted-foreground">대시보드 표시: </span>
                <span className="font-medium">{newName}({newCode})</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>취소</Button>
            <Button onClick={handleAdd} disabled={!newCode.trim() || !newName.trim()}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">기사 이름 삭제</DialogTitle>
            <DialogDescription>
              {deleteTarget} 의 이름 매핑을 삭제하시겠습니까?
              삭제 후 대시보드에서 코드번호로 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
