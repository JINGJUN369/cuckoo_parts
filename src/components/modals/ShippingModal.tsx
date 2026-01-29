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
}

export function ShippingModal({
  isOpen,
  onClose,
  onConfirm,
  carriers,
  requestNumber,
}: ShippingModalProps) {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleConfirm = () => {
    if (!carrier || !trackingNumber) {
      return;
    }
    onConfirm(carrier, trackingNumber);
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
          <DialogTitle>발송 정보 입력</DialogTitle>
          <DialogDescription>
            요청번호 {requestNumber}의 발송 정보를 입력해주세요.
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
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingNumber">송장번호</Label>
            <Input
              id="trackingNumber"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="송장번호를 입력하세요"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!carrier || !trackingNumber}
          >
            발송 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
