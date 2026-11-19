import { useState } from 'react';
import type { Card } from '../types';
import type { SelectionApi } from '../hooks/useSelection';
import { CardImage } from '../components/CardImage';
import { OrderTools } from '../components/OrderTools';
import { Button, EmptyState, Panel } from '../components/ui';
import { ChevronLeftIcon, ChevronRightIcon, GridIcon, HeartIcon, ImageIcon, XIcon } from '../components/icons';
import { cx } from '../lib/utils';

interface Props {
  selectedCards: Card[];
  selection: SelectionApi;
  onGoGallery: () => void;
  onGoSheet: () => void;
}

export function SelectedView({ selectedCards, selection, onGoGallery, onGoSheet }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (selectedCards.length === 0) {
    return (
      <EmptyState
        icon={<HeartIcon size={28} />}
        title="아직 선택한 카드가 없어요"
        description="카드 갤러리에서 갖고 싶은 카드를 눌러 선택해 주세요. 선택한 카드는 이곳에 모여요."
        action={
          <Button variant="primary" onClick={onGoGallery}>
            <GridIcon size={17} /> 카드 고르러 가기
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="!p-4 sm:!p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">
              선택한 카드 <span className="text-blush-600">{selectedCards.length}</span>장
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              이 순서대로 이미지에 배치돼요. 화살표를 누르거나 카드를 끌어서 순서를 바꿀 수 있어요.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={selection.clear}>
              전체 선택 해제
            </Button>
            <Button variant="primary" onClick={onGoSheet}>
              <ImageIcon size={17} /> 이미지로 저장
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-blush-100 pt-4">
          <span className="text-xs font-semibold text-ink-soft">순서 한 번에 정렬</span>
          <OrderTools selectedCards={selectedCards} selection={selection} />
        </div>
      </Panel>

      <ol className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {selectedCards.map((card, index) => (
          <li
            key={card.id}
            draggable
            onDragStart={(e) => {
              setDragId(card.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', card.id);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (overId !== card.id) setOverId(card.id);
            }}
            onDragLeave={() => setOverId((v) => (v === card.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== card.id) selection.moveTo(dragId, card.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={cx(
              'card-tile relative flex flex-col rounded-2xl bg-white p-2 shadow-[0_2px_10px_-4px_rgba(180,90,140,0.25)] ring-1 ring-blush-100 transition sm:p-2.5',
              dragId === card.id && 'opacity-40',
              overId === card.id && dragId !== card.id && 'ring-[3px] ring-lilac-400',
              'cursor-grab active:cursor-grabbing',
            )}
          >
            <div className="relative">
              <CardImage src={card.thumbSrc} alt={card.name} width={card.width} height={card.height} rounded="rounded-lg" />
              <span className="absolute top-1.5 left-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-blush-500 px-2 text-xs font-bold text-white shadow-md ring-2 ring-white">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => selection.toggle(card.id)}
                className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow ring-1 ring-blush-100 backdrop-blur-sm transition hover:bg-rose-50 hover:text-rose-500 touch-manipulation"
                aria-label={`${card.name} 선택 해제`}
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="mt-2 min-w-0 px-0.5">
              {card.number && <p className="truncate text-[11px] font-semibold tracking-wide text-lilac-500">{card.number}</p>}
              <p className="truncate text-[13px] font-semibold text-ink sm:text-sm">{card.name}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => selection.move(card.id, -1)}
                disabled={index === 0}
                className="flex h-9 items-center justify-center rounded-full bg-blush-50 text-blush-600 transition hover:bg-blush-100 disabled:opacity-35 touch-manipulation"
                aria-label="앞으로 이동"
              >
                <ChevronLeftIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => selection.move(card.id, 1)}
                disabled={index === selectedCards.length - 1}
                className="flex h-9 items-center justify-center rounded-full bg-blush-50 text-blush-600 transition hover:bg-blush-100 disabled:opacity-35 touch-manipulation"
                aria-label="뒤로 이동"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
