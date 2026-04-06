import type { FundData } from "./fund-types"

const DB_NAME = "fund-discovery"
const DB_VERSION = 1
const STORE_NAME = "funds"
const META_STORE = "meta"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "ticker" })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveFunds(funds: FundData[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORE_NAME, META_STORE], "readwrite")
  const store = tx.objectStore(STORE_NAME)
  const meta = tx.objectStore(META_STORE)

  // Clear existing data
  store.clear()

  for (const fund of funds) {
    store.put(fund)
  }

  meta.put({ key: "lastUpdated", value: new Date().toISOString() })
  meta.put({ key: "fundCount", value: funds.length })

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

