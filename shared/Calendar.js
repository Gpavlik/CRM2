// Calendar.js — узгоджена версія, яка працює тільки з localStorage.visits у форматі devices
// Дата зберігається виключно у форматі "YYYY-MM-DD" без toISOString(), щоб уникнути зсувів

// ===== Утиліти дат =====
function formatDateYYYYMMDD(dateObj) {
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

// ===== Робота зі сховищем =====
function loadVisits() {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  // міграція tasks → devices
  visits = visits.map(v => normalizeVisit(v));
  localStorage.setItem("visits", JSON.stringify(visits));
  return visits;
}
function saveVisits(visits) {
  localStorage.setItem("visits", JSON.stringify(visits));
}
function loadLabCards() {
  return JSON.parse(localStorage.getItem("labCards") || "[]");
}

// ===== Міграція tasks → devices =====
function normalizeVisit(visit) {
  if (visit.devices) return visit;
  const devicesMap = {};
  (visit.tasks || []).forEach(t => {
    if (!devicesMap[t.device]) {
      devicesMap[t.device] = {
        deviceName: t.device,
        forecast: { quantity: 0 },
        agreement: { quantity: 0 },
        fact: { quantity: 0, date: "" },
        testsPerDay: 0,
        reagents: []
      };
    }
    devicesMap[t.device].reagents.push(t.action || t.title || "");
  });
  visit.devices = Object.values(devicesMap);
  delete visit.tasks;
  return visit;
}

// мігруємо всі visits
let visits = JSON.parse(localStorage.getItem("visits") || "[]");
visits = visits.map(v => normalizeVisit(v));
localStorage.setItem("visits", JSON.stringify(visits));
console.log(visits);


// ===== Генерація візитів на основі labCards =====
// Допоміжна функція для парсингу кількості з тексту задачі
function parseReagentTask(taskText) {
  // шукаємо патерн "Назва (N уп.)"
  const match = taskText.match(/(.+?)\s*\((\d+)\s*уп\.\)/);
  if (match) {
    return {
      name: match[1].trim(),
      forecast: { quantity: parseInt(match[2]) },
      agreement: { quantity: 0 },
      fact: { quantity: 0, date: "" }
    };
  }
  // якщо кількість не знайдена — створюємо базовий об’єкт
  return {
    name: taskText,
    forecast: { quantity: 0 },
    agreement: { quantity: 0 },
    fact: { quantity: 0, date: "" }
  };
}

export function generateVisitsFromLabCards() {
  const labCards = loadLabCards();
  const visits = loadVisits();
  const nextDelivery = getNextDeliveryDate();

  const newVisits = [];

  labCards.forEach(lab => {
    (lab.devices || []).forEach(device => {
      const reagents = device.reagents || [];

      // закупівля реагентів
      reagents.forEach(r => {
        const reagentTask = `Замов реагент — ${r.name} (${r.count} уп.)`;
        newVisits.push({
          id: `${lab.id || lab.partner}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          labId: lab.id || null,
          labName: lab.partner,
          date: nextDelivery,
          devices: [{
            deviceName: device.device || "",
            forecast: { quantity: 0 },
            agreement: { quantity: 0 },
            fact: { quantity: 0, date: "" },
            testsPerDay: 0,
            reagents: [parseReagentTask(reagentTask)]
          }],
          notes: "",
          status: "заплановано"
        });
      });

      // сервіс
      const serviceIntervalDays = device.serviceIntervalDays || 90;
      const startDate = device.soldDate ? new Date(device.soldDate) : new Date();
      const firstServiceDate = new Date(startDate);
      firstServiceDate.setDate(firstServiceDate.getDate() + serviceIntervalDays);

      newVisits.push({
        id: `${lab.id || lab.partner}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        labId: lab.id || null,
        labName: lab.partner,
        date: formatDateYYYYMMDD(firstServiceDate),
        devices: [{
          deviceName: device.device || "",
          forecast: { quantity: 0 },
          agreement: { quantity: 0 },
          fact: { quantity: 0, date: "" },
          testsPerDay: 0,
          reagents: [ { name: "Сервіс", forecast: { quantity: 0 }, agreement: { quantity: 0 }, fact: { quantity: 0, date: "" } } ]
        }],
        notes: "",
        status: "заплановано"
      });
    });
  });

  // Апсерт без дублювання
  const existingKeys = new Set(visits.map(v => `${v.labId || v.labName}_${v.date}`));
  const merged = [
    ...visits,
    ...newVisits.filter(v => !existingKeys.has(`${v.labId || v.labName}_${v.date}`))
  ];

  saveVisits(merged);
  return newVisits;
}



// ===== Оновлення статусу =====
export function updateVisitStatus(visitId, status) {
  const visits = loadVisits();
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx !== -1) {
    visits[idx].status = status;
    saveVisits(visits);
  }
}

// ===== Обробка звітів =====
export async function processVisitReport(visitReports) {
  const allLabs = loadLabCards();

  const updatedLabs = typeof window.applyFieldUpdatesFromVisits === "function"
    ? window.applyFieldUpdatesFromVisits(allLabs, visitReports)
    : allLabs;

  localStorage.setItem("labCards", JSON.stringify(updatedLabs));

  let generated = [];
  if (typeof window.generateAllLabVisits === "function") {
    generated = await window.generateAllLabVisits(updatedLabs);
  } else {
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
      date: visit.date,
      devices: [{
        deviceName: visit.tasks?.[0]?.device || "",
        forecast: { quantity: 0 },
        agreement: { quantity: 0 },
        fact: { quantity: 0, date: "" },
        testsPerDay: 0,
        reagents: (visit.tasks || []).map(t => t.action || t.title || "")
      }],
      notes: "",
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


// ===== Створення вручну =====
export function createManualVisit({ labId, labName, date, devices = [] }) {
  const visits = loadVisits();
  const normalizedDate = date;

  const filtered = visits.filter(v => !( (v.labId || v.labName) === (labId || labName) && v.date === normalizedDate ));

  const newVisit = {
    id: `${labId || labName}_${Date.now()}`,
    labId: labId || null,
    labName,
    date: normalizedDate,
    devices,
    notes: "",
    status: "заплановано"
  };

  saveVisits([...filtered, newVisit]);
  return newVisit;
}


// ===== Фінансові розрахунки =====
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
