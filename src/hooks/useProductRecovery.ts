'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ProductRecovery,
  ProductRecoveryType,
  ProductRecoveryStatus,
  ProductRecoveryStats,
  CancelReason,
  ParsedRemovalExcelRow,
  ParsedDefectExchangeExcelRow,
} from '@/types';
import { supabase, DEFAULT_CARRIERS } from '@/lib/supabase/client';

export interface ProductUploadResult {
  total: number;
  approved: number;       // 승인 건수
  autoSelected: number;   // 자동선택 건수
  saved: number;          // 저장된 건수
  duplicate: number;      // 중복 건수
  skipped: number;        // 비승인 건수 (스킵)
}

// 고객번호에서 계약일 추출 (1-01-250201-0001 → 2025-02-01)
export function extractContractDate(customerNumber: string): Date | null {
  const parts = customerNumber.split('-');
  if (parts.length < 4) return null;

  const dateStr = parts[2]; // 250201
  if (dateStr.length !== 6) return null;

  const year = parseInt('20' + dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10) - 1;
  const day = parseInt(dateStr.substring(4, 6), 10);

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;

  return date;
}

// 사원번호에서 법인코드 추출 (SA01001 → SA01, 2202xxx → 2202)
export function extractBranchCode(employeeNumber: string | number | undefined | null): string {
  // 숫자나 null/undefined도 처리할 수 있도록 문자열로 변환
  const empStr = String(employeeNumber ?? '');
  if (!empStr || empStr === 'undefined' || empStr === 'null') return '';

  // SA로 시작하면 앞 4자리
  if (empStr.startsWith('SA')) {
    return empStr.substring(0, 4);
  }

  // 숫자로 시작하면 앞 4자리
  if (/^\d/.test(empStr)) {
    return empStr.substring(0, 4);
  }

  return empStr.substring(0, 4);
}

// 1년 이내 여부 확인
export function isWithinOneYear(contractDate: Date, terminationDate: Date): boolean {
  const oneYearLater = new Date(contractDate);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  return terminationDate < oneYearLater;
}

// 자동회수 대상 모델 여부 확인 (CBT-, CWS-)
export function isAutoRecoveryModel(modelName: string, prefixes: string[] = ['CBT-', 'CWS-']): boolean {
  if (!modelName) return false;
  return prefixes.some(prefix => modelName.toUpperCase().startsWith(prefix.toUpperCase()));
}

// Excel 날짜 변환 (숫자 → 날짜)
function excelDateToJSDate(excelDate: number | string): Date {
  if (typeof excelDate === 'string') {
    return new Date(excelDate);
  }
  // Excel stores dates as days since 1900-01-01
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date;
}

export function useProductRecovery() {
  const [data, setData] = useState<ProductRecovery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRecoveryPrefixes, setAutoRecoveryPrefixes] = useState<string[]>(['CBT-', 'CWS-']);

  // 자동회수 대상 모델 설정 로드
  const loadAutoRecoveryConfig = useCallback(async () => {
    const { data: configs, error } = await supabase
      .from('auto_recovery_model_config')
      .select('model_prefix')
      .eq('is_active', true);

    if (!error && configs) {
      setAutoRecoveryPrefixes(configs.map(c => c.model_prefix));
    }
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const { data: products, error } = await supabase
        .from('product_recovery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading product recovery data:', error);
        return;
      }

      setData(products || []);
    } catch (error) {
      console.error('Error loading product recovery data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutoRecoveryConfig();
    loadData();
  }, [loadAutoRecoveryConfig, loadData]);

  // Supabase Realtime 구독 (다른 사용자의 변경 자동 반영, 2초 쓰로틀)
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel('product_recovery_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_recovery' },
        () => {
          if (realtimeTimer.current) return;
          realtimeTimer.current = setTimeout(() => {
            loadData();
            realtimeTimer.current = null;
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    };
  }, [loadData]);

  // 철거 데이터 파싱 및 업로드
  const uploadRemovalData = useCallback(
    async (rows: ParsedRemovalExcelRow[]): Promise<ProductUploadResult> => {
      const result: ProductUploadResult = {
        total: rows.length,
        approved: 0,
        autoSelected: 0,
        saved: 0,
        duplicate: 0,
        skipped: 0,
      };

      // 기존 데이터의 키 Set 생성 (고객번호 + 모델명 + 해지요청일)
      const existingKeys = new Set(
        data.map(item => `${item.customer_number}_${item.model_name}_${item.termination_request_date}`)
      );

      const newItems: Omit<ProductRecovery, 'id'>[] = [];

      for (const row of rows) {
        // 승인 건만 처리
        if (row.approval_status !== '승인') {
          result.skipped++;
          continue;
        }
        result.approved++;

        // 계약일 추출
        const contractDate = extractContractDate(row.customer_number);
        if (!contractDate) {
          result.skipped++;
          continue;
        }

        // 해지요청일
        const terminationDate = excelDateToJSDate(row.termination_request_date);
        const terminationDateStr = terminationDate.toISOString().split('T')[0];

        // 중복 체크 (고객번호 + 모델명 + 해지요청일)
        const key = `${row.customer_number}_${row.model_name}_${terminationDateStr}`;
        if (existingKeys.has(key)) {
          result.duplicate++;
          continue;
        }

        // 법인코드 추출
        const branchCode = extractBranchCode(row.employee_number);

        // 자동선택 조건 확인
        const withinOneYear = isWithinOneYear(contractDate, terminationDate);
        const autoModel = isAutoRecoveryModel(row.model_name, autoRecoveryPrefixes);
        const autoSelected = withinOneYear && autoModel;

        if (autoSelected) {
          result.autoSelected++;
        }

        const now = new Date().toISOString();

        newItems.push({
          request_date: excelDateToJSDate(row.request_date).toISOString().split('T')[0],
          request_branch: row.request_branch,
          customer_number: row.customer_number,
          customer_name: row.customer_name,
          orderer_name: row.orderer_name,
          model_name: row.model_name,
          penalty_fee: row.penalty_fee,
          registration_fee: row.registration_fee,
          other_discount: row.other_discount,
          consumable_fee: row.consumable_fee,
          removal_fee: row.removal_fee,
          fault_code: row.fault_code,
          new_request: row.new_request,
          termination_request_date: terminationDate.toISOString().split('T')[0],
          work_request_large: row.work_request_large,
          work_request_medium: row.work_request_medium,
          work_request_small: row.work_request_small,
          special_notes: row.special_notes,
          request_notes: row.request_notes,
          rejection_reason: row.rejection_reason,
          sales_deduction: row.sales_deduction,
          misc_profit_deduction: row.misc_profit_deduction,
          approval_status: row.approval_status,
          employee_number: row.employee_number,
          status_raw: row.status_raw,
          recovery_type: '철거' as ProductRecoveryType,
          contract_date: contractDate.toISOString().split('T')[0],
          is_within_one_year: withinOneYear,
          is_auto_recovery_model: autoModel,
          is_auto_selected: autoSelected,
          selection_type: autoSelected ? '자동' : undefined,
          branch_code: branchCode,
          recovery_status: autoSelected ? '회수대기' : '미선택' as ProductRecoveryStatus,
          selected_at: autoSelected ? now : undefined,
          selected_by: autoSelected ? 'SYSTEM' : undefined,
          created_at: now,
          updated_at: now,
        });

        existingKeys.add(key);
        result.saved++;
      }

      // 배치 삽입
      if (newItems.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
          const batch = newItems.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from('product_recovery').insert(batch);
          if (error) {
            console.error('Insert error:', error);
            throw error;
          }
        }
      }

      // 업로드 이력 저장
      await supabase.from('product_recovery_upload_history').insert({
        file_name: '철거_' + new Date().toISOString().split('T')[0],
        recovery_type: '철거',
        total_rows: result.total,
        approved_rows: result.approved,
        auto_selected_rows: result.autoSelected,
        duplicate_rows: result.duplicate,
        uploaded_at: new Date().toISOString(),
      });

      await loadData();
      return result;
    },
    [data, loadData, autoRecoveryPrefixes]
  );

  // 불량교환 데이터 파싱 및 업로드
  const uploadDefectExchangeData = useCallback(
    async (rows: ParsedDefectExchangeExcelRow[]): Promise<ProductUploadResult> => {
      const result: ProductUploadResult = {
        total: rows.length,
        approved: 0,
        autoSelected: 0,
        saved: 0,
        duplicate: 0,
        skipped: 0,
      };

      // 기존 데이터의 키 Set 생성 (고객번호 + 모델명 + 해지요청일)
      const existingKeys = new Set(
        data.map(item => `${item.customer_number}_${item.model_name}_${item.termination_request_date}`)
      );

      const newItems: Omit<ProductRecovery, 'id'>[] = [];

      for (const row of rows) {
        if (row.approval_status !== '승인') {
          result.skipped++;
          continue;
        }
        result.approved++;

        const contractDate = extractContractDate(row.customer_number);
        if (!contractDate) {
          result.skipped++;
          continue;
        }

        const terminationDate = excelDateToJSDate(row.termination_request_date);
        const terminationDateStr = terminationDate.toISOString().split('T')[0];

        // 중복 체크 (고객번호 + 모델명 + 해지요청일)
        const key = `${row.customer_number}_${row.model_name}_${terminationDateStr}`;
        if (existingKeys.has(key)) {
          result.duplicate++;
          continue;
        }
        const branchCode = extractBranchCode(row.employee_number);

        const withinOneYear = isWithinOneYear(contractDate, terminationDate);
        const autoModel = isAutoRecoveryModel(row.model_name, autoRecoveryPrefixes);
        const autoSelected = withinOneYear && autoModel;

        if (autoSelected) {
          result.autoSelected++;
        }

        const now = new Date().toISOString();

        newItems.push({
          request_date: excelDateToJSDate(row.request_date).toISOString().split('T')[0],
          request_branch: row.request_branch,
          customer_number: row.customer_number,
          customer_name: row.customer_name,
          orderer_name: row.orderer_name,
          model_name: row.model_name,
          new_request: row.new_request,
          termination_request_date: terminationDate.toISOString().split('T')[0],
          work_request_large: row.work_request_large,
          work_request_medium: row.work_request_medium,
          work_request_small: row.work_request_small,
          special_notes: row.special_notes,
          request_notes: row.request_notes,
          rejection_reason: row.rejection_reason,
          sales_deduction: row.sales_deduction,
          misc_profit_deduction: row.misc_profit_deduction,
          approval_status: row.approval_status,
          employee_number: row.employee_number,
          status_raw: row.status_raw,
          recovery_type: '불량교환' as ProductRecoveryType,
          contract_date: contractDate.toISOString().split('T')[0],
          is_within_one_year: withinOneYear,
          is_auto_recovery_model: autoModel,
          is_auto_selected: autoSelected,
          selection_type: autoSelected ? '자동' : undefined,
          branch_code: branchCode,
          recovery_status: autoSelected ? '회수대기' : '미선택' as ProductRecoveryStatus,
          selected_at: autoSelected ? now : undefined,
          selected_by: autoSelected ? 'SYSTEM' : undefined,
          created_at: now,
          updated_at: now,
        });

        existingKeys.add(key);
        result.saved++;
      }

      if (newItems.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
          const batch = newItems.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from('product_recovery').insert(batch);
          if (error) {
            console.error('Insert error:', error);
            throw error;
          }
        }
      }

      await supabase.from('product_recovery_upload_history').insert({
        file_name: '불량교환_' + new Date().toISOString().split('T')[0],
        recovery_type: '불량교환',
        total_rows: result.total,
        approved_rows: result.approved,
        auto_selected_rows: result.autoSelected,
        duplicate_rows: result.duplicate,
        uploaded_at: new Date().toISOString(),
      });

      await loadData();
      return result;
    },
    [data, loadData, autoRecoveryPrefixes]
  );

  // 수동 선택 (회수대상으로 등록)
  const selectForRecovery = useCallback(
    async (ids: string[], userCode: string) => {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('product_recovery')
        .update({
          recovery_status: '회수대기',
          selection_type: '수동',
          selected_at: now,
          selected_by: userCode,
          updated_at: now,
        })
        .in('id', ids);

      if (error) {
        console.error('Select for recovery error:', error);
        throw error;
      }

      // 상태 변경 이력 저장
      const items = data.filter(d => ids.includes(d.id));
      const historyItems = items.map(item => ({
        product_recovery_id: item.id,
        customer_number: item.customer_number,
        branch_code: item.branch_code,
        model_name: item.model_name,
        previous_status: item.recovery_status,
        new_status: '회수대기',
        changed_by: userCode,
        changed_at: now,
      }));

      await supabase.from('product_recovery_status_history').insert(historyItems);

      setData(prev =>
        prev.map(d =>
          ids.includes(d.id)
            ? { ...d, recovery_status: '회수대기' as ProductRecoveryStatus, selection_type: '수동', selected_at: now, selected_by: userCode }
            : d
        )
      );
    },
    [data]
  );

  // 상태 변경
  const updateStatus = useCallback(
    async (
      id: string,
      newStatus: ProductRecoveryStatus,
      userCode: string,
      additionalData?: { carrier?: string; tracking_number?: string; cancel_reason?: CancelReason; cancel_reason_detail?: string }
    ) => {
      const item = data.find(d => d.id === id);
      if (!item) return;

      const now = new Date().toISOString();
      const updateData: Partial<ProductRecovery> = {
        recovery_status: newStatus,
        updated_at: now,
      };

      switch (newStatus) {
        case '회수완료':
          updateData.collected_at = now;
          updateData.collected_by = userCode;
          break;
        case '발송':
          updateData.shipped_at = now;
          updateData.shipped_by = userCode;
          updateData.carrier = additionalData?.carrier;
          updateData.tracking_number = additionalData?.tracking_number;
          break;
        case '입고완료':
          updateData.received_at = now;
          updateData.received_by = userCode;
          break;
        case '발송불가':
          updateData.cancelled_at = now;
          updateData.cancelled_by = userCode;
          updateData.cancel_reason = additionalData?.cancel_reason;
          updateData.cancel_reason_detail = additionalData?.cancel_reason_detail;
          break;
      }

      const { error } = await supabase
        .from('product_recovery')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Status update error:', error);
        throw error;
      }

      await supabase.from('product_recovery_status_history').insert({
        product_recovery_id: id,
        customer_number: item.customer_number,
        branch_code: item.branch_code,
        model_name: item.model_name,
        previous_status: item.recovery_status,
        new_status: newStatus,
        carrier: additionalData?.carrier,
        tracking_number: additionalData?.tracking_number,
        changed_by: userCode,
        changed_at: now,
      });

      setData(prev =>
        prev.map(d => (d.id === id ? { ...d, ...updateData } : d))
      );
    },
    [data]
  );

  // 일괄 상태 변경
  const updateStatusBulk = useCallback(
    async (
      ids: string[],
      newStatus: ProductRecoveryStatus,
      userCode: string,
      additionalData?: { carrier?: string; tracking_number?: string; cancel_reason?: CancelReason; cancel_reason_detail?: string }
    ) => {
      if (ids.length === 0) return;

      const now = new Date().toISOString();
      const updateData: Partial<ProductRecovery> = {
        recovery_status: newStatus,
        updated_at: now,
      };

      switch (newStatus) {
        case '회수완료':
          updateData.collected_at = now;
          updateData.collected_by = userCode;
          break;
        case '발송':
          updateData.shipped_at = now;
          updateData.shipped_by = userCode;
          updateData.carrier = additionalData?.carrier;
          updateData.tracking_number = additionalData?.tracking_number;
          break;
        case '입고완료':
          updateData.received_at = now;
          updateData.received_by = userCode;
          break;
        case '발송불가':
          updateData.cancelled_at = now;
          updateData.cancelled_by = userCode;
          updateData.cancel_reason = additionalData?.cancel_reason;
          updateData.cancel_reason_detail = additionalData?.cancel_reason_detail;
          break;
      }

      const { error } = await supabase
        .from('product_recovery')
        .update(updateData)
        .in('id', ids);

      if (error) {
        console.error('Bulk status update error:', error);
        throw error;
      }

      const items = data.filter(d => ids.includes(d.id));
      const historyItems = items.map(item => ({
        product_recovery_id: item.id,
        customer_number: item.customer_number,
        branch_code: item.branch_code,
        model_name: item.model_name,
        previous_status: item.recovery_status,
        new_status: newStatus,
        carrier: additionalData?.carrier,
        tracking_number: additionalData?.tracking_number,
        changed_by: userCode,
        changed_at: now,
      }));

      await supabase.from('product_recovery_status_history').insert(historyItems);

      setData(prev =>
        prev.map(d => (ids.includes(d.id) ? { ...d, ...updateData } : d))
      );
    },
    [data]
  );

  // 미선택 데이터 조회
  const getUnselected = useCallback((): ProductRecovery[] => {
    return data.filter(item => item.recovery_status === '미선택');
  }, [data]);

  // 회수대상 데이터 조회 (회수대기 이상 상태)
  const getRecoveryTargets = useCallback((): ProductRecovery[] => {
    return data.filter(item => item.recovery_status !== '미선택');
  }, [data]);

  // 법인별 데이터 필터링
  const getByBranch = useCallback(
    (branchCode: string): ProductRecovery[] => {
      return data.filter(
        item => item.branch_code === branchCode && item.recovery_status !== '미선택'
      );
    },
    [data]
  );

  // 상태별 데이터 필터링
  const getByStatus = useCallback(
    (status: ProductRecoveryStatus): ProductRecovery[] => {
      return data.filter(item => item.recovery_status === status);
    },
    [data]
  );

  // 통계 계산
  const getStats = useCallback((): ProductRecoveryStats => {
    return {
      total: data.length,
      unselected: data.filter(item => item.recovery_status === '미선택').length,
      waiting: data.filter(item => item.recovery_status === '회수대기').length,
      collected: data.filter(item => item.recovery_status === '회수완료').length,
      shipped: data.filter(item => item.recovery_status === '발송').length,
      received: data.filter(item => item.recovery_status === '입고완료').length,
      cancelled: data.filter(item => item.recovery_status === '발송불가').length,
    };
  }, [data]);

  // 운송회사 목록 가져오기
  const getCarriers = useCallback(async () => {
    const { data: carriers, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('is_active', true);

    if (error || !carriers || carriers.length === 0) {
      return DEFAULT_CARRIERS;
    }
    return carriers;
  }, []);

  // 데이터 새로고침
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    uploadRemovalData,
    uploadDefectExchangeData,
    selectForRecovery,
    updateStatus,
    updateStatusBulk,
    getUnselected,
    getRecoveryTargets,
    getByBranch,
    getByStatus,
    getStats,
    getCarriers,
    refresh,
    autoRecoveryPrefixes,
  };
}
