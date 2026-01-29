'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Mail, Save, Eye, EyeOff, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  description: string;
  updated_at: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // 설정 로드
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach((item: SystemSetting) => {
        settingsMap[item.setting_key] = item.setting_value || '';
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Settings load error:', error);
      toast.error('설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 설정 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ setting_value: update.setting_value, updated_at: update.updated_at })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }

      toast.success('설정이 저장되었습니다.');
    } catch (error) {
      console.error('Settings save error:', error);
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 설정 변경
  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // 테스트 이메일 발송
  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('테스트 이메일 주소를 입력해주세요.');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [testEmail],
          subject: '[테스트] 부품회수시스템 이메일 테스트',
          message: '이 메일은 부품회수시스템에서 발송한 테스트 메일입니다.\n\n설정이 올바르게 되었습니다!',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.simulation) {
          toast.success('테스트 이메일이 시뮬레이션되었습니다. (API Key 설정 필요)');
        } else {
          toast.success('테스트 이메일이 발송되었습니다.');
        }
      } else {
        toast.error(data.error || '이메일 발송에 실패했습니다.');
      }
    } catch (error) {
      toast.error('이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsTesting(false);
    }
  };

  const hasApiKey = settings.resend_api_key && settings.resend_api_key.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">설정 로드 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          시스템 설정
        </h1>
        <p className="text-muted-foreground">이메일 발송 및 시스템 설정을 관리합니다.</p>
      </div>

      {/* 이메일 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            이메일 설정
          </CardTitle>
          <CardDescription>
            현황 리포트 이메일 발송에 사용되는 설정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 발송 상태 */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
            <span className="text-sm">이메일 발송 상태:</span>
            {hasApiKey ? (
              <Badge className="bg-green-100 text-green-700">활성화</Badge>
            ) : (
              <Badge variant="secondary">시뮬레이션 모드</Badge>
            )}
            {!hasApiKey && (
              <span className="text-xs text-muted-foreground ml-2">
                (API Key를 설정하면 실제 이메일이 발송됩니다)
              </span>
            )}
          </div>

          {/* 발송자 이름 */}
          <div className="space-y-2">
            <Label htmlFor="email_from_name">발송자 이름</Label>
            <Input
              id="email_from_name"
              value={settings.email_from_name || ''}
              onChange={(e) => handleChange('email_from_name', e.target.value)}
              placeholder="쿠쿠 부품회수시스템"
            />
            <p className="text-xs text-muted-foreground">
              이메일 발신자에 표시되는 이름입니다.
            </p>
          </div>

          {/* 발송자 이메일 */}
          <div className="space-y-2">
            <Label htmlFor="email_from">발송자 이메일</Label>
            <Input
              id="email_from"
              type="email"
              value={settings.email_from || ''}
              onChange={(e) => handleChange('email_from', e.target.value)}
              placeholder="noreply@cuckoo.co.kr"
            />
            <p className="text-xs text-muted-foreground">
              이메일 발신자 주소입니다. Resend에서 인증된 도메인의 주소를 사용해야 합니다.
            </p>
          </div>

          {/* Resend API Key */}
          <div className="space-y-2">
            <Label htmlFor="resend_api_key">Resend API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="resend_api_key"
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.resend_api_key || ''}
                  onChange={(e) => handleChange('resend_api_key', e.target.value)}
                  placeholder="re_xxxxxxxxxxxx"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Resend.com
              </a>
              에서 API Key를 발급받으세요. 비워두면 이메일이 시뮬레이션됩니다.
            </p>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 테스트 이메일 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            이메일 테스트
          </CardTitle>
          <CardDescription>
            설정이 올바른지 테스트 이메일을 발송해봅니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="테스트 수신 이메일 주소"
              className="flex-1"
            />
            <Button onClick={handleTestEmail} disabled={isTesting} variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              {isTesting ? '발송 중...' : '테스트 발송'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            입력한 주소로 테스트 이메일을 발송합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
