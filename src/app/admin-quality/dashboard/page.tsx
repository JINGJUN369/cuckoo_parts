'use client';

import { useMemo, useState } from 'react';
import { TruckIcon, PackageCheck, Download, Package, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMaterialUsage } from '@/hooks/useMaterialUsage';
import { useProductRecovery } from '@/hooks/useProductRecovery';
import { exportToExcel, exportGenericToExcel } from '@/lib/excel';

export default function AdminQualityDashboardPage() {
  // 메인 탭 상태
  const [mainTab, setMainTab] = useState<'overview' | 'material' | 'product'>('material');

  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productBranchFilter, setProductBranchFilter] = useState<string>('all');

  const { getByStatus, getStats } = useMaterialUsage();
  const {
    getByStatus: getProductByStatus,
    getStats: getProductStats
  } = useProductRecovery();

  // 자재 발송 상태 데이터
  const shippedData = useMemo(() => getByStatus('발송'), [getByStatus]);
  const stats = useMemo(() => getStats(), [getStats]);

  // 제품 발송 상태 데이터
  const productShippedData = useMemo(() => getProductByStatus('발송'), [getProductByStatus]);
  const productStats = useMemo(() => getProductStats(), [getProductStats]);

  // 통합 통계
  const combinedStats = useMemo(() => ({
    shipped: stats.shipped + productStats.shipped,
    received: stats.received + productStats.received,
    total: stats.total + productStats.total,
  }), [stats, productStats]);

  // 자재 고유 법인 목록
  const branches = useMemo(() => {
    const branchSet = new Set(shippedData.map((item) => item.branch_code));
    return Array.from(branchSet).sort();
  }, [shippedData]);

  // 제품 고유 법인 목록
  const productBranches = useMemo(() => {
    const branchSet = new Set(productShippedData.map((item) => item.request_branch));
    return Array.from(branchSet).filter(Boolean).sort();
  }, [productShippedData]);

  // 자재 필터링된 데이터
  const filteredData = useMemo(() => {
    return shippedData.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.material_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === 'all' || item.branch_code === branchFilter;

      return matchesSearch && matchesBranch;
    });
  }, [shippedData, searchTerm, branchFilter]);

  // 제품 필터링된 데이터
  const filteredProductData = useMemo(() => {
    return productShippedData.filter((item) => {
      const matchesSearch =
        !productSearchTerm ||
        item.customer_number.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        item.model_name?.toLowerCase().includes(productSearchTerm.toLowerCase());

      const matchesBranch = productBranchFilter === 'all' || item.request_branch === productBranchFilter;

      return matchesSearch && matchesBranch;
    });
  }, [productShippedData, productSearchTerm, productBranchFilter]);

  // 엑셀 내보내기
  const handleExport = () => {
    exportToExcel(filteredData, 'shipped_material_data');
  };

  const handleProductExport = () => {
    const exportData = filteredProductData.map(item => ({
      유형: item.recovery_type,
      고객번호: item.customer_number,
      고객명: item.customer_name,
      모델명: item.model_name,
      요청지점: item.request_branch,
      운송회사: item.carrier,
      송장번호: item.tracking_number,
      발송일시: item.shipped_at,
      상태: item.recovery_status,
    }));
    exportGenericToExcel(exportData, 'shipped_product_data');
  };

  // 인쇄
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">발송현황 대시보드</h1>
          <p className="text-muted-foreground">설치법인에서 발송한 부품/제품 현황을 확인합니다.</p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          인쇄
        </Button>
      </div>

      {/* 메인 탭 */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'overview' | 'material' | 'product')} className="print:hidden">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="overview" className="text-base">
            📊 통합 현황
          </TabsTrigger>
          <TabsTrigger value="material" className="text-base">
            🔧 자재 ({stats.shipped})
          </TabsTrigger>
          <TabsTrigger value="product" className="text-base">
            📦 제품 ({productStats.shipped})
          </TabsTrigger>
        </TabsList>

        {/* 통합 탭 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 통합 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="발송중 (통합)"
              value={combinedStats.shipped.toLocaleString()}
              icon={TruckIcon}
              description={`자재 ${stats.shipped} + 제품 ${productStats.shipped}`}
              className="border-l-4 border-l-blue-500"
            />
            <StatCard
              title="입고완료 (통합)"
              value={combinedStats.received.toLocaleString()}
              icon={PackageCheck}
              description={`자재 ${stats.received} + 제품 ${productStats.received}`}
              className="border-l-4 border-l-green-500"
            />
            <StatCard
              title="전체 회수대상"
              value={combinedStats.total.toLocaleString()}
              icon={Package}
              description={`자재 ${stats.total} + 제품 ${productStats.total}`}
            />
          </div>

          {/* 유형별 비교 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🔧 자재 발송 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송중</span>
                    <span className="font-medium text-blue-600">{stats.shipped}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">입고완료</span>
                    <span className="font-medium text-green-600">{stats.received}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">전체</span>
                    <span className="font-medium">{stats.total}건</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setMainTab('material')}
                >
                  자재 상세보기
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📦 제품 발송 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">발송중</span>
                    <span className="font-medium text-blue-600">{productStats.shipped}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">입고완료</span>
                    <span className="font-medium text-green-600">{productStats.received}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">전체</span>
                    <span className="font-medium">{productStats.total}건</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setMainTab('product')}
                >
                  제품 상세보기
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 자재 탭 */}
        <TabsContent value="material" className="space-y-6">
          {/* 자재 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="발송중"
              value={stats.shipped.toLocaleString()}
              icon={TruckIcon}
              description="현재 발송 진행 중인 건수"
              className="border-l-4 border-l-blue-500"
            />
            <StatCard
              title="입고완료"
              value={stats.received.toLocaleString()}
              icon={PackageCheck}
              description="입고 완료된 건수"
              className="border-l-4 border-l-green-500"
            />
            <StatCard
              title="전체 회수대상"
              value={stats.total.toLocaleString()}
              description="전체 회수대상 건수"
            />
          </div>

          {/* 필터 및 검색 */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle>자재 발송 목록 ({filteredData.length}건)</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="검색 (요청번호, 자재코드, 자재명)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[300px]"
                  />
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="전체 법인" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 법인</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    엑셀 내보내기
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>요청번호</TableHead>
                        <TableHead>이관처</TableHead>
                        <TableHead>자재코드</TableHead>
                        <TableHead>자재명</TableHead>
                        <TableHead>운송회사</TableHead>
                        <TableHead>송장번호</TableHead>
                        <TableHead>발송일시</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.request_number}</TableCell>
                          <TableCell>{item.branch_code}</TableCell>
                          <TableCell>{item.material_code}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.material_name}</TableCell>
                          <TableCell>{item.carrier}</TableCell>
                          <TableCell>{item.tracking_number}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.shipped_at
                              ? new Date(item.shipped_at).toLocaleString('ko-KR')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} size="sm" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  발송된 자재가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 제품 탭 */}
        <TabsContent value="product" className="space-y-6">
          {/* 제품 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="발송중"
              value={productStats.shipped.toLocaleString()}
              icon={TruckIcon}
              description="현재 발송 진행 중인 건수"
              className="border-l-4 border-l-blue-500"
            />
            <StatCard
              title="입고완료"
              value={productStats.received.toLocaleString()}
              icon={PackageCheck}
              description="입고 완료된 건수"
              className="border-l-4 border-l-green-500"
            />
            <StatCard
              title="전체 회수대상"
              value={productStats.total.toLocaleString()}
              description="전체 회수대상 건수"
            />
          </div>

          {/* 필터 및 검색 */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle>제품 발송 목록 ({filteredProductData.length}건)</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="검색 (고객번호, 고객명, 모델명)"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="w-[300px]"
                  />
                  <Select value={productBranchFilter} onValueChange={setProductBranchFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="전체 지점" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 지점</SelectItem>
                      {productBranches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleProductExport}>
                    <Download className="h-4 w-4 mr-2" />
                    엑셀 내보내기
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProductData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>유형</TableHead>
                        <TableHead>고객번호</TableHead>
                        <TableHead>고객명</TableHead>
                        <TableHead>모델명</TableHead>
                        <TableHead>요청지점</TableHead>
                        <TableHead>운송회사</TableHead>
                        <TableHead>송장번호</TableHead>
                        <TableHead>발송일시</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProductData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant={item.recovery_type === '철거' ? 'default' : 'secondary'}>
                              {item.recovery_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.customer_number}</TableCell>
                          <TableCell>{item.customer_name}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{item.model_name}</TableCell>
                          <TableCell>{item.request_branch}</TableCell>
                          <TableCell>{item.carrier}</TableCell>
                          <TableCell>{item.tracking_number}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.shipped_at
                              ? new Date(item.shipped_at).toLocaleString('ko-KR')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              {item.recovery_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  발송된 제품이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 인쇄용 전용 영역 */}
      <div className="hidden print:block print-area">
        <div className="print-header">
          <h1>발송현황 목록</h1>
          <div className="print-meta">
            <span>출력일시: {new Date().toLocaleString('ko-KR')}</span>
          </div>
          <div className="print-summary">
            <span style={{ fontWeight: 'bold' }}>【자재】</span>
            <span>발송: {stats.shipped}</span>
            <span>입고: {stats.received}</span>
            <span style={{ marginLeft: '20px', fontWeight: 'bold' }}>【제품】</span>
            <span>발송: {productStats.shipped}</span>
            <span>입고: {productStats.received}</span>
          </div>
        </div>

        {/* 자재 발송 목록 */}
        {filteredData.length > 0 && (
          <div className="print-section">
            <h2>■ 자재 발송 목록 ({filteredData.length}건)</h2>
            <table>
              <thead>
                <tr>
                  <th>요청번호</th>
                  <th>이관처</th>
                  <th>자재코드</th>
                  <th>자재명</th>
                  <th>운송회사</th>
                  <th>송장번호</th>
                  <th>발송일시</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.request_number}</td>
                    <td>{item.branch_code}</td>
                    <td>{item.material_code}</td>
                    <td>{item.material_name}</td>
                    <td>{item.carrier}</td>
                    <td>{item.tracking_number}</td>
                    <td>{item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 제품 발송 목록 */}
        {filteredProductData.length > 0 && (
          <div className="print-section">
            <h2>■ 제품 발송 목록 ({filteredProductData.length}건)</h2>
            <table>
              <thead>
                <tr>
                  <th>유형</th>
                  <th>고객번호</th>
                  <th>고객명</th>
                  <th>모델명</th>
                  <th>요청지점</th>
                  <th>운송회사</th>
                  <th>송장번호</th>
                  <th>발송일시</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.recovery_type}</td>
                    <td>{item.customer_number}</td>
                    <td>{item.customer_name}</td>
                    <td>{item.model_name}</td>
                    <td>{item.request_branch}</td>
                    <td>{item.carrier}</td>
                    <td>{item.tracking_number}</td>
                    <td>{item.shipped_at ? new Date(item.shipped_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .print-area, .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10mm;
            font-size: 10pt;
          }

          .print-header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
          }

          .print-header h1 {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 8px;
          }

          .print-meta {
            font-size: 9pt;
            color: #555;
            margin-bottom: 8px;
          }

          .print-summary {
            display: flex;
            justify-content: center;
            gap: 15px;
            font-size: 10pt;
            font-weight: 500;
          }

          .print-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .print-section h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #999;
          }

          .print-area table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          .print-area th,
          .print-area td {
            border: 1px solid #333;
            padding: 4px 6px;
            text-align: left;
          }

          .print-area th {
            background: #e0e0e0;
            font-weight: bold;
            text-align: center;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }

        @media screen {
          .print-area {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
