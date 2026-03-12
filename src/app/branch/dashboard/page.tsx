'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Package, Clock, TruckIcon, CheckCircle2, AlertTriangle, Search, Printer, Users, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ShippingModal } from '@/components/modals/ShippingModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { CancelShippingModal } from '@/components/modals/CancelShippingModal';
import { RecoveryMaterialsNotice } from '@/components/modals/RecoveryMaterialsNotice';
import { OnboardingTour, RestartTourButton, TourStep } from '@/components/OnboardingTour';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useProductRecovery } from '@/hooks/useProductRecovery';
import { useAuth } from '@/hooks/useAuth';
import { MaterialUsage, Carrier, CancelReason, ProductRecovery, ProductRecoveryStatus } from '@/types';
import { useTechnicianNames } from '@/hooks/useTechnicianNames';
import { toast } from 'sonner';

// 온보딩 투어 단계 정의 (15단계 - 업그레이드)
const createTourSteps = (hasWaitingData: boolean, hasCollectedData: boolean): TourStep[] => {
  const steps: TourStep[] = [];

  // === 기본 소개 (1-3단계) ===
  steps.push({
    target: '#tour-welcome',
    title: '👋 쿠쿠 회수관리 시스템에 오신 것을 환영합니다!',
    content: '이 가이드는 설치법인 담당자를 위한 회수관리 기능을 소개합니다.\n\n📌 자재/제품 회수 → 발송 → 추적까지 한 곳에서 관리하세요.\n⏱️ 약 3분 소요됩니다.',
    position: 'bottom',
  });

  steps.push({
    target: '#tour-main-tabs',
    title: '1단계: 메인 탭 구조',
    content: '📊 통합현황: 자재+제품 전체 요약\n🔧 자재: 부품/자재 회수 관리\n📦 제품: 완제품 회수 관리\n\n필요한 탭을 선택하여 작업하세요!',
    position: 'bottom',
  });

  steps.push({
    target: '#tour-date-filter',
    title: '2단계: 조회 기간 선택',
    content: '날짜 범위를 선택하고 검색 버튼을 누르세요.\n\n⚡ 빠른 선택: 오늘, 1주일, 30일 등 버튼으로 간편 선택\n📅 수동 선택: 시작일~종료일 직접 입력',
    position: 'bottom',
  });

  // === 통합현황 (4-5단계) ===
  steps.push({
    target: '#tour-main-tabs',
    title: '3단계: 통합현황 탭으로 이동',
    content: '먼저 통합현황 탭을 확인해봅시다. 자재와 제품의 전체 상황을 한눈에 파악할 수 있습니다.',
    position: 'bottom',
    action: 'click-overview-tab',
  });

  steps.push({
    target: '#tour-overview-stats',
    title: '4단계: 통합 통계 확인',
    content: '자재와 제품을 합친 전체 현황입니다.\n\n✅ 전체 회수대상, 회수대기, 발송대기, 발송완료, 발송불가\n📊 각 카드에서 자재/제품 개별 건수도 확인 가능',
    position: 'bottom',
  });

  steps.push({
    target: '#tour-print-button',
    title: '5단계: 인쇄 기능',
    content: '📄 인쇄 버튼으로 현황을 출력할 수 있습니다.\n\n• 통합 인쇄: 자재+제품 전체\n• 자재 인쇄: 자재만\n• 제품 인쇄: 제품만\n• 발송내역 출력: 택배 동봉용 (선택 항목)',
    position: 'bottom',
  });

  // === 자재 회수 프로세스 (6-10단계) ===
  steps.push({
    target: '#tour-main-tabs',
    title: '6단계: 자재 탭으로 이동',
    content: '이제 자재 회수 프로세스를 살펴봅시다. 자재 탭을 클릭합니다.',
    position: 'bottom',
    action: 'click-material-tab',
  });

  steps.push({
    target: '#tour-stat-cards',
    title: '7단계: 자재 현황 확인',
    content: '자재의 상태별 건수를 확인하세요.\n\n🔴 회수대기 🟠 발송대기 🔵 발송완료 ⚫ 발송불가',
    position: 'bottom',
  });

  // 기사별 현황은 데이터가 있을 때만 표시
  steps.push({
    target: '#tour-stat-cards',
    title: '8단계: 회수대기 탭으로 이동',
    content: '이제 회수대기 목록을 확인해봅시다. 자동으로 탭을 이동합니다!',
    position: 'bottom',
    action: 'click-waiting-tab',
  });

  steps.push({
    target: '#tour-action-info',
    title: '9단계: 회수완료 처리',
    content: hasWaitingData
      ? '기사가 부품을 회수하면 [회수완료] 버튼을 클릭합니다.'
      : '회수대기 건이 있으면 [회수완료] 버튼이 표시됩니다.',
    position: 'bottom',
    isInteractive: hasWaitingData,
    action: hasWaitingData ? 'demo-collect' : undefined,
    demoButtonText: hasWaitingData ? '🎯 회수완료 연습하기' : undefined,
  });

  steps.push({
    target: '#tour-tab-collected',
    title: '10단계: 발송대기 탭으로 이동',
    content: '회수된 부품을 품질팀으로 발송합니다. 탭을 이동합니다!',
    position: 'top',
    action: 'click-collected-tab',
  });

  steps.push({
    target: '#tour-collected-table',
    title: '11단계: 발송 처리',
    content: hasCollectedData
      ? '✅ 체크박스로 여러 건 선택\n📦 [발송] 버튼: 송장번호 입력\n🖨️ [내역출력]: 택배 동봉용'
      : '발송대기 건이 있으면 [발송] 버튼이 표시됩니다.',
    position: 'bottom',
    isInteractive: hasCollectedData,
    action: hasCollectedData ? 'demo-ship' : undefined,
    demoButtonText: hasCollectedData ? '📦 발송 연습하기' : undefined,
  });

  // === 제품 및 마무리 (12-13단계) ===
  steps.push({
    target: '#tour-main-tabs',
    title: '12단계: 제품 회수',
    content: '제품 탭도 자재와 동일합니다.\n\n📦 회수대기 → 회수완료 → 발송',
    position: 'bottom',
  });

  steps.push({
    target: '#tour-welcome',
    title: '🎉 가이드 완료!',
    content: '축하합니다! 이제 쿠쿠 회수관리 시스템을 사용할 준비가 되었습니다.\n\n✅ 회수대기 → 회수완료 → 발송\n📊 통합/자재/제품 탭 활용\n❓ 우측 상단 "가이드 다시보기" 클릭',
    position: 'bottom',
  });

  return steps;
};

const TOUR_STORAGE_KEY = 'branch-dashboard-tour-completed';

// 모델명에 따른 받는 주소 결정
const DEFAULT_RECIPIENT_ADDRESS = '경기도 시흥시 정왕동 엠티브이북로 349 품질팀';

function getRecipientAddress(modelName?: string): { recipient: string; address: string } {
  if (!modelName) {
    return { recipient: '품질팀', address: DEFAULT_RECIPIENT_ADDRESS };
  }

  const upperModel = modelName.toUpperCase();

  // CBT-C, CBT-D, CBT-I, CBT-L → 나누텍
  if (upperModel.startsWith('CBT-C') ||
      upperModel.startsWith('CBT-D') ||
      upperModel.startsWith('CBT-I') ||
      upperModel.startsWith('CBT-L')) {
    return { recipient: '나누텍', address: '경기 김포시 황금로 127번길 117' };
  }

  // CWC-A → 로보터스
  if (upperModel.startsWith('CWC-A')) {
    return { recipient: '로보터스', address: '경기 성남시 판교로 700, 분당테크노파크 E동 106호' };
  }

  // 기본값 → 품질팀
  return { recipient: '품질팀', address: DEFAULT_RECIPIENT_ADDRESS };
}

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

export default function BranchDashboardPage() {
  // 메인 탭 상태 (통합/자재/제품)
  const [mainTab, setMainTab] = useState<'overview' | 'material' | 'product'>('overview');

  const [selectedItem, setSelectedItem] = useState<MaterialUsage | null>(null);
  const [selectedProductItem, setSelectedProductItem] = useState<ProductRecovery | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedProductItems, setSelectedProductItems] = useState<Set<string>>(new Set());
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showProductCollectModal, setShowProductCollectModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showProductShippingModal, setShowProductShippingModal] = useState(false);
  const [showBulkShippingModal, setShowBulkShippingModal] = useState(false);
  const [showBulkProductShippingModal, setShowBulkProductShippingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProductCancelModal, setShowProductCancelModal] = useState(false);
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [showBulkProductCancelModal, setShowBulkProductCancelModal] = useState(false);
  const [showOverdueWarning, setShowOverdueWarning] = useState(false);
  const [showMaterialsNotice, setShowMaterialsNotice] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  // 인쇄 모드 상태
  const [printMode, setPrintMode] = useState<'combined' | 'material' | 'product' | 'packing-material' | 'packing-product' | null>(null);

  // 내역출력 완료 추적 (일괄발송 전 출력 필수)
  const [printedMaterialIds, setPrintedMaterialIds] = useState<Set<string>>(new Set());
  const [printedProductIds, setPrintedProductIds] = useState<Set<string>>(new Set());
  const [showPrintRequiredAlert, setShowPrintRequiredAlert] = useState<{ type: 'material' | 'product'; unprintedItems: string[] } | null>(null);

  // 투어 관련 상태
  const [activeTab, setActiveTab] = useState<string>('waiting');
  const [showDemoCollectModal, setShowDemoCollectModal] = useState(false);
  const [showDemoShippingModal, setShowDemoShippingModal] = useState(false);
  const demoResolveRef = useRef<(() => void) | null>(null);

  // 검색 상태
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [isSearched, setIsSearched] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DatePreset | null>('last30days');

  const { getByBranch, updateStatus, updateStatusBulk, getCarriers } = useMaterialUsage();
  const {
    getByBranch: getProductByBranch,
    updateStatus: updateProductStatus,
    getCarriers: getProductCarriers
  } = useProductRecovery();
  const { session } = useAuth();
  const { getDisplayName } = useTechnicianNames(session?.branchCode);

  // 운송회사 목록 로드
  const loadCarriers = useCallback(async () => {
    const carrierList = await getCarriers();
    setCarriers(carrierList);
  }, [getCarriers]);

  useEffect(() => {
    loadCarriers();
  }, [loadCarriers]);

  // 로그인 시 회수대상 자재 안내 팝업 (투어와 충돌 방지: 투어 완료/스킵 시에만 표시)
  useEffect(() => {
    if (!session) return;

    const tourData = localStorage.getItem(TOUR_STORAGE_KEY);
    if (tourData) {
      try {
        const parsed = JSON.parse(tourData);
        const firstShownDate = new Date(parsed.firstShown);
        const daysPassed = Math.floor((Date.now() - firstShownDate.getTime()) / (1000 * 60 * 60 * 24));
        // 투어가 영구 스킵되었거나, 7일 지나서 투어가 안 뜨는 경우 → 즉시 팝업
        if (parsed.permanentlySkipped || daysPassed >= 7) {
          setShowMaterialsNotice(true);
          return;
        }
      } catch {
        // 파싱 실패 시 투어가 뜰 수 있으므로 대기
      }
    }
    // 투어가 아직 활성화될 수 있는 경우 → 투어 시작(1.5초) + 여유 후 팝업 표시
    // 투어가 끝나면 팝업 표시 (2초 후 확인)
    const timer = setTimeout(() => {
      setShowMaterialsNotice(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [session]);

  // 기본 날짜 설정 (최근 30일)
  useEffect(() => {
    const range = getDateRange('last30days');
    setSearchDateFrom(range.from);
    setSearchDateTo(range.to);
    // 자동 검색 실행
    setAppliedDateFrom(range.from);
    setAppliedDateTo(range.to);
    setIsSearched(true);
  }, []);

  // 본인 법인 자재 데이터
  const branchData = useMemo(() => {
    if (!session?.branchCode) return [];
    return getByBranch(session.branchCode);
  }, [getByBranch, session]);

  // 본인 법인 제품 데이터
  const productBranchData = useMemo(() => {
    if (!session?.branchCode) return [];
    return getProductByBranch(session.branchCode);
  }, [getProductByBranch, session]);

  // 날짜 프리셋 선택
  const handlePresetSelect = (preset: DatePreset) => {
    const range = getDateRange(preset);
    setSearchDateFrom(range.from);
    setSearchDateTo(range.to);
    setSelectedPreset(preset);
  };

  // 검색 실행
  const handleSearch = () => {
    setAppliedDateFrom(searchDateFrom);
    setAppliedDateTo(searchDateTo);
    setIsSearched(true);
  };

  // 검색된 자재 데이터 (날짜 필터 적용)
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

  // 검색된 제품 데이터 (날짜 필터 적용)
  const searchedProductData = useMemo(() => {
    if (!isSearched) return [];

    return productBranchData.filter(item => {
      const itemDate = item.created_at;
      if (itemDate) {
        const itemDateOnly = itemDate.split('T')[0];
        if (appliedDateFrom && itemDateOnly < appliedDateFrom) return false;
        if (appliedDateTo && itemDateOnly > appliedDateTo) return false;
      }
      return true;
    });
  }, [productBranchData, appliedDateFrom, appliedDateTo, isSearched]);

  // 자재 상태별 데이터
  const waitingData = useMemo(() => searchedData.filter((item) => item.status === '회수대기'), [searchedData]);
  const collectedData = useMemo(() => searchedData.filter((item) => item.status === '회수완료'), [searchedData]);
  const shippedData = useMemo(() => searchedData.filter((item) => item.status === '발송'), [searchedData]);
  const cancelledData = useMemo(() => searchedData.filter((item) => item.status === '발송불가'), [searchedData]);

  // 제품 상태별 데이터
  const productWaitingData = useMemo(() => searchedProductData.filter((item) => item.recovery_status === '회수대기'), [searchedProductData]);
  const productCollectedData = useMemo(() => searchedProductData.filter((item) => item.recovery_status === '회수완료'), [searchedProductData]);
  const productShippedData = useMemo(() => searchedProductData.filter((item) => item.recovery_status === '발송'), [searchedProductData]);
  const productCancelledData = useMemo(() => searchedProductData.filter((item) => item.recovery_status === '발송불가'), [searchedProductData]);

  // 제품 사원번호별 회수대기 그룹화
  const productWaitingByEmployee = useMemo(() => {
    const groups: Record<string, ProductRecovery[]> = {};
    productWaitingData.forEach(item => {
      const key = item.employee_number || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [productWaitingData]);

  // 기사코드별 회수대기 그룹화
  const waitingByTechnician = useMemo(() => {
    const groups: Record<string, MaterialUsage[]> = {};
    waitingData.forEach(item => {
      const key = item.technician_code || '미지정';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // 기사코드 정렬
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [waitingData]);

  // 기사별 현황 통계 (필터된 데이터 기준)
  const technicianStats = useMemo(() => {
    const stats: Record<string, { waiting: number; collected: number; shipped: number; total: number }> = {};

    searchedData.forEach(item => {
      const tech = item.technician_code || '미지정';
      if (!stats[tech]) {
        stats[tech] = { waiting: 0, collected: 0, shipped: 0, total: 0 };
      }
      stats[tech].total++;

      switch (item.status) {
        case '회수대기':
          stats[tech].waiting++;
          break;
        case '회수완료':
          stats[tech].collected++;
          break;
        case '발송':
        case '입고완료':
          stats[tech].shipped++;
          break;
      }
    });

    // 정렬: 회수대기 많은 순 → 전체 많은 순
    return Object.entries(stats)
      .map(([tech, data]) => ({ tech, ...data }))
      .sort((a, b) => b.waiting - a.waiting || b.total - a.total);
  }, [searchedData]);

  // 경과일별 회수완료 건 분류
  const urgencyStats = useMemo(() => {
    const now = new Date();
    const stats = {
      day1: [] as MaterialUsage[], // 1일 경과
      day2: [] as MaterialUsage[], // 2일 경과
      day3to5: [] as MaterialUsage[], // 3~5일 경과
      day6plus: [] as MaterialUsage[], // 6일 이상 (긴급)
    };

    collectedData.forEach(item => {
      if (!item.collected_at) return;
      const collectedDate = new Date(item.collected_at);
      const daysPassed = Math.floor((now.getTime() - collectedDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPassed >= 6) {
        stats.day6plus.push(item);
      } else if (daysPassed >= 3) {
        stats.day3to5.push(item);
      } else if (daysPassed >= 2) {
        stats.day2.push(item);
      } else if (daysPassed >= 1) {
        stats.day1.push(item);
      }
    });

    return stats;
  }, [collectedData]);

  // 6일 경과 회수완료 건 체크 (기존 호환)
  const overdueItems = useMemo(() => urgencyStats.day6plus, [urgencyStats]);

  // 경고 팝업 표시
  useEffect(() => {
    if (overdueItems.length > 0) {
      setShowOverdueWarning(true);
    }
  }, [overdueItems]);

  // 투어 단계 생성 (데이터에 따라 동적)
  const tourSteps = useMemo(() => {
    return createTourSteps(waitingData.length > 0, collectedData.length > 0);
  }, [waitingData.length, collectedData.length]);

  // 투어 액션 핸들러 (탭 전환)
  const handleTourAction = useCallback((action: string) => {
    if (action === 'click-waiting-tab') {
      setActiveTab('waiting');
    } else if (action === 'click-collected-tab') {
      setActiveTab('collected');
    } else if (action === 'click-overview-tab') {
      setMainTab('overview');
    } else if (action === 'click-material-tab') {
      setMainTab('material');
    }
  }, []);

  // 투어 데모 액션 핸들러 (연습 모드)
  const handleDemoAction = useCallback(async (action: string) => {
    return new Promise<void>((resolve) => {
      // resolve 함수를 ref에 저장하여 모달이 닫힐 때 호출
      demoResolveRef.current = resolve;

      if (action === 'demo-collect') {
        setShowDemoCollectModal(true);
      } else if (action === 'demo-ship') {
        setShowDemoShippingModal(true);
      } else {
        demoResolveRef.current = null;
        resolve();
      }
    });
  }, []);

  // 전체 선택
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(collectedData.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // 개별 선택
  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  // 회수완료 처리
  const handleCollect = async () => {
    if (!selectedItem || !session) return;

    try {
      await updateStatus(selectedItem.id, '회수완료', session.userCode);
      toast.success('회수완료 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowCollectModal(false);
    setSelectedItem(null);
  };

  // 단건 발송 처리
  const handleShip = async (carrier: string, trackingNumber: string) => {
    if (!selectedItem || !session) return;

    try {
      await updateStatus(selectedItem.id, '발송', session.userCode, { carrier, tracking_number: trackingNumber });
      toast.success('발송 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowShippingModal(false);
    setSelectedItem(null);
  };

  // 일괄 발송 처리
  const handleBulkShip = async (carrier: string, trackingNumber: string) => {
    if (selectedItems.size === 0 || !session) return;

    try {
      const ids = Array.from(selectedItems);
      await updateStatusBulk(ids, '발송', session.userCode, { carrier, tracking_number: trackingNumber });
      toast.success(`${ids.length}건이 일괄 발송 처리되었습니다.`);
      setSelectedItems(new Set());
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowBulkShippingModal(false);
  };

  // 단건 발송불가 처리
  const handleCancel = async (reason: CancelReason, detail?: string) => {
    if (!selectedItem || !session) return;

    try {
      await updateStatus(selectedItem.id, '발송불가', session.userCode, { cancel_reason: reason, cancel_reason_detail: detail });
      toast.success('발송불가 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowCancelModal(false);
    setSelectedItem(null);
  };

  // 일괄 발송불가 처리
  const handleBulkCancel = async (reason: CancelReason, detail?: string) => {
    if (selectedItems.size === 0 || !session) return;

    try {
      const ids = Array.from(selectedItems);
      await updateStatusBulk(ids, '발송불가', session.userCode, { cancel_reason: reason, cancel_reason_detail: detail });
      toast.success(`${ids.length}건이 발송불가 처리되었습니다.`);
      setSelectedItems(new Set());
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowBulkCancelModal(false);
  };

  // 인쇄 (탭별)
  const handlePrint = (mode: 'combined' | 'material' | 'product') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  // 발송 내역 출력 (택배 동봉용) + 출력 이력 추적
  const handlePackingPrint = (type: 'material' | 'product') => {
    setPrintMode(type === 'material' ? 'packing-material' : 'packing-product');
    // 출력한 항목 ID 기록
    if (type === 'material') {
      setPrintedMaterialIds(prev => {
        const next = new Set(prev);
        selectedItems.forEach(id => next.add(id));
        return next;
      });
    } else {
      setPrintedProductIds(prev => {
        const next = new Set(prev);
        selectedProductItems.forEach(id => next.add(id));
        return next;
      });
    }
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  // 일괄발송 전 내역출력 여부 확인
  const handleBulkShipWithCheck = (type: 'material' | 'product') => {
    if (type === 'material') {
      const unprintedIds = Array.from(selectedItems).filter(id => !printedMaterialIds.has(id));
      if (unprintedIds.length > 0) {
        const unprintedItems = unprintedIds.map(id => {
          const item = collectedData.find(d => d.id === id);
          return item ? `${item.request_number} (${item.material_name || item.material_code})` : id;
        });
        setShowPrintRequiredAlert({ type: 'material', unprintedItems });
        return;
      }
      setShowBulkShippingModal(true);
    } else {
      const unprintedIds = Array.from(selectedProductItems).filter(id => !printedProductIds.has(id));
      if (unprintedIds.length > 0) {
        const unprintedItems = unprintedIds.map(id => {
          const item = productCollectedData.find(d => d.id === id);
          return item ? `${item.customer_number} (${item.model_name})` : id;
        });
        setShowPrintRequiredAlert({ type: 'product', unprintedItems });
        return;
      }
      setShowBulkProductShippingModal(true);
    }
  };

  // 선택된 자재 데이터 (발송대기)
  const selectedMaterialItems = useMemo(() => {
    return collectedData.filter(item => selectedItems.has(item.id));
  }, [collectedData, selectedItems]);

  // 선택된 제품 데이터 (발송대기)
  const selectedProductItemsList = useMemo(() => {
    return productCollectedData.filter(item => selectedProductItems.has(item.id));
  }, [productCollectedData, selectedProductItems]);

  // 상태별 통계 (필터된 데이터 기준)
  const totalStats = useMemo(() => ({
    total: searchedData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
    cancelled: cancelledData.length,
  }), [searchedData, waitingData, collectedData, shippedData, cancelledData]);

  // 검색 결과 통계
  const searchStats = useMemo(() => ({
    total: searchedData.length,
    waiting: waitingData.length,
    collected: collectedData.length,
    shipped: shippedData.length,
    cancelled: cancelledData.length,
    overdue: overdueItems.length,
  }), [searchedData, waitingData, collectedData, shippedData, cancelledData, overdueItems]);

  // 제품 통계
  const productTotalStats = useMemo(() => ({
    total: searchedProductData.length,
    waiting: productWaitingData.length,
    collected: productCollectedData.length,
    shipped: productShippedData.length,
    cancelled: productCancelledData.length,
  }), [searchedProductData, productWaitingData, productCollectedData, productShippedData, productCancelledData]);

  // 통합 통계
  const combinedStats = useMemo(() => ({
    total: totalStats.total + productTotalStats.total,
    waiting: totalStats.waiting + productTotalStats.waiting,
    collected: totalStats.collected + productTotalStats.collected,
    shipped: totalStats.shipped + productTotalStats.shipped,
    cancelled: totalStats.cancelled + productTotalStats.cancelled,
  }), [totalStats, productTotalStats]);

  // 제품 전체 선택
  const handleProductSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductItems(new Set(productCollectedData.map(item => item.id)));
    } else {
      setSelectedProductItems(new Set());
    }
  };

  // 제품 개별 선택
  const handleProductSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedProductItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedProductItems(newSelected);
  };

  // 제품 회수완료 처리
  const handleProductCollect = async () => {
    if (!selectedProductItem || !session) return;

    try {
      await updateProductStatus(selectedProductItem.id, '회수완료', session.userCode);
      toast.success('회수완료 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowProductCollectModal(false);
    setSelectedProductItem(null);
  };

  // 제품 단건 발송 처리
  const handleProductShip = async (carrier: string, trackingNumber: string) => {
    if (!selectedProductItem || !session) return;

    try {
      await updateProductStatus(selectedProductItem.id, '발송', session.userCode, { carrier, tracking_number: trackingNumber });
      toast.success('발송 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowProductShippingModal(false);
    setSelectedProductItem(null);
  };

  // 제품 일괄 발송 처리
  const handleBulkProductShip = async (carrier: string, trackingNumber: string) => {
    if (selectedProductItems.size === 0 || !session) return;

    try {
      const ids = Array.from(selectedProductItems);
      for (const id of ids) {
        await updateProductStatus(id, '발송', session.userCode, { carrier, tracking_number: trackingNumber });
      }
      toast.success(`${ids.length}건이 일괄 발송 처리되었습니다.`);
      setSelectedProductItems(new Set());
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowBulkProductShippingModal(false);
  };

  // 제품 단건 발송불가 처리
  const handleProductCancel = async (reason: CancelReason, detail?: string) => {
    if (!selectedProductItem || !session) return;

    try {
      await updateProductStatus(selectedProductItem.id, '발송불가', session.userCode, { cancel_reason: reason, cancel_reason_detail: detail });
      toast.success('발송불가 처리되었습니다.');
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowProductCancelModal(false);
    setSelectedProductItem(null);
  };

  // 제품 일괄 발송불가 처리
  const handleBulkProductCancel = async (reason: CancelReason, detail?: string) => {
    if (selectedProductItems.size === 0 || !session) return;

    try {
      const ids = Array.from(selectedProductItems);
      for (const id of ids) {
        await updateProductStatus(id, '발송불가', session.userCode, { cancel_reason: reason, cancel_reason_detail: detail });
      }
      toast.success(`${ids.length}건이 발송불가 처리되었습니다.`);
      setSelectedProductItems(new Set());
    } catch (error) {
      toast.error('처리 중 오류가 발생했습니다.');
    }
    setShowBulkProductCancelModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div id="tour-welcome" className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">회수 관리 대시보드</h1>
          <p className="text-muted-foreground">법인코드: {session?.branchCode}</p>
        </div>
        <RestartTourButton
          storageKey={TOUR_STORAGE_KEY}
          onRestart={() => {}}
        />
      </div>

      {/* 날짜 검색 (최상단) */}
      <Card id="tour-date-filter">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            조회 기간
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 빠른 선택 버튼 */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedPreset === 'last30days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('last30days')}
              >
                최근 30일
              </Button>
              <Button
                variant={selectedPreset === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('today')}
              >
                오늘
              </Button>
              <Button
                variant={selectedPreset === 'yesterday' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('yesterday')}
              >
                어제
              </Button>
              <Button
                variant={selectedPreset === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('week')}
              >
                1주일
              </Button>
              <Button
                variant={selectedPreset === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('thisMonth')}
              >
                이번달
              </Button>
              <Button
                variant={selectedPreset === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetSelect('lastMonth')}
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
                    setSelectedPreset(null);
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
                    setSelectedPreset(null);
                  }}
                  className="w-44"
                />
              </div>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                검색
              </Button>
              {isSearched && (
                <Button
                  id="tour-print-button"
                  variant="outline"
                  onClick={() => handlePrint(mainTab === 'overview' ? 'combined' : mainTab === 'material' ? 'material' : 'product')}
                  className="print:hidden"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {mainTab === 'overview' ? '통합 인쇄' : mainTab === 'material' ? '자재 인쇄' : '제품 인쇄'}
                </Button>
              )}
            </div>

            {/* 조회 기간 표시 */}
            {isSearched && (
              <p className="text-sm text-muted-foreground pt-2 border-t">
                조회 기간: <strong>{appliedDateFrom}</strong> ~ <strong>{appliedDateTo}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 메인 탭 (통합/자재/제품) */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'overview' | 'material' | 'product')} className="print:hidden">
        <TabsList id="tour-main-tabs" className="grid w-full grid-cols-3 mb-4 h-12 p-1 bg-slate-50 rounded-lg border border-slate-200">
          <TabsTrigger
            value="overview"
            className="text-sm h-10 bg-slate-100 text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-medium rounded-md"
          >
            📊 통합 현황
          </TabsTrigger>
          <TabsTrigger
            value="material"
            className="text-sm h-10 bg-slate-100 text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-medium rounded-md"
          >
            🔧 자재 ({totalStats.total})
          </TabsTrigger>
          <TabsTrigger
            value="product"
            className="text-sm h-10 bg-slate-100 text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm font-medium rounded-md"
          >
            📦 제품 ({productTotalStats.total})
          </TabsTrigger>
        </TabsList>

        {/* 통합 탭 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 통합 현황 통계 */}
          <div id="tour-overview-stats" className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard
              title="전체 회수대상"
              value={combinedStats.total.toLocaleString()}
              icon={Package}
              description={`자재 ${totalStats.total} + 제품 ${productTotalStats.total}`}
            />
            <StatCard
              title="회수대기"
              value={combinedStats.waiting.toLocaleString()}
              icon={Clock}
              className="border-l-4 border-l-red-500"
              description={`자재 ${totalStats.waiting} + 제품 ${productTotalStats.waiting}`}
            />
            <StatCard
              title="발송대기"
              value={combinedStats.collected.toLocaleString()}
              icon={CheckCircle2}
              className="border-l-4 border-l-amber-500"
              description={`자재 ${totalStats.collected} + 제품 ${productTotalStats.collected}`}
            />
            <StatCard
              title="발송완료"
              value={combinedStats.shipped.toLocaleString()}
              icon={TruckIcon}
              className="border-l-4 border-l-blue-500"
              description={`자재 ${totalStats.shipped} + 제품 ${productTotalStats.shipped}`}
            />
            <StatCard
              title="발송불가"
              value={combinedStats.cancelled.toLocaleString()}
              icon={XCircle}
              className="border-l-4 border-l-gray-500"
              description={`자재 ${totalStats.cancelled} + 제품 ${productTotalStats.cancelled}`}
            />
          </div>

          {/* 유형별 비교 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🔧 자재 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">회수대기</span>
                    <span className="font-medium text-red-600">{totalStats.waiting}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송대기</span>
                    <span className="font-medium text-amber-600">{totalStats.collected}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송완료</span>
                    <span className="font-medium text-blue-600">{totalStats.shipped}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송불가</span>
                    <span className="font-medium text-gray-600">{totalStats.cancelled}건</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setMainTab('material')}
                >
                  자재 상세보기
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📦 제품 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">회수대기</span>
                    <span className="font-medium text-red-600">{productTotalStats.waiting}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송대기</span>
                    <span className="font-medium text-amber-600">{productTotalStats.collected}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송완료</span>
                    <span className="font-medium text-blue-600">{productTotalStats.shipped}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송불가</span>
                    <span className="font-medium text-gray-600">{productTotalStats.cancelled}건</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setMainTab('product')}
                >
                  제품 상세보기
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 자재 탭 */}
        <TabsContent value="material" className="space-y-6">
          {/* 발송 필요 알림 (경과일별) */}
          {collectedData.length > 0 && showOverdueWarning && (
            <div className="space-y-2">
              {/* 6일 이상 - 긴급 */}
              {urgencyStats.day6plus.length > 0 && (
                <Alert variant="destructive" className="border-2 animate-pulse">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="text-base font-bold">🚨 긴급 발송 필요!</AlertTitle>
                  <AlertDescription className="text-sm">
                    회수 후 <strong>6일 이상</strong> 경과한 부품이 <strong className="text-lg">{urgencyStats.day6plus.length}건</strong> 있습니다.
                    <span className="block mt-1 text-red-700 font-medium">오늘 중으로 발송해주세요!</span>
                  </AlertDescription>
                </Alert>
              )}

          {/* 3~5일 경과 - 주의 */}
          {urgencyStats.day3to5.length > 0 && (
            <Alert className="border-amber-500 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">⚠️ 발송 권고</AlertTitle>
              <AlertDescription className="text-amber-700">
                회수 후 <strong>3~5일</strong> 경과: <strong>{urgencyStats.day3to5.length}건</strong>
                <span className="ml-2 text-sm">- 빠른 발송이 필요합니다</span>
              </AlertDescription>
            </Alert>
          )}

          {/* 1~2일 경과 - 안내 */}
          {(urgencyStats.day1.length > 0 || urgencyStats.day2.length > 0) && (
            <Alert className="border-blue-300 bg-blue-50 text-blue-900">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">📦 발송 대기 중</AlertTitle>
              <AlertDescription className="text-blue-700">
                {urgencyStats.day2.length > 0 && (
                  <span className="mr-4">2일 경과: <strong>{urgencyStats.day2.length}건</strong></span>
                )}
                {urgencyStats.day1.length > 0 && (
                  <span>1일 경과: <strong>{urgencyStats.day1.length}건</strong></span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* 닫기 버튼 */}
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setShowOverdueWarning(false)}
            >
              알림 숨기기
            </Button>
          </div>
        </div>
      )}

      {/* 현황 통계 (필터 적용) */}
      <div id="tour-stat-cards" className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="전체 회수대상"
          value={totalStats.total.toLocaleString()}
          icon={Package}
        />
        <StatCard
          title="회수대기"
          value={totalStats.waiting.toLocaleString()}
          icon={Clock}
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="🚚 발송대기"
          value={totalStats.collected.toLocaleString()}
          icon={CheckCircle2}
          className={`border-l-4 ${
            urgencyStats.day6plus.length > 0
              ? 'border-l-red-500 bg-red-50 ring-2 ring-red-300 animate-pulse'
              : urgencyStats.day3to5.length > 0
                ? 'border-l-amber-500 bg-amber-50'
                : 'border-l-amber-500'
          }`}
          description={
            urgencyStats.day6plus.length > 0
              ? `🚨 긴급 ${urgencyStats.day6plus.length}건 발송필요!`
              : urgencyStats.day3to5.length > 0
                ? `⚠️ ${urgencyStats.day3to5.length}건 발송권고`
                : undefined
          }
          descriptionClassName={
            urgencyStats.day6plus.length > 0
              ? 'text-red-600 font-bold'
              : urgencyStats.day3to5.length > 0
                ? 'text-amber-600 font-medium'
                : undefined
          }
        />
        <StatCard
          title="발송완료"
          value={totalStats.shipped.toLocaleString()}
          icon={TruckIcon}
          className="border-l-4 border-l-blue-500"
        />
        <StatCard
          title="발송불가"
          value={totalStats.cancelled.toLocaleString()}
          icon={XCircle}
          className="border-l-4 border-l-gray-500"
        />
      </div>

      {/* 기사별 회수 현황 (필터 적용) */}
      {technicianStats.length > 0 && (
        <Card id="tour-technician-stats">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              기사별 회수 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {technicianStats.slice(0, 9).map(({ tech, waiting, collected, shipped, total }) => {
                const completedRate = total > 0 ? Math.round(((collected + shipped) / total) * 100) : 0;
                return (
                  <div
                    key={tech}
                    className={`p-3 rounded-lg border ${waiting > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="font-semibold">{getDisplayName(tech)}</Badge>
                      <span className="text-xs text-muted-foreground">총 {total}건</span>
                    </div>
                    {/* 진행률 바 */}
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                        style={{ width: `${completedRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600 font-medium">대기 {waiting}</span>
                      <span className="text-amber-600">완료 {collected}</span>
                      <span className="text-blue-600">발송 {shipped}</span>
                      <span className="text-green-600 font-medium">{completedRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {technicianStats.length > 9 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                외 {technicianStats.length - 9}명의 기사
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 상세 데이터 탭 */}
      {isSearched && (
        <>
          {/* 탭 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} id="tour-tabs">
            <TabsList className="print:hidden h-auto p-1">
              <TabsTrigger value="waiting" className="py-2" id="tour-tab-waiting">
                회수대기 ({searchStats.waiting})
              </TabsTrigger>
              <TabsTrigger
                value="collected"
                id="tour-tab-collected"
                className={`py-2 relative ${
                  searchStats.collected > 0
                    ? 'bg-amber-100 text-amber-900 data-[state=active]:bg-amber-500 data-[state=active]:text-white font-bold'
                    : ''
                }`}
              >
                <span className="flex items-center gap-1">
                  {searchStats.collected > 0 && <TruckIcon className="h-4 w-4" />}
                  발송대기 ({searchStats.collected})
                </span>
                {urgencyStats.day6plus.length > 0 && (
                  <Badge variant="destructive" className="ml-1 animate-pulse">
                    긴급 {urgencyStats.day6plus.length}
                  </Badge>
                )}
                {urgencyStats.day3to5.length > 0 && urgencyStats.day6plus.length === 0 && (
                  <Badge className="ml-1 bg-amber-500">
                    {urgencyStats.day3to5.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="shipped" className="py-2">
                발송완료 ({searchStats.shipped})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="py-2 text-gray-600">
                발송불가 ({searchStats.cancelled})
              </TabsTrigger>
            </TabsList>

            {/* 회수대기 탭 - 기사별 그룹화 */}
            <TabsContent value="waiting">
              <Card id="tour-action-info">
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
                                <TableHead className="w-[130px]">요청번호</TableHead>
                                <TableHead>처리시간</TableHead>
                                <TableHead>모델명</TableHead>
                                <TableHead>자재코드</TableHead>
                                <TableHead>자재명</TableHead>
                                <TableHead className="w-[60px]">수량</TableHead>
                                <TableHead className="w-[100px] print:hidden">액션</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.request_number}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.process_time
                                      ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                      : '-'}
                                  </TableCell>
                                  <TableCell>{item.model_name}</TableCell>
                                  <TableCell>{item.material_code}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{item.material_name}</TableCell>
                                  <TableCell>{item.output_quantity}</TableCell>
                                  <TableCell className="print:hidden">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setShowCollectModal(true);
                                      }}
                                    >
                                      회수완료
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 회수대기 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 회수완료 탭 */}
            <TabsContent value="collected">
              <Card id="tour-collected-table">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>회수완료 목록 (발송 대기)</CardTitle>
                    {selectedItems.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handlePackingPrint('material')}
                          className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          내역출력 ({selectedItems.size})
                        </Button>
                        <Button onClick={() => handleBulkShipWithCheck('material')}>
                          <TruckIcon className="h-4 w-4 mr-2" />
                          선택 일괄발송 ({selectedItems.size})
                        </Button>
                        <Button variant="destructive" onClick={() => setShowBulkCancelModal(true)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          선택 발송불가 ({selectedItems.size})
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {collectedData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={collectedData.length > 0 && collectedData.every(item => selectedItems.has(item.id))}
                              onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            />
                          </TableHead>
                          <TableHead>요청번호</TableHead>
                          <TableHead>처리시간</TableHead>
                          <TableHead>기사코드</TableHead>
                          <TableHead>자재코드</TableHead>
                          <TableHead>자재명</TableHead>
                          <TableHead>수량</TableHead>
                          <TableHead>회수일시</TableHead>
                          <TableHead>경과일</TableHead>
                          <TableHead className="w-[100px]">액션</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collectedData.map((item) => {
                          const daysPassed = item.collected_at
                            ? Math.floor((new Date().getTime() - new Date(item.collected_at).getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                          const isOverdue = daysPassed >= 6;

                          return (
                            <TableRow key={item.id} className={isOverdue ? 'bg-red-50' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedItems.has(item.id)}
                                  onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{item.request_number}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.process_time
                                  ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getDisplayName(item.technician_code)}</Badge>
                              </TableCell>
                              <TableCell>{item.material_code}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                              <TableCell>{item.output_quantity}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                  D+{daysPassed}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setShowShippingModal(true);
                                    }}
                                  >
                                    발송
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setShowCancelModal(true);
                                    }}
                                  >
                                    불가
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 발송 대기 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 발송완료 탭 */}
            <TabsContent value="shipped">
              <Card>
                <CardHeader>
                  <CardTitle>발송완료 목록</CardTitle>
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
                          <TableHead>자재명</TableHead>
                          <TableHead>운송회사</TableHead>
                          <TableHead>송장번호</TableHead>
                          <TableHead>발송일시</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shippedData.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.request_number}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.process_time
                                ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getDisplayName(item.technician_code)}</Badge>
                            </TableCell>
                            <TableCell>{item.material_code}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                            <TableCell>{item.carrier}</TableCell>
                            <TableCell>{item.tracking_number}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.shipped_at
                                ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={item.status} size="sm" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 발송 완료 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 발송불가 탭 */}
            <TabsContent value="cancelled">
              <Card>
                <CardHeader>
                  <CardTitle>발송불가 목록</CardTitle>
                </CardHeader>
                <CardContent>
                  {cancelledData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>요청번호</TableHead>
                          <TableHead>처리시간</TableHead>
                          <TableHead>기사코드</TableHead>
                          <TableHead>자재코드</TableHead>
                          <TableHead>자재명</TableHead>
                          <TableHead>불가사유</TableHead>
                          <TableHead>상세사유</TableHead>
                          <TableHead>처리일시</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cancelledData.map((item) => (
                          <TableRow key={item.id} className="bg-gray-50">
                            <TableCell className="font-medium">{item.request_number}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.process_time
                                ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getDisplayName(item.technician_code)}</Badge>
                            </TableCell>
                            <TableCell>{item.material_code}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{item.material_name}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{item.cancel_reason || '-'}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {item.cancel_reason_detail || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.cancelled_at
                                ? new Date(item.cancelled_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={item.status} size="sm" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      해당 기간에 발송불가 건이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* 검색 전 안내 (자재) */}
      {!isSearched && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">날짜를 선택하고 검색 버튼을 눌러주세요.</p>
            <p className="text-sm mt-2">검색 결과가 기사별로 그룹화되어 표시됩니다.</p>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* 제품 탭 */}
        <TabsContent value="product" className="space-y-6">
          {/* 제품 현황 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard
              title="전체 제품"
              value={productTotalStats.total.toLocaleString()}
              icon={Package}
            />
            <StatCard
              title="회수대기"
              value={productTotalStats.waiting.toLocaleString()}
              icon={Clock}
              className="border-l-4 border-l-red-500"
            />
            <StatCard
              title="발송대기"
              value={productTotalStats.collected.toLocaleString()}
              icon={CheckCircle2}
              className="border-l-4 border-l-amber-500"
            />
            <StatCard
              title="발송완료"
              value={productTotalStats.shipped.toLocaleString()}
              icon={TruckIcon}
              className="border-l-4 border-l-blue-500"
            />
            <StatCard
              title="발송불가"
              value={productTotalStats.cancelled.toLocaleString()}
              icon={XCircle}
              className="border-l-4 border-l-gray-500"
            />
          </div>

          {/* 제품 데이터 탭 */}
          {isSearched ? (
            <Tabs defaultValue="product-waiting">
              <TabsList className="h-auto p-1">
                <TabsTrigger value="product-waiting" className="py-2">
                  회수대기 ({productWaitingData.length})
                </TabsTrigger>
                <TabsTrigger value="product-collected" className="py-2">
                  발송대기 ({productCollectedData.length})
                </TabsTrigger>
                <TabsTrigger value="product-shipped" className="py-2">
                  발송완료 ({productShippedData.length})
                </TabsTrigger>
                <TabsTrigger value="product-cancelled" className="py-2 text-gray-600">
                  발송불가 ({productCancelledData.length})
                </TabsTrigger>
              </TabsList>

              {/* 제품 회수대기 - 사원별 그룹화 */}
              <TabsContent value="product-waiting">
                <Card>
                  <CardHeader>
                    <CardTitle>제품 회수대기 목록 (사원별)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {productWaitingByEmployee.length > 0 ? (
                      <div className="space-y-6">
                        {productWaitingByEmployee.map(([empCode, items]) => (
                          <div key={empCode} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                              <Badge className="text-base px-3 py-1">{getDisplayName(empCode)}</Badge>
                              <span className="text-muted-foreground">({items.length}건)</span>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>유형</TableHead>
                                  <TableHead>고객번호</TableHead>
                                  <TableHead>고객명</TableHead>
                                  <TableHead>모델명</TableHead>
                                  <TableHead>요청지점</TableHead>
                                  <TableHead>해지요청일</TableHead>
                                  <TableHead className="w-[100px] print:hidden">액션</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                                        {item.recovery_type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                                    <TableCell>{item.customer_name}</TableCell>
                                    <TableCell>{item.model_name}</TableCell>
                                    <TableCell className="text-sm">{item.request_branch}</TableCell>
                                    <TableCell className="text-sm">{item.termination_request_date}</TableCell>
                                    <TableCell className="print:hidden">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedProductItem(item);
                                          setShowProductCollectModal(true);
                                        }}
                                      >
                                        회수완료
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">
                        해당 기간에 회수대기 건이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 제품 발송대기 */}
              <TabsContent value="product-collected">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>제품 발송대기 목록</CardTitle>
                      {selectedProductItems.size > 0 && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handlePackingPrint('product')}
                            className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            내역출력 ({selectedProductItems.size})
                          </Button>
                          <Button onClick={() => handleBulkShipWithCheck('product')}>
                            <TruckIcon className="h-4 w-4 mr-2" />
                            선택 일괄발송 ({selectedProductItems.size})
                          </Button>
                          <Button variant="destructive" onClick={() => setShowBulkProductCancelModal(true)}>
                            <XCircle className="h-4 w-4 mr-2" />
                            선택 발송불가 ({selectedProductItems.size})
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {productCollectedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={productCollectedData.length > 0 && productCollectedData.every(item => selectedProductItems.has(item.id))}
                                onCheckedChange={(checked) => handleProductSelectAll(!!checked)}
                              />
                            </TableHead>
                            <TableHead>유형</TableHead>
                            <TableHead>사원번호</TableHead>
                            <TableHead>고객번호</TableHead>
                            <TableHead>고객명</TableHead>
                            <TableHead>모델명</TableHead>
                            <TableHead>요청지점</TableHead>
                            <TableHead>회수일시</TableHead>
                            <TableHead className="w-[120px]">액션</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productCollectedData.map((item) => (
                            <TableRow key={item.id} className={selectedProductItems.has(item.id) ? 'bg-blue-50' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedProductItems.has(item.id)}
                                  onCheckedChange={(checked) => handleProductSelectItem(item.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                                  {item.recovery_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getDisplayName(item.employee_number)}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                              <TableCell>{item.customer_name}</TableCell>
                              <TableCell>{item.model_name}</TableCell>
                              <TableCell className="text-sm">{item.request_branch}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedProductItem(item);
                                      setShowProductShippingModal(true);
                                    }}
                                  >
                                    발송
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      setSelectedProductItem(item);
                                      setShowProductCancelModal(true);
                                    }}
                                  >
                                    불가
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">
                        해당 기간에 발송 대기 건이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 제품 발송완료 */}
              <TabsContent value="product-shipped">
                <Card>
                  <CardHeader>
                    <CardTitle>제품 발송완료 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {productShippedData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>유형</TableHead>
                            <TableHead>사원번호</TableHead>
                            <TableHead>고객번호</TableHead>
                            <TableHead>고객명</TableHead>
                            <TableHead>모델명</TableHead>
                            <TableHead>운송회사</TableHead>
                            <TableHead>송장번호</TableHead>
                            <TableHead>발송일시</TableHead>
                            <TableHead>상태</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productShippedData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                                  {item.recovery_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getDisplayName(item.employee_number)}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                              <TableCell>{item.customer_name}</TableCell>
                              <TableCell>{item.model_name}</TableCell>
                              <TableCell>{item.carrier}</TableCell>
                              <TableCell>{item.tracking_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  {item.recovery_status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">
                        해당 기간에 발송 완료 건이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 제품 발송불가 */}
              <TabsContent value="product-cancelled">
                <Card>
                  <CardHeader>
                    <CardTitle>제품 발송불가 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {productCancelledData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>유형</TableHead>
                            <TableHead>사원번호</TableHead>
                            <TableHead>고객번호</TableHead>
                            <TableHead>고객명</TableHead>
                            <TableHead>모델명</TableHead>
                            <TableHead>불가사유</TableHead>
                            <TableHead>상세사유</TableHead>
                            <TableHead>처리일시</TableHead>
                            <TableHead>상태</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productCancelledData.map((item) => (
                            <TableRow key={item.id} className="bg-gray-50">
                              <TableCell>
                                <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                                  {item.recovery_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getDisplayName(item.employee_number)}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                              <TableCell>{item.customer_name}</TableCell>
                              <TableCell>{item.model_name}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">{item.cancel_reason || '-'}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                {item.cancel_reason_detail || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.cancelled_at ? new Date(item.cancelled_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-gray-600 border-gray-600">
                                  {item.recovery_status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">
                        해당 기간에 발송불가 건이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">날짜를 선택하고 검색 버튼을 눌러주세요.</p>
                <p className="text-sm mt-2">검색 결과가 표시됩니다.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 회수완료 확인 모달 */}
      <ConfirmModal
        isOpen={showCollectModal}
        onClose={() => {
          setShowCollectModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleCollect}
        title="회수완료 처리"
        description={`요청번호 ${selectedItem?.request_number}의 부품을 회수완료 처리하시겠습니까?`}
        confirmText="회수완료"
      />

      {/* 단건 발송 정보 모달 */}
      <ShippingModal
        isOpen={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleShip}
        carriers={carriers}
        requestNumber={selectedItem?.request_number || ''}
      />

      {/* 일괄 발송 모달 */}
      <ShippingModal
        isOpen={showBulkShippingModal}
        onClose={() => setShowBulkShippingModal(false)}
        onConfirm={handleBulkShip}
        carriers={carriers}
        requestNumber={`일괄 발송 (${selectedItems.size}건)`}
        isBulk={true}
      />

      {/* 단건 발송불가 모달 */}
      <CancelShippingModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleCancel}
        requestNumber={selectedItem?.request_number || ''}
        materialName={selectedItem?.material_name}
      />

      {/* 일괄 발송불가 모달 */}
      <CancelShippingModal
        isOpen={showBulkCancelModal}
        onClose={() => setShowBulkCancelModal(false)}
        onConfirm={handleBulkCancel}
        requestNumber=""
        isBulk={true}
        bulkCount={selectedItems.size}
      />

      {/* 제품 회수완료 확인 모달 */}
      <ConfirmModal
        isOpen={showProductCollectModal}
        onClose={() => {
          setShowProductCollectModal(false);
          setSelectedProductItem(null);
        }}
        onConfirm={handleProductCollect}
        title="제품 회수완료 처리"
        description={`고객번호 ${selectedProductItem?.customer_number}의 제품을 회수완료 처리하시겠습니까?`}
        confirmText="회수완료"
      />

      {/* 제품 단건 발송 모달 */}
      <ShippingModal
        isOpen={showProductShippingModal}
        onClose={() => {
          setShowProductShippingModal(false);
          setSelectedProductItem(null);
        }}
        onConfirm={handleProductShip}
        carriers={carriers}
        requestNumber={`고객번호: ${selectedProductItem?.customer_number || ''}`}
      />

      {/* 제품 일괄 발송 모달 */}
      <ShippingModal
        isOpen={showBulkProductShippingModal}
        onClose={() => setShowBulkProductShippingModal(false)}
        onConfirm={handleBulkProductShip}
        carriers={carriers}
        requestNumber={`제품 일괄 발송 (${selectedProductItems.size}건)`}
        isBulk={true}
      />

      {/* 제품 단건 발송불가 모달 */}
      <CancelShippingModal
        isOpen={showProductCancelModal}
        onClose={() => {
          setShowProductCancelModal(false);
          setSelectedProductItem(null);
        }}
        onConfirm={handleProductCancel}
        requestNumber={`고객번호: ${selectedProductItem?.customer_number || ''}`}
        materialName={selectedProductItem?.model_name}
      />

      {/* 제품 일괄 발송불가 모달 */}
      <CancelShippingModal
        isOpen={showBulkProductCancelModal}
        onClose={() => setShowBulkProductCancelModal(false)}
        onConfirm={handleBulkProductCancel}
        requestNumber=""
        isBulk={true}
        bulkCount={selectedProductItems.size}
      />

      {/* 데모 회수완료 모달 */}
      <ConfirmModal
        isOpen={showDemoCollectModal}
        onClose={() => {
          setShowDemoCollectModal(false);
          // 모달이 닫히면 투어 재개
          if (demoResolveRef.current) {
            demoResolveRef.current();
            demoResolveRef.current = null;
          }
        }}
        onConfirm={() => {
          toast.success('🎯 연습 완료! 실제로는 이렇게 회수완료 처리가 됩니다.');
          setShowDemoCollectModal(false);
          // 모달이 닫히면 투어 재개
          if (demoResolveRef.current) {
            demoResolveRef.current();
            demoResolveRef.current = null;
          }
        }}
        title="[연습] 회수완료 처리"
        description={
          <div className="space-y-2">
            <p className="text-blue-600 font-medium">📘 이것은 연습입니다 (실제 데이터에 영향 없음)</p>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <p><strong>요청번호:</strong> DEMO-12345</p>
              <p><strong>자재코드:</strong> PART-001</p>
              <p><strong>자재명:</strong> 데모 부품</p>
            </div>
            <p className="text-gray-600">위 부품을 회수완료 처리하시겠습니까?</p>
          </div>
        }
        confirmText="회수완료"
      />

      {/* 데모 발송 모달 */}
      <ShippingModal
        isOpen={showDemoShippingModal}
        onClose={() => {
          setShowDemoShippingModal(false);
          // 모달이 닫히면 투어 재개
          if (demoResolveRef.current) {
            demoResolveRef.current();
            demoResolveRef.current = null;
          }
        }}
        onConfirm={(carrier, trackingNumber) => {
          toast.success(`🎯 연습 완료! 운송사: ${carrier}, 송장번호: ${trackingNumber}`);
          setShowDemoShippingModal(false);
          // 모달이 닫히면 투어 재개
          if (demoResolveRef.current) {
            demoResolveRef.current();
            demoResolveRef.current = null;
          }
        }}
        carriers={[
          { id: 'demo1', name: 'CJ대한통운', is_active: true },
          { id: 'demo2', name: '롯데택배', is_active: true },
          { id: 'demo3', name: '한진택배', is_active: true },
        ]}
        requestNumber="DEMO-12345 [연습]"
        isDemoMode={true}
      />

      {/* 내역출력 필요 안내 팝업 */}
      <Dialog open={!!showPrintRequiredAlert} onOpenChange={() => setShowPrintRequiredAlert(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <Printer className="h-5 w-5" />
              내역서 출력이 필요합니다
            </DialogTitle>
            <DialogDescription>
              일괄발송 처리 전에 반드시 내역서를 출력하여 택배에 동봉해야 합니다.
            </DialogDescription>
          </DialogHeader>
          {showPrintRequiredAlert && (
            <div className="py-2 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  아래 {showPrintRequiredAlert.unprintedItems.length}건의 내역서가 출력되지 않았습니다:
                </p>
                <ul className="text-sm text-amber-700 space-y-1 max-h-[200px] overflow-y-auto">
                  {showPrintRequiredAlert.unprintedItems.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                [내역출력] 버튼을 먼저 클릭하여 출력한 후 발송 처리를 진행해주세요.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrintRequiredAlert(null)}>
              확인
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                if (showPrintRequiredAlert) {
                  handlePackingPrint(showPrintRequiredAlert.type);
                }
                setShowPrintRequiredAlert(null);
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              지금 내역출력
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 인쇄용 전용 영역 - 통합 */}
      {(printMode === 'combined' || printMode === null) && (
        <div className="hidden print:block print-area">
          <div className="print-header">
            <h1>부품 회수 목록 (통합)</h1>
            <div className="print-meta">
              <span>법인코드: {session?.branchCode}</span>
              <span>검색기간: {appliedDateFrom} ~ {appliedDateTo}</span>
              <span>출력일시: {new Date().toLocaleString('ko-KR')}</span>
            </div>
            <div className="print-summary">
              <span style={{ fontWeight: 'bold' }}>【자재】</span>
              <span>대기: {searchStats.waiting}</span>
              <span>완료: {searchStats.collected}</span>
              <span>발송: {searchStats.shipped}</span>
              <span style={{ marginLeft: '20px', fontWeight: 'bold' }}>【제품】</span>
              <span>대기: {productTotalStats.waiting}</span>
              <span>완료: {productTotalStats.collected}</span>
              <span>발송: {productTotalStats.shipped}</span>
            </div>
          </div>

          {/* 자재 회수대기 목록 */}
          {waitingByTechnician.length > 0 && (
            <div className="print-section">
              <h2>■ 자재 회수대기 목록</h2>
              {waitingByTechnician.map(([techCode, items]) => (
                <div key={techCode} className="print-group">
                  <h3>기사: {getDisplayName(techCode)} ({items.length}건)</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>요청번호</th>
                        <th>처리시간</th>
                        <th>모델명</th>
                        <th>자재코드</th>
                        <th>자재명</th>
                        <th>수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.request_number}</td>
                          <td>{item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td>{item.model_name}</td>
                          <td>{item.material_code}</td>
                          <td>{item.material_name}</td>
                          <td>{item.output_quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* 자재 발송대기 목록 */}
          {collectedData.length > 0 && (
            <div className="print-section">
              <h2>■ 자재 발송대기 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>요청번호</th>
                    <th>기사코드</th>
                    <th>자재코드</th>
                    <th>자재명</th>
                    <th>수량</th>
                    <th>회수일시</th>
                  </tr>
                </thead>
                <tbody>
                  {collectedData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.request_number}</td>
                      <td>{getDisplayName(item.technician_code)}</td>
                      <td>{item.material_code}</td>
                      <td>{item.material_name}</td>
                      <td>{item.output_quantity}</td>
                      <td>{item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 제품 섹션 구분선 */}
          {(productWaitingData.length > 0 || productCollectedData.length > 0) && (
            <div className="print-section" style={{ borderTop: '3px double #333', paddingTop: '15px', marginTop: '20px' }}>
              <h2 style={{ fontSize: '14pt' }}>【 제품 회수 목록 】</h2>
            </div>
          )}

          {/* 제품 회수대기 목록 */}
          {productWaitingData.length > 0 && (
            <div className="print-section">
              <h2>■ 제품 회수대기 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>고객번호</th>
                    <th>고객명</th>
                    <th>모델명</th>
                    <th>요청지점</th>
                  </tr>
                </thead>
                <tbody>
                  {productWaitingData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.recovery_type}</td>
                      <td>{item.customer_number}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.model_name}</td>
                      <td>{item.request_branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 제품 발송대기 목록 */}
          {productCollectedData.length > 0 && (
            <div className="print-section">
              <h2>■ 제품 발송대기 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>고객번호</th>
                    <th>고객명</th>
                    <th>모델명</th>
                    <th>요청지점</th>
                  </tr>
                </thead>
                <tbody>
                  {productCollectedData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.recovery_type}</td>
                      <td>{item.customer_number}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.model_name}</td>
                      <td>{item.request_branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 인쇄용 전용 영역 - 자재만 */}
      {printMode === 'material' && (
        <div className="hidden print:block print-area">
          <div className="print-header">
            <h1>🔧 자재 회수 목록</h1>
            <div className="print-meta">
              <span>법인코드: {session?.branchCode}</span>
              <span>검색기간: {appliedDateFrom} ~ {appliedDateTo}</span>
              <span>출력일시: {new Date().toLocaleString('ko-KR')}</span>
            </div>
            <div className="print-summary">
              <span>회수대기: {searchStats.waiting}건</span>
              <span>발송대기: {searchStats.collected}건</span>
              <span>발송완료: {searchStats.shipped}건</span>
            </div>
          </div>

          {waitingByTechnician.length > 0 && (
            <div className="print-section">
              <h2>■ 회수대기 목록</h2>
              {waitingByTechnician.map(([techCode, items]) => (
                <div key={techCode} className="print-group">
                  <h3>기사: {getDisplayName(techCode)} ({items.length}건)</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>요청번호</th>
                        <th>처리시간</th>
                        <th>모델명</th>
                        <th>자재코드</th>
                        <th>자재명</th>
                        <th>수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.request_number}</td>
                          <td>{item.process_time ? new Date(item.process_time).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td>{item.model_name}</td>
                          <td>{item.material_code}</td>
                          <td>{item.material_name}</td>
                          <td>{item.output_quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {collectedData.length > 0 && (
            <div className="print-section">
              <h2>■ 발송대기 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>요청번호</th>
                    <th>기사코드</th>
                    <th>자재코드</th>
                    <th>자재명</th>
                    <th>수량</th>
                    <th>회수일시</th>
                    <th>경과일</th>
                  </tr>
                </thead>
                <tbody>
                  {collectedData.map((item) => {
                    const daysPassed = item.collected_at
                      ? Math.floor((new Date().getTime() - new Date(item.collected_at).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    return (
                      <tr key={item.id}>
                        <td>{item.request_number}</td>
                        <td>{getDisplayName(item.technician_code)}</td>
                        <td>{item.material_code}</td>
                        <td>{item.material_name}</td>
                        <td>{item.output_quantity}</td>
                        <td>{item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td>D+{daysPassed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {shippedData.length > 0 && (
            <div className="print-section">
              <h2>■ 발송완료 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>요청번호</th>
                    <th>기사코드</th>
                    <th>자재코드</th>
                    <th>자재명</th>
                    <th>운송회사</th>
                    <th>송장번호</th>
                    <th>발송일시</th>
                  </tr>
                </thead>
                <tbody>
                  {shippedData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.request_number}</td>
                      <td>{getDisplayName(item.technician_code)}</td>
                      <td>{item.material_code}</td>
                      <td>{item.material_name}</td>
                      <td>{item.carrier}</td>
                      <td>{item.tracking_number}</td>
                      <td>{item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 인쇄용 전용 영역 - 제품만 */}
      {printMode === 'product' && (
        <div className="hidden print:block print-area">
          <div className="print-header">
            <h1>📦 제품 회수 목록</h1>
            <div className="print-meta">
              <span>법인코드: {session?.branchCode}</span>
              <span>검색기간: {appliedDateFrom} ~ {appliedDateTo}</span>
              <span>출력일시: {new Date().toLocaleString('ko-KR')}</span>
            </div>
            <div className="print-summary">
              <span>회수대기: {productTotalStats.waiting}건</span>
              <span>발송대기: {productTotalStats.collected}건</span>
              <span>발송완료: {productTotalStats.shipped}건</span>
            </div>
          </div>

          {productWaitingData.length > 0 && (
            <div className="print-section">
              <h2>■ 회수대기 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>고객번호</th>
                    <th>고객명</th>
                    <th>모델명</th>
                    <th>요청지점</th>
                    <th>해지요청일</th>
                  </tr>
                </thead>
                <tbody>
                  {productWaitingData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.recovery_type}</td>
                      <td>{item.customer_number}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.model_name}</td>
                      <td>{item.request_branch}</td>
                      <td>{item.termination_request_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {productCollectedData.length > 0 && (
            <div className="print-section">
              <h2>■ 발송대기 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>고객번호</th>
                    <th>고객명</th>
                    <th>모델명</th>
                    <th>요청지점</th>
                    <th>회수일시</th>
                  </tr>
                </thead>
                <tbody>
                  {productCollectedData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.recovery_type}</td>
                      <td>{item.customer_number}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.model_name}</td>
                      <td>{item.request_branch}</td>
                      <td>{item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {productShippedData.length > 0 && (
            <div className="print-section">
              <h2>■ 발송완료 목록</h2>
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>고객번호</th>
                    <th>고객명</th>
                    <th>모델명</th>
                    <th>운송회사</th>
                    <th>송장번호</th>
                    <th>발송일시</th>
                  </tr>
                </thead>
                <tbody>
                  {productShippedData.map((item) => (
                    <tr key={item.id}>
                      <td>{item.recovery_type}</td>
                      <td>{item.customer_number}</td>
                      <td>{item.customer_name}</td>
                      <td>{item.model_name}</td>
                      <td>{item.carrier}</td>
                      <td>{item.tracking_number}</td>
                      <td>{item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 인쇄용 - 자재 발송 내역 (택배 동봉용) */}
      {printMode === 'packing-material' && (
        <div className="hidden print:block print-area">
          <div className="print-header">
            <h1>📦 자재 발송 내역서</h1>
            <div className="print-meta">
              <span>법인코드: {session?.branchCode}</span>
              <span>출력일시: {new Date().toLocaleString('ko-KR')}</span>
              <span>총 {selectedMaterialItems.length}건</span>
            </div>
          </div>
          <div className="print-section">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>No.</th>
                  <th style={{ width: '15%' }}>요청번호</th>
                  <th style={{ width: '10%' }}>기사코드</th>
                  <th style={{ width: '15%' }}>자재코드</th>
                  <th style={{ width: '35%' }}>자재명</th>
                  <th style={{ width: '10%' }}>수량</th>
                  <th style={{ width: '10%' }}>회수일</th>
                </tr>
              </thead>
              <tbody>
                {selectedMaterialItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{item.request_number}</td>
                    <td>{getDisplayName(item.technician_code)}</td>
                    <td>{item.material_code}</td>
                    <td>{item.material_name}</td>
                    <td style={{ textAlign: 'center' }}>{item.output_quantity}</td>
                    <td>{item.collected_at ? new Date(item.collected_at).toLocaleDateString('ko-KR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '30px', borderTop: '1px dashed #999', paddingTop: '15px', fontSize: '10pt' }}>
            <p><strong>발송 법인:</strong> {session?.branchCode}</p>
            <p><strong>발송 일자:</strong> {new Date().toLocaleDateString('ko-KR')}</p>
            <p style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
              <strong>받는 곳:</strong> {DEFAULT_RECIPIENT_ADDRESS}
            </p>
            <p style={{ marginTop: '10px', color: '#666' }}>* 본 내역서는 품질팀 입고 확인용입니다.</p>
          </div>
        </div>
      )}

      {/* 인쇄용 - 제품 발송 내역 (택배 동봉용, 1건씩 페이지 나눔) */}
      {printMode === 'packing-product' && (
        <div className="hidden print:block print-area">
          {selectedProductItemsList.map((item, idx) => (
            <div key={item.id} className="packing-slip">
              <div className="packing-header">
                <h1>📦 제품 회수 내역서</h1>
                <div className="packing-no">{idx + 1} / {selectedProductItemsList.length}</div>
              </div>

              <div className="packing-content">
                <table className="packing-table">
                  <tbody>
                    <tr>
                      <th>회수 유형</th>
                      <td>{item.recovery_type}</td>
                    </tr>
                    <tr>
                      <th>고객번호</th>
                      <td className="highlight">{item.customer_number}</td>
                    </tr>
                    <tr>
                      <th>고객명</th>
                      <td>{item.customer_name}</td>
                    </tr>
                    <tr>
                      <th>모델명</th>
                      <td className="highlight">{item.model_name}</td>
                    </tr>
                    <tr>
                      <th>요청지점</th>
                      <td>{item.request_branch}</td>
                    </tr>
                    <tr>
                      <th>해지요청일</th>
                      <td>{item.termination_request_date}</td>
                    </tr>
                    <tr>
                      <th>계약일</th>
                      <td>{item.contract_date || '-'}</td>
                    </tr>
                    <tr>
                      <th>회수일시</th>
                      <td>{item.collected_at ? new Date(item.collected_at).toLocaleString('ko-KR') : '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="packing-footer">
                <p><strong>발송 법인:</strong> {session?.branchCode}</p>
                <p><strong>발송 일자:</strong> {new Date().toLocaleDateString('ko-KR')}</p>
                {(() => {
                  const { recipient, address } = getRecipientAddress(item.model_name);
                  return (
                    <p className="recipient-box">
                      <strong>받는 곳:</strong> {address} ({recipient})
                    </p>
                  );
                })()}
                <p className="note">* 본 내역서는 입고 확인용입니다.</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 온보딩 투어 */}
      <OnboardingTour
        steps={tourSteps}
        storageKey={TOUR_STORAGE_KEY}
        onComplete={() => toast.success('가이드를 완료했습니다!')}
        onAction={handleTourAction}
        onDemoAction={handleDemoAction}
      />

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          /* 기본 페이지 숨김 */
          body * {
            visibility: hidden;
          }

          /* 인쇄 영역만 표시 */
          .print-area, .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10mm;
            font-size: 10pt;
          }

          /* 인쇄용 헤더 */
          .print-header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
          }

          .print-header h1 {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 8px;
          }

          .print-meta {
            display: flex;
            justify-content: center;
            gap: 20px;
            font-size: 9pt;
            color: #555;
            margin-bottom: 8px;
          }

          .print-summary {
            display: flex;
            justify-content: center;
            gap: 30px;
            font-size: 10pt;
            font-weight: 500;
          }

          /* 섹션 */
          .print-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .print-section h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #999;
          }

          /* 기사별 그룹 */
          .print-group {
            margin-bottom: 15px;
            page-break-inside: avoid;
          }

          .print-group h3 {
            font-size: 10pt;
            font-weight: bold;
            background: #f0f0f0;
            padding: 5px 8px;
            margin-bottom: 5px;
          }

          /* 테이블 스타일 */
          .print-area table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          .print-area th,
          .print-area td {
            border: 1px solid #333;
            padding: 4px 6px;
            text-align: left;
          }

          .print-area th {
            background: #e0e0e0;
            font-weight: bold;
            text-align: center;
          }

          .print-area td {
            word-break: break-all;
          }

          /* 페이지 나눔 */
          .print-section {
            break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          /* 패킹 슬립 전용 페이지 설정 (세로 모드) */
          @page packing {
            size: A4 portrait;
            margin: 10mm;
          }

          /* 패킹 슬립 스타일 (제품 1장씩 출력) */
          .packing-slip {
            page: packing;
            page-break-after: always;
            page-break-inside: avoid;
            padding: 5mm;
            width: 100%;
            height: auto;
            max-height: 277mm; /* A4 세로 297mm - 마진 20mm */
            box-sizing: border-box;
          }

          .packing-slip:last-child {
            page-break-after: auto;
          }

          .packing-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 5px;
            margin-bottom: 8px;
          }

          .packing-header h1 {
            font-size: 16pt;
            font-weight: bold;
            margin: 0 0 3px 0;
          }

          .packing-header .packing-no {
            font-size: 10pt;
            color: #666;
            margin: 0;
          }

          .packing-content {
            padding: 5px 0;
          }

          .packing-table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
          }

          .packing-table th,
          .packing-table td {
            border: 1px solid #333;
            padding: 6px 10px;
            font-size: 10pt;
          }

          .packing-table th {
            background: #f0f0f0;
            font-weight: bold;
            width: 25%;
            text-align: left;
          }

          .packing-table td {
            text-align: left;
          }

          .packing-table td.highlight {
            font-weight: bold;
            font-size: 11pt;
            background: #fffde7;
          }

          .packing-footer {
            border-top: 1px solid #333;
            padding-top: 5px;
            margin-top: 8px;
            font-size: 9pt;
            color: #666;
          }

          .packing-footer p {
            margin: 2px 0;
          }

          .packing-footer .note {
            font-style: italic;
            color: #888;
            margin-top: 5px;
          }

          .packing-footer .recipient-box {
            margin-top: 8px;
            padding: 8px 10px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            font-size: 10pt;
            color: #333;
          }

          /* 자재 패킹리스트 (리스트 형태) */
          .packing-list-material .packing-table {
            font-size: 10pt;
          }

          .packing-list-material .packing-table th,
          .packing-list-material .packing-table td {
            padding: 6px 8px;
          }
        }

        /* 화면에서는 인쇄 영역 숨김 */
        @media screen {
          .print-area {
            display: none;
          }
        }
      `}</style>

      {/* 회수대상 자재 안내 팝업 (조건부 렌더 - 불필요한 Supabase 구독 방지) */}
      {showMaterialsNotice && (
        <RecoveryMaterialsNotice
          open={showMaterialsNotice}
          onClose={() => setShowMaterialsNotice(false)}
        />
      )}
    </div>
  );
}
