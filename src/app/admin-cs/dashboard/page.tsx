'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Package, TruckIcon, PackageCheck, Clock, Search, ChevronLeft, Mail, Calendar } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MaterialUsage, RecoveryStatus } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

const STATUS_COLORS = {
  '회수대기': '#ef4444',
  '회수완료': '#f59e0b',
  '발송': '#3b82f6',
  '입고완료': '#22c55e',
};

// 날짜 프리셋 타입
type DatePreset = 'today' | 'yesterday' | 'week' | 'thisMonth' | 'lastMonth';

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
  }
}

export default function AdminCSDashboardPage() {
  const { data, getStats, getRecoveryTargets, updateStatus } = useMaterialUsage();
  const { session } = useAuth();

  // 법인 상세 보기 상태
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  // 메인 대시보드 날짜 필터
  const [mainDateFrom, setMainDateFrom] = useState('');
  const [mainDateTo, setMainDateTo] = useState('');
  const [appliedMainDateFrom, setAppliedMainDateFrom] = useState('');
  const [appliedMainDateTo, setAppliedMainDateTo] = useState('');
  const [isMainSearched, setIsMainSearched] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset | null>(null);

  // 법인 상세 날짜 필터
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [isSearched, setIsSearched] = useState(false);
  const [branchSelectedPreset, setBranchSelectedPreset] = useState<DatePreset | null>(null);

  // 이메일 모달 상태
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [availableUsers, setAvailableUsers] = useState<{ user_code: string; email: string }[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // 초기 날짜 설정 (오늘)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setMainDateFrom(today);
    setMainDateTo(today);
  }, []);

  // 이메일이 등록된 사용자 목록 로드
  const loadUsersWithEmail = useCallback(async () => {
    const { data: users } = await supabase
      .from('users')
      .select('user_code, email')
      .not('email', 'is', null)
      .neq('email', '');

    if (users) {
      setAvailableUsers(users);
    }
  }, []);

  useEffect(() => {
    loadUsersWithEmail();
  }, [loadUsersWithEmail]);

  const stats = useMemo(() => getStats(), [getStats]);
  const recoveryTargets = useMemo(() => getRecoveryTargets(), [getRecoveryTargets]);

  // 법인 목록
  const branchList = useMemo(() => {
    const branches = new Set<string>();
    recoveryTargets.forEach(item => branches.add(item.branch_code));
    return Array.from(branches).sort();
  }, [recoveryTargets]);

  // 메인 대시보드 날짜 필터링된 데이터
  const mainFilteredData = useMemo(() => {
    if (!isMainSearched) return recoveryTargets;

    return recoveryTargets.filter(item => {
      const itemDate = item.process_time || item.receipt_time || item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedMainDateFrom && itemDateOnly < appliedMainDateFrom) return false;
        if (appliedMainDateTo && itemDateOnly > appliedMainDateTo) return false;
      }
      return true;
    });
  }, [recoveryTargets, appliedMainDateFrom, appliedMainDateTo, isMainSearched]);

  // 필터링된 통계
  const filteredStats = useMemo(() => {
    const waiting = mainFilteredData.filter(item => item.status === '회수대기').length;
    const collected = mainFilteredData.filter(item => item.status === '회수완료').length;
    const shipped = mainFilteredData.filter(item => item.status === '발송').length;
    const received = mainFilteredData.filter(item => item.status === '입고완료').length;
    return { total: mainFilteredData.length, waiting, collected, shipped, received };
  }, [mainFilteredData]);

  // 상태별 분포 (파이 차트용)
  const statusDistribution = useMemo(() => [
    { name: '회수대기', value: filteredStats.waiting, color: STATUS_COLORS['회수대기'] },
    { name: '회수완료', value: filteredStats.collected, color: STATUS_COLORS['회수완료'] },
    { name: '발송', value: filteredStats.shipped, color: STATUS_COLORS['발송'] },
    { name: '입고완료', value: filteredStats.received, color: STATUS_COLORS['입고완료'] },
  ], [filteredStats]);

  // 법인별 현황 (바 차트용) - 필터링된 데이터 기준
  const branchStats = useMemo(() => {
    const branchMap: Record<string, { waiting: number; collected: number; shipped: number; received: number }> = {};

    mainFilteredData.forEach((item) => {
      if (!branchMap[item.branch_code]) {
        branchMap[item.branch_code] = { waiting: 0, collected: 0, shipped: 0, received: 0 };
      }

      switch (item.status) {
        case '회수대기':
          branchMap[item.branch_code].waiting++;
          break;
        case '회수완료':
          branchMap[item.branch_code].collected++;
          break;
        case '발송':
          branchMap[item.branch_code].shipped++;
          break;
        case '입고완료':
          branchMap[item.branch_code].received++;
          break;
      }
    });

    return Object.entries(branchMap)
      .map(([branch, counts]) => ({
        branch,
        ...counts,
        total: counts.waiting + counts.collected + counts.shipped + counts.received,
      }))
      .sort((a, b) => b.total - a.total);
  }, [mainFilteredData]);

  // 메인 날짜 프리셋 선택
  const handleMainPresetSelect = (preset: DatePreset) => {
    const range = getDateRange(preset);
    setMainDateFrom(range.from);
    setMainDateTo(range.to);
    setSelectedPreset(preset);
  };

  // 메인 검색 실행
  const handleMainSearch = () => {
    setAppliedMainDateFrom(mainDateFrom);
    setAppliedMainDateTo(mainDateTo);
    setIsMainSearched(true);
  };

  // 전체 보기 (필터 초기화)
  const handleShowAll = () => {
    setIsMainSearched(false);
    setSelectedPreset(null);
  };

  // 법인 선택 시 날짜 프리셋 적용
  const handleSelectBranch = (branch: string) => {
    setSelectedBranch(branch);
    const today = new Date().toISOString().split('T')[0];
    setSearchDateFrom(today);
    setSearchDateTo(today);
    setIsSearched(false);
    setBranchSelectedPreset('today');
  };

  // 법인 상세 날짜 프리셋 선택
  const handleBranchPresetSelect = (preset: DatePreset) => {
    const range = getDateRange(preset);
    setSearchDateFrom(range.from);
    setSearchDateTo(range.to);
    setBranchSelectedPreset(preset);
  };

  // 검색 실행
  const handleSearch = () => {
    setAppliedDateFrom(searchDateFrom);
    setAppliedDateTo(searchDateTo);
    setIsSearched(true);
  };

  // 선택된 법인의 데이터
  const branchData = useMemo(() => {
    if (!selectedBranch) return [];
    return recoveryTargets.filter(item => item.branch_code === selectedBranch);
  }, [recoveryTargets, selectedBranch]);

  // 검색된 데이터
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
  const waitingData = useMemo(() => searchedData.filter(item => item.status === '회수대기'), [searchedData]);
  const collectedData = useMemo(() => searchedData.filter(item => item.status === '회수완료'), [searchedData]);
  const shippedData = useMemo(() => searchedData.filter(item => item.status === '발송'), [searchedData]);

  // 기사코드별 그룹화
  const waitingByTechnician = useMemo(() => {
    const groups: Record<string, MaterialUsage[]> = {};
    waitingData.forEach(item => {
      const key = item.technician_code || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [waitingData]);

  // 상태 강제 변경
  const handleForceStatusChange = async (item: MaterialUsage, newStatus: RecoveryStatus) => {
    if (!session) return;

    try {
      await updateStatus(item.id, newStatus, session.userCode);
      toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);
    } catch (error) {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 법인별 통계
  const branchTotalStats = useMemo(() => {
    const waiting = branchData.filter(item => item.status === '회수대기').length;
    const collected = branchData.filter(item => item.status === '회수완료').length;
    const shipped = branchData.filter(item => item.status === '발송').length;
    const received = branchData.filter(item => item.status === '입고완료').length;
    return { total: branchData.length, waiting, collected, shipped, received };
  }, [branchData]);

  // 검색 결과 통계
  const searchStats = useMemo(() => ({
    total: searchedData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
  }), [searchedData, waitingData, collectedData, shippedData]);

  // 이메일 모달 열기
  const handleOpenEmailModal = () => {
    // 기본 제목 설정
    const dateRange = isMainSearched
      ? `${appliedMainDateFrom} ~ ${appliedMainDateTo}`
      : '전체';
    setEmailSubject(`[부품회수] ${dateRange} 현황 리포트`);

    // 기본 메시지 생성
    const message = generateEmailContent();
    setEmailMessage(message);
    setShowEmailModal(true);
  };

  // 이메일 내용 생성
  const generateEmailContent = () => {
    const dateRange = isMainSearched
      ? `${appliedMainDateFrom} ~ ${appliedMainDateTo}`
      : '전체 기간';

    let content = `부품 회수 현황 리포트\n`;
    content += `조회 기간: ${dateRange}\n`;
    content += `발송 일시: ${new Date().toLocaleString('ko-KR')}\n\n`;
    content += `=== 전체 현황 ===\n`;
    content += `총 회수대상: ${filteredStats.total}건\n`;
    content += `회수대기: ${filteredStats.waiting}건\n`;
    content += `회수완료: ${filteredStats.collected}건\n`;
    content += `발송: ${filteredStats.shipped}건\n`;
    content += `입고완료: ${filteredStats.received}건\n\n`;
    content += `=== 법인별 현황 ===\n`;

    branchStats.slice(0, 20).forEach(branch => {
      content += `${branch.branch}: 대기 ${branch.waiting} / 완료 ${branch.collected} / 발송 ${branch.shipped} / 입고 ${branch.received}\n`;
    });

    return content;
  };

  // 이메일 수신자 토글
  const handleToggleRecipient = (email: string) => {
    setEmailRecipients(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  // 이메일 발송
  const handleSendEmail = async () => {
    if (emailRecipients.length === 0) {
      toast.error('수신자를 선택해주세요.');
      return;
    }

    setIsSendingEmail(true);
    try {
      // API 호출 (실제 이메일 발송)
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emailRecipients,
          subject: emailSubject,
          message: emailMessage,
        }),
      });

      if (response.ok) {
        toast.success(`${emailRecipients.length}명에게 이메일이 발송되었습니다.`);
        setShowEmailModal(false);
        setEmailRecipients([]);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || '이메일 발송에 실패했습니다.');
      }
    } catch (error) {
      toast.error('이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 법인 상세 보기 모드
  if (selectedBranch) {
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedBranch(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            돌아가기
          </Button>
          <div>
            <h1 className="text-2xl font-bold">법인 상세 현황: {selectedBranch}</h1>
            <p className="text-muted-foreground">관리자 모드 - 상태 강제 변경 가능</p>
          </div>
        </div>

        {/* 법인 전체 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="전체" value={branchTotalStats.total.toLocaleString()} icon={Package} />
          <StatCard title="회수대기" value={branchTotalStats.waiting.toLocaleString()} icon={Clock} className="border-l-4 border-l-red-500" />
          <StatCard title="회수완료" value={branchTotalStats.collected.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-amber-500" />
          <StatCard title="발송" value={branchTotalStats.shipped.toLocaleString()} icon={TruckIcon} className="border-l-4 border-l-blue-500" />
          <StatCard title="입고완료" value={branchTotalStats.received.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-green-500" />
        </div>

        {/* 날짜 검색 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">날짜 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* 빠른 선택 버튼 */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={branchSelectedPreset === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBranchPresetSelect('today')}
                >
                  오늘
                </Button>
                <Button
                  variant={branchSelectedPreset === 'yesterday' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBranchPresetSelect('yesterday')}
                >
                  어제
                </Button>
                <Button
                  variant={branchSelectedPreset === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBranchPresetSelect('week')}
                >
                  1주일
                </Button>
                <Button
                  variant={branchSelectedPreset === 'thisMonth' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBranchPresetSelect('thisMonth')}
                >
                  이번달
                </Button>
                <Button
                  variant={branchSelectedPreset === 'lastMonth' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBranchPresetSelect('lastMonth')}
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
                      setBranchSelectedPreset(null);
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
                      setBranchSelectedPreset(null);
                    }}
                    className="w-44"
                  />
                </div>
                <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                  <Search className="h-4 w-4 mr-2" />
                  검색
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 검색 결과 */}
        {isSearched && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">검색 기간: {appliedDateFrom} ~ {appliedDateTo}</p>
              <div className="flex gap-6 text-sm">
                <span>회수대기: <strong className="text-red-600">{searchStats.waiting}건</strong></span>
                <span>회수완료: <strong className="text-amber-600">{searchStats.collected}건</strong></span>
                <span>발송: <strong className="text-blue-600">{searchStats.shipped}건</strong></span>
              </div>
            </div>

            <Tabs defaultValue="waiting">
              <TabsList>
                <TabsTrigger value="waiting">회수대기 ({searchStats.waiting})</TabsTrigger>
                <TabsTrigger value="collected">회수완료 ({searchStats.collected})</TabsTrigger>
                <TabsTrigger value="shipped">발송 ({searchStats.shipped})</TabsTrigger>
              </TabsList>

              {/* 회수대기 탭 */}
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
                                  <TableHead>요청번호</TableHead>
                                  <TableHead>처리시간</TableHead>
                                  <TableHead>모델명</TableHead>
                                  <TableHead>자재코드</TableHead>
                                  <TableHead>자재명</TableHead>
                                  <TableHead>수량</TableHead>
                                  <TableHead>상태변경</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.request_number}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </TableCell>
                                    <TableCell>{item.model_name}</TableCell>
                                    <TableCell>{item.material_code}</TableCell>
                                    <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                                    <TableCell>{item.output_quantity}</TableCell>
                                    <TableCell>
                                      <Select onValueChange={(value) => handleForceStatusChange(item, value as RecoveryStatus)}>
                                        <SelectTrigger className="w-28 h-8">
                                          <SelectValue placeholder="변경" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="회수완료">회수완료</SelectItem>
                                          <SelectItem value="발송">발송</SelectItem>
                                          <SelectItem value="입고완료">입고완료</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 회수대기 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 회수완료 탭 */}
              <TabsContent value="collected">
                <Card>
                  <CardHeader>
                    <CardTitle>회수완료 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {collectedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>요청번호</TableHead>
                            <TableHead>처리시간</TableHead>
                            <TableHead>기사코드</TableHead>
                            <TableHead>자재코드</TableHead>
                            <TableHead>자재명</TableHead>
                            <TableHead>회수일시</TableHead>
                            <TableHead>상태변경</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collectedData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.request_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell><Badge variant="outline">{item.technician_code || '-'}</Badge></TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Select onValueChange={(value) => handleForceStatusChange(item, value as RecoveryStatus)}>
                                  <SelectTrigger className="w-28 h-8">
                                    <SelectValue placeholder="변경" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="회수대기">회수대기</SelectItem>
                                    <SelectItem value="발송">발송</SelectItem>
                                    <SelectItem value="입고완료">입고완료</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 회수완료 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 발송 탭 */}
              <TabsContent value="shipped">
                <Card>
                  <CardHeader>
                    <CardTitle>발송 목록</CardTitle>
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
                            <TableHead>운송회사</TableHead>
                            <TableHead>송장번호</TableHead>
                            <TableHead>발송일시</TableHead>
                            <TableHead>상태변경</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shippedData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.request_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell><Badge variant="outline">{item.technician_code || '-'}</Badge></TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell>{item.carrier}</TableCell>
                              <TableCell>{item.tracking_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Select onValueChange={(value) => handleForceStatusChange(item, value as RecoveryStatus)}>
                                  <SelectTrigger className="w-28 h-8">
                                    <SelectValue placeholder="변경" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="회수대기">회수대기</SelectItem>
                                    <SelectItem value="회수완료">회수완료</SelectItem>
                                    <SelectItem value="입고완료">입고완료</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 발송 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {!isSearched && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">날짜를 선택하고 검색 버튼을 눌러주세요.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // 기본 대시보드 모드
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">전체 현황 대시보드</h1>
          <p className="text-muted-foreground">회수 자재 전체 현황을 확인합니다.</p>
        </div>
        {availableUsers.length > 0 && (
          <Button onClick={handleOpenEmailModal} variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            이메일 발송
          </Button>
        )}
      </div>

      {/* 날짜 검색 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            기간 검색
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 빠른 선택 버튼 */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedPreset === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMainPresetSelect('today')}
              >
                오늘
              </Button>
              <Button
                variant={selectedPreset === 'yesterday' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMainPresetSelect('yesterday')}
              >
                어제
              </Button>
              <Button
                variant={selectedPreset === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMainPresetSelect('week')}
              >
                1주일
              </Button>
              <Button
                variant={selectedPreset === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMainPresetSelect('thisMonth')}
              >
                이번달
              </Button>
              <Button
                variant={selectedPreset === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMainPresetSelect('lastMonth')}
              >
                저번달
              </Button>
              {isMainSearched && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShowAll}
                  className="text-muted-foreground"
                >
                  전체보기
                </Button>
              )}
            </div>

            {/* 날짜 입력 */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">시작일</label>
                <Input
                  type="date"
                  value={mainDateFrom}
                  onChange={(e) => {
                    setMainDateFrom(e.target.value);
                    setSelectedPreset(null);
                  }}
                  className="w-44"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">종료일</label>
                <Input
                  type="date"
                  value={mainDateTo}
                  onChange={(e) => {
                    setMainDateTo(e.target.value);
                    setSelectedPreset(null);
                  }}
                  className="w-44"
                />
              </div>
              <Button onClick={handleMainSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                검색
              </Button>
            </div>

            {/* 검색 기간 표시 */}
            {isMainSearched && (
              <div className="text-sm text-muted-foreground pt-2 border-t">
                검색 기간: <strong>{appliedMainDateFrom}</strong> ~ <strong>{appliedMainDateTo}</strong>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 회수대상"
          value={filteredStats.total.toLocaleString()}
          icon={Package}
          description={isMainSearched ? "조회 기간 기준" : "전체 기간"}
        />
        <StatCard
          title="회수대기"
          value={filteredStats.waiting.toLocaleString()}
          icon={Clock}
          description="회수 대기 중인 건수"
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="발송중"
          value={filteredStats.shipped.toLocaleString()}
          icon={TruckIcon}
          description="발송 진행 중인 건수"
          className="border-l-4 border-l-blue-500"
        />
        <StatCard
          title="입고완료"
          value={filteredStats.received.toLocaleString()}
          icon={PackageCheck}
          description="입고 완료된 건수"
          className="border-l-4 border-l-green-500"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 상태별 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">상태별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredStats.total > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">데이터가 없습니다.</div>
            )}
          </CardContent>
        </Card>

        {/* 법인별 현황 차트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">법인별 현황 (상위 10개)</CardTitle>
          </CardHeader>
          <CardContent>
            {branchStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchStats.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="branch" type="category" width={60} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="waiting" name="회수대기" stackId="a" fill={STATUS_COLORS['회수대기']} />
                  <Bar dataKey="collected" name="회수완료" stackId="a" fill={STATUS_COLORS['회수완료']} />
                  <Bar dataKey="shipped" name="발송" stackId="a" fill={STATUS_COLORS['발송']} />
                  <Bar dataKey="received" name="입고완료" stackId="a" fill={STATUS_COLORS['입고완료']} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">데이터가 없습니다.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 법인별 현황 테이블 - 클릭하여 상세보기 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">법인별 현황 (클릭하여 상세보기)</CardTitle>
        </CardHeader>
        <CardContent>
          {branchStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>법인코드</TableHead>
                  <TableHead className="text-center">회수대기</TableHead>
                  <TableHead className="text-center">회수완료</TableHead>
                  <TableHead className="text-center">발송</TableHead>
                  <TableHead className="text-center">입고완료</TableHead>
                  <TableHead className="text-center">합계</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchStats.map((branch) => (
                  <TableRow key={branch.branch} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSelectBranch(branch.branch)}>
                    <TableCell className="font-medium">{branch.branch}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-50 text-red-700">{branch.waiting}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">{branch.collected}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">{branch.shipped}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50 text-green-700">{branch.received}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{branch.total}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">상세보기</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {isMainSearched ? '해당 기간에 데이터가 없습니다.' : '아직 데이터가 없습니다.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 이메일 발송 모달 */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>현황 리포트 이메일 발송</DialogTitle>
            <DialogDescription>
              현재 조회된 현황을 이메일로 발송합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 수신자 선택 */}
            <div className="space-y-2">
              <Label>수신자 선택</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                {availableUsers.length > 0 ? (
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div key={user.email} className="flex items-center gap-2">
                        <Checkbox
                          id={user.email}
                          checked={emailRecipients.includes(user.email)}
                          onCheckedChange={() => handleToggleRecipient(user.email)}
                        />
                        <label htmlFor={user.email} className="text-sm cursor-pointer flex-1">
                          {user.user_code} ({user.email})
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">이메일이 등록된 사용자가 없습니다.</p>
                )}
              </div>
              {emailRecipients.length > 0 && (
                <p className="text-sm text-muted-foreground">{emailRecipients.length}명 선택됨</p>
              )}
            </div>

            {/* 제목 */}
            <div className="space-y-2">
              <Label htmlFor="subject">제목</Label>
              <Input
                id="subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            {/* 내용 */}
            <div className="space-y-2">
              <Label htmlFor="message">내용</Label>
              <Textarea
                id="message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>
              취소
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailRecipients.length === 0 || isSendingEmail}
            >
              {isSendingEmail ? '발송 중...' : '이메일 발송'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
