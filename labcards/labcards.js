let lpzList = [];
let filteredList = [];
const calculators = {};
let kpListByDevice = {};
let deviceCount = 0;
let taskSchedule = {}; // глобальний об’єкт для збереження розкладу

const deviceCategories = {
  "Гематологія": ["DH-36", "DF-50", "UN-73", "VISION Pro", "RN-3600"],
  "Коагулометрія": ["DP-C16", "СA-1200"],
  "Сечові аналізатори": ["READER 300"],
  "Біохімія": ["Biossays 240 Plus", "DP-C16", "Chem-100", "Chem-200"],
  "Електроліти": ["MINI ISE", "AFT-800"],
  "ПОКТ": ["LS-1100", "BK-120"]
};

import { findNearbyAvailableDate, ORS_TOKEN } from "./logistics.js";

// ❌ не викликаємо тут findNearbyAvailableDate
// ✅ викликати треба всередині generateMonthlyLabVisits або іншої функції,
// де вже відомі city і baseDate


const uniqueValues = {
  partner: new Set(),
  region: new Set(),
  city: new Set(),
  institution: new Set(),
  device: new Set(),
  contractor: new Set(),
  phone: new Set(),
  edrpou: new Set(),
  manager: new Set()
};

function loadLPZList() {
  fetch("./lpzlist.json")
  .then(res => res.json())
  .then(data => {
    console.log("LPZ list loaded:", data);
    lpzList = data;
    filteredList = [...lpzList];
    updateRegionList();
    updateCityList();
    updateLPZList();
  });
}

function updateRegionList() {
  const list = document.getElementById("region-list");
  list.innerHTML = "";
  [...new Set(lpzList.map(l => l.region))].forEach(region => {
    const opt = document.createElement("option");
    opt.value = region;
    list.appendChild(opt);
  });
}

function updateCityList() {
  const list = document.getElementById("city-list");
  list.innerHTML = "";
  [...new Set(filteredList.map(l => l.city))].forEach(city => {
    const opt = document.createElement("option");
    opt.value = city;
    list.appendChild(opt);
  });
}

function updateLPZList() {
  const list = document.getElementById("lpz-list");
  list.innerHTML = "";
  [...new Set(filteredList.map(l => l.name))].forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  });
}

function onRegionInput() {
  const region = document.getElementById("region").value.toLowerCase();
  filteredList = lpzList.filter(l => l.region.toLowerCase().includes(region));
  updateCityList();
  updateLPZList();
  autoFillIfSingle();
}

function onCityInput() {
  const region = document.getElementById("region").value.toLowerCase();
  const city = document.getElementById("city").value.toLowerCase();
  filteredList = lpzList.filter(l =>
    l.region.toLowerCase().includes(region) &&
    l.city.toLowerCase().includes(city)
  );
  updateLPZList();
  autoFillIfSingle();
}

function onLPZInput() {
  const region = document.getElementById("region").value.toLowerCase();
  const city = document.getElementById("city").value.toLowerCase();
  const name = document.getElementById("lpz").value.toLowerCase();
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
    document.getElementById("region").value = l.region;
    document.getElementById("city").value = l.city;
    document.getElementById("lpz").value = l.name;
    document.getElementById("labAddress").value = l.address;
    document.getElementById("labEdrpou").value = l.edrpou || "";
    document.getElementById("labManager").value = l.manager || "";
  }
}
function addDevice(index = null, prefill = null) {
  const container = document.getElementById("devicesContainer");
  if (index === null) index = deviceCount++;

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

  // 🔧 При зміні категорії оновлюємо список приладів
  document.getElementById(`category_${index}`).addEventListener("change", (e) => {
    const category = e.target.value;
    const deviceSelect = document.getElementById(`device_${index}`);
    deviceSelect.innerHTML = `<option value="">Оберіть прилад</option>`;
    if (deviceCategories[category]) {
      deviceSelect.innerHTML += deviceCategories[category].map(d => `<option value="${d}">${d}</option>`).join("");
    }
  });

  // 🔧 При виборі приладу завантажуємо калькулятор
  document.getElementById(`device_${index}`).addEventListener("change", () => {
    loadCalculator(index, prefill);
    const deviceName = document.getElementById(`device_${index}`).value;
    const kpOptions = kpListByDevice[deviceName] || [];
    const kpSelect = document.getElementById(`kpSelect_${index}`);
    kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
      kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
  });

  // 🔧 Показати поле замінених деталей
  document.getElementById(`workType_${index}`).addEventListener("change", (e) => {
    const show = e.target.value === "заміна деталей";
    document.getElementById(`replacedPartsBlock_${index}`).style.display = show ? "block" : "none";
  });

  // 🔧 Видалення блоку
  document.getElementById(`removeDevice_${index}`).addEventListener("click", () => {
    block.remove();
  });

  // 🔧 Якщо є дані для заповнення (редагування)
if (prefill) {
  document.getElementById(`soldDate_${index}`).value = prefill.soldDate || "";
  document.getElementById(`lastService_${index}`).value = prefill.lastService || "";
  document.getElementById(`workType_${index}`).value = prefill.workType || "";
  document.getElementById(`replacedParts_${index}`).value = prefill.replacedParts || "";
  document.getElementById(`kpSelect_${index}`).value = prefill.kp || "";

  if (prefill.workType === "заміна деталей") {
    document.getElementById(`replacedPartsBlock_${index}`).style.display = "block";
  }

  // знайти категорію для приладу
  const category = Object.keys(deviceCategories).find(cat => deviceCategories[cat].includes(prefill.device));
  if (category) {
    document.getElementById(`category_${index}`).value = category;
    const deviceSelect = document.getElementById(`device_${index}`);
    deviceSelect.innerHTML = `<option value="">Оберіть прилад</option>` +
      deviceCategories[category].map(d => `<option value="${d}">${d}</option>`).join("");
    deviceSelect.value = prefill.device;

    // 🔧 loadCalculator сам створить потрібні поля (testCount або аналізи LS-1100)
    loadCalculator(index, prefill);
  }
}

}

function loadCalculator(index, prefill = null) {
  const deviceName = document.getElementById(`device_${index}`)?.value?.trim();
  if (!deviceName) return;

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const applyPrefill = (config) => {
    renderTestCountField(index, config, deviceName);
    renderReagentFields(index, config);

    if (deviceName === "LS-1100") {
      renderAnalysisFieldsLS1100(index, config, prefill);
    }
  };

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

  // 🔧 Якщо це LS-1100 — не малюємо глобальний testCount
  if (deviceName === "LS-1100") {
    return; // бо для LS-1100 є окремі інпути по кожному тесту
  }

  // 🔧 Для інших приладів — стандартний один інпут
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
    html += `
      <div class="reagent-block">
        <strong>${r.name}</strong><br/>
        Кількість останнього замовлення:
        <input type="number" id="reagentCount_${index}_${r.name}" min="0" /><br/>
        Дата останнього замовлення:
        <input type="date" id="reagentDate_${index}_${r.name}" />
      </div>
    `;
  });

  container.insertAdjacentHTML("beforeend", html);
}
function renderAnalysisFieldsLS1100(index, config, prefill = null) {
  const container = document.getElementById(`analysisFields_${index}`);
  container.innerHTML = "<h4>🧪 Тести LS-1100</h4>";

  Object.keys(config.analyses).forEach(testName => {
    const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");

    const block = document.createElement("div");
    block.className = "analysis-block";
    block.style.border = "1px solid #ccc";
    block.style.borderRadius = "6px";
    block.style.padding = "10px";
    block.style.marginBottom = "12px";
    block.style.background = "#f9f9f9";

    block.innerHTML = `
      <div class="analysis-title"><strong>${testName}</strong></div>
      <div class="analysis-inputs">
        <label>
          📊/день
          <input type="number" id="analysisCount_${index}_${safeId}" min="0" value="0">
        </label>
        <label>
          📦 упаковок
          <input type="number" id="analysisPackages_${index}_${safeId}" min="0" value="0">
        </label>
        <label>
          📅 закупівля
          <input type="date" id="analysisDate_${index}_${safeId}">
        </label>
      </div>
    `;
    container.appendChild(block);

    // 🔧 Якщо є prefill — заповнити
    if (prefill && prefill.analyses && prefill.analyses[testName]) {
      const data = prefill.analyses[testName];
      document.getElementById(`analysisCount_${index}_${safeId}`).value = data.count || 0;
      document.getElementById(`analysisPackages_${index}_${safeId}`).value = data.packages || 0;
      if (data.date && data.date !== "НІКОЛИ") {
        document.getElementById(`analysisDate_${index}_${safeId}`).value = data.date;
      }
    }
  });
}

function toISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  const day = date.getDay(); // 0=Нд, 6=Сб
  return day === 0 || day === 6;
}

function nextWorkingDay(date) {
  const d = new Date(date);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

// Опціонально: преференція вівторок-четвер
function preferTueThu(date) {
  const d = new Date(date);
  const day = d.getDay(); // 2=Вт, 3=Ср, 4=Чт
  if (day === 2 || day === 3 || day === 4) return d;
  // зсуваємо вперед до найближчого Вт/Ср/Чт
  while (![2,3,4].includes(d.getDay())) d.setDate(d.getDate() + 1);
  return d;
}

async function generateDeviceTasksWithDueDates(lab) {
  const tasks = [];
  const baseDate = new Date(lab.saveDate || new Date());
  const endDate = new Date(baseDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  for (const device of lab.devices) {
    const { device: deviceName, testCount } = device;
    const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const config = calculators[configKey];
    if (!config || !config.reagents?.length) continue;

    for (let i = 1; i <= 12; i++) {
      const due = new Date(baseDate);
      due.setMonth(due.getMonth() + i);

      // Сервіс — раз на квартал
      if (i % 3 === 0) {
        tasks.push({
          lab: lab.partner,
          city: lab.city,
          device: deviceName,
          taskType: "service",
          dueDate: due,
          source: "auto"
        });
      }

      // Реагенти — щомісяця
      for (const r of config.reagents) {
        const perTest = Number(r.perTest);
        const startup = Number(r.startup) || 0;
        const shutdown = Number(r.shutdown) || 0;
        const volume = Number(r.packageSize);
        if (!perTest || !volume) continue;

        // Якщо хочеш змінність — заміни на monthlyTests логіку
        const daily = perTest * testCount + startup + shutdown;
        if (!daily || daily <= 0) continue;

        const neededQuantity = Math.ceil((daily * 30) / volume);

        tasks.push({
          lab: lab.partner,
          city: lab.city,
          device: deviceName,
          taskType: "reagents",
          reagentName: r.name,
          neededQuantity,
          dueDate: due,
          source: "auto"
        });
      }
    }
  }

  return tasks.filter(t => t.dueDate <= endDate);
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
      const p = new Date(t.dueDate);
      p.setDate(p.getDate() - 14); // базово: за 2 тижні до дедлайну

      // корекція на робочий день і преференції
      const planned = preferTueThu(nextWorkingDay(p));
      const key = `${planned.getFullYear()}-${planned.getMonth()}`; // по місяцях

      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    }

    for (const monthKey in buckets) {
      const visitTasks = buckets[monthKey];

      // одна узгоджена дата для цього "місяця" (беремо найранішу з bucket і нормалізуємо)
      const preferredDate = visitTasks
        .map(t => {
          const p = new Date(t.dueDate);
          p.setDate(p.getDate() - 14);
          return preferTueThu(nextWorkingDay(p));
        })
        .sort((a, b) => a - b)[0];

      // якщо є логістична перевірка вільних дат — застосуй її після нормалізації:
      const scheduledDate = await findNearbyAvailableDate(city, taskSchedule, ORS_TOKEN, preferredDate);

      const dateStr = toISODateLocal(scheduledDate);

      // Пріоритети по дедлайну кожної підзадачі
      const visit = {
        type: "labVisit",
        title: `🔍 Візит до лабораторії ${labName}`,
        date: dateStr,
        lab: labName,
        city,
        tasks: visitTasks.map(t => {
          const delta = Math.round((t.dueDate - today) / (1000 * 60 * 60 * 24));
          let priority = "🟢";
          if (delta <= 10) priority = "🔴";
          else if (delta <= 30) priority = "🟡";

          return {
            device: t.device,
            action: t.taskType === "reagents"
              ? `Замов реагент — ${t.reagentName} (${t.neededQuantity} уп.)`
              : "Сервіс",
            priority
          };
        })
      };

      monthlyVisits.push(visit);
    }
  }

  // сортуємо візити за датою
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
  const updatedLabs = JSON.parse(JSON.stringify(labs)); // глибока копія

  for (const report of visitReports) {
    const lab = updatedLabs.find(l => l.partner === report.lab);
    if (!lab) continue;

    for (const update of report.updates) {
      const device = lab.devices.find(d => d.device === update.device);
      if (!device) continue;

      if (update.type === "reagents") {
        if (update.action === "ordered") {
          const info = device.reagentsInfo?.[update.name] || {};
          info.lastOrderCount = update.count;
          info.lastOrderDate = update.date;
          device.reagentsInfo[update.name] = info;
        }

        if (update.action === "postponed") {
          // перенесення задачі: можна додати прапорець або зберегти в окремий backlog
          device.reagentsInfo[update.name].postponed = true;
        }
      }

      if (update.type === "service" && update.action === "done") {
        device.lastService = update.date;
      }
    }
  }

  return updatedLabs;
}
async function processVisitReport(visitReports) {
  const allLabs = loadAllLabCards(); // або з localStorage / API
  const updatedLabs = applyFieldUpdatesFromVisits(allLabs, visitReports);
  const newVisits = await generateAllLabVisits(updatedLabs);

  saveAllLabCards(updatedLabs);      // оновлюємо лабораторії
  saveAllVisits(newVisits);          // зберігаємо нові візити
  renderVisitPlanner(newVisits);     // оновлюємо UI
}


async function saveLabCard() {
  const today = new Date();

  const labCard = {
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

  // 🔧 Кількість пристроїв у формі
  const deviceCount = document.querySelectorAll("[id^='device_']").length;

  // 🔧 Збір даних по пристроях
  for (let i = 0; i < deviceCount; i++) {
    const deviceName = document.getElementById(`device_${i}`)?.value?.trim();
    if (!deviceName) continue;

    const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const config = calculators[configKey];

    const device = {
      device: deviceName,
      soldDate: document.getElementById(`soldDate_${i}`)?.value || null,
      lastService: document.getElementById(`lastService_${i}`)?.value || null,
      workType: document.getElementById(`workType_${i}`)?.value || null,
      replacedParts: document.getElementById(`replacedParts_${i}`)?.value?.trim() || null,
      kp: document.getElementById(`kpSelect_${i}`)?.value || null,
      testCount: Number(document.getElementById(`testCount_${i}`)?.value) || 0,
      analyses: {},
      reagentsInfo: {}
    };

    // 🔧 Аналізи для LS-1100
if (deviceName === "LS-1100" && config?.analyses) {
  Object.keys(config.analyses).forEach(testName => {
    const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
    const countEl = document.getElementById(`analysisCount_${i}_${safeId}`);
    const packagesEl = document.getElementById(`analysisPackages_${i}_${safeId}`);
    const dateEl = document.getElementById(`analysisDate_${i}_${safeId}`);

    const count = countEl ? parseInt(countEl.value || "0", 10) : 0;
    const packages = packagesEl ? parseInt(packagesEl.value || "0", 10) : 0;
    const date = dateEl && dateEl.value ? dateEl.value : "НІКОЛИ";

    device.analyses[testName] = { count, packages, date };

    // 🔧 задачі лише якщо є дані (наприклад, пакети > 0)
    if (packages > 0) {
      // розрахунок на скільки днів вистачить:
      // припустимо, що в одній упаковці N тестів (це можна додати в config)
      const testsPerPackage = config.testsPerPackage || 25; // приклад
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
        const count = document.getElementById(`reagentCount_${i}_${r.name}`)?.value;
        const date = document.getElementById(`reagentDate_${i}_${r.name}`)?.value;

        const lastOrderCount = count ? parseInt(count) : 0;
        const lastOrderDate = date || "НІКОЛИ";

        device.reagentsInfo[r.name] = { lastOrderCount, lastOrderDate };

        // 🔧 задачі лише якщо count > 0
        if (lastOrderCount > 0) {
          labCard.tasks.push({
            lab: labCard.partner,
            city: labCard.city,
            device: deviceName,
            title: `Закупівля реагенту ${r.name}`,
            date: lastOrderDate,
            priority: "⚠️"
          });
        }
      });
    }

    labCard.devices.push(device);
  }

  // 🔧 Генерація задач (додаткові, наприклад візити)
  const deviceTasks = await generateDeviceTasksWithDueDates(labCard);
  const allTasks = await generateMonthlyLabVisits([...labCard.tasks, ...deviceTasks]);

  // 🔧 Фільтрація задач для цієї лабораторії
  labCard.tasks = allTasks.filter(t => t.lab === labCard.partner && t.city === labCard.city);

  // 🔧 Прев’ю задач
  showTaskPreviewBeforeSave(labCard, labCard.tasks, () => {
    try {
      const editData = JSON.parse(localStorage.getItem("editLabCard") || "null");
      const allCards = JSON.parse(localStorage.getItem("labCards") || "[]");

      if (editData) {
        allCards[editData.index] = labCard;
        localStorage.removeItem("editLabCard");
      } else {
        allCards.push(labCard);
      }

      localStorage.setItem("labCards", JSON.stringify(allCards));

      // 🔧 Оновлення календаря
      let existingTasks = JSON.parse(localStorage.getItem("calendarTasks") || "[]");
      if (!Array.isArray(existingTasks)) existingTasks = [];

      const filtered = existingTasks.filter(
        t => t.lab !== labCard.partner || t.city !== labCard.city
      );
      localStorage.setItem("calendarTasks", JSON.stringify([...filtered, ...labCard.tasks]));

      alert("✅ Лабораторію збережено і задачі оновлено!");
      window.location.href = "./index.html";
    } catch (err) {
      console.error("❌ Помилка при збереженні:", err);
      alert("❌ Сталася помилка при збереженні. Перевір консоль.");
    }
  });
}

// ✅ Видалення з localStorage — без глобальної змінної
function deleteLab(index) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  labCards.splice(index, 1);
  localStorage.setItem("labCards", JSON.stringify(labCards));
  renderLabCards(labCards); // оновлюємо рендер після видалення
}

// ✅ Редагування — збереження індексу й перехід
function editLabCard(index) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards[index];
  localStorage.setItem("editLabCard", JSON.stringify({ index, lab }));
  window.location.href = "./labcard.html";
}
function renderLabCards(filteredLabs) {
  const container = document.getElementById("labList");
  container.innerHTML = '';

  // Панель фільтрів
  const filterBar = document.createElement("div");
  filterBar.className = "filter-bar";
  filterBar.innerHTML = `
    <label>📍 Регіон:
      <select id="regionFilter">
        <option value="">Усі</option>
        ${[...uniqueValues.region].map(r => `<option value="${r}">${r}</option>`).join("")}
      </select>
    </label>
    <label>👤 Менеджер:
      <select id="managerFilter">
        <option value="">Усі</option>
        ${[...uniqueValues.manager].map(m => `<option value="${m}">${m}</option>`).join("")}
      </select>
    </label>
  `;
  container.appendChild(filterBar);

  document.getElementById("regionFilter").addEventListener("change", applyFilters);
  document.getElementById("managerFilter").addEventListener("change", applyFilters);

  if (filteredLabs.length === 0) {
    container.innerHTML += "<p>⚠️ Нічого не знайдено за заданими фільтрами.</p>";
    return;
  }

  // Картки
  filteredLabs.forEach((lab, index) => {
    const div = document.createElement("div");
    div.className = "lab-card";
    div.innerHTML = `
      <h3>${index + 1}. ${lab.partner}</h3>
      <div class="lab-actions">
        <button class="edit-btn">✏️ Редагувати</button>
        <button class="delete-btn">🗑️ Видалити</button>
        <button class="visit-btn">📅 Запланувати візит</button>
      </div>
      <p>📍 ${lab.region}, ${lab.city}</p>
      <p>🏥 ${lab.institution}</p>
      <p>📫 Адреса: ${lab.address || "—"}</p>
      <p>🤝 Контактна особа: ${lab.contractor || "—"}</p>
      <p>📞 Телефон: ${lab.phone || "—"}</p>
      <p>🆔 ЄДРПОУ: ${lab.edrpou || "—"}</p>
      <p>👤 Менеджер: ${lab.manager || "—"}</p>
      <ul>
        ${lab.devices.map(d => `
          <li>
            🔧 <strong>${d.device}</strong><br>
            📅 Продано: ${d.soldDate || "—"}<br>
            🛠️ Сервіс: ${d.lastService || "—"}<br>
            🔧 Замінені деталі: ${d.replacedParts || "—"}
          </li>
        `).join("")}
      </ul>
      ${lab.tasks?.length ? `
        <h4>🗓️ Прев’ю задач:</h4>
        <ul class="task-list">
          ${lab.tasks.map(task => {
            const taskDate = new Date(task.date);
            const today = new Date();
            const urgentThreshold = new Date();
            urgentThreshold.setDate(today.getDate() + 7);

            let priorityClass = "priority-green";
            if (taskDate < today) priorityClass = "priority-red";
            else if (taskDate <= urgentThreshold) priorityClass = "priority-yellow";

            const subtasks = task.tasks?.map(sub => `<li>${sub.priority} ${sub.action} (${sub.device})</li>`).join("");

            return `
              <li class="${priorityClass}">
                <strong>${task.date}</strong>: ${task.title}
                ${subtasks ? `<ul>${subtasks}</ul>` : ""}
              </li>
            `;
          }).join("")}
        </ul>
      ` : ""}
    `;
    container.appendChild(div);

    div.querySelector(".edit-btn").addEventListener("click", () => editLabCard(index));
    div.querySelector(".delete-btn").addEventListener("click", () => deleteLab(index));
    div.querySelector(".visit-btn").addEventListener("click", () => openVisitPicker(index));
  });

  // Перейти до календаря
  const calendarBtn = document.createElement("div");
  calendarBtn.className = "calendar-btn";
  calendarBtn.innerHTML = `<a href="../calendar/calendar.html"><button>📅 Перейти до календаря задач</button></a>`;
  container.appendChild(calendarBtn);
}

// якщо модулі — експортуй


function manualVisit(index) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards[index];
  if (!lab) return;

  const date = prompt(`📅 Вкажіть дату візиту для ${lab.partner} (${lab.city}) у форматі YYYY-MM-DD:`);
  if (!date) return;

  // Перевірка формату
  const parsed = new Date(date);
  if (isNaN(parsed)) {
    alert("❌ Невірний формат дати. Використовуйте YYYY-MM-DD.");
    return;
  }

  // Створюємо задачу-візит
  const visit = {
    type: "manualVisit",
    title: `🔍 Візит до лабораторії ${lab.partner}`,
    date: date,
    lab: lab.partner,
    city: lab.city,
    tasks: [] // можна додати пустий масив або базові дії
  };

  // Зберігаємо у календар
  let calendarTasks = JSON.parse(localStorage.getItem("calendarTasks") || "[]");
  calendarTasks.push(visit);
  localStorage.setItem("calendarTasks", JSON.stringify(calendarTasks));

  alert(`✅ Візит до ${lab.partner} (${lab.city}) заплановано на ${date}`);
}

function applyFilters() {
  const name = document.getElementById("filterName").value.trim();
  const region = document.getElementById("filterRegion").value.trim();
  const city = document.getElementById("filterCity").value.trim();
  const institution = document.getElementById("filterInstitution").value.trim();
  const device = document.getElementById("filterDevice").value.trim();
  const contractor = document.getElementById("filterContractor").value.trim();
  const phone = document.getElementById("filterPhone").value.trim();
  const edrpou = document.getElementById("filterEdrpou").value.trim();
  const manager = document.getElementById("filterManager").value.trim();

  const filtered = labCards.filter(l =>
    (!name || l.partner?.toLowerCase().includes(name.toLowerCase())) &&
    (!region || l.region === region) &&
    (!city || l.city === city) &&
    (!institution || l.institution === institution) &&
    (!device || l.devices.some(d => d.device === device)) &&
    (!contractor || l.contractor === contractor) &&
    (!phone || l.phone === phone) &&
    (!edrpou || l.edrpou === edrpou) &&
    (!manager || l.manager === manager)
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

  // отримуємо всі картки з localStorage
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");

  // рендеримо повний список
  renderLabCards(labCards);
}

function showTaskPreviewBeforeSave(labCard, visits, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style = `
    background:white;
    padding:20px;
    max-width:600px;
    margin:auto;
    border-radius:8px;
    box-shadow:0 0 10px rgba(0,0,0,0.2);
    white-space:pre-line;
    z-index:9999;
    position:fixed;
    top:10%;
    left:0;
    right:0;
  `;

  // 🔧 Формуємо список візитів з підзадачами
  const visitItems = visits.map(v => {
    const subtasks = v.tasks?.map(sub =>
      `<li>${sub.priority} ${sub.action} (${sub.device})</li>`
    ).join("") || "<li>Немає задач</li>";

    return `
      <li style="margin-bottom:15px;">
        <strong>${v.date}</strong>: ${v.title}
        <ul style="margin-left:20px;">${subtasks}</ul>
      </li>
    `;
  }).join("");

  // 🔧 Вміст модального вікна
  modal.innerHTML = `
    <h3>🗓️ Прев’ю задач для лабораторії <em>${labCard.partner}</em></h3>
    <ul style="max-height:300px; overflow-y:auto; padding-left:20px;">
      ${visitItems || "<li>Немає задач для відображення</li>"}
    </ul>
    <div style="margin-top:20px; text-align:right;">
      <button id="confirmSaveBtn">✅ Підтвердити збереження</button>
      <button onclick="this.closest('.modal').remove()">❌ Скасувати</button>
    </div>
  `;

  document.body.appendChild(modal);

  // 🔧 Обробка підтвердження
  document.getElementById("confirmSaveBtn").addEventListener("click", () => {
    modal.remove();
    onConfirm();
  });
}
function openVisitPicker(index) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards[index];
  if (!lab) return;

  const modal = document.getElementById("visitModal");
  const info = document.getElementById("visitModalInfo");
  const dateInput = document.getElementById("visitDate");
  const confirmBtn = document.getElementById("visitConfirmBtn");
  const cancelBtn = document.getElementById("visitCancelBtn");

  info.textContent = `${lab.partner} — ${lab.city}`;
  // за замовчуванням завтра, без вихідних за бажанням
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.value = toISODateLocal(tomorrow);

  modal.style.display = "flex";

  const cleanup = () => {
    modal.style.display = "none";
    confirmBtn.replaceWith(confirmBtn.cloneNode(true)); // прибрати подвійні слухачі
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  confirmBtn.addEventListener("click", () => {
    const date = dateInput.value;
    if (!date) { alert("❌ Виберіть дату."); return; }

    // додаємо задачу в календар
    const visit = {
      type: "manualVisit",
      title: `🔍 Візит до лабораторії ${lab.partner}`,
      date,
      lab: lab.partner,
      city: lab.city,
      tasks: []
    };

    const calendarTasks = JSON.parse(localStorage.getItem("calendarTasks") || "[]");
    calendarTasks.push(visit);
    localStorage.setItem("calendarTasks", JSON.stringify(calendarTasks));

    alert(`✅ Візит заплановано на ${date}`);
    cleanup();
  });

  cancelBtn.addEventListener("click", cleanup);
}

window.openVisitPicker = openVisitPicker;
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
window.onRegionInput = onRegionInput;
window.onCityInput = onCityInput;
window.onLPZInput = onLPZInput;
window.loadLPZList = loadLPZList;
window.saveLabCard = saveLabCard;
window.deleteLab = deleteLab;
window.editLabCard = editLabCard;
window.manualVisit = manualVisit;
window.applyFilters = applyFilters;
window.showTaskPreviewBeforeSave = showTaskPreviewBeforeSave;