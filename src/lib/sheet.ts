/**
 * 선택한 카드들을 한 장의 이미지(PNG)로 합치는 Canvas 렌더러.
 * 모든 처리는 브라우저 안에서 이루어지며 서버로 이미지를 보내지 않습니다.
 */
import type { Card, LabelMode, SheetSettings } from '../types';
import { loadImage } from './image';
import { nextFrame, todayStamp } from './utils';

export const DEFAULT_SHEET: SheetSettings = {
  columns: 4,
  gap: 24,
  padding: 40,
  background: '#ffffff',
  labelMode: 'none',
};

export const BACKGROUND_PRESETS: { label: string; value: string }[] = [
  { label: '화이트', value: '#ffffff' },
  { label: '베이비 핑크', value: '#fff0f6' },
  { label: '라벤더', value: '#f3eeff' },
  { label: '크림', value: '#fffaf0' },
  { label: '라이트 그레이', value: '#f2f2f5' },
  { label: '블랙', value: '#111111' },
];

/** 카드 비율을 알 수 없을 때 쓰는 기본 비율 (일반 트레이딩 카드 63×88mm) */
const FALLBACK_ASPECT = 88 / 63;
/** 간격·여백 설정값의 기준 카드 폭 */
const REF_WIDTH = 600;

export type SheetItem = Pick<Card, 'id' | 'name' | 'number' | 'src' | 'thumbSrc' | 'width' | 'height'>;

export interface SheetMetric {
  aspect: number;
  width: number;
}

export interface SheetLayout {
  /** 설계 좌표계 크기 */
  width: number;
  height: number;
  /** 실제 캔버스 크기 */
  outWidth: number;
  outHeight: number;
  scale: number;
  cols: number;
  rows: number;
  cellW: number;
  gap: number;
  pad: number;
  fontSize: number;
  labelH: number;
  rowTops: number[];
  rowImgH: number[];
  /** 브라우저 한계 때문에 원본보다 작게 저장되는지 */
  downscaled: boolean;
}

// ─── 이미지 로딩 ─────────────────────────────────────────────

export type ImageCache = Map<string, Promise<HTMLImageElement | null>>;

function getImage(cache: ImageCache, url: string): Promise<HTMLImageElement | null> {
  let p = cache.get(url);
  if (!p) {
    p = loadImage(url).catch(() => null);
    cache.set(url, p);
  }
  return p;
}

function abortError() {
  return new DOMException('취소되었습니다.', 'AbortError');
}

/** 동시에 6장씩 불러오며, 모든 이미지 로딩이 끝난 뒤 결과를 돌려줍니다. */
export async function loadImages(
  urls: (string | null)[],
  cache: ImageCache,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<(HTMLImageElement | null)[]> {
  const results: (HTMLImageElement | null)[] = new Array(urls.length).fill(null);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < urls.length) {
      if (signal?.aborted) throw abortError();
      const i = cursor++;
      const url = urls[i];
      results[i] = url ? await getImage(cache, url) : null;
      done++;
      onProgress?.(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
  if (signal?.aborted) throw abortError();
  return results;
}

export function metricFor(item: SheetItem, img: HTMLImageElement | null): SheetMetric {
  // 원본 크기 정보가 있으면 우선 사용 (썸네일 반올림 오차 없이 미리보기 = 저장 결과)
  let aspect = FALLBACK_ASPECT;
  if (item.width && item.height) aspect = item.height / item.width;
  else if (img && img.naturalWidth && img.naturalHeight) aspect = img.naturalHeight / img.naturalWidth;
  // 원본 해상도: 저장된 값 → (썸네일이 아닌 경우) 실제 이미지 크기
  const width = item.width ?? (img && item.thumbSrc === item.src ? img.naturalWidth : 0) ?? 0;
  return { aspect, width: width || REF_WIDTH };
}

// ─── 레이아웃 ───────────────────────────────────────────────

function labelLines(mode: LabelMode): number {
  return mode === 'none' ? 0 : mode === 'both' ? 2 : 1;
}

type Fit = { mode: 'export'; maxSide: number; maxArea: number } | { mode: 'preview'; fitWidth: number };

export function computeLayout(metrics: SheetMetric[], settings: SheetSettings, fit: Fit): SheetLayout {
  const n = metrics.length;
  const cols = Math.max(1, Math.min(settings.columns, n || 1));
  const rows = Math.max(1, Math.ceil(n / cols));

  // 카드 폭 = 선택한 원본 이미지 폭의 중앙값 → 원본 해상도를 최대한 유지
  const widths = metrics.map((m) => m.width).sort((a, b) => a - b);
  const median = widths.length ? widths[Math.floor(widths.length / 2)] : REF_WIDTH;
  const cellW = Math.min(2400, Math.max(240, median));
  const unit = cellW / REF_WIDTH;
  const gap = settings.gap * unit;
  const pad = settings.padding * unit;

  const lines = labelLines(settings.labelMode);
  const fontSize = cellW * 0.052;
  const labelH = lines ? fontSize * (0.75 + 1.45 * lines) : 0;

  const rowImgH: number[] = [];
  for (let r = 0; r < rows; r++) {
    let h = 0;
    for (let c = 0; c < cols; c++) {
      const m = metrics[r * cols + c];
      if (m) h = Math.max(h, cellW * m.aspect);
    }
    rowImgH.push(h || cellW * FALLBACK_ASPECT);
  }
  const rowTops: number[] = [];
  let y = pad;
  for (let r = 0; r < rows; r++) {
    rowTops.push(y);
    y += rowImgH[r] + labelH + (r < rows - 1 ? gap : 0);
  }
  const width = pad * 2 + cols * cellW + (cols - 1) * gap;
  const height = y + pad;

  let scale: number;
  let downscaled = false;
  if (fit.mode === 'export') {
    scale = Math.min(1, fit.maxSide / width, fit.maxSide / height, Math.sqrt(fit.maxArea / (width * height)));
    downscaled = scale < 0.999;
  } else {
    scale = fit.fitWidth / width;
  }
  return {
    width,
    height,
    outWidth: Math.max(1, Math.round(width * scale)),
    outHeight: Math.max(1, Math.round(height * scale)),
    scale,
    cols,
    rows,
    cellW,
    gap,
    pad,
    fontSize,
    labelH,
    rowTops,
    rowImgH,
    downscaled,
  };
}

/** 브라우저별 캔버스 한계 (iOS Safari는 약 1,670만 화소) */
export function exportLimits(): { mode: 'export'; maxSide: number; maxArea: number } {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android|Mobile/i.test(ua);
  if (isIOS) return { mode: 'export', maxSide: 8192, maxArea: 16_000_000 };
  if (isMobile) return { mode: 'export', maxSide: 8192, maxArea: 30_000_000 };
  return { mode: 'export', maxSide: 16384, maxArea: 64_000_000 };
}

// ─── 그리기 ────────────────────────────────────────────────

function isDarkColor(hex: string): boolean {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.5;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FONT_STACK =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

export async function drawSheet(
  canvas: HTMLCanvasElement,
  layout: SheetLayout,
  items: SheetItem[],
  images: (HTMLImageElement | null)[],
  metrics: SheetMetric[],
  settings: SheetSettings,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<void> {
  canvas.width = layout.outWidth;
  canvas.height = layout.outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지를 만들 수 없습니다. (Canvas 미지원)');

  ctx.setTransform(layout.scale, 0, 0, layout.scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const dark = isDarkColor(settings.background);
  const nameColor = dark ? '#ffffff' : '#2b2233';
  const numberColor = dark ? '#ffc2de' : '#c2477f';
  const { cellW, gap, pad, cols, fontSize, rowTops, rowImgH } = layout;

  for (let i = 0; i < items.length; i++) {
    if (opts.signal?.aborted) throw abortError();
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = pad + c * (cellW + gap);
    const top = rowTops[r];
    const imgH = cellW * metrics[i].aspect;
    const iy = top + (rowImgH[r] - imgH) / 2;
    const img = images[i];

    if (img) {
      ctx.drawImage(img, x, iy, cellW, imgH);
    } else {
      ctx.save();
      roundRect(ctx, x, iy, cellW, imgH, cellW * 0.04);
      ctx.fillStyle = dark ? '#2a2a2a' : '#f6f1f8';
      ctx.fill();
      ctx.fillStyle = dark ? '#aaaaaa' : '#9b8aa8';
      ctx.font = `500 ${fontSize}px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('이미지 없음', x + cellW / 2, iy + imgH / 2);
      ctx.restore();
    }

    if (settings.labelMode !== 'none') {
      const item = items[i];
      const ly = top + rowImgH[r] + fontSize * 0.55;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const cx = x + cellW / 2;
      const maxW = cellW * 0.96;
      const lineH = fontSize * 1.45;
      if (settings.labelMode === 'both') {
        ctx.font = `600 ${fontSize * 0.88}px ${FONT_STACK}`;
        ctx.fillStyle = numberColor;
        ctx.fillText(fitText(ctx, item.number || '—', maxW), cx, ly);
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillStyle = nameColor;
        ctx.fillText(fitText(ctx, item.name, maxW), cx, ly + lineH);
      } else if (settings.labelMode === 'number') {
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillStyle = nameColor;
        ctx.fillText(fitText(ctx, item.number || item.name, maxW), cx, ly);
      } else {
        ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
        ctx.fillStyle = nameColor;
        ctx.fillText(fitText(ctx, item.name, maxW), cx, ly);
      }
    }

    opts.onProgress?.(i + 1, items.length);
    // 카드가 많아도 화면이 멈추지 않도록 주기적으로 메인 스레드에 양보
    if (i % 6 === 5) await nextFrame();
  }
}

// ─── 저장 ──────────────────────────────────────────────────

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  downscaled: boolean;
}

export type ExportPhase = 'load' | 'draw' | 'encode';

export async function renderSheetBlob(
  items: SheetItem[],
  settings: SheetSettings,
  onProgress?: (phase: ExportPhase, done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const cache: ImageCache = new Map();
  // 원본 이미지 사용 (썸네일 X)
  const images = await loadImages(
    items.map((i) => i.src),
    cache,
    (d, t) => onProgress?.('load', d, t),
    signal,
  );
  const metrics = items.map((item, i) => {
    const img = images[i];
    const m = metricFor({ ...item, thumbSrc: item.src }, img);
    return m;
  });
  const layout = computeLayout(metrics, settings, exportLimits());
  const canvas = document.createElement('canvas');
  try {
    await drawSheet(canvas, layout, items, images, metrics, settings, {
      signal,
      onProgress: (d, t) => onProgress?.('draw', d, t),
    });
    onProgress?.('encode', 0, 1);
    await nextFrame();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('이미지가 너무 커서 저장하지 못했어요. 한 줄에 놓는 카드 수를 늘리거나 카드 수를 나눠서 저장해 주세요.');
    }
    return { blob, width: layout.outWidth, height: layout.outHeight, downscaled: layout.downscaled };
  } finally {
    canvas.width = canvas.height = 0; // 메모리 해제
  }
}

export function sheetFileName(date = new Date()): string {
  return `aikatsu_selection_${todayStamp(date)}.png`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
