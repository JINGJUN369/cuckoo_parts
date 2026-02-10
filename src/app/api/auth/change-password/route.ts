import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const AUTH_MAP: Record<string, boolean> = {
  '고객만족팀CS': true,
  'CUCKOO품질팀': true,
};

const ADMIN_DEFAULT_PASSWORD = '12345678';
const SALT_ROUNDS = 10;

// 비밀번호 변경
export async function POST(request: NextRequest) {
  try {
    const { userCode, newPassword } = await request.json();

    if (!userCode) {
      return NextResponse.json({ success: false, error: '사용자 정보가 없습니다.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        is_default_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_code', userCode);

    if (error) {
      console.error('Password change error:', error);
      return NextResponse.json({ success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 비밀번호 초기화 (관리자 전용)
export async function PUT(request: NextRequest) {
  try {
    const { adminUserCode, targetUserCode } = await request.json();

    if (!adminUserCode || !targetUserCode) {
      return NextResponse.json({ success: false, error: '필수 정보가 없습니다.' }, { status: 400 });
    }

    // 관리자 권한 확인
    const { data: adminUser } = await supabase
      .from('users')
      .select('user_type')
      .eq('user_code', adminUserCode)
      .single();

    if (!adminUser || adminUser.user_type !== 'admin_cs') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // 관리자 계정은 기본 비밀번호로, 설치법인은 ID로 초기화
    const isAdminAccount = AUTH_MAP[targetUserCode] === true;
    const newPassword = isAdminAccount ? ADMIN_DEFAULT_PASSWORD : targetUserCode;
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        is_default_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_code', targetUserCode);

    if (error) {
      console.error('Password reset error:', error);
      return NextResponse.json({ success: false, error: '비밀번호 초기화 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ success: false, error: '비밀번호 초기화 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
