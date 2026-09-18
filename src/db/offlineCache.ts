import { Activity, StudentSubmission } from '../types';

const DB_NAME = 'MousaOfflineCache';
const DB_VERSION = 1;

export const STORES = {
  GAMES: 'games',
  OFFLINE_QUEUE: 'offline_sync_queue',
  AUDIO_CLIPS: 'audio_clips',
} as const;

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openMousaOfflineCache(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;

        // 1. مخزن الألعاب والتحديات (Game JSON)
        if (!db.objectStoreNames.contains(STORES.GAMES)) {
          db.createObjectStore(STORES.GAMES, { keyPath: 'id' });
        }

        // 2. مخزن طابور التسليمات عند انقطاع الإنترنت (Offline Sync Queue)
        if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
          db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' });
        }

        // 3. مخزن المقاطع الصوتية المولدة
        if (!db.objectStoreNames.contains(STORES.AUDIO_CLIPS)) {
          db.createObjectStore(STORES.AUDIO_CLIPS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (err) => {
        console.warn('تعذر فتح قاعدة IndexedDB MousaOfflineCache:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('استثناء في فتح IndexedDB:', e);
      resolve(null);
    }
  });

  return dbPromise;
}

// ================= 1. حفظ واسترجاع الألعاب والتحديات محلياً (Game Caching) =================

export async function cacheGameOffline(activity: Activity): Promise<void> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return;

    const tx = db.transaction(STORES.GAMES, 'readwrite');
    const store = tx.objectStore(STORES.GAMES);
    store.put({
      ...activity,
      cachedAt: Date.now()
    });
  } catch (err) {
    console.warn('تعذر حفظ اللعبة في مخزن عدم الاتصال:', err);
  }
}

export async function cacheMultipleGamesOffline(activities: Activity[]): Promise<void> {
  if (!Array.isArray(activities) || activities.length === 0) return;
  try {
    const db = await openMousaOfflineCache();
    if (!db) return;

    const tx = db.transaction(STORES.GAMES, 'readwrite');
    const store = tx.objectStore(STORES.GAMES);
    for (const act of activities) {
      if (act && act.id) {
        store.put({
          ...act,
          cachedAt: Date.now()
        });
      }
    }
  } catch (err) {
    console.warn('تعذر حفظ حزمة الألعاب في التخزين المحلي:', err);
  }
}

export async function getCachedGamesOffline(): Promise<Activity[]> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.GAMES, 'readonly');
        const store = tx.objectStore(STORES.GAMES);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as Activity[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

// ================= 2. طابور التسليمات والمزامنة التلقائية (Offline Sync Queue) =================

export async function enqueueOfflineSubmission(submission: StudentSubmission): Promise<void> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return;

    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    store.put({
      id: submission.id,
      submission,
      queuedAt: new Date().toISOString(),
      retryCount: 0
    });
    console.log('⚡ تم حفظ تسليم الطالب محلياً في طابور عدم الاتصال (Offline Queue):', submission.id);
  } catch (err) {
    console.warn('تعذر إدراج التسليم في طابور عدم الاتصال:', err);
  }
}

export async function getOfflineQueue(): Promise<{ id: string; submission: StudentSubmission; queuedAt: string }[]> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readonly');
        const store = tx.objectStore(STORES.OFFLINE_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return;

    const tx = db.transaction(STORES.OFFLINE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_QUEUE);
    store.delete(id);
  } catch (err) {
    console.warn('تعذر حذف عنصر من طابور المزامنة:', err);
  }
}

/**
 * مزامنة كافة التسليمات المؤجلة فور استعادة الاتصال
 */
export async function syncOfflineSubmissionsQueue(
  uploader: (sub: StudentSubmission) => Promise<boolean>
): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 0;
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  for (const item of queue) {
    try {
      const success = await uploader(item.submission);
      if (success) {
        await removeOfflineQueueItem(item.id);
        syncedCount++;
      }
    } catch (err) {
      console.warn('فشلت مزامنة تسليم مؤجل:', item.id, err);
    }
  }

  if (syncedCount > 0) {
    console.log(`🟢 تمت مزامنة ${syncedCount} تسليماً بنجاح من طابور عدم الاتصال سحابياً!`);
  }
  return syncedCount;
}

// ================= 3. حفظ المقاطع الصوتية في MousaOfflineCache =================

export async function cacheAudioClipOffline(key: string, pcm: Uint8Array): Promise<void> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return;

    const tx = db.transaction(STORES.AUDIO_CLIPS, 'readwrite');
    const store = tx.objectStore(STORES.AUDIO_CLIPS);
    store.put({
      key,
      pcm: pcm.buffer,
      timestamp: Date.now()
    });
  } catch {}
}

export async function getCachedAudioClipOffline(key: string): Promise<Uint8Array | null> {
  try {
    const db = await openMousaOfflineCache();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.AUDIO_CLIPS, 'readonly');
        const store = tx.objectStore(STORES.AUDIO_CLIPS);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.pcm) {
            resolve(new Uint8Array(req.result.pcm));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}
