'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminCSNav } from '@/components/layout/AdminCSNav';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function AdminCSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    if (!isLoading && (!session || session.userType !== 'admin_cs')) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

  // 페이지뷰 추적
  useEffect(() => {
    if (!session || !pathname) return;
    const titleMap: Record<string, string> = {
      '/admin-cs/dashboard': '대시보드',
      '/admin-cs/upload': '데이터 업로드',
      '/admin-cs/materials': '회수대상 자재설정',
      '/admin-cs/product-settings': '회수대상 제품설정',
      '/admin-cs/recovery-report': '회수현황 보고서',
      '/admin-cs/calendar': '달력',
      '/admin-cs/history': '이력 조회',
      '/admin-cs/users': '사용자 관리',
      '/admin-cs/settings': '이메일 설정',
      '/admin-cs/analytics': '사용 분석',
    };
    trackPageView(pathname, titleMap[pathname] || pathname);
  }, [pathname, session, trackPageView]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session || session.userType !== 'admin_cs') {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminCSNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
