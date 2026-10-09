import { migrateSave } from './migrations.js';
// Project sites share the same github.io origin: scope the save key to the app's path.
// Root-hosted/local installs intentionally retain the historic 'main' key.
const APP_PATH=new URL('../../',import.meta.url).pathname;
const DB='nightcraft-worlds',STORE='saves',KEY=APP_PATH==='/'?'main':'main@'+APP_PATH, LEGACY=['nightcraft-cold-forest-save-v19','nightcraft-cold-forest-save-v18','nightcraft-cold-forest-save-v17','nightcraft-cold-forest-save-v16','nightcraft-cold-forest-save-v15','nightcraft-cold-forest-save-v14','nightcraft-cold-forest-save-v13','nightcraft-cold-forest-save-v12','nightcraft-cold-forest-save-v11','nightcraft-cold-forest-save-v10','nightcraft-cold-forest-save-v9','nightcraft-cold-forest-save-v8','nightcraft-cold-forest-save-v7','nightcraft-cold-forest-save-v6','nightcraft-cold-forest-save-v5','nightcraft-cold-forest-save-v4','nightcraft-the-hunt-save-v3'];
let dbPromise=null, queue=Promise.resolve();
function openDb(){
  if(!('indexedDB' in globalThis))return Promise.reject(Error('IndexedDB unavailable'));
  return dbPromise??=(new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('IndexedDB open failed'));
  })).catch(e=>{dbPromise=null;throw e});
}
async function transaction(mode,action){
  const db=await openDb();return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),req=action(tx.objectStore(STORE));
    let result;
    req.onsuccess=()=>{result=req.result};
    req.onerror=()=>reject(req.error||Error('IndexedDB operation failed'));
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||Error('IndexedDB transaction failed'));
    tx.onabort=()=>reject(tx.error||Error('IndexedDB aborted'));
  });
}
function legacyRead(storage){
  try {const source=storage??globalThis.localStorage; for(const key of LEGACY){const v=source?.getItem(key);if(v)return v;} }catch{}return null;
}
export async function prefetchSave(){
  let result=null;try{result=await transaction('readonly',store=>store.get(KEY));}catch(e){console.warn('IndexedDB read unavailable, trying legacy save',e);}
  if(result)return typeof result==='string'?result:JSON.stringify(result);
  const old=legacyRead();if(!old)return null;
  try{const migrated=migrateSave(JSON.parse(old));const text=JSON.stringify(migrated);await transaction('readwrite',store=>store.put(text,KEY));return text;}catch(e){console.warn('Legacy save migration unsuccessful; keeping original',e);return old;}
}
export function saveWorld(serialized){
  // Ordered writes; a frame cannot replace a newer save with an older one.
  queue=queue.catch(()=>{}).then(()=>transaction('readwrite',store=>store.put(serialized,KEY)));
  queue.catch(err=>console.warn('IndexedDB save failed',err));return queue;
}
export async function importLegacySave(storage){
  const legacy=legacyRead(storage);if(!legacy)return false;
  try{const old=JSON.parse(legacy);const migrated=migrateSave(old);await saveWorld(JSON.stringify(migrated));return true;}catch(e){console.warn('Legacy migration failed',e);return false;}
}
