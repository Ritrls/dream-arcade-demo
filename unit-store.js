export async function unitStore(value) {
  const db = await new Promise((resolve,reject) => { const r=indexedDB.open('dream-arcade-unit-library',1);r.onupgradeneeded=()=>r.result.createObjectStore('units');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('单位库暂时被占用。')); });
  try { return await new Promise((resolve,reject) => { const tx=db.transaction('units',value===undefined?'readonly':'readwrite'),store=tx.objectStore('units');if(value===undefined){const r=store.get('library');r.onsuccess=()=>resolve(Array.isArray(r.result)?r.result:[]);r.onerror=()=>reject(r.error);}else{store.put(value,'library');tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);} }); } finally { db.close(); }
}
