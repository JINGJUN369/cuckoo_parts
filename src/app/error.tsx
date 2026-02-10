'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 콘솔에 에러 로그 출력
    console.error('[Global Error]', error);

    // Supabase에 에러 로그 저장 (비동기, 실패해도 무시)
    try {
      const session = localStorage.getItem('parts_recovery_session');
      const userCode = session ? JSON.parse(session).userCode : 'unknown';

      fetch('/api/error-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack?.substring(0, 2000),
          digest: error.digest,
          url: window.location.href,
          userCode,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // 에러 로그 저장 실패 무시
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-8">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">오류가 발생했습니다</h2>
        <p className="text-muted-foreground mb-4">
          페이지를 불러오는 중 문제가 발생했습니다. 다시 시도해주세요.
        </p>
        <p className="text-xs text-muted-foreground mb-6 font-mono bg-gray-100 p-2 rounded">
          {error.message}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>다시 시도</Button>
          <Button variant="outline" onClick={() => window.location.href = '/login'}>
            로그인 페이지로
          </Button>
        </div>
      </div>
    </div>
  );
}
