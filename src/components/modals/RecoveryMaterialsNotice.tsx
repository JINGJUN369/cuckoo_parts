'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Copy, CheckCircle2, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRecoveryMaterials } from '@/hooks/useRecoveryMaterials';
import { toast } from 'sonner';

interface RecoveryMaterialsNoticeProps {
  open: boolean;
  onClose: () => void;
}

export function RecoveryMaterialsNotice({ open, onClose }: RecoveryMaterialsNoticeProps) {
  const { getActiveMaterials } = useRecoveryMaterials();
  const [copied, setCopied] = useState(false);

  const activeMaterials = useMemo(() => getActiveMaterials(), [getActiveMaterials]);

  // 복사용 텍스트 생성
  const copyText = useMemo(() => {
    const today = new Date().toLocaleDateString('ko-KR');
    let text = `[회수대상 자재 안내] (${today})\n`;
    text += `${'─'.repeat(30)}\n`;

    if (activeMaterials.length === 0) {
      text += '현재 등록된 회수대상 자재가 없습니다.\n';
      return text;
    }

    activeMaterials.forEach((m, idx) => {
      text += `\n${idx + 1}. ${m.material_name || '(자재명 없음)'}\n`;
      text += `   코드: ${m.material_code}\n`;
      if (m.serial_number_start || m.serial_number_end) {
        text += `   제조번호: ${m.serial_number_start || '∞'} ~ ${m.serial_number_end || '∞'}\n`;
      } else {
        text += `   제조번호: 전체\n`;
      }
    });

    text += `\n${'─'.repeat(30)}`;
    text += `\n총 ${activeMaterials.length}개 자재`;
    text += `\n※ 위 자재가 포함된 AS건은 부품을 회수하여 본사로 발송해 주세요.`;

    return text;
  }, [activeMaterials]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      toast.success('클립보드에 복사되었습니다.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = copyText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('클립보드에 복사되었습니다.');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [copyText]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            회수대상 자재 안내
          </DialogTitle>
          <DialogDescription>
            현재 회수대상으로 지정된 자재 목록입니다. 해당 자재가 포함된 AS건의 부품을 회수하여 본사로 발송해 주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {activeMaterials.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>자재코드</TableHead>
                  <TableHead>자재명</TableHead>
                  <TableHead>제조번호 범위</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMaterials.map((m, idx) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm font-medium">{m.material_code}</TableCell>
                    <TableCell className="text-sm">{m.material_name || '-'}</TableCell>
                    <TableCell>
                      {m.serial_number_start || m.serial_number_end ? (
                        <span className="font-mono text-xs">
                          {m.serial_number_start || '∞'} ~ {m.serial_number_end || '∞'}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs">전체</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              현재 등록된 회수대상 자재가 없습니다.
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="flex items-center gap-2"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                텍스트 복사
              </>
            )}
          </Button>
          <Button onClick={onClose}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
