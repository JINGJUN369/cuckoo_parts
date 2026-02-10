'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Mail, Save, Eye, EyeOff, TestTube, Database, Trash2, Download, AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  description: string;
  updated_at: string;
}

export default function AdminSettingsPage() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // 데이터 관리 상태
  const [dataType, setDataType] = useState<'material_usage' | 'product_recovery'>('material_usage');
  const [deleteFromDate, setDeleteFromDate] = useState('');
  const [deleteToDate, setDeleteToDate] = useState('');
  const [dataToDelete, setDataToDelete] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // 설정 로드
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach((item: SystemSetting) => {
        settingsMap[item.setting_key] = item.setting_value || '';
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Settings load error:', error);
      toast.error('설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 설정 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ setting_value: update.setting_value, updated_at: update.updated_at })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }

      toast.success('설정이 저장되었습니다.');
    } catch (error) {
      console.error('Settings save error:', error);
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 설정 변경
  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // 테스트 이메일 발송
  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('테스트 이메일 주소를 입력해주세요.');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-code': encodeURIComponent(session?.userCode || ''),
        },
        body: JSON.stringify({
          recipients: [testEmail],
          subject: '[테스트] 부품회수시스템 이메일 테스트',
          message: '이 메일은 부품회수시스템에서 발송한 테스트 메일입니다.\n\n설정이 올바르게 되었습니다!',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.simulation) {
          toast.success('테스트 이메일이 시뮬레이션되었습니다. (API Key 설정 필요)');
        } else {
          toast.success('테스트 이메일이 발송되었습니다.');
        }
      } else {
        toast.error(data.error || '이메일 발송에 실패했습니다.');
      }
    } catch (error) {
      toast.error('이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsTesting(false);
    }
  };

  const hasApiKey = settings.resend_api_key && settings.resend_api_key.length > 0;

  // 삭제 대상 데이터 미리보기
  const handlePreviewDelete = async () => {
    if (!deleteFromDate || !deleteToDate) {
      toast.error('삭제할 기간을 선택해주세요.');
      return;
    }

    if (deleteFromDate > deleteToDate) {
      toast.error('시작일이 종료일보다 늦습니다.');
      return;
    }

    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .from(dataType)
        .select('*')
        .gte('created_at', `${deleteFromDate}T00:00:00`)
        .lte('created_at', `${deleteToDate}T23:59:59`);

      if (error) throw error;

      setDataToDelete(data || []);
      if (data && data.length > 0) {
        toast.success(`${data.length}건의 데이터가 검색되었습니다.`);
      } else {
        toast.info('해당 기간에 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 데이터 백업 다운로드
  const handleBackupDownload = () => {
    if (dataToDelete.length === 0) {
      toast.error('백업할 데이터가 없습니다. 먼저 조회해주세요.');
      return;
    }

    try {
      // 엑셀 데이터 준비
      let excelData;
      let fileName: string;

      if (dataType === 'material_usage') {
        excelData = dataToDelete.map(item => ({
          '요청번호': item.request_number || '',
          '이관처(법인)': item.branch_code || '',
          '기사코드': item.technician_code || '',
          '자재코드': item.material_code || '',
          '자재명': item.material_name || '',
          '수량': item.quantity || 1,
          '상태': item.status || '',
          '처리일시': item.process_time || '',
          '입고일시': item.receipt_time || '',
          '회수일시': item.collected_at || '',
          '발송일시': item.shipped_at || '',
          '입고완료일시': item.received_at || '',
          '운송회사': item.carrier_name || '',
          '송장번호': item.tracking_number || '',
          '생성일시': item.created_at || '',
        }));
        fileName = `부품회수_백업_${deleteFromDate}_${deleteToDate}_${dataToDelete.length}건.xlsx`;
      } else {
        excelData = dataToDelete.map(item => ({
          '요청일자': item.request_date || '',
          '요청지점': item.request_branch || '',
          '고객번호': item.customer_number || '',
          '고객명': item.customer_name || '',
          '모델명': item.model_name || '',
          '회수유형': item.recovery_type || '',
          '법인코드': item.branch_code || '',
          '사원번호': item.employee_number || '',
          '회수상태': item.recovery_status || '',
          '품의진행상태': item.approval_status || '',
          '자동선택': item.is_auto_selected ? 'Y' : 'N',
          '운송회사': item.carrier || '',
          '송장번호': item.tracking_number || '',
          '회수완료일': item.collected_at || '',
          '발송일': item.shipped_at || '',
          '입고완료일': item.received_at || '',
          '생성일시': item.created_at || '',
        }));
        fileName = `제품회수_백업_${deleteFromDate}_${deleteToDate}_${dataToDelete.length}건.xlsx`;
      }

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, '백업데이터');

      // 다운로드
      XLSX.writeFile(wb, fileName);
      toast.success('백업 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('백업 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // 데이터 삭제 실행 (서버 API - 자동 백업 후 삭제)
  const handleDeleteData = async () => {
    if (deleteConfirmText !== '삭제확인') {
      toast.error('"삭제확인"을 정확히 입력해주세요.');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/data-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableName: dataType,
          dateFrom: deleteFromDate,
          dateTo: deleteToDate,
          userCode: session?.userCode,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || '데이터 삭제에 실패했습니다.');
        return;
      }

      toast.success(data.message);
      setShowDeleteConfirm(false);
      setDataToDelete([]);
      setDeleteConfirmText('');
      setDeleteFromDate('');
      setDeleteToDate('');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('데이터 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 상태별 통계
  const deleteStats = useMemo(() => {
    const stats = {
      waiting: 0,
      collected: 0,
      shipped: 0,
      received: 0,
      total: dataToDelete.length,
    };

    dataToDelete.forEach(item => {
      const statusField = dataType === 'material_usage' ? item.status : item.recovery_status;
      switch (statusField) {
        case '회수대기': stats.waiting++; break;
        case '회수완료': stats.collected++; break;
        case '발송': stats.shipped++; break;
        case '입고완료': stats.received++; break;
      }
    });

    return stats;
  }, [dataToDelete, dataType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">설정 로드 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          시스템 설정
        </h1>
        <p className="text-muted-foreground">이메일 발송 및 시스템 설정을 관리합니다.</p>
      </div>

      {/* 이메일 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            이메일 설정
          </CardTitle>
          <CardDescription>
            현황 리포트 이메일 발송에 사용되는 설정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 발송 상태 */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
            <span className="text-sm">이메일 발송 상태:</span>
            {hasApiKey ? (
              <Badge className="bg-green-100 text-green-700">활성화</Badge>
            ) : (
              <Badge variant="secondary">시뮬레이션 모드</Badge>
            )}
            {!hasApiKey && (
              <span className="text-xs text-muted-foreground ml-2">
                (API Key를 설정하면 실제 이메일이 발송됩니다)
              </span>
            )}
          </div>

          {/* 발송자 이름 */}
          <div className="space-y-2">
            <Label htmlFor="email_from_name">발송자 이름</Label>
            <Input
              id="email_from_name"
              value={settings.email_from_name || ''}
              onChange={(e) => handleChange('email_from_name', e.target.value)}
              placeholder="쿠쿠 부품회수시스템"
            />
            <p className="text-xs text-muted-foreground">
              이메일 발신자에 표시되는 이름입니다.
            </p>
          </div>

          {/* 발송자 이메일 */}
          <div className="space-y-2">
            <Label htmlFor="email_from">발송자 이메일</Label>
            <Input
              id="email_from"
              type="email"
              value={settings.email_from || ''}
              onChange={(e) => handleChange('email_from', e.target.value)}
              placeholder="noreply@cuckoo.co.kr"
            />
            <p className="text-xs text-muted-foreground">
              이메일 발신자 주소입니다. Resend에서 인증된 도메인의 주소를 사용해야 합니다.
            </p>
          </div>

          {/* Resend API Key */}
          <div className="space-y-2">
            <Label htmlFor="resend_api_key">Resend API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="resend_api_key"
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.resend_api_key || ''}
                  onChange={(e) => handleChange('resend_api_key', e.target.value)}
                  placeholder="re_xxxxxxxxxxxx"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Resend.com
              </a>
              에서 API Key를 발급받으세요. 비워두면 이메일이 시뮬레이션됩니다.
            </p>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 테스트 이메일 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            이메일 테스트
          </CardTitle>
          <CardDescription>
            설정이 올바른지 테스트 이메일을 발송해봅니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="테스트 수신 이메일 주소"
              className="flex-1"
            />
            <Button onClick={handleTestEmail} disabled={isTesting} variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              {isTesting ? '발송 중...' : '테스트 발송'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            입력한 주소로 테스트 이메일을 발송합니다.
          </p>
        </CardContent>
      </Card>

      {/* 데이터 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            데이터 관리
          </CardTitle>
          <CardDescription>
            업로드된 데이터를 기간별로 백업하거나 삭제하여 용량을 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 경고 메시지 */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>주의</AlertTitle>
            <AlertDescription>
              데이터 삭제 시 서버에 자동 백업됩니다. 추가로 엑셀 백업 다운로드를 권장합니다.
            </AlertDescription>
          </Alert>

          {/* 데이터 유형 선택 */}
          <div className="space-y-2">
            <Label>데이터 유형</Label>
            <div className="flex gap-2">
              <Button
                variant={dataType === 'material_usage' ? 'default' : 'outline'}
                onClick={() => { setDataType('material_usage'); setDataToDelete([]); }}
                className="flex-1"
              >
                <Package className="h-4 w-4 mr-2" />
                부품 (자재)
              </Button>
              <Button
                variant={dataType === 'product_recovery' ? 'default' : 'outline'}
                onClick={() => { setDataType('product_recovery'); setDataToDelete([]); }}
                className="flex-1"
              >
                <Package className="h-4 w-4 mr-2" />
                제품 (철거/불량교환)
              </Button>
            </div>
          </div>

          {/* 기간 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deleteFromDate">시작일</Label>
              <Input
                id="deleteFromDate"
                type="date"
                value={deleteFromDate}
                onChange={(e) => {
                  setDeleteFromDate(e.target.value);
                  setDataToDelete([]);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deleteToDate">종료일</Label>
              <Input
                id="deleteToDate"
                type="date"
                value={deleteToDate}
                onChange={(e) => {
                  setDeleteToDate(e.target.value);
                  setDataToDelete([]);
                }}
              />
            </div>
          </div>

          {/* 조회 버튼 */}
          <Button
            onClick={handlePreviewDelete}
            disabled={isLoadingPreview || !deleteFromDate || !deleteToDate}
            variant="outline"
            className="w-full"
          >
            {isLoadingPreview ? '조회 중...' : '데이터 조회'}
          </Button>

          {/* 조회 결과 */}
          {dataToDelete.length > 0 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-50 border">
                <h4 className="font-medium mb-3">조회 결과: {dataToDelete.length}건</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 rounded bg-red-50 border border-red-200">
                    <div className="text-red-600 font-medium">회수대기</div>
                    <div className="text-lg font-bold">{deleteStats.waiting}건</div>
                  </div>
                  <div className="p-2 rounded bg-amber-50 border border-amber-200">
                    <div className="text-amber-600 font-medium">회수완료</div>
                    <div className="text-lg font-bold">{deleteStats.collected}건</div>
                  </div>
                  <div className="p-2 rounded bg-blue-50 border border-blue-200">
                    <div className="text-blue-600 font-medium">발송</div>
                    <div className="text-lg font-bold">{deleteStats.shipped}건</div>
                  </div>
                  <div className="p-2 rounded bg-green-50 border border-green-200">
                    <div className="text-green-600 font-medium">입고완료</div>
                    <div className="text-lg font-bold">{deleteStats.received}건</div>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <Button
                  onClick={handleBackupDownload}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  백업 다운로드
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  데이터 삭제
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 모달 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              데이터 삭제 확인
            </DialogTitle>
            <DialogDescription>
              삭제 전 서버에 자동 백업됩니다. 정말 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">
                <strong>[{dataType === 'material_usage' ? '부품' : '제품'}]</strong>{' '}
                <strong>{deleteFromDate}</strong> ~ <strong>{deleteToDate}</strong> 기간의<br />
                총 <strong>{dataToDelete.length}건</strong>의 데이터가 삭제됩니다. (서버 백업 보관)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmText">
                삭제하려면 <strong className="text-red-600">"삭제확인"</strong>을 입력하세요
              </Label>
              <Input
                id="confirmText"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="삭제확인"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
              }}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteData}
              disabled={isDeleting || deleteConfirmText !== '삭제확인'}
            >
              {isDeleting ? '삭제 중...' : '삭제 실행'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
