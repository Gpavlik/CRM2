// ==========================
// labcard.js — версія для labcard.html
// ==========================

// 🔧 Глобальні змінні
let labsCache = [];          // кеш лабораторій з бекенду
let calculators = {};        // кеш конфігів приладів
let kpListByDevice = {};     // КП по приладах
window.labsData = [];        // початкові дані лабораторій (вбудовані)
let deviceCount = 0;         // лічильник приладів
let visitsCache = JSON.parse(localStorage.getItem("visits") || "[]"); // кеш візитів

// === db-utils.js ===
// Утиліти для IndexedDB

const DB_NAME = "labsDB";
const DB_VERSION = 3;

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("labs")) {
        db.createObjectStore("labs", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("visits")) {
        db.createObjectStore("visits", { keyPath: "_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromDB(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToDB(storeName, dataArray) {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  dataArray.forEach(item => {
    // для labs ключ = edrpou, для visits можна id або date
    if (storeName === "labs" && item.edrpou) {
      store.put(item, item.edrpou);
    } else if (storeName === "visits" && item.id) {
      store.put(item, item.id);
    } else {
      console.warn("❌ Об’єкт без ключа:", item);
    }
  });

  return tx.complete;
}


async function clearDB(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  return tx.complete;
}

// ==========================
// Категорії приладів (глобально)
// ==========================
const deviceCategories = {
  "Гематологія": ["df-50", "dh-360", "Sysmex XN-1000"],
  "Біохімія": ["Cobas 311", "Cobas 6000"],
  "Імунологія": ["Architect i1000SR", "Architect i2000SR"],
  "Загальні аналізатори": ["LS-1100", "LS-2000"]
};


// ==========================
// Візити
// ==========================
function loadVisits() {
  return visitsCache;
}
function saveVisits(visits) {
  visitsCache = visits;
  localStorage.setItem("visits", JSON.stringify(visits));
}

// ==========================
// Допоміжні утиліти
// ==========================
function formatDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return "";
  return dateObj.toISOString().split("T")[0];
}
function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`⚠️ Елемент з id="${id}" не знайдено`);
    return;
  }
  if (el.tagName === "SELECT") {
    [...el.options].forEach(opt => opt.selected = (opt.value === value));
  } else if (el.type === "checkbox" || el.type === "radio") {
    el.checked = Boolean(value);
  } else {
    el.value = value || "";
  }
}

// ==========================
// Завантаження кешу з IndexedDB
// ==========================
async function loadLabsCache() {
  const labs = await getAllFromDB("labs");   // читаємо з IndexedDB
  window.labsCache = labs;                   // оновлюємо глобальний кеш
  console.log(`✅ Лабораторії завантажено у кеш: (${labs.length})`);
  return labs;
}

// ==========================
// Каскадні підказки
// ==========================
function fillRegionOptions() {
  const regions = [...new Set((window.labsCache || []).map(l => l.region).filter(Boolean))];
  document.getElementById("regionList").innerHTML =
    regions.map(r => `<option value="${r}">`).join("");
}

function fillCityOptions() {
  const region = document.getElementById("region").value;
  const cities = [...new Set((window.labsCache || [])
    .filter(l => l.region === region)
    .map(l => l.city)
    .filter(Boolean))];
  document.getElementById("cityList").innerHTML =
    cities.map(c => `<option value="${c}">`).join("");
}

function fillLpzOptions() {
  const region = document.getElementById("region").value;
  const city = document.getElementById("city").value;
  const lpzs = (window.labsCache || []).filter(l => l.region === region && l.city === city);
  document.getElementById("lpzList").innerHTML =
    lpzs.map(l => `<option value="${l.institution} [ЄДРПОУ:${l.edrpou}]">`).join("");
}

function prefillLabData() {
  const lpzValue = document.getElementById("lpz").value;
  const edrpouMatch = lpzValue.match(/ЄДРПОУ:(\d+)/);
  if (!edrpouMatch) return;
  const edrpou = edrpouMatch[1];
  const lab = (window.labsCache || []).find(l => l.edrpou === edrpou);
  if (!lab) return;

  setValue("partnerName", lab.partner);
  setValue("labAddress", lab.address);
  setValue("contractor", lab.contractor);
  setValue("phone", lab.phone);
  setValue("labEdrpou", lab.edrpou);
  setValue("labManager", lab.manager);

  const container = document.getElementById("devicesContainer");
  container.innerHTML = "";
  if (lab.devices && lab.devices.length > 0) {
    document.getElementById("devicesSection").style.display = "block";
    lab.devices.forEach((d, idx) => addDevice(idx, d));
  }
}

// ==========================
// Ініціалізація сторінки
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadLabsCache();
  fillRegionOptions();
  fillCityOptions();
  fillLpzOptions();
  await initLabCard();
});

// ==========================
// Ініціалізація картки лабораторії
// ==========================
async function initLabCard() {
  const labs = window.labsCache || await getAllFromDB("labs");
  const edrpou = getQueryParam("id");  // ← беремо з URL

  console.log("▶ initLabCard викликана");

  if (!edrpou) {
    console.error("❌ Поточний ЄДРПОУ не передано.");
    return;
  }

  const lab = labs.find(l => String(l.edrpou).trim() === edrpou.trim());
  if (!lab) {
    console.error("❌ Лабораторія не знайдена у кеші за ЄДРПОУ:", edrpou);
    return;
  }

  // Заповнюємо форму
  setValue("partnerName", lab.partner);
  setValue("region", lab.region);
  setValue("city", lab.city);
  setValue("lpz", lab.institution);
  setValue("labAddress", lab.address);
  setValue("contractor", lab.contractor);
  setValue("phone", lab.phone);
  setValue("labEdrpou", lab.edrpou);
  setValue("labManager", lab.manager);

  // Показуємо блок приладів
  document.getElementById("devicesSection").style.display = "block";

  // Відображаємо прилади
  const container = document.getElementById("devicesContainer");
  container.innerHTML = "";
  deviceCount = 0;

  lab.devices.forEach((d, idx) => {
    const deviceName = d.device || d.name || d.category || "";
    const allOrders = d.reagentsOrders || [];
    const latestReagents = getLatestReagentsInfo(allOrders);

    addDevice(idx, {
      category: d.category || "",
      device: deviceName,
      soldDate: d.soldDate || d.date || "",
      lastService: d.lastService || "",
      workType: d.workType || "",
      replacedParts: d.replacedParts || "",
      kp: d.kp || "",
      testCount: d.testCount || "",
      reagentsInfo: latestReagents,
      analyses: d.analyses || {}
    });

    Object.entries(latestReagents).forEach(([name, info]) => {
      console.log(`   ${name} → дата: ${info.lastOrderDate}, кількість: ${info.lastOrderCount}`);
    });
  });

  console.log("✅ Картка лабораторії ініціалізована");
}


// ==========================
// Збір даних з форми
// ==========================
function collectLabCardData() {
  const devices = [];

  for (let i = 0; i < deviceCount; i++) {
    const block = document.getElementById(`deviceBlock_${i}`);
    if (!block) continue;

    const category = document.getElementById(`category_${i}`)?.value.trim();
    const device = document.getElementById(`device_${i}`)?.value.trim();
    const soldDate = document.getElementById(`soldDate_${i}`)?.value;
    const lastService = document.getElementById(`lastService_${i}`)?.value;
    const workType = document.getElementById(`workType_${i}`)?.value;
    const replacedParts = document.getElementById(`replacedParts_${i}`)?.value.trim();
    const kp = document.getElementById(`kpSelect_${i}`)?.value;
    const testCount = document.getElementById(`testCount_${i}`)?.value;

    // збір реагентів
    const reagentsInfo = {};
    const reagentBlocks = document.querySelectorAll(`#deviceBlock_${i} .reagent-block`);
    reagentBlocks.forEach(rb => {
      const name = rb.dataset.name;
      const safeId = name?.replace(/[^a-zA-Z0-9]/g, "_");
      const countEl = document.getElementById(`reagentCount_${i}_${safeId}`);
      const dateEl = document.getElementById(`reagentDate_${i}_${safeId}`);
      if (name) {
        reagentsInfo[name] = {
          lastOrderCount: countEl?.value || "",
          lastOrderDate: dateEl?.value || ""
        };
      }
    });

    // збір аналізів
    const analyses = {};
    const analysisBlocks = document.querySelectorAll(`#deviceBlock_${i} .analysis-block`);
    analysisBlocks.forEach(ab => {
      const testName = ab.dataset.name;
      const safeId = testName?.replace(/[^a-zA-Z0-9]/g, "_");
      const countEl = document.getElementById(`analysisCount_${i}_${safeId}`);
      const packagesEl = document.getElementById(`analysisPackages_${i}_${safeId}`);
      const dateEl = document.getElementById(`analysisDate_${i}_${safeId}`);
      if (testName) {
        analyses[testName] = {
          count: countEl?.value || "",
          packages: packagesEl?.value || "",
          date: dateEl?.value || ""
        };
      }
    });

    if (!category && !device) continue;

    devices.push({
      category,
      device,
      soldDate,
      lastService,
      workType,
      replacedParts,
      kp,
      testCount,
      reagentsInfo,
      analyses
    });
  }

  return {
    partner: document.getElementById("partnerName")?.value.trim(),
    region: document.getElementById("region")?.value.trim(),
    city: document.getElementById("city")?.value.trim(),
    institution: document.getElementById("lpz")?.value.trim(),
    address: document.getElementById("labAddress")?.value.trim(),
    contractor: document.getElementById("contractor")?.value.trim(),
    phone: document.getElementById("phone")?.value.trim(),
    edrpou: document.getElementById("labEdrpou")?.value.trim(),
    manager: document.getElementById("labManager")?.value.trim(),
    devices,
    tasks: [],
    lastUpdated: new Date().toISOString(),
    saveDate: new Date().toISOString()
  };
}

// ==========================
// Допоміжні функції для списків
// ==========================
/*function fillRegionOptions() {
  const labs = await getAllFromDB("labs");  const regions = [...new Set(labs.map(l => l.region).filter(Boolean))];
  const list = document.getElementById("regionList");
  list.innerHTML = regions.map(r => `<option value="${r}">`).join("");
}

function fillCityOptions() {
  const labs = await getAllFromDB("labs");  const region = document.getElementById("region").value;
  const cities = [...new Set(labs.filter(l => l.region === region).map(l => l.city).filter(Boolean))];
  const list = document.getElementById("cityList");
  list.innerHTML = cities.map(c => `<option value="${c}">`).join("");
}

function fillLpzOptions() {
  const labs = await getAllFromDB("labs");  const city = document.getElementById("city").value;
  const lpzList = [...new Set(labs.filter(l => l.city === city).map(l => l.institution).filter(Boolean))];
  const list = document.getElementById("lpzList");
  list.innerHTML = lpzList.map(lpz => `<option value="${lpz}">`).join("");
}*/

// ==========================
// Додавання приладу
// ==========================
function addDevice(index, prefill = {}) {
  const container = document.getElementById("devicesContainer");
  if (!container) return;

  const block = document.createElement("div");
  block.className = "device-block";
  block.id = `deviceBlock_${index}`;

  block.innerHTML = `
    <label for="category_${index}">Категорія:</label>
    <input id="category_${index}" value="${prefill.category || ""}" placeholder="Оберіть категорію">

    <label for="device_${index}">Прилад:</label>
    <input id="device_${index}" value="${prefill.device || ""}" placeholder="Введіть назву приладу">

    <label for="soldDate_${index}">Дата продажу:</label>
    <input type="date" id="soldDate_${index}" value="${formatDateForInput(prefill.soldDate)}">

    <label for="lastService_${index}">Останній сервіс:</label>
    <input type="date" id="lastService_${index}" value="${formatDateForInput(prefill.lastService)}">

    <label for="workType_${index}">Виконані роботи:</label>
    <select id="workType_${index}">
      <option value="">Оберіть тип</option>
      <option value="технічне обслуговування">Технічне обслуговування</option>
      <option value="ремонт">Ремонт</option>
      <option value="калібрування">Калібрування</option>
    </select>

    <label for="replacedParts_${index}">Замінені деталі:</label>
    <input id="replacedParts_${index}" value="${prefill.replacedParts || ""}" placeholder="Перелік деталей">

    <label for="kpSelect_${index}">КП:</label>
    <select id="kpSelect_${index}">
      <option value="">Оберіть КП</option>
    </select>

    <div id="reagentsFields_${index}"></div>
    <div id="analysisFields_${index}"></div>
  `;

  container.appendChild(block);
  deviceCount++;

  // встановлюємо тип робіт, якщо є
  if (prefill.workType) {
    const workTypeEl = document.getElementById(`workType_${index}`);
    if (workTypeEl) workTypeEl.value = prefill.workType;
  }

  // === Префіл реагентів ===
  if (prefill.reagentsInfo) {
    const reagentsContainer = document.getElementById(`reagentsFields_${index}`);
    Object.entries(prefill.reagentsInfo).forEach(([name, info]) => {
      const safeId = name.replace(/[^a-zA-Z0-9]/g, "_");
      const reagentBlock = document.createElement("div");
      reagentBlock.className = "reagent-block";
      reagentBlock.dataset.name = name;
      reagentBlock.innerHTML = `
        <label>${name}</label>
        <input id="reagentCount_${index}_${safeId}" value="${info.lastOrderCount || ""}" placeholder="Кількість">
        <input type="date" id="reagentDate_${index}_${safeId}" value="${formatDateForInput(info.lastOrderDate)}">
      `;
      reagentsContainer.appendChild(reagentBlock);
    });
  }

  // === Префіл аналізів ===
  if (prefill.analyses) {
    const analysesContainer = document.getElementById(`analysisFields_${index}`);
    Object.entries(prefill.analyses).forEach(([testName, data]) => {
      const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
      const analysisBlock = document.createElement("div");
      analysisBlock.className = "analysis-block";
      analysisBlock.dataset.name = testName;
      analysisBlock.innerHTML = `
        <label>${testName}</label>
        <input id="analysisCount_${index}_${safeId}" value="${data.count || ""}" placeholder="Кількість">
        <input id="analysisPackages_${index}_${safeId}" value="${data.packages || ""}" placeholder="Пакети">
        <input type="date" id="analysisDate_${index}_${safeId}" value="${formatDateForInput(data.date)}">
      `;
      analysesContainer.appendChild(analysisBlock);
    });
  }

  // запускаємо калькулятор (якщо треба)
  loadCalculator(index, prefill);

  console.log("Назви з калькулятора:", prefill.calculator?.reagents?.map(r => r.name));
  console.log("Назви з кешу:", Object.keys(prefill.reagentsInfo || {}));
}

// ==========================
// Завантаження калькулятора для приладу
// ==========================
async function loadCalculator(index, prefill = null) {
  const deviceInput = document.getElementById(`device_${index}`);
  if (deviceInput && !deviceInput.value && prefill?.device) {
    deviceInput.value = prefill.device;
  }
  // якщо це YHLO — не вантажимо калькулятор 
  
  
  const deviceName = deviceInput?.value?.trim();
  if (!deviceName) return;

  if ((prefill?.category || deviceName).toUpperCase().includes("YHLO")) 
    { console.log(`ℹ️ Прилад ${deviceName} працює без реагентів — калькулятор не потрібен`); 
  return; 
}

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const applyPrefill = (config) => {
  const analysisContainer = document.getElementById(`analysisFields_${index}`);
  if (analysisContainer) analysisContainer.innerHTML = "";

  const testCountEl = document.getElementById(`testCount_${index}`);
  if (testCountEl) testCountEl.remove();

  const reagentBlocks = document.querySelectorAll(`#deviceBlock_${index} .reagent-block`);
  reagentBlocks.forEach(rb => rb.remove());

  renderTestCountField(index, config, deviceName);
  renderReagentFields(index, config, prefill);   // ← ось тут треба передати prefill
  renderAnalysisFields(index, config, prefill);
  console.log(`✅ Калькулятор для приладу ${deviceName} застосовано`);



    const kpOptions = kpListByDevice[deviceName] || [];
    const kpSelect = document.getElementById(`kpSelect_${index}`);
    if (kpSelect) {
      kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
        kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
      if (prefill?.kp) kpSelect.value = prefill.kp;
    }

    if (prefill?.testCount) {
      const testCountInput = document.getElementById(`testCount_${index}`);
      if (testCountInput) testCountInput.value = prefill.testCount;
    }

    if (prefill?.reagentsInfo) {
      Object.entries(prefill.reagentsInfo).forEach(([name, info]) => {
        const safeId = name.replace(/[^a-zA-Z0-9]/g, "_");
        const countEl = document.getElementById(`reagentCount_${index}_${safeId}`);
        const dateEl = document.getElementById(`reagentDate_${index}_${safeId}`);
        if (countEl) countEl.value = info.lastOrderCount || "";
        if (dateEl) dateEl.value = info.lastOrderDate || "";
      });
    }

    if (prefill?.analyses) {
      Object.entries(prefill.analyses).forEach(([testName, data]) => {
        const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
        const countEl = document.getElementById(`analysisCount_${index}_${safeId}`);
        const packagesEl = document.getElementById(`analysisPackages_${index}_${safeId}`);
        const dateEl = document.getElementById(`analysisDate_${index}_${safeId}`);
        if (countEl) countEl.value = data.count || "";
        if (packagesEl) packagesEl.value = data.packages || "";
        if (dateEl && data.date && data.date !== "НІКОЛИ") {
          dateEl.value = data.date;
        }
      });
    }
  };

  if (calculators[key]) {
    applyPrefill(calculators[key]);
    return;
  }

  try {
    const res = await fetch(`../calculators/${deviceName}.json`);
    if (!res.ok) throw new Error(`Не вдалося знайти калькулятор: ${deviceName}`);

    const config = await res.json();
    calculators[key] = config;
    applyPrefill(config);

  } catch (err) {
    console.error(`❌ Помилка при завантаженні калькулятора ${deviceName}:`, err);
  }
}

// ==========================
// Поле для кількості тестів
// ==========================
function renderTestCountField(index, config, deviceName) {
  const block = document.getElementById(`deviceBlock_${index}`);
  if (!block) return;

  const wrapper = document.createElement("div");
  wrapper.className = "test-count-block";

  wrapper.innerHTML = `
    <label for="testCount_${index}">Кількість тестів на день (${deviceName}):</label>
    <input type="number" id="testCount_${index}" 
           value="${config.testsPerDay || ""}" 
           placeholder="Введіть кількість">
    <p>💰 Ціна тесту: ${config.testPrice || "—"} грн</p>
  `;

  block.appendChild(wrapper);
}

// ==========================
// Поля для реагентів
// ==========================
function renderAnalysisFields(index, config, prefill = null) {
  const container = document.getElementById(`analysisFields_${index}`);
  if (!container) return;
  container.innerHTML = "<h4>🧪 Тести та реагенти</h4>";

  // поле для кількості аналізів на день
  const testsInput = document.createElement("input");
  testsInput.type = "number";
  testsInput.id = `testsPerDay_${index}`;
  testsInput.value = prefill?.testCount || config.testsPerDay || 0;
  testsInput.placeholder = "Кількість аналізів на день";
  container.appendChild(testsInput);

  // реагенти
  config.reagents.forEach(r => {
    const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");

    const block = document.createElement("div");
    block.className = "reagent-block";
    block.dataset.name = r.name;

    block.innerHTML = `
      <h4>${r.name}</h4>
      <p>📦 Упаковка: ${r.packageSize} мл, 💰 ${r.price} грн</p>
      <label>
        Кількість упаковок:
        <input type="number" id="reagentCount_${index}_${safeId}" min="0" value="0">
      </label>
      <label>
        Дата замовлення:
        <input type="date" id="reagentDate_${index}_${safeId}">
      </label>
      <div id="reagentCalc_${index}_${safeId}" class="reagent-calc"></div>
    `;
    container.appendChild(block);

    // Prefill
    if (prefill?.reagentsInfo?.[r.name]) {
      const info = prefill.reagentsInfo[r.name];
      document.getElementById(`reagentCount_${index}_${safeId}`).value = info.lastOrderCount || 0;
      document.getElementById(`reagentDate_${index}_${safeId}`).value = info.lastOrderDate || "";
    }

    // розрахунок
    const packagesEl = document.getElementById(`reagentCount_${index}_${safeId}`);
    const calcEl = document.getElementById(`reagentCalc_${index}_${safeId}`);

    function recalc() {
      const testsPerDay = parseInt(testsInput.value || "0", 10);
      const packages = parseInt(packagesEl.value || "0", 10);

      const dailyUsage = r.startup + r.shutdown + (r.perTest * testsPerDay);
      const totalVolume = r.packageSize * packages;

      let daysAvailable = "∞";
      if (dailyUsage > 0) {
        daysAvailable = Math.floor(totalVolume / dailyUsage);
      }

      calcEl.innerHTML = `⏳ Вистачить приблизно на <strong>${daysAvailable}</strong> днів`;
    }

    testsInput.addEventListener("input", recalc);
    packagesEl.addEventListener("input", recalc);
    recalc();
  });
}
function renderReagentFields(index, config, prefill = null) {
  const block = document.getElementById(`deviceBlock_${index}`);
  if (!block || !config.reagents) return;

  config.reagents.forEach(r => {
    const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");
    const wrapper = document.createElement("div");
    wrapper.className = "reagent-block";
    wrapper.dataset.name = r.name;

    wrapper.innerHTML = `
      <h4>🧪 ${r.name}</h4>
      <p>📦 Упаковка: ${r.packageSize} мл, 💰 ${r.price} грн</p>
      <label>
        Кількість упаковок:
        <input type="number" id="reagentCount_${index}_${safeId}" min="0" value="0">
      </label>
      <label>
        Дата замовлення:
        <input type="date" id="reagentDate_${index}_${safeId}">
      </label>
    `;
    block.appendChild(wrapper);

    // Prefill
    if (prefill?.reagentsInfo?.[r.name]) {
      const info = prefill.reagentsInfo[r.name];
      document.getElementById(`reagentCount_${index}_${safeId}`).value = info.lastOrderCount || 0;
      document.getElementById(`reagentDate_${index}_${safeId}`).value = info.lastOrderDate || "";
    }
  });
}

// ==========================
// Генерація задач для приладів
// ==========================
async function generateDeviceTasksWithDueDates(lab) {
  try {
    const tasks = [];
    let minDaysAvailable = Infinity;

    for (const device of lab.devices || []) {
      const isYHLO = (device.category || device.device || "").toUpperCase().includes("YHLO");

      // === ТО (сервіс) ===
      let lastServiceDate = device.lastService ? new Date(device.lastService) : null;
      if (!lastServiceDate && device.soldDate) {
        lastServiceDate = new Date(device.soldDate);
      }

      if (lastServiceDate && !isNaN(lastServiceDate)) {
        const diffDays = Math.floor((Date.now() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 180) {
          tasks.push({
            id: `${lab.edrpou}_${device.device}_service_${Date.now()}_${Math.random()}`,
            labId: lab.edrpou,
            labName: lab.partner,
            device: device.device,
            title: `Плановий сервіс приладу ${device.device}`,
            date: new Date().toISOString().split("T")[0],
            taskType: "service",
            priority: "🔧"
          });
        }
      }

      // === Реагенти (тільки для НЕ-YHLO) ===
      if (!isYHLO && device.reagentsInfo) {
        for (const [reagentName, info] of Object.entries(device.reagentsInfo)) {
          const reagentConfig = (device.calculator?.reagents || []).find(r => r.name === reagentName);
          if (!reagentConfig) continue;

          const testsPerDay = parseInt(device.testCount || lab.testsPerDay || 0, 10);
          const dailyUsage = reagentConfig.startup + reagentConfig.shutdown + (reagentConfig.perTest * testsPerDay);
          const totalVolume = reagentConfig.packageSize * (info.lastOrderCount || 0);

          let daysAvailable = Infinity;
          if (dailyUsage > 0) {
            daysAvailable = Math.floor(totalVolume / dailyUsage);
          }

          if (daysAvailable < minDaysAvailable) {
            minDaysAvailable = daysAvailable;
          }

          // Задача на закупівлю мінімум на 66 робочих днів
          const neededPackages = Math.ceil((dailyUsage * 66) / reagentConfig.packageSize);

          tasks.push({
            id: `${lab.edrpou}_${device.device}_reagent_${Date.now()}_${Math.random()}`,
            labId: lab.edrpou,
            labName: lab.partner,
            device: device.device,
            title: `Закупівля реагенту ${reagentName} (мінімум на 66 днів)`,
            date: new Date().toISOString().split("T")[0],
            taskType: "reagents",
            reagentName,
            neededQuantity: neededPackages,
            priority: "🧪"
          });
        }
      }
    }

    // === Наступний візит (за реагентами) ===
    if (minDaysAvailable !== Infinity) {
      const nextVisitDate = new Date();
      nextVisitDate.setDate(nextVisitDate.getDate() + (minDaysAvailable - 30));

      tasks.push({
        id: `${lab.edrpou}_visit_${Date.now()}_${Math.random()}`,
        labId: lab.edrpou,
        labName: lab.partner,
        title: `Наступний візит до лабораторії ${lab.partner}`,
        date: nextVisitDate.toISOString().split("T")[0],
        taskType: "visit",
        priority: "📅"
      });
    }

    // 🔧 Зберігаємо задачі у кеш
    if (tasks.length > 0) {
      const currentTasks = JSON.parse(localStorage.getItem("tasks") || "[]");
      const updatedTasks = [...currentTasks, ...tasks];
      localStorage.setItem("tasks", JSON.stringify(updatedTasks));
      window.tasksCache = updatedTasks;

      console.log(`✅ Задачі для лабораторії ${lab.partner} збережено у кеш`);
    }

    return tasks;

  } catch (err) {
    console.error("❌ Помилка при генерації задач:", err);
    alert("⚠️ Не вдалося згенерувати задачі. Перевірте консоль.");
    return [];
  }
}
// ==========================
// Форматування дати для input[type="date"]
// ==========================
function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  return dateStr.split("T")[0]; // залишає тільки yyyy-MM-dd
}

// ==========================
// Генерація місячних візитів
// ==========================
async function generateMonthlyLabVisits(tasks) {
  try {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return [];
    }

    const visitsByMonth = {};
    tasks.forEach(task => {
      const date = new Date(task.date);
      if (isNaN(date)) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!visitsByMonth[monthKey]) visitsByMonth[monthKey] = [];
      visitsByMonth[monthKey].push(task);
    });

    const visitsPayload = [];

    for (const [monthKey, monthTasks] of Object.entries(visitsByMonth)) {
      const visitDate = monthTasks[0].date;
      const labId = monthTasks[0].labId;

      const visit = {
        id: `${labId}_${monthKey}_${Date.now()}_${Math.random()}`,
        labId,
        labName: monthTasks[0].labName || "—",
        date: visitDate,
        tasks: monthTasks,
        status: "заплановано"
      };

      visitsPayload.push(visit);
    }

    // 🔧 Зберігаємо візити у кеш
    if (visitsPayload.length > 0) {
      const currentVisits = JSON.parse(localStorage.getItem("visits") || "[]");
      const updatedVisits = [...currentVisits, ...visitsPayload];
      localStorage.setItem("visits", JSON.stringify(updatedVisits));
      window.visitsCache = updatedVisits;

      console.log(`✅ Збережено ${visitsPayload.length} візитів у кеш`);
    }

    return visitsPayload;

  } catch (err) {
    console.error("❌ Помилка при генерації місячних візитів:", err);
    alert("⚠️ Не вдалося згенерувати місячні візити. Перевірте консоль.");
    return [];
  }
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
      const tasks = await generateDeviceTasksWithDueDates(lab);
      const monthlyVisits = await generateMonthlyLabVisits(tasks);

      const visitsPayload = monthlyVisits.map(v => ({
        id: `${lab.edrpou}_${v.date}_${Date.now()}_${Math.random()}`,
        labId: lab.edrpou,
        labName: lab.partner,
        city: lab.city,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      }));

      allNewVisits.push(...visitsPayload);

      console.log(`✅ Візити для лабораторії ${lab.partner} додані у кеш`);
    }

    const currentVisits = JSON.parse(localStorage.getItem("visits") || "[]");
    const updatedVisits = [...currentVisits, ...allNewVisits];
    localStorage.setItem("visits", JSON.stringify(updatedVisits));
    window.visitsCache = updatedVisits;

    if (window.rerenderCalendar) {
      window.rerenderCalendar();
    }

    alert(`✅ Згенеровано ${allNewVisits.length} нових візитів, збережено у кеш та розкидано по календарю!`);

  } catch (err) {
    console.error("❌ Помилка при генерації візитів:", err);
    alert("⚠️ Не вдалося згенерувати візити. Перевірте консоль.");
  }
}

// ==========================
// Оновлення лабораторії на основі виконаних візитів (з кешу)
// ==========================
async function applyFieldUpdatesFromVisits() {
  try {
    const visits = JSON.parse(localStorage.getItem("visits") || "[]");
    if (!Array.isArray(visits) || visits.length === 0) {
      console.warn("⚠️ Візитів у кеші не знайдено.");
      return;
    }

    const labs = await getAllFromDB("labs");
    for (const lab of labs) {
      const labVisits = visits.filter(v => v.labId === lab.edrpou && v.status === "виконано");

      for (const visit of labVisits) {
        for (const task of visit.tasks || []) {
          if (task.taskType === "service") {
            const device = lab.devices.find(d => d.device === task.device);
            if (device) device.lastService = task.date;
          }
          if (task.taskType === "reagents") {
            const device = lab.devices.find(d => d.device === task.device);
            if (device) {
              if (!device.reagentsInfo) device.reagentsInfo = {};
              device.reagentsInfo[task.reagentName] = {
                lastOrderDate: task.date,
                lastOrderCount: task.neededQuantity
              };
            }
          }
        }
      }
    }

    localStorage.setItem("labs", JSON.stringify(labs));
    console.log("✅ Лабораторії оновлено на основі виконаних візитів у кеші");

  } catch (err) {
    console.error("❌ Помилка при оновленні лабораторій з кешу:", err);
  }
}

// ==========================
// Обробка звіту по візиту (з кешу)
// ==========================
async function processVisitReport(visitId, reportData) {
  try {
    const visits = JSON.parse(localStorage.getItem("visits") || "[]");
    const labs = await getAllFromDB("labs");
    const visit = visits.find(v => v.id === visitId);
    if (!visit) {
      console.error("❌ Візит не знайдено у кеші");
      return;
    }

    visit.status = "виконано";
    visit.report = reportData;

    const lab = labs.find(l => l.edrpou === visit.labId);
    if (lab) {
      for (const task of visit.tasks || []) {
        if (task.taskType === "service") {
          const device = lab.devices.find(d => d.device === task.device);
          if (device) device.lastService = task.date;
        }
        if (task.taskType === "reagents") {
          const device = lab.devices.find(d => d.device === task.device);
          if (device) {
            if (!device.reagentsInfo) device.reagentsInfo = {};
            device.reagentsInfo[task.reagentName] = {
              lastOrderDate: task.date,
              lastOrderCount: task.neededQuantity
            };
          }
        }
      }
    }

    localStorage.setItem("visits", JSON.stringify(visits));
    localStorage.setItem("labs", JSON.stringify(labs));

    console.log("✅ Звіт оброблено, візит та лабораторія оновлені у кеші");

  } catch (err) {
    console.error("❌ Помилка при обробці звіту з кешу:", err);
  }
}

// ==========================
// Збереження лабораторії у кеш
// ==========================
async function saveOrUpdateLabCard() {
  try {
    const labCard = collectLabCardData();

    // Перевірка обов'язкових полів
    if (!labCard.partner || !labCard.region || !labCard.city || !labCard.institution) {
      alert("⚠️ Заповніть обов'язкові поля: Контрагент, Область, Місто, ЛПЗ.");
      return;
    }

    // Відкриваємо IndexedDB і перевіряємо чи існує лабораторія з таким ЄДРПОУ
    const existingLabs = await getAllFromDB("labs");
    const idx = existingLabs.findIndex(l => l.edrpou === labCard.edrpou);

    if (idx >= 0) {
      // Оновлюємо існуючу
      await saveToDB("labs", [labCard]);
      alert("🔄 Лабораторію оновлено у кеші!");
    } else {
      // Додаємо нову
      await saveToDB("labs", [labCard]);
      alert("✅ Лабораторію створено і збережено у кеші!");
    }

    console.log("✅ Лабораторія збережена:", labCard);

  } catch (err) {
    console.error("❌ Помилка при збереженні/оновленні лабораторії:", err);
    alert("⚠️ Сталася помилка при збереженні. Перевірте консоль.");
  }
}
// ==========================
// Видалення лабораторії з кешу
// ==========================
function deleteLab(edrpou) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;

  let labs = JSON.parse(localStorage.getItem("labs") || "[]");
  labs = labs.filter(l => l.edrpou !== edrpou);
  localStorage.setItem("labs", JSON.stringify(labs));

  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  visits = visits.filter(v => v.labId !== edrpou);
  localStorage.setItem("visits", JSON.stringify(visits));

  alert("✅ Лабораторію та її візити видалено з кешу (ЄДРПОУ)");
}

// ==========================
// Ініціалізація порожньої картки лабораторії
// ==========================
function initEmptyLabCard() {
  // показуємо секцію приладів
  document.getElementById("devicesSection").style.display = "block";

  // очищаємо всі поля
  setValue("partnerName", "");
  setValue("region", "");
  setValue("city", "");
  setValue("lpz", "");
  setValue("labAddress", "");
  setValue("contractor", "");
  setValue("phone", "");
  setValue("labEdrpou", "");
  setValue("labManager", "");

  // очищаємо прилади
  const container = document.getElementById("devicesContainer");
  container.innerHTML = "";
  deviceCount = 0;

  // додаємо кнопку "➕ Додати прилад"
  const addBtn = document.createElement("button");
  addBtn.textContent = "➕ Додати прилад";
  addBtn.onclick = () => addDevice();
  container.appendChild(addBtn);

  console.log("✅ Ініціалізація нової лабораторії завершена");
}

 // ==========================
// Прев’ю задач перед збереженням
// ==========================
async function showTaskPreviewBeforeSave(labCard, onConfirm) {
  try {
    const tasks = await generateDeviceTasksWithDueDates(labCard);

    if (!tasks || tasks.length === 0) {
      if (confirm("⚠️ Для цієї лабораторії не згенеровано жодної задачі. Зберегти все одно?")) {
        onConfirm();
      }
      return;
    }

    let previewHtml = "<h3>📋 Задачі для лабораторії:</h3><ul>";
    tasks.forEach(t => {
      previewHtml += `<li>${t.date} — ${t.title}</li>`;
    });
    previewHtml += "</ul>";

    const previewContainer = document.getElementById("taskPreview");
    if (previewContainer) {
      previewContainer.innerHTML = previewHtml;
    }

    if (confirm("✅ Перегляньте задачі. Зберегти лабораторію?")) {
      onConfirm();
    }

  } catch (err) {
    console.error("❌ Помилка при показі прев’ю задач:", err);
    alert("⚠️ Не вдалося показати прев’ю задач.");
  }
}

// ==========================
// Утиліти
// ==========================
// allOrders – масив об'єктів закупівель, наприклад:
// [
//   { reagentName: "DIL-C", lastOrderDate: "2024-05-01", lastOrderCount: 2 },
//   { reagentName: "DIL-C", lastOrderDate: "2024-09-15", lastOrderCount: 1 },
//   { reagentName: "LYC-1", lastOrderDate: "2024-07-10", lastOrderCount: 3 }
// ]

function getLatestReagentsInfo(allOrders) {
  const latestInfo = {};

  for (const order of allOrders) {
    const { reagentName, lastOrderDate, lastOrderCount } = order;

    // якщо ще немає запису або нова дата пізніша за збережену
    if (
      !latestInfo[reagentName] ||
      new Date(lastOrderDate) > new Date(latestInfo[reagentName].lastOrderDate)
    ) {
      latestInfo[reagentName] = {
        lastOrderDate,
        lastOrderCount
      };
    }
  }

  return latestInfo;
}
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
/*document.addEventListener("DOMContentLoaded", () => {
  loadLabsCache();
  fillRegionOptions();
  fillCityOptions();
  fillLpzOptions();
  initLabCard(); // відкриває конкретну лабораторію
});*/

// ==========================
// Глобальні прив’язки до window (тільки для картки)
// ==========================
window.initLabCard = initLabCard;
window.addDevice = addDevice;
window.loadCalculator = loadCalculator;
window.renderTestCountField = renderTestCountField;
window.renderReagentFields = renderReagentFields;
window.renderAnalysisFields = renderAnalysisFields;

window.generateDeviceTasksWithDueDates = generateDeviceTasksWithDueDates;
window.generateMonthlyLabVisits = generateMonthlyLabVisits;
window.applyFieldUpdatesFromVisits = applyFieldUpdatesFromVisits;
window.processVisitReport = processVisitReport;

window.saveOrUpdateLabCard = saveOrUpdateLabCard;
window.deleteLab = deleteLab;
window.showTaskPreviewBeforeSave = showTaskPreviewBeforeSave;

window.formatDate = formatDate;
window.setValue = setValue;
window.getValue = getValue;
window.calculators = calculators;
window.deviceCategories = deviceCategories;
window.kpListByDevice = kpListByDevice;

async function debugLab() {
  const labs = await getAllFromDB("labs");
  const edrpou = localStorage.getItem("currentLabEdrpou");

  if (!edrpou) {
    console.error("❌ Поточний ЄДРПОУ не встановлено.");
    return;
  }

  const lab = labs.find(l => String(l.edrpou).trim() === edrpou.trim());
  if (!lab) {
    console.error("❌ Лабораторія не знайдена у кеші за ЄДРПОУ:", edrpou);
    return;
  }

  console.log("=== Лабораторія з кешу ===");
  console.log("Назва партнера:", lab.partner);
  console.log("ЄДРПОУ:", lab.edrpou);
  console.log("Регіон:", lab.region, "Місто:", lab.city);
  console.log("Адреса:", lab.address);
  console.log("Менеджер:", lab.manager);
  console.log("Контрагент:", lab.contractor);
  console.log("Телефон:", lab.phone);

  console.log("=== Прилади ===");
  (lab.devices || []).forEach((d, idx) => {
    console.log(`--- Прилад #${idx + 1} ---`);
    console.log("Назва:", d.device || d.name || d.category);
    console.log("Категорія:", d.category);
    console.log("Дата продажу:", d.date || d.soldDate || "немає");
    console.log("Останній сервіс:", d.lastService || "немає");
    console.log("Кількість тестів/день:", d.testCount || "невідомо");

    // Останнє замовлення по кожному реагенту
    console.log("ReagentsInfo (останнє замовлення):");
    if (d.reagentsInfo && Object.keys(d.reagentsInfo).length > 0) {
      Object.entries(d.reagentsInfo).forEach(([name, info]) => {
        console.log(`   ${name} → дата: ${info.lastOrderDate}, кількість: ${info.lastOrderCount}`);
      });
    } else {
      console.log("   ❌ немає даних");
    }

    // Історія замовлень
    console.log("ReagentsOrders (історія):");
    if (d.reagentsOrders && d.reagentsOrders.length > 0) {
      d.reagentsOrders.forEach(r => {
        console.log(`   ${r.reagentName} → дата: ${r.lastOrderDate}, кількість: ${r.lastOrderCount}`);
      });
    } else {
      console.log("   ❌ немає історії");
    }

    console.log("Analyses:", d.analyses || {});
  });
}

// ==========================
// Генерація JSON по девайсах
// ==========================
/*async function generateDeviceJson() {
  const labs = await getAllFromDB("labs");
  const deviceMap = {};

  labs.forEach(lab => {
    (lab.devices || []).forEach(device => {
      const devName = device.device || device.name || device.category || "UNKNOWN";
      if (!deviceMap[devName]) {
        deviceMap[devName] = {};
      }

      const reagentsInfo = device.reagentsInfo || {};
      Object.keys(reagentsInfo).forEach(name => {
        deviceMap[devName][name] = {
          formula: { [name]: 1 }
        };
      });
    });
  });

  // Вивід у консоль у форматі JSON
  Object.entries(deviceMap).forEach(([devName, reagents]) => {
    const jsonObj = {
      deviceName: devName,
      reagents: reagents
    };
    console.log(JSON.stringify(jsonObj, null, 2));
  });

  return deviceMap;
}

// Викликати так:
generateDeviceJson();
function downloadJSON(data, filename = "devices.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}*/
