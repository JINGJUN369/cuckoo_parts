import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 로그인 키워드 매핑
const AUTH_MAP: Record<string, { type: string; redirect: string }> = {
  '고객만족팀CS': { type: 'admin_cs', redirect: '/admin-cs/dashboard' },
  'CUCKOO품질팀': { type: 'admin_quality', redirect: '/admin-quality/dashboard' },
};

const ADMIN_DEFAULT_PASSWORD = '12345678';
const BRANCH_CODE_PATTERN = /^[A-Z]{2}\d{2}$/;
const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    const { userCode, password } = await request.json();

    const trimmedCode = userCode?.trim();
    const trimmedPassword = password?.trim();

    if (!trimmedCode) {
      return NextResponse.json({ success: false, error: '아이디를 입력해주세요.' }, { status: 400 });
    }
    if (!trimmedPassword) {
      return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // Supabase에서 사용자 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_code', trimmedCode)
      .single();

    if (userError || !user) {
      // 사용자가 없는 경우 - 설치법인 코드이면 자동 생성
      if (BRANCH_CODE_PATTERN.test(trimmedCode)) {
        if (trimmedPassword === trimmedCode) {
          const hashedPassword = await bcrypt.hash(trimmedCode, SALT_ROUNDS);
          const { error: insertError } = await supabase.from('users').insert({
            user_code: trimmedCode,
            user_type: 'branch',
            password_hash: hashedPassword,
            is_default_password: true,
            branch_code: trimmedCode,
          });

          if (insertError) {
            console.error('User creation error:', insertError);
            return NextResponse.json({ success: false, error: '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 });
          }

          // 로그인 이력 저장
          await saveLoginHistory(trimmedCode, 'branch', request);

          return NextResponse.json({
            success: true,
            session: {
              userCode: trimmedCode,
              userType: 'branch',
              branchCode: trimmedCode,
              loginAt: new Date().toISOString(),
              isDefaultPassword: true,
            },
            redirect: '/branch/dashboard',
            requirePasswordChange: true,
          });
        } else {
          return NextResponse.json({ success: false, error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
        }
      } else if (AUTH_MAP[trimmedCode]) {
        if (trimmedPassword === ADMIN_DEFAULT_PASSWORD) {
          const hashedPassword = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, SALT_ROUNDS);
          const { error: insertError } = await supabase.from('users').insert({
            user_code: trimmedCode,
            user_type: AUTH_MAP[trimmedCode].type,
            password_hash: hashedPassword,
            is_default_password: true,
          });

          if (insertError) {
            console.error('User creation error:', insertError);
            return NextResponse.json({ success: false, error: '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 });
          }

          await saveLoginHistory(trimmedCode, AUTH_MAP[trimmedCode].type, request);

          return NextResponse.json({
            success: true,
            session: {
              userCode: trimmedCode,
              userType: AUTH_MAP[trimmedCode].type,
              loginAt: new Date().toISOString(),
              isDefaultPassword: true,
            },
            redirect: AUTH_MAP[trimmedCode].redirect,
            requirePasswordChange: true,
          });
        } else {
          return NextResponse.json({ success: false, error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
        }
      } else {
        return NextResponse.json({ success: false, error: '등록되지 않은 사용자입니다.' }, { status: 401 });
      }
    }

    // 사용자가 있는 경우 - bcrypt 비밀번호 비교
    const isValidPassword = await bcrypt.compare(trimmedPassword, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ success: false, error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ success: false, error: '비활성화된 계정입니다.' }, { status: 403 });
    }

    // redirect 설정
    let redirect: string;
    if (user.user_type === 'admin_cs') {
      redirect = '/admin-cs/dashboard';
    } else if (user.user_type === 'admin_quality') {
      redirect = '/admin-quality/dashboard';
    } else {
      redirect = '/branch/dashboard';
    }

    // 마지막 로그인 시간 업데이트
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_code', trimmedCode);

    await saveLoginHistory(trimmedCode, user.user_type, request);

    return NextResponse.json({
      success: true,
      session: {
        userCode: trimmedCode,
        userType: user.user_type,
        branchCode: user.branch_code,
        loginAt: new Date().toISOString(),
        isDefaultPassword: user.is_default_password,
      },
      redirect,
      requirePasswordChange: user.is_default_password,
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function saveLoginHistory(userCode: string, userType: string, request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    await supabase.from('login_history').insert({
      user_code: userCode,
      user_type: userType,
      ip_address: ip,
      user_agent: userAgent,
      login_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Login history save error:', error);
  }
}
