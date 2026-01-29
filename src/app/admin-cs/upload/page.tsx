'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseExcelFile } from '@/lib/excel';
import { useMaterialUsage, UploadResult } from '@/hooks/useMaterialUsage';
import { useRecoveryMaterials } from '@/hooks/useRecoveryMaterials';
import { useAuth } from '@/hooks/useAuth';
import { ParsedExcelRow } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcelRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const { addData } = useMaterialUsage();
  const { getMaterialCodes, getActiveMaterials } = useRecoveryMaterials();
  const { session } = useAuth();

  // 파일 선택 핸들러
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setUploadResult(null);
    setUploadStatus('파일을 읽는 중...');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      setUploadStatus('데이터를 파싱하는 중...');
      const data = await parseExcelFile(selectedFile);
      setParsedData(data);
      setUploadStatus('');
      toast.success(`${data.length.toLocaleString()}개 행을 파싱했습니다.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setParsedData([]);
      setUploadStatus('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.match(/\.(xlsx|xls)$/)) {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setFile(droppedFile);
    setIsLoading(true);
    setUploadResult(null);
    setUploadStatus('파일을 읽는 중...');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      setUploadStatus('데이터를 파싱하는 중...');
      const data = await parseExcelFile(droppedFile);
      setParsedData(data);
      setUploadStatus('');
      toast.success(`${data.length.toLocaleString()}개 행을 파싱했습니다.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setParsedData([]);
      setUploadStatus('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 업로드 실행
  const handleUpload = useCallback(async (overwrite: boolean = false) => {
    if (parsedData.length === 0) return;

    // 회수대상 자재가 설정되어 있는지 확인
    const materialCodes = getMaterialCodes();
    if (materialCodes.size === 0) {
      toast.error('먼저 회수대상 자재를 설정해주세요. (자재 설정 메뉴)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('업로드 준비 중...');
    setShowDuplicateModal(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      setUploadStatus('회수대상 자재 확인 중...');
      setUploadProgress(10);
      await new Promise(resolve => setTimeout(resolve, 50));

      setUploadStatus('데이터 필터링 및 저장 중...');
      setUploadProgress(30);

      // 실제 데이터 추가 (회수대상만 저장)
      const result = await addData(parsedData, materialCodes, overwrite);

      setUploadProgress(80);
      setUploadStatus('이력 저장 중...');
      await new Promise(resolve => setTimeout(resolve, 50));

      // 업로드 이력 Supabase에 저장
      const { error: historyError } = await supabase.from('upload_history').insert({
        file_name: file?.name,
        total_rows: result.total,
        saved_rows: result.saved,
        new_rows: result.saved, // 호환성을 위해 유지
        duplicate_rows: result.duplicate,
        discarded_rows: result.discarded,
        recovery_target_rows: result.saved,
        by_date_detail: result.byDate,
        uploaded_by: session?.userCode,
        uploaded_at: new Date().toISOString(),
      });

      if (historyError) {
        console.error('History save error:', historyError);
      }

      setUploadProgress(100);
      setUploadStatus('완료!');
      setUploadResult(result);

      toast.success(
        `업로드 완료: 저장 ${result.saved.toLocaleString()}건, 폐기 ${result.discarded.toLocaleString()}건`
      );
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
    }
  }, [parsedData, getMaterialCodes, addData, file, session]);

  // 업로드 버튼 클릭
  const handleUploadClick = useCallback(async () => {
    if (parsedData.length === 0 || isUploading) return;

    // 회수대상 자재 설정 확인
    const activeMaterials = getActiveMaterials();
    if (activeMaterials.length === 0) {
      toast.error('먼저 회수대상 자재를 설정해주세요.');
      return;
    }

    // 바로 업로드 실행 (중복 체크는 서버에서 처리)
    handleUpload(false);
  }, [parsedData, isUploading, getActiveMaterials, handleUpload]);

  // 초기화
  const handleReset = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setUploadResult(null);
    setUploadProgress(0);
    setUploadStatus('');
  }, []);

  // 회수대상 자재 수
  const activeMaterialCount = getActiveMaterials().length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">엑셀 업로드</h1>
        <p className="text-muted-foreground">자재사용 데이터를 업로드합니다.</p>
      </div>

      {/* 회수대상 자재 안내 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>회수대상 자재 필터링</AlertTitle>
        <AlertDescription>
          현재 {activeMaterialCount}개의 회수대상 자재가 설정되어 있습니다.
          업로드 시 회수대상 자재만 저장되고, 나머지는 폐기됩니다.
          {activeMaterialCount === 0 && (
            <span className="text-red-600 font-medium">
              {' '}먼저 자재 설정 메뉴에서 회수대상 자재를 등록해주세요.
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* 업로드 영역 */}
      <Card>
        <CardHeader>
          <CardTitle>파일 업로드</CardTitle>
          <CardDescription>
            엑셀 파일(.xlsx, .xls)을 드래그하거나 선택해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isLoading || isUploading ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={!isLoading && !isUploading ? handleDrop : undefined}
            onClick={() => !isLoading && !isUploading && document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading || isUploading}
            />
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="font-medium">파일 처리 중...</p>
                {uploadStatus && <p className="text-sm text-muted-foreground">{uploadStatus}</p>}
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-12 w-12 text-green-600" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {parsedData.length.toLocaleString()}개 행 파싱 완료
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-12 w-12 text-gray-400" />
                <p>파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-sm text-muted-foreground">
                  .xlsx, .xls 파일만 지원
                </p>
              </div>
            )}
          </div>

          {/* 업로드 진행 상태 */}
          {isUploading && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="font-medium text-blue-800">업로드 진행 중...</span>
              </div>
              {uploadStatus && (
                <p className="text-sm text-blue-700 mb-2">{uploadStatus}</p>
              )}
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-1 text-right">{uploadProgress}%</p>
            </div>
          )}

          {/* 액션 버튼 */}
          {parsedData.length > 0 && !isUploading && (
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleUploadClick}
                disabled={isLoading || isUploading || activeMaterialCount === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  '업로드 실행'
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={isUploading}>
                초기화
              </Button>
            </div>
          )}

          {/* 업로드 결과 */}
          {uploadResult && !isUploading && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">업로드 완료</p>
                  <ul className="text-sm text-green-700 mt-1 space-y-1">
                    <li>전체 행: {uploadResult.total.toLocaleString()}건</li>
                    <li className="text-green-800 font-medium">
                      저장 (회수대상): {uploadResult.saved.toLocaleString()}건
                    </li>
                    <li className="text-orange-600">
                      폐기 (비회수대상): {uploadResult.discarded.toLocaleString()}건
                    </li>
                    <li>중복 건수: {uploadResult.duplicate.toLocaleString()}건</li>
                  </ul>

                  {/* 날짜별 상세 */}
                  {Object.keys(uploadResult.byDate).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-sm font-medium text-green-800 mb-2">처리날짜별 현황:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {Object.entries(uploadResult.byDate)
                          .sort(([a], [b]) => b.localeCompare(a))
                          .slice(0, 6)
                          .map(([date, stats]) => (
                            <div key={date} className="bg-white/50 rounded px-2 py-1">
                              <span className="text-gray-600">{date}:</span>
                              <span className="text-green-700 ml-1">저장 {stats.saved}</span>
                              <span className="text-orange-600 ml-1">폐기 {stats.discarded}</span>
                            </div>
                          ))}
                      </div>
                      {Object.keys(uploadResult.byDate).length > 6 && (
                        <p className="text-xs text-gray-500 mt-1">
                          ...외 {Object.keys(uploadResult.byDate).length - 6}개 날짜
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 미리보기 */}
      {parsedData.length > 0 && !isUploading && (
        <Card>
          <CardHeader>
            <CardTitle>데이터 미리보기</CardTitle>
            <CardDescription>
              처음 50개 행을 미리보기로 표시합니다. (전체: {parsedData.length.toLocaleString()}개)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>요청번호</TableHead>
                    <TableHead>이관처</TableHead>
                    <TableHead>처리시간</TableHead>
                    <TableHead>모델명</TableHead>
                    <TableHead>자재코드</TableHead>
                    <TableHead>품명 및 규격</TableHead>
                    <TableHead>출고수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, index) => {
                    const isRecoveryTarget = getMaterialCodes().has(row.material_code);
                    return (
                      <TableRow
                        key={index}
                        className={isRecoveryTarget ? '' : 'bg-orange-50 text-orange-700'}
                      >
                        <TableCell className="font-medium">{row.request_number}</TableCell>
                        <TableCell>{row.branch_code}</TableCell>
                        <TableCell>
                          {row.process_time
                            ? new Date(row.process_time).toLocaleDateString('ko-KR')
                            : '-'}
                        </TableCell>
                        <TableCell>{row.model_name}</TableCell>
                        <TableCell>
                          {row.material_code}
                          {!isRecoveryTarget && (
                            <span className="ml-1 text-xs text-orange-500">(폐기)</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.material_name}</TableCell>
                        <TableCell>{row.output_quantity}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 50 && (
              <p className="text-sm text-muted-foreground mt-4">
                ...외 {(parsedData.length - 50).toLocaleString()}개 행
              </p>
            )}
            <p className="text-xs text-orange-600 mt-2">
              * 주황색 행은 회수대상이 아니므로 업로드 시 폐기됩니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 중복 처리 모달 */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              중복 데이터 발견
            </DialogTitle>
            <DialogDescription>
              업로드하려는 데이터 중 기존 데이터와 중복되는 항목이 있습니다.
              어떻게 처리하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDuplicateModal(false)}>
              취소
            </Button>
            <Button variant="outline" onClick={() => handleUpload(false)}>
              중복 건너뛰기
            </Button>
            <Button onClick={() => handleUpload(true)}>
              덮어쓰기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
