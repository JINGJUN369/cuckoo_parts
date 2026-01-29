import * as XLSX from 'xlsx';
import { ParsedExcelRow, MaterialUsage } from '@/types';

// 엑셀 컬럼 매핑 (한글 헤더 → 영문 필드)
const COLUMN_MAPPING: Record<string, keyof ParsedExcelRow> = {
  '요청번호': 'request_number',
  '이관처': 'branch_code',
  '접수시간': 'receipt_time',
  '모델명': 'model_name',
  '제조번호': 'serial_number',
  '접수구분': 'receipt_type',
  '문의내용': 'inquiry_content',
  '처리시간': 'process_time',
  '처리구분': 'process_type',
  '수리구분': 'repair_type',
  '기사코드': 'technician_code',
  '처리내용': 'process_content',
  '고장대분류': 'fault_category_large',
  '고장중분류': 'fault_category_medium',
  '고장소분류': 'fault_category_small',
  '고장원인': 'fault_cause',
  '부품비': 'parts_cost',
  '수리비': 'repair_cost',
  '출장료': 'visit_cost',
  '유무상처리': 'warranty_type',
  '자재코드': 'material_code',
  '품명 및 규격': 'material_name',
  '품명및규격': 'material_name',
  '유무상처리2': 'warranty_type2',
  '출고수량': 'output_quantity',
};

// 엑셀 날짜 시리얼 → Date 변환
function excelDateToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  const totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
    hours,
    minutes,
    seconds
  );
}

// 엑셀 파일 파싱
export async function parseExcelFile(file: File): Promise<ParsedExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd hh:mm:ss',
        });

        // 필드 매핑
        const parsedData: ParsedExcelRow[] = jsonData.map((row) => {
          const mapped: Record<string, string | number | undefined> = {};

          for (const [koreanKey, value] of Object.entries(row)) {
            const englishKey = COLUMN_MAPPING[koreanKey.trim()];
            if (englishKey) {
              if (['parts_cost', 'repair_cost', 'visit_cost', 'output_quantity'].includes(englishKey)) {
                mapped[englishKey] = parseInt(String(value)) || 0;
              } else if (['receipt_time', 'process_time'].includes(englishKey)) {
                // 날짜 처리
                if (typeof value === 'number') {
                  mapped[englishKey] = excelDateToDate(value).toISOString();
                } else {
                  mapped[englishKey] = String(value);
                }
              } else {
                mapped[englishKey] = String(value);
              }
            }
          }

          return mapped as unknown as ParsedExcelRow;
        });

        // 필수 필드 검증
        const validData = parsedData.filter(
          (row) => row.request_number && row.branch_code && row.material_code
        );

        resolve(validData);
      } catch (error) {
        reject(new Error('엑셀 파일 파싱 중 오류가 발생했습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// 데이터를 엑셀로 내보내기
export function exportToExcel(
  data: MaterialUsage[],
  fileName: string = 'recovery_data'
): void {
  // 한글 헤더로 변환
  const exportData = data.map((item) => ({
    '요청번호': item.request_number,
    '이관처': item.branch_code,
    '접수시간': item.receipt_time,
    '모델명': item.model_name,
    '제조번호': item.serial_number,
    '접수구분': item.receipt_type,
    '문의내용': item.inquiry_content,
    '처리시간': item.process_time,
    '처리구분': item.process_type,
    '수리구분': item.repair_type,
    '기사코드': item.technician_code,
    '처리내용': item.process_content,
    '고장대분류': item.fault_category_large,
    '고장중분류': item.fault_category_medium,
    '고장소분류': item.fault_category_small,
    '고장원인': item.fault_cause,
    '부품비': item.parts_cost,
    '수리비': item.repair_cost,
    '출장료': item.visit_cost,
    '유무상처리': item.warranty_type,
    '자재코드': item.material_code,
    '품명 및 규격': item.material_name,
    '유무상처리2': item.warranty_type2,
    '출고수량': item.output_quantity,
    '상태': item.status,
    '회수완료시간': item.collected_at,
    '회수완료처리자': item.collected_by,
    '발송시간': item.shipped_at,
    '발송처리자': item.shipped_by,
    '운송회사': item.carrier,
    '송장번호': item.tracking_number,
    '입고완료시간': item.received_at,
    '입고완료처리자': item.received_by,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // 파일 다운로드
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(workbook, `${fileName}_${dateStr}.xlsx`);
}

// 중복 키 생성
export function generateDuplicateKey(row: ParsedExcelRow): string {
  return `${row.request_number}_${row.branch_code}_${row.material_code}`;
}
