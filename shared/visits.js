// ==========================
// Робота з IndexedDB (labsDB)
// ==========================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("labs")) {
        db.createObjectStore("labs", { keyPath: "edrpou" });
      }
      if (!db.objectStoreNames.contains("visits")) {
        db.createObjectStore("visits", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("tasks")) {
        db.createObjectStore("tasks", { keyPath: "id" });
      }
    };

    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

function getAllFromDB(storeName) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

function putToDB(storeName, item) {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = e => reject(e.target.error);
  });
}

// ==========================
// Завантаження та збереження
// ==========================
async function loadVisits() {
  return await getAllFromDB("visits");
}

async function saveVisit(visit) {
  if (!visit.id) {
    visit.id = `${visit.labId}_${visit.date}_${Date.now()}`;
  }
  await putToDB("visits", visit);
  return visit;
}

// ==========================
// Оновлення статусу
// ==========================
async function updateVisitStatus(visitId, status) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  v.status = status;
  await saveVisit(v);
}

async function cancelVisit(visitId) {
  await updateVisitStatus(visitId, "відмінено");
}

async function completeVisit(visitId) {
  await updateVisitStatus(visitId, "проведено");
}

async function rescheduleVisit(visitId, newDate) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  v.date = newDate;
  v.status = "перенесено";
  await saveVisit(v);
}

// ==========================
// Створення вручну
// ==========================
async function createManualVisit({ labId, labName, date, devices = [] }) {
  const newVisit = {
    id: `${labId}_${date}_${Date.now()}`,
    labId,
    labName,
    date,
    devices,
    notes: "",
    status: "заплановано"
  };
  await saveVisit(newVisit);
  return newVisit;
}

// ==========================
// Відображення у календарі
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  const visits = await loadVisits();
  const container = document.getElementById("calendar");
  container.innerHTML = "";
  visits.forEach(v => {
    const div = document.createElement("div");
    div.className = "visit-entry";
    div.innerHTML = `📅 ${v.date} ⏰ ${v.time || ""} — Лабораторія: ${v.labName || v.labId} (${v.status})`;
    container.appendChild(div);
  });
});
