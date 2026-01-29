'use client';

import { useState, useEffect, useCallback } from 'react';
import { MaterialUsage, RecoveryStatus, ParsedExcelRow, RecoveryStats } from '@/types';
import { supabase, DEFAULT_CARRIERS } from '@/lib/supabase/client';
import { generateDuplicateKey } from '@/lib/excel';

export interface UploadResult {
  total: number;       // 전체 업로드 건수
  saved: number;       // 저장된 건수 (회수대상)
  discarded: number;   // 폐기된 건수 (비회수대상)
  duplicate: number;   // 중복 건수
  byDate: { [date: string]: { saved: number; discarded: number } }; // 처리날짜별 통계
}

export function useMaterialUsage() {
  const [data, setData] = useState<MaterialUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const { data: materials, error } = await supabase
        .from('material_usage')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading data:', error);
        return;
      }

      setData(materials || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 데이터 추가 (엑셀 업로드용) - 회수대상만 저장
  const addData = useCallback(
    async (
      rows: ParsedExcelRow[],
      recoveryMaterialCodes: Set<string>,
      overwriteDuplicates: boolean = false
    ): Promise<UploadResult> => {
      const result: UploadResult = {
        total: rows.length,
        saved: 0,
        discarded: 0,
        duplicate: 0,
        byDate: {},
      };

      // 기존 데이터의 키 Set 생성
      const existingKeys = new Set(
        data.map((item) =>
          `${item.request_number}_${item.branch_code}_${item.material_code}`
        )
      );

      const newItems: Omit<MaterialUsage, 'id'>[] = [];
      const updateItems: { key: string; data: Partial<MaterialUsage> }[] = [];

      for (const row of rows) {
        const key = generateDuplicateKey(row);
        const isRecoveryTarget = recoveryMaterialCodes.has(row.material_code);

        // 처리날짜 추출 (process_time 기준)
        const processDate = row.process_time
          ? new Date(row.process_time).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // 날짜별 통계 초기화
        if (!result.byDate[processDate]) {
          result.byDate[processDate] = { saved: 0, discarded: 0 };
        }

        // 회수대상이 아닌 경우 폐기
        if (!isRecoveryTarget) {
          result.discarded++;
          result.byDate[processDate].discarded++;
          continue;
        }

        // 중복 체크
        if (existingKeys.has(key)) {
          result.duplicate++;
          if (overwriteDuplicates) {
            updateItems.push({
              key,
              data: {
                ...row,
                parts_cost: row.parts_cost || 0,
                repair_cost: row.repair_cost || 0,
                visit_cost: row.visit_cost || 0,
                output_quantity: row.output_quantity || 0,
                is_recovery_target: true,
                updated_at: new Date().toISOString(),
              },
            });
          }
        } else {
          // 신규 회수대상 저장
          newItems.push({
            ...row,
            parts_cost: row.parts_cost || 0,
            repair_cost: row.repair_cost || 0,
            visit_cost: row.visit_cost || 0,
            output_quantity: row.output_quantity || 0,
            status: '회수대기' as RecoveryStatus,
            is_recovery_target: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          existingKeys.add(key);
          result.saved++;
          result.byDate[processDate].saved++;
        }
      }

      // 배치 삽입 (500개씩)
      const BATCH_SIZE = 500;
      for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        const batch = newItems.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('material_usage').insert(batch);
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      // 덮어쓰기 업데이트
      for (const item of updateItems) {
        const [request_number, branch_code, material_code] = item.key.split('_');
        const { error } = await supabase
          .from('material_usage')
          .update(item.data)
          .eq('request_number', request_number)
          .eq('branch_code', branch_code)
          .eq('material_code', material_code);
        if (error) {
          console.error('Update error:', error);
        }
      }

      // 데이터 새로고침
      await loadData();

      return result;
    },
    [data, loadData]
  );

  // 상태 변경
  const updateStatus = useCallback(
    async (
      id: string,
      newStatus: RecoveryStatus,
      userCode: string,
      additionalData?: { carrier?: string; tracking_number?: string }
    ) => {
      const item = data.find((d) => d.id === id);
      if (!item) return;

      const now = new Date().toISOString();
      const updateData: Partial<MaterialUsage> = {
        status: newStatus,
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
      }

      // Supabase 업데이트
      const { error } = await supabase
        .from('material_usage')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Status update error:', error);
        throw error;
      }

      // 상태 변경 이력 저장
      await supabase.from('status_change_history').insert({
        material_usage_id: id,
        request_number: item.request_number,
        branch_code: item.branch_code,
        material_code: item.material_code,
        previous_status: item.status,
        new_status: newStatus,
        carrier: additionalData?.carrier,
        tracking_number: additionalData?.tracking_number,
        changed_by: userCode,
        changed_at: now,
      });

      // 로컬 상태 업데이트
      setData((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updateData } : d))
      );
    },
    [data]
  );

  // 일괄 상태 변경
  const updateStatusBulk = useCallback(
    async (
      ids: string[],
      newStatus: RecoveryStatus,
      userCode: string,
      additionalData?: { carrier?: string; tracking_number?: string }
    ) => {
      if (ids.length === 0) return;

      const now = new Date().toISOString();
      const updateData: Partial<MaterialUsage> = {
        status: newStatus,
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
      }

      // Supabase 일괄 업데이트
      const { error } = await supabase
        .from('material_usage')
        .update(updateData)
        .in('id', ids);

      if (error) {
        console.error('Bulk status update error:', error);
        throw error;
      }

      // 상태 변경 이력 일괄 저장
      const historyItems = ids.map(id => {
        const item = data.find(d => d.id === id);
        return {
          material_usage_id: id,
          request_number: item?.request_number || '',
          branch_code: item?.branch_code || '',
          material_code: item?.material_code || '',
          previous_status: item?.status || '회수대기',
          new_status: newStatus,
          carrier: additionalData?.carrier,
          tracking_number: additionalData?.tracking_number,
          changed_by: userCode,
          changed_at: now,
        };
      });

      await supabase.from('status_change_history').insert(historyItems);

      // 로컬 상태 업데이트
      setData((prev) =>
        prev.map((d) => (ids.includes(d.id) ? { ...d, ...updateData } : d))
      );
    },
    [data]
  );

  // 법인별 데이터 필터링
  const getByBranch = useCallback(
    (branchCode: string): MaterialUsage[] => {
      return data.filter(
        (item) => item.branch_code === branchCode && item.is_recovery_target
      );
    },
    [data]
  );

  // 상태별 데이터 필터링
  const getByStatus = useCallback(
    (status: RecoveryStatus): MaterialUsage[] => {
      return data.filter(
        (item) => item.status === status && item.is_recovery_target
      );
    },
    [data]
  );

  // 회수대상만 필터링
  const getRecoveryTargets = useCallback((): MaterialUsage[] => {
    return data.filter((item) => item.is_recovery_target);
  }, [data]);

  // 통계 계산
  const getStats = useCallback((): RecoveryStats => {
    const targets = data.filter((item) => item.is_recovery_target);
    return {
      total: targets.length,
      waiting: targets.filter((item) => item.status === '회수대기').length,
      collected: targets.filter((item) => item.status === '회수완료').length,
      shipped: targets.filter((item) => item.status === '발송').length,
      received: targets.filter((item) => item.status === '입고완료').length,
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
    addData,
    updateStatus,
    updateStatusBulk,
    getByBranch,
    getByStatus,
    getRecoveryTargets,
    getStats,
    getCarriers,
    refresh,
  };
}
