'use client';

import { Package, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export function BranchHeader() {
  const router = useRouter();
  const { session, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-orange-600" />
          <div>
            <h1 className="font-bold text-lg">부품 회수 관리</h1>
            <p className="text-sm text-muted-foreground">
              설치법인: {session?.branchCode}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-gray-600 hover:text-red-600"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </header>
  );
}
