import type { Card, SortKey } from '../types';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.test(file.name);
}

/** crypto.randomUUID는 https/localhost에서만 동작하므로 대체 구현을 함께 둡니다. */
export function createId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}:${rand}`;
}

/**
 * 파일명에서 기본 카드 이름/번호를 만듭니다.
 * "번호_이름.jpg" 형식이면 번호와 이름을 나누고, 아니면 파일명 전체를 이름으로 씁니다.
 */
export function parseFileName(fileName: string): { name: string; number: string } {
  const stem = fileName.replace(/\.[^.]+$/, '').trim();
  const match = stem.match(/^([^_\s]+)_(.+)$/);
  if (match) {
    const [, maybeNumber, rest] = match;
    const looksLikeNumber = /^[A-Za-z]{0,6}[-#]?\d[\w-]*$/.test(maybeNumber) && maybeNumber.length <= 16;
    const restIsOnlyDigits = /^[\d_\-\s]+$/.test(rest);
    if (looksLikeNumber && !restIsOnlyDigits) {
      return { number: maybeNumber, name: rest.replace(/_/g, ' ').trim() };
    }
  }
  return { number: '', name: stem || '이름 없는 카드' };
}

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

export function compareText(a: string, b: string): number {
  // 빈 값은 항상 뒤로
  if (!a && b) return 1;
  if (a && !b) return -1;
  return collator.compare(a, b);
}

export function sortCards(cards: Card[], key: SortKey, desc = false): Card[] {
  const sorted = [...cards].sort((a, b) => {
    switch (key) {
      case 'number':
        return compareText(a.number, b.number) || compareText(a.name, b.name) || a.order - b.order;
      case 'name':
        return compareText(a.name, b.name) || compareText(a.number, b.number) || a.order - b.order;
      case 'recent':
        return b.createdAt - a.createdAt || a.order - b.order;
      case 'order':
      default:
        return a.order - b.order || a.createdAt - b.createdAt;
    }
  });
  return desc ? sorted.reverse() : sorted;
}

export function matchesQuery(card: Card, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return true;
  const hay = `${card.number} ${card.name}`.toLowerCase();
  if (hay.includes(q)) return true;
  // 공백/하이픈 차이를 무시한 비교 ("ae01 001" ↔ "AE01-001")
  const strip = (s: string) => s.replace(/[\s\-_#.]/g, '');
  return strip(hay).includes(strip(q));
}

export function cardLabel(card: Pick<Card, 'name' | 'number'>): string {
  return card.number ? `${card.number} ${card.name}` : card.name;
}

export function todayStamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
