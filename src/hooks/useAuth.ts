'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserSession, UserType } from '@/types';
import { STORAGE_KEYS } from '@/lib/supabase/client';

// 로그인 키워드 매핑
const AUTH_MAP: Record<string, { type: UserType; redirect: string }> = {
  '고객만족팀CS': { type: 'admin_cs', redirect: '/admin-cs/dashboard' },
  'CUCKOO품질팀': { type: 'admin_quality', redirect: '/admin-quality/dashboard' },
};

// 설치법인 코드 패턴 (SA01, SA02, ... 또는 다른 패턴)
const BRANCH_CODE_PATTERN = /^[A-Z]{2}\d{2}$/;

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 세션 로드
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    }
    setIsLoading(false);
  }, []);

  // 로그인
  const login = useCallback((userCode: string): { success: boolean; redirect?: string; error?: string } => {
    const trimmedCode = userCode.trim();

    if (!trimmedCode) {
      return { success: false, error: '로그인 키워드를 입력해주세요.' };
    }

    let userType: UserType;
    let redirect: string;
    let branchCode: string | undefined;

    // 관리자 계정 확인
    if (AUTH_MAP[trimmedCode]) {
      userType = AUTH_MAP[trimmedCode].type;
      redirect = AUTH_MAP[trimmedCode].redirect;
    }
    // 설치법인 코드 확인
    else if (BRANCH_CODE_PATTERN.test(trimmedCode)) {
      userType = 'branch';
      branchCode = trimmedCode;
      redirect = '/branch/dashboard';
    }
    else {
      return { success: false, error: '올바른 로그인 키워드가 아닙니다.' };
    }

    const newSession: UserSession = {
      userCode: trimmedCode,
      userType,
      branchCode,
      loginAt: new Date().toISOString(),
    };

    // 세션 저장
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newSession));
    setSession(newSession);

    // 로그인 이력 저장
    saveLoginHistory(newSession);

    return { success: true, redirect };
  }, []);

  // 로그아웃
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setSession(null);
  }, []);

  // 로그인 이력 저장
  const saveLoginHistory = (session: UserSession) => {
    const historyKey = STORAGE_KEYS.LOGIN_HISTORY;
    const existing = localStorage.getItem(historyKey);
    const history = existing ? JSON.parse(existing) : [];

    history.unshift({
      id: crypto.randomUUID(),
      user_code: session.userCode,
      user_type: session.userType,
      ip_address: 'local',
      user_agent: navigator.userAgent,
      login_at: session.loginAt,
    });

    // 최대 1000개 유지
    if (history.length > 1000) {
      history.splice(1000);
    }

    localStorage.setItem(historyKey, JSON.stringify(history));
  };

  return {
    session,
    isLoading,
    login,
    logout,
    isAuthenticated: !!session,
    isAdminCS: session?.userType === 'admin_cs',
    isAdminQuality: session?.userType === 'admin_quality',
    isBranch: session?.userType === 'branch',
  };
}
