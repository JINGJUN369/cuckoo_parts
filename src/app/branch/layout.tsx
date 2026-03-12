'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BranchHeader } from '@/components/layout/BranchHeader';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function BranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    if (!isLoading && (!session || session.userType !== 'branch')) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

  // 페이지뷰 추적
  useEffect(() => {
    if (!session || !pathname) return;
    const titleMap: Record<string, string> = {
      '/branch/dashboard': '법인 대시보드',
      '/branch/settings': '기사 코드-이름 설정',
    };
    trackPageView(pathname, titleMap[pathname] || pathname);
  }, [pathname, session, trackPageView]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!session || session.userType !== 'branch') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BranchHeader />
      <main className="p-6">{children}</main>
    </div>
  );
}
