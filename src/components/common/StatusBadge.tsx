'use client';

import { Badge } from '@/components/ui/badge';
import { RecoveryStatus } from '@/types';

interface StatusBadgeProps {
  status: RecoveryStatus;
  size?: 'sm' | 'default';
}

const STATUS_CONFIG: Record<RecoveryStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  '회수대기': { label: '회수대기', variant: 'destructive' },
  '회수완료': { label: '회수완료', variant: 'secondary' },
  '발송': { label: '발송', variant: 'default' },
  '입고완료': { label: '입고완료', variant: 'outline' },
  '발송불가': { label: '발송불가', variant: 'outline', className: 'bg-gray-200 text-gray-700 border-gray-400' },
};

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      className={`${size === 'sm' ? 'text-xs px-2 py-0.5' : ''} ${config.className || ''}`}
    >
      {config.label}
    </Badge>
  );
}
