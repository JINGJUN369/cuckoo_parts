'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useProductRecovery } from '@/hooks/useProductRecovery';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DayShipment {
  branch_code: string;
  materialCount: number;
  productCount: number;
  items: {
    type: '자재' | '제품';
    tracking_number?: string;
    carrier?: string;
    material_code?: string;
    model_name?: string;
  }[];
}

interface DayData {
  totalMaterial: number;
  totalProduct: number;
  branches: Record<string, DayShipment>;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { getRecoveryTargets: getMaterialTargets } = useMaterialUsage();
  const { getRecoveryTargets: getProductTargets } = useProductRecovery();

  const materialTargets = useMemo(() => getMaterialTargets(), [getMaterialTargets]);
  const productTargets = useMemo(() => getProductTargets(), [getProductTargets]);

  // 발송일 기준으로 날짜별 데이터 그룹화
  const dataByDate = useMemo(() => {
    const map: Record<string, DayData> = {};

    const ensureDate = (dateKey: string) => {
      if (!map[dateKey]) {
        map[dateKey] = { totalMaterial: 0, totalProduct: 0, branches: {} };
      }
    };

    const ensureBranch = (dateKey: string, branch: string) => {
      ensureDate(dateKey);
      if (!map[dateKey].branches[branch]) {
        map[dateKey].branches[branch] = { branch_code: branch, materialCount: 0, productCount: 0, items: [] };
      }
    };

    // 자재 - shipped_at 기준
    materialTargets.forEach((item) => {
      if (!item.shipped_at) return;
      const dateKey = item.shipped_at.split('T')[0];
      const branch = item.branch_code || 'UNKNOWN';
      ensureBranch(dateKey, branch);
      map[dateKey].totalMaterial++;
      map[dateKey].branches[branch].materialCount++;
      map[dateKey].branches[branch].items.push({
        type: '자재',
        tracking_number: item.tracking_number || undefined,
        carrier: item.carrier || undefined,
        material_code: item.material_code,
      });
    });

    // 제품 - shipped_at 기준
    productTargets.forEach((item) => {
      if (!item.shipped_at) return;
      const dateKey = (item.shipped_at as string).split('T')[0];
      const branch = item.branch_code || 'UNKNOWN';
      ensureBranch(dateKey, branch);
      map[dateKey].totalProduct++;
      map[dateKey].branches[branch].productCount++;
      map[dateKey].branches[branch].items.push({
        type: '제품',
        tracking_number: item.tracking_number || undefined,
        carrier: item.carrier || undefined,
        model_name: item.model_name,
      });
    });

    return map;
  }, [materialTargets, productTargets]);

  // 달력 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    const startDayOfWeek = start.getDay();
    const paddingDays = Array(startDayOfWeek).fill(null);
    return [...paddingDays, ...days];
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">달력</h1>
        <p className="text-muted-foreground">발송일 기준 법인별 발송 현황을 확인합니다.</p>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-sm">자재 발송</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span className="text-sm">제품 발송</span>
        </div>
        <span className="text-xs text-muted-foreground ml-4">마우스를 올리면 상세 정보가 표시됩니다.</span>
      </div>

      {/* 달력 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>오늘</Button>
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div
                key={day}
                className={`text-center text-sm font-medium py-2 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const dateKey = format(day, 'yyyy-MM-dd');
                const dayData = dataByDate[dateKey];
                const isToday = isSameDay(day, new Date());
                const dayOfWeek = day.getDay();
                const branchList = dayData ? Object.values(dayData.branches) : [];
                const hasData = dayData && (dayData.totalMaterial > 0 || dayData.totalProduct > 0);

                const cellContent = (
                  <div
                    className={`aspect-square p-1 border rounded-lg ${
                      isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-100'
                    } ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}`}
                  >
                    <div
                      className={`text-sm font-medium ${
                        dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    {hasData && (
                      <div className="mt-1 space-y-0.5">
                        {dayData.totalMaterial > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Package className="h-3 w-3 text-blue-500" />
                            <span className="text-xs font-medium text-blue-700">{dayData.totalMaterial}</span>
                          </div>
                        )}
                        {dayData.totalProduct > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Truck className="h-3 w-3 text-purple-500" />
                            <span className="text-xs font-medium text-purple-700">{dayData.totalProduct}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {branchList.length}개 법인
                        </div>
                      </div>
                    )}
                  </div>
                );

                if (!hasData) {
                  return <div key={dateKey}>{cellContent}</div>;
                }

                return (
                  <Tooltip key={dateKey}>
                    <TooltipTrigger asChild>
                      <div className="cursor-pointer">{cellContent}</div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[320px] p-3">
                      <div className="space-y-2">
                        <div className="font-medium text-sm border-b pb-1">
                          {format(day, 'M월 d일 (E)', { locale: ko })} 발송 현황
                        </div>
                        <div className="text-xs text-muted-foreground">
                          자재: {dayData.totalMaterial}건 / 제품: {dayData.totalProduct}건
                        </div>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {branchList
                            .sort((a, b) => (b.materialCount + b.productCount) - (a.materialCount + a.productCount))
                            .map((branch) => (
                            <div key={branch.branch_code} className="text-xs border-l-2 border-blue-300 pl-2">
                              <div className="font-medium">{branch.branch_code}</div>
                              <div className="text-muted-foreground">
                                자재:{branch.materialCount} / 제품:{branch.productCount}
                              </div>
                              {branch.items.slice(0, 3).map((item, i) => (
                                <div key={i} className="text-muted-foreground">
                                  {item.tracking_number && (
                                    <span>{item.carrier || '택배'}: {item.tracking_number}</span>
                                  )}
                                  {!item.tracking_number && (
                                    <span>{item.type === '자재' ? item.material_code : item.model_name}</span>
                                  )}
                                </div>
                              ))}
                              {branch.items.length > 3 && (
                                <div className="text-muted-foreground">... 외 {branch.items.length - 3}건</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
