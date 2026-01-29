'use client';

import { useState, useEffect, useCallback } from 'react';
import { RecoveryMaterial, RecoveryMaterialHistory } from '@/types';
import { supabase } from '@/lib/supabase/client';

export function useRecoveryMaterials() {
  const [materials, setMaterials] = useState<RecoveryMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('recovery_materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading recovery materials:', error);
        return;
      }

      setMaterials(data || []);
    } catch (error) {
      console.error('Error loading recovery materials:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 회수대상 자재 등록
  const addMaterial = useCallback(
    async (materialCode: string, materialName: string, userCode: string) => {
      try {
        // 기존 자재 확인
        const existing = materials.find((m) => m.material_code === materialCode);

        if (existing) {
          // 이미 존재하면 활성화
          if (!existing.is_active) {
            const { error } = await supabase
              .from('recovery_materials')
              .update({
                is_active: true,
                deactivated_at: null,
                deactivated_by: null,
              })
              .eq('material_code', materialCode);

            if (error) throw error;

            // 이력 저장
            await supabase.from('recovery_material_history').insert({
              material_code: materialCode,
              material_name: materialName,
              action: '등록',
              action_by: userCode,
              action_at: new Date().toISOString(),
            });

            await loadData();
            return { success: true, message: '자재가 회수대상으로 재등록되었습니다.' };
          }
          return { success: false, message: '이미 등록된 회수대상 자재입니다.' };
        }

        // 새로 추가
        const { error } = await supabase.from('recovery_materials').insert({
          material_code: materialCode,
          material_name: materialName,
          is_active: true,
          created_by: userCode,
        });

        if (error) throw error;

        // 이력 저장
        await supabase.from('recovery_material_history').insert({
          material_code: materialCode,
          material_name: materialName,
          action: '등록',
          action_by: userCode,
          action_at: new Date().toISOString(),
        });

        await loadData();
        return { success: true, message: '자재가 회수대상으로 등록되었습니다.' };
      } catch (error) {
        console.error('Error adding material:', error);
        return { success: false, message: '등록 중 오류가 발생했습니다.' };
      }
    },
    [materials, loadData]
  );

  // 회수대상 자재 해제
  const removeMaterial = useCallback(
    async (materialCode: string, userCode: string) => {
      try {
        const material = materials.find((m) => m.material_code === materialCode);

        if (!material) {
          return { success: false, message: '자재를 찾을 수 없습니다.' };
        }

        const now = new Date().toISOString();

        const { error } = await supabase
          .from('recovery_materials')
          .update({
            is_active: false,
            deactivated_at: now,
            deactivated_by: userCode,
          })
          .eq('material_code', materialCode);

        if (error) throw error;

        // 이력 저장
        await supabase.from('recovery_material_history').insert({
          material_code: materialCode,
          material_name: material.material_name,
          action: '해제',
          action_by: userCode,
          action_at: now,
        });

        await loadData();
        return { success: true, message: '자재가 회수대상에서 해제되었습니다.' };
      } catch (error) {
        console.error('Error removing material:', error);
        return { success: false, message: '해제 중 오류가 발생했습니다.' };
      }
    },
    [materials, loadData]
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
  const getHistory = useCallback(async (): Promise<RecoveryMaterialHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('recovery_material_history')
        .select('*')
        .order('action_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }, []);

  // 데이터 새로고침
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    materials,
    isLoading,
    addMaterial,
    removeMaterial,
    getActiveMaterials,
    getMaterialCodes,
    getHistory,
    refresh,
  };
}
