import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card, TabKey } from './types';
import { useCards } from './hooks/useCards';
import { useSelection } from './hooks/useSelection';
import { Header } from './components/Header';
import { ToastProvider } from './components/Toast';
import { HeartIcon, ImageIcon } from './components/icons';
import { GalleryView } from './views/GalleryView';
import { SelectedView } from './views/SelectedView';
import { SheetView } from './views/SheetView';
import { AdminView } from './views/AdminView';

const TAB_KEYS: TabKey[] = ['gallery', 'selected', 'sheet', 'admin'];

function readHash(): TabKey {
  const h = window.location.hash.replace('#', '') as TabKey;
  return TAB_KEYS.includes(h) ? h : 'gallery';
}

/** 탭 상태를 URL 해시(#gallery 등)에 저장 → 새로고침·뒤로가기에도 화면 유지 */
function useHashTab() {
  const [tab, setTabState] = useState<TabKey>(readHash);
  useEffect(() => {
    const onHash = () => setTabState(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setTab = useCallback((next: TabKey) => {
    if (next === readHash() && window.location.hash) return;
    window.location.hash = next;
    window.scrollTo({ top: 0 });
  }, []);
  return [tab, setTab] as const;
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

function AppInner() {
  const api = useCards();
  const validIds = useMemo(() => (api.loaded ? api.cards.map((c) => c.id) : null), [api.loaded, api.cards]);
  const selection = useSelection(validIds);
  const [tab, setTab] = useHashTab();

  const selectedCards = useMemo(() => {
    const map = new Map(api.cards.map((c) => [c.id, c]));
    return selection.selected.map((id) => map.get(id)).filter((c): c is Card => !!c);
  }, [api.cards, selection.selected]);

  const showFloatingBar = tab === 'gallery' && selectedCards.length > 0;

  return (
    <div className="min-h-dvh">
      <Header tab={tab} onTab={setTab} selectedCount={selectedCards.length} />

      <main className={`mx-auto max-w-7xl px-3 pt-5 sm:px-6 sm:pt-6 ${showFloatingBar ? 'pb-32' : 'pb-16'}`}>
        {api.dbError && tab !== 'admin' && (
          <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">{api.dbError}</div>
        )}
        {tab === 'gallery' && (
          <GalleryView cards={api.cards} loaded={api.loaded} selection={selection} onGoAdmin={() => setTab('admin')} />
        )}
        {tab === 'selected' && (
          <SelectedView
            selectedCards={selectedCards}
            selection={selection}
            onGoGallery={() => setTab('gallery')}
            onGoSheet={() => setTab('sheet')}
          />
        )}
        {tab === 'sheet' && (
          <SheetView
            selectedCards={selectedCards}
            selection={selection}
            onGoGallery={() => setTab('gallery')}
            onGoSelected={() => setTab('selected')}
          />
        )}
        {tab === 'admin' && <AdminView api={api} />}
      </main>

      {showFloatingBar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 rounded-full bg-white/95 p-1.5 pl-5 shadow-[0_10px_40px_-10px_rgba(200,70,140,0.55)] ring-1 ring-blush-200 backdrop-blur">
            <p className="flex-1 truncate text-sm text-ink">
              <strong className="text-blush-600">{selectedCards.length}장</strong> 선택됨
            </p>
            <button
              type="button"
              onClick={() => setTab('selected')}
              className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-blush-600 hover:bg-blush-50 touch-manipulation"
            >
              <HeartIcon size={16} /> 선택 보기
            </button>
            <button
              type="button"
              onClick={() => setTab('sheet')}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-blush-400 to-lilac-400 px-4 text-sm font-bold text-white shadow touch-manipulation"
            >
              <ImageIcon size={16} /> 이미지 저장
            </button>
          </div>
        </div>
      )}

      <footer className="pb-8 text-center text-[11px] tracking-widest text-lilac-400">AIKATSU ENCORE! · CARD COLLECTION</footer>
    </div>
  );
}
