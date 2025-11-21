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
  fetch("./lpzlist.json")
    .then(res => res.json())
    .then(data => {
      console.log("LPZ list loaded:", data);
      lpzList = data || [];
      filteredList = [...lpzList];
      updateRegionList();
      updateCityList();
      updateLPZList();
    })
    .catch(err => console.error("❌ Помилка завантаження lpzlist.json:", err));
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

function onRegionInput() {
  const regionEl = document.getElementById("region");
  if (!regionEl) return;
  const region = regionEl.value.toLowerCase();
  filteredList = lpzList.filter(l => l.region.toLowerCase().includes(region));
  updateCityList();
  updateLPZList();
  autoFillIfSingle();
}

function onCityInput() {
  const regionEl = document.getElementById("region");
  const cityEl = document.getElementById("city");
  if (!regionEl || !cityEl) return;
  const region = regionEl.value.toLowerCase();
  const city = cityEl.value.toLowerCase();
  filteredList = lpzList.filter(l =>
    l.region.toLowerCase().includes(region) &&
    l.city.toLowerCase().includes(city)
  );
  updateLPZList();
  autoFillIfSingle();
}

function onLPZInput() {
  const regionEl = document.getElementById("region");
  const cityEl = document.getElementById("city");
  const lpzEl = document.getElementById("lpz");
  if (!regionEl || !cityEl || !lpzEl) return;
  const region = regionEl.value.toLowerCase();
  const city = cityEl.value.toLowerCase();
  const name = lpzEl.value.toLowerCase();
  filteredList = lpzList.filter(l =>
    l.region.toLowerCase().includes(region) &&
    l.city.toLowerCase().includes(city) &&
    l.name.toLowerCase().includes(name)
  );
  autoFillIfSingle();
}

function autoFillIfSingle() {
  if (filteredList.length === 1) {
    const l = filteredList[0];
    const regionEl = document.getElementById("region");
    const cityEl = document.getElementById("city");
    const lpzEl = document.getElementById("lpz");
    const addrEl = document.getElementById("labAddress");
    const edrpouEl = document.getElementById("labEdrpou");
    const managerEl = document.getElementById("labManager");

    if (regionEl) regionEl.value = l.region;
    if (cityEl) cityEl.value = l.city;
    if (lpzEl) lpzEl.value = l.name;
    if (addrEl) addrEl.value = l.address;
    if (edrpouEl) edrpouEl.value = l.edrpou || "";
    if (managerEl) managerEl.value = l.manager || "";
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

function generateDeviceTasksWithDueDates(lab) {
  const tasks = [];
  const baseDate = new Date(lab.saveDate || new Date());
  const endDate = new Date(baseDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  for (const device of lab.devices) {
    const { device: deviceName, testCount, reagentsInfo } = device;
    const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const config = calculators[configKey];
    if (!config || !config.reagents?.length) continue;

    for (let q = 1; q <= 4; q++) {
      const due = new Date(baseDate);
      due.setMonth(due.getMonth() + q * 3);
      const dueStr = toISODateLocal(due);

      // сервіс раз на півроку
      if (q % 2 === 0) {
        tasks.push({
          lab: lab.partner,
          city: lab.city,
          device: deviceName,
          taskType: "service",
          title: `Плановий сервіс приладу ${deviceName}`,
          date: dueStr,
          priority: "🟢",
          source: "auto"
        });
      }

      // реагенти
      for (const r of config.reagents) {
        const reagentData = reagentsInfo?.[r.name];
        const perTest = Number(r.perTest) || 0;
        const startup = Number(r.startup) || 0;
        const shutdown = Number(r.shutdown) || 0;
        const volume = Number(r.packageSize) || 0;
        if (!volume) continue;

        const daily = (perTest * testCount) + startup + shutdown;
        if (daily <= 0) continue;

        const neededQuantityQuarter = Math.ceil((daily * 63) / volume);

        if (!reagentData || !reagentData.lastOrderDate) {
          if (q === 1) {
            tasks.push({
              lab: lab.partner,
              city: lab.city,
              device: deviceName,
              taskType: "reagents",
              reagentName: r.name,
              neededQuantity: neededQuantityQuarter,
              title: `Закупівля реагенту ${r.name} (квартальна потреба: ${neededQuantityQuarter} уп.)`,
              date: dueStr,
              priority: "🔴",
              source: "auto"
            });
          }
          continue;
        }

        const lastOrderDate = new Date(reagentData.lastOrderDate);
        const daysAvailable = reagentData.lastOrderCount
          ? Math.floor((reagentData.lastOrderCount * volume) / daily)
          : 0;

        const deltaDays = Math.round((due - lastOrderDate) / (1000 * 60 * 60 * 24));

        if (daysAvailable < 14 || deltaDays >= daysAvailable) {
          tasks.push({
            lab: lab.partner,
            city: lab.city,
            device: deviceName,
            taskType: "reagents",
            reagentName: r.name,
            neededQuantity: neededQuantityQuarter,
            title: `Закупівля реагенту ${r.name} (квартальна потреба: ${neededQuantityQuarter} уп.)`,
            date: dueStr,
            priority: "🟡",
            source: "auto"
          });
        }
      }
    }
  }

  return tasks.filter(t => {
    const d = new Date(t.date);
    return d instanceof Date && !isNaN(d) && d <= endDate;
  });
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

async function generateMonthlyLabVisits(allDeviceTasks) {
  const visitsByLab = {};
  const today = new Date();

  for (const task of allDeviceTasks) {
    const labKey = `${task.lab}__${task.city}`;
    if (!visitsByLab[labKey]) visitsByLab[labKey] = [];
    visitsByLab[labKey].push(task);
  }

  const monthlyVisits = [];

  for (const labKey in visitsByLab) {
    const [labName, city] = labKey.split("__");
    const tasks = visitsByLab[labKey];
    const buckets = {};

    for (const t of tasks) {
      const d = new Date(t.date);
      if (isNaN(d)) continue;
      d.setDate(d.getDate() - 14);

      const planned = preferTueThu(nextWorkingDay(d));
      const key = `${planned.getFullYear()}-${String(planned.getMonth() + 1).padStart(2, "0")}`;

      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    }

    for (const monthKey in buckets) {
      const visitTasks = buckets[monthKey];

      const preferredDate = visitTasks
        .map(t => {
          const d = new Date(t.date);
          if (isNaN(d)) return null;
          d.setDate(d.getDate() - 14);
          return preferTueThu(nextWorkingDay(d));
        })
        .filter(Boolean)
        .sort((a, b) => a - b)[0];

      if (!preferredDate) continue;

      const scheduledDate = toISODateLocal(preferredDate);

      monthlyVisits.push({
        type: "labVisit",
        title: `🔍 Візит до лабораторії ${labName}`,
        date: scheduledDate,
        lab: labName,
        city,
        tasks: visitTasks.map(t => ({
          device: t.device,
          action: t.taskType === "reagents"
            ? `Замов реагент — ${t.reagentName} (${t.neededQuantity} уп.)`
            : "Сервіс",
          priority: "🟢"
        }))
      });
    }
  }

  monthlyVisits.sort((a, b) => new Date(a.date) - new Date(b.date));
  return monthlyVisits;
}

async function generateAllLabVisits(labs) {
  const allDeviceTasks = [];

  for (const lab of labs) {
    const labTasks = await generateDeviceTasksWithDueDates(lab);
    allDeviceTasks.push(...labTasks);
  }

 const monthlyVisits = await generateMonthlyLabVisits(allDeviceTasks);
  return monthlyVisits;
}
function applyFieldUpdatesFromVisits(labs, visitReports) {
  const updatedLabs = JSON.parse(JSON.stringify(labs));

  for (const report of visitReports) {
    const lab = updatedLabs.find(l => l.partner === report.lab);
    if (!lab) continue;

    for (const update of report.updates) {
      const device = lab.devices.find(d => d.device === update.device);
      if (!device) continue;

      // гарантуємо, що reagentsInfo існує
      device.reagentsInfo = device.reagentsInfo || {};

      if (update.type === "reagents") {
        if (update.action === "ordered") {
          const info = device.reagentsInfo[update.name] || {};
          info.lastOrderCount = update.count;
          info.lastOrderDate = toISODateLocal(new Date(update.date)); // ✅ нормалізація
          device.reagentsInfo[update.name] = info;
        }

        if (update.action === "postponed") {
          device.reagentsInfo[update.name] = device.reagentsInfo[update.name] || {};
          device.reagentsInfo[update.name].postponed = true;
        }
      }

      if (update.type === "service" && update.action === "done") {
        device.lastService = toISODateLocal(new Date(update.date)); // ✅ нормалізація
      }
    }
  }

  return updatedLabs;
}

async function processVisitReport(visitReports) {
  const allLabs = loadAllLabCards();
  const updatedLabs = applyFieldUpdatesFromVisits(allLabs, visitReports);
  const newVisits = await generateAllLabVisits(updatedLabs);

  saveAllLabCards(updatedLabs);
  localStorage.setItem("visits", JSON.stringify(newVisits)); // ✅ гарантуємо, що пишемо у visits
  renderVisitPlanner(newVisits);
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

    // 🔧 Перевірка обов'язкових полів
    if (!labCard.partner || !labCard.region || !labCard.city || !labCard.institution) {
      alert("⚠️ Заповніть обов'язкові поля: Контрагент, Область, Місто, ЛПЗ.");
      return;
    }

    // 🔧 Збір даних по пристроях
    const deviceBlocks = document.querySelectorAll(".device-block");
    for (const block of deviceBlocks) {
      const idx = block.id.split("_")[1];
      const deviceName = document.getElementById(`device_${idx}`)?.value?.trim();
      if (!deviceName) continue;

      const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const config = calculators[configKey];

      const device = {
        device: deviceName,
        soldDate: document.getElementById(`soldDate_${idx}`)?.value || null,
        lastService: document.getElementById(`lastService_${idx}`)?.value || null,
        workType: document.getElementById(`workType_${idx}`)?.value || null,
        replacedParts: document.getElementById(`replacedParts_${idx}`)?.value?.trim() || null,
        kp: document.getElementById(`kpSelect_${idx}`)?.value || null,
        testCount: Number(document.getElementById(`testCount_${idx}`)?.value) || 0,
        analyses: {},
        reagentsInfo: {}
      };

      // 🔧 Аналізи для LS-1100
      if (deviceName === "LS-1100" && config?.analyses) {
        Object.keys(config.analyses).forEach(testName => {
          const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
          const countEl = document.getElementById(`analysisCount_${idx}_${safeId}`);
          const packagesEl = document.getElementById(`analysisPackages_${idx}_${safeId}`);
          const dateEl = document.getElementById(`analysisDate_${idx}_${safeId}`);

          const count = countEl ? parseInt(countEl.value || "0", 10) : 0;
          const packages = packagesEl ? parseInt(packagesEl.value || "0", 10) : 0;
          const date = dateEl && dateEl.value ? dateEl.value : null;

          device.analyses[testName] = { count, packages, date };

          if (packages > 0 && date) {
            const testsPerPackage = config.testsPerPackage || 25;
            const totalTests = packages * testsPerPackage;
            const daysAvailable = count > 0 ? Math.floor(totalTests / count) : "∞";

            labCard.tasks.push({
              lab: labCard.partner,
              city: labCard.city,
              device: deviceName,
              title: `Закупівля реагентів для ${testName} (вистачить на ${daysAvailable} днів)`,
              date,
              priority: "⚠️"
            });
          }
        });
      }

      // 🔧 Реагенти
      if (config?.reagents) {
        config.reagents.forEach(r => {
          const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");
          const count = document.getElementById(`reagentCount_${idx}_${safeId}`)?.value;
          const date = document.getElementById(`reagentDate_${idx}_${safeId}`)?.value;

          if (count || date) {
            device.reagentsInfo[r.name] = {
              lastOrderCount: count ? parseInt(count) : 0,
              lastOrderDate: date || null
            };
          }
        });
      }

      labCard.devices.push(device);
    }

    // 🔧 Генерація задач і візитів
    const deviceTasks = await generateDeviceTasksWithDueDates(labCard);
    const monthlyVisits = await generateMonthlyLabVisits(deviceTasks);

    labCard.tasks = deviceTasks;

    // 🔧 Зберігаємо лабораторію
    let allCards = JSON.parse(localStorage.getItem("labCards") || "[]");
    const idx = allCards.findIndex(c => c.id === labCard.id);
    if (idx !== -1) allCards[idx] = labCard; else allCards.push(labCard);
    localStorage.setItem("labCards", JSON.stringify(allCards));

    // 🔧 Зберігаємо візити
    let visits = JSON.parse(localStorage.getItem("visits") || "[]");
    visits = visits.filter(v => v.labId !== labCard.id);
    monthlyVisits.forEach(v => {
      visits.push({
        id: `${labCard.id}_${v.date}_${Date.now()}`,
        labId: labCard.id,
        labName: labCard.partner,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      });
    });
    localStorage.setItem("visits", JSON.stringify(visits));

    // ✅ Модальне вікно
    if (typeof showVisitsModal === "function") {
      showVisitsModal(monthlyVisits);
    } else {
      alert("✅ Лабораторію збережено і візити оновлено!");
    }

    // 🔧 Перенаправлення робимо асинхронно, щоб не блокувати
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 500);

  } catch (err) {
    console.error("❌ Помилка при збереженні лабораторії:", err);
    alert("⚠️ Сталася помилка при збереженні. Перевірте консоль.");
  }
}



function deleteLab(index) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards[index];
  labCards.splice(index, 1);
  localStorage.setItem("labCards", JSON.stringify(labCards));

  // 🔧 Видаляємо всі візити цієї лабораторії за id
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  visits = visits.filter(v => v.labId !== lab.id);
  localStorage.setItem("visits", JSON.stringify(visits));

  renderLabCards(labCards);
}

function editLabCard(index) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards[index];
  localStorage.setItem("editLabCard", JSON.stringify({ lab }));
  window.location.href = "labcard.html";
}

function renderLabCards(filteredLabs = []) {
  const container = document.getElementById("labCardsContainer");
  if (!container) {
    console.warn("⚠️ labCardsContainer не знайдено в DOM");
    return;
  }
  container.innerHTML = '';

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

  // додавання опцій через JS (з перевірками)
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

  container.appendChild(filterBar);

  document.getElementById("regionFilter").addEventListener("change", applyFilters);
  document.getElementById("managerFilter").addEventListener("change", applyFilters);
  document.getElementById("kpFilter").addEventListener("change", applyFilters);

  if (!Array.isArray(filteredLabs) || filteredLabs.length === 0) {
    container.innerHTML += "<p>⚠️ Нічого не знайдено за заданими фільтрами.</p>";
    return;
  }

  // Картки
  filteredLabs.forEach((lab, index) => {
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
            if (dateStr === "НІКОЛИ" || dateStr === "—") {
              return `<li><strong>—</strong>: ${task.title}</li>`;
            }

            const taskDate = new Date(dateStr);
            if (isNaN(taskDate)) {
              return `<li><strong>—</strong>: ${task.title}</li>`;
            }

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
          <button class="edit-btn">✏️ Редагувати</button>
          <button class="delete-btn">🗑️ Видалити</button>
          <button class="visit-btn">📅 Запланувати візит</button>
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

    div.querySelector(".edit-btn").addEventListener("click", () => editLabCard(index));
    div.querySelector(".delete-btn").addEventListener("click", () => deleteLab(index));
    div.querySelector(".visit-btn").addEventListener("click", () => manualVisit(index));
  });

  // Перейти до календаря
  const calendarBtn = document.createElement("div");
  calendarBtn.className = "calendar-btn";
  calendarBtn.innerHTML = `<a href="../calendar/calendar.html"><button>📅 Перейти до календаря задач</button></a>`;
  container.appendChild(calendarBtn);
}


function manualVisit(index) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards[index];
  if (!lab) return;

  const date = prompt(`📅 Вкажіть дату візиту для ${lab.partner} (${lab.city}) у форматі YYYY-MM-DD:`);
  if (!date) return;

  const parsed = new Date(date);
  if (isNaN(parsed)) {
    alert("❌ Невірний формат дати. Використовуйте YYYY-MM-DD.");
    return;
  }

  const dateStr = toISODateLocal(parsed);

  const visit = {
    id: `${lab.id}_${Date.now()}`,
    labId: lab.id,
    labName: lab.partner,
    date: dateStr,
    tasks: [],
    status: "заплановано"
  };

  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  visits.push(visit);
  localStorage.setItem("visits", JSON.stringify(visits));

  alert(`✅ Візит до ${lab.partner} (${lab.city}) заплановано на ${dateStr}`);
}

function applyFilters() {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]"); // ✅ беремо з LocalStorage

  const name = document.getElementById("filterName")?.value.trim() || "";
  const region = document.getElementById("filterRegion")?.value.trim() || "";
  const city = document.getElementById("filterCity")?.value.trim() || "";
  const institution = document.getElementById("filterInstitution")?.value.trim() || "";
  const device = document.getElementById("filterDevice")?.value.trim() || "";
  const contractor = document.getElementById("filterContractor")?.value.trim() || "";
  const phone = document.getElementById("filterPhone")?.value.trim() || "";
  const edrpou = document.getElementById("filterEdrpou")?.value.trim() || "";
  const manager = document.getElementById("filterManager")?.value.trim() || "";
  const kp = document.getElementById("kpFilter")?.value.trim() || ""; // ✅ новий фільтр по КП

  const filtered = labCards.filter(l =>
    (!name || l.partner?.toLowerCase().includes(name.toLowerCase())) &&
    (!region || l.region === region) &&
    (!city || l.city === city) &&
    (!institution || l.institution === institution) &&
    (!device || l.devices.some(d => d.device === device)) &&
    (!contractor || l.contractor === contractor) &&
    (!phone || l.phone === phone) &&
    (!edrpou || l.edrpou === edrpou) &&
    (!manager || l.manager === manager) &&
    (!kp || l.devices.some(d => d.kp === kp)) // ✅ перевірка КП у приладах
  );

  renderLabCards(filtered);
}

function resetFilters() {
  // очищаємо всі поля фільтрів
  document.getElementById("filterName").value = "";
  document.getElementById("filterRegion").value = "";
  document.getElementById("filterCity").value = "";
  document.getElementById("filterInstitution").value = "";
  document.getElementById("filterDevice").value = "";
  document.getElementById("filterContractor").value = "";
  document.getElementById("filterPhone").value = "";
  document.getElementById("filterEdrpou").value = "";
  document.getElementById("filterManager").value = "";
  document.getElementById("kpFilter").value = ""; // ✅ очищаємо КП

  // отримуємо всі картки з localStorage
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");

  // рендеримо повний список
  renderLabCards(labCards);
}

function showTaskPreviewBeforeSave(labCard, visits, onConfirm) {
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

  const visitItems = visits.map(v => {
    const subtasks = v.tasks?.map(sub =>
      `<li>${sub.priority || ""} ${sub.action || ""} (${sub.device || ""})</li>`
    ).join("") || "<li>Немає задач</li>";

    return `
      <li style="margin-bottom:15px;">
        <strong>${v.date || "—"}</strong>: ${v.title || ""}
        <ul style="margin-left:20px;">${subtasks}</ul>
      </li>
    `;
  }).join("");

  modal.innerHTML = `
    <h3>🗓️ Прев’ю задач для лабораторії <em>${labCard.partner}</em></h3>
    <ul style="max-height:300px; overflow-y:auto; padding-left:20px;">
      ${visitItems || "<li>Немає задач для відображення</li>"}
    </ul>
    <div style="margin-top:20px; text-align:right;">
      <button id="confirmSaveBtn">✅ Підтвердити збереження</button>
      <button id="cancelSaveBtn">❌ Скасувати</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Обробка підтвердження
  document.getElementById("confirmSaveBtn").addEventListener("click", () => {
    modal.remove();
    onConfirm();
  });

  // Обробка скасування
  document.getElementById("cancelSaveBtn").addEventListener("click", () => {
    modal.remove();
  });
}

async function planVisit(labId) {
  const selectedDate = sessionStorage.getItem("selectedDate");
  if (!selectedDate) {
    alert("⚠️ Спочатку виберіть дату у календарі.");
    return;
  }

  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return;

  // задачі для цього візиту
  const tasks = await generateDeviceTasksWithDueDates(lab);

  const newVisit = {
    id: `${labId}_${Date.now()}`,
    labId: labId,
    labName: lab.partner,
    date: selectedDate,
    tasks,
    status: "заплановано"
  };

  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  visits.push(newVisit);
  localStorage.setItem("visits", JSON.stringify(visits));

  alert("✅ Візит заплановано!");

  // Перенаправлення робимо асинхронно, щоб не блокувати
  setTimeout(() => {
    window.location.href = "../calendar/calendar.html";
  }, 500);
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