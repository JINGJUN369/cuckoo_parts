'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Copy, Download, Printer } from 'lucide-react';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useProductRecovery } from '@/hooks/useProductRecovery';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { MaterialUsage, ProductRecovery } from '@/types';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const STATUS_COLORS: Record<string, string> = {
  '회수대기': '#ef4444',
  '회수완료': '#f59e0b',
  '발송': '#3b82f6',
  '입고완료': '#22c55e',
  '발송불가': '#6b7280',
};

type DatePreset = 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'last30days' | 'all';

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case 'week': {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      return { from: fmt(w), to: fmt(today) };
    }
    case 'thisMonth': {
      const f = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(f), to: fmt(today) };
    }
    case 'lastMonth': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case 'last30days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: fmt(d), to: fmt(today) };
    }
    case 'all':
      return { from: '', to: '' };
  }
}

interface BranchRow {
  branch_code: string;
  mat_waiting: number;
  mat_collected: number;
  mat_shipped: number;
  mat_received: number;
  mat_cancelled: number;
  mat_total: number;
  prod_waiting: number;
  prod_collected: number;
  prod_shipped: number;
  prod_received: number;
  prod_cancelled: number;
  prod_total: number;
  total: number;
}

interface MaterialRow {
  material_code: string;
  material_name: string;
  waiting: number;
  collected: number;
  shipped: number;
  received: number;
  cancelled: number;
  total: number;
}

export default function RecoveryReportPage() {
  const { data: materialData, getRecoveryTargets: getMaterialRecoveryTargets } = useMaterialUsage();
  const { data: productData, getRecoveryTargets: getProductRecoveryTargets } = useProductRecovery();
  const { session } = useAuth();

  // 날짜 필터 상태
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('all');

  // 리포트 팝업
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');

  // 초기 로드
  useEffect(() => {
    setSelectedPreset('all');
  }, []);

  // 프리셋 변경
  const handlePreset = useCallback((preset: DatePreset) => {
    setSelectedPreset(preset);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      setAppliedFrom('');
      setAppliedTo('');
    } else {
      const range = getDateRange(preset);
      setDateFrom(range.from);
      setDateTo(range.to);
      setAppliedFrom(range.from);
      setAppliedTo(range.to);
    }
  }, []);

  // 직접 검색
  const handleSearch = useCallback(() => {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setSelectedPreset('all');
  }, [dateFrom, dateTo]);

  // 회수대상 데이터
  const materialTargets = useMemo(() => getMaterialRecoveryTargets(), [getMaterialRecoveryTargets]);
  const productTargets = useMemo(() => getProductRecoveryTargets(), [getProductRecoveryTargets]);

  // 날짜 필터링
  const filteredMaterials = useMemo(() => {
    if (!appliedFrom && !appliedTo) return materialTargets;
    return materialTargets.filter(item => {
      const d = (item.process_time || item.receipt_time || item.created_at)?.split('T')[0] || '';
      if (appliedFrom && d < appliedFrom) return false;
      if (appliedTo && d > appliedTo) return false;
      return true;
    });
  }, [materialTargets, appliedFrom, appliedTo]);

  const filteredProducts = useMemo(() => {
    if (!appliedFrom && !appliedTo) return productTargets;
    return productTargets.filter(item => {
      const d = item.created_at?.split('T')[0] || '';
      if (appliedFrom && d < appliedFrom) return false;
      if (appliedTo && d > appliedTo) return false;
      return true;
    });
  }, [productTargets, appliedFrom, appliedTo]);

  // 통계
  const matStats = useMemo(() => ({
    total: filteredMaterials.length,
    waiting: filteredMaterials.filter(i => i.status === '회수대기').length,
    collected: filteredMaterials.filter(i => i.status === '회수완료').length,
    shipped: filteredMaterials.filter(i => i.status === '발송').length,
    received: filteredMaterials.filter(i => i.status === '입고완료').length,
    cancelled: filteredMaterials.filter(i => i.status === '발송불가').length,
  }), [filteredMaterials]);

  const prodStats = useMemo(() => ({
    total: filteredProducts.length,
    waiting: filteredProducts.filter(i => i.recovery_status === '회수대기').length,
    collected: filteredProducts.filter(i => i.recovery_status === '회수완료').length,
    shipped: filteredProducts.filter(i => i.recovery_status === '발송').length,
    received: filteredProducts.filter(i => i.recovery_status === '입고완료').length,
    cancelled: filteredProducts.filter(i => i.recovery_status === '발송불가').length,
  }), [filteredProducts]);

  const combinedStats = useMemo(() => ({
    total: matStats.total + prodStats.total,
    waiting: matStats.waiting + prodStats.waiting,
    collected: matStats.collected + prodStats.collected,
    shipped: matStats.shipped + prodStats.shipped,
    received: matStats.received + prodStats.received,
    cancelled: matStats.cancelled + prodStats.cancelled,
  }), [matStats, prodStats]);

  // 법인별 통합 현황
  const branchRows = useMemo(() => {
    const map: Record<string, BranchRow> = {};

    filteredMaterials.forEach(item => {
      const bc = item.branch_code;
      if (!map[bc]) {
        map[bc] = { branch_code: bc, mat_waiting: 0, mat_collected: 0, mat_shipped: 0, mat_received: 0, mat_cancelled: 0, mat_total: 0, prod_waiting: 0, prod_collected: 0, prod_shipped: 0, prod_received: 0, prod_cancelled: 0, prod_total: 0, total: 0 };
      }
      map[bc].mat_total++;
      map[bc].total++;
      switch (item.status) {
        case '회수대기': map[bc].mat_waiting++; break;
        case '회수완료': map[bc].mat_collected++; break;
        case '발송': map[bc].mat_shipped++; break;
        case '입고완료': map[bc].mat_received++; break;
        case '발송불가': map[bc].mat_cancelled++; break;
      }
    });

    filteredProducts.forEach(item => {
      const bc = item.branch_code;
      if (!bc) return;
      if (!map[bc]) {
        map[bc] = { branch_code: bc, mat_waiting: 0, mat_collected: 0, mat_shipped: 0, mat_received: 0, mat_cancelled: 0, mat_total: 0, prod_waiting: 0, prod_collected: 0, prod_shipped: 0, prod_received: 0, prod_cancelled: 0, prod_total: 0, total: 0 };
      }
      map[bc].prod_total++;
      map[bc].total++;
      switch (item.recovery_status) {
        case '회수대기': map[bc].prod_waiting++; break;
        case '회수완료': map[bc].prod_collected++; break;
        case '발송': map[bc].prod_shipped++; break;
        case '입고완료': map[bc].prod_received++; break;
        case '발송불가': map[bc].prod_cancelled++; break;
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredMaterials, filteredProducts]);

  // 자재코드별 현황
  const materialRows = useMemo(() => {
    const map: Record<string, MaterialRow> = {};
    filteredMaterials.forEach(item => {
      const code = item.material_code;
      if (!map[code]) {
        map[code] = { material_code: code, material_name: item.material_name || '', waiting: 0, collected: 0, shipped: 0, received: 0, cancelled: 0, total: 0 };
      }
      map[code].total++;
      switch (item.status) {
        case '회수대기': map[code].waiting++; break;
        case '회수완료': map[code].collected++; break;
        case '발송': map[code].shipped++; break;
        case '입고완료': map[code].received++; break;
        case '발송불가': map[code].cancelled++; break;
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredMaterials]);

  // 차트 데이터: 상태별 분포
  const pieData = useMemo(() => [
    { name: '회수대기', value: combinedStats.waiting, color: STATUS_COLORS['회수대기'] },
    { name: '회수완료', value: combinedStats.collected, color: STATUS_COLORS['회수완료'] },
    { name: '발송', value: combinedStats.shipped, color: STATUS_COLORS['발송'] },
    { name: '입고완료', value: combinedStats.received, color: STATUS_COLORS['입고완료'] },
    { name: '발송불가', value: combinedStats.cancelled, color: STATUS_COLORS['발송불가'] },
  ].filter(d => d.value > 0), [combinedStats]);

  // 차트 데이터: 법인별 TOP10
  const branchBarData = useMemo(() =>
    branchRows.slice(0, 10).map(b => ({
      name: b.branch_code,
      자재: b.mat_total,
      제품: b.prod_total,
    })),
  [branchRows]);

  // 리포트 텍스트 생성
  const generateReport = useCallback(() => {
    const dateRange = appliedFrom && appliedTo ? `${appliedFrom} ~ ${appliedTo}` : '전체 기간';
    const now = new Date().toLocaleString('ko-KR');
    let text = `[쿠쿠 회수현황 보고서]\n`;
    text += `조회 기간: ${dateRange}\n`;
    text += `생성 일시: ${now}\n`;
    text += `========================================\n\n`;

    text += `■ 종합 현황\n`;
    text += `  전체: ${combinedStats.total}건\n`;
    text += `  회수대기: ${combinedStats.waiting}건\n`;
    text += `  회수완료: ${combinedStats.collected}건\n`;
    text += `  발송: ${combinedStats.shipped}건\n`;
    text += `  입고완료: ${combinedStats.received}건\n`;
    text += `  발송불가: ${combinedStats.cancelled}건\n`;
    const rate = combinedStats.total > 0 ? ((combinedStats.received / combinedStats.total) * 100).toFixed(1) : '0';
    text += `  입고완료율: ${rate}%\n\n`;

    text += `■ 자재 회수: ${matStats.total}건 (대기 ${matStats.waiting} / 완료 ${matStats.collected} / 발송 ${matStats.shipped} / 입고 ${matStats.received} / 불가 ${matStats.cancelled})\n`;
    text += `■ 제품 회수: ${prodStats.total}건 (대기 ${prodStats.waiting} / 완료 ${prodStats.collected} / 발송 ${prodStats.shipped} / 입고 ${prodStats.received} / 불가 ${prodStats.cancelled})\n\n`;

    text += `========================================\n`;
    text += `■ 법인별 현황 (총 ${branchRows.length}개 법인)\n`;
    text += `----------------------------------------\n`;
    branchRows.forEach(b => {
      const bTotal = b.mat_total + b.prod_total;
      const bReceived = b.mat_received + b.prod_received;
      const bRate = bTotal > 0 ? ((bReceived / bTotal) * 100).toFixed(0) : '0';
      text += `${b.branch_code}: 합계 ${bTotal}건 (자재 ${b.mat_total} / 제품 ${b.prod_total}) | 입고율 ${bRate}%\n`;
      text += `  자재: 대기 ${b.mat_waiting} / 완료 ${b.mat_collected} / 발송 ${b.mat_shipped} / 입고 ${b.mat_received} / 불가 ${b.mat_cancelled}\n`;
      if (b.prod_total > 0) {
        text += `  제품: 대기 ${b.prod_waiting} / 완료 ${b.prod_collected} / 발송 ${b.prod_shipped} / 입고 ${b.prod_received} / 불가 ${b.prod_cancelled}\n`;
      }
    });

    if (materialRows.length > 0) {
      text += `\n========================================\n`;
      text += `■ 자재코드별 현황 (${materialRows.length}개)\n`;
      text += `----------------------------------------\n`;
      materialRows.forEach(m => {
        text += `${m.material_code} (${m.material_name}): ${m.total}건 | 대기 ${m.waiting} / 완료 ${m.collected} / 발송 ${m.shipped} / 입고 ${m.received} / 불가 ${m.cancelled}\n`;
      });
    }

    return text;
  }, [appliedFrom, appliedTo, combinedStats, matStats, prodStats, branchRows, materialRows]);

  // 클립보드 복사
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success('클립보드에 복사되었습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  }, [reportText]);

  // 엑셀 다운로드
  const handleExcelExport = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // 종합 현황 시트
    const summaryData = [
      ['구분', '전체', '회수대기', '회수완료', '발송', '입고완료', '발송불가'],
      ['자재', matStats.total, matStats.waiting, matStats.collected, matStats.shipped, matStats.received, matStats.cancelled],
      ['제품', prodStats.total, prodStats.waiting, prodStats.collected, prodStats.shipped, prodStats.received, prodStats.cancelled],
      ['합계', combinedStats.total, combinedStats.waiting, combinedStats.collected, combinedStats.shipped, combinedStats.received, combinedStats.cancelled],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, '종합현황');

    // 법인별 현황 시트
    const branchData = [
      ['법인코드', '자재_대기', '자재_완료', '자재_발송', '자재_입고', '자재_불가', '자재_합계', '제품_대기', '제품_완료', '제품_발송', '제품_입고', '제품_불가', '제품_합계', '총합계'],
      ...branchRows.map(b => [
        b.branch_code, b.mat_waiting, b.mat_collected, b.mat_shipped, b.mat_received, b.mat_cancelled, b.mat_total,
        b.prod_waiting, b.prod_collected, b.prod_shipped, b.prod_received, b.prod_cancelled, b.prod_total, b.total,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(branchData);
    XLSX.utils.book_append_sheet(wb, ws2, '법인별현황');

    // 자재별 현황 시트
    if (materialRows.length > 0) {
      const matData = [
        ['자재코드', '자재명', '대기', '완료', '발송', '입고', '불가', '합계'],
        ...materialRows.map(m => [m.material_code, m.material_name, m.waiting, m.collected, m.shipped, m.received, m.cancelled, m.total]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(matData);
      XLSX.utils.book_append_sheet(wb, ws3, '자재별현황');
    }

    const dateRange = appliedFrom && appliedTo ? `${appliedFrom}_${appliedTo}` : '전체';
    XLSX.writeFile(wb, `회수현황보고서_${dateRange}.xlsx`);
    toast.success('엑셀 파일을 다운로드했습니다.');
  }, [matStats, prodStats, combinedStats, branchRows, materialRows, appliedFrom, appliedTo]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">회수현황 보고서</h1>
          <p className="text-muted-foreground">자재 및 제품 회수 현황을 종합적으로 조회합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setReportText(generateReport()); setShowReportModal(true); }}>
            <Copy className="h-4 w-4 mr-2" />텍스트 리포트
          </Button>
          <Button variant="outline" onClick={handleExcelExport}>
            <Download className="h-4 w-4 mr-2" />엑셀 다운로드
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />인쇄
          </Button>
        </div>
      </div>

      {/* 날짜 필터 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">기간:</span>
            {[
              { key: 'all' as DatePreset, label: '전체' },
              { key: 'today' as DatePreset, label: '오늘' },
              { key: 'week' as DatePreset, label: '최근 1주' },
              { key: 'thisMonth' as DatePreset, label: '이번 달' },
              { key: 'lastMonth' as DatePreset, label: '지난 달' },
              { key: 'last30days' as DatePreset, label: '최근 30일' },
            ].map(p => (
              <Button
                key={p.key}
                size="sm"
                variant={selectedPreset === p.key ? 'default' : 'outline'}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <div className="flex items-center gap-1 ml-4">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8" />
              <span className="text-muted-foreground">~</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8" />
              <Button size="sm" onClick={handleSearch}>조회</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 종합 현황 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">전체</p>
            <p className="text-2xl font-bold">{combinedStats.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        {[
          { label: '회수대기', value: combinedStats.waiting, color: 'text-red-600' },
          { label: '회수완료', value: combinedStats.collected, color: 'text-amber-600' },
          { label: '발송', value: combinedStats.shipped, color: 'text-blue-600' },
          { label: '입고완료', value: combinedStats.received, color: 'text-green-600' },
          { label: '발송불가', value: combinedStats.cancelled, color: 'text-gray-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">입고완료율</p>
            <p className="text-2xl font-bold text-green-700">
              {combinedStats.total > 0 ? ((combinedStats.received / combinedStats.total) * 100).toFixed(1) : '0'}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 자재/제품 구분 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">자재 회수</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 text-sm">
              <span>전체 <strong>{matStats.total}</strong></span>
              <span className="text-red-600">대기 {matStats.waiting}</span>
              <span className="text-amber-600">완료 {matStats.collected}</span>
              <span className="text-blue-600">발송 {matStats.shipped}</span>
              <span className="text-green-600">입고 {matStats.received}</span>
              <span className="text-gray-500">불가 {matStats.cancelled}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">제품 회수</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 text-sm">
              <span>전체 <strong>{prodStats.total}</strong></span>
              <span className="text-red-600">대기 {prodStats.waiting}</span>
              <span className="text-amber-600">완료 {prodStats.collected}</span>
              <span className="text-blue-600">발송 {prodStats.shipped}</span>
              <span className="text-green-600">입고 {prodStats.received}</span>
              <span className="text-gray-500">불가 {prodStats.cancelled}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        {/* 상태 분포 파이 차트 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">상태별 분포</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* 법인별 TOP10 바 차트 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">법인별 TOP 10</CardTitle></CardHeader>
          <CardContent>
            {branchBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={branchBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="자재" fill="#3b82f6" />
                  <Bar dataKey="제품" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground">데이터가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 상세 테이블 */}
      <Tabs defaultValue="branch">
        <TabsList>
          <TabsTrigger value="branch">법인별 현황</TabsTrigger>
          <TabsTrigger value="material">자재코드별 현황</TabsTrigger>
        </TabsList>

        {/* 법인별 */}
        <TabsContent value="branch">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">법인별 회수 현황 ({branchRows.length}개 법인)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="border-r align-middle">법인</TableHead>
                      <TableHead colSpan={6} className="text-center border-r bg-blue-50">자재</TableHead>
                      <TableHead colSpan={6} className="text-center border-r bg-purple-50">제품</TableHead>
                      <TableHead rowSpan={2} className="text-center align-middle">합계</TableHead>
                      <TableHead rowSpan={2} className="text-center align-middle">입고율</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-center text-xs">대기</TableHead>
                      <TableHead className="text-center text-xs">완료</TableHead>
                      <TableHead className="text-center text-xs">발송</TableHead>
                      <TableHead className="text-center text-xs">입고</TableHead>
                      <TableHead className="text-center text-xs">불가</TableHead>
                      <TableHead className="text-center text-xs border-r">소계</TableHead>
                      <TableHead className="text-center text-xs">대기</TableHead>
                      <TableHead className="text-center text-xs">완료</TableHead>
                      <TableHead className="text-center text-xs">발송</TableHead>
                      <TableHead className="text-center text-xs">입고</TableHead>
                      <TableHead className="text-center text-xs">불가</TableHead>
                      <TableHead className="text-center text-xs border-r">소계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchRows.map(b => {
                      const totalReceived = b.mat_received + b.prod_received;
                      const rate = b.total > 0 ? ((totalReceived / b.total) * 100).toFixed(0) : '0';
                      return (
                        <TableRow key={b.branch_code}>
                          <TableCell className="font-medium border-r">{b.branch_code}</TableCell>
                          <TableCell className="text-center text-sm">{b.mat_waiting || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.mat_collected || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.mat_shipped || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.mat_received || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.mat_cancelled || '-'}</TableCell>
                          <TableCell className="text-center text-sm font-medium border-r">{b.mat_total}</TableCell>
                          <TableCell className="text-center text-sm">{b.prod_waiting || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.prod_collected || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.prod_shipped || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.prod_received || '-'}</TableCell>
                          <TableCell className="text-center text-sm">{b.prod_cancelled || '-'}</TableCell>
                          <TableCell className="text-center text-sm font-medium border-r">{b.prod_total}</TableCell>
                          <TableCell className="text-center font-bold">{b.total}</TableCell>
                          <TableCell className="text-center font-medium">{rate}%</TableCell>
                        </TableRow>
                      );
                    })}
                    {branchRows.length > 0 && (
                      <TableRow className="bg-gray-50 font-bold">
                        <TableCell className="border-r">합계</TableCell>
                        <TableCell className="text-center">{matStats.waiting}</TableCell>
                        <TableCell className="text-center">{matStats.collected}</TableCell>
                        <TableCell className="text-center">{matStats.shipped}</TableCell>
                        <TableCell className="text-center">{matStats.received}</TableCell>
                        <TableCell className="text-center">{matStats.cancelled}</TableCell>
                        <TableCell className="text-center border-r">{matStats.total}</TableCell>
                        <TableCell className="text-center">{prodStats.waiting}</TableCell>
                        <TableCell className="text-center">{prodStats.collected}</TableCell>
                        <TableCell className="text-center">{prodStats.shipped}</TableCell>
                        <TableCell className="text-center">{prodStats.received}</TableCell>
                        <TableCell className="text-center">{prodStats.cancelled}</TableCell>
                        <TableCell className="text-center border-r">{prodStats.total}</TableCell>
                        <TableCell className="text-center">{combinedStats.total}</TableCell>
                        <TableCell className="text-center">
                          {combinedStats.total > 0 ? ((combinedStats.received / combinedStats.total) * 100).toFixed(0) : '0'}%
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {branchRows.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">데이터가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 자재코드별 */}
        <TabsContent value="material">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">자재코드별 회수 현황 ({materialRows.length}개 자재)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>자재코드</TableHead>
                      <TableHead>자재명</TableHead>
                      <TableHead className="text-center">회수대기</TableHead>
                      <TableHead className="text-center">회수완료</TableHead>
                      <TableHead className="text-center">발송</TableHead>
                      <TableHead className="text-center">입고완료</TableHead>
                      <TableHead className="text-center">발송불가</TableHead>
                      <TableHead className="text-center">합계</TableHead>
                      <TableHead className="text-center">입고율</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialRows.map(m => {
                      const rate = m.total > 0 ? ((m.received / m.total) * 100).toFixed(0) : '0';
                      return (
                        <TableRow key={m.material_code}>
                          <TableCell className="font-medium font-mono">{m.material_code}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{m.material_name}</TableCell>
                          <TableCell className="text-center">{m.waiting || '-'}</TableCell>
                          <TableCell className="text-center">{m.collected || '-'}</TableCell>
                          <TableCell className="text-center">{m.shipped || '-'}</TableCell>
                          <TableCell className="text-center">{m.received || '-'}</TableCell>
                          <TableCell className="text-center">{m.cancelled || '-'}</TableCell>
                          <TableCell className="text-center font-bold">{m.total}</TableCell>
                          <TableCell className="text-center">{rate}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {materialRows.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">데이터가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 리포트 모달 */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>회수현황 보고서</DialogTitle>
          </DialogHeader>
          <Textarea value={reportText} readOnly className="min-h-[400px] font-mono text-sm" />
          <DialogFooter>
            <Button onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />클립보드 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
