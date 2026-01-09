// ==========================
// labcards.js — узгоджена версія
// ==========================

// 🔧 Глобальні змінні
let labsCache = [];          // кеш лабораторій з бекенду
let calculators = {};        // кеш конфігів приладів
let kpListByDevice = {};     // КП по приладах
let deviceCount = 0;         // лічильник приладів
const API_URL = "https://nodejs-production-7176.up.railway.app";

// ==========================
// Допоміжні утиліти
// ==========================

// Форматування дати у ISO (локально)
function toISODateLocal(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Форматування дати у YYYY-MM-DD
function formatDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Безпечне присвоєння значення інпуту
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = value || "";
  } else {
    console.warn(`⚠️ Елемент з id="${id}" не знайдено`);
  }
}
// ==========================
// Завантаження лабораторій із бекенду
// ==========================
async function loadLabsCache() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/labs`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("Не вдалося завантажити лабораторії");
    labsCache = await res.json();
    console.log("✅ Лабораторії завантажено у кеш:", labsCache);
  } catch (err) {
    console.error("❌ Помилка завантаження лабораторій:", err);
    alert("⚠️ Не вдалося завантажити лабораторії.");
  }
}

async function loadLabCards() {
  try {
    if (!labsCache || labsCache.length === 0) {
      await loadLabsCache();
    }

    // ✅ Фільтруємо лише ті лабораторії, що мають прилади або реагенти
    const filteredLabs = labsCache.filter(lab =>
      (lab.devices && lab.devices.length > 0) ||
      (lab.reagents && lab.reagents.length > 0) // якщо є поле reagents
    );

    renderLabCards(filteredLabs);
  } catch (err) {
    console.error("❌ Помилка при відображенні лабораторій:", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => { await loadLabsCache(); });
// ==========================
// Фільтрація лабораторій
// ==========================
async function applyFilters() {
  try {
    if (!labsCache || labsCache.length === 0) {
      await loadLabsCache();
    }

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

    const filtered = labsCache.filter(l =>
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
    alert("⚠️ Не вдалося застосувати фільтри.");
  }
}

function resetFilters() {
  const filterIds = [
    "filterName","filterRegion","filterCity","filterInstitution",
    "filterDevice","filterContractor","filterPhone","filterEdrpou",
    "filterManager","kpFilter"
  ];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  renderLabCards(labsCache);
}
// ==========================
// Каскадні підказки
// ==========================

// Заповнення списку областей
function fillRegionOptions() {
  const regions = [...new Set(labsCache.map(l => l.region).filter(Boolean))];
  document.getElementById("regionList").innerHTML =
    regions.map(r => `<option value="${r}">`).join("");
}

// Заповнення списку міст для вибраної області
function fillCityOptions() {
  const region = document.getElementById("region").value;
  const cities = [...new Set(labsCache.filter(l => l.region === region).map(l => l.city).filter(Boolean))];
  document.getElementById("cityList").innerHTML =
    cities.map(c => `<option value="${c}">`).join("");
}

// Заповнення списку ЛПЗ для вибраного міста
function fillLpzOptions() {
  const region = document.getElementById("region").value;
  const city = document.getElementById("city").value;
  const lpzs = labsCache.filter(l => l.region === region && l.city === city);
  document.getElementById("lpzList").innerHTML =
    lpzs.map(l => `<option value="${l.institution} [ЄДРПОУ:${l.edrpou}]">`).join("");
}

// Префіл даних лабораторії по ЄДРПОУ
function prefillLabData() {
  const lpzValue = document.getElementById("lpz").value;
  const edrpouMatch = lpzValue.match(/ЄДРПОУ:(\d+)/);
  if (!edrpouMatch) return;
  const edrpou = edrpouMatch[1];
  const lab = labsCache.find(l => l.edrpou === edrpou);
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
// Ініціалізація картки лабораторії
// ==========================
async function initLabCard() {
  const devicesContainer = document.getElementById("devicesContainer");
  if (!devicesContainer) { 
    console.warn("⚠️ devicesContainer не знайдено — ця функція працює лише на labcard.html"); 
    return; 
  }
  const container = document.getElementById("devicesContainer");
  if (!container) {
    console.warn("⚠️ devicesContainer не знайдено — ця функція працює лише на labcard.html");
    return;
  }

  const editLabEdrpou = sessionStorage.getItem("editLabEdrpou");
  if (!editLabEdrpou) return;

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/labs/${editLabEdrpou}`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("Не вдалося завантажити лабораторію");

    const lab = await res.json();

    // Заповнюємо поля лабораторії
    setValue("partnerName", lab.partner);
    setValue("region", lab.region);
    setValue("city", lab.city);
    setValue("lpz", lab.institution);
    setValue("labAddress", lab.address);
    setValue("contractor", lab.contractor);
    setValue("phone", lab.phone);
    setValue("labEdrpou", lab.edrpou);
    setValue("labManager", lab.manager);

    // Відновлюємо прилади
    container.innerHTML = "";
    deviceCount = 0;
    if (lab.devices && lab.devices.length > 0) {
      const devicesSection = document.getElementById("devicesSection");
      if (devicesSection) devicesSection.style.display = "block";
      lab.devices.forEach((d, idx) => addDevice(idx, d));
    }

  } catch (err) {
    console.error("❌ Помилка при ініціалізації картки:", err);
    alert("⚠️ Не вдалося завантажити дані лабораторії.");
  }
}

window.addEventListener("DOMContentLoaded", initLabCard);
// ==========================
// Додавання приладу
// ==========================
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

  // Події
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

  // Якщо редагування → заповнити поля
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

// ==========================
// Завантаження калькулятора для приладу
// ==========================
async function loadCalculator(index, prefill = null) {
  const deviceName = document.getElementById(`device_${index}`)?.value?.trim();
  if (!deviceName) return;

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const applyPrefill = (config) => {
    const analysisContainer = document.getElementById(`analysisFields_${index}`);
    if (analysisContainer) analysisContainer.innerHTML = "";

    const testCountEl = document.getElementById(`testCount_${index}`);
    if (testCountEl) testCountEl.remove();

    const reagentBlocks = document.querySelectorAll(`#deviceBlock_${index} .reagent-block`);
    reagentBlocks.forEach(rb => rb.remove());

    // Малюємо нові поля
    renderTestCountField(index, config, deviceName);
    renderReagentFields(index, config);
    renderAnalysisFields(index, config, prefill);

    // КП
    const kpOptions = kpListByDevice[deviceName] || [];
    const kpSelect = document.getElementById(`kpSelect_${index}`);
    if (kpSelect) {
      kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
        kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
      if (prefill?.kp) kpSelect.value = prefill.kp;
    }

    // Prefill для тестів, реагентів, аналізів
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

  // Використовуємо кеш або тягнемо конфіг із бекенду
  if (calculators[key]) {
    applyPrefill(calculators[key]);
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/calculators/${key}`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error(`Не вдалося завантажити калькулятор: ${key}`);

    const config = await res.json();
    calculators[key] = config;
    applyPrefill(config);

  } catch (err) {
    console.error(`❌ Помилка при завантаженні калькулятора ${key}:`, err);
  }
}

// ==========================
// Поле для кількості тестів
// ==========================
function renderTestCountField(index, config, deviceName) {
  const container = document.getElementById(`deviceBlock_${index}`);
  if (!container) return;

  if (deviceName === "LS-1100") return; // для LS-1100 окремий блок аналізів

  const html = `
    <label>🔬 Кількість досліджень на день:
      <input type="number" id="testCount_${index}" min="0" value="${config.testsPerDay || 0}" />
    </label>
  `;
  container.insertAdjacentHTML("beforeend", html);
}

// ==========================
// Поля для реагентів
// ==========================
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

// ==========================
// Поля для аналізів
// ==========================
function renderAnalysisFields(index, config, prefill = null) {
  const container = document.getElementById(`analysisFields_${index}`);
  if (!container) return;
  container.innerHTML = "<h4>🧪 Тести та реагенти</h4>";

  const items = config.analyses ? Object.keys(config.analyses) : [];
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

    // Prefill
    if (prefill?.analyses?.[itemName]) {
      const data = prefill.analyses[itemName];
      document.getElementById(`analysisCount_${index}_${safeId}`).value = data.count || 0;
      document.getElementById(`analysisPackages_${index}_${safeId}`).value = data.packages || 0;
      if (data.date && data.date !== "НІКОЛИ") {
        document.getElementById(`analysisDate_${index}_${safeId}`).value = data.date;
      }
    }

    // Автоматичний розрахунок "на скільки днів вистачить"
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
// ==========================
// Генерація задач для приладів
// ==========================
async function generateDeviceTasksWithDueDates(lab) {
  try {
    const tasks = [];

    for (const device of lab.devices || []) {
      // Сервісна задача (кожні 6 місяців)
      if (device.lastService) {
        const nextServiceDate = new Date(device.lastService);
        nextServiceDate.setMonth(nextServiceDate.getMonth() + 6);

        tasks.push({
          id: `${lab.edrpou}_${device.device}_service_${Date.now()}`,
          labId: lab.edrpou,
          device: device.device,
          title: `Плановий сервіс приладу ${device.device}`,
          date: nextServiceDate.toISOString().split("T")[0],
          taskType: "service",
          priority: "🔧"
        });
      }

      // Реагенти (щомісячне замовлення)
      if (device.reagentsInfo) {
        for (const [reagentName, info] of Object.entries(device.reagentsInfo)) {
          const nextOrderDate = info.lastOrderDate
            ? new Date(info.lastOrderDate)
            : new Date();
          nextOrderDate.setMonth(nextOrderDate.getMonth() + 1);

          tasks.push({
            id: `${lab.edrpou}_${device.device}_reagent_${Date.now()}`,
            labId: lab.edrpou,
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

    // 🔧 Зберігаємо задачі у бекенд
    if (tasks.length > 0) {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/tasks/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
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
        id: `${labId}_${monthKey}_${Date.now()}`,
        labId,
        labName: monthTasks[0].labName || "—",
        date: visitDate,
        tasks: monthTasks,
        status: "заплановано"
      };

      visitsPayload.push(visit);
    }

    // 🔧 Зберігаємо візити у бекенд
    if (visitsPayload.length > 0) {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/visits/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
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
// ==========================
// Масова генерація візитів для всіх лабораторій
// ==========================
async function generateAllLabVisits() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/labs`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("Не вдалося завантажити лабораторії");

    const labs = await res.json();
    if (!Array.isArray(labs) || labs.length === 0) {
      alert("⚠️ Лабораторій не знайдено.");
      return;
    }

    for (const lab of labs) {
      const tasks = await generateDeviceTasksWithDueDates(lab);
      const monthlyVisits = await generateMonthlyLabVisits(tasks);

      const visitsPayload = monthlyVisits.map(v => ({
        id: `${lab.edrpou}_${v.date}_${Date.now()}`,
        labId: lab.edrpou,
        labName: lab.partner,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      }));

      await fetch(`${API_URL}/visits/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
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

// ==========================
// Оновлення лабораторій на основі виконаних візитів
// ==========================
async function applyFieldUpdatesFromVisits() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/visits`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("Не вдалося завантажити візити");

    const visits = await res.json();
    if (!Array.isArray(visits) || visits.length === 0) {
      alert("⚠️ Візитів не знайдено.");
      return;
    }

    const visitsByLab = {};
    visits.forEach(v => {
      if (!visitsByLab[v.labId]) visitsByLab[v.labId] = [];
      visitsByLab[v.labId].push(v);
    });

    for (const labEdrpou of Object.keys(visitsByLab)) {
      const labRes = await fetch(`${API_URL}/labs/${labEdrpou}`, {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!labRes.ok) continue;
      const lab = await labRes.json();

      const labVisits = visitsByLab[labEdrpou];
      for (const visit of labVisits) {
        if (visit.status !== "виконано") continue;

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

      await fetch(`${API_URL}/labs/${labEdrpou}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
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
// ==========================
// Обробка звіту по візиту
// ==========================
async function processVisitReport(visitEdrpou, reportData) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/visits/${visitEdrpou}`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("Не вдалося знайти візит");

    const visit = await res.json();
    visit.status = "виконано";
    visit.report = reportData;

    await fetch(`${API_URL}/visits/${visitEdrpou}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(visit)
    });

    const labRes = await fetch(`${API_URL}/labs/${visit.labId}`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!labRes.ok) throw new Error("Не вдалося знайти лабораторію");

    const lab = await labRes.json();

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

    await fetch(`${API_URL}/labs/${lab.edrpou}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(lab)
    });

    alert("✅ Звіт оброблено, візит та лабораторія оновлені у бекенд!");

  } catch (err) {
    console.error("❌ Помилка при обробці звіту:", err);
    alert("⚠️ Не вдалося обробити звіт. Перевірте консоль.");
  }
}

// ==========================
// Збереження лабораторії у бекенд
// ==========================
async function saveLabCard() {
  try {
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

    if (!labCard.partner || !labCard.region || !labCard.city || !labCard.institution) {
      alert("⚠️ Заповніть обов'язкові поля: Контрагент, Область, Місто, ЛПЗ.");
      return;
    }

    const token = localStorage.getItem("token");

    // 1️⃣ Зберігаємо лабораторію у бекенд
    const res = await fetch(`${API_URL}/labs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(labCard)
    });

    if (!res.ok) throw new Error("Не вдалося зберегти лабораторію");
    const savedLab = await res.json();

    // 2️⃣ Генеруємо задачі та візити
    const deviceTasks = await generateDeviceTasksWithDueDates(savedLab);
    const monthlyVisits = await generateMonthlyLabVisits(deviceTasks);

    // 3️⃣ Оновлюємо лабораторію задачами
    savedLab.tasks = deviceTasks;

    // 4️⃣ Зберігаємо оновлену лабораторію
    await fetch(`${API_URL}/labs/${savedLab.edrpou}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(savedLab)
    });

    // 5️⃣ Зберігаємо візити у бекенд
    await fetch(`${API_URL}/visits/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(monthlyVisits.map(v => ({
        id: `${savedLab.edrpou}_${v.date}_${Date.now()}`,
        labId: savedLab.edrpou,
        labName: savedLab.partner,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      })))
    });

    alert("✅ Лабораторію збережено і візити відправлено у бекенд!");
    window.location.href = "./index.html";

  } catch (err) {
    console.error("❌ Помилка при збереженні лабораторії:", err);
    alert("⚠️ Сталася помилка при збереженні. Перевірте консоль.");
  }
}

// ==========================
// Видалення лабораторії
// ==========================
async function deleteLab(edrpou) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;

  try {
    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/labs/${edrpou}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });

    await fetch(`${API_URL}/visits/byLab/${edrpou}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });

    alert("✅ Лабораторію та її візити видалено з бекенду!");
    renderLabCards();

  } catch (err) {
    console.error("❌ Помилка при видаленні лабораторії:", err);
    alert("⚠️ Не вдалося видалити лабораторію. Перевірте консоль.");
  }
}

// ==========================
// Оновлення (редагування) лабораторії у бекенд
// ==========================
async function updateLabCard(edrpou) {
  try {
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
      lastUpdated: today.toISOString()
    };

    if (!labCard.partner || !labCard.region || !labCard.city || !labCard.institution) {
      alert("⚠️ Заповніть обов'язкові поля: Контрагент, Область, Місто, ЛПЗ.");
      return;
    }

    const token = localStorage.getItem("token");

    // 1️⃣ Генеруємо задачі та візити
    const deviceTasks = await generateDeviceTasksWithDueDates(labCard);
    const monthlyVisits = await generateMonthlyLabVisits(deviceTasks);
    labCard.tasks = deviceTasks;

    // 2️⃣ Оновлюємо лабораторію у бекенді
    const res = await fetch(`${API_URL}/labs/${edrpou}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(labCard)
    });

    if (!res.ok) throw new Error("Не вдалося оновити лабораторію");

        // 3️⃣ Зберігаємо нові візити у бекенд
    await fetch(`${API_URL}/visits/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(monthlyVisits.map(v => ({
        id: `${edrpou}_${v.date}_${Date.now()}`,
        labId: edrpou,
        labName: labCard.partner,
        date: v.date,
        tasks: v.tasks,
        status: "заплановано"
      })))
    });

    alert("✅ Лабораторію оновлено і нові візити збережено у бекенд!");
    window.location.href = "./index.html";

  } catch (err) {
    console.error("❌ Помилка при оновленні лабораторії:", err);
    alert("⚠️ Сталася помилка при оновленні. Перевірте консоль.");
  }
}

// ==========================
// Редагування лабораторії (перехід на форму)
// ==========================
function editLabCard(edrpou) {
  sessionStorage.setItem("editLabEdrpou", edrpou);
  window.location.href = "./labcard.html";
}
// ==========================
// Рендеринг списку лабораторій
// ==========================
async function renderLabCards(filteredLabs = null) {
  try {
    const labs = filteredLabs || labsCache;
    const container = document.getElementById("labsContainer");
    if (!container) {
      console.warn("⚠️ labsContainer не знайдено — ця функція працює лише на labs.html");
      return;
    }

    container.innerHTML = "";

    if (!labs || labs.length === 0) {
      container.innerHTML = "<p>⚠️ Лабораторій не знайдено.</p>";
      return;
    }

    labs.forEach(lab => {
      const card = document.createElement("div");
      card.className = "lab-card";
      card.innerHTML = `
        <h3>${lab.partner || "—"} [ЄДРПОУ: ${lab.edrpou}]</h3>
        <p>🏥 ЛПЗ: ${lab.institution || "—"}</p>
        <p>📍 ${lab.region || "—"}, ${lab.city || "—"}</p>
        <p>📞 ${lab.phone || "—"}</p>
        <p>👤 Менеджер: ${lab.manager || "—"}</p>
        <div class="lab-actions">
          <button onclick="editLabCard('${lab.edrpou}')">✏️ Редагувати</button>
          <button onclick="deleteLab('${lab.edrpou}')">🗑️ Видалити</button>
          <button onclick="planVisit('${lab.edrpou}')">📅 Запланувати візит</button>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error("❌ Помилка при рендерингу лабораторій:", err);
    alert("⚠️ Не вдалося відобразити лабораторії.");
  }
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
// Планування візиту через календар
// ==========================
async function planVisit(edrpou) {
  try {
    const selectedDate = sessionStorage.getItem("selectedDate");
    if (!selectedDate) {
      alert("⚠️ Спочатку виберіть дату у календарі.");
      return;
    }

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/labs/${edrpou}`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("Не вдалося знайти лабораторію");

    const lab = await res.json();
    const tasks = await generateDeviceTasksWithDueDates(lab);

    const newVisit = {
      id: `${edrpou}_${Date.now()}`,
      labId: edrpou,
      labName: lab.partner,
      date: selectedDate,
      tasks,
      status: "заплановано"
    };

    await fetch(`${API_URL}/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(newVisit)
    });

    alert("✅ Візит заплановано!");
    setTimeout(() => {
      window.location.href = "../calendar/calendar.html";
    }, 500);

  } catch (err) {
    console.error("❌ Помилка при плануванні візиту:", err);
    alert("⚠️ Не вдалося запланувати візит. Перевірте консоль.");
  }
}
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
function loadLabCards() {
  return JSON.parse(localStorage.getItem("labCards")) || [];
}

// ==========================
// Глобальні прив’язки до window
// ==========================
window.loadLabsCache = loadLabsCache;
window.loadLabCards = loadLabCards;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;

window.fillRegionOptions = fillRegionOptions;
window.fillCityOptions = fillCityOptions;
window.fillLpzOptions = fillLpzOptions;
window.prefillLabData = prefillLabData;

window.initLabCard = initLabCard;
window.addDevice = addDevice;
window.loadCalculator = loadCalculator;
window.renderTestCountField = renderTestCountField;
window.renderReagentFields = renderReagentFields;
window.renderAnalysisFields = renderAnalysisFields;

window.generateDeviceTasksWithDueDates = generateDeviceTasksWithDueDates;
window.generateMonthlyLabVisits = generateMonthlyLabVisits;
window.generateAllLabVisits = generateAllLabVisits;
window.applyFieldUpdatesFromVisits = applyFieldUpdatesFromVisits;
window.processVisitReport = processVisitReport;
window.planVisit = planVisit;

window.saveLabCard = saveLabCard;
window.updateLabCard = updateLabCard;
window.deleteLab = deleteLab;
window.editLabCard = editLabCard;
window.renderLabCards = renderLabCards;
window.showTaskPreviewBeforeSave = showTaskPreviewBeforeSave;

window.toISODateLocal = toISODateLocal;
window.formatDate = formatDate;
window.setValue = setValue;
window.getValue = getValue; 
window.loadLabCards = loadLabCards;