import { memo } from 'react';
import type { Card } from '../types';
import { CardImage } from './CardImage';
import { CheckIcon } from './icons';
import { cx } from '../lib/utils';

interface Props {
  card: Card;
  selected: boolean;
  onToggle: (id: string) => void;
}

/** 갤러리 카드 — 이미지를 누르는 것만으로 선택/해제됩니다. */
export const CardTile = memo(function CardTile({ card, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(card.id)}
      aria-pressed={selected}
      aria-label={`${card.number ? card.number + ' ' : ''}${card.name} ${selected ? '선택 해제' : '선택'}`}
      className={cx(
        'card-tile group relative flex flex-col rounded-2xl bg-white p-2 text-left shadow-[0_2px_10px_-4px_rgba(180,90,140,0.25)] ring-1 transition duration-150 outline-none touch-manipulation sm:p-2.5',
        'focus-visible:ring-4 focus-visible:ring-lilac-300',
        selected
          ? 'bg-blush-50 ring-[3px] ring-blush-400 shadow-[0_6px_20px_-6px_rgba(244,95,164,0.55)]'
          : 'ring-blush-100 hover:-translate-y-0.5 hover:ring-blush-200 hover:shadow-[0_8px_22px_-10px_rgba(180,90,140,0.45)] active:scale-[0.98]',
      )}
    >
      <div className="relative">
        <CardImage src={card.thumbSrc} alt={card.name} width={card.width} height={card.height} rounded="rounded-lg" />
        <span
          className={cx(
            'absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 transition sm:h-8 sm:w-8',
            selected
              ? 'scale-100 border-white bg-blush-500 text-white shadow-md'
              : 'scale-90 border-white/90 bg-white/60 text-transparent opacity-0 backdrop-blur-sm group-hover:opacity-100',
          )}
          aria-hidden="true"
        >
          <CheckIcon size={16} />
        </span>
      </div>
      <div className="mt-2 min-w-0 px-0.5 pb-0.5">
        {card.number && (
          <p className={cx('truncate text-[11px] font-semibold tracking-wide', selected ? 'text-blush-600' : 'text-lilac-500')}>
            {card.number}
          </p>
        )}
        <p className="truncate text-[13px] leading-snug font-semibold text-ink sm:text-sm">{card.name}</p>
      </div>
    </button>
  );
});
