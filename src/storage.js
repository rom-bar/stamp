// Minimal IndexedDB key-value wrapper.
//
// We store the ENTIRE app state as one JSON string under a single fixed key,
// in one object store. This is much simpler than modeling every entity
// (Child, Reason, StampType, Reward, Award) as its own IndexedDB object
// store, and is entirely adequate for this app's data volume (a family's
// stamp history, not a POS transaction log — contrast with Tokecang, where
// per-entity stores make more sense).
//
// Kept as plain JS (rather than F# emit interop) because IndexedDB's
// callback-based, stateful API (onupgradeneeded/onsuccess/onerror events on
// long-lived request/transaction objects) doesn't translate cleanly to
// Fable's emit interop patterns.

const DB_NAME = "stamp-collector-db";
const STORE_NAME = "appData";
const RECORD_KEY = "main";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => reject(new Error("IndexedDB open failed"));
  });
}

function getRawJson(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(RECORD_KEY);

    request.onsuccess = (event) => {
      const result = event.target.result;
      resolve(result === undefined || result === null ? null : result);
    };
    request.onerror = () => reject(new Error("IndexedDB read failed"));
  });
}

function putRawJson(db, json) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(json, RECORD_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("IndexedDB write failed"));
  });
}

/// Returns the saved JSON string, or null if nothing has been saved yet.
export async function loadRawJson() {
  const db = await openDatabase();
  return await getRawJson(db);
}

/// Persists a JSON string, overwriting whatever was saved before.
export async function saveRawJson(json) {
  const db = await openDatabase();
  await putRawJson(db, json);
}
