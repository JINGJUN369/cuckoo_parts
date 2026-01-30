'use client';

import { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Info,
  Package,
  Truck,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useProductRecovery,
  ProductUploadResult,
  extractContractDate,
  extractBranchCode,
  isWithinOneYear,
  isAutoRecoveryModel,
} from '@/hooks/useProductRecovery';
import { useAuth } from '@/hooks/useAuth';
import { ParsedRemovalExcelRow, ParsedDefectExchangeExcelRow, ProductRecoveryType } from '@/types';
import { toast } from 'sonner';

// 컬럼 매핑 (철거)
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

// 컬럼 매핑 (불량교환)
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

// 엑셀 파싱 함수
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
        }).filter(row => row.customer_number); // 고객번호가 있는 행만

        resolve(rows as unknown as (ParsedRemovalExcelRow[] | ParsedDefectExchangeExcelRow[]));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function ProductRecoveryPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'selection'>('upload');
  const [uploadType, setUploadType] = useState<ProductRecoveryType>('철거');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<(ParsedRemovalExcelRow | ParsedDefectExchangeExcelRow)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResult, setUploadResult] = useState<ProductUploadResult | null>(null);

  // 선택 탭 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data,
    uploadRemovalData,
    uploadDefectExchangeData,
    selectForRecovery,
    getUnselected,
    getStats,
    autoRecoveryPrefixes,
    refresh,
  } = useProductRecovery();
  const { session } = useAuth();

  // 미선택 데이터
  const unselectedData = useMemo(() => getUnselected(), [getUnselected]);

  // 통계
  const stats = useMemo(() => getStats(), [getStats]);

  // 모델 목록 (필터용)
  const modelList = useMemo(() => {
    const models = new Set(unselectedData.map(item => item.model_name));
    return Array.from(models).sort();
  }, [unselectedData]);

  // 필터링된 미선택 데이터
  const filteredUnselected = useMemo(() => {
    return unselectedData.filter(item => {
      const matchesSearch = !searchTerm ||
        item.customer_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesModel = modelFilter === 'all' || item.model_name === modelFilter;

      return matchesSearch && matchesModel;
    });
  }, [unselectedData, searchTerm, modelFilter]);

  // 파일 선택 핸들러
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setUploadResult(null);
    setUploadStatus('파일을 읽는 중...');

    try {
      setUploadStatus('데이터를 파싱하는 중...');
      const data = await parseProductExcel(selectedFile, uploadType);
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
  }, [uploadType]);

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
      setUploadStatus('데이터를 파싱하는 중...');
      const data = await parseProductExcel(droppedFile, uploadType);
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
  }, [uploadType]);

  // 업로드 실행
  const handleUpload = useCallback(async () => {
    if (parsedData.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('업로드 준비 중...');

    try {
      setUploadStatus('데이터 처리 중...');
      setUploadProgress(30);

      let result: ProductUploadResult;
      if (uploadType === '철거') {
        result = await uploadRemovalData(parsedData as ParsedRemovalExcelRow[]);
      } else {
        result = await uploadDefectExchangeData(parsedData as ParsedDefectExchangeExcelRow[]);
      }

      setUploadProgress(100);
      setUploadStatus('완료!');
      setUploadResult(result);

      toast.success(
        `업로드 완료: 저장 ${result.saved}건, 자동선택 ${result.autoSelected}건`
      );
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
    }
  }, [parsedData, uploadType, uploadRemovalData, uploadDefectExchangeData]);

  // 초기화
  const handleReset = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setUploadResult(null);
    setUploadProgress(0);
    setUploadStatus('');
  }, []);

  // 선택 토글
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 전체 선택/해제
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredUnselected.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUnselected.map(item => item.id)));
    }
  }, [selectedIds.size, filteredUnselected]);

  // 회수대상 등록
  const handleRegisterRecovery = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('선택된 항목이 없습니다.');
      return;
    }

    try {
      await selectForRecovery(Array.from(selectedIds), session?.userCode || 'ADMIN');
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size}건이 회수대상으로 등록되었습니다.`);
    } catch (error) {
      console.error('Register error:', error);
      toast.error('등록 중 오류가 발생했습니다.');
    }
  }, [selectedIds, selectForRecovery, session]);

  // 미리보기용 자동선택 여부 계산
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
        <h1 className="text-2xl font-bold">제품 회수 관리</h1>
        <p className="text-muted-foreground">철거/불량교환 제품의 회수를 관리합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="border-l-4 border-l-gray-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">전체</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.unselected}</div>
            <div className="text-sm text-muted-foreground">미선택</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.waiting}</div>
            <div className="text-sm text-muted-foreground">회수대기</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.collected}</div>
            <div className="text-sm text-muted-foreground">회수완료</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.shipped}</div>
            <div className="text-sm text-muted-foreground">발송</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.received}</div>
            <div className="text-sm text-muted-foreground">입고완료</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
            <div className="text-sm text-muted-foreground">발송불가</div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'selection')}>
        <TabsList>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            엑셀 업로드
          </TabsTrigger>
          <TabsTrigger value="selection" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            회수대상 선택
            {stats.unselected > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.unselected}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 업로드 탭 */}
        <TabsContent value="upload" className="space-y-6">
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
                  variant={uploadType === '철거' ? 'default' : 'outline'}
                  onClick={() => { setUploadType('철거'); handleReset(); }}
                  className="flex-1"
                >
                  <Package className="h-4 w-4 mr-2" />
                  철거
                </Button>
                <Button
                  variant={uploadType === '불량교환' ? 'default' : 'outline'}
                  onClick={() => { setUploadType('불량교환'); handleReset(); }}
                  className="flex-1"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  불량교환
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 업로드 영역 */}
          <Card>
            <CardHeader>
              <CardTitle>파일 업로드 ({uploadType})</CardTitle>
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
                onClick={() => !isLoading && !isUploading && document.getElementById('product-file-input')?.click()}
              >
                <input
                  id="product-file-input"
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
                </div>
              )}

              {/* 액션 버튼 */}
              {parsedData.length > 0 && !isUploading && (
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleUpload} disabled={isLoading || isUploading}>
                    업로드 실행
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
                        <li>승인 건: {uploadResult.approved.toLocaleString()}건</li>
                        <li className="text-green-800 font-medium">
                          저장: {uploadResult.saved.toLocaleString()}건
                        </li>
                        <li className="text-blue-600 font-medium">
                          자동선택: {uploadResult.autoSelected.toLocaleString()}건
                        </li>
                        <li className="text-orange-600">
                          스킵 (비승인): {uploadResult.skipped.toLocaleString()}건
                        </li>
                        <li>중복: {uploadResult.duplicate.toLocaleString()}건</li>
                      </ul>
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
                      {parsedData.slice(0, 50).map((row, index) => {
                        const info = getAutoSelectInfo(row);
                        return (
                          <TableRow
                            key={index}
                            className={info.autoSelect ? 'bg-green-50' : info.approved ? '' : 'bg-gray-100 text-gray-500'}
                          >
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
                              {info.autoModel && (
                                <Badge variant="outline" className="ml-1 text-xs">회수모델</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {extractContractDate(String(row.customer_number))?.toLocaleDateString('ko-KR') || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {typeof row.termination_request_date === 'number'
                                ? new Date((row.termination_request_date - 25569) * 86400 * 1000).toLocaleDateString('ko-KR')
                                : row.termination_request_date}
                              {info.withinYear && (
                                <Badge variant="outline" className="ml-1 text-xs text-orange-600">1년이내</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.approval_status === '승인' ? 'default' : 'secondary'}>
                                {row.approval_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {info.autoSelect ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
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
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 선택 탭 */}
        <TabsContent value="selection" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle>미선택 항목 ({filteredUnselected.length}건)</CardTitle>
                  <CardDescription>
                    자동선택 조건에 해당하지 않아 수동으로 검토가 필요한 항목입니다.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-[200px]"
                    />
                  </div>
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="모델 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 모델</SelectItem>
                      {modelList.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleRegisterRecovery}
                    disabled={selectedIds.size === 0}
                  >
                    선택 항목 회수대상 등록 ({selectedIds.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredUnselected.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedIds.size === filteredUnselected.length && filteredUnselected.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>고객번호</TableHead>
                        <TableHead>고객명</TableHead>
                        <TableHead>모델명</TableHead>
                        <TableHead>요청지점</TableHead>
                        <TableHead>작업의뢰</TableHead>
                        <TableHead>해지요청일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnselected.slice(0, 100).map((item) => (
                        <TableRow
                          key={item.id}
                          className={selectedIds.has(item.id) ? 'bg-blue-50' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={() => handleToggleSelect(item.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                              {item.recovery_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                          <TableCell>{item.customer_name}</TableCell>
                          <TableCell>
                            {item.model_name}
                            {item.is_auto_recovery_model && (
                              <Badge variant="outline" className="ml-1 text-xs">회수모델</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{item.request_branch}</TableCell>
                          <TableCell className="text-sm">
                            {item.work_request_medium}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.termination_request_date}
                            {item.is_within_one_year && (
                              <Badge variant="outline" className="ml-1 text-xs text-orange-600">1년이내</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {unselectedData.length === 0
                    ? '미선택 항목이 없습니다.'
                    : '검색 결과가 없습니다.'}
                </div>
              )}
              {filteredUnselected.length > 100 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  처음 100건만 표시됩니다. 검색을 활용해주세요.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
