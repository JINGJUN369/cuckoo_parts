'use client';

import { useCallback, useEffect, useRef } from 'react';
import { supabase, STORAGE_KEYS } from '@/lib/supabase/client';
import { AnalyticsEventType, AnalyticsEventCategory } from '@/types';

interface QueuedEvent {
  user_code: string;
  user_type: string;
  branch_code?: string | null;
  event_type: AnalyticsEventType;
  event_category: AnalyticsEventCategory;
  event_data?: Record<string, unknown>;
  page_path?: string | null;
  session_id: string;
  created_at: string;
}

function getSession() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let sessionId = localStorage.getItem(STORAGE_KEYS.ANALYTICS_SESSION_ID);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.ANALYTICS_SESSION_ID, sessionId);
  }
  return sessionId;
}

export function useAnalytics() {
  const currentPageViewIdRef = useRef<string | null>(null);
  const pageEnteredAtRef = useRef<number>(0);
  const previousPageRef = useRef<string | null>(null);
  const eventQueueRef = useRef<QueuedEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 이벤트 큐 플러시
  const flush = useCallback(async () => {
    if (eventQueueRef.current.length === 0) return;

    const batch = [...eventQueueRef.current];
    eventQueueRef.current = [];

    try {
      await supabase.from('analytics_events').insert(batch);
    } catch (e) {
      console.error('Analytics flush error:', e);
    }
  }, []);

  // 5초마다 이벤트 큐 플러시
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      flush();
    }, 5000);

    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      // 언마운트 시 남은 이벤트 플러시
      flush();
    };
  }, [flush]);

  // 페이지 체류시간 업데이트
  const updateDuration = useCallback(() => {
    const pageViewId = currentPageViewIdRef.current;
    const enteredAt = pageEnteredAtRef.current;
    if (!pageViewId || !enteredAt) return;

    const duration = Math.round((Date.now() - enteredAt) / 1000);
    if (duration < 1) return;

    supabase
      .from('analytics_page_views')
      .update({ duration_seconds: duration })
      .eq('id', pageViewId)
      .then(() => {});
  }, []);

  // visibilitychange / beforeunload 이벤트로 체류시간 기록
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateDuration();
      }
    };

    const handleBeforeUnload = () => {
      updateDuration();
      // 남은 이벤트 플러시 (동기적 시도)
      if (eventQueueRef.current.length > 0) {
        const batch = [...eventQueueRef.current];
        eventQueueRef.current = [];
        navigator.sendBeacon?.(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/analytics_events`,
          JSON.stringify(batch)
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [updateDuration]);

  // 페이지뷰 추적
  const trackPageView = useCallback((pagePath: string, pageTitle: string) => {
    const session = getSession();
    if (!session) return;

    // 이전 페이지의 체류시간 업데이트
    updateDuration();

    const sessionId = getSessionId();
    const referrerPage = previousPageRef.current;
    previousPageRef.current = pagePath;
    pageEnteredAtRef.current = Date.now();

    const record = {
      user_code: session.userCode,
      user_type: session.userType,
      branch_code: session.branchCode || null,
      page_path: pagePath,
      page_title: pageTitle,
      session_id: sessionId,
      duration_seconds: 0,
      referrer_page: referrerPage,
      created_at: new Date().toISOString(),
    };

    supabase
      .from('analytics_page_views')
      .insert(record)
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) {
          currentPageViewIdRef.current = data.id;
        }
      });
  }, [updateDuration]);

  // 이벤트 추적
  const trackEvent = useCallback((
    eventType: AnalyticsEventType,
    category: AnalyticsEventCategory,
    eventData?: Record<string, unknown>,
    pagePath?: string
  ) => {
    const session = getSession();
    if (!session) return;

    const sessionId = getSessionId();

    eventQueueRef.current.push({
      user_code: session.userCode,
      user_type: session.userType,
      branch_code: session.branchCode || null,
      event_type: eventType,
      event_category: category,
      event_data: eventData,
      page_path: pagePath || previousPageRef.current || null,
      session_id: sessionId,
      created_at: new Date().toISOString(),
    } as QueuedEvent);

    // 큐가 10개 이상이면 즉시 플러시
    if (eventQueueRef.current.length >= 10) {
      flush();
    }
  }, [flush]);

  return { trackPageView, trackEvent, flush };
}
