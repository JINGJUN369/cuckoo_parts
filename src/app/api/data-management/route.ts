import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 데이터 삭제 (자동 백업 후 삭제) - 관리자 전용
export async function POST(request: NextRequest) {
  let step = 'init';
  try {
    step = 'parse-body';
    const body = await request.json();
    const { tableName, dateFrom, dateTo } = body;

    // 인증 확인: body 또는 헤더에서 userCode를 받아 DB에서 admin_cs 확인
    step = 'auth-check';
    const rawHeader = request.headers.get('x-user-code');
    const userCode = body.userCode || (rawHeader ? decodeURIComponent(rawHeader) : null);
    if (!userCode) {
      return NextResponse.json(
        { success: false, error: '인증 정보가 없습니다.', step },
        { status: 401 }
      );
    }

    step = 'db-auth';
    const { data: authUser, error: authError } = await supabase
      .from('users')
      .select('user_code, user_type')
      .eq('user_code', userCode)
      .single();

    if (authError || !authUser || authUser.user_type !== 'admin_cs') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.', step, detail: authError?.message },
        { status: 403 }
      );
    }

    if (!tableName || !dateFrom || !dateTo) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 없습니다.' },
        { status: 400 }
      );
    }

    // 허용된 테이블만
    const allowedTables = ['material_usage', 'product_recovery'];
    if (!allowedTables.includes(tableName)) {
      return NextResponse.json(
        { success: false, error: '허용되지 않은 테이블입니다.' },
        { status: 400 }
      );
    }

    // 1. 삭제 대상 데이터 조회
    step = 'query-data';
    const { data: targetData, error: queryError } = await supabase
      .from(tableName)
      .select('*')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`);

    if (queryError) {
      return NextResponse.json(
        { success: false, error: `데이터 조회 오류: ${queryError.message}`, step },
        { status: 500 }
      );
    }

    if (!targetData || targetData.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 2. 백업 테이블에 저장 (실패해도 삭제는 진행)
    step = 'backup';
    let backupSuccess = false;
    try {
      const { error: backupError } = await supabase
        .from('data_backup')
        .insert({
          backup_type: tableName,
          original_data: targetData,
          deleted_count: targetData.length,
          date_from: dateFrom,
          date_to: dateTo,
          deleted_by: authUser.user_code,
        });

      if (backupError) {
        console.error('Backup error (non-fatal):', backupError);
      } else {
        backupSuccess = true;
      }
    } catch (backupErr) {
      console.error('Backup exception (non-fatal):', backupErr);
    }

    // 3. 데이터 삭제
    step = 'delete';
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: `데이터 삭제 오류: ${deleteError.message}`, step },
        { status: 500 }
      );
    }

    const msg = backupSuccess
      ? `${targetData.length}건의 데이터가 백업 후 삭제되었습니다.`
      : `${targetData.length}건의 데이터가 삭제되었습니다. (백업 테이블 저장 실패)`;

    return NextResponse.json({
      success: true,
      message: msg,
      deletedCount: targetData.length,
      backupSuccess,
    });
  } catch (error) {
    console.error('Data management error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `처리 오류 [${step}]: ${errMsg}` },
      { status: 500 }
    );
  }
}
