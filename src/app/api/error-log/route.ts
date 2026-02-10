import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const { message, stack, digest, url, userCode, timestamp } = await request.json();

    // 에러 로그 저장
    await supabase.from('error_logs').insert({
      error_message: message?.substring(0, 500),
      error_stack: stack?.substring(0, 2000),
      error_digest: digest,
      page_url: url?.substring(0, 500),
      user_code: userCode,
      created_at: timestamp || new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error log save failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// 에러 로그 조회 (관리자 전용)
export async function GET(request: NextRequest) {
  const rawUserCode = request.headers.get('x-user-code');
  const userCode = rawUserCode ? decodeURIComponent(rawUserCode) : null;
  if (!userCode) {
    return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
  }

  // 관리자 권한 확인
  const { data: user } = await supabase
    .from('users')
    .select('user_type')
    .eq('user_code', userCode)
    .single();

  if (!user || user.user_type !== 'admin_cs') {
    return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
