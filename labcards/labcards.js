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
// ==========================
// IndexedDB helpers
// ==========================
const DB_NAME = "labsDB";
const DB_VERSION = 1;

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

async function putToDB(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
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
  labsCache = await getAllFromDB("labs");
  visitsCache = await getAllFromDB("visits");
  filteredLabs = labsCache;

  syncVisitsToLabs();
  if (window.rerenderCalendar) window.rerenderCalendar();
}

// ==========================
// Візити
// ==========================
async function loadVisits() {
  visitsCache = await getAllFromDB("visits");
  return visitsCache;
}

async function saveVisits(visits) {
  visitsCache = visits;
  for (const v of visits) {
    await putToDB("visits", v);
  }
  syncVisitsToLabs();
  if (window.rerenderCalendar) window.rerenderCalendar();
}

async function addVisit(visit) {
  visitsCache.push(visit);
  await putToDB("visits", visit);
  syncVisitsToLabs();
}

async function deleteVisit(visitId) {
  visitsCache = visitsCache.filter(v => v.id !== visitId);
  await deleteFromDB("visits", visitId);
  syncVisitsToLabs();
}

async function updateVisit(visitId, updates) {
  const idx = visitsCache.findIndex(v => v.id === visitId);
  if (idx !== -1) {
    visitsCache[idx] = { ...visitsCache[idx], ...updates };
    await putToDB("visits", visitsCache[idx]);
    syncVisitsToLabs();
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
// Початковий рендер
// ==========================
async function startLabsRender() {
  await initCache(); // завантажуємо labsCache та visitsCache з IndexedDB
  if (labsCache.length > 0) {
    renderLabs(labsCache);
    updateMap(labsCache);
    populateFilterOptions(labsCache);
  }
}
startLabsRender();

// ==========================
// Фільтри
// ==========================
function applyFilters() {
  try {
    const getVal = id => document.getElementById(id)?.value.trim().toLowerCase() || "";

    const filters = {
      contractor: getVal("contractor"),   // у HTML є саме contractor
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

    // трипозиційний перемикач
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
function renderLabs(data = filteredLabs) {
  try {
    const container = document.getElementById("labsContainer");
    if (!container) return;

    container.innerHTML = "";

    if (!data || data.length === 0) {
      container.innerHTML = "<p>⚠️ Лабораторій не знайдено.</p>";
      return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const labsToRender = data.slice(start, end);

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
        <p>👤 Контактна особа: ${lab.contractor || "—"}</p>
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

    renderPagination(data);

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
  if (totalPages <= 1) return; // якщо сторінка одна — не показуємо

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

  // обробник створення контуру
  map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);

    const geojsonLayer = L.geoJSON(layer.toGeoJSON());

    labsInPolygon = labsCache.filter(lab => {
      if (!lab.lat || !lab.lng) return false;
      const point = [lab.lng, lab.lat]; // leaflet-pip очікує [lng, lat]
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

  // видаляємо лабораторію
  await deleteFromDB("labs", edrpou);

  // видаляємо пов’язані візити
  const visits = await getAllFromDB("visits");
  const remainingVisits = visits.filter(v => v.labId !== edrpou);
  for (const v of visits.filter(v => v.labId === edrpou)) {
    await deleteFromDB("visits", v.id);
  }

  alert("✅ Лабораторію та її візити видалено з кешу (IndexedDB)");
  // оновлюємо список
  labsCache = await getAllFromDB("labs");
  filteredLabs = labsCache;
  renderLabs(filteredLabs);
  updateMap(filteredLabs);
}
// ==========================
// Генерація місячних візитів
// ==========================
/*async function generateMonthlyLabVisits(tasks) {
  try {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];

    const visitsByMonth = {};
    tasks.forEach(task => {
      const date = new Date(task.date);
      if (isNaN(date)) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!visitsByMonth[monthKey]) visitsByMonth[monthKey] = [];
      visitsByMonth[monthKey].push(task);
    });

    const visitsPayload = Object.entries(visitsByMonth).map(([monthKey, monthTasks]) => {
      const minDate = monthTasks.map(t => new Date(t.date)).reduce((a, b) => (a < b ? a : b));
      return {
        id: `${monthTasks[0].labId}_${monthKey}_${Date.now()}`,
        labId: monthTasks[0].labId,
        labName: monthTasks[0].labName || "—",
        date: minDate.toISOString(),
        tasks: monthTasks,
        status: "заплановано"
      };
    });

    return visitsPayload;

  } catch (err) {
    console.error("❌ Помилка при генерації місячних візитів:", err);
    return [];
  }
}*/

// ==========================
// Масова генерація візитів для всіх лабораторій (тільки кеш)
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

      // тут можна додати просту задачу "візит" без генерації задач для приладів
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

    if (allNewVisits.length > 0) {
      for (const v of allNewVisits) {
        await putToDB("visits", v);
      }
    }

    visitsCache = await getAllFromDB("visits");
    syncVisitsToLabs();

    alert(`✅ Згенеровано ${allNewVisits.length} нових візитів, збережено у кеш (IndexedDB)!`);
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
  const time = document.getElementById("visitTime")?.value;

  if (!date || !time) {
    alert("❌ Виберіть дату та час");
    return;
  }

  const fullDateTime = new Date(`${date}T${time}`);
  const newVisit = {
    id: Date.now(),
    labId: String(window.currentLabEdrpou).trim(),
    date: fullDateTime.toISOString(),
    manager,
    status: "заплановано",
    notes: ""
  };

  // перевірка дублювання
  const visits = await getAllFromDB("visits");
  const alreadyExists = visits.some(v =>
    v.labId === newVisit.labId && v.date === newVisit.date
  );
  if (alreadyExists) {
    alert("⚠️ Такий візит вже існує у кеші!");
    return;
  }

  await putToDB("visits", newVisit);
  visitsCache = await getAllFromDB("visits");

  syncVisitsToLabs();
  if (window.rerenderCalendar) window.rerenderCalendar();

  alert("✅ Візит додано у кеш (IndexedDB)!");
  closeCreateVisitModal();
}

/// ==========================
// Звіт по закупках реагентів
// ==========================
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

// ==========================
// Експорт закупівель у Excel
// ==========================
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
  // 1️⃣ Ініціалізація карти
  initMap();

  // 2️⃣ Завантаження лабораторій з IndexedDB
  labsCache = await getAllFromDB("labs");
  filteredLabs = labsCache;

  // 3️⃣ Показ фільтра менеджера
  showManagerFilter();

  // 4️⃣ Заповнення підказок
  populateFilterOptions(labsCache);

  // 5️⃣ Рендеринг лабораторій та карти
  renderLabs(filteredLabs);
  updateMap(filteredLabs);

  // 6️⃣ Автоматичне застосування фільтрів при зміні будь-якого поля
  document.querySelectorAll("#filters input, #filters select").forEach(el => {
    el.addEventListener("change", applyFilters);
  });

  // 7️⃣ Кнопка скидання фільтрів
  const resetBtn = document.querySelector("button[onclick='resetFilters()']");
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  console.log("✅ Ініціалізація сторінки завершена");
});

// ==========================
// Створення нової лабораторії (з кнопки)
// ==========================
function createNewLab() {
  // просто переходимо на сторінку картки
  window.location.href = "labcard.html";
}

// ==========================
// Редагування лабораторії
// ==========================
function editLabCard(edrpou) {
  // передаємо ЄДРПОУ через URL
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

// ==========================
// Очищення кешу IndexedDB
// ==========================
/*async function clearVisitsCache() {
  try {
    await clearStore("visits");   // очищаємо IndexedDB
    visitsCache = [];
    console.log("✅ Кеш візитів очищено");

    syncVisitsToLabs();
    if (window.rerenderCalendar) window.rerenderCalendar();

    alert("✅ Усі візити видалено з кешу (IndexedDB)");
  } catch (err) {
    console.error("❌ Помилка при очищенні кешу:", err);
    alert("⚠️ Не вдалося очистити кеш візитів");
  }
}

async function clearTasksCache() {
  try {
    await clearStore("tasks");
    window.tasksCache = [];
    console.log("✅ Кеш задач очищено (IndexedDB)");
  } catch (err) {
    console.error("❌ Помилка при очищенні кешу задач:", err);
  }
}*/

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
/*.clearTasksCache = clearTasksCache;
window.clearVisitsCache = clearVisitsCache;*/
window.sortTable = sortTable;
async function getAllPartners() {
  try {
    // витягуємо всі лабораторії з IndexedDB
    const labs = await getAllFromDB("labs");

    // формуємо масив партнерів, відфільтровуємо пусті та дублікати
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

// щоб можна було викликати з консолі
window.getAllPartners = getAllPartners;
