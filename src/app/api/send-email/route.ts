import { NextRequest, NextResponse } from 'next/server';

// 이메일 발송 API
// 실제 사용 시 Resend, SendGrid, Nodemailer 등을 설정해야 합니다.
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

    // Resend API를 사용하는 경우 (환경변수 설정 필요)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      // Resend API 사용
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'noreply@cuckoo.co.kr',
          to: recipients,
          subject: subject,
          text: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Resend API error:', errorData);
        return NextResponse.json(
          { error: '이메일 발송에 실패했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${recipients.length}명에게 이메일이 발송되었습니다.`,
      });
    }

    // SMTP 설정이 없는 경우 - 개발 환경용 시뮬레이션
    console.log('=== 이메일 발송 시뮬레이션 ===');
    console.log('수신자:', recipients);
    console.log('제목:', subject);
    console.log('내용:', message);
    console.log('===============================');

    // 개발 환경에서는 성공 응답 반환
    return NextResponse.json({
      success: true,
      message: `${recipients.length}명에게 이메일 발송이 시뮬레이션되었습니다. (RESEND_API_KEY 환경변수 설정 필요)`,
      simulation: true,
    });

  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
