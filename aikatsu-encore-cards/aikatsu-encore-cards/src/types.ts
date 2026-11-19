export type CardSource = 'local' | 'upload';

/** IndexedDB에 저장되는 카드 레코드 */
export interface CardRecord {
  id: string;
  name: string;
  number: string;
  /** 관리자가 지정한 표시 순서 (작을수록 앞) */
  order: number;
  createdAt: number;
  updatedAt: number;
  source: CardSource;
  /** 로컬 이미지 폴더(src/assets/cards)의 파일명 — 기본 제공 카드인 경우 */
  localFile?: string;
  /** 업로드(또는 교체)한 원본 이미지 */
  image?: Blob;
  /** 갤러리 표시용 축소 이미지 (원본이 작으면 없음) */
  thumb?: Blob;
  width?: number;
  height?: number;
}

/** 화면에서 사용하는 카드 */
export interface Card {
  id: string;
  name: string;
  number: string;
  order: number;
  createdAt: number;
  source: CardSource;
  /** 원본 이미지 URL (이미지 시트 저장용) */
  src: string | null;
  /** 갤러리/미리보기용 이미지 URL */
  thumbSrc: string | null;
  width?: number;
  height?: number;
  version: number;
}

export type SortKey = 'order' | 'number' | 'name' | 'recent';

export type LabelMode = 'none' | 'name' | 'number' | 'both';

export interface SheetSettings {
  columns: 3 | 4 | 5 | 6;
  /** 카드 사이 간격 (카드 폭 600px 기준 px) */
  gap: number;
  /** 바깥 여백 (카드 폭 600px 기준 px) */
  padding: number;
  background: string;
  labelMode: LabelMode;
}

export type TabKey = 'gallery' | 'selected' | 'sheet' | 'admin';

export interface PendingUpload {
  key: string;
  file: File;
  previewUrl: string;
  name: string;
  number: string;
}
