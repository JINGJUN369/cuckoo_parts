'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Info,
  Package,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseExcelFile } from '@/lib/excel';
import { useMaterialUsage, UploadResult } from '@/hooks/useMaterialUsage';
import { useRecoveryMaterials } from '@/hooks/useRecoveryMaterials';
import {
  useProductRecovery,
  ProductUploadResult,
  extractContractDate,
  isWithinOneYear,
  isAutoRecoveryModel,
} from '@/hooks/useProductRecovery';
import { useAuth } from '@/hooks/useAuth';
import { ParsedExcelRow, ParsedRemovalExcelRow, ParsedDefectExchangeExcelRow, ProductRecoveryType } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

// 제품 컬럼 매핑 (철거)
const REMOVAL_COLUMN_MAP: Record<string, keyof ParsedRemovalExcelRow> = {
  '요청일자': 'request_date',
  '요청지점': 'request_branch',
  '고객번호': 'customer_number',
  '고객명': 'customer_name',
  '주문자명': 'orderer_name',
  '모델명': 'model_name',
  '위약금': 'penalty_fee',
  '등록비': 'registration_fee',
  '기타할인': 'other_discount',
  '소모품비': 'consumable_fee',
  '철거비': 'removal_fee',
  '신규접수': 'new_request',
  '계약해지요청일': 'termination_request_date',
  '작업의뢰(대)': 'work_request_large',
  '작업의뢰(중)': 'work_request_medium',
  '작업의뢰(소)': 'work_request_small',
  '특이사항': 'special_notes',
  '요청사항': 'request_notes',
  '고장코드': 'fault_code',
  '반려사유': 'rejection_reason',
  '매출차감': 'sales_deduction',
  '잡이익차감': 'misc_profit_deduction',
  '품의진행상태': 'approval_status',
  '사원번호': 'employee_number',
  '상태': 'status_raw',
};

// 제품 컬럼 매핑 (불량교환)
const DEFECT_COLUMN_MAP: Record<string, keyof ParsedDefectExchangeExcelRow> = {
  '요청일자': 'request_date',
  '요청지점': 'request_branch',
  '고객번호': 'customer_number',
  '고객명': 'customer_name',
  '주문자명': 'orderer_name',
  '모델명': 'model_name',
  '신규접수': 'new_request',
  '계약해지요청일': 'termination_request_date',
  '작업의뢰(대)': 'work_request_large',
  '작업의뢰(중)': 'work_request_medium',
  '작업의뢰(소)': 'work_request_small',
  '특이사항': 'special_notes',
  '요청사항': 'request_notes',
  '반려사유': 'rejection_reason',
  '매출차감': 'sales_deduction',
  '잡이익차감': 'misc_profit_deduction',
  '품의진행상태': 'approval_status',
  '사원번호': 'employee_number',
  '상태': 'status_raw',
};

// 제품 엑셀 파싱 함수
function parseProductExcel(
  file: File,
  type: ProductRecoveryType
): Promise<ParsedRemovalExcelRow[] | ParsedDefectExchangeExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        if (jsonData.length < 2) {
          reject(new Error('데이터가 없습니다.'));
          return;
        }

        const headers = jsonData[0] as string[];
        const columnMap = type === '철거' ? REMOVAL_COLUMN_MAP : DEFECT_COLUMN_MAP;

        const rows = jsonData.slice(1).map((row) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((header, idx) => {
            const key = columnMap[header];
            if (key) {
              obj[key] = row[idx];
            }
          });
          return obj;
        }).filter(row => row.customer_number);

        resolve(rows as unknown as (ParsedRemovalExcelRow[] | ParsedDefectExchangeExcelRow[]));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function UploadPage() {
  // 메인 탭 상태
  const [mainTab, setMainTab] = useState<'material' | 'product'>('material');

  // ===== 자재 업로드 상태 =====
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialParsedData, setMaterialParsedData] = useState<ParsedExcelRow[]>([]);
  const [isMaterialLoading, setIsMaterialLoading] = useState(false);
  const [isMaterialUploading, setIsMaterialUploading] = useState(false);
  const [materialUploadProgress, setMaterialUploadProgress] = useState(0);
  const [materialUploadStatus, setMaterialUploadStatus] = useState('');
  const [materialUploadResult, setMaterialUploadResult] = useState<UploadResult | null>(null);

  // ===== 제품 업로드 상태 =====
  const [productUploadType, setProductUploadType] = useState<ProductRecoveryType>('철거');
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productParsedData, setProductParsedData] = useState<(ParsedRemovalExcelRow | ParsedDefectExchangeExcelRow)[]>([]);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [isProductUploading, setIsProductUploading] = useState(false);
  const [productUploadProgress, setProductUploadProgress] = useState(0);
  const [productUploadStatus, setProductUploadStatus] = useState('');
  const [productUploadResult, setProductUploadResult] = useState<ProductUploadResult | null>(null);


  // Hooks
  const { addData: addMaterialData } = useMaterialUsage();
  const { getMaterialCodes, getActiveMaterials } = useRecoveryMaterials();
  const {
    uploadRemovalData,
    uploadDefectExchangeData,
    autoRecoveryPrefixes,
  } = useProductRecovery();
  const { session } = useAuth();

  // 회수대상 자재 수
  const activeMaterialCount = getActiveMaterials().length;


  // ===== 자재 업로드 핸들러 =====
  const handleMaterialFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setMaterialFile(selectedFile);
    setIsMaterialLoading(true);
    setMaterialUploadResult(null);
    setMaterialUploadStatus('파일을 읽는 중...');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      setMaterialUploadStatus('데이터를 파싱하는 중...');
      const data = await parseExcelFile(selectedFile);
      setMaterialParsedData(data);
      setMaterialUploadStatus('');
      toast.success(`${data.length.toLocaleString()}개 행을 파싱했습니다.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setMaterialParsedData([]);
      setMaterialUploadStatus('');
    } finally {
      setIsMaterialLoading(false);
    }
  }, []);

  const handleMaterialDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.match(/\.(xlsx|xls)$/)) {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setMaterialFile(droppedFile);
    setIsMaterialLoading(true);
    setMaterialUploadResult(null);
    setMaterialUploadStatus('파일을 읽는 중...');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      setMaterialUploadStatus('데이터를 파싱하는 중...');
      const data = await parseExcelFile(droppedFile);
      setMaterialParsedData(data);
      setMaterialUploadStatus('');
      toast.success(`${data.length.toLocaleString()}개 행을 파싱했습니다.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setMaterialParsedData([]);
      setMaterialUploadStatus('');
    } finally {
      setIsMaterialLoading(false);
    }
  }, []);

  const handleMaterialUpload = useCallback(async (overwrite: boolean = false) => {
    if (materialParsedData.length === 0) return;

    const materialCodes = getMaterialCodes();
    if (materialCodes.size === 0) {
      toast.error('먼저 회수대상 자재를 설정해주세요. (자재 설정 메뉴)');
      return;
    }

    setIsMaterialUploading(true);
    setMaterialUploadProgress(0);
    setMaterialUploadStatus('업로드 준비 중...');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      setMaterialUploadStatus('회수대상 자재 확인 중...');
      setMaterialUploadProgress(10);
      await new Promise(resolve => setTimeout(resolve, 50));

      setMaterialUploadStatus('데이터 필터링 및 저장 중...');
      setMaterialUploadProgress(30);

      const result = await addMaterialData(materialParsedData, materialCodes, overwrite);

      setMaterialUploadProgress(80);
      setMaterialUploadStatus('이력 저장 중...');

      await supabase.from('upload_history').insert({
        file_name: materialFile?.name,
        total_rows: result.total,
        saved_rows: result.saved,
        new_rows: result.saved,
        duplicate_rows: result.duplicate,
        discarded_rows: result.discarded,
        recovery_target_rows: result.saved,
        by_date_detail: result.byDate,
        uploaded_by: session?.userCode,
        uploaded_at: new Date().toISOString(),
      });

      setMaterialUploadProgress(100);
      setMaterialUploadStatus('완료!');
      setMaterialUploadResult(result);

      toast.success(`업로드 완료: 저장 ${result.saved.toLocaleString()}건, 폐기 ${result.discarded.toLocaleString()}건`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsMaterialUploading(false);
      setMaterialUploadStatus('');
      setMaterialUploadProgress(0);
    }
  }, [materialParsedData, getMaterialCodes, addMaterialData, materialFile, session]);

  const handleMaterialUploadClick = useCallback(async () => {
    if (materialParsedData.length === 0 || isMaterialUploading) return;

    const activeMaterials = getActiveMaterials();
    if (activeMaterials.length === 0) {
      toast.error('먼저 회수대상 자재를 설정해주세요.');
      return;
    }

    handleMaterialUpload(false);
  }, [materialParsedData, isMaterialUploading, getActiveMaterials, handleMaterialUpload]);

  const handleMaterialReset = useCallback(() => {
    setMaterialFile(null);
    setMaterialParsedData([]);
    setMaterialUploadResult(null);
    setMaterialUploadProgress(0);
    setMaterialUploadStatus('');
  }, []);

  // ===== 제품 업로드 핸들러 =====
  const handleProductFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setProductFile(selectedFile);
    setIsProductLoading(true);
    setProductUploadResult(null);
    setProductUploadStatus('파일을 읽는 중...');

    try {
      setProductUploadStatus('데이터를 파싱하는 중...');
      const data = await parseProductExcel(selectedFile, productUploadType);
      setProductParsedData(data);
      setProductUploadStatus('');
      toast.success(`${data.length.toLocaleString()}개 행을 파싱했습니다.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setProductParsedData([]);
      setProductUploadStatus('');
    } finally {
      setIsProductLoading(false);
    }
  }, [productUploadType]);

  const handleProductDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.match(/\.(xlsx|xls)$/)) {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setProductFile(droppedFile);
    setIsProductLoading(true);
    setProductUploadResult(null);
    setProductUploadStatus('파일을 읽는 중...');

    try {
      setProductUploadStatus('데이터를 파싱하는 중...');
      const data = await parseProductExcel(droppedFile, productUploadType);
      setProductParsedData(data);
      setProductUploadStatus('');
      toast.success(`${data.length.toLocaleString()}개 행을 파싱했습니다.`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
      setProductParsedData([]);
      setProductUploadStatus('');
    } finally {
      setIsProductLoading(false);
    }
  }, [productUploadType]);

  const handleProductUpload = useCallback(async () => {
    if (productParsedData.length === 0) return;

    setIsProductUploading(true);
    setProductUploadProgress(0);
    setProductUploadStatus('업로드 준비 중...');

    try {
      setProductUploadStatus('데이터 처리 중...');
      setProductUploadProgress(30);

      let result: ProductUploadResult;
      if (productUploadType === '철거') {
        result = await uploadRemovalData(productParsedData as ParsedRemovalExcelRow[]);
      } else {
        result = await uploadDefectExchangeData(productParsedData as ParsedDefectExchangeExcelRow[]);
      }

      setProductUploadProgress(100);
      setProductUploadStatus('완료!');
      setProductUploadResult(result);

      toast.success(`업로드 완료: 저장 ${result.saved}건, 자동선택 ${result.autoSelected}건`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsProductUploading(false);
      setProductUploadStatus('');
      setProductUploadProgress(0);
    }
  }, [productParsedData, productUploadType, uploadRemovalData, uploadDefectExchangeData]);

  const handleProductReset = useCallback(() => {
    setProductFile(null);
    setProductParsedData([]);
    setProductUploadResult(null);
    setProductUploadProgress(0);
    setProductUploadStatus('');
  }, []);


  // 제품 미리보기용 자동선택 여부 계산
  const getAutoSelectInfo = (row: ParsedRemovalExcelRow | ParsedDefectExchangeExcelRow) => {
    if (row.approval_status !== '승인') return { approved: false, autoSelect: false, withinYear: false, autoModel: false };

    const contractDate = extractContractDate(String(row.customer_number));
    if (!contractDate) return { approved: true, autoSelect: false, withinYear: false, autoModel: false };

    const termDate = typeof row.termination_request_date === 'number'
      ? new Date((row.termination_request_date - 25569) * 86400 * 1000)
      : new Date(row.termination_request_date);

    const withinYear = isWithinOneYear(contractDate, termDate);
    const autoModel = isAutoRecoveryModel(String(row.model_name), autoRecoveryPrefixes);
    const autoSelect = withinYear && autoModel;

    return { approved: true, autoSelect, withinYear, autoModel };
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">데이터 업로드</h1>
        <p className="text-muted-foreground">자재 및 제품 데이터를 업로드합니다.</p>
      </div>

      {/* 메인 탭 */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'material' | 'product')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="material" className="flex items-center gap-2">
            <Package className="h-4 w-4" />자재 데이터
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />제품 데이터
          </TabsTrigger>
        </TabsList>

        {/* ===== 자재 업로드 탭 ===== */}
        <TabsContent value="material" className="space-y-6">
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
              <CardTitle>자재사용 데이터 업로드</CardTitle>
              <CardDescription>
                엑셀 파일(.xlsx, .xls)을 드래그하거나 선택해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isMaterialLoading || isMaterialUploading ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={!isMaterialLoading && !isMaterialUploading ? handleMaterialDrop : undefined}
                onClick={() => !isMaterialLoading && !isMaterialUploading && document.getElementById('material-file-input')?.click()}
              >
                <input
                  id="material-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleMaterialFileChange}
                  className="hidden"
                  disabled={isMaterialLoading || isMaterialUploading}
                />
                {isMaterialLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="font-medium">파일 처리 중...</p>
                    {materialUploadStatus && <p className="text-sm text-muted-foreground">{materialUploadStatus}</p>}
                  </div>
                ) : materialFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-12 w-12 text-green-600" />
                    <p className="font-medium">{materialFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {materialParsedData.length.toLocaleString()}개 행 파싱 완료
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <p>파일을 드래그하거나 클릭하여 선택</p>
                    <p className="text-sm text-muted-foreground">.xlsx, .xls 파일만 지원</p>
                  </div>
                )}
              </div>

              {/* 업로드 진행 상태 */}
              {isMaterialUploading && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="font-medium text-blue-800">업로드 진행 중...</span>
                  </div>
                  {materialUploadStatus && <p className="text-sm text-blue-700 mb-2">{materialUploadStatus}</p>}
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${materialUploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-blue-600 mt-1 text-right">{materialUploadProgress}%</p>
                </div>
              )}

              {/* 액션 버튼 */}
              {materialParsedData.length > 0 && !isMaterialUploading && (
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleMaterialUploadClick} disabled={isMaterialLoading || isMaterialUploading || activeMaterialCount === 0}>
                    업로드 실행
                  </Button>
                  <Button variant="outline" onClick={handleMaterialReset} disabled={isMaterialUploading}>
                    초기화
                  </Button>
                </div>
              )}

              {/* 업로드 결과 */}
              {materialUploadResult && !isMaterialUploading && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800">업로드 완료</p>
                      <ul className="text-sm text-green-700 mt-1 space-y-1">
                        <li>전체 행: {materialUploadResult.total.toLocaleString()}건</li>
                        <li className="text-green-800 font-medium">저장 (회수대상): {materialUploadResult.saved.toLocaleString()}건</li>
                        <li className="text-orange-600">폐기 (비회수대상): {materialUploadResult.discarded.toLocaleString()}건</li>
                        <li>중복 건수: {materialUploadResult.duplicate.toLocaleString()}건</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 자재 미리보기 */}
          {materialParsedData.length > 0 && !isMaterialUploading && (
            <Card>
              <CardHeader>
                <CardTitle>데이터 미리보기</CardTitle>
                <CardDescription>
                  처음 50개 행을 미리보기로 표시합니다. (전체: {materialParsedData.length.toLocaleString()}개)
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
                      {materialParsedData.slice(0, 50).map((row, index) => {
                        const isRecoveryTarget = getMaterialCodes().has(row.material_code);
                        return (
                          <TableRow key={index} className={isRecoveryTarget ? '' : 'bg-orange-50 text-orange-700'}>
                            <TableCell className="font-medium">{row.request_number}</TableCell>
                            <TableCell>{row.branch_code}</TableCell>
                            <TableCell>{row.process_time ? new Date(row.process_time).toLocaleDateString('ko-KR') : '-'}</TableCell>
                            <TableCell>{row.model_name}</TableCell>
                            <TableCell>
                              {row.material_code}
                              {!isRecoveryTarget && <span className="ml-1 text-xs text-orange-500">(폐기)</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{row.material_name}</TableCell>
                            <TableCell>{row.output_quantity}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {materialParsedData.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-4">...외 {(materialParsedData.length - 50).toLocaleString()}개 행</p>
                )}
                <p className="text-xs text-orange-600 mt-2">* 주황색 행은 회수대상이 아니므로 업로드 시 폐기됩니다.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== 제품 업로드 탭 ===== */}
        <TabsContent value="product" className="space-y-6">
          {/* 자동선택 기준 안내 */}
          <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>자동 회수대상 선택 기준</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>다음 조건을 <strong>모두 만족</strong>하면 자동으로 회수대상에 등록됩니다:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>모델명이 <strong>{autoRecoveryPrefixes.join(', ')}</strong>로 시작 (비데, 버블클렌저)</li>
                      <li>계약일로부터 해지요청일까지 <strong>1년 이내</strong></li>
                    </ul>
                    <p className="text-muted-foreground">* 품의진행상태가 "승인"인 건만 처리됩니다.</p>
                  </div>
                </AlertDescription>
              </Alert>

              {/* 업로드 유형 선택 */}
              <Card>
                <CardHeader>
                  <CardTitle>업로드 유형 선택</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button
                      variant={productUploadType === '철거' ? 'default' : 'outline'}
                      onClick={() => { setProductUploadType('철거'); handleProductReset(); }}
                      className="flex-1"
                    >
                      <Package className="h-4 w-4 mr-2" />철거
                    </Button>
                    <Button
                      variant={productUploadType === '불량교환' ? 'default' : 'outline'}
                      onClick={() => { setProductUploadType('불량교환'); handleProductReset(); }}
                      className="flex-1"
                    >
                      <Truck className="h-4 w-4 mr-2" />불량교환
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 업로드 영역 */}
              <Card>
                <CardHeader>
                  <CardTitle>파일 업로드 ({productUploadType})</CardTitle>
                  <CardDescription>엑셀 파일(.xlsx, .xls)을 드래그하거나 선택해주세요.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isProductLoading || isProductUploading ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={!isProductLoading && !isProductUploading ? handleProductDrop : undefined}
                    onClick={() => !isProductLoading && !isProductUploading && document.getElementById('product-file-input')?.click()}
                  >
                    <input
                      id="product-file-input"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleProductFileChange}
                      className="hidden"
                      disabled={isProductLoading || isProductUploading}
                    />
                    {isProductLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <p className="font-medium">파일 처리 중...</p>
                        {productUploadStatus && <p className="text-sm text-muted-foreground">{productUploadStatus}</p>}
                      </div>
                    ) : productFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="h-12 w-12 text-green-600" />
                        <p className="font-medium">{productFile.name}</p>
                        <p className="text-sm text-muted-foreground">{productParsedData.length.toLocaleString()}개 행 파싱 완료</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-12 w-12 text-gray-400" />
                        <p>파일을 드래그하거나 클릭하여 선택</p>
                        <p className="text-sm text-muted-foreground">.xlsx, .xls 파일만 지원</p>
                      </div>
                    )}
                  </div>

                  {/* 업로드 진행 상태 */}
                  {isProductUploading && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="font-medium text-blue-800">업로드 진행 중...</span>
                      </div>
                      {productUploadStatus && <p className="text-sm text-blue-700 mb-2">{productUploadStatus}</p>}
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${productUploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  {productParsedData.length > 0 && !isProductUploading && (
                    <div className="flex gap-2 mt-4">
                      <Button onClick={handleProductUpload} disabled={isProductLoading || isProductUploading}>업로드 실행</Button>
                      <Button variant="outline" onClick={handleProductReset} disabled={isProductUploading}>초기화</Button>
                    </div>
                  )}

                  {/* 업로드 결과 */}
                  {productUploadResult && !isProductUploading && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">업로드 완료</p>
                          <ul className="text-sm text-green-700 mt-1 space-y-1">
                            <li>전체 행: {productUploadResult.total.toLocaleString()}건</li>
                            <li>승인 건: {productUploadResult.approved.toLocaleString()}건</li>
                            <li className="text-green-800 font-medium">저장: {productUploadResult.saved.toLocaleString()}건</li>
                            <li className="text-blue-600 font-medium">자동선택: {productUploadResult.autoSelected.toLocaleString()}건</li>
                            <li className="text-orange-600">스킵 (비승인): {productUploadResult.skipped.toLocaleString()}건</li>
                            <li>중복: {productUploadResult.duplicate.toLocaleString()}건</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 제품 미리보기 */}
              {productParsedData.length > 0 && !isProductUploading && (
                <Card>
                  <CardHeader>
                    <CardTitle>데이터 미리보기</CardTitle>
                    <CardDescription>처음 50개 행을 미리보기로 표시합니다. (전체: {productParsedData.length.toLocaleString()}개)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>상태</TableHead>
                            <TableHead>고객번호</TableHead>
                            <TableHead>고객명</TableHead>
                            <TableHead>모델명</TableHead>
                            <TableHead>계약일</TableHead>
                            <TableHead>해지요청일</TableHead>
                            <TableHead>품의상태</TableHead>
                            <TableHead>자동선택</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productParsedData.slice(0, 50).map((row, index) => {
                            const info = getAutoSelectInfo(row);
                            return (
                              <TableRow key={index} className={info.autoSelect ? 'bg-green-50' : info.approved ? '' : 'bg-gray-100 text-gray-500'}>
                                <TableCell>
                                  {info.autoSelect ? (
                                    <Badge className="bg-green-600">자동</Badge>
                                  ) : info.approved ? (
                                    <Badge variant="outline">수동검토</Badge>
                                  ) : (
                                    <Badge variant="secondary">스킵</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">{row.customer_number}</TableCell>
                                <TableCell>{row.customer_name}</TableCell>
                                <TableCell>
                                  {row.model_name}
                                  {info.autoModel && <Badge variant="outline" className="ml-1 text-xs">회수모델</Badge>}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {extractContractDate(String(row.customer_number))?.toLocaleDateString('ko-KR') || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {typeof row.termination_request_date === 'number'
                                    ? new Date((row.termination_request_date - 25569) * 86400 * 1000).toLocaleDateString('ko-KR')
                                    : row.termination_request_date}
                                  {info.withinYear && <Badge variant="outline" className="ml-1 text-xs text-orange-600">1년이내</Badge>}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={row.approval_status === '승인' ? 'default' : 'secondary'}>{row.approval_status}</Badge>
                                </TableCell>
                                <TableCell>
                                  {info.autoSelect ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-gray-400">-</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {productParsedData.length > 50 && (
                      <p className="text-sm text-muted-foreground mt-4">...외 {(productParsedData.length - 50).toLocaleString()}개 행</p>
                    )}
                  </CardContent>
                </Card>
              )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
