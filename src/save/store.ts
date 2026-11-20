import { migrate, type SaveData } from './save';

/**
 * The save lives in IndexedDB, asking the browser to keep it (`navigator.storage.persist`).
 * If storage is unavailable (some private modes), the game still runs, without saving.
 */
const DB_NAME = 'estirpe';
const STORE = 'save';
const KEY = 'dynasty';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let db: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  db ??= open();
  return db;
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return database().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // The browser may refuse; the save still works, it is just less protected.
  }
}

/** Reads the save. Data that cannot be read is set aside, not destroyed, and null is returned. */
export async function loadSave(): Promise<SaveData | null> {
  try {
    const raw = await run('readonly', (s) => s.get(KEY));
    if (raw === undefined) return null;
    const data = migrate(raw);
    if (!data) await run('readwrite', (s) => s.put(raw, `unreadable-${Date.now()}`));
    return data;
  } catch {
    return null;
  }
}

let writing: Promise<unknown> = Promise.resolve();

/** Writes the save; writes are queued so an older one never lands after a newer one. */
export function writeSave(data: SaveData): Promise<void> {
  writing = writing.then(() => run('readwrite', (s) => s.put(data, KEY))).catch(() => undefined);
  return writing.then(() => undefined);
}

export async function deleteSave(): Promise<void> {
  await writing;
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    // Nothing to delete.
  }
}
