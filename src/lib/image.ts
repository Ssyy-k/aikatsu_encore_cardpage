/** 이미지 로드·축소 관련 유틸 */

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // decode()로 메인 스레드 밖에서 디코딩을 끝낸 뒤 사용
      if (typeof img.decode === 'function') {
        img.decode().then(() => resolve(img), () => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${url.slice(0, 80)}`));
    img.src = url;
  });
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    // 이미 디코딩된 이미지는 URL을 해제해도 그릴 수 있습니다.
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export interface ProcessedImage {
  width: number;
  height: number;
  thumb?: Blob;
}

const THUMB_MAX_SIDE = 720;

/**
 * 원본 크기를 읽고, 원본이 크면 갤러리용 축소 이미지를 만듭니다.
 * 원본 파일 자체는 그대로 보관하여 이미지 시트 저장 시 해상도를 유지합니다.
 */
export async function processImage(file: Blob): Promise<ProcessedImage> {
  const img = await loadImageFromBlob(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new Error('이미지 크기를 읽을 수 없습니다.');

  const longSide = Math.max(width, height);
  if (longSide <= THUMB_MAX_SIDE * 1.15) return { width, height };

  const scale = THUMB_MAX_SIDE / longSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return { width, height };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let thumb = await canvasToBlob(canvas, 'image/webp', 0.88);
  if (!thumb || thumb.type !== 'image/webp') {
    thumb = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  }
  canvas.width = canvas.height = 0;
  return { width, height, thumb: thumb ?? undefined };
}
