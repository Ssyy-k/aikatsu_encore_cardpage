import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, CardRecord } from '../types';
import { deleteCardRecords, getAllCards, getMeta, putCards, setMeta } from '../lib/db';
import { localCardFiles, localCardUrlByFile } from '../lib/localCards';

// 기본 카드(폴더 카드)는 항상 파일 이름(카드 번호) 순서로 표시
const localOrder = new Map(localCardFiles.map((f, i) => [f.file, i]));
const UPLOAD_ORDER_BASE = 1_000_000;
import { processImage } from '../lib/image';
import { createId, nextFrame, parseFileName } from '../lib/utils';

const DELETED_LOCAL_KEY = 'deletedLocal';

interface UrlEntry {
  image: Blob;
  thumb?: Blob;
  src: string;
  thumbSrc: string;
  owned: string[];
}

export interface NewCardInput {
  file: File;
  name: string;
  number: string;
}

export interface AddResult {
  added: number;
  failed: string[];
}

function errorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return '브라우저 저장 공간이 부족합니다. 사용하지 않는 카드를 삭제한 뒤 다시 시도해 주세요.';
  }
  return err instanceof Error ? err.message : String(err);
}

function buildLocalRecords(files: string[], startOrder: number): CardRecord[] {
  const now = Date.now();
  return files.map((file, i) => {
    const { name, number } = parseFileName(file);
    return {
      id: `local:${file}`,
      name,
      number,
      order: startOrder + i,
      createdAt: now + i,
      updatedAt: now,
      source: 'local' as const,
      localFile: file,
    };
  });
}

export function useCards() {
  const [records, setRecords] = useState<CardRecord[]>([]);
  const [deletedLocal, setDeletedLocal] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const dbOk = useRef(true);
  const recordsRef = useRef<CardRecord[]>([]);
  recordsRef.current = records;

  // ── 초기 로드: IndexedDB + 로컬 이미지 폴더 ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: CardRecord[] = [];
      let deleted: string[] = [];
      try {
        [stored, deleted] = await Promise.all([
          getAllCards(),
          getMeta<string[]>(DELETED_LOCAL_KEY).then((v) => v ?? []),
        ]);
      } catch (err) {
        dbOk.current = false;
        setDbError(
          `카드 저장소(IndexedDB)를 사용할 수 없어 변경 내용이 저장되지 않습니다. (${errorMessage(err)}) 사생활 보호 모드라면 일반 모드로 열어 주세요.`,
        );
      }
      const knownLocal = new Set(stored.filter((r) => r.localFile).map((r) => r.localFile));
      const deletedSet = new Set(deleted);
      const maxOrder = stored.reduce((m, r) => Math.max(m, r.order), -1);
      const freshFiles = localCardFiles
        .map((f) => f.file)
        .filter((file) => !knownLocal.has(file) && !deletedSet.has(file));
      const fresh = buildLocalRecords(freshFiles, maxOrder + 1);
      if (fresh.length && dbOk.current) {
        try {
          await putCards(fresh);
        } catch {
          /* 표시에는 문제 없음 */
        }
      }
      if (cancelled) return;
      setRecords([...stored, ...fresh]);
      setDeletedLocal(deleted);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 레코드 → 화면용 카드 (Blob URL 캐시 관리) ─────────────────────────
  const urlCache = useRef(new Map<string, UrlEntry>());
  const pendingRevoke = useRef<string[]>([]);

  const cards = useMemo<Card[]>(() => {
    const cache = urlCache.current;
    const seen = new Set<string>();
    const result: Card[] = [];
    for (const r of records) {
      let src: string | null = null;
      let thumbSrc: string | null = null;
      if (r.image) {
        let entry = cache.get(r.id);
        if (!entry || entry.image !== r.image || entry.thumb !== r.thumb) {
          if (entry) pendingRevoke.current.push(...entry.owned);
          const s = URL.createObjectURL(r.image);
          const t = r.thumb ? URL.createObjectURL(r.thumb) : s;
          entry = { image: r.image, thumb: r.thumb, src: s, thumbSrc: t, owned: r.thumb ? [s, t] : [s] };
          cache.set(r.id, entry);
        }
        seen.add(r.id);
        src = entry.src;
        thumbSrc = entry.thumbSrc;
      } else if (r.localFile) {
        const url = localCardUrlByFile.get(r.localFile);
        if (!url) continue; // 폴더에서 파일이 삭제된 기본 카드는 표시하지 않음
        src = thumbSrc = url;
      } else {
        continue;
      }
      result.push({
        id: r.id,
        name: r.name,
        number: r.number,
        order: r.localFile && localOrder.has(r.localFile) ? localOrder.get(r.localFile)! : UPLOAD_ORDER_BASE + r.order,
        createdAt: r.createdAt,
        source: r.source,
        src,
        thumbSrc,
        width: r.width,
        height: r.height,
        version: r.updatedAt,
      });
    }
    for (const [id, entry] of cache) {
      if (!seen.has(id)) {
        pendingRevoke.current.push(...entry.owned);
        cache.delete(id);
      }
    }
    return result.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }, [records]);

  useEffect(() => {
    const list = pendingRevoke.current.splice(0);
    if (list.length === 0) return;
    // 화면에서 새 URL로 교체된 뒤 해제
    const t = setTimeout(() => list.forEach((u) => URL.revokeObjectURL(u)), 1500);
    return () => clearTimeout(t);
  }, [cards]);

  const persist = useCallback(async (recs: CardRecord[]) => {
    if (!dbOk.current) return;
    await putCards(recs);
  }, []);

  // ── 카드 추가 ─────────────────────────────────────────────
  const addCards = useCallback(
    async (inputs: NewCardInput[], onProgress?: (done: number, total: number) => void): Promise<AddResult> => {
      const failed: string[] = [];
      const created: CardRecord[] = [];
      let order = recordsRef.current.reduce((m, r) => Math.max(m, r.order), -1) + 1;
      const now = Date.now();
      for (let i = 0; i < inputs.length; i++) {
        const { file, name, number } = inputs[i];
        try {
          const processed = await processImage(file);
          const image = file.slice(0, file.size, file.type || 'image/jpeg');
          created.push({
            id: createId('card'),
            name: name.trim() || parseFileName(file.name).name,
            number: number.trim(),
            order: order++,
            createdAt: now + i,
            updatedAt: now,
            source: 'upload',
            image,
            thumb: processed.thumb,
            width: processed.width,
            height: processed.height,
          });
        } catch {
          failed.push(file.name);
        }
        onProgress?.(i + 1, inputs.length);
        await nextFrame();
      }
      try {
        await persist(created);
      } catch (err) {
        throw new Error(errorMessage(err));
      }
      setRecords((prev) => [...prev, ...created]);
      if (created.length) navigator.storage?.persist?.().catch(() => undefined);
      return { added: created.length, failed };
    },
    [persist],
  );

  // ── 카드 정보 수정 ─────────────────────────────────────────
  const updateCard = useCallback(
    async (id: string, patch: { name?: string; number?: string }) => {
      const current = recordsRef.current.find((r) => r.id === id);
      if (!current) return;
      const next: CardRecord = {
        ...current,
        name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
        number: patch.number !== undefined ? patch.number.trim() : current.number,
        updatedAt: Date.now(),
      };
      try {
        await persist([next]);
      } catch (err) {
        throw new Error(errorMessage(err));
      }
      setRecords((prev) => prev.map((r) => (r.id === id ? next : r)));
    },
    [persist],
  );

  // ── 카드 이미지 교체 ───────────────────────────────────────
  const replaceImage = useCallback(
    async (id: string, file: File) => {
      const current = recordsRef.current.find((r) => r.id === id);
      if (!current) return;
      const processed = await processImage(file);
      const next: CardRecord = {
        ...current,
        image: file.slice(0, file.size, file.type || 'image/jpeg'),
        thumb: processed.thumb,
        width: processed.width,
        height: processed.height,
        updatedAt: Date.now(),
      };
      try {
        await persist([next]);
      } catch (err) {
        throw new Error(errorMessage(err));
      }
      setRecords((prev) => prev.map((r) => (r.id === id ? next : r)));
    },
    [persist],
  );

  // ── 카드 삭제 ─────────────────────────────────────────────
  const deleteCards = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const targets = recordsRef.current.filter((r) => idSet.has(r.id));
      const localFiles = targets.filter((r) => r.localFile).map((r) => r.localFile as string);
      const nextDeleted = localFiles.length ? Array.from(new Set([...deletedLocal, ...localFiles])) : deletedLocal;
      if (dbOk.current) {
        try {
          await deleteCardRecords(ids);
          if (localFiles.length) await setMeta(DELETED_LOCAL_KEY, nextDeleted);
        } catch (err) {
          throw new Error(errorMessage(err));
        }
      }
      setDeletedLocal(nextDeleted);
      setRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
    },
    [deletedLocal],
  );

  // ── 표시 순서 변경 ─────────────────────────────────────────
  const reorder = useCallback(
    async (orderedIds: string[]) => {
      const position = new Map(orderedIds.map((id, i) => [id, i]));
      const base = orderedIds.length;
      const rest = recordsRef.current
        .filter((r) => !position.has(r.id))
        .sort((a, b) => a.order - b.order);
      rest.forEach((r, i) => position.set(r.id, base + i));
      const changed: CardRecord[] = [];
      const next = recordsRef.current.map((r) => {
        const order = position.get(r.id) ?? r.order;
        if (order === r.order) return r;
        const updated = { ...r, order };
        changed.push(updated);
        return updated;
      });
      setRecords(next);
      try {
        await persist(changed);
      } catch (err) {
        throw new Error(errorMessage(err));
      }
    },
    [persist],
  );

  // ── 삭제한 기본 카드 복원 ───────────────────────────────────
  const restoreLocalCards = useCallback(async () => {
    const existing = new Set(recordsRef.current.map((r) => r.localFile).filter(Boolean));
    const files = deletedLocal.filter((f) => localCardUrlByFile.has(f) && !existing.has(f));
    const maxOrder = recordsRef.current.reduce((m, r) => Math.max(m, r.order), -1);
    const fresh = buildLocalRecords(files, maxOrder + 1);
    if (dbOk.current) {
      await putCards(fresh);
      await setMeta(DELETED_LOCAL_KEY, []);
    }
    setDeletedLocal([]);
    setRecords((prev) => [...prev, ...fresh]);
    return fresh.length;
  }, [deletedLocal]);

  const restorableLocalCount = useMemo(
    () => deletedLocal.filter((f) => localCardUrlByFile.has(f)).length,
    [deletedLocal],
  );

  return {
    cards,
    loaded,
    dbError,
    addCards,
    updateCard,
    replaceImage,
    deleteCards,
    reorder,
    restoreLocalCards,
    restorableLocalCount,
  };
}

export type CardsApi = ReturnType<typeof useCards>;
