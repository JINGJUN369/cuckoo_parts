'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Package, TruckIcon, PackageCheck, Clock, Search, ChevronLeft, Mail, Calendar, XCircle, Truck, ArrowUpRight, Copy, FileText } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useProductRecovery } from '@/hooks/useProductRecovery';
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
import { MaterialUsage, RecoveryStatus, ProductRecovery, ProductRecoveryStatus } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

const STATUS_COLORS = {
  '회수대기': '#ef4444',
  '회수완료': '#f59e0b',
  '발송': '#3b82f6',
  '입고완료': '#22c55e',
  '발송불가': '#6b7280',
};

// 날짜 프리셋 타입
type DatePreset = 'today' | 'yesterday' | 'week' | 'thisMonth' | 'lastMonth' | 'last30days';

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
    case 'last30days': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      return { from: formatDate(thirtyDaysAgo), to: formatDate(today) };
    }
  }
}

export default function AdminCSDashboardPage() {
  // 메인 탭 상태
  const [mainTab, setMainTab] = useState<'overview' | 'material' | 'product'>('overview');

  // 자재 데이터
  const { data: materialData, getStats: getMaterialStats, getRecoveryTargets: getMaterialRecoveryTargets, updateStatus: updateMaterialStatus } = useMaterialUsage();
  // 제품 데이터
  const { data: productData, getStats: getProductStats, getRecoveryTargets: getProductRecoveryTargets, updateStatus: updateProductStatus } = useProductRecovery();
  const { session } = useAuth();

  // 법인 상세 보기 상태
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [branchViewType, setBranchViewType] = useState<'material' | 'product'>('material');

  // 메인 대시보드 날짜 필터
  const [mainDateFrom, setMainDateFrom] = useState('');
  const [mainDateTo, setMainDateTo] = useState('');
  const [appliedMainDateFrom, setAppliedMainDateFrom] = useState('');
  const [appliedMainDateTo, setAppliedMainDateTo] = useState('');
  const [isMainSearched, setIsMainSearched] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset | null>('last30days');

  // 법인 상세 날짜 필터
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [isSearched, setIsSearched] = useState(false);
  const [branchSelectedPreset, setBranchSelectedPreset] = useState<DatePreset | null>(null);

  // 리포트 팝업 상태
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [availableUsers, setAvailableUsers] = useState<{ user_code: string; email: string; branch_code?: string }[]>([]);

  // 초기 날짜 설정 (최근 30일)
  useEffect(() => {
    const range = getDateRange('last30days');
    setMainDateFrom(range.from);
    setMainDateTo(range.to);
    setAppliedMainDateFrom(range.from);
    setAppliedMainDateTo(range.to);
    setIsMainSearched(true);
  }, []);

  // 이메일이 등록된 사용자 목록 로드
  const loadUsersWithEmail = useCallback(async () => {
    const { data: users } = await supabase
      .from('users')
      .select('user_code, email, branch_code')
      .not('email', 'is', null)
      .neq('email', '');

    if (users) {
      setAvailableUsers(users);
    }
  }, []);

  useEffect(() => {
    loadUsersWithEmail();
  }, [loadUsersWithEmail]);

  // 통계
  const materialStats = useMemo(() => getMaterialStats(), [getMaterialStats]);
  const productStats = useMemo(() => getProductStats(), [getProductStats]);
  const materialRecoveryTargets = useMemo(() => getMaterialRecoveryTargets(), [getMaterialRecoveryTargets]);
  const productRecoveryTargets = useMemo(() => getProductRecoveryTargets(), [getProductRecoveryTargets]);

  // branch_code → request_branch(요청지점) 매핑
  const branchNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    productData.forEach(item => {
      if (item.branch_code && item.request_branch && !map[item.branch_code]) {
        map[item.branch_code] = item.request_branch;
      }
    });
    return map;
  }, [productData]);

  // 법인코드를 법인명으로 표시하는 헬퍼
  const getBranchDisplayName = useCallback((code: string) => {
    const name = branchNameMap[code];
    return name ? `${name} (${code})` : code;
  }, [branchNameMap]);

  // 통합 통계
  const combinedStats = useMemo(() => ({
    total: materialStats.total + productStats.total,
    waiting: materialStats.waiting + productStats.waiting,
    collected: materialStats.collected + productStats.collected,
    shipped: materialStats.shipped + productStats.shipped,
    received: materialStats.received + productStats.received,
    cancelled: materialStats.cancelled + productStats.cancelled,
  }), [materialStats, productStats]);

  // 법인 목록 (자재)
  const materialBranchList = useMemo(() => {
    const branches = new Set<string>();
    materialRecoveryTargets.forEach(item => branches.add(item.branch_code));
    return Array.from(branches).sort();
  }, [materialRecoveryTargets]);

  // 법인 목록 (제품)
  const productBranchList = useMemo(() => {
    const branches = new Set<string>();
    productRecoveryTargets.forEach(item => {
      if (item.branch_code) branches.add(item.branch_code);
    });
    return Array.from(branches).sort();
  }, [productRecoveryTargets]);

  // 메인 대시보드 날짜 필터링된 데이터 (자재)
  const mainFilteredMaterialData = useMemo(() => {
    if (!isMainSearched) return materialRecoveryTargets;

    return materialRecoveryTargets.filter(item => {
      const itemDate = item.process_time || item.receipt_time || item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedMainDateFrom && itemDateOnly < appliedMainDateFrom) return false;
        if (appliedMainDateTo && itemDateOnly > appliedMainDateTo) return false;
      }
      return true;
    });
  }, [materialRecoveryTargets, appliedMainDateFrom, appliedMainDateTo, isMainSearched]);

  // 메인 대시보드 날짜 필터링된 데이터 (제품)
  const mainFilteredProductData = useMemo(() => {
    if (!isMainSearched) return productRecoveryTargets;

    return productRecoveryTargets.filter(item => {
      const itemDate = item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedMainDateFrom && itemDateOnly < appliedMainDateFrom) return false;
        if (appliedMainDateTo && itemDateOnly > appliedMainDateTo) return false;
      }
      return true;
    });
  }, [productRecoveryTargets, appliedMainDateFrom, appliedMainDateTo, isMainSearched]);

  // 필터링된 통계 (자재)
  const filteredMaterialStats = useMemo(() => {
    const waiting = mainFilteredMaterialData.filter(item => item.status === '회수대기').length;
    const collected = mainFilteredMaterialData.filter(item => item.status === '회수완료').length;
    const shipped = mainFilteredMaterialData.filter(item => item.status === '발송').length;
    const received = mainFilteredMaterialData.filter(item => item.status === '입고완료').length;
    const cancelled = mainFilteredMaterialData.filter(item => item.status === '발송불가').length;
    return { total: mainFilteredMaterialData.length, waiting, collected, shipped, received, cancelled };
  }, [mainFilteredMaterialData]);

  // 필터링된 통계 (제품)
  const filteredProductStats = useMemo(() => {
    const waiting = mainFilteredProductData.filter(item => item.recovery_status === '회수대기').length;
    const collected = mainFilteredProductData.filter(item => item.recovery_status === '회수완료').length;
    const shipped = mainFilteredProductData.filter(item => item.recovery_status === '발송').length;
    const received = mainFilteredProductData.filter(item => item.recovery_status === '입고완료').length;
    const cancelled = mainFilteredProductData.filter(item => item.recovery_status === '발송불가').length;
    return { total: mainFilteredProductData.length, waiting, collected, shipped, received, cancelled };
  }, [mainFilteredProductData]);

  // 필터링된 통합 통계
  const filteredCombinedStats = useMemo(() => ({
    total: filteredMaterialStats.total + filteredProductStats.total,
    waiting: filteredMaterialStats.waiting + filteredProductStats.waiting,
    collected: filteredMaterialStats.collected + filteredProductStats.collected,
    shipped: filteredMaterialStats.shipped + filteredProductStats.shipped,
    received: filteredMaterialStats.received + filteredProductStats.received,
    cancelled: filteredMaterialStats.cancelled + filteredProductStats.cancelled,
  }), [filteredMaterialStats, filteredProductStats]);

  // 발송불가 데이터 (자재)
  const cancelledMaterialData = useMemo(() =>
    mainFilteredMaterialData.filter(item => item.status === '발송불가')
      .sort((a, b) => new Date(b.cancelled_at || b.updated_at).getTime() - new Date(a.cancelled_at || a.updated_at).getTime()),
    [mainFilteredMaterialData]
  );

  // 발송불가 데이터 (제품)
  const cancelledProductData = useMemo(() =>
    mainFilteredProductData.filter(item => item.recovery_status === '발송불가')
      .sort((a, b) => new Date(b.cancelled_at || b.updated_at || '').getTime() - new Date(a.cancelled_at || a.updated_at || '').getTime()),
    [mainFilteredProductData]
  );

  // 상태별 분포 (파이 차트용) - 자재
  const materialStatusDistribution = useMemo(() => [
    { name: '회수대기', value: filteredMaterialStats.waiting, color: STATUS_COLORS['회수대기'] },
    { name: '회수완료', value: filteredMaterialStats.collected, color: STATUS_COLORS['회수완료'] },
    { name: '발송', value: filteredMaterialStats.shipped, color: STATUS_COLORS['발송'] },
    { name: '입고완료', value: filteredMaterialStats.received, color: STATUS_COLORS['입고완료'] },
    { name: '발송불가', value: filteredMaterialStats.cancelled, color: STATUS_COLORS['발송불가'] },
  ], [filteredMaterialStats]);

  // 상태별 분포 (파이 차트용) - 제품
  const productStatusDistribution = useMemo(() => [
    { name: '회수대기', value: filteredProductStats.waiting, color: STATUS_COLORS['회수대기'] },
    { name: '회수완료', value: filteredProductStats.collected, color: STATUS_COLORS['회수완료'] },
    { name: '발송', value: filteredProductStats.shipped, color: STATUS_COLORS['발송'] },
    { name: '입고완료', value: filteredProductStats.received, color: STATUS_COLORS['입고완료'] },
    { name: '발송불가', value: filteredProductStats.cancelled, color: STATUS_COLORS['발송불가'] },
  ], [filteredProductStats]);

  // 상태별 분포 (파이 차트용) - 통합
  const combinedStatusDistribution = useMemo(() => [
    { name: '회수대기', value: filteredCombinedStats.waiting, color: STATUS_COLORS['회수대기'] },
    { name: '회수완료', value: filteredCombinedStats.collected, color: STATUS_COLORS['회수완료'] },
    { name: '발송', value: filteredCombinedStats.shipped, color: STATUS_COLORS['발송'] },
    { name: '입고완료', value: filteredCombinedStats.received, color: STATUS_COLORS['입고완료'] },
    { name: '발송불가', value: filteredCombinedStats.cancelled, color: STATUS_COLORS['발송불가'] },
  ], [filteredCombinedStats]);

  // 법인별 현황 (자재)
  const materialBranchStats = useMemo(() => {
    const branchMap: Record<string, { waiting: number; collected: number; shipped: number; received: number; cancelled: number }> = {};

    mainFilteredMaterialData.forEach((item) => {
      if (!branchMap[item.branch_code]) {
        branchMap[item.branch_code] = { waiting: 0, collected: 0, shipped: 0, received: 0, cancelled: 0 };
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
        case '발송불가':
          branchMap[item.branch_code].cancelled++;
          break;
      }
    });

    return Object.entries(branchMap)
      .map(([branch, counts]) => ({
        branch,
        ...counts,
        total: counts.waiting + counts.collected + counts.shipped + counts.received + counts.cancelled,
      }))
      .sort((a, b) => b.total - a.total);
  }, [mainFilteredMaterialData]);

  // 법인별 현황 (제품)
  const productBranchStats = useMemo(() => {
    const branchMap: Record<string, { waiting: number; collected: number; shipped: number; received: number; cancelled: number }> = {};

    mainFilteredProductData.forEach((item) => {
      const code = item.branch_code || 'UNKNOWN';
      if (!branchMap[code]) {
        branchMap[code] = { waiting: 0, collected: 0, shipped: 0, received: 0, cancelled: 0 };
      }

      switch (item.recovery_status) {
        case '회수대기':
          branchMap[code].waiting++;
          break;
        case '회수완료':
          branchMap[code].collected++;
          break;
        case '발송':
          branchMap[code].shipped++;
          break;
        case '입고완료':
          branchMap[code].received++;
          break;
        case '발송불가':
          branchMap[code].cancelled++;
          break;
      }
    });

    return Object.entries(branchMap)
      .map(([branch, counts]) => ({
        branch,
        ...counts,
        total: counts.waiting + counts.collected + counts.shipped + counts.received + counts.cancelled,
      }))
      .sort((a, b) => b.total - a.total);
  }, [mainFilteredProductData]);

  // 법인별 현황 (통합 - 자재 + 제품)
  const combinedBranchStats = useMemo(() => {
    const branchMap: Record<string, { waiting: number; collected: number; shipped: number; received: number; cancelled: number; materialCount: number; productCount: number }> = {};

    // 자재 데이터 집계
    mainFilteredMaterialData.forEach((item) => {
      if (!branchMap[item.branch_code]) {
        branchMap[item.branch_code] = { waiting: 0, collected: 0, shipped: 0, received: 0, cancelled: 0, materialCount: 0, productCount: 0 };
      }
      branchMap[item.branch_code].materialCount++;

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
        case '발송불가':
          branchMap[item.branch_code].cancelled++;
          break;
      }
    });

    // 제품 데이터 집계
    mainFilteredProductData.forEach((item) => {
      const code = item.branch_code || 'UNKNOWN';
      if (!branchMap[code]) {
        branchMap[code] = { waiting: 0, collected: 0, shipped: 0, received: 0, cancelled: 0, materialCount: 0, productCount: 0 };
      }
      branchMap[code].productCount++;

      switch (item.recovery_status) {
        case '회수대기':
          branchMap[code].waiting++;
          break;
        case '회수완료':
          branchMap[code].collected++;
          break;
        case '발송':
          branchMap[code].shipped++;
          break;
        case '입고완료':
          branchMap[code].received++;
          break;
        case '발송불가':
          branchMap[code].cancelled++;
          break;
      }
    });

    return Object.entries(branchMap)
      .map(([branch, counts]) => ({
        branch,
        ...counts,
        total: counts.waiting + counts.collected + counts.shipped + counts.received + counts.cancelled,
      }))
      .sort((a, b) => b.total - a.total);
  }, [mainFilteredMaterialData, mainFilteredProductData]);

  // 품목별 현황 (자재코드 기준)
  const materialItemStats = useMemo(() => {
    const materialMap: Record<string, {
      material_code: string;
      material_name: string;
      waiting: number;
      collected: number;
      shipped: number;
      received: number;
      cancelled: number;
    }> = {};

    mainFilteredMaterialData.forEach((item) => {
      const code = item.material_code;
      if (!materialMap[code]) {
        materialMap[code] = {
          material_code: code,
          material_name: item.material_name || '',
          waiting: 0,
          collected: 0,
          shipped: 0,
          received: 0,
          cancelled: 0,
        };
      }

      switch (item.status) {
        case '회수대기':
          materialMap[code].waiting++;
          break;
        case '회수완료':
          materialMap[code].collected++;
          break;
        case '발송':
          materialMap[code].shipped++;
          break;
        case '입고완료':
          materialMap[code].received++;
          break;
        case '발송불가':
          materialMap[code].cancelled++;
          break;
      }
    });

    return Object.values(materialMap)
      .map((item) => ({
        ...item,
        total: item.waiting + item.collected + item.shipped + item.received + item.cancelled,
        pending: item.waiting + item.collected + item.shipped,
      }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [mainFilteredMaterialData]);

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
  const handleSelectBranch = (branch: string, type: 'material' | 'product') => {
    setSelectedBranch(branch);
    setBranchViewType(type);
    const range = getDateRange('last30days');
    setSearchDateFrom(range.from);
    setSearchDateTo(range.to);
    setAppliedDateFrom(range.from);
    setAppliedDateTo(range.to);
    setIsSearched(true);
    setBranchSelectedPreset('last30days');
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

  // 선택된 법인의 자재 데이터
  const branchMaterialData = useMemo(() => {
    if (!selectedBranch) return [];
    return materialRecoveryTargets.filter(item => item.branch_code === selectedBranch);
  }, [materialRecoveryTargets, selectedBranch]);

  // 선택된 법인의 제품 데이터
  const branchProductData = useMemo(() => {
    if (!selectedBranch) return [];
    return productRecoveryTargets.filter(item => item.branch_code === selectedBranch);
  }, [productRecoveryTargets, selectedBranch]);

  // 검색된 자재 데이터
  const searchedMaterialData = useMemo(() => {
    if (!isSearched) return [];

    return branchMaterialData.filter(item => {
      const itemDate = item.process_time || item.receipt_time || item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedDateFrom && itemDateOnly < appliedDateFrom) return false;
        if (appliedDateTo && itemDateOnly > appliedDateTo) return false;
      }
      return true;
    });
  }, [branchMaterialData, appliedDateFrom, appliedDateTo, isSearched]);

  // 검색된 제품 데이터
  const searchedProductData = useMemo(() => {
    if (!isSearched) return [];

    return branchProductData.filter(item => {
      const itemDate = item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedDateFrom && itemDateOnly < appliedDateFrom) return false;
        if (appliedDateTo && itemDateOnly > appliedDateTo) return false;
      }
      return true;
    });
  }, [branchProductData, appliedDateFrom, appliedDateTo, isSearched]);

  // 상태별 자재 데이터
  const materialWaitingData = useMemo(() => searchedMaterialData.filter(item => item.status === '회수대기'), [searchedMaterialData]);
  const materialCollectedData = useMemo(() => searchedMaterialData.filter(item => item.status === '회수완료'), [searchedMaterialData]);
  const materialShippedData = useMemo(() => searchedMaterialData.filter(item => item.status === '발송'), [searchedMaterialData]);
  const materialCancelledData = useMemo(() => searchedMaterialData.filter(item => item.status === '발송불가'), [searchedMaterialData]);

  // 상태별 제품 데이터
  const productWaitingData = useMemo(() => searchedProductData.filter(item => item.recovery_status === '회수대기'), [searchedProductData]);
  const productCollectedData = useMemo(() => searchedProductData.filter(item => item.recovery_status === '회수완료'), [searchedProductData]);
  const productShippedData = useMemo(() => searchedProductData.filter(item => item.recovery_status === '발송'), [searchedProductData]);
  const productCancelledData = useMemo(() => searchedProductData.filter(item => item.recovery_status === '발송불가'), [searchedProductData]);

  // 기사코드별 그룹화 (자재)
  const materialWaitingByTechnician = useMemo(() => {
    const groups: Record<string, MaterialUsage[]> = {};
    materialWaitingData.forEach(item => {
      const key = item.technician_code || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [materialWaitingData]);

  // 자재 상태 강제 변경
  const handleMaterialForceStatusChange = async (item: MaterialUsage, newStatus: RecoveryStatus) => {
    if (!session) return;

    try {
      await updateMaterialStatus(item.id, newStatus, session.userCode);
      toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);
    } catch (error) {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 제품 상태 강제 변경
  const handleProductForceStatusChange = async (item: ProductRecovery, newStatus: ProductRecoveryStatus) => {
    if (!session) return;

    try {
      await updateProductStatus(item.id, newStatus, session.userCode);
      toast.success(`상태가 ${newStatus}(으)로 변경되었습니다.`);
    } catch (error) {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 법인별 자재 통계
  const branchMaterialTotalStats = useMemo(() => {
    const waiting = branchMaterialData.filter(item => item.status === '회수대기').length;
    const collected = branchMaterialData.filter(item => item.status === '회수완료').length;
    const shipped = branchMaterialData.filter(item => item.status === '발송').length;
    const received = branchMaterialData.filter(item => item.status === '입고완료').length;
    const cancelled = branchMaterialData.filter(item => item.status === '발송불가').length;
    return { total: branchMaterialData.length, waiting, collected, shipped, received, cancelled };
  }, [branchMaterialData]);

  // 법인별 제품 통계
  const branchProductTotalStats = useMemo(() => {
    const waiting = branchProductData.filter(item => item.recovery_status === '회수대기').length;
    const collected = branchProductData.filter(item => item.recovery_status === '회수완료').length;
    const shipped = branchProductData.filter(item => item.recovery_status === '발송').length;
    const received = branchProductData.filter(item => item.recovery_status === '입고완료').length;
    const cancelled = branchProductData.filter(item => item.recovery_status === '발송불가').length;
    return { total: branchProductData.length, waiting, collected, shipped, received, cancelled };
  }, [branchProductData]);

  // 검색 결과 통계 (자재)
  const searchMaterialStats = useMemo(() => ({
    total: searchedMaterialData.length,
    waiting: materialWaitingData.length,
    collected: materialCollectedData.length,
    shipped: materialShippedData.length,
    cancelled: materialCancelledData.length,
  }), [searchedMaterialData, materialWaitingData, materialCollectedData, materialShippedData, materialCancelledData]);

  // 검색 결과 통계 (제품)
  const searchProductStats = useMemo(() => ({
    total: searchedProductData.length,
    waiting: productWaitingData.length,
    collected: productCollectedData.length,
    shipped: productShippedData.length,
    cancelled: productCancelledData.length,
  }), [searchedProductData, productWaitingData, productCollectedData, productShippedData, productCancelledData]);

  // 법인별 이메일이 등록된 법인 수 계산
  const branchesWithEmail = useMemo(() => {
    const branchEmails: Record<string, string> = {};
    availableUsers.forEach(user => {
      if (user.branch_code && user.email) {
        branchEmails[user.branch_code] = user.email;
      }
    });
    return branchEmails;
  }, [availableUsers]);

  // 전체 법인별 리포트 문구 생성
  const generateAllBranchReport = useCallback(() => {
    const dateRange = isMainSearched
      ? `${appliedMainDateFrom} ~ ${appliedMainDateTo}`
      : '전체 기간';
    const now = new Date().toLocaleString('ko-KR');

    let text = `[쿠쿠 회수 현황 리포트]\n`;
    text += `조회 기간: ${dateRange}\n`;
    text += `생성 일시: ${now}\n`;
    text += `${'='.repeat(40)}\n\n`;

    // 통합 현황 요약
    text += `[전체 요약]\n`;
    text += `자재: ${filteredMaterialStats.total}건 / 제품: ${filteredProductStats.total}건\n`;
    text += `회수대기: ${filteredCombinedStats.waiting} | 회수완료: ${filteredCombinedStats.collected} | 발송: ${filteredCombinedStats.shipped} | 입고완료: ${filteredCombinedStats.received} | 발송불가: ${filteredCombinedStats.cancelled}\n\n`;

    // 법인별 상세
    text += `[법인별 현황]\n`;
    text += `${'─'.repeat(40)}\n`;

    combinedBranchStats.forEach((branch) => {
      text += `${getBranchDisplayName(branch.branch)} (자재:${branch.materialCount} / 제품:${branch.productCount})\n`;
      text += `  대기:${branch.waiting} / 완료:${branch.collected} / 발송:${branch.shipped} / 입고:${branch.received} / 불가:${branch.cancelled}\n`;
    });

    return text;
  }, [isMainSearched, appliedMainDateFrom, appliedMainDateTo, filteredMaterialStats, filteredProductStats, filteredCombinedStats, combinedBranchStats, getBranchDisplayName]);

  // 개별 법인 리포트 생성
  const generateBranchReport = useCallback(() => {
    if (!selectedBranch) return '';
    const dateRange = isSearched
      ? `${appliedDateFrom} ~ ${appliedDateTo}`
      : '전체 기간';
    const now = new Date().toLocaleString('ko-KR');
    const isProduct = branchViewType === 'product';
    const stats = isProduct ? searchProductStats : searchMaterialStats;

    let text = `[${getBranchDisplayName(selectedBranch)}] ${isProduct ? '제품' : '자재'} 회수 현황\n`;
    text += `조회 기간: ${dateRange}\n`;
    text += `생성 일시: ${now}\n`;
    text += `${'─'.repeat(30)}\n`;
    text += `전체: ${stats.total}건\n`;
    text += `회수대기: ${stats.waiting}건\n`;
    text += `회수완료: ${stats.collected}건\n`;
    text += `발송: ${stats.shipped}건\n`;
    text += `발송불가: ${stats.cancelled}건\n`;

    return text;
  }, [selectedBranch, isSearched, appliedDateFrom, appliedDateTo, branchViewType, searchProductStats, searchMaterialStats, getBranchDisplayName]);

  // 클립보드 복사
  const handleCopyReport = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('클립보드에 복사되었습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  // 리포트 팝업 열기
  const handleOpenReport = (type: 'all' | 'branch') => {
    const text = type === 'all' ? generateAllBranchReport() : generateBranchReport();
    setReportText(text);
    setShowReportModal(true);
  };

  // 날짜 필터 컴포넌트
  const DateFilterCard = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          기간 검색
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant={selectedPreset === 'today' ? 'default' : 'outline'} size="sm" onClick={() => handleMainPresetSelect('today')}>오늘</Button>
            <Button variant={selectedPreset === 'yesterday' ? 'default' : 'outline'} size="sm" onClick={() => handleMainPresetSelect('yesterday')}>어제</Button>
            <Button variant={selectedPreset === 'week' ? 'default' : 'outline'} size="sm" onClick={() => handleMainPresetSelect('week')}>1주일</Button>
            <Button variant={selectedPreset === 'thisMonth' ? 'default' : 'outline'} size="sm" onClick={() => handleMainPresetSelect('thisMonth')}>이번달</Button>
            <Button variant={selectedPreset === 'lastMonth' ? 'default' : 'outline'} size="sm" onClick={() => handleMainPresetSelect('lastMonth')}>저번달</Button>
            {isMainSearched && (
              <Button variant="ghost" size="sm" onClick={handleShowAll} className="text-muted-foreground">전체보기</Button>
            )}
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">시작일</label>
              <Input type="date" value={mainDateFrom} onChange={(e) => { setMainDateFrom(e.target.value); setSelectedPreset(null); }} className="w-44" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">종료일</label>
              <Input type="date" value={mainDateTo} onChange={(e) => { setMainDateTo(e.target.value); setSelectedPreset(null); }} className="w-44" />
            </div>
            <Button onClick={handleMainSearch} className="bg-blue-600 hover:bg-blue-700">
              <Search className="h-4 w-4 mr-2" />검색
            </Button>
          </div>
          {isMainSearched && (
            <div className="text-sm text-muted-foreground pt-2 border-t">
              검색 기간: <strong>{appliedMainDateFrom}</strong> ~ <strong>{appliedMainDateTo}</strong>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // 법인 상세 보기 모드
  if (selectedBranch) {
    const isProduct = branchViewType === 'product';
    const branchStats = isProduct ? branchProductTotalStats : branchMaterialTotalStats;
    const searchStats = isProduct ? searchProductStats : searchMaterialStats;
    const waitingData = isProduct ? productWaitingData : materialWaitingData;
    const collectedData = isProduct ? productCollectedData : materialCollectedData;
    const shippedData = isProduct ? productShippedData : materialShippedData;
    const cancelledData = isProduct ? productCancelledData : materialCancelledData;

    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedBranch(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />돌아가기
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              법인 상세 현황: {getBranchDisplayName(selectedBranch)}
              <Badge variant={isProduct ? 'secondary' : 'default'}>{isProduct ? '제품' : '자재'}</Badge>
            </h1>
            <p className="text-muted-foreground">관리자 모드 - 상태 강제 변경 가능</p>
          </div>
          <Button variant="outline" onClick={() => handleOpenReport('branch')}>
            <FileText className="h-4 w-4 mr-2" />리포트 복사
          </Button>
        </div>

        {/* 법인 전체 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <StatCard title="전체" value={branchStats.total.toLocaleString()} icon={Package} />
          <StatCard title="회수대기" value={branchStats.waiting.toLocaleString()} icon={Clock} className="border-l-4 border-l-red-500" />
          <StatCard title="회수완료" value={branchStats.collected.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-amber-500" />
          <StatCard title="발송" value={branchStats.shipped.toLocaleString()} icon={TruckIcon} className="border-l-4 border-l-blue-500" />
          <StatCard title="입고완료" value={branchStats.received.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-green-500" />
          <StatCard title="발송불가" value={branchStats.cancelled.toLocaleString()} icon={XCircle} className="border-l-4 border-l-gray-500" />
        </div>

        {/* 날짜 검색 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">날짜 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant={branchSelectedPreset === 'today' ? 'default' : 'outline'} size="sm" onClick={() => handleBranchPresetSelect('today')}>오늘</Button>
                <Button variant={branchSelectedPreset === 'yesterday' ? 'default' : 'outline'} size="sm" onClick={() => handleBranchPresetSelect('yesterday')}>어제</Button>
                <Button variant={branchSelectedPreset === 'week' ? 'default' : 'outline'} size="sm" onClick={() => handleBranchPresetSelect('week')}>1주일</Button>
                <Button variant={branchSelectedPreset === 'thisMonth' ? 'default' : 'outline'} size="sm" onClick={() => handleBranchPresetSelect('thisMonth')}>이번달</Button>
                <Button variant={branchSelectedPreset === 'lastMonth' ? 'default' : 'outline'} size="sm" onClick={() => handleBranchPresetSelect('lastMonth')}>저번달</Button>
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">시작일</label>
                  <Input type="date" value={searchDateFrom} onChange={(e) => { setSearchDateFrom(e.target.value); setBranchSelectedPreset(null); }} className="w-44" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">종료일</label>
                  <Input type="date" value={searchDateTo} onChange={(e) => { setSearchDateTo(e.target.value); setBranchSelectedPreset(null); }} className="w-44" />
                </div>
                <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                  <Search className="h-4 w-4 mr-2" />검색
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
                <span>발송불가: <strong className="text-gray-600">{searchStats.cancelled}건</strong></span>
              </div>
            </div>

            <Tabs defaultValue="waiting">
              <TabsList>
                <TabsTrigger value="waiting">회수대기 ({searchStats.waiting})</TabsTrigger>
                <TabsTrigger value="collected">회수완료 ({searchStats.collected})</TabsTrigger>
                <TabsTrigger value="shipped">발송 ({searchStats.shipped})</TabsTrigger>
                <TabsTrigger value="cancelled">발송불가 ({searchStats.cancelled})</TabsTrigger>
              </TabsList>

              {/* 회수대기 탭 */}
              <TabsContent value="waiting">
                <Card>
                  <CardHeader><CardTitle>회수대기 목록</CardTitle></CardHeader>
                  <CardContent>
                    {waitingData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isProduct ? (
                              <>
                                <TableHead>고객번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>유형</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead>요청번호</TableHead>
                                <TableHead>처리시간</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>자재코드</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {waitingData.slice(0, 50).map((item) => (
                            <TableRow key={item.id}>
                              {isProduct ? (
                                <>
                                  <TableCell className="font-medium">{(item as ProductRecovery).customer_number}</TableCell>
                                  <TableCell>{(item as ProductRecovery).customer_name}</TableCell>
                                  <TableCell>{(item as ProductRecovery).model_name}</TableCell>
                                  <TableCell><Badge variant="outline">{(item as ProductRecovery).recovery_type}</Badge></TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleProductForceStatusChange(item as ProductRecovery, value as ProductRecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="회수완료">회수완료</SelectItem>
                                        <SelectItem value="발송">발송</SelectItem>
                                        <SelectItem value="입고완료">입고완료</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium">{(item as MaterialUsage).request_number}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as MaterialUsage).process_time ? new Date((item as MaterialUsage).process_time!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>{(item as MaterialUsage).model_name}</TableCell>
                                  <TableCell>{(item as MaterialUsage).material_code}</TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleMaterialForceStatusChange(item as MaterialUsage, value as RecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="회수완료">회수완료</SelectItem>
                                        <SelectItem value="발송">발송</SelectItem>
                                        <SelectItem value="입고완료">입고완료</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 회수대기 건이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 회수완료 탭 */}
              <TabsContent value="collected">
                <Card>
                  <CardHeader><CardTitle>회수완료 목록 (발송대기)</CardTitle></CardHeader>
                  <CardContent>
                    {collectedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isProduct ? (
                              <>
                                <TableHead>고객번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>유형</TableHead>
                                <TableHead>회수완료일</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead>요청번호</TableHead>
                                <TableHead>처리시간</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>자재코드</TableHead>
                                <TableHead>회수완료일</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collectedData.slice(0, 50).map((item) => (
                            <TableRow key={item.id}>
                              {isProduct ? (
                                <>
                                  <TableCell className="font-medium">{(item as ProductRecovery).customer_number}</TableCell>
                                  <TableCell>{(item as ProductRecovery).customer_name}</TableCell>
                                  <TableCell>{(item as ProductRecovery).model_name}</TableCell>
                                  <TableCell><Badge variant="outline">{(item as ProductRecovery).recovery_type}</Badge></TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as ProductRecovery).collected_at ? new Date((item as ProductRecovery).collected_at!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleProductForceStatusChange(item as ProductRecovery, value as ProductRecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="발송">발송</SelectItem>
                                        <SelectItem value="발송불가">발송불가</SelectItem>
                                        <SelectItem value="회수대기">회수대기</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium">{(item as MaterialUsage).request_number}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as MaterialUsage).process_time ? new Date((item as MaterialUsage).process_time!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>{(item as MaterialUsage).model_name}</TableCell>
                                  <TableCell>{(item as MaterialUsage).material_code}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as MaterialUsage).collected_at ? new Date((item as MaterialUsage).collected_at!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleMaterialForceStatusChange(item as MaterialUsage, value as RecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="발송">발송</SelectItem>
                                        <SelectItem value="발송불가">발송불가</SelectItem>
                                        <SelectItem value="회수대기">회수대기</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              )}
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
                  <CardHeader><CardTitle>발송 목록</CardTitle></CardHeader>
                  <CardContent>
                    {shippedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isProduct ? (
                              <>
                                <TableHead>고객번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>운송사</TableHead>
                                <TableHead>송장번호</TableHead>
                                <TableHead>발송일</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead>요청번호</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>자재코드</TableHead>
                                <TableHead>운송사</TableHead>
                                <TableHead>송장번호</TableHead>
                                <TableHead>발송일</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shippedData.slice(0, 50).map((item) => (
                            <TableRow key={item.id}>
                              {isProduct ? (
                                <>
                                  <TableCell className="font-medium">{(item as ProductRecovery).customer_number}</TableCell>
                                  <TableCell>{(item as ProductRecovery).customer_name}</TableCell>
                                  <TableCell>{(item as ProductRecovery).model_name}</TableCell>
                                  <TableCell>{(item as ProductRecovery).carrier || '-'}</TableCell>
                                  <TableCell className="font-mono text-sm">{(item as ProductRecovery).tracking_number || '-'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as ProductRecovery).shipped_at ? new Date((item as ProductRecovery).shipped_at!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleProductForceStatusChange(item as ProductRecovery, value as ProductRecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="입고완료">입고완료</SelectItem>
                                        <SelectItem value="회수완료">회수완료</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium">{(item as MaterialUsage).request_number}</TableCell>
                                  <TableCell>{(item as MaterialUsage).model_name}</TableCell>
                                  <TableCell>{(item as MaterialUsage).material_code}</TableCell>
                                  <TableCell>{(item as MaterialUsage).carrier || '-'}</TableCell>
                                  <TableCell className="font-mono text-sm">{(item as MaterialUsage).tracking_number || '-'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as MaterialUsage).shipped_at ? new Date((item as MaterialUsage).shipped_at!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleMaterialForceStatusChange(item as MaterialUsage, value as RecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="입고완료">입고완료</SelectItem>
                                        <SelectItem value="회수완료">회수완료</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              )}
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

              {/* 발송불가 탭 */}
              <TabsContent value="cancelled">
                <Card>
                  <CardHeader><CardTitle>발송불가 목록</CardTitle></CardHeader>
                  <CardContent>
                    {cancelledData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isProduct ? (
                              <>
                                <TableHead>고객번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>사유</TableHead>
                                <TableHead>상세사유</TableHead>
                                <TableHead>처리일</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead>요청번호</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>자재코드</TableHead>
                                <TableHead>사유</TableHead>
                                <TableHead>상세사유</TableHead>
                                <TableHead>처리일</TableHead>
                                <TableHead>상태변경</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cancelledData.slice(0, 50).map((item) => (
                            <TableRow key={item.id}>
                              {isProduct ? (
                                <>
                                  <TableCell className="font-medium">{(item as ProductRecovery).customer_number}</TableCell>
                                  <TableCell>{(item as ProductRecovery).customer_name}</TableCell>
                                  <TableCell>{(item as ProductRecovery).model_name}</TableCell>
                                  <TableCell><Badge variant="outline">{(item as ProductRecovery).cancel_reason || '-'}</Badge></TableCell>
                                  <TableCell className="text-sm">{(item as ProductRecovery).cancel_reason_detail || '-'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as ProductRecovery).cancelled_at ? new Date((item as ProductRecovery).cancelled_at!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleProductForceStatusChange(item as ProductRecovery, value as ProductRecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="회수대기">회수대기</SelectItem>
                                        <SelectItem value="회수완료">회수완료</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="font-medium">{(item as MaterialUsage).request_number}</TableCell>
                                  <TableCell>{(item as MaterialUsage).model_name}</TableCell>
                                  <TableCell>{(item as MaterialUsage).material_code}</TableCell>
                                  <TableCell><Badge variant="outline">{(item as MaterialUsage).cancel_reason || '-'}</Badge></TableCell>
                                  <TableCell className="text-sm">{(item as MaterialUsage).cancel_reason_detail || '-'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {(item as MaterialUsage).cancelled_at ? new Date((item as MaterialUsage).cancelled_at!).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Select onValueChange={(value) => handleMaterialForceStatusChange(item as MaterialUsage, value as RecoveryStatus)}>
                                      <SelectTrigger className="w-28 h-8"><SelectValue placeholder="변경" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="회수대기">회수대기</SelectItem>
                                        <SelectItem value="회수완료">회수완료</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">해당 기간에 발송불가 건이 없습니다.</p>
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

  // 기본 대시보드 모드 (탭 구조)
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">회수 현황 대시보드</h1>
          <p className="text-muted-foreground">자재 및 제품 회수 현황을 통합 관리합니다.</p>
        </div>
      </div>

      {/* 날짜 검색 */}
      <DateFilterCard />

      {/* 메인 탭 */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'overview' | 'material' | 'product')}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="h-4 w-4" />통합
          </TabsTrigger>
          <TabsTrigger value="material" className="flex items-center gap-2">
            <Package className="h-4 w-4" />자재
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />제품
          </TabsTrigger>
        </TabsList>

        {/* 통합 탭 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 통합 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="총 회수대상" value={filteredCombinedStats.total.toLocaleString()} icon={Package} description={isMainSearched ? "조회 기간 기준" : "전체 기간"} />
            <StatCard title="회수대기" value={filteredCombinedStats.waiting.toLocaleString()} icon={Clock} className="border-l-4 border-l-red-500" />
            <StatCard title="회수완료" value={filteredCombinedStats.collected.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-amber-500" />
            <StatCard title="발송" value={filteredCombinedStats.shipped.toLocaleString()} icon={TruckIcon} className="border-l-4 border-l-blue-500" />
            <StatCard title="입고완료" value={filteredCombinedStats.received.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-green-500" />
            <StatCard title="발송불가" value={filteredCombinedStats.cancelled.toLocaleString()} icon={XCircle} className="border-l-4 border-l-gray-500" />
          </div>

          {/* 자재/제품 비교 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMainTab('material')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-5 w-5" />자재 회수
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-red-600">{filteredMaterialStats.waiting}</div>
                    <div className="text-xs text-muted-foreground">회수대기</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{filteredMaterialStats.shipped}</div>
                    <div className="text-xs text-muted-foreground">발송</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{filteredMaterialStats.received}</div>
                    <div className="text-xs text-muted-foreground">입고완료</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                  전체 {filteredMaterialStats.total}건 | 법인 {materialBranchStats.length}개
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setMainTab('product')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />제품 회수
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-red-600">{filteredProductStats.waiting}</div>
                    <div className="text-xs text-muted-foreground">회수대기</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{filteredProductStats.shipped}</div>
                    <div className="text-xs text-muted-foreground">발송</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{filteredProductStats.received}</div>
                    <div className="text-xs text-muted-foreground">입고완료</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                  전체 {filteredProductStats.total}건 | 법인 {productBranchStats.length}개
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 통합 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">상태별 분포 (통합)</CardTitle></CardHeader>
              <CardContent>
                {filteredCombinedStats.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={combinedStatusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {combinedStatusDistribution.map((entry, index) => (
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

            <Card>
              <CardHeader><CardTitle className="text-lg">법인별 현황 (상위 10개)</CardTitle></CardHeader>
              <CardContent>
                {combinedBranchStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={combinedBranchStats.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="branch" type="category" width={100} tickFormatter={(code: string) => branchNameMap[code] || code} />
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

          {/* 통합 법인별 현황 테이블 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">법인별 현황 (자재 + 제품)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleOpenReport('all')}>
                <FileText className="h-4 w-4 mr-2" />리포트 복사
              </Button>
            </CardHeader>
            <CardContent>
              {combinedBranchStats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>법인명</TableHead>
                      <TableHead className="text-center">자재</TableHead>
                      <TableHead className="text-center">제품</TableHead>
                      <TableHead className="text-center">회수대기</TableHead>
                      <TableHead className="text-center">회수완료</TableHead>
                      <TableHead className="text-center">발송</TableHead>
                      <TableHead className="text-center">입고완료</TableHead>
                      <TableHead className="text-center">발송불가</TableHead>
                      <TableHead className="text-center">합계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedBranchStats.map((branch) => (
                      <TableRow key={branch.branch}>
                        <TableCell className="font-medium">{getBranchDisplayName(branch.branch)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{branch.materialCount}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="secondary">{branch.productCount}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-red-50 text-red-700">{branch.waiting}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-amber-50 text-amber-700">{branch.collected}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-blue-50 text-blue-700">{branch.shipped}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-green-50 text-green-700">{branch.received}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-gray-100 text-gray-700">{branch.cancelled}</Badge></TableCell>
                        <TableCell className="text-center font-medium">{branch.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">아직 데이터가 없습니다.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 자재 탭 */}
        <TabsContent value="material" className="space-y-6">
          {/* 자재 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="총 회수대상" value={filteredMaterialStats.total.toLocaleString()} icon={Package} description="자재 회수" />
            <StatCard title="회수대기" value={filteredMaterialStats.waiting.toLocaleString()} icon={Clock} className="border-l-4 border-l-red-500" />
            <StatCard title="회수완료" value={filteredMaterialStats.collected.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-amber-500" />
            <StatCard title="발송" value={filteredMaterialStats.shipped.toLocaleString()} icon={TruckIcon} className="border-l-4 border-l-blue-500" />
            <StatCard title="입고완료" value={filteredMaterialStats.received.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-green-500" />
            <StatCard title="발송불가" value={filteredMaterialStats.cancelled.toLocaleString()} icon={XCircle} className="border-l-4 border-l-gray-500" />
          </div>

          {/* 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">상태별 분포</CardTitle></CardHeader>
              <CardContent>
                {filteredMaterialStats.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={materialStatusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {materialStatusDistribution.map((entry, index) => (
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

            <Card>
              <CardHeader><CardTitle className="text-lg">법인별 현황 (상위 10개)</CardTitle></CardHeader>
              <CardContent>
                {materialBranchStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={materialBranchStats.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="branch" type="category" width={100} tickFormatter={(code: string) => branchNameMap[code] || code} />
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

          {/* 법인별 현황 테이블 */}
          <Card>
            <CardHeader><CardTitle className="text-lg">법인별 현황 (클릭하여 상세보기)</CardTitle></CardHeader>
            <CardContent>
              {materialBranchStats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>법인명</TableHead>
                      <TableHead className="text-center">회수대기</TableHead>
                      <TableHead className="text-center">회수완료</TableHead>
                      <TableHead className="text-center">발송</TableHead>
                      <TableHead className="text-center">입고완료</TableHead>
                      <TableHead className="text-center">발송불가</TableHead>
                      <TableHead className="text-center">합계</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialBranchStats.map((branch) => (
                      <TableRow key={branch.branch} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSelectBranch(branch.branch, 'material')}>
                        <TableCell className="font-medium">{getBranchDisplayName(branch.branch)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-red-50 text-red-700">{branch.waiting}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-amber-50 text-amber-700">{branch.collected}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-blue-50 text-blue-700">{branch.shipped}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-green-50 text-green-700">{branch.received}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-gray-100 text-gray-700">{branch.cancelled}</Badge></TableCell>
                        <TableCell className="text-center font-medium">{branch.total}</TableCell>
                        <TableCell><Button variant="ghost" size="sm">상세보기</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">아직 데이터가 없습니다.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 제품 탭 */}
        <TabsContent value="product" className="space-y-6">
          {/* 제품 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <StatCard title="전체" value={productStats.total.toLocaleString()} icon={Package} description="제품 회수" />
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{productStats.unselected}</div>
                <div className="text-sm text-muted-foreground">미선택</div>
              </CardContent>
            </Card>
            <StatCard title="회수대기" value={filteredProductStats.waiting.toLocaleString()} icon={Clock} className="border-l-4 border-l-red-500" />
            <StatCard title="회수완료" value={filteredProductStats.collected.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-amber-500" />
            <StatCard title="발송" value={filteredProductStats.shipped.toLocaleString()} icon={TruckIcon} className="border-l-4 border-l-blue-500" />
            <StatCard title="입고완료" value={filteredProductStats.received.toLocaleString()} icon={PackageCheck} className="border-l-4 border-l-green-500" />
            <StatCard title="발송불가" value={filteredProductStats.cancelled.toLocaleString()} icon={XCircle} className="border-l-4 border-l-gray-500" />
          </div>

          {/* 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">상태별 분포</CardTitle></CardHeader>
              <CardContent>
                {filteredProductStats.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={productStatusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {productStatusDistribution.map((entry, index) => (
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

            <Card>
              <CardHeader><CardTitle className="text-lg">법인별 현황 (상위 10개)</CardTitle></CardHeader>
              <CardContent>
                {productBranchStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productBranchStats.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="branch" type="category" width={100} tickFormatter={(code: string) => branchNameMap[code] || code} />
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

          {/* 법인별 현황 테이블 */}
          <Card>
            <CardHeader><CardTitle className="text-lg">법인별 현황 (클릭하여 상세보기)</CardTitle></CardHeader>
            <CardContent>
              {productBranchStats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>법인명</TableHead>
                      <TableHead className="text-center">회수대기</TableHead>
                      <TableHead className="text-center">회수완료</TableHead>
                      <TableHead className="text-center">발송</TableHead>
                      <TableHead className="text-center">입고완료</TableHead>
                      <TableHead className="text-center">발송불가</TableHead>
                      <TableHead className="text-center">합계</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productBranchStats.map((branch) => (
                      <TableRow key={branch.branch} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSelectBranch(branch.branch, 'product')}>
                        <TableCell className="font-medium">{getBranchDisplayName(branch.branch)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-red-50 text-red-700">{branch.waiting}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-amber-50 text-amber-700">{branch.collected}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-blue-50 text-blue-700">{branch.shipped}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-green-50 text-green-700">{branch.received}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-gray-100 text-gray-700">{branch.cancelled}</Badge></TableCell>
                        <TableCell className="text-center font-medium">{branch.total}</TableCell>
                        <TableCell><Button variant="ghost" size="sm">상세보기</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">아직 데이터가 없습니다.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 리포트 팝업 모달 */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              회수 현황 리포트
            </DialogTitle>
            <DialogDescription>
              아래 문구를 복사하여 메신저에 붙여넣기 하세요.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportText}
            readOnly
            className="min-h-[300px] font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportModal(false)}>
              닫기
            </Button>
            <Button onClick={() => handleCopyReport(reportText)}>
              <Copy className="h-4 w-4 mr-2" />
              클립보드 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
