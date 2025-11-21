// Calendar.js — узгоджена версія, яка працює тільки з localStorage.visits
// Дата зберігається виключно у форматі "YYYY-MM-DD" без toISOString(), щоб уникнути зсувів

// ===== Утиліти дат =====
function formatDateYYYYMMDD(dateObj) {
  // Повертає локальну дату у форматі YYYY-MM-DD без часових зсувів
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNextDeliveryDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return formatDateYYYYMMDD(nextMonth);
}

export function getDeliveryDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return formatDateYYYYMMDD(nextMonth);
}

// ===== Робота зі сховищем =====
function loadVisits() {
  return JSON.parse(localStorage.getItem("visits") || "[]");
}

function saveVisits(visits) {
  localStorage.setItem("visits", JSON.stringify(visits));
}

function loadLabCards() {
  return JSON.parse(localStorage.getItem("labCards") || "[]");
}

// М'яка міграція: якщо є legacy calendarTasks — переносимо у visits і видаляємо
function migrateCalendarTasksToVisits() {
  const legacy = JSON.parse(localStorage.getItem("calendarTasks") || "[]");
  if (!legacy.length) return;

  const visits = loadVisits();
  const migrated = legacy.map(t => ({
    id: `legacy_${t.id || Date.now()}`,
    labId: t.labId || null,
    labName: t.lab || "",
    date: t.date, // очікується YYYY-MM-DD
    tasks: [
      {
        device: t.device || "",
        title: t.title || "",
        description: t.description || "",
        priority: t.priority || "середній",
        action: t.type || "ручне додавання"
      }
    ],
    status: t.status || "заплановано"
  }));

  saveVisits([...visits, ...migrated]);
  localStorage.removeItem("calendarTasks");
}

// ===== Генерація подій (інформаційні, якщо потрібно) =====
export function generateEvents({
  device,
  partner,
  soldDate,
  testsPerDay,
  reagents,
  serviceIntervalDays = 90,
  replacementAfterDays = 365
}) {
  const events = [];
  const startDate = new Date(soldDate);

  // Події закупівлі реагентів (інформаційні)
  reagents.forEach(r => {
    const dailyUsage = r.usagePerTest * testsPerDay;
    const daysToDepletion = Math.floor(r.volume / dailyUsage);
    const depletionDate = new Date(startDate);
    depletionDate.setDate(depletionDate.getDate() + daysToDepletion - 5);

    events.push({
      date: formatDateYYYYMMDD(depletionDate),
      type: "реагенти",
      title: `🔬 Закупівля ${r.name}`,
      partner,
      device,
      description: `Очікуване вичерпання реагенту ${r.name}. Рекомендується зв’язатися з партнером.`
    });
  });

  // Сервіс кожні serviceIntervalDays
  for (let i = serviceIntervalDays; i < replacementAfterDays; i += serviceIntervalDays) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    events.push({
      date: formatDateYYYYMMDD(date),
      type: "сервіс",
      title: `🛠️ Сервісне обслуговування ${device}`,
      partner,
      device,
      description: `Плановий сервіс приладу ${device}`
    });
  }

  // Заміна приладу
  const replacementDate = new Date(startDate);
  replacementDate.setDate(replacementDate.getDate() + replacementAfterDays);
  events.push({
    date: formatDateYYYYMMDD(replacementDate),
    type: "заміна",
    title: `🔁 Пропозиція заміни ${device}`,
    partner,
    device,
    description: `Оцінити потребу в оновленні приладу ${device}`
  });

  return events;
}

// ===== Генерація візитів на основі labCards (механізм 1: авто) =====
export function generateVisitsFromLabCards() {
  const labCards = loadLabCards();
  const visits = loadVisits();
  const nextDelivery = getNextDeliveryDate();

  const newVisits = [];

  labCards.forEach(lab => {
    (lab.devices || []).forEach(device => {
      // Якщо немає reagents — пропускаємо інформаційний блок
      const reagents = device.reagents || [];
      reagents.forEach(r => {
        const reagentList = r.usage
          ? Object.entries(r.usage)
              .map(([name, amount]) => `${name}: ${amount.toFixed(2)} мл`)
              .join(", ")
          : "";

        newVisits.push({
          id: `${lab.id || lab.edrpou || lab.partner}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          labId: lab.id || lab.edrpou || null,
          labName: lab.partner,
          date: nextDelivery,
          tasks: [
            {
              device: device.device || "",
              title: `🔬 ${r.name} — ${r.count} тестів`,
              description: reagentList ? `📦 Витрата: ${reagentList}` : "",
              priority: "середній",
              action: "Закупівля реагентів"
            }
          ],
          status: "заплановано"
        });
      });

      // Додатково: базовий план сервісу через serviceIntervalDays, якщо задано
      const serviceIntervalDays = device.serviceIntervalDays || 90;
      const startDate = device.soldDate ? new Date(device.soldDate) : new Date();
      const firstServiceDate = new Date(startDate);
      firstServiceDate.setDate(firstServiceDate.getDate() + serviceIntervalDays);

      newVisits.push({
        id: `${lab.id || lab.edrpou || lab.partner}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        labId: lab.id || lab.edrpou || null,
        labName: lab.partner,
        date: formatDateYYYYMMDD(firstServiceDate),
        tasks: [
          {
            device: device.device || "",
            title: `🛠️ Плановий сервіс`,
            description: `Плановий сервіс приладу`,
            priority: "середній",
            action: "Сервіс"
          }
        ],
        status: "заплановано"
      });
    });
  });

  // Апсерт без дублювання: ключ дублювання (labId + date)
  const existingKeys = new Set(visits.map(v => `${v.labId || v.labName}_${v.date}`));
  const merged = [
    ...visits,
    ...newVisits.filter(v => !existingKeys.has(`${v.labId || v.labName}_${v.date}`))
  ];

  saveVisits(merged);
  return newVisits;
}

// ===== Оновлення статусу візиту =====
export function updateVisitStatus(visitId, status) {
  const visits = loadVisits();
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx !== -1) {
    visits[idx].status = status;
    saveVisits(visits);
  }
}

// ===== Обробка звітів і генерація річного плану (механізм 1: авто) =====
// Очікується, що window.generateAllLabVisits(labs) повертає масив візитів у формі:
// [{ labId, lab, date (YYYY-MM-DD), tasks: [{device, title, description, priority, action}], status? }]
export async function processVisitReport(visitReports) {
  migrateCalendarTasksToVisits(); // одноразова міграція старих записів

  const allLabs = loadLabCards();

  const updatedLabs = typeof window.applyFieldUpdatesFromVisits === "function"
    ? window.applyFieldUpdatesFromVisits(allLabs, visitReports)
    : allLabs;

  localStorage.setItem("labCards", JSON.stringify(updatedLabs));

  let generated = [];
  if (typeof window.generateAllLabVisits === "function") {
    generated = await window.generateAllLabVisits(updatedLabs);
  } else {
    // Якщо немає глобальної функції — робимо базову генерацію на місяць вперед з reagents
    generated = generateVisitsFromLabCards();
  }

  const visits = loadVisits();

  // Апсерт нових візитів
  const existingKeys = new Set(visits.map(v => `${v.labId || v.labName}_${v.date}`));
  const toAdd = [];

  generated.forEach(visit => {
    const key = `${visit.labId || visit.lab}_${visit.date}`;
    const normalized = {
      id: `${visit.labId || visit.lab}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      labId: visit.labId || null,
      labName: visit.labName || visit.lab,
      date: visit.date, // очікується YYYY-MM-DD
      tasks: Array.isArray(visit.tasks) ? visit.tasks : [],
      status: visit.status || "заплановано"
    };
    if (!existingKeys.has(key)) {
      toAdd.push(normalized);
    }
  });

  saveVisits([...visits, ...toAdd]);

  if (typeof window.renderFullCalendar === "function") {
    window.renderFullCalendar();
  }
}

// ===== Допоміжні механізми (механізм 2 і 3: ручні) =====
export function createManualVisit({ labId, labName, date, tasks = [] }) {
  // використовується з index.html або при кліку у календарі
  const visits = loadVisits();
  const normalizedDate = date; // формат YYYY-MM-DD очікується напряму

  // видаляємо дубль того ж labId + date
  const filtered = visits.filter(v => !( (v.labId || v.labName) === (labId || labName) && v.date === normalizedDate ));

  const newVisit = {
    id: `${labId || labName}_${Date.now()}`,
    labId: labId || null,
    labName,
    date: normalizedDate,
    tasks,
    status: "заплановано"
  };

  saveVisits([...filtered, newVisit]);
  return newVisit;
}

// ===== Фінансові розрахунки (залишено з твого файлу) =====
export default {
  calculateFinancials({
    devicePrice,
    reagentCosts,
    serviceCosts,
    replacementCosts
  }) {
    const totalCosts = reagentCosts + serviceCosts + replacementCosts;
    const profit = devicePrice - totalCosts;

    return {
      totalCosts,
      profit
    };
  }
};
