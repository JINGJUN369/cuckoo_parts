'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, UserCog, Key } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface User {
  id: string;
  user_code: string;
  user_type: string;
  is_default_password: boolean;
  is_active: boolean;
  branch_code: string | null;
  email: string | null;
  created_at: string;
  last_login_at: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const { getUsers, resetPassword } = useAuth();

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      toast.error('사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(users.filter(user =>
        user.user_code.toLowerCase().includes(term) ||
        user.user_type.toLowerCase().includes(term) ||
        (user.branch_code && user.branch_code.toLowerCase().includes(term))
      ));
    }
  }, [searchTerm, users]);

  const handleResetPassword = async () => {
    if (!resetTarget) return;

    const result = await resetPassword(resetTarget.user_code);
    if (result.success) {
      toast.success(`${resetTarget.user_code}의 비밀번호가 초기화되었습니다.`);
      setResetTarget(null);
      loadUsers();
    } else {
      toast.error(result.error);
    }
  };

  const getUserTypeBadge = (type: string) => {
    switch (type) {
      case 'admin_cs':
        return <Badge className="bg-blue-100 text-blue-700">고객만족팀CS</Badge>;
      case 'admin_quality':
        return <Badge className="bg-green-100 text-green-700">CUCKOO품질팀</Badge>;
      case 'branch':
        return <Badge className="bg-orange-100 text-orange-700">설치법인</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserCog className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">사용자 관리</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>등록된 사용자</CardTitle>
          <CardDescription>
            비밀번호 초기화 및 사용자 상태를 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="사용자 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자 ID</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>법인코드</TableHead>
                  <TableHead>비밀번호 상태</TableHead>
                  <TableHead>계정 상태</TableHead>
                  <TableHead>마지막 로그인</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {isLoading ? '로딩 중...' : '등록된 사용자가 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.user_code}</TableCell>
                      <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                      <TableCell>{user.branch_code || '-'}</TableCell>
                      <TableCell>
                        {user.is_default_password ? (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            초기 비밀번호
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            변경됨
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge className="bg-green-100 text-green-700">활성</Badge>
                        ) : (
                          <Badge variant="secondary">비활성</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_login_at ? formatDate(user.last_login_at) : '없음'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetTarget(user)}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          <Key className="h-4 w-4 mr-1" />
                          비밀번호 초기화
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            총 {filteredUsers.length}명의 사용자
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 초기화 확인 모달 */}
      <Dialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화</DialogTitle>
            <DialogDescription>
              <strong>{resetTarget?.user_code}</strong>의 비밀번호를 초기화하시겠습니까?
              <br />
              비밀번호가 사용자 ID와 동일하게 설정됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              취소
            </Button>
            <Button onClick={handleResetPassword} className="bg-orange-600 hover:bg-orange-700">
              초기화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
