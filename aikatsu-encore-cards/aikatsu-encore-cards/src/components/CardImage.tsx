import { useEffect, useState } from 'react';
import { CardIcon } from './icons';
import { cx } from '../lib/utils';

interface Props {
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  /** 이미지 상단 정렬 등 추가 스타일 */
  imgClassName?: string;
  rounded?: string;
}

/**
 * 카드 이미지 — 원본 비율을 유지하고, 절대 잘리거나 찌그러지지 않게 표시합니다.
 * 이미지가 없거나 불러오지 못하면 깔끔한 안내 화면을 보여줍니다.
 */
export function CardImage({ src, alt, width, height, className, imgClassName, rounded = 'rounded-xl' }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  const ratio = width && height ? `${width} / ${height}` : undefined;

  if (!src || failed) {
    return (
      <div
        className={cx(
          'flex w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-blush-200 bg-gradient-to-b from-white to-blush-50 text-blush-300',
          rounded,
          className,
        )}
        style={{ aspectRatio: ratio ?? '63 / 88' }}
      >
        <CardIcon size={32} />
        <span className="px-2 text-center text-xs font-medium text-lilac-400">
          {failed ? '이미지를 불러올 수 없어요' : '이미지 없음'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cx('relative w-full overflow-hidden', rounded, !loaded && 'bg-blush-50/70', className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cx(
          'block w-full select-none transition-opacity duration-300',
          ratio ? 'h-full object-contain' : 'h-auto',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
        style={!ratio && !loaded ? { aspectRatio: '63 / 88' } : undefined}
      />
    </div>
  );
}
