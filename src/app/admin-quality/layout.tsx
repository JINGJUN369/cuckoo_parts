'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminQualityNav } from '@/components/layout/AdminQualityNav';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function AdminQualityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    if (!isLoading && (!session || session.userType !== 'admin_quality')) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

  // 페이지뷰 추적
  useEffect(() => {
    if (!session || !pathname) return;
    const titleMap: Record<string, string> = {
      '/admin-quality/dashboard': '품질관리 대시보드',
      '/admin-quality/receive': '입고 관리',
    };
    trackPageView(pathname, titleMap[pathname] || pathname);
  }, [pathname, session, trackPageView]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!session || session.userType !== 'admin_quality') {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminQualityNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
