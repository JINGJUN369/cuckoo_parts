'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminQualityNav } from '@/components/layout/AdminQualityNav';
import { useAuth } from '@/hooks/useAuth';

export default function AdminQualityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && (!session || session.userType !== 'admin_quality')) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

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
