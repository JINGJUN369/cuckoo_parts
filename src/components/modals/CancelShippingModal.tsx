'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CancelReason } from '@/types';

interface CancelShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: CancelReason, detail?: string) => void;
  requestNumber: string;
  materialName?: string;
  isBulk?: boolean;
  bulkCount?: number;
}

const CANCEL_REASONS: { value: CancelReason; label: string; description: string }[] = [
  { value: '분실', label: '분실', description: '부품을 분실하여 발송할 수 없음' },
  { value: '파손', label: '파손', description: '부품이 파손되어 발송할 수 없음' },
  { value: '재사용', label: '재사용', description: '부품을 재사용하여 발송하지 않음' },
  { value: '기타', label: '기타', description: '기타 사유로 발송할 수 없음' },
];

export function CancelShippingModal({
  isOpen,
  onClose,
  onConfirm,
  requestNumber,
  materialName,
  isBulk = false,
  bulkCount = 0,
}: CancelShippingModalProps) {
  const [reason, setReason] = useState<CancelReason | ''>('');
  const [detail, setDetail] = useState('');

  const handleConfirm = () => {
    if (!reason) {
      return;
    }
    onConfirm(reason as CancelReason, detail || undefined);
    // Reset state
    setReason('');
    setDetail('');
  };

  const handleClose = () => {
    setReason('');
    setDetail('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">
            {isBulk ? '일괄 발송불가 처리' : '발송불가 처리'}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `${bulkCount}건의 부품을 발송불가 처리합니다.`
              : (
                <span>
                  <strong>{requestNumber}</strong>
                  {materialName && <span> ({materialName})</span>}
                  <br />위 부품을 발송불가 처리합니다.
                </span>
              )
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">발송불가 사유 선택</Label>
            <RadioGroup
              value={reason}
              onValueChange={(value) => setReason(value as CancelReason)}
              className="space-y-2"
            >
              {CANCEL_REASONS.map((item) => (
                <div
                  key={item.value}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    reason === item.value
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setReason(item.value)}
                >
                  <RadioGroupItem value={item.value} id={item.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label
                      htmlFor={item.value}
                      className="font-medium cursor-pointer"
                    >
                      {item.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reason === '기타' && (
            <div className="space-y-2">
              <Label htmlFor="detail">상세 사유 (선택)</Label>
              <Textarea
                id="detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="발송불가 상세 사유를 입력해주세요"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason}
          >
            발송불가 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
