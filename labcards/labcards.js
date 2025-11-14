let lpzList = [];
let filteredList = [];
const calculators = {};
let kpListByDevice = {};
let deviceCount = 0;
const availableCalculators = ["LS-1100", "DF-50", "UN-73", "Citolab-300", "DH-36"];
const scheduledDate = await window.findNearbyAvailableDate(city, taskSchedule, window.ORS_TOKEN, baseDate);

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
function addDevice() {
  const container = document.getElementById("devicesContainer");
  const index = deviceCount++;

  const block = document.createElement("div");
  block.className = "device-block";
  block.id = `deviceBlock_${index}`;
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

  document.getElementById(`device_${index}`).addEventListener("change", () => {
    loadCalculator(index);
    const deviceName = document.getElementById(`device_${index}`).value;
    const kpOptions = kpListByDevice[deviceName] || [];
    const kpSelect = document.getElementById(`kpSelect_${index}`);
    kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
      kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
  });

  document.getElementById(`workType_${index}`).addEventListener("change", (e) => {
    const show = e.target.value === "заміна деталей";
    document.getElementById(`replacedPartsBlock_${index}`).style.display = show ? "block" : "none";
  });

  document.getElementById(`removeDevice_${index}`).addEventListener("click", () => {
    block.remove();
  });
}

function loadCalculator(index) {
  const deviceName = document.getElementById(`device_${index}`)?.value?.trim();
  if (!deviceName) return;

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (calculators[key]) {
    const config = calculators[key];
    renderTestCountField(index, config);
    renderReagentFields(index, config);
    if (deviceName === "LS-1100") {
      renderAnalysisFields(index, config);
    }
    return;
  }

  fetch(`../calculators/${key}.json`)
    .then(res => res.json())
    .then(config => {
      calculators[key] = config;
      renderTestCountField(index, config);
      renderReagentFields(index, config);
      if (deviceName === "LS-1100") {
        renderAnalysisFields(index, config);
      }
    })
    .catch(err => {
      console.error(`❌ Не вдалося завантажити калькулятор: ${key}.json`, err);
    });
}

function renderTestCountField(index, config) {
  const container = document.getElementById(`deviceBlock_${index}`);
  if (!container) return;

  const html = `
    <label>🔬 Кількість досліджень на день:
      <input type="number" id="testCount_${index}" min="0" value="${config.testsPerDay || ''}" />
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
function renderAnalysisFields(index, config) {
  const container = document.getElementById(`analysisFields_${index}`);
  container.innerHTML = "<h4>📋 Аналізи (LS-1100)</h4>";

  Object.entries(config.analyses).forEach(([name]) => {
    const row = document.createElement("div");
    row.innerHTML = `
      <label>${name}:</label>
      <input type="number" min="0" id="analysis_${index}_${name}" data-analysis="${name}" placeholder="Кількість тестів">
    `;
    container.appendChild(row);
  });
}


async function generateDeviceTasksWithDueDates(lab) {
  const tasks = [];
  const baseDate = new Date(lab.saveDate || new Date()); // дата збереження/редагування
  const endDate = new Date(baseDate);
  endDate.setFullYear(endDate.getFullYear() + 1); // формуємо на рік вперед

  for (const device of lab.devices) {
    const { device: deviceName, testCount } = device;
    const configKey = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const config = calculators[configKey];
    if (!config || !config.reagents || config.reagents.length === 0) continue;

    // цикл по місяцях протягом року
    for (let i = 1; i <= 12; i++) {
      const visitDate = new Date(baseDate);
      visitDate.setMonth(visitDate.getMonth() + i);

      // ✅ сервісні задачі раз на квартал
      if (i % 3 === 0) {
        tasks.push({
          lab: lab.partner,
          city: lab.city,
          device: deviceName,
          taskType: "service",
          dueDate: visitDate, // зберігаємо як Date
          source: "auto"
        });
      }

      // ✅ задачі по реагентах щомісяця
      for (const r of config.reagents) {
        const perTest = Number(r.perTest);
        const startup = Number(r.startup) || 0;
        const shutdown = Number(r.shutdown) || 0;
        const volume = Number(r.packageSize);

        if (!perTest || !volume) continue;

        const daily = perTest * testCount + startup + shutdown;
        if (!daily || daily <= 0) continue;

        // розрахунок кількості упаковок на місяць
        const neededQuantity = Math.ceil((daily * 30) / volume);

        tasks.push({
          lab: lab.partner,
          city: lab.city,
          device: deviceName,
          taskType: "reagents",
          reagentName: r.name,
          neededQuantity,
          dueDate: visitDate, // зберігаємо як Date
          source: "auto"
        });
      }
    }
  }

  // 🔧 порівнюємо дати коректно
  return tasks.filter(t => t.dueDate <= endDate);
}


async function generateMonthlyLabVisits(allDeviceTasks) {
  const visitsByLab = {};
  const taskSchedule = {};
  const today = new Date();

  // 🔧 групуємо задачі по лабораторіях
  for (const task of allDeviceTasks) {
    const { lab, city } = task;
    const labKey = `${lab}__${city}`;
    if (!visitsByLab[labKey]) visitsByLab[labKey] = [];
    visitsByLab[labKey].push(task); // зберігаємо повний task
  }

  const monthlyVisits = [];

  for (const labKey in visitsByLab) {
    const [labName, city] = labKey.split("__");
    const tasks = visitsByLab[labKey];

    const buckets = {};

    for (const t of tasks) {
      // 🔧 плануємо візит за 2 тижні до дедлайну
      const visitDate = new Date(t.dueDate);
      visitDate.setDate(visitDate.getDate() - 14);

      const year = visitDate.getFullYear();
      const month = visitDate.getMonth(); // 0–11
      const key = `${year}-${month}`;

      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    }

    for (const monthKey in buckets) {
      const visitTasks = buckets[monthKey];
      const [year, month] = monthKey.split("-");
      const baseDate = new Date(Number(year), Number(month), 15); // 🔧 середина місяця

      // 🔧 використовуємо ISO-рядок як ключ для taskSchedule
      const scheduledDate = await findNearbyAvailableDate(city, taskSchedule, ORS_TOKEN, baseDate);
      const scheduleKey = new Date(scheduledDate).toISOString().split("T")[0];
      taskSchedule[scheduleKey] = [...(taskSchedule[scheduleKey] || []), { city }];

      const visit = {
        type: "labVisit",
        title: `🔍 Візит до лабораторії ${labName}`,
        date: scheduleKey,
        lab: labName,
        city,
        tasks: visitTasks.map(t => {
          const delta = (t.dueDate - today) / (1000 * 60 * 60 * 24);
          let priority = "🟢";
          if (delta <= 0) priority = "🔴";
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
    saveDate: today.toISOString() // 🔧 важливо для генерації задач
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
      Object.keys(config.analyses).forEach(name => {
        const input = document.getElementById(`analysis_${i}_${name}`);
        if (input && input.value) {
          device.analyses[name] = parseInt(input.value);
        }
      });
    }

    // 🔧 Реагенти
    if (config?.reagents) {
      config.reagents.forEach(r => {
        const count = document.getElementById(`reagentCount_${i}_${r.name}`)?.value;
        const date = document.getElementById(`reagentDate_${i}_${r.name}`)?.value;
        device.reagentsInfo[r.name] = {
          lastOrderCount: count ? parseInt(count) : null,
          lastOrderDate: date || null
        };
      });
    }

    labCard.devices.push(device);
  }

  // 🔧 Генерація задач
  const deviceTasks = await generateDeviceTasksWithDueDates(labCard);
  const allTasks = await generateMonthlyLabVisits(deviceTasks);

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


function deleteLab(index) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;
  labCards.splice(index, 1);
  localStorage.setItem("labCards", JSON.stringify(labCards));
  renderLabCards(labCards);
}

function editLabCard(index) {
  const lab = labCards[index];
  localStorage.setItem("editLabCard", JSON.stringify({ index, lab }));
  window.location.href = "./labcard.html";
}

function renderLabCards(filteredLabs) {
  const container = document.getElementById("labList");
  container.innerHTML = '';

  // 🔧 Панель фільтрів
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

  // 🔧 Рендер карток лабораторій
  filteredLabs.forEach((lab, index) => {
    const div = document.createElement("div");
    div.className = "lab-card";
    div.innerHTML = `
      <h3>${index + 1}. ${lab.partner}</h3>
      <div class="lab-actions">
        <button onclick="editLabCard(${index})">✏️ Редагувати</button>
        <button onclick="deleteLab(${index})">🗑️ Видалити</button>
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
  });

  // 🔧 Кнопка переходу до календаря
  const calendarBtn = document.createElement("div");
  calendarBtn.className = "calendar-btn";
  calendarBtn.innerHTML = `<a href="../calendar/calendar.html"><button>📅 Перейти до календаря задач</button></a>`;
  container.appendChild(calendarBtn);
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
