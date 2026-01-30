'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Settings,
  Calendar,
  History,
  LogOut,
  Package,
  Users,
  Mail,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { APP_VERSION } from '@/lib/version';

const navItems = [
  { href: '/admin-cs/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin-cs/upload', label: '부품 업로드', icon: Upload },
  { href: '/admin-cs/product-recovery', label: '제품 회수 관리', icon: Truck },
  { href: '/admin-cs/materials', label: '회수대상 자재설정', icon: Settings },
  { href: '/admin-cs/calendar', label: '달력', icon: Calendar },
  { href: '/admin-cs/history', label: '이력 조회', icon: History },
  { href: '/admin-cs/users', label: '사용자 관리', icon: Users },
  { href: '/admin-cs/settings', label: '이메일 설정', icon: Mail },
];

export function AdminCSNav() {
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
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg">부품 회수 관리</span>
          <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">v{APP_VERSION}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">고객만족팀CS</p>
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
                  ? 'bg-blue-100 text-blue-700 font-medium'
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
