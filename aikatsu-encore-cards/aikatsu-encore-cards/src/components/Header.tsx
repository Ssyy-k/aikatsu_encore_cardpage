import type { TabKey } from '../types';
import { GridIcon, HeartIcon, ImageIcon, SettingsIcon, SparkleIcon } from './icons';
import { cx } from '../lib/utils';

interface Props {
  tab: TabKey;
  onTab: (tab: TabKey) => void;
  selectedCount: number;
}

const TABS: { key: TabKey; label: string; short: string; icon: typeof GridIcon }[] = [
  { key: 'gallery', label: '카드 갤러리', short: '갤러리', icon: GridIcon },
  { key: 'selected', label: '선택 카드', short: '선택', icon: HeartIcon },
  { key: 'sheet', label: '이미지 저장', short: '저장', icon: ImageIcon },
  { key: 'admin', label: '카드 관리', short: '관리', icon: SettingsIcon },
];

export function Header({ tab, onTab, selectedCount }: Props) {
  return (
    <>
    <header className="relative">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 pt-6 pb-4 sm:px-6 sm:pt-10 sm:pb-6">
        <button type="button" onClick={() => onTab('gallery')} className="group min-w-0 text-left">
          <h1 className="brand-title flex items-center gap-2 text-[26px] leading-none font-black tracking-tight sm:text-4xl lg:text-5xl">
            AIKATSU ENCORE!
            <SparkleIcon size={22} className="shrink-0 text-blush-300 sm:size-7" />
          </h1>
          <p className="mt-1.5 text-[11px] font-bold tracking-[0.42em] text-lilac-500 sm:mt-2 sm:text-sm">CARD COLLECTION</p>
        </button>
        <button
          type="button"
          onClick={() => onTab('admin')}
          className={cx(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition touch-manipulation sm:px-4',
            tab === 'admin'
              ? 'bg-lilac-500 text-white ring-lilac-500'
              : 'bg-white/80 text-lilac-600 ring-lilac-200 hover:bg-white hover:ring-lilac-300',
          )}
          aria-label="관리자 화면으로 이동"
        >
          <SettingsIcon size={17} />
          <span>관리</span>
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13px] leading-relaxed text-ink-soft ring-1 ring-blush-100 sm:text-sm">
          <span className="font-bold text-blush-600">판매 중인 카드 목록</span>이에요. 갖고 싶은 카드를 눌러 선택한 뒤,{' '}
          <span className="font-semibold text-ink">이미지 저장</span>에서 한 장의 이미지로 저장해 보내 주세요.
        </p>
      </div>
    </header>

      <nav
        className="sticky top-0 z-30 mt-4 border-b border-blush-100/80 bg-[#fff7fb]/85 backdrop-blur-md"
        aria-label="화면 이동"
      >
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:px-6">
          {TABS.map(({ key, label, short, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTab(key)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition touch-manipulation sm:flex-none sm:px-5',
                  active ? 'bg-white text-blush-600 shadow-sm ring-1 ring-blush-200' : 'text-ink-soft hover:bg-white/60 hover:text-blush-600',
                )}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
                {key === 'selected' && selectedCount > 0 && (
                  <span className="ml-0.5 min-w-5 rounded-full bg-blush-500 px-1.5 py-0.5 text-center text-[11px] leading-none font-bold text-white">
                    {selectedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
