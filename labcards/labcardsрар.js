let lpzList = [];
let filteredList = [];
const calculators = {};
let kpListByDevice = {};
let deviceCount = 0;
let taskSchedule = {}; // глобальний об’єкт для збереження розкладу
import { findNearbyAvailableDate, ORS_TOKEN } from "./logistics.js";

const deviceCategories = {
  "Гематологія": ["DH-36", "DF-50", "UN-73", "VISION Pro", "RN-3600"],
  "Коагулометрія": ["DP-C16", "СA-1200"],
  "Сечові аналізатори": ["READER 300"],
  "Біохімія": ["Biossays 240 Plus", "DP-C16", "Chem-100", "Chem-200"],
  "Електроліти": ["MINI ISE", "AFT-800"],
  "ПОКТ": ["LS-1100", "BK-120"]
};
const uniqueValues = {
  partner: new Set(),
  region: new Set(),
  city: new Set(),
  institution: new Set(),
  device: new Set(),
  contractor: new Set(),
  phone: new Set(),
  edrpou: new Set(),
  manager: new Set(),
  kp: new Set()
};
function toISODateLocal(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadLPZList() {
  fetch("https://nodejs-production-7176.up.railway.app/lpz") // бекенд маршрут
    .then(res => res.json())
    .then(data => {
      console.log("LPZ list loaded:", data);
      lpzList = data || [];
      filteredList = [...lpzList];
      updateRegionList();
      updateCityList();
      updateLPZList();
    })
    .catch(err => console.error("❌ Помилка завантаження LPZ:", err));
}


function updateRegionList() {
  const list = document.getElementById("region-list");
  if (!list) return;
  list.innerHTML = "";
  [...new Set(lpzList.map(l => l.region))].forEach(region => {
    const opt = document.createElement("option");
    opt.value = region;
    list.appendChild(opt);
  });
}

function updateCityList() {
  const list = document.getElementById("city-list");
  if (!list) return;
  list.innerHTML = "";
  [...new Set(filteredList.map(l => l.city))].forEach(city => {
    const opt = document.createElement("option");
    opt.value = city;
    list.appendChild(opt);
  });
}

function updateLPZList() {
  const list = document.getElementById("lpz-list");
  if (!list) return;
  list.innerHTML = "";
  [...new Set(filteredList.map(l => l.name))].forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  });
}

async function applyFilters() {
  try {
    const res = await fetch("https://nodejs-production-7176.up.railway.app/labcards");
    if (!res.ok) throw new Error("Не вдалося завантажити лабораторії");
    const labCards = await res.json();

    const name = document.getElementById("filterName")?.value.trim().toLowerCase() || "";
    const region = document.getElementById("filterRegion")?.value.trim().toLowerCase() || "";
    const city = document.getElementById("filterCity")?.value.trim().toLowerCase() || "";
    const institution = document.getElementById("filterInstitution")?.value.trim().toLowerCase() || "";
    const device = document.getElementById("filterDevice")?.value.trim().toLowerCase() || "";
    const contractor = document.getElementById("filterContractor")?.value.trim().toLowerCase() || "";
    const phone = document.getElementById("filterPhone")?.value.trim().toLowerCase() || "";
    const edrpou = document.getElementById("filterEdrpou")?.value.trim().toLowerCase() || "";
    const manager = document.getElementById("filterManager")?.value.trim().toLowerCase() || "";
    const kp = document.getElementById("kpFilter")?.value.trim().toLowerCase() || "";

    const filtered = labCards.filter(l =>
      (!name || l.partner?.toLowerCase().includes(name)) &&
      (!region || l.region?.toLowerCase() === region) &&
      (!city || l.city?.toLowerCase() === city) &&
      (!institution || l.institution?.toLowerCase() === institution) &&
      (!device || (Array.isArray(l.devices) && l.devices.some(d => d.device?.toLowerCase() === device))) &&
      (!contractor || l.contractor?.toLowerCase() === contractor) &&
      (!phone || l.phone?.toLowerCase() === phone) &&
      (!edrpou || l.edrpou?.toLowerCase() === edrpou) &&
      (!manager || l.manager?.toLowerCase() === manager) &&
      (!kp || (Array.isArray(l.devices) && l.devices.some(d => d.kp?.toLowerCase() === kp)))
    );

    renderLabCards(filtered);

  } catch (err) {
    console.error("❌ Помилка при фільтрації лабораторій:", err);
    alert("⚠️ Не вдалося застосувати фільтри. Перевірте консоль.");
  }
}


function autoFillIfSingle() {
  if (filteredList.length === 1) {
    const l = filteredList[0];
    setValue("region", l.region);
    setValue("city", l.city);
    setValue("lpz", l.name);
    setValue("labAddress", l.address);
    setValue("labEdrpou", l.edrpou);
    setValue("labManager", l.manager);
  }
}


// 🔧 Допоміжна функція для безпечного присвоєння значення
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value || "";
  } else {
    console.warn(`⚠️ Елемент з id="${id}" не знайдено`);
  }
}


function lpzToLabCard(lpz) {
  const today = new Date();

  return {
    id: lpz.edrpou || `${Date.now()}`,
    partner: lpz.name,
    region: lpz.region,
    city: lpz.city,
    institution: lpz.name,
    address: lpz.address,
    contractor: "", // можна додати з іншого джерела
    phone: "",
    edrpou: lpz.edrpou,
    manager: "",
    devices: lpz.devices.map(d => ({
      device: d.name,
      soldDate: d.lastPurchases?.[0]?.date || null,
      lastService: null,
      workType: null,
      replacedParts: null,
      kp: null,
      testCount: 0,
      analyses: {},
      reagentsInfo: {}
    })),
    tasks: [],
    lastUpdated: today.toISOString(),
    saveDate: today.toISOString()
  };
}

const deviceTasks = await generateDeviceTasksWithDueDates(labCard);
const monthlyVisits = await generateMonthlyLabVisits(deviceTasks);

labCard.tasks = deviceTasks;


// 🔧 Ініціалізація картки лабораторії
function initLabCard() {

    const container = document.getElementById("devicesContainer");
  if (!container) {
    console.warn("⚠️ devicesContainer не знайдено — ця функція працює лише на labcard.html");
    return;
  }
  const editData = JSON.parse(localStorage.getItem("editLabCard") || "null");
  
  container.innerHTML = "";
  deviceCount = 0;

  if (editData && editData.lab) {
    const lab = editData.lab;
    // заповнюємо поля лабораторії безпечним методом
    setValue("partnerName", lab.partner);
    setValue("region", lab.region);
    setValue("city", lab.city);
    setValue("lpz", lab.institution);
    setValue("labAddress", lab.address);
    setValue("contractor", lab.contractor);
    setValue("phone", lab.phone);
    setValue("labEdrpou", lab.edrpou);
    setValue("labManager", lab.manager);

    // відновлюємо прилади
    if (lab.devices && lab.devices.length > 0) {
      const devicesSection = document.getElementById("devicesSection");
      if (devicesSection) devicesSection.style.display = "block";
      lab.devices.forEach((d, idx) => addDevice(idx, d));
    }
  }
}

// Викликати після завантаження DOM
window.addEventListener("DOMContentLoaded", () => {
  initLabCard();
});

function addDevice(index = null, prefill = null) {
  if (index === null) index = deviceCount++;
  else deviceCount = Math.max(deviceCount, index + 1);

  const container = document.getElementById("devicesContainer");
  if (!container) {
    console.error("❌ devicesContainer не знайдено");
    return;
  }

  const block = document.createElement("div");
  block.className = "device-block";
  block.id = `deviceBlock_${index}`;
  block.innerHTML = `
    <div class="device-selects">
      <div>
        <label for="category_${index}">📂 Категорія:</label>
        <select id="category_${index}">
          <option value="">Оберіть категорію</option>
          ${Object.keys(deviceCategories).map(cat => `<option value="${cat}">${cat}</option>`).join("")}
        </select>
      </div>
      <div>
        <label for="device_${index}">🔧 Прилад:</label>
        <select id="device_${index}">
          <option value="">Спочатку оберіть категорію</option>
        </select>
      </div>
    </div>

    <label for="soldDate_${index}">📅 Дата продажу:</label>
    <input type="date" id="soldDate_${index}">

    <label for="lastService_${index}">🛠️ Останній сервіс:</label>
    <input type="date" id="lastService_${index}">

    <label for="workType_${index}">🛠️ Виконані роботи:</label>
    <select id="workType_${index}">
      <option value="">Оберіть тип</option>
      <option value="плановий сервіс">Плановий сервіс</option>
      <option value="ремонт">Ремонт</option>
      <option value="заміна деталей">Заміна деталей</option>
    </select>

    <div id="replacedPartsBlock_${index}" style="display:none;">
      <label for="replacedParts_${index}">🔧 Замінені деталі:</label>
      <input type="text" id="replacedParts_${index}" placeholder="Фільтр, насос">
    </div>

    <div id="kpBlock_${index}">
      <label for="kpSelect_${index}">📄 КП:</label>
      <select id="kpSelect_${index}">
        <option value="">Оберіть КП</option>
      </select>
    </div>

    <div id="analysisFields_${index}"></div>

    <button id="removeDevice_${index}" style="background:#cc0000; margin-top:10px;">🗑️ Видалити прилад</button>
  `;
  container.appendChild(block);

  // події
  const categoryEl = document.getElementById(`category_${index}`);
  const deviceEl = document.getElementById(`device_${index}`);
  const workTypeEl = document.getElementById(`workType_${index}`);
  const removeBtn = document.getElementById(`removeDevice_${index}`);

  if (categoryEl) {
    categoryEl.addEventListener("change", (e) => {
      const category = e.target.value;
      if (deviceEl) {
        deviceEl.innerHTML = `<option value="">Оберіть прилад</option>`;
        if (deviceCategories[category]) {
          deviceEl.innerHTML += deviceCategories[category].map(d => `<option value="${d}">${d}</option>`).join("");
        }
      }
    });
  }

  if (deviceEl) {
    deviceEl.addEventListener("change", () => {
      if (typeof loadCalculator === "function") {
        loadCalculator(index, prefill);
      }
      const deviceName = deviceEl.value;
      const kpOptions = kpListByDevice[deviceName] || [];
      const kpSelect = document.getElementById(`kpSelect_${index}`);
      if (kpSelect) {
        kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
          kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
      }
    });
  }

  if (workTypeEl) {
    workTypeEl.addEventListener("change", (e) => {
      const show = e.target.value === "заміна деталей";
      const replacedBlock = document.getElementById(`replacedPartsBlock_${index}`);
      if (replacedBlock) replacedBlock.style.display = show ? "block" : "none";
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => block.remove());
  }

  // якщо редагування → заповнити поля
  if (prefill) {
    setValue(`soldDate_${index}`, prefill.soldDate);
    setValue(`lastService_${index}`, prefill.lastService);
    setValue(`workType_${index}`, prefill.workType);
    setValue(`replacedParts_${index}`, prefill.replacedParts);
    setValue(`kpSelect_${index}`, prefill.kp);

    if (prefill.workType === "заміна деталей") {
      const replacedBlock = document.getElementById(`replacedPartsBlock_${index}`);
      if (replacedBlock) replacedBlock.style.display = "block";
    }

    const category = Object.keys(deviceCategories).find(cat => deviceCategories[cat].includes(prefill.device));
    if (category) {
      setValue(`category_${index}`, category);
      if (deviceEl) {
        deviceEl.innerHTML = `<option value="">Оберіть прилад</option>` +
          deviceCategories[category].map(d => `<option value="${d}">${d}</option>`).join("");
        deviceEl.value = prefill.device;
      }
    }

    if (typeof loadCalculator === "function") {
      loadCalculator(index, prefill);
    }
  }
}
function loadCalculator(index, prefill = null) {
  const deviceName = document.getElementById(`device_${index}`)?.value?.trim();
  if (!deviceName) return;

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const applyPrefill = (config) => {
    // 🔧 Очистка старих полів
    const analysisContainer = document.getElementById(`analysisFields_${index}`);
    if (analysisContainer) analysisContainer.innerHTML = "";

    const testCountEl = document.getElementById(`testCount_${index}`);
    if (testCountEl) testCountEl.remove();

    const reagentBlocks = document.querySelectorAll(`#deviceBlock_${index} .reagent-block`);
    reagentBlocks.forEach(rb => rb.remove());

    // 🔧 Малюємо нові поля
    if (typeof renderTestCountField === "function") {
      renderTestCountField(index, config, deviceName);
    }
    if (typeof renderReagentFields === "function") {
      renderReagentFields(index, config);
    }
    if (deviceName === "LS-1100" && typeof renderAnalysisFieldsLS1100 === "function") {
      renderAnalysisFieldsLS1100(index, config, prefill);
    }

    // 🔧 КП
    const kpOptions = kpListByDevice[deviceName] || [];
    const kpSelect = document.getElementById(`kpSelect_${index}`);
    if (kpSelect) {
      kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
        kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
      if (prefill && prefill.kp) {
        kpSelect.value = prefill.kp;
      }
    }

    // 🔧 Prefill для тестів, реагентів, аналізів
    if (prefill) {
      if (prefill.testCount) {
        const testCountInput = document.getElementById(`testCount_${index}`);
        if (testCountInput) testCountInput.value = prefill.testCount;
      }

      if (prefill.reagentsInfo) {
        Object.entries(prefill.reagentsInfo).forEach(([name, info]) => {
          const safeId = name.replace(/[^a-zA-Z0-9]/g, "_");
          const countEl = document.getElementById(`reagentCount_${index}_${safeId}`);
          const dateEl = document.getElementById(`reagentDate_${index}_${safeId}`);
          if (countEl) countEl.value = info.lastOrderCount || "";
          if (dateEl) dateEl.value = info.lastOrderDate || "";
        });
      }

      if (prefill.analyses) {
        Object.entries(prefill.analyses).forEach(([testName, data]) => {
          const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
          const countEl = document.getElementById(`analysisCount_${index}_${safeId}`);
          const packagesEl = document.getElementById(`analysisPackages_${index}_${safeId}`);
          const dateEl = document.getElementById(`analysisDate_${index}_${safeId}`);
          if (countEl) countEl.value = data.count || "";
          if (packagesEl) packagesEl.value = data.packages || "";
          if (dateEl) dateEl.value = data.date || "";
        });
      }
    }
  };

  // 🔧 Використовуємо кеш або завантажуємо JSON
  if (calculators[key]) {
    applyPrefill(calculators[key]);
    return;
  }

  fetch(`../calculators/${key}.json`)
    .then(res => res.json())
    .then(config => {
      calculators[key] = config;
      applyPrefill(config);
    })
    .catch(err => {
      console.error(`❌ Не вдалося завантажити калькулятор: ${key}.json`, err);
    });
}

function renderTestCountField(index, config, deviceName) {
  const container = document.getElementById(`deviceBlock_${index}`);
  if (!container) return;

  if (deviceName === "LS-1100") return;

  const html = `
    <label>🔬 Кількість досліджень на день:
      <input type="number" id="testCount_${index}" min="0" value="${config.testsPerDay || 0}" />
    </label>
  `;
  container.insertAdjacentHTML("beforeend", html);
}

function renderReagentFields(index, config) {
  const container = document.getElementById(`deviceBlock_${index}`);
  if (!container || !config.reagents) return;

  let html = `<h4>📦 Реагенти</h4>`;
  config.reagents.forEach(r => {
    const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");
    html += `
      <div class="reagent-block">
        <strong>${r.name}</strong><br/>
        Кількість останнього замовлення:
        <input type="number" id="reagentCount_${index}_${safeId}" min="0" /><br/>
        Дата останнього замовлення:
        <input type="date" id="reagentDate_${index}_${safeId}" />
      </div>
    `;
  });

  container.insertAdjacentHTML("beforeend", html);
}

function renderAnalysisFields(index, config, prefill = null) {
  const container = document.getElementById(`analysisFields_${index}`);
  if (!container) {
    console.error(`❌ analysisFields_${index} не знайдено`);
    return;
  }
  container.innerHTML = "<h4>🧪 Тести та реагенти</h4>";

  // 🔧 Для LS-1100 беремо всі аналізи з config.analyses
  const items = config.analyses ? Object.keys(config.analyses) : [];

  // 🔧 Для інших приладів можна використати config.reagents як список
  if (config.reagents) {
    config.reagents.forEach(r => items.push(r.name));
  }

  items.forEach(itemName => {
    const safeId = itemName.replace(/[^a-zA-Z0-9]/g, "_");

    const block = document.createElement("div");
    block.className = "analysis-block";
    block.style.cssText = `
      border:1px solid #ccc;
      border-radius:6px;
      padding:10px;
      margin-bottom:12px;
      background:#f9f9f9;
    `;

    block.innerHTML = `
      <div class="analysis-title"><strong>${itemName}</strong></div>
      <div class="analysis-inputs">
        <label>
          📊 Кількість досліджень/день
          <input type="number" id="analysisCount_${index}_${safeId}" min="0" value="0">
        </label>
        <label>
          📦 Кількість упаковок
          <input type="number" id="analysisPackages_${index}_${safeId}" min="0" value="0">
        </label>
        <label>
          📅 Дата закупівлі
          <input type="date" id="analysisDate_${index}_${safeId}">
        </label>
      </div>
      <div id="analysisCalc_${index}_${safeId}" class="analysis-calc"></div>
    `;
    container.appendChild(block);

    // 🔧 Prefill
    if (prefill?.analyses?.[itemName]) {
      const data = prefill.analyses[itemName];
      const countEl = document.getElementById(`analysisCount_${index}_${safeId}`);
      const packagesEl = document.getElementById(`analysisPackages_${index}_${safeId}`);
      const dateEl = document.getElementById(`analysisDate_${index}_${safeId}`);
      if (countEl) countEl.value = data.count || 0;
      if (packagesEl) packagesEl.value = data.packages || 0;
      if (dateEl && data.date && data.date !== "НІКОЛИ") {
        dateEl.value = data.date;
      }
    }

    // 🔧 Автоматичний розрахунок "на скільки днів вистачить"
    const countEl = document.getElementById(`analysisCount_${index}_${safeId}`);
    const packagesEl = document.getElementById(`analysisPackages_${index}_${safeId}`);
    const calcEl = document.getElementById(`analysisCalc_${index}_${safeId}`);

    function recalc() {
      const count = parseInt(countEl?.value || "0", 10);
      const packages = parseInt(packagesEl?.value || "0", 10);

      // беремо testsPerPackage з конфігу для конкретного аналізу
      let testsPerPackage = 25;
      if (config.analyses && config.analyses[itemName]?.testsPerPackage) {
        testsPerPackage = config.analyses[itemName].testsPerPackage;
      }

      const totalTests = packages * testsPerPackage;
      let daysAvailable = "∞";
      if (count > 0) {
        daysAvailable = Math.floor(totalTests / count);
      }
      calcEl.innerHTML = `⏳ Вистачить приблизно на <strong>${daysAvailable}</strong> днів`;
    }

    if (countEl) countEl.addEventListener("input", recalc);
    if (packagesEl) packagesEl.addEventListener("input", recalc);
    recalc(); // початковий розрахунок
  });
}

async function generateDeviceTasksWithDueDates(lab) {
  try {
    const tasks = [];

    // 🔧 Генеруємо задачі для кожного приладу
    for (const device of lab.devices || []) {
      // Сервісна задача
      if (device.lastService) {
        const nextServiceDate = new Date(device.lastService);
        nextServiceDate.setMonth(nextServiceDate.getMonth() + 6); // кожні 6 місяців

        tasks.push({
          id: `${lab.id}_${device.device}_service_${Date.now()}`,
          labId: lab.id,
          device: device.device,
          title: `Плановий сервіс приладу ${device.device}`,
          date: nextServiceDate.toISOString().split("T")[0],
          taskType: "service",
          priority: "🔧"
        });
      }

      // Реагенти
      if (device.reagentsInfo) {
        for (const [reagentName, info] of Object.entries(device.reagentsInfo)) {
          const nextOrderDate = info.lastOrderDate
            ? new Date(info.lastOrderDate)
            : new Date();
          nextOrderDate.setMonth(nextOrderDate.getMonth() + 1); // щомісячне замовлення

          tasks.push({
            id: `${lab.id}_${device.device}_reagent_${Date.now()}`,
            labId: lab.id,
            device: device.device,
            title: `Замовлення реагенту ${reagentName}`,
            date: nextOrderDate.toISOString().split("T")[0],
            taskType: "reagents",
            reagentName,
            neededQuantity: info.lastOrderCount || 0,
            priority: "🧪"
          });
        }
      }
    }

    // 🔧 Зберігаємо задачі у бекенд Railway
    if (tasks.length > 0) {
      await fetch("https://nodejs-production-7176.up.railway.app/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks)
      });
      console.log(`✅ Задачі для лабораторії ${lab.partner} збережено у бекенд`);
    }

    return tasks;

  } catch (err) {
    console.error("❌ Помилка при генерації задач:", err);
    alert("⚠️ Не вдалося згенерувати задачі. Перевірте консоль.");
    return [];
  }
}

function preferTueThu(date) {
  if (!(date instanceof Date) || isNaN(date)) return date;

  const day = date.getDay(); // 0 = неділя, 1 = понеділок, ..., 6 = субота

  // Якщо вже вівторок (2) або четвер (4) → залишаємо
  if (day === 2 || day === 4) return date;

  // Інакше шукаємо найближчий вівторок або четвер
  const newDate = new Date(date);
  while (newDate.getDay() !== 2 && newDate.getDay() !== 4) {
    newDate.setDate(newDate.getDate() + 1);
  }
  return newDate;
}
function nextWorkingDay(date) {
  if (!(date instanceof Date) || isNaN(date)) return date;

  const newDate = new Date(date);
  let day = newDate.getDay(); // 0 = неділя, 6 = субота

  // Якщо субота → пересуваємо на понеділок
  if (day === 6) {
    newDate.setDate(newDate.getDate() + 2);
  }
  // Якщо неділя → пересуваємо на понеділок
  else if (day === 0) {
    newDate.setDate(newDate.getDate() + 1);
  }

  return newDate;
}

async function generateMonthlyLabVisits(tasks) {
  try {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return [];
    }

    // 🔧 Групуємо задачі по місяцях
    const visitsByMonth = {};
    tasks.forEach(task => {
      const date = new Date(task.date);
      if (isNaN(date)) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!visitsByMonth[monthKey]) visitsByMonth[monthKey] = [];
      visitsByMonth[monthKey].push(task);
    });

    const visitsPayload = [];

    // 🔧 Формуємо візити для кожного місяця
    for (const [monthKey, monthTasks] of Object.entries(visitsByMonth)) {
      const visitDate = monthTasks[0].date; // перша задача визначає дату візиту
      const labId = monthTasks[0].labId;
      const labName = monthTasks[0].labName || "—";

      const visit = {
        id: `${labId}_${monthKey}_${Date.now()}`,
        labId,
        labName,
        date: visitDate,
        tasks: monthTasks,
        status: "заплановано"
      };

      visitsPayload.push(visit);
    }

    // 🔧 Зберігаємо всі візити у бекенд Railway
    if (visitsPayload.length > 0) {
      await fetch("https://nodejs-production-7176.up.railway.app/visits/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visitsPayload)
      });
      console.log(`✅ Збережено ${visitsPayload.length} візитів у бекенд`);
    }

    return visitsPayload;

  } catch (err) {
    console.error("❌ Помилка при генерації місячних візитів:", err);
    alert("⚠️ Не вдалося згенерувати місячні візити. Перевірте консоль.");
    return [];
  }
}



async function generateAllLabVisits() {
  try {
    // 🔧 Тягнемо всі лабораторії з бекенду
    const res = await fetch("https://nodejs-production-7176.up.railway.app/labcards");
    if (!res.ok) {
      throw new Error("Не вдалося завантажити лабораторії");
    }
    const labs = await res.json();

    if (!Array.isArray(labs) || labs.length === 0) {
      alert("⚠️ Лабораторій не знайдено.");
      return;
    }

    // 🔧 Для кожної лабораторії генеруємо задачі та візити
    for (const lab of labs) {
      const tasks = await generateDeviceTasksWithDueDates(lab);
      const monthlyVisits = await generateMonthlyLabVisits(tasks);

      // 🔧 Формуємо візити для бекенду
      const visitsPayload = monthlyVisits.map(v => ({
        id: `${lab.id}_${v.date}_${Date.now()}`,
        labId: lab.id,
        labName: lab.partner,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      }));

      // 🔧 Відправляємо у бекенд Railway
      await fetch("https://nodejs-production-7176.up.railway.app/visits/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visitsPayload)
      });

      console.log(`✅ Згенеровано та збережено візити для лабораторії: ${lab.partner}`);
    }

    alert("✅ Всі візити згенеровано та збережено у бекенд!");

  } catch (err) {
    console.error("❌ Помилка при генерації візитів:", err);
    alert("⚠️ Не вдалося згенерувати візити. Перевірте консоль.");
  }
}

async function applyFieldUpdatesFromVisits() {
  try {
    // 🔧 Тягнемо всі візити з бекенду
    const res = await fetch("https://nodejs-production-7176.up.railway.app/visits");
    if (!res.ok) {
      throw new Error("Не вдалося завантажити візити");
    }
    const visits = await res.json();

    if (!Array.isArray(visits) || visits.length === 0) {
      alert("⚠️ Візитів не знайдено.");
      return;
    }

    // 🔧 Групуємо візити по лабораторіях
    const visitsByLab = {};
    visits.forEach(v => {
      if (!visitsByLab[v.labId]) visitsByLab[v.labId] = [];
      visitsByLab[v.labId].push(v);
    });

    // 🔧 Для кожної лабораторії оновлюємо поля
    for (const labId of Object.keys(visitsByLab)) {
      const labRes = await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${labId}`);
      if (!labRes.ok) continue;
      const lab = await labRes.json();

      const labVisits = visitsByLab[labId];

      // 🔧 Оновлюємо поля на основі задач
      for (const visit of labVisits) {
        if (visit.status !== "виконано") continue;

        for (const task of visit.tasks || []) {
          if (task.taskType === "service") {
            // оновлюємо дату останнього сервісу
            const device = lab.devices.find(d => d.device === task.device);
            if (device) {
              device.lastService = task.date;
            }
          }

          if (task.taskType === "reagents") {
            // оновлюємо дату останнього замовлення реагентів
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

      // 🔧 Відправляємо оновлену лабораторію у бекенд
      await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${labId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lab)
      });

      console.log(`✅ Оновлено лабораторію: ${lab.partner}`);
    }

    alert("✅ Поля лабораторій оновлено на основі виконаних візитів!");

  } catch (err) {
    console.error("❌ Помилка при оновленні лабораторій:", err);
    alert("⚠️ Не вдалося оновити лабораторії. Перевірте консоль.");
  }
}


async function processVisitReport(visitId, reportData) {
  try {
    // 🔧 Тягнемо візит з бекенду
    const res = await fetch(`https://nodejs-production-7176.up.railway.app/visits/${visitId}`);
    if (!res.ok) {
      throw new Error("Не вдалося знайти візит");
    }
    const visit = await res.json();

    // 🔧 Оновлюємо статус візиту
    visit.status = "виконано";
    visit.report = reportData;

    // 🔧 Зберігаємо оновлений візит у бекенд
    await fetch(`https://nodejs-production-7176.up.railway.app/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visit)
    });

    // 🔧 Тягнемо лабораторію
    const labRes = await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${visit.labId}`);
    if (!labRes.ok) {
      throw new Error("Не вдалося знайти лабораторію");
    }
    const lab = await labRes.json();

    // 🔧 Оновлюємо поля лабораторії на основі задач у звіті
    for (const task of visit.tasks || []) {
      if (task.taskType === "service") {
        const device = lab.devices.find(d => d.device === task.device);
        if (device) {
          device.lastService = task.date;
        }
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

    // 🔧 Зберігаємо оновлену лабораторію у бекенд
    await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${lab.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lab)
    });

    alert("✅ Звіт оброблено, візит та лабораторія оновлені у бекенд!");

  } catch (err) {
    console.error("❌ Помилка при обробці звіту:", err);
    alert("⚠️ Не вдалося обробити звіт. Перевірте консоль.");
  }
}


async function saveLabCard() {
  try {
    const today = new Date();

    const labCard = {
      id: document.getElementById("labEdrpou")?.value.trim() || `${Date.now()}`,
      partner: document.getElementById("partnerName")?.value.trim(),
      region: document.getElementById("region")?.value.trim(),
      city: document.getElementById("city")?.value.trim(),
      institution: document.getElementById("lpz")?.value.trim(),
      address: document.getElementById("labAddress")?.value.trim(),
      contractor: document.getElementById("contractor")?.value.trim(),
      phone: document.getElementById("phone")?.value.trim(),
      edrpou: document.getElementById("labEdrpou")?.value.trim(),
      manager: document.getElementById("labManager")?.value.trim(),
      devices: [],
      tasks: [],
      lastUpdated: today.toISOString(),
      saveDate: today.toISOString()
    };

    if (!labCard.partner || !labCard.region || !labCard.city || !labCard.institution) {
      alert("⚠️ Заповніть обов'язкові поля: Контрагент, Область, Місто, ЛПЗ.");
      return;
    }

    // 🔧 Генерація задач і візитів
    const deviceTasks = await generateDeviceTasksWithDueDates(labCard);
    const monthlyVisits = await generateMonthlyLabVisits(deviceTasks);
    labCard.tasks = deviceTasks;

    // 🔧 Збереження у бекенд
    await fetch("https://nodejs-production-7176.up.railway.app/labcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(labCard)
    });

    await fetch("https://nodejs-production-7176.up.railway.app/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(monthlyVisits.map(v => ({
        id: `${labCard.id}_${v.date}_${Date.now()}`,
        labId: labCard.id,
        labName: labCard.partner,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      })))
    });

    // 🔧 Локальне збереження
    let allCards = JSON.parse(localStorage.getItem("labCards") || "[]");
    const idx = allCards.findIndex(c => c.id === labCard.id);
    if (idx !== -1) allCards[idx] = labCard; else allCards.push(labCard);
    localStorage.setItem("labCards", JSON.stringify(allCards));

    let visits = JSON.parse(localStorage.getItem("visits") || "[]");
    visits = visits.filter(v => v.labId !== labCard.id);
    monthlyVisits.forEach(v => visits.push({
      id: `${labCard.id}_${v.date}_${Date.now()}`,
      labId: labCard.id,
      labName: labCard.partner,
      date: v.date,
      tasks: v.tasks,
      status: "заплановано"
    }));
    localStorage.setItem("visits", JSON.stringify(visits));

    alert("✅ Лабораторію збережено і візити відправлено у бекенд!");
    window.location.href = "./index.html";

  } catch (err) {
    console.error("❌ Помилка при збереженні лабораторії:", err);
    alert("⚠️ Сталася помилка при збереженні. Перевірте консоль.");
  }
}



async function deleteLab(labId) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;

  try {
    // 🔧 Видаляємо лабораторію з бекенду
    await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${labId}`, {
      method: "DELETE"
    });

    // 🔧 Видаляємо всі візити цієї лабораторії
    await fetch(`https://nodejs-production-7176.up.railway.app/visits/byLab/${labId}`, {
      method: "DELETE"
    });

    alert("✅ Лабораторію та її візити видалено з бекенду!");

    // 🔧 Перерендеримо список
    renderLabCards();

  } catch (err) {
    console.error("❌ Помилка при видаленні лабораторії:", err);
    alert("⚠️ Не вдалося видалити лабораторію. Перевірте консоль.");
  }
}


async function editLabCard(labId) {
  try {
    // 🔧 Тягнемо дані лабораторії з бекенду
    const res = await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${labId}`);
    if (!res.ok) {
      throw new Error("Не вдалося завантажити лабораторію для редагування");
    }
    const lab = await res.json();

    // 🔧 Зберігаємо у sessionStorage (щоб передати на labcard.html)
    sessionStorage.setItem("editLabCard", JSON.stringify({ lab }));

    // 🔧 Перенаправляємо на форму редагування
    window.location.href = "labcard.html";

  } catch (err) {
    console.error("❌ Помилка при редагуванні лабораторії:", err);
    alert("⚠️ Не вдалося відкрити лабораторію для редагування.");
  }
}


async function renderLabCards(filteredLabs = null) {
  const container = document.getElementById("labCardsContainer");
  if (!container) {
    console.warn("⚠️ labCardsContainer не знайдено в DOM");
    return;
  }
  container.innerHTML = "⏳ Завантаження лабораторій...";

  try {
    // Якщо не передали масив — тягнемо всі лабораторії з бекенду
    let labs = filteredLabs;
    if (!labs) {
      const res = await fetch("https://nodejs-production-7176.up.railway.app/labcards");
      labs = await res.json();
    }

    container.innerHTML = "";

    // Панель фільтрів
    const filterBar = document.createElement("div");
    filterBar.className = "filter-bar";
    filterBar.innerHTML = `
      <label>📍 Регіон:
        <select id="regionFilter"><option value="">Усі</option></select>
      </label>
      <label>👤 Менеджер:
        <select id="managerFilter"><option value="">Усі</option></select>
      </label>
      <label>📄 КП:
        <select id="kpFilter"><option value="">Усі</option></select>
      </label>
    `;
    container.appendChild(filterBar);

    // Заповнення опцій фільтрів

      const uniqueValues = {
  region: new Set(labs.map(l => l.region).filter(Boolean)),
  manager: new Set(labs.map(l => l.manager).filter(Boolean)),
  kp: new Set(labs.flatMap(l => l.devices?.map(d => d.kp)).filter(Boolean))
};



    if (uniqueValues?.region) {
      [...uniqueValues.region].forEach(r => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r;
        filterBar.querySelector("#regionFilter").appendChild(opt);
      });
    }
    if (uniqueValues?.manager) {
      [...uniqueValues.manager].forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        filterBar.querySelector("#managerFilter").appendChild(opt);
      });
    }
    if (uniqueValues?.kp) {
      [...uniqueValues.kp].forEach(k => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = k;
        filterBar.querySelector("#kpFilter").appendChild(opt);
      });
    }

    document.getElementById("regionFilter").addEventListener("change", applyFilters);
    document.getElementById("managerFilter").addEventListener("change", applyFilters);
    document.getElementById("kpFilter").addEventListener("change", applyFilters);

    if (!Array.isArray(labs) || labs.length === 0) {
      container.innerHTML += "<p>⚠️ Лабораторій не знайдено.</p>";
      return;
    }

    // Картки
    labs.forEach((lab, index) => {
      const div = document.createElement("div");
      div.className = "lab-card";

      const devicesHtml = Array.isArray(lab.devices)
        ? lab.devices.map(d => `
          <li>
            🔧 <strong>${d.device}</strong><br>
            📅 Продано: ${d.soldDate || "—"}<br>
            🛠️ Сервіс: ${d.lastService || "—"}<br>
            📄 КП: ${d.kp || "—"}<br>
            🔧 Замінені деталі: ${d.replacedParts || "—"}
          </li>
        `).join("")
        : "";

      const tasksHtml = Array.isArray(lab.tasks) && lab.tasks.length
        ? `
          <h4>🗓️ Прев’ю задач:</h4>
          <ul class="task-list">
            ${lab.tasks.map(task => {
              const dateStr = task.date || "—";
              const taskDate = new Date(dateStr);
              const today = new Date();
              const urgentThreshold = new Date();
              urgentThreshold.setDate(today.getDate() + 7);

              let priorityClass = "priority-green";
              if (taskDate < today) priorityClass = "priority-red";
              else if (taskDate <= urgentThreshold) priorityClass = "priority-yellow";

              const subtasks = Array.isArray(task.tasks)
                ? task.tasks.map(sub => `<li>${sub.priority} ${sub.action} (${sub.device})</li>`).join("")
                : "";

              return `
                <li class="${priorityClass}">
                  <strong>${dateStr}</strong>: ${task.title}
                  ${subtasks ? `<ul>${subtasks}</ul>` : ""}
                </li>
              `;
            }).join("")}
          </ul>
        `
        : "";

      div.innerHTML = `
        <details>
          <summary>
            <h3>${index + 1}. ${lab.partner || "—"}</h3>
            <p>📍 ${lab.region || "—"}, ${lab.city || "—"}</p>
          </summary>
          <div class="lab-actions">
            <button onclick="editLabCard('${lab.id}')">✏️ Редагувати</button>
            <button onclick="deleteLab('${lab.id}')">🗑️ Видалити</button>
            <button onclick="planVisit('${lab.id}')">📅 Запланувати візит</button>
          </div>
          <p>🏥 ${lab.institution || "—"}</p>
          <p>📫 Адреса: ${lab.address || "—"}</p>
          <p>🤝 Контактна особа: ${lab.contractor || "—"}</p>
          <p>📞 Телефон: ${lab.phone || "—"}</p>
          <p>🆔 ЄДРПОУ: ${lab.edrpou || "—"}</p>
          <p>👤 Менеджер: ${lab.manager || "—"}</p>
          <ul>${devicesHtml}</ul>
          ${tasksHtml}
        </details>
      `;

      container.appendChild(div);
    });

    // Кнопка переходу до календаря
    const calendarBtn = document.createElement("div");
    calendarBtn.className = "calendar-btn";
    calendarBtn.innerHTML = `<a href="../calendar/calendar.html"><button>📅 Перейти до календаря задач</button></a>`;
    container.appendChild(calendarBtn);

  } catch (err) {
    console.error("❌ Помилка завантаження лабораторій:", err);
    container.innerHTML = "<p>⚠️ Не вдалося завантажити лабораторії з бекенду.</p>";
  }
}
async function renderTasksPreview(labId) {
  const container = document.getElementById("tasksPreviewContainer");
  if (!container) {
    console.warn("⚠️ tasksPreviewContainer не знайдено в DOM");
    return;
  }
  container.innerHTML = "⏳ Завантаження задач...";

  try {
    // 🔧 Тягнемо задачі з бекенду
    const res = await fetch(`https://nodejs-production-7176.up.railway.app/tasks/byLab/${labId}`);
    if (!res.ok) {
      throw new Error("Не вдалося завантажити задачі");
    }
    const tasks = await res.json();

    container.innerHTML = "";

    if (!Array.isArray(tasks) || tasks.length === 0) {
      container.innerHTML = "<p>⚠️ Задач для цієї лабораторії не знайдено.</p>";
      return;
    }

    // 🔧 Сортуємо задачі за датою
    tasks.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 🔧 Малюємо список задач
    const list = document.createElement("ul");
    list.className = "task-list";

    tasks.forEach(t => {
      const dateStr = t.date || "—";
      const taskType = t.taskType === "service" ? "🔧 Сервіс" : "🧪 Реагенти";
      const reagentInfo = t.taskType === "reagents"
        ? `<br>Реагент: ${t.reagentName}, кількість: ${t.neededQuantity}`
        : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${dateStr}</strong> — ${taskType} для <em>${t.device}</em><br>
        ${t.title || ""}${reagentInfo}
      `;
      list.appendChild(li);
    });

    container.appendChild(list);

  } catch (err) {
    console.error("❌ Помилка при рендері задач:", err);
    container.innerHTML = "<p>⚠️ Не вдалося завантажити задачі з бекенду.</p>";
  }
}


async function manualVisit(labId) {
  try {
    // 🔧 Тягнемо дані лабораторії з бекенду
    const res = await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${labId}`);
    if (!res.ok) {
      throw new Error("Не вдалося знайти лабораторію");
    }
    const lab = await res.json();

    // 🔧 Запитуємо дату у користувача
    const date = prompt(`📅 Вкажіть дату візиту для ${lab.partner} (${lab.city}) у форматі YYYY-MM-DD:`);
    if (!date) return;

    const parsed = new Date(date);
    if (isNaN(parsed)) {
      alert("❌ Невірний формат дати. Використовуйте YYYY-MM-DD.");
      return;
    }

    const dateStr = toISODateLocal(parsed);

    // 🔧 Формуємо новий візит
    const visit = {
      id: `${lab.id}_${Date.now()}`,
      labId: lab.id,
      labName: lab.partner,
      date: dateStr,
      tasks: [], // можна додати generateDeviceTasksWithDueDates(lab)
      status: "заплановано"
    };

    // 🔧 Відправляємо у бекенд Railway
    await fetch("https://nodejs-production-7176.up.railway.app/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visit)
    });

    alert(`✅ Візит до ${lab.partner} (${lab.city}) заплановано на ${dateStr}`);

    // 🔧 Перерендеримо список лабораторій
    renderLabCards();

  } catch (err) {
    console.error("❌ Помилка при плануванні візиту:", err);
    alert("⚠️ Не вдалося запланувати візит. Перевірте консоль.");
  }
}


async function resetFilters() {
  try {
    // 🔧 очищаємо всі поля фільтрів
    document.getElementById("filterName").value = "";
    document.getElementById("filterRegion").value = "";
    document.getElementById("filterCity").value = "";
    document.getElementById("filterInstitution").value = "";
    document.getElementById("filterDevice").value = "";
    document.getElementById("filterContractor").value = "";
    document.getElementById("filterPhone").value = "";
    document.getElementById("filterEdrpou").value = "";
    document.getElementById("filterManager").value = "";
    document.getElementById("kpFilter").value = "";

    // 🔧 тягнемо всі лабораторії з бекенду Railway
    const res = await fetch("https://nodejs-production-7176.up.railway.app/labcards");
    if (!res.ok) {
      throw new Error("Не вдалося завантажити лабораторії");
    }
    const labs = await res.json();

    // 🔧 рендеримо повний список
    renderLabCards(labs);

  } catch (err) {
    console.error("❌ Помилка при скиданні фільтрів:", err);
    alert("⚠️ Не вдалося відновити список лабораторій. Перевірте консоль.");
  }
}


async function showTaskPreviewBeforeSave(labCard, onConfirm) {
  try {
    // 🔧 Генеруємо задачі для лабораторії (актуальні перед збереженням)
    const tasks = await generateDeviceTasksWithDueDates(labCard);

    // 🔧 Формуємо прев’ю
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 20px;
      z-index: 1000;
      max-width: 600px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    const taskItems = tasks.map(t => `
      <li style="margin-bottom:10px;">
        <strong>${t.date || "—"}</strong>: ${t.title}
        ${t.reagentName ? `<br>🔬 Реагент: ${t.reagentName}, кількість: ${t.neededQuantity}` : ""}
      </li>
    `).join("");

    modal.innerHTML = `
      <h3>🗓️ Прев’ю задач для лабораторії <em>${labCard.partner}</em></h3>
      <ul style="max-height:300px; overflow-y:auto; padding-left:20px;">
        ${taskItems || "<li>Немає задач для відображення</li>"}
      </ul>
      <div style="margin-top:20px; text-align:right;">
        <button id="confirmSaveBtn">✅ Підтвердити збереження</button>
        <button id="cancelSaveBtn">❌ Скасувати</button>
      </div>
    `;

    document.body.appendChild(modal);

    // 🔧 Обробка підтвердження
    document.getElementById("confirmSaveBtn").addEventListener("click", async () => {
      modal.remove();

      try {
        // Збереження лабораторії у бекенд
        await fetch("https://nodejs-production-7176.up.railway.app/labcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(labCard)
        });

        // Збереження задач як візитів у бекенд
        const visit = {
          id: `${labCard.id}_${Date.now()}`,
          labId: labCard.id,
          labName: labCard.partner,
          date: new Date().toISOString().split("T")[0],
          tasks,
          status: "заплановано"
        };

        await fetch("https://nodejs-production-7176.up.railway.app/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(visit)
        });

        alert("✅ Лабораторію та задачі збережено у бекенд!");
        if (typeof onConfirm === "function") onConfirm();

      } catch (err) {
        console.error("❌ Помилка при збереженні:", err);
        alert("⚠️ Не вдалося зберегти лабораторію. Перевірте консоль.");
      }
    });

    // 🔧 Обробка скасування
    document.getElementById("cancelSaveBtn").addEventListener("click", () => {
      modal.remove();
    });

  } catch (err) {
    console.error("❌ Помилка при генерації прев’ю задач:", err);
    alert("⚠️ Не вдалося згенерувати прев’ю задач.");
  }
}


async function planVisit(labId) {
  try {
    const selectedDate = sessionStorage.getItem("selectedDate");
    if (!selectedDate) {
      alert("⚠️ Спочатку виберіть дату у календарі.");
      return;
    }

    // 🔧 Тягнемо лабораторію з бекенду
    const res = await fetch(`https://nodejs-production-7176.up.railway.app/labcards/${labId}`);
    if (!res.ok) {
      throw new Error("Не вдалося знайти лабораторію");
    }
    const lab = await res.json();

    // 🔧 Генеруємо задачі для цього візиту
    const tasks = await generateDeviceTasksWithDueDates(lab);

    // 🔧 Формуємо новий візит
    const newVisit = {
      id: `${labId}_${Date.now()}`,
      labId: labId,
      labName: lab.partner,
      date: selectedDate,
      tasks,
      status: "заплановано"
    };

    // 🔧 Відправляємо у бекенд Railway
    await fetch("https://nodejs-production-7176.up.railway.app/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newVisit)
    });

    alert("✅ Візит заплановано!");

    // 🔧 Перенаправлення у календар
    setTimeout(() => {
      window.location.href = "../calendar/calendar.html";
    }, 500);

  } catch (err) {
    console.error("❌ Помилка при плануванні візиту:", err);
    alert("⚠️ Не вдалося запланувати візит. Перевірте консоль.");
  }
}
  // 🔧 Рендер полів для реагентів
function renderReagentFields(container, index, prefill = {}) {
  const deviceSelect = document.getElementById(`device_${index}`);
  if (!deviceSelect) return;
  const deviceName = deviceSelect.value;
  const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const config = calculators[configKey];
  if (!config || !config.reagents) return;
  config.reagents.forEach(r => {
    const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");  
    const block = document.createElement("div");
    block.className = "reagent-block";
    block.innerHTML = `
      <h4>Реагент: ${r.name}</h4>
      <label>Останнє замовлення (упаковок):
        <input type="number" id="reagentCount_${index}_${safeId}" min="0" value="${prefill[r.name]?.lastOrderCount || 0}">  
      </label>
      <label>Дата останнього замовлення:  
        <input type="date" id="reagentDate_${index}_${safeId}" value="${prefill[r.name]?.lastOrderDate || ''}">
      </label>
      <hr>
    `;
    container.appendChild(block);
  });
}
// 🔧 Рендер поля для щоденного обсягу тестів
function renderTestCountField(container, index, prefill = 0) {
  const block = document.createElement("div");
  block.className = "test-count-block";
  block.innerHTML = `
    <label>Щоденний обсяг тестів:
      <input type="number" id="testCount_${index}" min="0" value="${prefill}">
    </label>
    <hr>
  `;
  container.appendChild(block);
}
async function generateDeviceTasksWithDueDates(lab) {
  const tasks = [];
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + 3); // наступні 3 місяці        
  for (const device of lab.devices) {
    const deviceName = device.device;
    const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const config = calculators[configKey];
    if (!config) continue;
    // Сервісне обслуговування
    if (config.serviceIntervalMonths && device.lastService) {
      const lastServiceDate = new Date(device.lastService); 
      if (lastServiceDate instanceof Date && !isNaN(lastServiceDate)) {
        const nextServiceDate = new Date(lastServiceDate);
        nextServiceDate.setMonth(nextServiceDate.getMonth() + config.serviceIntervalMonths);
        const dueStr = toISODateLocal(nextServiceDate);
        tasks.push({
          type: "service",
          device: deviceName,
          taskType: "service",
          title: `Сервісне обслуговування ${deviceName}`,
          date: dueStr,
          priority: "🟢" ,  
          source: "auto"
        });
      }
    }
    // Реагенти
    if (config.reagents && Array.isArray(config.reagents)) {  
      for (const r of config.reagents) {
        const reagentInfo = device.reagentsInfo ? device.reagentsInfo[r.name] : null;
        if (reagentInfo && reagentInfo.postponed) continue;
        let lastOrderDate = reagentInfo && reagentInfo.lastOrderDate ? new Date(reagentInfo.lastOrderDate) : null;
        if (!lastOrderDate || isNaN(lastOrderDate)) {
          lastOrderDate = new Date(); 
          lastOrderDate.setDate(lastOrderDate.getDate() - r.defaultLeadTimeDays); 
        }
        const nextOrderDate = new Date(lastOrderDate);
        nextOrderDate.setDate(nextOrderDate.getDate() + r.defaultLeadTimeDays);
        if (nextOrderDate > endDate) continue; 
        const dueStr = toISODateLocal(nextOrderDate);
        tasks.push({
          type: "reagents",
          device: deviceName,
          taskType: "reagents", 
          reagentName: r.name,
          neededQuantity: r.defaultOrderQuantity,
          title: `Замовити реагент ${r.name} для ${deviceName}`,
          date: dueStr,
          priority: "⚠️",
          source: "auto"
        });
      }

    }
  } 
  return tasks;
}
// Глобальні прив’язки
window.onRegionInput = onRegionInput;
window.onCityInput = onCityInput;
window.onLPZInput = onLPZInput;
window.addDevice = addDevice;
window.saveLabCard = saveLabCard;
window.loadLPZList = loadLPZList;
window.editLabCard = editLabCard;
window.deleteLab = deleteLab;
window.kpListByDevice = kpListByDevice;
window.generateAllLabVisits = generateAllLabVisits;
window.applyFieldUpdatesFromVisits = applyFieldUpdatesFromVisits;
window.processVisitReport = processVisitReport;
window.generateDeviceTasksWithDueDates = generateDeviceTasksWithDueDates;
window.generateMonthlyLabVisits = generateMonthlyLabVisits;
window.resetFilters = resetFilters;
window.renderLabCards = renderLabCards;
window.manualVisit = manualVisit;
window.applyFilters = applyFilters;
window.showTaskPreviewBeforeSave = showTaskPreviewBeforeSave;
window.planVisit = planVisit;
window.renderAnalysisFields = renderAnalysisFields;
window.renderReagentFields = renderReagentFields;
window.renderTestCountField = renderTestCountField;
window.kpListByDevice = kpListByDevice;
window.saveLabCardToBackend = saveLabCardToBackend;
window.loadLabCards = loadLabCards;
window.toISODateLocal = toISODateLocal;
window.nextWorkingDay = nextWorkingDay;
window.preferTueThu = preferTueThu; 
window.renderVisitPlanner = renderVisitPlanner;








<!-- Тільки після цього підключай свій код -->

<script>
let labsData = [];
let filteredLabs = [];
let currentPage = 1;
const pageSize = 25;

let map;
let markersLayer;
let currentLabId = null;

// ==========================
// Модалка створення візиту
// ==========================
function openCreateVisitModal(labId) {
  window.currentLabId = labId;
  document.getElementById("createVisitModal").style.display = "block";
}

function closeCreateVisitModal() {
  document.getElementById("createVisitModal").style.display = "none";
}

function confirmCreateVisit() {
  const manager = localStorage.getItem("userLogin") || "Невідомо";

  const date = document.getElementById("visitDate").value;
  const time = document.getElementById("visitTime").value;

  if (!date || !time) {
    alert("❌ Виберіть дату та час");
    return;
  }

  const fullDateTime = new Date(`${date}T${time}`);

  const newVisit = {
    id: Date.now(), // тимчасовий ID
    labId: window.currentLabId,
    date: fullDateTime.toISOString(),
    manager,
    status: "planned",
    notes: ""
  };

  // додаємо у кеш
  const visits = JSON.parse(localStorage.getItem("visits") || "[]");
  visits.push(newVisit);
  localStorage.setItem("visits", JSON.stringify(visits));
  window.visitsCache = visits;

  alert("✅ Візит додано у кеш!");
  closeCreateVisitModal();
  window.location.href = "../calendar/calendar.html"; // перенаправлення до календаря
}

// ==========================
// Мапа та закупівлі
// ==========================
function initMap() {
  if (map) return;
  map = L.map('map').setView([50.45, 30.52], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  const drawnItems = new L.FeatureGroup().addTo(map);

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
    const bounds = layer.getBounds();
    const labsInArea = filterLabsByPolygon(bounds);
    const purchases = fetchPurchases(labsInArea.map(l => l._id));
    console.log("🧾 Закупівлі:", purchases);
    openPurchasesModal(purchases);
  });
}

function filterLabsByPolygon(bounds) {
  return labsData.filter(lab => {
    if (!lab.lat || !lab.lng) return false;
    const point = L.latLng(lab.lat, lab.lng);
    return bounds.contains(point);
  });
}

function fetchPurchases(labIds) {
  // беремо з кешу, який підтягнувся при startDay()
  const purchases = JSON.parse(localStorage.getItem("purchases") || "[]");
  return purchases.filter(p => labIds.includes(p.labId));
}

function openPurchasesModal(purchases) {
  const tbody = document.querySelector("#purchasesTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  purchases.forEach(p => {
    const row = `
      <tr>
        <td>${p.labName || "—"}</td>
        <td>${p.city || "—"}</td>
        <td>${p.item || "—"}</td>
        <td>${p.amount || "—"}</td>
        <td>${p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });

  document.getElementById("purchasesModal").style.display = "block";
}

function closePurchasesModal() {
  document.getElementById("purchasesModal").style.display = "none";
}
// Видалення лабораторії з кешу
function deleteLab(labId) {
  if (!confirm("Ви впевнені, що хочете видалити лабораторію?")) return;

  let labs = JSON.parse(localStorage.getItem("labs") || "[]");
  labs = labs.filter(l => l._id !== labId);

  localStorage.setItem("labs", JSON.stringify(labs));
  window.labsCache = labs;
  labsData = labs;
  filteredLabs = labs;

  alert("✅ Лабораторію видалено з кешу");
  renderLabs(filteredLabs);
  updateMap(filteredLabs);
}

// 5. Пагінація
function renderPagination(data = filteredLabs) {
  const totalPages = Math.ceil(data.length / pageSize);
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.style.backgroundColor = "#003300";
    btn.onclick = () => { currentPage = i; renderLabs(data); };
    pagination.appendChild(btn);
  }
}

// 6. Фільтрація
function applyFilters() {
  let filtered = labsData;

  const getVal = id => document.getElementById(id)?.value;

  const filters = {
    partner: getVal("filterPartner"),
    region: getVal("filterRegion"),
    city: getVal("filterCity"),
    institution: getVal("filterInstitution"),
    edrpou: getVal("filterEdrpou"),
    manager: getVal("filterManager"),
    deviceCategory: getVal("filterDevice"),
    deviceFilter: getVal("filterDevices")
  };

  if (filters.partner) filtered = filtered.filter(l => l.partner === filters.partner);
  if (filters.region) filtered = filtered.filter(l => l.region === filters.region);
  if (filters.city) filtered = filtered.filter(l => l.city === filters.city);
  if (filters.institution) filtered = filtered.filter(l => l.institution === filters.institution);
  if (filters.edrpou) filtered = filtered.filter(l => l.edrpou === filters.edrpou);
  if (filters.manager) filtered = filtered.filter(l => l.manager === filters.manager);
  if (filters.deviceCategory) {
    filtered = filtered.filter(l =>
      (l.devices || []).some(d => d.category === filters.deviceCategory || d.device === filters.deviceCategory)
    );
  }
  if (filters.deviceFilter === "with") {
    filtered = filtered.filter(l => l.devices && l.devices.length > 0);
  } else if (filters.deviceFilter === "without") {
    filtered = filtered.filter(l => !l.devices || l.devices.length === 0);
  }

  filteredLabs = filtered;
  currentPage = 1;
  renderLabs(filteredLabs);
  populateFilterOptions(filteredLabs);
  updateMap(filteredLabs);

  if (filteredLabs.length === 1) {
    const lab = filteredLabs[0];
    document.getElementById("filterPartner").value = lab.partner || "";
    document.getElementById("filterRegion").value = lab.region || "";
    document.getElementById("filterCity").value = lab.city || "";
    document.getElementById("filterInstitution").value = lab.institution || "";
    document.getElementById("filterEdrpou").value = lab.edrpou || "";
    if (document.getElementById("filterManager")) {
      document.getElementById("filterManager").value = lab.manager || "";
    }
  }
}

// 7. Підказки
function populateFilterOptions(source = labsData) {
  const setOptions = (id, values) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = [...new Set(values.filter(Boolean))]
      .map(v => `<option value="${v}">`).join("");
  };

  setOptions("partnerOptions", source.map(l => l.partner));
  setOptions("regionOptions", source.map(l => l.region));
  setOptions("cityOptions", source.map(l => l.city));
  setOptions("institutionOptions", source.map(l => l.institution));
  setOptions("edrpouOptions", source.map(l => l.edrpou));
  setOptions("managerOptions", source.map(l => l.manager));

  const deviceOptions = document.getElementById("deviceOptions");
  if (deviceOptions) {
    deviceOptions.innerHTML = "";
    const uniqueDevices = new Set();
    source.forEach(lab => (lab.devices || []).forEach(d => d.category && uniqueDevices.add(d.category)));
    uniqueDevices.forEach(val => {
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
      if (d.kp) uniqueKp.add(d.kp);
    }));
    uniqueKp.forEach(val => {
      const option = document.createElement("option");
      option.value = val;
      kpOptions.appendChild(option);
    });
  }
}

// 8. Скидання фільтрів
function resetFilters() {
  document.querySelectorAll("#filters input, #filters select").forEach(el => el.value = "");
  document.getElementById("filterDevices").value = "all";
  filteredLabs = labsData;
  currentPage = 1;
  renderLabs(filteredLabs);
  populateFilterOptions(labsData);
  updateMap(filteredLabs);
}

// 9. Менеджер-фільтр
function showManagerFilterIfAllowed() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role === "admin" || payload.role === "manager") {
      const container = document.getElementById("managerFilterContainer");
      container.innerHTML = `
        <label>Менеджер:
          <input type="text" id="filterManager" list="managerOptions">
          <datalist id="managerOptions"></datalist>
        </label>
      `;
      populateFilterOptions(labsData);
    } else {
      const container = document.getElementById("managerFilterContainer");
      if (container) container.innerHTML = "";
    }
  } catch (err) {
    console.error("❌ Помилка розбору токена:", err);
  }
}

// 10. Модальне вікно
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

// 11. Ініціалізація при завантаженні сторінки
document.addEventListener("DOMContentLoaded", () => {
  initMap();

  // тепер беремо лабораторії з кешу
  labsData = JSON.parse(localStorage.getItem("labs") || "[]");
  filteredLabs = labsData;

  showManagerFilterIfAllowed();
  populateFilterOptions(labsData);
  renderLabs(filteredLabs);
  updateMap(filteredLabs);

  // Автоматичне застосування фільтрів при зміні будь-якого поля
  document.querySelectorAll("#filters input, #filters select").forEach(el => {
    el.addEventListener("change", applyFilters);
  });

  // Кнопка скидання фільтрів
  const resetBtn = document.querySelector("button[onclick='resetFilters()']");
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);
});

// Експорт закупівель у Excel
function downloadExcel() {
  const table = document.getElementById("purchasesTable");
  if (!table) {
    alert("❌ Таблиця не знайдена");
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Закупівлі");

  XLSX.writeFile(workbook, `zakupivli_${new Date().toISOString().split("T")[0]}.xlsx`);
}
</Script>
</body>
</html>