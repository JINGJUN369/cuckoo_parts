'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/common/StatusBadge';
import { supabase } from '@/lib/supabase/client';
import { LoginHistory, StatusChangeHistory, UploadHistory, RecoveryMaterialHistory } from '@/types';

export default function HistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusChangeHistory[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [materialHistory, setMaterialHistory] = useState<RecoveryMaterialHistory[]>([]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 병렬로 모든 이력 조회
      const [loginRes, statusRes, uploadRes, materialRes] = await Promise.all([
        supabase.from('login_history').select('*').order('login_at', { ascending: false }).limit(100),
        supabase.from('status_change_history').select('*').order('changed_at', { ascending: false }).limit(100),
        supabase.from('upload_history').select('*').order('uploaded_at', { ascending: false }).limit(100),
        supabase.from('recovery_material_history').select('*').order('action_at', { ascending: false }).limit(100),
      ]);

      setLoginHistory(loginRes.data || []);
      setStatusHistory(statusRes.data || []);
      setUploadHistory(uploadRes.data || []);
      setMaterialHistory(materialRes.data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 사용자 유형 표시
  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'admin_cs':
        return '고객만족팀CS';
      case 'admin_quality':
        return 'CUCKOO품질팀';
      case 'branch':
        return '설치법인';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">이력 데이터 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">이력 조회</h1>
        <p className="text-muted-foreground">시스템 활동 이력을 조회합니다.</p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">업로드 이력</TabsTrigger>
          <TabsTrigger value="material">자재설정 이력</TabsTrigger>
          <TabsTrigger value="status">상태변경 이력</TabsTrigger>
          <TabsTrigger value="login">로그인 이력</TabsTrigger>
        </TabsList>

        {/* 업로드 이력 */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>업로드 이력 (최근 100건)</CardTitle>
            </CardHeader>
            <CardContent>
              {uploadHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>파일명</TableHead>
                      <TableHead className="text-right">총 건수</TableHead>
                      <TableHead className="text-right">저장</TableHead>
                      <TableHead className="text-right">폐기</TableHead>
                      <TableHead className="text-right">중복</TableHead>
                      <TableHead>업로드자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(h.uploaded_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {h.file_name}
                        </TableCell>
                        <TableCell className="text-right">{h.total_rows?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {(h.saved_rows || h.new_rows || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {(h.discarded_rows || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {h.duplicate_rows?.toLocaleString()}
                        </TableCell>
                        <TableCell>{h.uploaded_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  업로드 이력이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 자재설정 이력 */}
        <TabsContent value="material">
          <Card>
            <CardHeader>
              <CardTitle>자재설정 이력 (최근 100건)</CardTitle>
            </CardHeader>
            <CardContent>
              {materialHistory.length > 0 ? (
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
                    {materialHistory.map((h) => (
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
                  자재설정 이력이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 상태변경 이력 */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>상태변경 이력 (최근 100건)</CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>요청번호</TableHead>
                      <TableHead>이관처</TableHead>
                      <TableHead>자재코드</TableHead>
                      <TableHead>이전상태</TableHead>
                      <TableHead>변경상태</TableHead>
                      <TableHead>운송회사/송장</TableHead>
                      <TableHead>처리자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(h.changed_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell className="font-medium">{h.request_number}</TableCell>
                        <TableCell>{h.branch_code}</TableCell>
                        <TableCell>{h.material_code}</TableCell>
                        <TableCell>
                          <StatusBadge status={h.previous_status} size="sm" />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={h.new_status} size="sm" />
                        </TableCell>
                        <TableCell className="text-sm">
                          {h.carrier && h.tracking_number
                            ? `${h.carrier} / ${h.tracking_number}`
                            : '-'}
                        </TableCell>
                        <TableCell>{h.changed_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  상태변경 이력이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 로그인 이력 */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>로그인 이력 (최근 100건)</CardTitle>
            </CardHeader>
            <CardContent>
              {loginHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>사용자</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(h.login_at).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell className="font-medium">{h.user_code}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getUserTypeLabel(h.user_type)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{h.ip_address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  로그인 이력이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
