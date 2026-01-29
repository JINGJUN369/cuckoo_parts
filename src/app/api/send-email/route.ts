import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 생성 (서버용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// DB에서 설정 가져오기
async function getEmailSettings() {
  const { data } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['email_from', 'email_from_name', 'resend_api_key']);

  const settings: Record<string, string> = {};
  data?.forEach((item: { setting_key: string; setting_value: string | null }) => {
    settings[item.setting_key] = item.setting_value || '';
  });

  return settings;
}

// 이메일 발송 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, subject, message } = body;

    // 유효성 검사
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: '수신자를 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!subject || !message) {
      return NextResponse.json(
        { error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // DB에서 이메일 설정 가져오기
    const settings = await getEmailSettings();
    const emailFrom = settings.email_from || 'noreply@cuckoo.co.kr';
    const emailFromName = settings.email_from_name || '쿠쿠 부품회수시스템';
    const dbApiKey = settings.resend_api_key;

    // 환경변수 우선, 없으면 DB 설정 사용
    const apiKey = process.env.RESEND_API_KEY || dbApiKey;

    if (apiKey && apiKey.length > 0) {
      // Resend API 사용
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `${emailFromName} <${emailFrom}>`,
          to: recipients,
          subject: subject,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Resend API error:', errorData);
        return NextResponse.json(
          { error: errorData.message || '이메일 발송에 실패했습니다.' },
          { status: 500 }
        );
      }

      const result = await response.json();
      return NextResponse.json({
        success: true,
        message: `${recipients.length}명에게 이메일이 발송되었습니다.`,
        id: result.id,
      });
    }

    // API Key가 없는 경우 - 시뮬레이션
    console.log('=== 이메일 발송 시뮬레이션 ===');
    console.log('발송자:', `${emailFromName} <${emailFrom}>`);
    console.log('수신자:', recipients);
    console.log('제목:', subject);
    console.log('내용:', message);
    console.log('===============================');

    return NextResponse.json({
      success: true,
      message: `${recipients.length}명에게 이메일 발송이 시뮬레이션되었습니다.`,
      simulation: true,
      note: 'API Key를 설정하면 실제 이메일이 발송됩니다.',
    });

  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
