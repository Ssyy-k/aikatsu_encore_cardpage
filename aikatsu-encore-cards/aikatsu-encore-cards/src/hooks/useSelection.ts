import { useCallback, useEffect, useMemo, useState } from 'react';
import { moveItem } from '../lib/utils';
import { readStorage, writeStorage } from './useLocalStorage';

const STORAGE_KEY = 'aikatsu-encore.selection.v1';

/**
 * 선택한 카드 id 목록(= 이미지 시트 배치 순서)을 관리하고 LocalStorage에 유지합니다.
 * @param validIds 카드 로드가 끝나면 전달 — 삭제된 카드를 선택 목록에서 정리합니다.
 */
export function useSelection(validIds: string[] | null) {
  const [selected, setSelected] = useState<string[]>(() => {
    const v = readStorage<unknown>(STORAGE_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  });

  useEffect(() => writeStorage(STORAGE_KEY, selected), [selected]);

  // 다른 탭에서 선택을 바꾸면 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const v = JSON.parse(e.newValue);
        if (Array.isArray(v)) setSelected(v.filter((x): x is string => typeof x === 'string'));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!validIds) return;
    const valid = new Set(validIds);
    setSelected((prev) => {
      const next = prev.filter((id, i) => valid.has(id) && prev.indexOf(id) === i);
      return next.length === prev.length ? prev : next;
    });
  }, [validIds]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const set = new Set(prev);
      const add = ids.filter((id) => !set.has(id));
      return add.length ? [...prev, ...add] : prev;
    });
  }, []);

  const deselectMany = useCallback((ids: string[]) => {
    const remove = new Set(ids);
    setSelected((prev) => prev.filter((id) => !remove.has(id)));
  }, []);

  const clear = useCallback(() => setSelected([]), []);

  const move = useCallback((id: string, delta: number) => {
    setSelected((prev) => {
      const from = prev.indexOf(id);
      if (from < 0) return prev;
      return moveItem(prev, from, from + delta);
    });
  }, []);

  const moveTo = useCallback((id: string, targetId: string) => {
    setSelected((prev) => {
      const from = prev.indexOf(id);
      const to = prev.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      return moveItem(prev, from, to);
    });
  }, []);

  const setOrder = useCallback((ids: string[]) => setSelected(ids), []);

  return { selected, selectedSet, toggle, selectMany, deselectMany, clear, move, moveTo, setOrder };
}

export type SelectionApi = ReturnType<typeof useSelection>;
