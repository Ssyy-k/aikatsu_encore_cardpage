import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Card, LabelMode, SheetSettings } from '../types';
import type { SelectionApi } from '../hooks/useSelection';
import { useLocalStorageState } from '../hooks/useLocalStorage';
import { OrderTools } from '../components/OrderTools';
import { Button, EmptyState, Panel, Segmented } from '../components/ui';
import { CheckIcon, DownloadIcon, GridIcon, HeartIcon, ImageIcon, RefreshIcon, SpinnerIcon } from '../components/icons';
import { useToast } from '../components/Toast';
import {
  BACKGROUND_PRESETS,
  DEFAULT_SHEET,
  computeLayout,
  downloadBlob,
  drawSheet,
  exportLimits,
  loadImages,
  metricFor,
  renderSheetBlob,
  sheetFileName,
  type ExportPhase,
  type ImageCache,
} from '../lib/sheet';
import { cx } from '../lib/utils';

interface Props {
  selectedCards: Card[];
  selection: SelectionApi;
  onGoGallery: () => void;
  onGoSelected: () => void;
}

function validateSettings(v: SheetSettings): SheetSettings {
  const s = { ...DEFAULT_SHEET, ...(v && typeof v === 'object' ? v : {}) };
  if (![3, 4, 5, 6].includes(s.columns)) s.columns = 4;
  if (!['none', 'name', 'number', 'both'].includes(s.labelMode)) s.labelMode = 'none';
  if (typeof s.background !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.background)) s.background = '#ffffff';
  s.gap = Math.min(120, Math.max(0, Number(s.gap) || 0));
  s.padding = Math.min(160, Math.max(0, Number(s.padding) || 0));
  return s;
}

const PHASE_LABEL: Record<ExportPhase, string> = {
  load: '원본 이미지 불러오는 중',
  draw: '카드 배치하는 중',
  encode: 'PNG 파일 만드는 중',
};

export function SheetView({ selectedCards, selection, onGoGallery, onGoSelected }: Props) {
  const toast = useToast();
  const [settings, setSettings] = useLocalStorageState<SheetSettings>('aikatsu-encore.sheet.v2', DEFAULT_SHEET, validateSettings);
  const update = <K extends keyof SheetSettings>(key: K, value: SheetSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // ── 미리보기 ─────────────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<ImageCache>(new Map());
  const [wrapW, setWrapW] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [info, setInfo] = useState<{ width: number; height: number; downscaled: boolean; cols: number; rows: number; missing: number } | null>(null);

  const itemsKey = useMemo(
    () => selectedCards.map((c) => `${c.id}|${c.thumbSrc}|${c.name}|${c.number}`).join('\n'),
    [selectedCards],
  );
  const itemsRef = useRef(selectedCards);
  itemsRef.current = selectedCards;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width / 40) * 40;
      setWrapW((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedCards.length > 0]);

  useEffect(() => {
    const items = itemsRef.current;
    if (!items.length || !wrapW) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewBusy(true);
      try {
        const images = await loadImages(
          items.map((i) => i.thumbSrc),
          cacheRef.current,
          (done, total) => setLoadProgress(done < total ? { done, total } : null),
          ctrl.signal,
        );
        const metrics = items.map((it, i) => metricFor(it, images[i]));
        const exp = computeLayout(metrics, settings, exportLimits());
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const layout = computeLayout(metrics, settings, { mode: 'preview', fitWidth: Math.min(wrapW * dpr, 2400) });
        const off = document.createElement('canvas');
        await drawSheet(off, layout, items, images, metrics, settings, { signal: ctrl.signal });
        const visible = canvasRef.current;
        if (visible && !ctrl.signal.aborted) {
          visible.width = off.width;
          visible.height = off.height;
          visible.getContext('2d')?.drawImage(off, 0, 0);
          setPreviewReady(true);
        }
        off.width = off.height = 0;
        setInfo({
          width: exp.outWidth,
          height: exp.outHeight,
          downscaled: exp.downscaled,
          cols: exp.cols,
          rows: exp.rows,
          missing: images.filter((im) => !im).length,
        });
      } catch (err) {
        if ((err as DOMException)?.name !== 'AbortError') console.error(err);
      } finally {
        if (!ctrl.signal.aborted) {
          setPreviewBusy(false);
          setLoadProgress(null);
        }
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [itemsKey, settings, wrapW]);

  // 사용하지 않는 미리보기 이미지 캐시 정리
  useEffect(() => {
    const used = new Set(selectedCards.map((c) => c.thumbSrc));
    for (const key of cacheRef.current.keys()) if (!used.has(key)) cacheRef.current.delete(key);
  }, [selectedCards]);

  // ── 다운로드 ─────────────────────────────────────────────
  const [exporting, setExporting] = useState<{ phase: ExportPhase; done: number; total: number } | null>(null);

  const handleDownload = async () => {
    if (!selectedCards.length || exporting) return;
    setExporting({ phase: 'load', done: 0, total: selectedCards.length });
    try {
      const result = await renderSheetBlob(selectedCards, settings, (phase, done, total) =>
        setExporting({ phase, done, total }),
      );
      downloadBlob(result.blob, sheetFileName());
      toast(`이미지를 저장했어요 · ${result.width.toLocaleString()}×${result.height.toLocaleString()}px`);
    } catch (err) {
      toast(err instanceof Error ? err.message : '이미지를 만들지 못했어요.', 'error');
    } finally {
      setExporting(null);
    }
  };

  if (selectedCards.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon size={28} />}
        title="저장할 카드를 먼저 선택해 주세요"
        description="카드 갤러리에서 카드를 선택하면, 선택한 카드들을 한 장의 이미지로 만들어 저장할 수 있어요."
        action={
          <>
            <Button variant="primary" onClick={onGoGallery}>
              <GridIcon size={17} /> 카드 고르러 가기
            </Button>
            <Button variant="secondary" disabled>
              <DownloadIcon size={17} /> PNG 다운로드
            </Button>
          </>
        }
      />
    );
  }

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SHEET);
  const exportPercent = exporting ? Math.round((exporting.done / Math.max(1, exporting.total)) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* ── 설정 ─────────────────────── */}
      <Panel className="space-y-6 lg:sticky lg:top-20">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">저장 설정</h2>
          <button
            type="button"
            onClick={() => setSettings(DEFAULT_SHEET)}
            disabled={isDefault}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-blush-600 disabled:opacity-40"
          >
            <RefreshIcon size={14} /> 기본값
          </button>
        </div>

        <Field label="한 줄에 표시할 카드 수">
          <Segmented
            label="한 줄에 표시할 카드 수"
            value={settings.columns}
            onChange={(v) => update('columns', v)}
            options={[3, 4, 5, 6].map((n) => ({ value: n as SheetSettings['columns'], label: `${n}장` }))}
          />
        </Field>

        <Field label="카드 간격" value={`${settings.gap}`}>
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={settings.gap}
            onChange={(e) => update('gap', Number(e.target.value))}
            className="range w-full"
            aria-label="카드 간격"
          />
        </Field>

        <Field label="바깥 여백" value={`${settings.padding}`}>
          <input
            type="range"
            min={0}
            max={160}
            step={4}
            value={settings.padding}
            onChange={(e) => update('padding', Number(e.target.value))}
            className="range w-full"
            aria-label="바깥 여백"
          />
        </Field>

        <Field label="배경색">
          <div className="flex flex-wrap items-center gap-2">
            {BACKGROUND_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                aria-label={`배경색 ${p.label}`}
                aria-pressed={settings.background.toLowerCase() === p.value}
                onClick={() => update('background', p.value)}
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 transition touch-manipulation',
                  settings.background.toLowerCase() === p.value && 'ring-[3px] ring-blush-400 ring-offset-2',
                )}
                style={{ background: p.value }}
              >
                {settings.background.toLowerCase() === p.value && (
                  <CheckIcon size={14} className={p.value === '#111111' ? 'text-white' : 'text-blush-500'} />
                )}
              </button>
            ))}
            <label
              className="relative flex h-9 items-center gap-1.5 rounded-full bg-white pr-3 pl-1 text-xs font-semibold text-ink-soft ring-1 ring-blush-200 hover:ring-blush-300"
              title="직접 선택"
            >
              <span className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ background: settings.background }} />
              직접 선택
              <input
                type="color"
                value={settings.background}
                onChange={(e) => update('background', e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="배경색 직접 선택"
              />
            </label>
          </div>
        </Field>

        <Field label="카드 이름·번호 표시">
          <Segmented<LabelMode>
            label="카드 이름·번호 표시"
            value={settings.labelMode}
            onChange={(v) => update('labelMode', v)}
            options={[
              { value: 'none', label: '안 함' },
              { value: 'name', label: '이름' },
              { value: 'number', label: '번호' },
              { value: 'both', label: '둘 다' },
            ]}
          />
        </Field>

        <Field label="카드 배치 순서">
          <OrderTools selectedCards={selectedCards} selection={selection} />
          <button
            type="button"
            onClick={onGoSelected}
            className="mt-2 text-xs font-semibold text-lilac-600 underline-offset-2 hover:underline"
          >
            선택 카드 화면에서 한 장씩 순서 바꾸기 →
          </button>
        </Field>

        {/* 다운로드 */}
        <div className="space-y-3 border-t border-blush-100 pt-5">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleDownload}
            disabled={selectedCards.length === 0 || !!exporting}
          >
            {exporting ? (
              <>
                <SpinnerIcon size={18} /> 이미지 생성 중…
              </>
            ) : (
              <>
                <DownloadIcon size={19} /> PNG 다운로드
              </>
            )}
          </Button>
          {exporting && (
            <div aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-blush-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blush-400 to-lilac-400 transition-[width] duration-200"
                  style={{ width: `${exporting.phase === 'encode' ? 100 : exportPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-xs text-ink-soft">
                {PHASE_LABEL[exporting.phase]}
                {exporting.phase !== 'encode' && ` (${exporting.done}/${exporting.total})`}
              </p>
            </div>
          )}
          <p className="text-center text-[11px] break-all text-ink-soft">파일명: {sheetFileName()}</p>
        </div>
      </Panel>

      {/* ── 미리보기 ─────────────────────── */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-ink">미리보기</h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">설정을 바꾸면 바로 반영돼요. 저장되는 이미지와 같은 모습이에요.</p>
          </div>
          {previewBusy && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lilac-500">
              <SpinnerIcon size={14} />
              {loadProgress ? `이미지 불러오는 중 ${loadProgress.done}/${loadProgress.total}` : '업데이트 중'}
            </span>
          )}
        </div>

        <div className="checker rounded-3xl p-3 ring-1 ring-blush-100 sm:p-5">
          <div ref={wrapRef} className="relative w-full">
            <canvas
              ref={canvasRef}
              className={cx(
                'block h-auto w-full rounded-md shadow-[0_10px_30px_-12px_rgba(120,60,130,0.35)] transition-opacity',
                previewReady ? 'opacity-100' : 'opacity-0',
              )}
              aria-label={`선택한 카드 ${selectedCards.length}장의 이미지 미리보기`}
            />
            {!previewReady && (
              <div className="absolute inset-0 flex min-h-48 items-center justify-center">
                <SpinnerIcon size={28} className="text-blush-400" />
              </div>
            )}
          </div>
        </div>

        {info && (
          <div className="grid gap-2 rounded-2xl bg-white/80 p-4 text-sm ring-1 ring-blush-100 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blush-100 text-blush-600">
                <CheckIcon size={13} />
              </span>
              선택한 카드 <strong className="text-blush-600">{selectedCards.length}장</strong>이 모두 포함돼 있어요
            </p>
            <p className="text-ink-soft sm:text-right">
              {info.cols}열 × {info.rows}행 · 저장 크기{' '}
              <strong className="text-ink">
                {info.width.toLocaleString()} × {info.height.toLocaleString()}px
              </strong>
            </p>
            {info.missing > 0 && (
              <p className="text-xs text-rose-600 sm:col-span-2">
                {info.missing}장의 이미지를 불러오지 못해 ‘이미지 없음’으로 표시돼요. 관리 화면에서 이미지를 확인해 주세요.
              </p>
            )}
            {info.downscaled && (
              <p className="text-xs text-lilac-600 sm:col-span-2">
                카드가 많아 이 기기에서 만들 수 있는 최대 크기에 맞춰 조금 줄여서 저장돼요. 원본에 가까운 화질이 필요하면 한 줄 카드 수를 늘리거나 나눠서 저장해 주세요.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <HeartIcon size={14} className="text-blush-400" />
          카드 순서를 바꾸고 싶다면 왼쪽의 ‘카드 배치 순서’를 이용해 주세요.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {value !== undefined && (
          <span className="rounded-full bg-blush-50 px-2 py-0.5 text-xs font-bold text-blush-600 tabular-nums">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}
