'use client';

import { useState, useEffect, useCallback } from 'react';
import { RecoveryMaterial, RecoveryMaterialHistory } from '@/types';
import { STORAGE_KEYS } from '@/lib/supabase/client';

export function useRecoveryMaterials() {
  const [materials, setMaterials] = useState<RecoveryMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.RECOVERY_MATERIALS);
    if (stored) {
      setMaterials(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  // 데이터 저장
  const saveMaterials = useCallback((newMaterials: RecoveryMaterial[]) => {
    localStorage.setItem(STORAGE_KEYS.RECOVERY_MATERIALS, JSON.stringify(newMaterials));
    setMaterials(newMaterials);
  }, []);

  // 이력 저장
  const saveHistory = useCallback((history: RecoveryMaterialHistory) => {
    const historyKey = STORAGE_KEYS.RECOVERY_MATERIAL_HISTORY;
    const existing = localStorage.getItem(historyKey);
    const histories = existing ? JSON.parse(existing) : [];
    histories.unshift(history);

    if (histories.length > 5000) {
      histories.splice(5000);
    }

    localStorage.setItem(historyKey, JSON.stringify(histories));
  }, []);

  // 회수대상 자재 등록
  const addMaterial = useCallback(
    (materialCode: string, materialName: string, userCode: string) => {
      const existing = materials.find((m) => m.material_code === materialCode);

      if (existing) {
        // 이미 존재하면 활성화
        if (!existing.is_active) {
          const updated = materials.map((m) =>
            m.material_code === materialCode
              ? { ...m, is_active: true, deactivated_at: undefined, deactivated_by: undefined }
              : m
          );
          saveMaterials(updated);

          saveHistory({
            id: crypto.randomUUID(),
            material_code: materialCode,
            material_name: materialName,
            action: '등록',
            action_by: userCode,
            action_at: new Date().toISOString(),
          });
        }
        return { success: true, message: '자재가 회수대상으로 재등록되었습니다.' };
      }

      // 새로 추가
      const newMaterial: RecoveryMaterial = {
        id: crypto.randomUUID(),
        material_code: materialCode,
        material_name: materialName,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: userCode,
      };

      saveMaterials([...materials, newMaterial]);

      saveHistory({
        id: crypto.randomUUID(),
        material_code: materialCode,
        material_name: materialName,
        action: '등록',
        action_by: userCode,
        action_at: new Date().toISOString(),
      });

      return { success: true, message: '자재가 회수대상으로 등록되었습니다.' };
    },
    [materials, saveMaterials, saveHistory]
  );

  // 회수대상 자재 해제
  const removeMaterial = useCallback(
    (materialCode: string, userCode: string) => {
      const material = materials.find((m) => m.material_code === materialCode);

      if (!material) {
        return { success: false, message: '자재를 찾을 수 없습니다.' };
      }

      const now = new Date().toISOString();
      const updated = materials.map((m) =>
        m.material_code === materialCode
          ? { ...m, is_active: false, deactivated_at: now, deactivated_by: userCode }
          : m
      );

      saveMaterials(updated);

      saveHistory({
        id: crypto.randomUUID(),
        material_code: materialCode,
        material_name: material.material_name,
        action: '해제',
        action_by: userCode,
        action_at: now,
      });

      return { success: true, message: '자재가 회수대상에서 해제되었습니다.' };
    },
    [materials, saveMaterials, saveHistory]
  );

  // 활성 자재 목록 가져오기
  const getActiveMaterials = useCallback((): RecoveryMaterial[] => {
    return materials.filter((m) => m.is_active);
  }, [materials]);

  // 자재 코드 Set 가져오기
  const getMaterialCodes = useCallback((): Set<string> => {
    return new Set(
      materials.filter((m) => m.is_active).map((m) => m.material_code)
    );
  }, [materials]);

  // 이력 가져오기
  const getHistory = useCallback((): RecoveryMaterialHistory[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.RECOVERY_MATERIAL_HISTORY);
    return stored ? JSON.parse(stored) : [];
  }, []);

  return {
    materials,
    isLoading,
    addMaterial,
    removeMaterial,
    getActiveMaterials,
    getMaterialCodes,
    getHistory,
  };
}
