import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth-check';

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

// 자동발송 안내 문구
const noReplyFooter = '\n\n---\n※ 본 메일은 자동발송되는 메일입니다. 회신하실 수 없습니다.\n   문의사항은 담당자에게 직접 연락해 주세요.';

// 법인별 이메일 발송 API (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (admin_cs만 허용)
    const auth = await verifyAuth(request, ['admin_cs']);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const { dateFrom, dateTo, branchData } = body;

    // branchData: { [branch_code]: { email: string, stats: {...}, items: [...] } }
    if (!branchData || Object.keys(branchData).length === 0) {
      return NextResponse.json(
        { error: '발송할 법인 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // DB에서 이메일 설정 가져오기
    const settings = await getEmailSettings();
    // 항상 onboarding@resend.dev 사용 (도메인 인증 전)
    const emailFrom = 'onboarding@resend.dev';
    const emailFromName = settings.email_from_name || '쿠쿠 부품회수시스템';
    const apiKey = process.env.RESEND_API_KEY || settings.resend_api_key;

    console.log('Email settings:', { emailFrom, emailFromName, hasApiKey: !!apiKey });

    if (!apiKey || apiKey.length === 0) {
      console.error('No API key found');
      return NextResponse.json(
        { error: 'Resend API Key가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const results: { branch: string; success: boolean; error?: string }[] = [];
    const dateRange = dateFrom && dateTo ? `${dateFrom} ~ ${dateTo}` : '전체 기간';

    // 각 법인별로 이메일 발송
    for (const [branchCode, data] of Object.entries(branchData)) {
      const branchInfo = data as {
        email: string;
        stats: { waiting: number; collected: number; shipped: number; received: number; total: number };
        items: Array<{
          request_number: string;
          material_code: string;
          material_name: string;
          status: string;
          technician_code?: string;
          process_time?: string;
        }>;
      };

      if (!branchInfo.email) {
        results.push({ branch: branchCode, success: false, error: '이메일 미등록' });
        continue;
      }

      // 이메일 내용 생성
      let message = `[${branchCode}] 부품 회수 현황 리포트\n`;
      message += `조회 기간: ${dateRange}\n`;
      message += `발송 일시: ${new Date().toLocaleString('ko-KR')}\n\n`;
      message += `=== 현황 요약 ===\n`;
      message += `회수대기: ${branchInfo.stats.waiting}건\n`;
      message += `회수완료: ${branchInfo.stats.collected}건\n`;
      message += `발송완료: ${branchInfo.stats.shipped}건\n`;
      message += `입고완료: ${branchInfo.stats.received}건\n`;
      message += `총계: ${branchInfo.stats.total}건\n\n`;

      // 회수대기 항목 상세 (있는 경우)
      const waitingItems = branchInfo.items.filter(item => item.status === '회수대기');
      if (waitingItems.length > 0) {
        message += `=== 회수대기 상세 (${waitingItems.length}건) ===\n`;
        waitingItems.slice(0, 50).forEach((item, idx) => {
          message += `${idx + 1}. 요청번호: ${item.request_number} | 자재: ${item.material_code} | 기사: ${item.technician_code || '-'}\n`;
        });
        if (waitingItems.length > 50) {
          message += `... 외 ${waitingItems.length - 50}건\n`;
        }
        message += '\n';
      }

      // 회수완료(발송대기) 항목 (있는 경우)
      const collectedItems = branchInfo.items.filter(item => item.status === '회수완료');
      if (collectedItems.length > 0) {
        message += `=== 발송대기 상세 (${collectedItems.length}건) ===\n`;
        message += `※ 회수 완료된 부품을 품질팀으로 발송해주세요.\n`;
        collectedItems.slice(0, 30).forEach((item, idx) => {
          message += `${idx + 1}. 요청번호: ${item.request_number} | 자재: ${item.material_code}\n`;
        });
        if (collectedItems.length > 30) {
          message += `... 외 ${collectedItems.length - 30}건\n`;
        }
      }

      message += noReplyFooter;

      // Resend API로 발송
      try {
        console.log(`Sending email to ${branchCode}: ${branchInfo.email}`);
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: `${emailFromName} <${emailFrom}>`,
            to: [branchInfo.email],
            subject: `[자동발송] [${branchCode}] 부품회수 현황 (${dateRange})`,
            text: message,
          }),
        });

        const responseData = await response.json();
        console.log(`Response for ${branchCode}:`, response.status, responseData);

        if (response.ok) {
          results.push({ branch: branchCode, success: true });
        } else {
          results.push({ branch: branchCode, success: false, error: responseData.message || '발송 실패' });
        }
      } catch (error) {
        console.error(`Error for ${branchCode}:`, error);
        results.push({ branch: branchCode, success: false, error: '발송 오류' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successCount}개 법인 발송 완료${failCount > 0 ? `, ${failCount}개 실패` : ''}`,
      results,
    });

  } catch (error) {
    console.error('Branch email send error:', error);
    return NextResponse.json(
      { error: '법인별 이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
