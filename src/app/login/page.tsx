'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PasswordChangeModal } from '@/components/modals/PasswordChangeModal';
import { APP_VERSION } from '@/lib/version';

export default function LoginPage() {
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const router = useRouter();
  const { login, changePassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(userCode, password);

      if (result.success) {
        if (result.requirePasswordChange) {
          // 초기 비밀번호인 경우 비밀번호 변경 모달 표시
          setPendingRedirect(result.redirect!);
          setShowPasswordModal(true);
          toast.info('초기 비밀번호를 변경해주세요');
        } else {
          toast.success('로그인 성공');
          router.push(result.redirect!);
        }
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (newPassword: string) => {
    const result = await changePassword(newPassword);
    if (result.success) {
      toast.success('비밀번호가 변경되었습니다');
      setShowPasswordModal(false);
      if (pendingRedirect) {
        router.push(pendingRedirect);
      }
    } else {
      toast.error(result.error);
    }
  };

  const handleSkipPasswordChange = () => {
    setShowPasswordModal(false);
    if (pendingRedirect) {
      router.push(pendingRedirect);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center rounded-t-lg pt-8 pb-6" style={{ backgroundColor: '#791015' }}>
          <div className="flex justify-center mb-4">
            <Image
              src="/cuckoo-logo.png"
              alt="CUCKOO"
              width={120}
              height={40}
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-2xl text-white">쿠쿠 회수관리 시스템</CardTitle>
            <span className="text-xs text-white/80 bg-white/20 px-1.5 py-0.5 rounded">v{APP_VERSION}</span>
          </div>
          <CardDescription className="text-white/70">
            아이디와 비밀번호를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="아이디"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2 relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" className="w-full text-white hover:opacity-90" style={{ backgroundColor: '#791015' }} disabled={isLoading || !userCode.trim() || !password.trim()}>
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <div className="mt-6 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">로그인 안내:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>최초 로그인 시 비밀번호는 아이디와 동일합니다</li>
              <li>보안을 위해 비밀번호를 변경해주세요</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <PasswordChangeModal
        open={showPasswordModal}
        onClose={handleSkipPasswordChange}
        onSubmit={handlePasswordChange}
        allowSkip={true}
      />
    </div>
  );
}
