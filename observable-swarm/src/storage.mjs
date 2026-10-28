let database;
async function db() {
  if(database)return database;
  database=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('synthia-observatory',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });return database;
}
export async function saveSnapshot(snapshot,key='manual') {
  const database=await db();
  await new Promise((resolve,reject)=>{
    const tx=database.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(snapshot,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Save aborted'));
  });
}
export async function loadSnapshot(key='manual') {
  const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('snapshots','readonly'),request=tx.objectStore('snapshots').get(key);
    request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);
  });
}
