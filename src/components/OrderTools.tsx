import type { Card } from '../types';
import type { SelectionApi } from '../hooks/useSelection';
import { autoSetBreaks, sortCards, sortForSets } from '../lib/utils';
import { Button } from './ui';

/** 선택한 카드의 배치 순서를 한 번에 바꾸는 버튼 모음 */
export function OrderTools({ selectedCards, selection }: { selectedCards: Card[]; selection: SelectionApi }) {
  const apply = (cards: Card[]) => selection.setOrder(cards.map((c) => c.id));
  const disabled = selectedCards.length < 2;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => apply(sortCards(selectedCards, 'number'))}>
        번호순
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => apply(sortCards(selectedCards, 'name'))}>
        이름순
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => apply(sortCards(selectedCards, 'order'))}>
        갤러리 순서
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => apply([...selectedCards].reverse())}>
        순서 뒤집기
      </Button>
    </div>
  );
}

/** 이미지 저장 시 줄바꿈을 한 번에 넣거나 지우는 버튼 */
export function BreakTools({ selectedCards, selection }: { selectedCards: Card[]; selection: SelectionApi }) {
  const count = selectedCards.filter((c, i) => i < selectedCards.length - 1 && selection.breakSet.has(c.id)).length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant="soft"
        disabled={selectedCards.length < 2}
        onClick={() => {
          const sorted = sortForSets(selectedCards);
          selection.setOrder(sorted.map((c) => c.id));
          selection.setBreakList(autoSetBreaks(sorted));
        }}
        title="번호순으로 정리한 뒤 세트마다 줄을 바꿔요"
      >
        ↵ 세트별 정리
      </Button>
      <Button size="sm" variant="secondary" disabled={count === 0} onClick={() => selection.setBreakList([])}>
        줄바꿈 모두 지우기
      </Button>
      {count > 0 && <span className="text-xs text-ink-soft">줄바꿈 {count}개</span>}
    </div>
  );
}
