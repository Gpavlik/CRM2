// ==========================
// Глобальні змінні та кеш
// ==========================
let labsCache = [];          // головний кеш лабораторій
let visitsCache = [];        // кеш візитів
let filteredLabs = [];       // відфільтровані лабораторії
let drawnItems;              // глобально для leaflet draw
let map = null;
let markersLayer = null;
const pageSize = 20;
let currentPage = 1;
let labsInPolygon = [];


//==========================
//робота з IndexedDB
//==========================
const DB_NAME = "labsDB";
const DB_VERSION = 3;

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

async function getAllFromDB(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function putToDB(storeName, item) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = event => {
      const db = event.target.result;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      if (storeName === "labs") {
        store.put(item, item.edrpou);
      } else if (storeName === "visits") {
        store.put(item, item.id);
      } else {
        reject("❌ Невідомий store");
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = err => reject(err);
    };
    request.onerror = err => reject(err);
  });
}

async function deleteFromDB(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ==========================
// Ініціалізація кешу
// ==========================
async function initCache() {
  try {
    labsCache = await getAllFromDB("labs");
    visitsCache = await getAllFromDB("visits");
    console.log("✅ Кеш ініціалізовано:", labsCache.length, "лабораторій,", visitsCache.length, "візитів");
  } catch (err) {
    console.error("❌ Помилка при ініціалізації кешу:", err);
    labsCache = [];
    visitsCache = [];
  }
}

async function startLabsRender() {
  await initCache();

  if (labsCache && labsCache.length > 0) {
    renderLabs(labsCache);
    updateMap(labsCache);
    populateFilterOptions(labsCache);
  } else {
    const container = document.getElementById("labsContainer");
    if (container) {
      container.innerHTML = "<p>⚠️ Лабораторій не знайдено у кеші.</p>";
    }
  }
}

startLabsRender();

// ==========================
// Візити
// ==========================
async function loadVisits() {
  visitsCache = await getAllFromDB("visits");
  return visitsCache;
}

async function addVisit(visit) {
  visitsCache.push(visit);
  await putToDB("visits", visit);
  syncVisitsToLabs();
  if (window.rerenderCalendar) window.rerenderCalendar();
}

async function deleteVisit(visitId) {
  visitsCache = visitsCache.filter(v => v.id !== visitId);
  await deleteFromDB("visits", visitId);
  syncVisitsToLabs();
  if (window.rerenderCalendar) window.rerenderCalendar();
}

async function updateVisit(visitId, updates) {
  const idx = visitsCache.findIndex(v => v.id === visitId);
  if (idx !== -1) {
    visitsCache[idx] = { ...visitsCache[idx], ...updates };
    await putToDB("visits", visitsCache[idx]);
    syncVisitsToLabs();
    if (window.rerenderCalendar) window.rerenderCalendar();
  }
}

// ==========================
// Синхронізація візитів з лабораторіями
// ==========================
function syncVisitsToLabs() {
  if (!Array.isArray(labsCache) || !Array.isArray(visitsCache)) return;

  labsCache.forEach(lab => {
    const labVisits = visitsCache.filter(v =>
      String(v.labId).trim() === String(lab.edrpou).trim()
    );

    if (labVisits.length > 0) {
      const validDates = labVisits
        .map(v => new Date(v.date))
        .filter(d => !isNaN(d));

      if (validDates.length > 0) {
        const nextVisit = validDates.sort((a, b) => a - b)[0];
        lab.nextVisit = nextVisit.toISOString();
      } else {
        lab.nextVisit = null;
      }
    } else {
      lab.nextVisit = null;
    }
  });

  updateMap(labsCache);
}

// ==========================
// Фільтри
// ==========================
function applyFilters() {
  try {
    const getVal = id => document.getElementById(id)?.value.trim().toLowerCase() || "";

    const filters = {
      contractor: getVal("contractor"),
      region: getVal("filterRegion"),
      city: getVal("filterCity"),
      institution: getVal("filterInstitution"),
      edrpou: getVal("filterEdrpou"),
      device: getVal("filterDevice"),
      kp: getVal("filterKp"),
      deviceMode: document.getElementById("filterDevices")?.value || "all"
    };

    let filtered = labsCache.filter(l =>
      (!filters.contractor || (l.contractor || "").toLowerCase().includes(filters.contractor)) &&
      (!filters.region || (l.region || "").toLowerCase().includes(filters.region)) &&
      (!filters.city || (l.city || "").toLowerCase().includes(filters.city)) &&
      (!filters.institution || (l.institution || "").toLowerCase().includes(filters.institution)) &&
      (!filters.edrpou || (l.edrpou || "").toLowerCase().includes(filters.edrpou)) &&
      (!filters.device || (Array.isArray(l.devices) && l.devices.some(d => getDeviceName(d).includes(filters.device)))) &&
      (!filters.kp || (Array.isArray(l.devices) && l.devices.some(d => (d.kp || "").toLowerCase().includes(filters.kp))))
    );

    function getDeviceName(d) {
      return (d.device || d.name || d.category || "").toLowerCase();
    }

    if (filters.deviceMode === "with") {
      filtered = filtered.filter(l => l.devices && l.devices.length > 0);
    } else if (filters.deviceMode === "without") {
      filtered = filtered.filter(l => !l.devices || l.devices.length === 0);
    }

    filteredLabs = filtered;
    renderLabs(filteredLabs);
    updateMap(filteredLabs);
    populateFilterOptions(filteredLabs);

  } catch (err) {
    console.error("❌ Помилка при фільтрації:", err);
    alert("⚠️ Не вдалося застосувати фільтри.");
  }
}


// ==========================
// Фільтри
// ==========================
function resetFilters() {
  document.querySelectorAll("#filters input, #filters select").forEach(el => el.value = "");
  const devicesFilter = document.getElementById("filterDevices");
  if (devicesFilter) devicesFilter.value = "all";

  filteredLabs = labsCache;
  renderLabs(filteredLabs);
  updateMap(filteredLabs);
  populateFilterOptions(labsCache);
}

function populateFilterOptions(source = labsCache) {
  const setOptions = (id, values) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.innerHTML = [...new Set(
      values.filter(v => typeof v === "string" && v.trim().length > 2).map(v => v.trim())
    )]
    .map(v => `<option value="${v.replace(/"/g, '&quot;')}">`)
    .join("");
  };

  setOptions("contractor", source.map(l => l.contractor));
  setOptions("regionOptions", source.map(l => l.region));
  setOptions("cityOptions", source.map(l => l.city));
  setOptions("institutionOptions", source.map(l => l.institution));
  setOptions("edrpouOptions", source.map(l => l.edrpou));
  setOptions("managerOptions", source.map(l => l.manager));

  const deviceOptions = document.getElementById("deviceOptions");
  if (deviceOptions) {
    deviceOptions.innerHTML = "";
    const uniqueDevices = new Set();
    source.forEach(lab => (lab.devices || []).forEach(d => {
      if (d.device) uniqueDevices.add(d.device.trim());
      else if (d.category) uniqueDevices.add(d.category.trim());
    }));
    [...uniqueDevices].forEach(val => {
      const option = document.createElement("option");
      option.value = val;
      deviceOptions.appendChild(option);
    });
  }

  const kpOptions = document.getElementById("kpOptions");
  if (kpOptions) {
    kpOptions.innerHTML = "";
    const uniqueKp = new Set();
    source.forEach(lab => (lab.devices || []).forEach(d => {
      if (d.kp) uniqueKp.add(d.kp.trim());
    }));
    [...uniqueKp].forEach(val => {
      const option = document.createElement("option");
      option.value = val;
      kpOptions.appendChild(option);
    });
  }
}

// ==========================
// Рендеринг списку лабораторій
// ==========================
function renderLabs(data) {
  try {
    const container = document.getElementById("labsContainer");
    if (!container) {
      console.warn("⚠️ Контейнер labsContainer не знайдено.");
      return;
    }

    const labs = data || [];
    container.innerHTML = "";

    if (labs.length === 0) {
      container.innerHTML = "<p>⚠️ Лабораторій не знайдено.</p>";
      return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const labsToRender = labs.slice(start, end);

    labsToRender.forEach(lab => {
      const card = document.createElement("div");
      card.className = "lab-card";

      const devicesList = (lab.devices || [])
        .map(d => `${d.device || d.category || "—"}${d.kp ? " (КП: " + d.kp + ")" : ""}`)
        .join(", ") || "—";

      card.innerHTML = `
        <h3>${lab.partner || "—"} [ЄДРПОУ: ${lab.edrpou || "—"}]</h3>
        <p>📍 ${lab.region || "—"}, ${lab.city || "—"}</p>
        <p>📞 ${lab.phone || "—"}</p>
        <p>👤 Контрагент: ${lab.contractor || "—"}</p>
        <p>👤 Менеджер: ${lab.manager || "—"}</p>
        <p>🔬 Прилади: ${devicesList}</p>
        <div class="lab-actions">
          <button onclick="editLabCard('${lab.edrpou}')">✏️ Редагувати</button>  
          <button onclick="deleteLab('${lab.edrpou}')">🗑️ Видалити</button>
          <button onclick="openCreateVisitModal('${lab.edrpou}')">📅 Візит</button>
        </div>
      `;
      container.appendChild(card);
    });

    if (labs.length > pageSize) {
      renderPagination(labs);
    }

  } catch (err) {
    console.error("❌ Помилка при рендерингу лабораторій:", err);
  }
}

// ==========================
// Пагінація
// ==========================
function renderPagination(data = filteredLabs) {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = "";

  const totalPages = Math.ceil(data.length / pageSize);
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "page-btn";
    if (i === currentPage) btn.classList.add("active");

    btn.onclick = () => {
      currentPage = i;
      renderLabs(data);
    };

    pagination.appendChild(btn);
  }
}

// ==========================
// Ініціалізація карти
// ==========================
function initMap() {
  if (map) return;

  map = L.map('map').setView([50.45, 30.52], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: true,
      rectangle: true,
      circle: false,
      marker: false,
      polyline: false
    },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);

    const geojsonLayer = L.geoJSON(layer.toGeoJSON());

    labsInPolygon = labsCache.filter(lab => {
      if (!lab.lat || !lab.lng) return false;
      const point = [lab.lng, lab.lat];
      return leafletPip.pointInLayer(point, geojsonLayer).length > 0;
    });

    console.log("Знайдено лабораторій у полігоні:", labsInPolygon.length);

    if (!labsInPolygon.length) {
      alert("⚠️ У контурі немає лабораторій");
      return;
    }

    openPurchasesModal();
  });
}

function getMarkerColor(nextVisitDateStr) {
  if (!nextVisitDateStr) return "blue";

  const today = new Date();
  const nextVisit = new Date(nextVisitDateStr);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startOfNextWeek = new Date(endOfWeek);
  startOfNextWeek.setDate(endOfWeek.getDate() + 1);
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  if (nextVisit >= startOfWeek && nextVisit <= endOfWeek) return "red";
  if (nextVisit >= startOfNextWeek && nextVisit <= endOfNextWeek) return "yellow";
  if (nextVisit <= endOfMonth) return "green";
  return "blue";
}

// ==========================
// Оновлення карти
// ==========================
function updateMap(labs) {
  if (!map) initMap();
  if (!markersLayer) markersLayer = L.layerGroup().addTo(map);

  markersLayer.clearLayers();

  labs.forEach(lab => {
    if (lab.lat && lab.lng) {
      const color = getMarkerColor(lab.nextVisit);

      const markerIcon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const popupContent = `
        <strong>${lab.partner || "—"}</strong><br>
        Область: ${lab.region || "—"}<br>
        Місто: ${lab.city || "—"}<br>
        ЛПЗ: ${lab.institution || "—"}<br>
        ЄДРПОУ: ${lab.edrpou || "—"}<br>
        Менеджер: ${lab.manager || "—"}<br>
        Наступний візит: ${lab.nextVisit ? new Date(lab.nextVisit).toLocaleDateString("uk-UA") : "—"}<br>
        Прилади: ${(lab.devices || []).map(d => d.device || d.category).join(", ") || "—"}<br>
        КП: ${(lab.devices || []).map(d => d.kp).filter(Boolean).join(", ") || "—"}<br>
        <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
          <button onclick="editLabCard('${lab.edrpou}')">✏️ Редагувати</button>  
          <button onclick="openCreateVisitModal('${lab.edrpou}')">📅 Візит</button>
        </div>
      `;

      L.marker([lab.lat, lab.lng], { icon: markerIcon })
        .addTo(markersLayer)
        .bindPopup(popupContent);
    }
  });
}

// ==========================
// Закупівлі
// ==========================
function openPurchasesModal() {
  renderPurchasesTable(labsInPolygon);
  document.getElementById("purchasesModal").style.display = "block";
}

function sortTable(columnIndex) {
  const table = document.getElementById("purchasesTable");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  const currentDir = table.dataset.sortDir === "asc" ? "desc" : "asc";
  table.dataset.sortDir = currentDir;
  table.dataset.sortCol = columnIndex;

  rows.sort((a, b) => {
    let aText = a.children[columnIndex].innerText.trim();
    let bText = b.children[columnIndex].innerText.trim();

    if (columnIndex === 2) {
      return currentDir === "asc" ? Number(aText) - Number(bText) : Number(bText) - Number(aText);
    }
    if (columnIndex === 3) {
      return currentDir === "asc" ? new Date(aText) - new Date(bText) : new Date(bText) - new Date(aText);
    }
    return currentDir === "asc" ? aText.localeCompare(bText, "uk") : bText.localeCompare(aText, "uk");
  });

  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
  updateSortIcons(columnIndex, currentDir);
}

function updateSortIcons(columnIndex, direction) {
  const headers = document.querySelectorAll("#purchasesTable th");
  headers.forEach((th, i) => {
    const icon = th.querySelector(".sort-icon");
    if (i === columnIndex) {
      icon.textContent = direction === "asc" ? "▲" : "▼";
    } else {
      icon.textContent = "";
    }
  });
}

function renderPurchasesTable(labs) {
  const tbody = document.querySelector("#purchasesTable tbody");
  tbody.innerHTML = "";

  let totalQuantity = 0;
  const labTotals = {};

  labs.forEach(lab => {
    (lab.devices || []).forEach(device => {
      (device.reagents || []).forEach(reagent => {
        const row = `
          <tr>
            <td>${lab.institution || "—"}</td>
            <td>${reagent.name || "—"}</td>
            <td>${reagent.quantity || 0}</td>
            <td>${reagent.date ? new Date(reagent.date).toLocaleDateString("uk-UA") : "—"}</td>
          </tr>
        `;
        tbody.innerHTML += row;

        totalQuantity += reagent.quantity || 0;
        labTotals[lab.institution] = (labTotals[lab.institution] || 0) + (reagent.quantity || 0);
      });
    });
  });

  let summaryHtml = `Загальна кількість закупівель у контурі: ${totalQuantity}<br>`;
  summaryHtml += "По лабораторіях:<br><ul>";
  Object.entries(labTotals).forEach(([lab, qty]) => {
    summaryHtml += `<li>${lab}: ${qty}</li>`;
  });
  summaryHtml += "</ul>";

  document.getElementById("purchasesSummary").innerHTML = summaryHtml;
}

function closePurchasesModal() {
  document.getElementById("purchasesModal").style.display = "none";
}

// ==========================
// Додаткові модалки
// ==========================
function openModal(labs) {
  const tbody = document.querySelector("#modalTable tbody");
  tbody.innerHTML = "";
  labs.forEach(lab => {
    const row = `
      <tr>
        <td>${lab.partner || "—"}</td>
        <td>${lab.city || "—"}</td>
        <td>${lab.institution || "—"}</td>
        <td>${lab.edrpou || "—"}</td>
        <td>${lab.manager || "—"}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
  document.getElementById("mapModal").style.display = "block";
}

function closeModal() {
  document.getElementById("mapModal").style.display = "none";
}

// ==========================
// Видалення лабораторії з кешу IndexedDB
// ==========================
async function deleteLab(edrpou) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;

  await deleteFromDB("labs", edrpou);

  const visits = await getAllFromDB("visits");
  for (const v of visits.filter(v => v.labId === edrpou)) {
    await deleteFromDB("visits", v.id);
  }

  alert("✅ Лабораторію та її візити видалено з IndexedDB");
  labsCache = await getAllFromDB("labs");
  filteredLabs = labsCache;
  renderLabs(filteredLabs);
  updateMap(filteredLabs);
}

// ==========================
// Масова генерація візитів для всіх лабораторій
// ==========================
async function generateAllLabVisits() {
  try {
    if (!Array.isArray(labsCache) || labsCache.length === 0) {
      alert("⚠️ Лабораторій у кеші не знайдено.");
      return;
    }

    let allNewVisits = [];

    for (const lab of labsCache) {
      if (!lab.edrpou) {
        console.warn(`⚠️ У ${lab.partner} немає edrpou`);
        continue;
      }

      const visit = {
        id: `${lab.edrpou}_${Date.now()}`,
        labId: lab.edrpou,
        labName: lab.partner,
        date: new Date().toISOString(),
        tasks: [],
        status: "заплановано"
      };

      allNewVisits.push(visit);
    }

    for (const v of allNewVisits) {
      await addVisit(v); // 🔑 тепер через уніфіковану функцію
    }

    alert(`✅ Згенеровано ${allNewVisits.length} нових візитів, збережено у IndexedDB!`);
  } catch (err) {
    console.error("❌ Помилка при генерації візитів:", err);
    alert("⚠️ Не вдалося згенерувати візити.");
  }
}

// ==========================
// Створення візиту вручну (IndexedDB)
// ==========================
async function confirmCreateVisit() {
  const manager = localStorage.getItem("userLogin") || "Невідомо";
  const date = document.getElementById("visitDate")?.value;

  if (!date) {
    alert("❌ Виберіть дату");
    return;
  }

  const lab = labsCache.find(l => l.edrpou === window.currentLabEdrpou);
  if (!lab) {
    alert("⚠️ Лабораторія не знайдена");
    return;
  }

  const visitId = `${lab.edrpou}_${date}_${Date.now()}`;

  const newVisit = {
    id: visitId,
    labId: lab.edrpou,
    date,
    manager,
    status: "заплановано",
    notes: "",
    lat: lab.lat || null,
    lng: lab.lng || null,
    institution: lab.institution || ""
  };

  await addVisit(newVisit);
  alert("✅ Візит додано у IndexedDB!");
  closeCreateVisitModal();
}

// ==========================
// Показ фільтра менеджера (завжди)
// ==========================
function showManagerFilter() {
  const container = document.getElementById("managerFilterContainer");
  if (!container) return;

  container.innerHTML = `
    <label for="filterManager">Менеджер (ПІБ):</label>
    <input type="text" id="filterManager" list="managerOptions">
    <datalist id="managerOptions"></datalist>
  `;
  populateFilterOptions(labsCache);
}

// ==========================
// Ініціалізація при завантаженні сторінки
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  initMap();

  labsCache = await getAllFromDB("labs");
  filteredLabs = labsCache;

  showManagerFilter();
  populateFilterOptions(labsCache);

  renderLabs(filteredLabs);
  updateMap(filteredLabs);

  document.querySelectorAll("#filters input, #filters select").forEach(el => {
    el.addEventListener("change", applyFilters);
  });

  const resetBtn = document.querySelector("button[onclick='resetFilters()']");
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  console.log("✅ Ініціалізація сторінки завершена");
});

// ==========================
// Створення нової лабораторії (з кнопки)
// ==========================
function createNewLab() {
  window.location.href = "labcard.html";
}

// ==========================
// Редагування лабораторії
// ==========================
function editLabCard(edrpou) {
  window.location.href = `./labcard.html?id=${edrpou}`;
}

// ==========================
// Відкриття/закриття модалки створення візиту
// ==========================
function openCreateVisitModal(edrpou) {
  window.currentLabEdrpou = edrpou;
  const modal = document.getElementById("createVisitModal");
  if (modal) modal.style.display = "block";
}

function closeCreateVisitModal() {
  const modal = document.getElementById("createVisitModal");
  if (modal) modal.style.display = "none";
}

// ==========================
// Експорт лабораторій у Excel
// ==========================
function exportLabsToExcel() {
  if (!filteredLabs || filteredLabs.length === 0) {
    alert("❌ Немає лабораторій для експорту");
    return;
  }

  const data = filteredLabs.map(lab => ({
    "Назва ЛПЗ": lab.institution || "",
    "ЄДРПОУ": lab.edrpou || "",
    "Область": lab.region || "",
    "Місто": lab.city || "",
    "Контактна особа": lab.contractor || "",
    "Менеджер": lab.manager || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Лабораторії");

  XLSX.writeFile(workbook, `labs_${new Date().toISOString().split("T")[0]}.xlsx`);
}

function exportPurchasesToExcel() {
  if (!labsInPolygon || labsInPolygon.length === 0) {
    alert("❌ Немає лабораторій у контурі");
    return;
  }

  const data = [];

  labsInPolygon.forEach(lab => {
    (lab.devices || []).forEach(device => {
      (device.reagents || []).forEach(reagent => {
        data.push({
          "Лабораторія": lab.institution || "",
          "Предмет": reagent.name || "",
          "Кількість": reagent.quantity || 0,
          "Дата": reagent.date || ""
        });
      });
    });
  });

  if (data.length === 0) {
    alert("⚠️ У виділених лабораторіях немає закупівель");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Закупівлі");

  XLSX.writeFile(workbook, `purchases_${new Date().toISOString().split("T")[0]}.xlsx`);
}
function generateReagentsReport(labs = labsCache) {
  let reportHtml = "<h3>📊 Звіт по закупках реагентів</h3><table border='1' cellpadding='5'>";
  reportHtml += "<tr><th>Лабораторія</th><th>Прилад</th><th>Реагент</th><th>Останнє замовлення</th><th>Кількість</th><th>Прогноз (днів)</th></tr>";

  labs.forEach(lab => {
    (lab.devices || []).forEach(device => {
      if (device.reagentsInfo) {
        Object.entries(device.reagentsInfo).forEach(([name, info]) => {
          const count = info.lastOrderCount || 0;
          const date = info.lastOrderDate || "—";
          const forecast = count > 0 ? Math.floor(count / 25) : "—";
          reportHtml += `<tr>
            <td>${lab.partner || "—"}</td>
            <td>${device.device || "—"}</td>
            <td>${name}</td>
            <td>${date}</td>
            <td>${count}</td>
            <td>${forecast}</td>
          </tr>`;
        });
      }
    });
  });

  reportHtml += "</table>";
  const container = document.getElementById("reagentsReport");
  if (container) container.innerHTML = reportHtml;
}
async function getAllPartners() {
  try {
    const labs = await getAllFromDB("labs");
    const partners = [...new Set(
      labs.map(l => l.partner).filter(p => typeof p === "string" && p.trim() !== "")
    )];

    console.log("✅ Партнери:", partners);
    return partners;
  } catch (err) {
    console.error("❌ Помилка при отриманні партнерів:", err);
    return [];
  }
}
function openCreateVisitModal(edrpou) {
  window.currentLabEdrpou = edrpou;
  const modal = document.getElementById("createVisitModal");
  if (modal) {
    modal.classList.add("show");
  }
}

function closeCreateVisitModal() {
  const modal = document.getElementById("createVisitModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

// Закриття модалки при кліку на фон
window.addEventListener("click", function(event) {
  const modal = document.getElementById("createVisitModal");
  if (event.target === modal) {
    closeCreateVisitModal();
  }
});

// Закриття модалки при натисканні Esc
window.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    closeCreateVisitModal();
  }
});


// ==========================
// Прив’язка функцій до window
// ==========================
window.exportPurchasesToExcel = exportPurchasesToExcel;
window.exportLabsToExcel = exportLabsToExcel;
window.createNewLab = createNewLab;
window.editLabCard = editLabCard;
window.openCreateVisitModal = openCreateVisitModal;
window.closeCreateVisitModal = closeCreateVisitModal;
window.deleteLab = deleteLab;
window.generateAllLabVisits = generateAllLabVisits;
window.generateReagentsReport = generateReagentsReport;
window.confirmCreateVisit = confirmCreateVisit;
window.sortTable = sortTable;
window.getAllPartners = getAllPartners;
window.openPurchasesModal = openPurchasesModal;
window.closePurchasesModal = closePurchasesModal;
window.openModal = openModal;
window.closeModal = closeModal;