'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click-waiting-tab' | 'click-collected-tab' | 'click-overview-tab' | 'click-material-tab' | 'demo-collect' | 'demo-ship'; // 자동 실행할 액션
  isInteractive?: boolean; // 사용자가 직접 클릭해야 하는 단계인지
  demoButtonText?: string; // 데모 버튼 텍스트
}

interface OnboardingTourProps {
  steps: TourStep[];
  storageKey: string; // localStorage key to track completion
  onComplete?: () => void;
  onAction?: (action: string) => void; // 액션 실행 콜백
  onDemoAction?: (action: string) => Promise<void>; // 데모 액션 콜백
}

export function OnboardingTour({ steps, storageKey, onComplete, onAction, onDemoAction }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // Check if tour should show on mount
  // 10주(70일) 동안은 매번 표시
  useEffect(() => {
    const storedData = localStorage.getItem(storageKey);

    if (!storedData) {
      // 처음 방문 - 투어 시작 (데이터 로딩 대기를 위해 1.5초 딜레이)
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    try {
      const data = JSON.parse(storedData);
      const firstShownDate = new Date(data.firstShown);
      const now = new Date();
      const daysPassed = Math.floor((now.getTime() - firstShownDate.getTime()) / (1000 * 60 * 60 * 24));

      // 영구 스킵한 경우
      if (data.permanentlySkipped) {
        return;
      }

      // 7일(1주) 이내면 계속 표시
      if (daysPassed < 7) {
        const timer = setTimeout(() => {
          setIsActive(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      // 파싱 실패 시 (이전 버전 데이터) - 투어 시작
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  // Update target element position
  const updateTargetPosition = useCallback(() => {
    if (!isActive || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const element = document.querySelector(step.target);

    if (element) {
      // 먼저 스크롤하여 요소를 화면에 표시
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 스크롤 애니메이션 완료 후 위치 업데이트
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }, 300);
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep, steps]);

  // 스크롤/리사이즈 시 위치 재계산
  useEffect(() => {
    if (!isActive) return;

    // 초기 위치 설정 (데이터 로딩 대기)
    const initialTimer = setTimeout(() => {
      updateTargetPosition();
    }, 100);

    // 스크롤 시 위치 업데이트
    const handleScroll = () => {
      if (!isActive || currentStep >= steps.length) return;
      const step = steps[currentStep];
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    };

    // 리사이즈 시 위치 업데이트
    const handleResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, currentStep, steps, updateTargetPosition]);

  // 단계 변경 시 위치 업데이트
  useEffect(() => {
    if (isActive) {
      // 약간의 딜레이 후 위치 업데이트 (DOM 렌더링 대기)
      const timer = setTimeout(() => {
        updateTargetPosition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isActive, updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = steps[currentStep + 1];
      // 다음 단계의 액션 실행 (탭 전환 등)
      if (nextStep.action && onAction) {
        onAction(nextStep.action);
        // 탭 전환 후 DOM 업데이트 대기
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 300);
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      handleComplete();
    }
  };

  // 데모 액션 실행 (실제 데이터에 영향 없이 연습)
  const handleDemoAction = async () => {
    const step = steps[currentStep];
    if (!step.action || !onDemoAction) return;

    setIsDemoLoading(true);
    // 데모 모달이 보이도록 투어를 임시로 숨김
    setIsActive(false);

    try {
      await onDemoAction(step.action);
    } catch {
      // 데모 실패 시 무시
    } finally {
      // 데모 완료 후 투어 다시 표시하고 다음 단계로
      setTimeout(() => {
        setIsActive(true);
        setIsDemoLoading(false);
        handleNext();
      }, 300);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    // 처음 완료 시 날짜 저장
    const storedData = localStorage.getItem(storageKey);
    let data = { firstShown: new Date().toISOString(), permanentlySkipped: false };

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        data = { ...data, firstShown: parsed.firstShown || data.firstShown };
      } catch {
        // 파싱 실패 시 새로 저장
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(data));
    setIsActive(false);
    onComplete?.();
  };

  // 일시 스킵 (다음에도 표시됨)
  const handleSkip = () => {
    const storedData = localStorage.getItem(storageKey);
    let data = { firstShown: new Date().toISOString(), permanentlySkipped: false };

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        data = { ...data, firstShown: parsed.firstShown || data.firstShown };
      } catch {
        // 파싱 실패 시 새로 저장
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(data));
    setIsActive(false);
  };

  // 영구 스킵 (다시 표시 안 함)
  const handlePermanentSkip = () => {
    const data = {
      firstShown: new Date().toISOString(),
      permanentlySkipped: true,
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
    setIsActive(false);
  };

  if (!isActive || !targetRect) return null;

  const step = steps[currentStep];
  const padding = 8;

  // Calculate tooltip position
  const getTooltipStyle = () => {
    const position = step.position || 'bottom';
    const tooltipWidth = 420; // 넓게 변경 (320 → 420)
    const tooltipHeight = step.isInteractive ? 320 : 240; // 높이도 증가

    let top = 0;
    let left = 0;

    // 화면 중앙 좌표
    const viewportCenterY = window.innerHeight / 2;
    const viewportCenterX = window.innerWidth / 2;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - 20;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + 20;
        break;
    }

    // 화면 밖으로 나가면 반대쪽이나 중앙으로 이동
    const minMargin = 24;
    const maxTop = window.innerHeight - tooltipHeight - minMargin;
    const maxLeft = window.innerWidth - tooltipWidth - minMargin;

    // 아래쪽으로 너무 내려가면 화면 중앙 위쪽으로 이동
    if (top > maxTop) {
      top = Math.min(viewportCenterY - tooltipHeight / 2, maxTop);
    }
    // 위쪽으로 너무 올라가면 조정
    if (top < minMargin) {
      top = minMargin;
    }

    // 좌우 조정
    if (left < minMargin) {
      left = minMargin;
    } else if (left > maxLeft) {
      left = maxLeft;
    }

    return { top, left, width: tooltipWidth };
  };

  const tooltipStyle = getTooltipStyle();

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - padding}
              y={targetRect.top - padding}
              width={targetRect.width + padding * 2}
              height={targetRect.height + padding * 2}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border */}
      <div
        className="absolute border-2 border-blue-500 rounded-lg pointer-events-none"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
        }}
      />

      {/* Tooltip - 크기 및 글씨 확대 */}
      <div
        className="absolute bg-white rounded-2xl shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={tooltipStyle}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === currentStep
                  ? 'w-8 bg-blue-500'
                  : idx < currentStep
                    ? 'w-2 bg-blue-300'
                    : 'w-2 bg-gray-200'
              }`}
            />
          ))}
          <span className="ml-3 text-sm text-gray-500 font-medium">
            {currentStep + 1} / {steps.length}
          </span>
        </div>

        {/* Content - 글씨 크기 증가 */}
        <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
        <p className="text-base text-gray-600 leading-relaxed mb-5 whitespace-pre-line">{step.content}</p>

        {/* Interactive Demo Button */}
        {step.isInteractive && onDemoAction && (
          <div className="mb-5 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
            <p className="text-sm text-blue-700 mb-3 font-medium">👆 아래 버튼을 눌러 연습해보세요!</p>
            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-base py-3"
              onClick={handleDemoAction}
              disabled={isDemoLoading}
            >
              {isDemoLoading ? '처리 중...' : step.demoButtonText || '연습하기'}
            </Button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-4">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              나중에
            </button>
            <button
              onClick={handlePermanentSkip}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              다시 보지 않기
            </button>
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="gap-1 px-4 py-2"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="gap-1 bg-blue-600 hover:bg-blue-700 px-5 py-2"
            >
              {currentStep === steps.length - 1 ? '완료' : '다음'}
              {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component to restart tour
export function RestartTourButton({
  storageKey,
  onRestart
}: {
  storageKey: string;
  onRestart: () => void;
}) {
  const handleRestart = () => {
    localStorage.removeItem(storageKey);
    onRestart();
    window.location.reload();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRestart}
      className="gap-2 text-gray-500 hover:text-gray-700"
    >
      <RotateCcw className="h-4 w-4" />
      가이드 다시 보기
    </Button>
  );
}
