'use client';

import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { APP_VERSION } from '@/lib/version';

export function BranchHeader() {
  const router = useRouter();
  const { session, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="px-6 py-4" style={{ backgroundColor: '#791015' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/cuckoo-logo.png" alt="CUCKOO" width={80} height={28} className="object-contain brightness-0 invert" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white">쿠쿠 회수관리 시스템</h1>
              <span className="text-xs text-white/80 bg-white/20 px-1.5 py-0.5 rounded">v{APP_VERSION}</span>
            </div>
            <p className="text-sm text-white/70">
              설치법인: {session?.branchCode}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-white hover:text-white hover:bg-white/20"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </header>
  );
}
