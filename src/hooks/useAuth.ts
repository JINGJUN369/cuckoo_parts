'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserSession, UserType } from '@/types';
import { supabase, STORAGE_KEYS } from '@/lib/supabase/client';

export interface LoginResult {
  success: boolean;
  redirect?: string;
  error?: string;
  requirePasswordChange?: boolean;
}

// 세션 만료 설정
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8시간
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분 비활성

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  // 세션 만료 확인
  const isSessionExpired = useCallback((sessionData: UserSession & { isDefaultPassword?: boolean; lastActivity?: string }) => {
    const now = Date.now();

    // 로그인 후 8시간 초과
    if (sessionData.loginAt) {
      const loginTime = new Date(sessionData.loginAt).getTime();
      if (now - loginTime > SESSION_MAX_AGE_MS) return true;
    }

    // 마지막 활동 후 30분 초과
    if (sessionData.lastActivity) {
      const lastActivity = new Date(sessionData.lastActivity).getTime();
      if (now - lastActivity > SESSION_IDLE_TIMEOUT_MS) return true;
    }

    return false;
  }, []);

  // 활동 시간 갱신
  const updateLastActivity = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) {
      try {
        const sessionData = JSON.parse(stored);
        sessionData.lastActivity = new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
      } catch {
        // ignore
      }
    }
  }, []);

  // 사용자 활동 감지 (클릭, 키보드, 스크롤)
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        updateLastActivity();
        throttleTimer = null;
      }, 60000); // 1분마다 갱신 (성능 보호)
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [updateLastActivity]);

  // 세션 만료 주기적 확인 (1분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (stored) {
        try {
          const sessionData = JSON.parse(stored);
          if (isSessionExpired(sessionData)) {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
            setSession(null);
            setRequirePasswordChange(false);
            window.location.href = '/login';
          }
        } catch {
          // ignore
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isSessionExpired]);

  // 세션 로드
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) {
      try {
        const parsedSession = JSON.parse(stored);

        // 만료된 세션이면 제거
        if (isSessionExpired(parsedSession)) {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
          setIsLoading(false);
          return;
        }

        setSession(parsedSession);
        if (parsedSession.isDefaultPassword) {
          setRequirePasswordChange(true);
        }

        // 활동 시간 갱신
        updateLastActivity();
      } catch {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    }
    setIsLoading(false);
  }, [isSessionExpired, updateLastActivity]);

  // 로그인 (서버 API 호출 - bcrypt 비교)
  const login = useCallback(async (userCode: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode, password }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error };
      }

      // 세션 저장 (활동 시간 초기화)
      const sessionWithActivity = { ...data.session, lastActivity: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionWithActivity));
      setSession(sessionWithActivity);

      if (data.requirePasswordChange) {
        setRequirePasswordChange(true);
      }

      return {
        success: true,
        redirect: data.redirect,
        requirePasswordChange: data.requirePasswordChange,
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '로그인 처리 중 오류가 발생했습니다.' };
    }
  }, []);

  // 비밀번호 변경 (서버 API 호출 - bcrypt 해싱)
  const changePassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!session) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: '비밀번호는 8자 이상이어야 합니다.' };
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-code': encodeURIComponent(session.userCode),
        },
        body: JSON.stringify({ userCode: session.userCode, newPassword }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error };
      }

      // 세션 업데이트
      const updatedSession = { ...session, isDefaultPassword: false };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedSession));
      setSession(updatedSession as UserSession);
      setRequirePasswordChange(false);

      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' };
    }
  }, [session]);

  // 비밀번호 초기화 (관리자 전용, 서버 API 호출)
  const resetPassword = useCallback(async (targetUserCode: string): Promise<{ success: boolean; error?: string }> => {
    if (!session || session.userType !== 'admin_cs') {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-code': encodeURIComponent(session.userCode),
        },
        body: JSON.stringify({ action: 'reset', adminUserCode: session.userCode, targetUserCode }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: '비밀번호 초기화 중 오류가 발생했습니다.' };
    }
  }, [session]);

  // 로그아웃
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setSession(null);
    setRequirePasswordChange(false);
  }, []);

  // 사용자 목록 조회 (관리자 전용)
  const getUsers = useCallback(async () => {
    if (!session || session.userType !== 'admin_cs') {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get users error:', error);
      return [];
    }

    return data || [];
  }, [session]);

  // 사용자 이메일 수정 (관리자 전용)
  const updateUserEmail = useCallback(async (targetUserCode: string, email: string): Promise<{ success: boolean; error?: string }> => {
    if (!session || session.userType !== 'admin_cs') {
      return { success: false, error: '권한이 없습니다.' };
    }

    const { error } = await supabase
      .from('users')
      .update({
        email: email || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_code', targetUserCode);

    if (error) {
      console.error('Email update error:', error);
      return { success: false, error: '이메일 수정 중 오류가 발생했습니다.' };
    }

    return { success: true };
  }, [session]);

  return {
    session,
    isLoading,
    login,
    logout,
    changePassword,
    resetPassword,
    getUsers,
    updateUserEmail,
    requirePasswordChange,
    setRequirePasswordChange,
    isAuthenticated: !!session,
    isAdminCS: session?.userType === 'admin_cs',
    isAdminQuality: session?.userType === 'admin_quality',
    isBranch: session?.userType === 'branch',
  };
}
