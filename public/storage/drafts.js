let database;
export function openDb() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('shosholoza-local', 1);
    request.onupgradeneeded = () => {
      for (const name of ['drafts', 'state', 'events', 'metrics']) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
export async function get(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function entries(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function put(store, key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Storage transaction failed'));
  });
}
export async function persistJourney(snapshot, events = [], stateKey = 'journey') {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['state', 'events'], 'readwrite');
    tx.objectStore('state').put(snapshot, stateKey);
    for (const event of events) tx.objectStore('events').put(event, crypto.randomUUID());
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Journey could not be saved'));
  });
}
export async function measure(name, ms, details = {}) {
  await put('metrics', crypto.randomUUID(), { name, ms, at: new Date().toISOString(), ...details });
}
