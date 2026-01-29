'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import { parseExcelFile } from '@/lib/excel';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useRecoveryMaterials } from '@/hooks/useRecoveryMaterials';
import { useAuth } from '@/hooks/useAuth';
import { ParsedExcelRow, DuplicateAction } from '@/types';
import { STORAGE_KEYS } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcelRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    new: number;
    duplicate: number;
    recoveryTarget: number;
  } | null>(null);

  const { addData } = useMaterialUsage();
  const { getMaterialCodes } = useRecoveryMaterials();
  const { session } = useAuth();

  // 파일 선택 핸들러
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setUploadResult(null);

    try {
      const data = await parseExcelFile(selectedFile);
      setParsedData(data);
      toast.success(`${data.length}개 행을 파싱했습니다.`);
    } catch (error) {
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setParsedData([]);
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

    try {
      const data = await parseExcelFile(droppedFile);
      setParsedData(data);
      toast.success(`${data.length}개 행을 파싱했습니다.`);
    } catch (error) {
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setParsedData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 업로드 실행
  const handleUpload = useCallback((overwrite: boolean = false) => {
    if (parsedData.length === 0) return;

    const materialCodes = getMaterialCodes();
    const result = addData(parsedData, materialCodes, overwrite);

    setUploadResult(result);
    setShowDuplicateModal(false);

    // 업로드 이력 저장
    const historyKey = STORAGE_KEYS.UPLOAD_HISTORY;
    const existing = localStorage.getItem(historyKey);
    const history = existing ? JSON.parse(existing) : [];
    history.unshift({
      id: crypto.randomUUID(),
      file_name: file?.name,
      total_rows: parsedData.length,
      new_rows: result.new,
      duplicate_rows: result.duplicate,
      recovery_target_rows: result.recoveryTarget,
      uploaded_by: session?.userCode,
      uploaded_at: new Date().toISOString(),
    });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 500)));

    toast.success(`업로드 완료: 신규 ${result.new}건, 중복 ${result.duplicate}건`);
  }, [parsedData, getMaterialCodes, addData, file, session]);

  // 업로드 버튼 클릭
  const handleUploadClick = useCallback(() => {
    if (parsedData.length === 0) return;

    // 중복 체크
    const materialCodes = getMaterialCodes();
    const storedData = localStorage.getItem(STORAGE_KEYS.MATERIAL_USAGE);
    const existingData = storedData ? JSON.parse(storedData) : [];
    const existingKeys = new Set(
      existingData.map((item: { request_number: string; branch_code: string; material_code: string }) =>
        `${item.request_number}_${item.branch_code}_${item.material_code}`
      )
    );

    const duplicateCount = parsedData.filter((row) =>
      existingKeys.has(`${row.request_number}_${row.branch_code}_${row.material_code}`)
    ).length;

    if (duplicateCount > 0) {
      setShowDuplicateModal(true);
    } else {
      handleUpload(false);
    }
  }, [parsedData, getMaterialCodes, handleUpload]);

  // 초기화
  const handleReset = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setUploadResult(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">엑셀 업로드</h1>
        <p className="text-muted-foreground">자재사용 데이터를 업로드합니다.</p>
      </div>

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
              isLoading ? 'bg-gray-50' : 'hover:bg-gray-50 cursor-pointer'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p>파일 처리 중...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-12 w-12 text-green-600" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {parsedData.length}개 행 파싱 완료
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

          {/* 액션 버튼 */}
          {parsedData.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button onClick={handleUploadClick} disabled={isLoading}>
                업로드 실행
              </Button>
              <Button variant="outline" onClick={handleReset}>
                초기화
              </Button>
            </div>
          )}

          {/* 업로드 결과 */}
          {uploadResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">업로드 완료</p>
                <ul className="text-sm text-green-700 mt-1">
                  <li>신규 등록: {uploadResult.new}건</li>
                  <li>중복 건수: {uploadResult.duplicate}건</li>
                  <li>회수대상: {uploadResult.recoveryTarget}건</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 미리보기 */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>데이터 미리보기</CardTitle>
            <CardDescription>
              처음 50개 행을 미리보기로 표시합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>요청번호</TableHead>
                    <TableHead>이관처</TableHead>
                    <TableHead>모델명</TableHead>
                    <TableHead>자재코드</TableHead>
                    <TableHead>품명 및 규격</TableHead>
                    <TableHead>출고수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.request_number}</TableCell>
                      <TableCell>{row.branch_code}</TableCell>
                      <TableCell>{row.model_name}</TableCell>
                      <TableCell>{row.material_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.material_name}</TableCell>
                      <TableCell>{row.output_quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 50 && (
              <p className="text-sm text-muted-foreground mt-4">
                ...외 {parsedData.length - 50}개 행
              </p>
            )}
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
