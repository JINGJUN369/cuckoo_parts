'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  storageKey: string; // localStorage key to track completion
  onComplete?: () => void;
}

export function OnboardingTour({ steps, storageKey, onComplete }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check if tour should show on mount
  // 10주(70일) 동안은 매번 표시
  useEffect(() => {
    const storedData = localStorage.getItem(storageKey);

    if (!storedData) {
      // 처음 방문 - 투어 시작
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
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
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // 파싱 실패 시 (이전 버전 데이터) - 투어 시작
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  // Update target element position
  const updateTargetPosition = useCallback(() => {
    if (!isActive || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const element = document.querySelector(step.target);

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep, steps]);

  useEffect(() => {
    updateTargetPosition();

    // Update on resize
    window.addEventListener('resize', updateTargetPosition);
    return () => window.removeEventListener('resize', updateTargetPosition);
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
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
    const tooltipWidth = 320;
    const tooltipHeight = 180;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - 16;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 16;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - 16;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + 16;
        break;
    }

    // Keep within viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

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

      {/* Tooltip */}
      <div
        className="absolute bg-white rounded-xl shadow-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={tooltipStyle}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentStep
                  ? 'w-6 bg-blue-500'
                  : idx < currentStep
                    ? 'w-1.5 bg-blue-300'
                    : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-gray-400">
            {currentStep + 1} / {steps.length}
          </span>
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.content}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
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
                size="sm"
                onClick={handlePrev}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 bg-blue-600 hover:bg-blue-700"
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
