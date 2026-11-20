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
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setNatural(null);
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

  // 가로 카드(액세서리 등)는 세로로 돌려서 다른 카드와 같은 크기로 표시
  const w = natural?.w ?? width;
  const h = natural?.h ?? height;
  const known = !!(w && h);
  const landscape = known && (w as number) > (h as number);
  const boxRatio = known ? (landscape ? `${h} / ${w}` : `${w} / ${h}`) : '63 / 88';

  return (
    <div
      className={cx('relative w-full overflow-hidden', rounded, !loaded && 'bg-blush-50/70', className)}
      style={{ aspectRatio: boxRatio }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight) setNatural({ w: el.naturalWidth, h: el.naturalHeight });
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
        className={cx(
          'absolute block select-none transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
        style={
          landscape
            ? {
                top: '50%',
                left: '50%',
                width: `${((w as number) / (h as number)) * 100}%`,
                height: 'auto',
                maxWidth: 'none',
                transform: 'translate(-50%, -50%) rotate(90deg)',
              }
            : { inset: 0, width: '100%', height: '100%', objectFit: 'contain' }
        }
      />
    </div>
  );
}
