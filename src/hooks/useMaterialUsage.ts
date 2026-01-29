'use client';

import { useState, useEffect, useCallback } from 'react';
import { MaterialUsage, RecoveryStatus, ParsedExcelRow, RecoveryStats, StatusChangeHistory } from '@/types';
import { STORAGE_KEYS, DEFAULT_CARRIERS } from '@/lib/supabase/client';
import { generateDuplicateKey } from '@/lib/excel';

export function useMaterialUsage() {
  const [data, setData] = useState<MaterialUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.MATERIAL_USAGE);
    if (stored) {
      setData(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  // 데이터 저장
  const saveData = useCallback((newData: MaterialUsage[]) => {
    localStorage.setItem(STORAGE_KEYS.MATERIAL_USAGE, JSON.stringify(newData));
    setData(newData);
  }, []);

  // 데이터 추가 (엑셀 업로드용)
  const addData = useCallback(
    (
      rows: ParsedExcelRow[],
      recoveryMaterialCodes: Set<string>,
      overwriteDuplicates: boolean = false
    ): { new: number; duplicate: number; recoveryTarget: number } => {
      const existing = [...data];
      const existingKeys = new Set(
        existing.map((item) =>
          `${item.request_number}_${item.branch_code}_${item.material_code}`
        )
      );

      let newCount = 0;
      let duplicateCount = 0;
      let recoveryTargetCount = 0;

      for (const row of rows) {
        const key = generateDuplicateKey(row);
        const isRecoveryTarget = recoveryMaterialCodes.has(row.material_code);

        if (existingKeys.has(key)) {
          duplicateCount++;
          if (overwriteDuplicates) {
            // 덮어쓰기: 기존 항목 업데이트
            const index = existing.findIndex(
              (item) =>
                item.request_number === row.request_number &&
                item.branch_code === row.branch_code &&
                item.material_code === row.material_code
            );
            if (index !== -1) {
              existing[index] = {
                ...existing[index],
                ...row,
                parts_cost: row.parts_cost || 0,
                repair_cost: row.repair_cost || 0,
                visit_cost: row.visit_cost || 0,
                output_quantity: row.output_quantity || 0,
                is_recovery_target: isRecoveryTarget,
                updated_at: new Date().toISOString(),
              };
            }
          }
        } else {
          // 새 항목 추가
          const newItem: MaterialUsage = {
            id: crypto.randomUUID(),
            ...row,
            parts_cost: row.parts_cost || 0,
            repair_cost: row.repair_cost || 0,
            visit_cost: row.visit_cost || 0,
            output_quantity: row.output_quantity || 0,
            status: isRecoveryTarget ? '회수대기' : '회수대기',
            is_recovery_target: isRecoveryTarget,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          existing.push(newItem);
          existingKeys.add(key);
          newCount++;
          if (isRecoveryTarget) {
            recoveryTargetCount++;
          }
        }
      }

      saveData(existing);

      return { new: newCount, duplicate: duplicateCount, recoveryTarget: recoveryTargetCount };
    },
    [data, saveData]
  );

  // 상태 변경
  const updateStatus = useCallback(
    (
      id: string,
      newStatus: RecoveryStatus,
      userCode: string,
      additionalData?: { carrier?: string; tracking_number?: string }
    ) => {
      const updated = data.map((item) => {
        if (item.id === id) {
          const now = new Date().toISOString();
          const updatedItem = { ...item, status: newStatus, updated_at: now };

          switch (newStatus) {
            case '회수완료':
              updatedItem.collected_at = now;
              updatedItem.collected_by = userCode;
              break;
            case '발송':
              updatedItem.shipped_at = now;
              updatedItem.shipped_by = userCode;
              updatedItem.carrier = additionalData?.carrier;
              updatedItem.tracking_number = additionalData?.tracking_number;
              break;
            case '입고완료':
              updatedItem.received_at = now;
              updatedItem.received_by = userCode;
              break;
          }

          // 상태 변경 이력 저장
          saveStatusChangeHistory({
            id: crypto.randomUUID(),
            material_usage_id: item.id,
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

          return updatedItem;
        }
        return item;
      });

      saveData(updated);
    },
    [data, saveData]
  );

  // 상태 변경 이력 저장
  const saveStatusChangeHistory = (history: StatusChangeHistory) => {
    const historyKey = STORAGE_KEYS.STATUS_CHANGE_HISTORY;
    const existing = localStorage.getItem(historyKey);
    const histories = existing ? JSON.parse(existing) : [];
    histories.unshift(history);

    if (histories.length > 10000) {
      histories.splice(10000);
    }

    localStorage.setItem(historyKey, JSON.stringify(histories));
  };

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
  const getCarriers = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CARRIERS);
    if (stored) {
      return JSON.parse(stored);
    }
    localStorage.setItem(STORAGE_KEYS.CARRIERS, JSON.stringify(DEFAULT_CARRIERS));
    return DEFAULT_CARRIERS;
  }, []);

  return {
    data,
    isLoading,
    addData,
    updateStatus,
    getByBranch,
    getByStatus,
    getRecoveryTargets,
    getStats,
    getCarriers,
  };
}
