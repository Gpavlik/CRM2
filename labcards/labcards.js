let lpzList = [];
let filteredList = [];
let deviceCount = 0;
const calculators = {};
const availableCalculators = ["LS-1100", "DF-50", "UN-73", "Citolab-300", "DH-36"];

async function loadLPZList() {
  const res = await fetch("./lpzlist.json");
  lpzList = await res.json();
  filteredList = [...lpzList];
  updateRegionList();
  updateCityList();
  updateLPZList();
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
  }
}

function addDevice() {
  const container = document.getElementById("devicesContainer");
  const index = deviceCount++;

  const block = document.createElement("div");
  block.className = "device-block";
  block.innerHTML = `
    <label for="device_${index}">🔧 Назва приладу:</label>
    <select id="device_${index}">
      <option value="">Оберіть прилад</option>
      ${availableCalculators.map(name => `<option value="${name}">${name}</option>`).join("")}
    </select>

    <label for="soldDate_${index}">📅 Дата продажу:</label>
    <input type="date" id="soldDate_${index}">

    <label for="lastService_${index}">🛠️ Останній сервіс:</label>
    <input type="date" id="lastService_${index}">

    <label for="replacedParts_${index}">🔧 Замінені деталі:</label>
    <input type="text" id="replacedParts_${index}" placeholder="Фільтр, насос">

    <div id="analysisFields_${index}"></div>
  `;
  container.appendChild(block);

  document.getElementById(`device_${index}`).addEventListener("change", () => {
    loadCalculator(index);
  });
}

function loadCalculator(index) {
  const deviceName = document.getElementById(`device_${index}`).value.trim();
  if (!deviceName) return;

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const configName = `${key}Config`;

  if (calculators[key]) {
    renderAnalysisFields(index, calculators[key]);
    return;
  }

  if (document.getElementById(`calcScript_${key}`)) return;

  const script = document.createElement("script");
  script.id = `calcScript_${key}`;
  script.src = `../calculators/${deviceName}.js`;
  script.onload = () => {
    const config = window[configName];
    if (config) {
      calculators[key] = config;
      renderAnalysisFields(index, config);
    } else {
      console.error(`❌ Не знайдено ${configName} у ${script.src}`);
    }
  };
  script.onerror = () => {
    console.error(`❌ Помилка завантаження калькулятора: ${script.src}`);
  };
  document.body.appendChild(script);
}

function renderAnalysisFields(index, config) {
  const container = document.getElementById(`analysisFields_${index}`);
  container.innerHTML = "<h4>📋 Аналізи та додаткові параметри</h4>";

  const extraFields = {
    testCount: { label: "🔬 Кількість досліджень:", type: "number", id: `testCount_${index}`, placeholder: "Наприклад: 120" },
    reagentCount: { label: "🧪 Закуплені набори реагентів:", type: "number", id: `reagentCount_${index}`, placeholder: "Наприклад: 15" },
    reagentDate: { label: "📦 Дата останньої закупівлі реагентів:", type: "date", id: `reagentDate_${index}` }
  };

  Object.values(extraFields).forEach(f => {
    const row = document.createElement("div");
    row.innerHTML = `
      <label>${f.label}</label>
      <input type="${f.type}" id="${f.id}" ${f.placeholder ? `placeholder="${f.placeholder}"` : ""}>
    `;
    container.appendChild(row);
  });

  Object.entries(config.analyses).forEach(([name]) => {
    const row = document.createElement("div");
    row.innerHTML = `
      <label>${name}:</label>
      <input type="number" min="0" id="analysis_${index}_${name}" data-analysis="${name}" placeholder="Кількість тестів">
    `;
    container.appendChild(row);
  });

  const preview = document.createElement("div");
  preview.className = "usage-preview";
  preview.id = `usagePreview_${index}`;
  const financeBtn = document.createElement("button");
financeBtn.textContent = "📊 Фінансовий аналіз";
financeBtn.style.marginTop = "10px";
financeBtn.onclick = () => {
  const testsInput = document.getElementById(`testCount_${index}`);
  const priceInput = document.getElementById(`testPrice_${index}`); // додаткове поле, якщо хочеш

  const testsPerDay = parseInt(testsInput?.value) || config.testsPerDay;
  const testPrice = parseFloat(priceInput?.value) || config.testPrice;

  const result = config.calculateFinancials(testsPerDay, testPrice);

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>📊 Фінансовий аналіз (${config.deviceName})</h3>
    <ul>
      <li>Робочих днів: ${result.workDays}</li>
      <li>Загальна кількість тестів: ${result.totalTests}</li>
      <li>Дохід: ${result.annualRevenue.toFixed(2)} грн</li>
      <li>Витрати на реагенти: ${result.totalReagentCost.toFixed(2)} грн</li>
      <li>Прибуток: ${result.annualProfit.toFixed(2)} грн</li>
      <li>Собівартість тесту: ${result.costPerTest.toFixed(2)} грн</li>
      <li>Окупність: ${result.paybackDay} днів</li>
      <li>Чистий фінрезультат: ${result.finalNetProfit.toFixed(2)} грн</li>
    </ul>
    <button onclick="this.closest('.modal').remove()">❌ Закрити</button>
  `;
  document.body.appendChild(modal);
};
container.appendChild(financeBtn);

  preview.innerText = `💡 Введіть кількість тестів для ${config.deviceName || "приладу"}, щоб побачити витрати.`;
  container.appendChild(preview);
}
function findAvailableDate(startDate, taskSchedule) {
  let date = new Date(startDate);
  while (true) {
    const iso = date.toISOString().split("T")[0];
    const count = taskSchedule[iso]?.length || 0;
    if (count < 6 && ![0, 6].includes(date.getDay())) return iso;
    date.setDate(date.getDate() + 1);
  }
}

function updateCalendarTasksForLab(lab) {
  const allTasks = JSON.parse(localStorage.getItem("calendarTasks") || "[]");
  const filtered = allTasks.filter(t => t.lab !== lab.partner);
  const taskSchedule = {};
  const tasks = [];
  const today = new Date();
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(today.getFullYear() + 1);

  lab.devices.forEach(device => {
    const { device: deviceName, lastService, reagentDate } = device;

    if (lastService) {
      let date = new Date(lastService);
      while (date < oneYearLater) {
        const scheduledDate = findAvailableDate(date, taskSchedule);
        const task = {
          type: "service",
          title: `🔧 Сервіс: ${deviceName}`,
          description: `Сервіс приладу ${deviceName} (${lab.partner}, ${lab.city})`,
          date: scheduledDate,
          device: deviceName,
          lab: lab.partner,
          region: lab.region,
          city: lab.city
        };
        tasks.push(task);
        taskSchedule[scheduledDate] = taskSchedule[scheduledDate] || [];
        taskSchedule[scheduledDate].push(task);
        date.setMonth(date.getMonth() + 6);
      }
    }

    if (reagentDate) {
      let date = new Date(reagentDate);
      while (date < oneYearLater) {
        const scheduledDate = findAvailableDate(date, taskSchedule);
        const task = {
          type: "reagents",
          title: `📦 Закупівля: ${deviceName}`,
          description: `Закупити реагенти для ${deviceName} (${lab.partner}, ${lab.city})`,
          date: scheduledDate,
          device: deviceName,
          lab: lab.partner,
          region: lab.region,
          city: lab.city
        };
        tasks.push(task);
        taskSchedule[scheduledDate] = taskSchedule[scheduledDate] || [];
        taskSchedule[scheduledDate].push(task);
        date.setMonth(date.getMonth() + 3);
      }
    }
  });

  localStorage.setItem("calendarTasks", JSON.stringify([...filtered, ...tasks]));
}

function saveLabCard() {
  console.log("Збереження...");
  const partner = document.getElementById("partnerName").value.trim();
  const region = document.getElementById("region").value.trim();
  const city = document.getElementById("city").value.trim();
  const institution = document.getElementById("lpz").value.trim();
  const address = document.getElementById("labAddress").value.trim();
  const contractor = document.getElementById("contractor").value.trim();
  const phone = document.getElementById("phone").value.trim();

  const devices = [];

  for (let i = 0; i < deviceCount; i++) {
    const deviceName = document.getElementById(`device_${i}`)?.value.trim();
    if (!deviceName) continue;

    const device = {
      device: deviceName,
      soldDate: document.getElementById(`soldDate_${i}`)?.value || null,
      lastService: document.getElementById(`lastService_${i}`)?.value || null,
      replacedParts: document.getElementById(`replacedParts_${i}`)?.value.trim() || null,
      testCount: document.getElementById(`testCount_${i}`)?.value || null,
            reagentCount: document.getElementById(`reagentCount_${i}`)?.value || null,
      reagentDate: document.getElementById(`reagentDate_${i}`)?.value || null,
      analyses: {}
    };

    const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const config = calculators[configKey];
    if (config?.analyses) {
      Object.keys(config.analyses).forEach(name => {
        const input = document.getElementById(`analysis_${i}_${name}`);
        if (input && input.value) {
          device.analyses[name] = parseInt(input.value);
        }
      });
    }

    devices.push(device);
  }

  const labCard = {
    partner,
    region,
    city,
    institution,
    address,
    contractor,
    phone,
    devices
  };

  updateCalendarTasksForLab(labCard);

  const editData = JSON.parse(localStorage.getItem("editLabCard") || "null");
  if (editData) {
    const all = JSON.parse(localStorage.getItem("labCards") || "[]");
    all[editData.index] = labCard;
    localStorage.setItem("labCards", JSON.stringify(all));
    localStorage.removeItem("editLabCard");
  } else {
    const existing = JSON.parse(localStorage.getItem("labCards") || "[]");
    existing.push(labCard);
    localStorage.setItem("labCards", JSON.stringify(existing));
  }

  alert("✅ Лабораторію збережено і задачі оновлено!");
  window.location.href = "./index.html";
}
