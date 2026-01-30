'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  PackageCheck,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { APP_VERSION } from '@/lib/version';

const navItems = [
  { href: '/admin-quality/dashboard', label: '발송현황', icon: LayoutDashboard },
  { href: '/admin-quality/receive', label: '입고완료 처리', icon: PackageCheck },
];

export function AdminQualityNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-white border-r min-h-screen flex flex-col">
      {/* 헤더 */}
      <div className="p-4" style={{ backgroundColor: '#791015' }}>
        <div className="flex items-center gap-2 mb-1">
          <Image src="/cuckoo-logo.png" alt="CUCKOO" width={80} height={28} className="object-contain brightness-0 invert" />
          <span className="text-xs text-white/80 bg-white/20 px-1.5 py-0.5 rounded">v{APP_VERSION}</span>
        </div>
        <span className="font-bold text-sm text-white">쿠쿠 회수관리 시스템</span>
        <p className="text-xs text-white/70 mt-1">품질팀</p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-600 hover:text-red-600"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </aside>
  );
}
