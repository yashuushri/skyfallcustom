import { WordPack } from './types';

const DB_NAME = 'spyfall_custom_local_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_packs';

export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getLocalCustomPacks(): Promise<WordPack[]> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB error, falling back to localStorage:', error);
    const saved = localStorage.getItem('spyfall_local_custom_packs');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveLocalCustomPack(pack: WordPack): Promise<void> {
  try {
    const db = await initIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(pack);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB error saving pack:', error);
  }
  
  // Sync fallback
  try {
    const packs = await getLocalCustomPacks().catch(() => []);
    const idx = packs.findIndex(p => p.id === pack.id);
    if (idx > -1) {
      packs[idx] = pack;
    } else {
      packs.push(pack);
    }
    localStorage.setItem('spyfall_local_custom_packs', JSON.stringify(packs));
  } catch (e) {
    console.error(e);
  }
}

export async function deleteLocalCustomPack(id: string): Promise<void> {
  try {
    const db = await initIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB error deleting pack:', error);
  }
  
  try {
    const packs = await getLocalCustomPacks().catch(() => []);
    const updated = packs.filter(p => p.id !== id);
    localStorage.setItem('spyfall_local_custom_packs', JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
}

export async function saveAllLocalCustomPacks(packs: WordPack[]): Promise<void> {
  try {
    const db = await initIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        if (packs.length === 0) {
          resolve();
          return;
        }
        let count = 0;
        packs.forEach(pack => {
          const req = store.add(pack);
          req.onsuccess = () => {
            count++;
            if (count === packs.length) {
              resolve();
            }
          };
          req.onerror = () => reject(req.error);
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  } catch (error) {
    console.error('IndexedDB error saving all packs:', error);
  }
  
  try {
    localStorage.setItem('spyfall_local_custom_packs', JSON.stringify(packs));
  } catch (e) {
    console.error(e);
  }
}
