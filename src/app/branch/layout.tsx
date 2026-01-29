'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BranchHeader } from '@/components/layout/BranchHeader';
import { useAuth } from '@/hooks/useAuth';

export default function BranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && (!session || session.userType !== 'branch')) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

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
