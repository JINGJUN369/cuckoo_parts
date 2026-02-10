import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * API 라우트에서 사용자 인증을 확인합니다.
 * 요청 헤더의 x-user-code로 DB에서 사용자를 조회합니다.
 *
 * @param request - NextRequest 객체
 * @param allowedTypes - 허용할 user_type 배열 (예: ['admin_cs'])
 * @returns 사용자 정보 또는 에러 응답
 */
export async function verifyAuth(
  request: NextRequest,
  allowedTypes?: string[]
): Promise<{ user: { user_code: string; user_type: string; branch_code?: string } } | { error: NextResponse }> {
  const rawUserCode = request.headers.get('x-user-code');
  const userCode = rawUserCode ? decodeURIComponent(rawUserCode) : null;

  if (!userCode) {
    return {
      error: NextResponse.json(
        { success: false, error: '인증 정보가 없습니다.' },
        { status: 401 }
      ),
    };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('user_code, user_type, branch_code, is_active')
    .eq('user_code', userCode)
    .single();

  if (error || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: '유효하지 않은 사용자입니다.' },
        { status: 401 }
      ),
    };
  }

  if (!user.is_active) {
    return {
      error: NextResponse.json(
        { success: false, error: '비활성화된 계정입니다.' },
        { status: 403 }
      ),
    };
  }

  if (allowedTypes && !allowedTypes.includes(user.user_type)) {
    return {
      error: NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      ),
    };
  }

  return { user };
}
