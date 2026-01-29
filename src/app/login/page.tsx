'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function LoginPage() {
  const [userCode, setUserCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = login(userCode);

    if (result.success) {
      toast.success('로그인 성공');
      router.push(result.redirect!);
    } else {
      toast.error(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">부품 회수 관리 시스템</CardTitle>
          <CardDescription>
            로그인 키워드를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="로그인 키워드 (예: 고객만족팀CS, SA01)"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                disabled={isLoading}
                className="text-center"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !userCode.trim()}>
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <div className="mt-6 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">로그인 키워드 안내:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>고객만족팀CS: CS팀 관리자</li>
              <li>CUCKOO품질팀: 품질팀 관리자</li>
              <li>SA01, SA02 등: 설치법인</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
