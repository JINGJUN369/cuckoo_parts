'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface TechnicianName {
  id: string;
  branch_code: string;
  technician_code: string;
  technician_name: string;
}

export function useTechnicianNames(branchCode?: string) {
  const [technicianNames, setTechnicianNames] = useState<TechnicianName[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 로드
  const loadNames = useCallback(async () => {
    if (!branchCode) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('technician_names')
        .select('*')
        .eq('branch_code', branchCode)
        .order('technician_code');

      if (error) throw error;
      setTechnicianNames(data || []);
    } catch (error) {
      console.error('기사 이름 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [branchCode]);

  useEffect(() => {
    loadNames();
  }, [loadNames]);

  // 추가/수정 (upsert)
  const saveName = useCallback(async (technicianCode: string, technicianName: string) => {
    if (!branchCode) return;
    const { error } = await supabase
      .from('technician_names')
      .upsert(
        {
          branch_code: branchCode,
          technician_code: technicianCode,
          technician_name: technicianName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_code,technician_code' }
      );

    if (error) throw error;
    await loadNames();
  }, [branchCode, loadNames]);

  // 삭제
  const removeName = useCallback(async (technicianCode: string) => {
    if (!branchCode) return;
    const { error } = await supabase
      .from('technician_names')
      .delete()
      .eq('branch_code', branchCode)
      .eq('technician_code', technicianCode);

    if (error) throw error;
    await loadNames();
  }, [branchCode, loadNames]);

  // 기사코드 → 표시용 이름 변환 (홍길동(SA00000))
  const getDisplayName = useCallback((technicianCode: string | null | undefined): string => {
    if (!technicianCode) return '-';
    const found = technicianNames.find(t => t.technician_code === technicianCode);
    if (found) {
      return `${found.technician_name}(${technicianCode})`;
    }
    return technicianCode;
  }, [technicianNames]);

  // 이름 맵 (코드 → 이름)
  const nameMap = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {};
    technicianNames.forEach(t => {
      map[t.technician_code] = t.technician_name;
    });
    return map;
  }, [technicianNames]);

  return {
    technicianNames,
    isLoading,
    saveName,
    removeName,
    getDisplayName,
    nameMap,
    reload: loadNames,
  };
}
