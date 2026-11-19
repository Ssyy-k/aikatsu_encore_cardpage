import { useDeferredValue, useMemo, useState } from 'react';
import type { Card, SortKey } from '../types';
import type { SelectionApi } from '../hooks/useSelection';
import { useLocalStorageState } from '../hooks/useLocalStorage';
import { CardTile } from '../components/CardTile';
import { Button, EmptyState } from '../components/ui';
import { CardIcon, ChevronDownIcon, HeartIcon, SearchIcon, SettingsIcon, XIcon } from '../components/icons';
import { cx, matchesQuery, sortCards } from '../lib/utils';

interface Props {
  cards: Card[];
  loaded: boolean;
  selection: SelectionApi;
  onGoAdmin: () => void;
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'order:asc', label: '기본 순서' },
  { value: 'number:asc', label: '카드 번호 ↑' },
  { value: 'number:desc', label: '카드 번호 ↓' },
  { value: 'name:asc', label: '카드 이름 가나다순' },
  { value: 'name:desc', label: '카드 이름 역순' },
  { value: 'recent:asc', label: '최근 등록순' },
];

export function GalleryView({ cards, loaded, selection, onGoAdmin }: Props) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [sortValue, setSortValue] = useLocalStorageState('aikatsu-encore.gallerySort', 'order:asc', (v) =>
    SORT_OPTIONS.some((o) => o.value === v) ? v : 'order:asc',
  );
  const [onlySelected, setOnlySelected] = useState(false);
  const { selectedSet, toggle, selectMany, clear } = selection;

  const visible = useMemo(() => {
    const [key, dir] = sortValue.split(':') as [SortKey, 'asc' | 'desc'];
    const filtered = cards.filter(
      (c) => matchesQuery(c, deferredQuery) && (!onlySelected || selectedSet.has(c.id)),
    );
    return sortCards(filtered, key, dir === 'desc');
  }, [cards, deferredQuery, onlySelected, selectedSet, sortValue]);

  const filtering = deferredQuery.trim() !== '' || onlySelected;
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selectedSet.has(c.id));

  if (!loaded) {
    return (
      <div className="grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-white p-2 ring-1 ring-blush-100">
            <div className="aspect-[63/88] rounded-lg bg-blush-50" />
            <div className="mt-2 h-3 w-2/3 rounded bg-blush-50" />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={<CardIcon size={30} />}
        title="아직 등록된 카드가 없어요"
        description={
          <>
            판매할 카드 사진이 등록되면 이곳에 표시돼요.
            <br />
            관리 화면에서 카드 사진을 등록해 주세요.
          </>
        }
        action={
          <Button variant="primary" onClick={onGoAdmin}>
            <SettingsIcon size={17} /> 카드 등록하러 가기
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {/* 검색 · 정렬 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">카드 이름 또는 번호 검색</span>
          <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-blush-300" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="카드 이름 또는 번호로 검색"
            className="h-12 w-full rounded-full border-0 bg-white pr-11 pl-11 text-[15px] text-ink shadow-sm ring-1 ring-blush-100 outline-none placeholder:text-ink-soft/60 focus:ring-2 focus:ring-blush-300"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-blush-50"
              aria-label="검색어 지우기"
            >
              <XIcon size={16} />
            </button>
          )}
        </label>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:flex-none">
            <span className="sr-only">정렬 기준</span>
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              className="h-12 w-full appearance-none rounded-full border-0 bg-white pr-10 pl-4 text-sm font-semibold text-ink shadow-sm ring-1 ring-blush-100 outline-none focus:ring-2 focus:ring-blush-300 sm:w-48"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-soft" />
          </label>
          <button
            type="button"
            onClick={() => setOnlySelected((v) => !v)}
            aria-pressed={onlySelected}
            className={cx(
              'inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap shadow-sm ring-1 transition touch-manipulation',
              onlySelected ? 'bg-blush-500 text-white ring-blush-500' : 'bg-white text-ink ring-blush-100 hover:ring-blush-300',
            )}
          >
            <HeartIcon size={17} />
            선택만 보기
          </button>
        </div>
      </div>

      {/* 카운트 · 일괄 선택 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-ink-soft">
          전체 <strong className="font-bold text-ink">{cards.length}</strong>장
          {filtering && (
            <>
              <span className="mx-1.5 text-blush-200">|</span>
              표시 <strong className="font-bold text-ink">{visible.length}</strong>장
            </>
          )}
          <span className="mx-1.5 text-blush-200">|</span>
          선택 <strong className="font-bold text-blush-600">{selection.selected.length}</strong>장
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="soft"
            onClick={() => selectMany(visible.map((c) => c.id))}
            disabled={visible.length === 0 || allVisibleSelected}
          >
            {filtering ? '표시된 카드 전체 선택' : '전체 선택'}
          </Button>
          <Button size="sm" variant="secondary" onClick={clear} disabled={selection.selected.length === 0}>
            전체 선택 해제
          </Button>
        </div>
      </div>

      {/* 카드 갤러리 */}
      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<SearchIcon size={28} />}
            title={onlySelected && !deferredQuery.trim() ? '선택한 카드가 없어요' : '검색 결과가 없어요'}
            description={
              deferredQuery.trim()
                ? `‘${deferredQuery.trim()}’에 맞는 카드를 찾지 못했어요. 다른 이름이나 번호로 검색해 보세요.`
                : '갤러리에서 카드를 눌러 선택해 보세요.'
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setOnlySelected(false);
                }}
              >
                전체 카드 보기
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 min-[520px]:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((card) => (
            <CardTile key={card.id} card={card} selected={selectedSet.has(card.id)} onToggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}
