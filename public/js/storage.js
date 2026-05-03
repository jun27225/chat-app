const DB_NAME = 'vibe-chat-db';
const DB_VERSION = 1;
let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('threadId', 'threadId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('threads')) {
          db.createObjectStore('threads', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'threadId' });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  return dbPromise;
}

export async function saveMessageToCache(message) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const msgToSave = { ...message, threadId: message.threadId || message.thread_id };
    store.put(msgToSave);
    tx.oncomplete = () => resolve();
    tx.onerror = (err) => reject(err);
  });
}

export async function getMessagesFromCache(threadId, limit = 50) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('threadId');
    const request = index.openCursor(IDBKeyRange.only(threadId), 'prev'); // decending to get last N
    
    const messages = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && messages.length < limit) {
        messages.push(cursor.value);
        cursor.continue();
      } else {
        resolve(messages.reverse()); // reverse to be chronological
      }
    };
    request.onerror = (err) => reject(err);
  });
}

export async function saveThreadsToCache(threads) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('threads', 'readwrite');
    const store = tx.objectStore('threads');
    threads.forEach(t => store.put(t));
    tx.oncomplete = () => resolve();
    tx.onerror = (err) => reject(err);
  });
}

export async function getThreadsFromCache() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('threads', 'readonly');
    const store = tx.objectStore('threads');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (err) => reject(err);
  });
}

export async function saveDraft(threadId, text) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    store.put({ threadId, text });
    tx.oncomplete = () => resolve();
    tx.onerror = (err) => reject(err);
  });
}

export async function getDraft(threadId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readonly');
    const store = tx.objectStore('drafts');
    const request = store.get(threadId);
    request.onsuccess = () => resolve(request.result ? request.result.text : '');
    request.onerror = (err) => reject(err);
  });
}

export async function clearDraft(threadId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    store.delete(threadId);
    tx.oncomplete = () => resolve();
    tx.onerror = (err) => reject(err);
  });
}
