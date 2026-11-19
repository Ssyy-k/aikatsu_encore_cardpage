import type { CardRecord } from '../types';

const DB_NAME = 'aikatsu-encore-cards';
const DB_VERSION = 1;
const CARD_STORE = 'cards';
const META_STORE = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CARD_STORE)) {
        db.createObjectStore(CARD_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열 수 없습니다.'));
    request.onblocked = () => reject(new Error('다른 탭에서 데이터베이스를 사용 중입니다. 다른 탭을 닫고 새로고침해 주세요.'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('저장이 취소되었습니다. 저장 공간이 부족할 수 있습니다.'));
  });
}

export async function getAllCards(): Promise<CardRecord[]> {
  const db = await openDB();
  const tx = db.transaction(CARD_STORE, 'readonly');
  return promisify(tx.objectStore(CARD_STORE).getAll() as IDBRequest<CardRecord[]>);
}

export async function putCards(records: CardRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(CARD_STORE, 'readwrite');
  const store = tx.objectStore(CARD_STORE);
  for (const record of records) store.put(record);
  await txDone(tx);
}

export async function deleteCardRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(CARD_STORE, 'readwrite');
  const store = tx.objectStore(CARD_STORE);
  for (const id of ids) store.delete(id);
  await txDone(tx);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readonly');
  const row = await promisify(tx.objectStore(META_STORE).get(key) as IDBRequest<{ key: string; value: T } | undefined>);
  return row?.value;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put({ key, value });
  await txDone(tx);
}
