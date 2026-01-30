'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RecoveryStatus } from '@/types';

const STATUS_COLORS: Record<RecoveryStatus, string> = {
  '회수대기': 'bg-red-500',
  '회수완료': 'bg-amber-500',
  '발송': 'bg-blue-500',
  '입고완료': 'bg-green-500',
  '발송불가': 'bg-gray-500',
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { getRecoveryTargets } = useMaterialUsage();

  const recoveryTargets = useMemo(() => getRecoveryTargets(), [getRecoveryTargets]);

  // 날짜별 데이터 그룹화
  const dataByDate = useMemo(() => {
    const map: Record<string, { waiting: number; collected: number; shipped: number; received: number }> = {};

    recoveryTargets.forEach((item) => {
      const dateKey = item.created_at.split('T')[0];
      if (!map[dateKey]) {
        map[dateKey] = { waiting: 0, collected: 0, shipped: 0, received: 0 };
      }

      switch (item.status) {
        case '회수대기':
          map[dateKey].waiting++;
          break;
        case '회수완료':
          map[dateKey].collected++;
          break;
        case '발송':
          map[dateKey].shipped++;
          break;
        case '입고완료':
          map[dateKey].received++;
          break;
      }
    });

    return map;
  }, [recoveryTargets]);

  // 달력 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // 시작 요일에 맞춰 빈 칸 추가
    const startDayOfWeek = start.getDay();
    const paddingDays = Array(startDayOfWeek).fill(null);

    return [...paddingDays, ...days];
  }, [currentDate]);

  // 이전 달
  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  // 다음 달
  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // 오늘로 이동
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">달력</h1>
        <p className="text-muted-foreground">날짜별 회수 현황을 확인합니다.</p>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded ${STATUS_COLORS['회수대기']}`} />
          <span className="text-sm">회수대기</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded ${STATUS_COLORS['회수완료']}`} />
          <span className="text-sm">회수완료</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded ${STATUS_COLORS['발송']}`} />
          <span className="text-sm">발송</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded ${STATUS_COLORS['입고완료']}`} />
          <span className="text-sm">입고완료</span>
        </div>
      </div>

      {/* 달력 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                오늘
              </Button>
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
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dateKey = format(day, 'yyyy-MM-dd');
              const dayData = dataByDate[dateKey];
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = day.getDay();

              return (
                <div
                  key={dateKey}
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
                  {dayData && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {dayData.waiting > 0 && (
                        <Badge variant="secondary" className={`text-xs px-1 py-0 ${STATUS_COLORS['회수대기']} text-white`}>
                          {dayData.waiting}
                        </Badge>
                      )}
                      {dayData.collected > 0 && (
                        <Badge variant="secondary" className={`text-xs px-1 py-0 ${STATUS_COLORS['회수완료']} text-white`}>
                          {dayData.collected}
                        </Badge>
                      )}
                      {dayData.shipped > 0 && (
                        <Badge variant="secondary" className={`text-xs px-1 py-0 ${STATUS_COLORS['발송']} text-white`}>
                          {dayData.shipped}
                        </Badge>
                      )}
                      {dayData.received > 0 && (
                        <Badge variant="secondary" className={`text-xs px-1 py-0 ${STATUS_COLORS['입고완료']} text-white`}>
                          {dayData.received}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
