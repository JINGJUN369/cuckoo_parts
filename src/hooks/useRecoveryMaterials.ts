'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Supabase Realtime 구독 (다른 사용자의 변경 자동 반영, 2초 쓰로틀)
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel('recovery_materials_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recovery_materials' },
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

  // 회수대상 자재 등록
  const addMaterial = useCallback(
    async (materialCode: string, materialName: string, userCode: string, serialStart?: string, serialEnd?: string) => {
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
                material_name: materialName,
                deactivated_at: null,
                deactivated_by: null,
                serial_number_start: serialStart || null,
                serial_number_end: serialEnd || null,
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
          serial_number_start: serialStart || null,
          serial_number_end: serialEnd || null,
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

  // 제조번호 범위 수정
  const updateSerialRange = useCallback(
    async (materialCode: string, serialStart?: string, serialEnd?: string) => {
      try {
        const { error } = await supabase
          .from('recovery_materials')
          .update({
            serial_number_start: serialStart || null,
            serial_number_end: serialEnd || null,
          })
          .eq('material_code', materialCode);

        if (error) throw error;
        await loadData();
        return { success: true, message: '제조번호 범위가 수정되었습니다.' };
      } catch (error) {
        console.error('Error updating serial range:', error);
        return { success: false, message: '수정 중 오류가 발생했습니다.' };
      }
    },
    [loadData]
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
    updateSerialRange,
    getActiveMaterials,
    getMaterialCodes,
    getHistory,
    refresh,
  };
}
