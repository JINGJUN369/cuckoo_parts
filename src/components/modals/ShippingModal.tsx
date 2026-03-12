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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Carrier } from '@/types';

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (carrier: string, trackingNumber: string) => void;
  carriers: Carrier[];
  requestNumber: string;
  isBulk?: boolean;
  isDemoMode?: boolean;
}

export function ShippingModal({
  isOpen,
  onClose,
  onConfirm,
  carriers,
  requestNumber,
  isBulk = false,
  isDemoMode = false,
}: ShippingModalProps) {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const isDirectPickup = carrier === '연구소직접회수';
  const isFreightDelivery = carrier === '화물용달발송';

  const handleConfirm = () => {
    if (!carrier || (!isDirectPickup && !trackingNumber)) return;
    onConfirm(carrier, isDirectPickup ? '-' : trackingNumber);
    setCarrier('');
    setTrackingNumber('');
    onClose();
  };

  const handleClose = () => {
    setCarrier('');
    setTrackingNumber('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDemoMode && <span className="text-blue-600">[연습] </span>}
            {isBulk ? '일괄 발송 정보 입력' : '발송 정보 입력'}
          </DialogTitle>
          <DialogDescription>
            {isDemoMode && (
              <span className="block text-blue-600 font-medium mb-2">
                📘 이것은 연습입니다. 실제 데이터에 영향을 주지 않습니다.
              </span>
            )}
            {isBulk
              ? `${requestNumber} - 동일한 운송회사와 송장번호로 발송됩니다.`
              : `요청번호 ${requestNumber}의 발송 정보를 입력해주세요.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="carrier">운송회사</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger id="carrier">
                <SelectValue placeholder="운송회사 선택" />
              </SelectTrigger>
              <SelectContent>
                {carriers
                  .filter((c) => isDemoMode || c.is_active)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                <SelectItem value="화물용달발송">화물용달발송</SelectItem>
                <SelectItem value="연구소직접회수">연구소직접회수</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isDirectPickup && !isFreightDelivery && (
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">송장번호</Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="송장번호를 입력하세요"
              />
            </div>
          )}
          {isFreightDelivery && (
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">용달기사 전화번호</Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="예: 010-1234-5678"
              />
            </div>
          )}
          {isDirectPickup && (
            <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
              연구소직접회수는 송장번호 입력이 필요하지 않습니다.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!carrier || (!isDirectPickup && !trackingNumber)}
          >
            발송 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
