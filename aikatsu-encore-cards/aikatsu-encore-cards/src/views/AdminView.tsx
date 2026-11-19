import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Card, PendingUpload } from '../types';
import type { CardsApi } from '../hooks/useCards';
import { CardImage } from '../components/CardImage';
import { Button, ConfirmDialog, EmptyState, Panel } from '../components/ui';
import {
  CardIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GripIcon,
  ImageIcon,
  PencilIcon,
  RefreshIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '../components/icons';
import { useToast } from '../components/Toast';
import { ACCEPT_ATTR, createId, cx, formatBytes, isAcceptedImage, matchesQuery, moveItem, parseFileName } from '../lib/utils';

interface Props {
  api: CardsApi;
}

export function AdminView({ api }: Props) {
  const { cards, loaded, dbError } = api;
  return (
    <div className="space-y-5">
      {dbError && (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">{dbError}</div>
      )}
      <UploadSection api={api} />
      <ManageSection api={api} cards={cards} loaded={loaded} />
      <StorageInfo count={cards.length} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 카드 추가
// ═══════════════════════════════════════════════════════════

function UploadSection({ api }: { api: CardsApi }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    const accepted = files.filter(isAcceptedImage);
    const rejected = files.length - accepted.length;
    if (rejected > 0) toast(`JPG, JPEG, PNG, WEBP 파일만 등록할 수 있어요. (${rejected}개 제외)`, 'error');
    if (!accepted.length) return;
    const next = accepted.map<PendingUpload>((file) => {
      const parsed = parseFileName(file.name);
      return {
        key: createId('pending'),
        file,
        previewUrl: URL.createObjectURL(file),
        name: parsed.name,
        number: parsed.number,
      };
    });
    setPending((prev) => [...prev, ...next]);
  };

  const removePending = (key: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const clearPending = () => {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
  };

  const updatePending = (key: string, patch: Partial<Pick<PendingUpload, 'name' | 'number'>>) =>
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!pending.length || saving) return;
    setSaving({ done: 0, total: pending.length });
    try {
      const result = await api.addCards(
        pending.map((p) => ({ file: p.file, name: p.name, number: p.number })),
        (done, total) => setSaving({ done, total }),
      );
      clearPending();
      if (result.failed.length) {
        toast(`${result.added}장 등록 · ${result.failed.length}장은 이미지를 읽지 못했어요: ${result.failed.join(', ')}`, 'error');
      } else {
        toast(`카드 ${result.added}장을 등록했어요`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '카드를 저장하지 못했어요.', 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink">카드 추가</h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">여러 장을 한 번에 올릴 수 있어요 · JPG, JPEG, PNG, WEBP</p>
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition sm:py-10',
          dragOver ? 'border-blush-400 bg-blush-50' : 'border-blush-200 bg-gradient-to-b from-white to-blush-50/60 hover:border-blush-300',
        )}
      >
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blush-300 to-lilac-300 text-white shadow">
          <UploadIcon size={22} />
        </span>
        <span className="text-[15px] font-bold text-ink">카드 사진 선택하기</span>
        <span className="mt-1 text-xs text-ink-soft">
          <span className="hidden sm:inline">이곳으로 파일을 끌어다 놓거나 </span>눌러서 컴퓨터·휴대폰의 사진을 고르세요
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {pending.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              등록 대기 <span className="text-blush-600">{pending.length}</span>장
              <span className="ml-2 text-xs font-normal text-ink-soft">비워 두면 파일명이 카드 이름으로 쓰여요</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={clearPending} disabled={!!saving}>
                모두 취소
              </Button>
              <Button size="sm" variant="primary" onClick={save} disabled={!!saving}>
                {saving ? (
                  <>
                    <SpinnerIcon size={14} /> 등록 중 {saving.done}/{saving.total}
                  </>
                ) : (
                  <>
                    <CheckIcon size={14} /> {pending.length}장 등록하기
                  </>
                )}
              </Button>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {pending.map((p) => (
              <li key={p.key} className="relative rounded-2xl bg-white p-2 ring-1 ring-blush-100">
                <CardImage src={p.previewUrl} alt={p.file.name} rounded="rounded-lg" />
                <button
                  type="button"
                  onClick={() => removePending(p.key)}
                  disabled={!!saving}
                  className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow ring-1 ring-blush-100 hover:text-rose-500"
                  aria-label={`${p.file.name} 등록 취소`}
                >
                  <XIcon size={14} />
                </button>
                <div className="mt-2 space-y-1.5">
                  <input
                    value={p.number}
                    onChange={(e) => updatePending(p.key, { number: e.target.value })}
                    placeholder="카드 번호 (선택)"
                    className="input-sm"
                    aria-label="카드 번호"
                  />
                  <input
                    value={p.name}
                    onChange={(e) => updatePending(p.key, { name: e.target.value })}
                    placeholder={parseFileName(p.file.name).name}
                    className="input-sm font-semibold"
                    aria-label="카드 이름"
                  />
                  <p className="truncate px-1 text-[10px] text-ink-soft" title={p.file.name}>
                    {p.file.name} · {formatBytes(p.file.size)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════
// 등록된 카드 관리 (수정 · 삭제 · 순서)
// ═══════════════════════════════════════════════════════════

function ManageSection({ api, cards, loaded }: { api: CardsApi; cards: Card[]; loaded: boolean }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const visible = useMemo(() => cards.filter((c) => matchesQuery(c, query)), [cards, query]);
  const searching = query.trim() !== '';

  // 삭제된 카드 체크 정리
  useEffect(() => {
    setChecked((prev) => {
      const ids = new Set(cards.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [cards]);

  const allChecked = visible.length > 0 && visible.every((c) => checked.has(c.id));
  const toggleAll = () => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) visible.forEach((c) => next.delete(c.id));
      else visible.forEach((c) => next.add(c.id));
      return next;
    });
  };
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api.deleteCards(confirm.ids);
      toast(`카드 ${confirm.ids.length}장을 삭제했어요`);
      setChecked((prev) => {
        const next = new Set(prev);
        confirm.ids.forEach((id) => next.delete(id));
        return next;
      });
      setConfirm(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const reorderTo = useCallback(
    async (ids: string[]) => {
      try {
        await api.reorder(ids);
      } catch (err) {
        toast(err instanceof Error ? err.message : '순서를 저장하지 못했어요.', 'error');
      }
    },
    [api, toast],
  );

  const move = (id: string, delta: number) => {
    const ids = cards.map((c) => c.id);
    const from = ids.indexOf(id);
    reorderTo(moveItem(ids, from, from + delta));
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = cards.map((c) => c.id);
    reorderTo(moveItem(ids, ids.indexOf(dragId), ids.indexOf(targetId)));
  };

  const startReplace = (id: string) => {
    replaceTarget.current = id;
    replaceInput.current?.click();
  };

  const onReplaceFile = async (file: File | undefined) => {
    const id = replaceTarget.current;
    replaceTarget.current = null;
    if (!file || !id) return;
    if (!isAcceptedImage(file)) {
      toast('JPG, JPEG, PNG, WEBP 파일만 사용할 수 있어요.', 'error');
      return;
    }
    setReplacingId(id);
    try {
      await api.replaceImage(id, file);
      toast('카드 이미지를 교체했어요');
    } catch (err) {
      toast(err instanceof Error ? err.message : '이미지를 교체하지 못했어요.', 'error');
    } finally {
      setReplacingId(null);
    }
  };

  const restore = async () => {
    try {
      const n = await api.restoreLocalCards();
      toast(`기본 카드 ${n}장을 복원했어요`);
    } catch (err) {
      toast(err instanceof Error ? err.message : '복원하지 못했어요.', 'error');
    }
  };

  const checkedCount = checked.size;

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink">
            등록된 카드 <span className="text-blush-600">{cards.length}</span>장
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            이름·번호 수정, 이미지 교체, 표시 순서 변경, 삭제를 할 수 있어요.
          </p>
        </div>
        {api.restorableLocalCount > 0 && (
          <Button size="sm" variant="ghost" onClick={restore}>
            <RefreshIcon size={14} /> 삭제한 기본 카드 {api.restorableLocalCount}장 복원
          </Button>
        )}
      </div>

      {!loaded ? (
        <div className="flex justify-center py-10 text-blush-400">
          <SpinnerIcon size={28} />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CardIcon size={28} />}
          title="등록된 카드가 없어요"
          description="위의 ‘카드 추가’에서 판매할 카드 사진을 올려 주세요."
        />
      ) : (
        <>
          {/* 툴바 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">카드 검색</span>
              <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-blush-300" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 번호로 찾기"
                className="h-10 w-full rounded-full border-0 bg-white pr-4 pl-10 text-sm ring-1 ring-blush-100 outline-none focus:ring-2 focus:ring-blush-300"
              />
            </label>
            <div className="flex items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-blush-100 select-none">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="checkbox" />
                {searching ? '검색 결과 전체' : '전체 선택'}
              </label>
              <Button
                variant="danger"
                disabled={checkedCount === 0}
                onClick={() => setConfirm({ ids: [...checked] })}
              >
                <TrashIcon size={16} /> 선택 삭제{checkedCount > 0 && ` (${checkedCount})`}
              </Button>
            </div>
          </div>
          {searching && (
            <p className="mt-2 text-xs text-lilac-600">검색 중에는 순서를 바꿀 수 없어요. 검색어를 지우면 순서를 바꿀 수 있어요.</p>
          )}

          {/* 목록 */}
          <ul className="mt-4 divide-y divide-blush-100 overflow-hidden rounded-2xl bg-white ring-1 ring-blush-100">
            {visible.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-ink-soft">‘{query}’에 맞는 카드가 없어요.</li>
            )}
            {visible.map((card) => {
              const index = cards.indexOf(card);
              return (
                <li
                  key={card.id}
                  draggable={!searching && editingId !== card.id}
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
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOn(card.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={cx(
                    'flex items-center gap-2 px-2 py-2.5 transition sm:gap-3 sm:px-3',
                    checked.has(card.id) && 'bg-blush-50/70',
                    dragId === card.id && 'opacity-40',
                    overId === card.id && dragId !== card.id && 'bg-lilac-50 shadow-[inset_0_2px_0_0_var(--color-lilac-400)]',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(card.id)}
                    onChange={() => toggleOne(card.id)}
                    className="checkbox"
                    aria-label={`${card.name} 선택`}
                  />
                  {!searching && (
                    <span className="hidden cursor-grab text-blush-200 active:cursor-grabbing sm:block" title="끌어서 순서 변경">
                      <GripIcon size={18} />
                    </span>
                  )}
                  <div className="relative w-12 shrink-0 sm:w-14">
                    <CardImage src={card.thumbSrc} alt={card.name} width={card.width} height={card.height} rounded="rounded-md" />
                    {replacingId === card.id && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/70 text-blush-500">
                        <SpinnerIcon size={18} />
                      </div>
                    )}
                  </div>

                  {editingId === card.id ? (
                    <EditForm
                      card={card}
                      onCancel={() => setEditingId(null)}
                      onSave={async (name, number) => {
                        try {
                          await api.updateCard(card.id, { name, number });
                          toast('카드 정보를 수정했어요');
                          setEditingId(null);
                        } catch (err) {
                          toast(err instanceof Error ? err.message : '수정하지 못했어요.', 'error');
                        }
                      }}
                    />
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                          <span className="font-bold text-lilac-500 tabular-nums">#{index + 1}</span>
                          {card.number && <span className="truncate font-semibold text-blush-600">{card.number}</span>}
                          <span
                            className={cx(
                              'shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold',
                              card.source === 'local' ? 'bg-lilac-100 text-lilac-600' : 'bg-blush-100 text-blush-600',
                            )}
                          >
                            {card.source === 'local' ? '기본' : '업로드'}
                          </span>
                        </p>
                        <p className="truncate text-sm font-semibold text-ink">{card.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                        <div className="flex flex-col sm:flex-row">
                          <IconButton label="위로" onClick={() => move(card.id, -1)} disabled={searching || index === 0}>
                            <ChevronUpIcon size={16} />
                          </IconButton>
                          <IconButton label="아래로" onClick={() => move(card.id, 1)} disabled={searching || index === cards.length - 1}>
                            <ChevronDownIcon size={16} />
                          </IconButton>
                        </div>
                        <div className="flex flex-col sm:flex-row">
                          <IconButton label="이름·번호 수정" onClick={() => setEditingId(card.id)}>
                            <PencilIcon size={16} />
                          </IconButton>
                          <IconButton label="이미지 교체" onClick={() => startReplace(card.id)} disabled={replacingId !== null}>
                            <ImageIcon size={16} />
                          </IconButton>
                        </div>
                        <IconButton label="삭제" danger onClick={() => setConfirm({ ids: [card.id] })}>
                          <TrashIcon size={16} />
                        </IconButton>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          onReplaceFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        danger
        busy={deleting}
        title={confirm && confirm.ids.length > 1 ? `카드 ${confirm.ids.length}장을 삭제할까요?` : '이 카드를 삭제할까요?'}
        message={
          <>
            {confirm && confirm.ids.length === 1 && (
              <strong className="mb-1 block text-ink">{cards.find((c) => c.id === confirm.ids[0])?.name}</strong>
            )}
            삭제한 카드는 갤러리와 선택 목록에서도 사라지며 되돌릴 수 없어요.
          </>
        }
        confirmLabel={deleting ? '삭제 중…' : '삭제'}
        onConfirm={doDelete}
        onCancel={() => !deleting && setConfirm(null)}
      />
    </Panel>
  );
}

function EditForm({ card, onSave, onCancel }: { card: Card; onSave: (name: string, number: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(card.name);
  const [number, setNumber] = useState(card.number);
  return (
    <form
      className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name, number);
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="카드 번호"
        className="input-sm sm:w-36"
        aria-label="카드 번호"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="카드 이름"
        className="input-sm flex-1 font-semibold"
        aria-label="카드 이름"
        autoFocus
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          저장
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-full transition touch-manipulation disabled:opacity-30 sm:h-9 sm:w-9',
        danger ? 'text-rose-400 hover:bg-rose-50 hover:text-rose-600' : 'text-ink-soft hover:bg-blush-50 hover:text-blush-600',
      )}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// 저장 공간 안내
// ═══════════════════════════════════════════════════════════

function StorageInfo({ count }: { count: number }) {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && e.quota !== undefined && setUsage({ used: e.usage, quota: e.quota }))
      .catch(() => undefined);
  }, [count]);

  return (
    <div className="rounded-2xl bg-white/60 p-4 text-xs leading-relaxed text-ink-soft ring-1 ring-blush-100">
      <p className="mb-1 font-semibold text-ink">데이터 저장 안내</p>
      <ul className="list-disc space-y-0.5 pl-4">
        <li>업로드한 카드 사진과 정보는 서버가 아닌 <b>이 브라우저(IndexedDB)</b>에 저장돼요. 브라우저를 다시 열어도 유지돼요.</li>
        <li>다른 기기·브라우저에서는 보이지 않아요. 판매용으로 공개하려면 사진을 프로젝트의 <code className="rounded bg-blush-50 px-1">src/assets/cards</code> 폴더에 넣어 배포해 주세요.</li>
        <li>브라우저의 ‘사이트 데이터 삭제’를 하면 업로드한 카드도 함께 지워져요.</li>
        {usage && (
          <li>
            현재 사용량: <b>{formatBytes(usage.used)}</b> / 사용 가능 {formatBytes(usage.quota)}
          </li>
        )}
      </ul>
    </div>
  );
}
