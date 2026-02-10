import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth-check';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 데이터 삭제 (자동 백업 후 삭제) - 관리자 전용
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인 (admin_cs만 허용)
    const auth = await verifyAuth(request, ['admin_cs']);
    if ('error' in auth) return auth.error;

    const { tableName, dateFrom, dateTo } = await request.json();

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
    const { data: targetData, error: queryError } = await supabase
      .from(tableName)
      .select('*')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`);

    if (queryError) {
      console.error('Data query error:', queryError);
      return NextResponse.json(
        { success: false, error: '데이터 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!targetData || targetData.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 2. 백업 테이블에 저장
    const { error: backupError } = await supabase
      .from('data_backup')
      .insert({
        backup_type: tableName,
        original_data: targetData,
        deleted_count: targetData.length,
        date_from: dateFrom,
        date_to: dateTo,
        deleted_by: auth.user.user_code,
      });

    if (backupError) {
      console.error('Backup error:', backupError);
      return NextResponse.json(
        { success: false, error: '백업 저장 중 오류가 발생했습니다. 삭제가 취소됩니다.' },
        { status: 500 }
      );
    }

    // 3. 데이터 삭제
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: '데이터 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${targetData.length}건의 데이터가 백업 후 삭제되었습니다.`,
      deletedCount: targetData.length,
    });
  } catch (error) {
    console.error('Data management error:', error);
    return NextResponse.json(
      { success: false, error: '데이터 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
