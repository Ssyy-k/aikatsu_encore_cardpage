import type { Card } from '../types';
import type { SelectionApi } from '../hooks/useSelection';
import { sortCards } from '../lib/utils';
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
