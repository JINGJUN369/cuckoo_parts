'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserSession, UserType } from '@/types';
import { supabase, STORAGE_KEYS } from '@/lib/supabase/client';

// 로그인 키워드 매핑
const AUTH_MAP: Record<string, { type: UserType; redirect: string }> = {
  '고객만족팀CS': { type: 'admin_cs', redirect: '/admin-cs/dashboard' },
  'CUCKOO품질팀': { type: 'admin_quality', redirect: '/admin-quality/dashboard' },
};

// 관리자 초기 비밀번호
const ADMIN_DEFAULT_PASSWORD = '12345678';

// 설치법인 코드 패턴 (SA01, SA02, ... 또는 다른 패턴)
const BRANCH_CODE_PATTERN = /^[A-Z]{2}\d{2}$/;

export interface LoginResult {
  success: boolean;
  redirect?: string;
  error?: string;
  requirePasswordChange?: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);

  // 세션 로드
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) {
      try {
        const parsedSession = JSON.parse(stored);
        setSession(parsedSession);
        // 비밀번호 변경 필요 여부 확인
        if (parsedSession.isDefaultPassword) {
          setRequirePasswordChange(true);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    }
    setIsLoading(false);
  }, []);

  // 로그인
  const login = useCallback(async (userCode: string, password: string): Promise<LoginResult> => {
    const trimmedCode = userCode.trim();
    const trimmedPassword = password.trim();

    if (!trimmedCode) {
      return { success: false, error: '아이디를 입력해주세요.' };
    }

    if (!trimmedPassword) {
      return { success: false, error: '비밀번호를 입력해주세요.' };
    }

    let userType: UserType;
    let redirect: string;
    let branchCode: string | undefined;
    let isDefaultPassword = false;

    // Supabase에서 사용자 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_code', trimmedCode)
      .single();

    if (userError || !user) {
      // 사용자가 없는 경우 - 설치법인 코드이면 자동 생성
      if (BRANCH_CODE_PATTERN.test(trimmedCode)) {
        // 초기 비밀번호로 로그인 시도
        if (trimmedPassword === trimmedCode) {
          // 사용자 자동 생성
          const { error: insertError } = await supabase.from('users').insert({
            user_code: trimmedCode,
            user_type: 'branch',
            password_hash: trimmedCode,
            is_default_password: true,
            branch_code: trimmedCode,
          });

          if (insertError) {
            console.error('User creation error:', insertError);
          }

          userType = 'branch';
          branchCode = trimmedCode;
          redirect = '/branch/dashboard';
          isDefaultPassword = true;
        } else {
          return { success: false, error: '비밀번호가 일치하지 않습니다.' };
        }
      } else if (AUTH_MAP[trimmedCode]) {
        // 관리자 계정 - 초기 비밀번호로 로그인 시도
        if (trimmedPassword === ADMIN_DEFAULT_PASSWORD) {
          // 사용자 자동 생성
          const { error: insertError } = await supabase.from('users').insert({
            user_code: trimmedCode,
            user_type: AUTH_MAP[trimmedCode].type,
            password_hash: ADMIN_DEFAULT_PASSWORD,
            is_default_password: true,
          });

          if (insertError) {
            console.error('User creation error:', insertError);
          }

          userType = AUTH_MAP[trimmedCode].type;
          redirect = AUTH_MAP[trimmedCode].redirect;
          isDefaultPassword = true;
        } else {
          return { success: false, error: '비밀번호가 일치하지 않습니다.' };
        }
      } else {
        return { success: false, error: '등록되지 않은 사용자입니다.' };
      }
    } else {
      // 사용자가 있는 경우 - 비밀번호 확인
      if (user.password_hash !== trimmedPassword) {
        return { success: false, error: '비밀번호가 일치하지 않습니다.' };
      }

      if (!user.is_active) {
        return { success: false, error: '비활성화된 계정입니다.' };
      }

      userType = user.user_type as UserType;
      branchCode = user.branch_code;
      isDefaultPassword = user.is_default_password;

      // redirect 설정
      if (userType === 'admin_cs') {
        redirect = '/admin-cs/dashboard';
      } else if (userType === 'admin_quality') {
        redirect = '/admin-quality/dashboard';
      } else {
        redirect = '/branch/dashboard';
      }

      // 마지막 로그인 시간 업데이트
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_code', trimmedCode);
    }

    const newSession: UserSession & { isDefaultPassword?: boolean } = {
      userCode: trimmedCode,
      userType,
      branchCode,
      loginAt: new Date().toISOString(),
      isDefaultPassword,
    };

    // 세션 저장
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newSession));
    setSession(newSession);

    if (isDefaultPassword) {
      setRequirePasswordChange(true);
    }

    // 로그인 이력 저장 (Supabase)
    await saveLoginHistory(newSession);

    return {
      success: true,
      redirect,
      requirePasswordChange: isDefaultPassword,
    };
  }, []);

  // 비밀번호 변경
  const changePassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!session) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    if (newPassword.length < 4) {
      return { success: false, error: '비밀번호는 4자 이상이어야 합니다.' };
    }

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: newPassword,
        is_default_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_code', session.userCode);

    if (error) {
      console.error('Password change error:', error);
      return { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' };
    }

    // 세션 업데이트
    const updatedSession = { ...session, isDefaultPassword: false };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedSession));
    setSession(updatedSession as UserSession);
    setRequirePasswordChange(false);

    return { success: true };
  }, [session]);

  // 비밀번호 초기화 (관리자 전용)
  const resetPassword = useCallback(async (targetUserCode: string): Promise<{ success: boolean; error?: string }> => {
    if (!session || session.userType !== 'admin_cs') {
      return { success: false, error: '권한이 없습니다.' };
    }

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: targetUserCode, // 초기 비밀번호 = ID
        is_default_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_code', targetUserCode);

    if (error) {
      console.error('Password reset error:', error);
      return { success: false, error: '비밀번호 초기화 중 오류가 발생했습니다.' };
    }

    return { success: true };
  }, [session]);

  // 로그아웃
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setSession(null);
    setRequirePasswordChange(false);
  }, []);

  // 로그인 이력 저장 (Supabase)
  const saveLoginHistory = async (session: UserSession) => {
    try {
      await supabase.from('login_history').insert({
        user_code: session.userCode,
        user_type: session.userType,
        ip_address: 'web',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        login_at: session.loginAt,
      });
    } catch (error) {
      console.error('Login history save error:', error);
    }
  };

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
