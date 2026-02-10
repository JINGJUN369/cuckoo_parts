import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth-check';

// Supabase 클라이언트 생성 (서버용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 이메일 설정 테스트 API (관리자 전용)
export async function GET(request: NextRequest) {
  try {
    // 인증 확인 (admin_cs만 허용)
    const auth = await verifyAuth(request, ['admin_cs']);
    if ('error' in auth) return auth.error;
    // DB에서 설정 가져오기
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['email_from', 'email_from_name', 'resend_api_key']);

    if (settingsError) {
      return NextResponse.json({
        success: false,
        error: 'DB 설정 조회 실패',
        details: settingsError.message,
      });
    }

    const settingsMap: Record<string, string> = {};
    settings?.forEach((item: { setting_key: string; setting_value: string | null }) => {
      settingsMap[item.setting_key] = item.setting_value || '';
    });

    const apiKey = process.env.RESEND_API_KEY || settingsMap.resend_api_key;
    const hasApiKey = !!apiKey && apiKey.length > 0;
    const apiKeyPreview = hasApiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET';

    // 이메일이 등록된 사용자 수
    const { data: usersWithEmail, error: usersError } = await supabase
      .from('users')
      .select('user_code, email, branch_code')
      .not('email', 'is', null)
      .neq('email', '');

    return NextResponse.json({
      success: true,
      config: {
        email_from: 'onboarding@resend.dev (고정)',
        email_from_name: settingsMap.email_from_name || '쿠쿠 부품회수시스템',
        api_key_set: hasApiKey,
        api_key_preview: apiKeyPreview,
        api_key_source: process.env.RESEND_API_KEY ? 'ENV' : (settingsMap.resend_api_key ? 'DB' : 'NONE'),
      },
      users_with_email: usersWithEmail?.length || 0,
      users: usersWithEmail?.map(u => ({
        user_code: u.user_code,
        email: u.email,
        branch_code: u.branch_code,
      })) || [],
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류',
      details: String(error),
    });
  }
}

// 테스트 이메일 발송 (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (admin_cs만 허용)
    const auth = await verifyAuth(request, ['admin_cs']);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json({
        success: false,
        error: '테스트 이메일 주소를 입력해주세요.',
      });
    }

    // DB에서 API 키 가져오기
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'resend_api_key')
      .single();

    const apiKey = process.env.RESEND_API_KEY || settings?.setting_value;

    if (!apiKey || apiKey.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'API Key가 설정되지 않았습니다.',
        api_key_source: 'NONE',
      });
    }

    // Resend API로 테스트 발송
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: '쿠쿠 부품회수시스템 <onboarding@resend.dev>',
        to: [testEmail],
        subject: '[테스트] 이메일 발송 테스트',
        text: '이 메일은 부품회수시스템의 이메일 발송 테스트입니다.\n\n정상적으로 수신되었다면 이메일 설정이 올바르게 되어있습니다.',
      }),
    });

    const responseData = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: '테스트 이메일 발송 성공!',
        email_id: responseData.id,
        sent_to: testEmail,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: '발송 실패',
        resend_error: responseData,
        status_code: response.status,
      });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류',
      details: String(error),
    });
  }
}
