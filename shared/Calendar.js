// ===== Глобальні змінні =====
let currentVisitId = null;
let calendar = null;

// ===== Допоміжні функції =====
function statusColor(status) {
  switch ((status || "").toLowerCase()) {
    case "в процесі": return "#ff9800";
    case "відмінено": return "#9e9e9e";
    case "перенесено": return "#2196f3";
    case "проведено": return "#4caf50";
    default: return "#2196f3";
  }
}
function filterByStatus(status) {
  const s = (status || "заплановано").toLowerCase();
  if (s === "заплановано") return document.getElementById("filterPlanned").checked;
  if (s === "в процесі") return document.getElementById("filterInProgress").checked;
  if (s === "відмінено") return document.getElementById("filterCancelled").checked;
  if (s === "перенесено") return document.getElementById("filterRescheduled").checked;
  if (s === "проведено") return document.getElementById("filterDone").checked;
  return true;
}
function loadVisitsLS() {
  try { return JSON.parse(localStorage.getItem("visits") || "[]"); }
  catch { return []; }
}
function eventsFromVisits(visits) {
  return visits.filter(v => filterByStatus(v.status)).map(v => ({
    id: v.id,
    title: `${v.labName} — ${v.status || "заплановано"}`,
    start: v.date,
    backgroundColor: statusColor(v.status),
    borderColor: statusColor(v.status),
    extendedProps: { visit: v }
  }));
}

// ===== Меню =====
function showVisitMenu(visit) {
  currentVisitId = visit.id;
  document.getElementById("visitMenuInfo").innerHTML = `
    <p><strong>${visit.labName}</strong></p>
    <p>Дата: ${visit.date}</p>
    <p>Статус: ${visit.status || "заплановано"}</p>
    <p>Завдання:</p>
    <ul>${(visit.devices||[]).map(d => `<li>${d.deviceName}: ${(d.reagents||[]).map(r => r.name).join(", ")}</li>`).join("")}</ul>
  `;
  document.getElementById("visitMenu").classList.add("show");
}
function hideVisitMenu() { document.getElementById("visitMenu").classList.remove("show"); }

// ===== Оновлення localStorage =====
function updateVisitStatusLS(visitId, status) {
  const visits = loadVisitsLS();
  const v = visits.find(x => x.id === visitId);
  if (v) { v.status = status; localStorage.setItem("visits", JSON.stringify(visits)); }
}
function rescheduleVisitLS(visitId, newDate) {
  const visits = loadVisitsLS();
  const v = visits.find(x => x.id === visitId);
  if (v) { v.date = newDate; v.status = "перенесено"; localStorage.setItem("visits", JSON.stringify(visits)); }
}

// ===== Дії меню =====
function onStartVisit() { updateVisitStatusLS(currentVisitId, "в процесі"); hideVisitMenu(); rerenderCalendar(); }
function onCancelVisit() { updateVisitStatusLS(currentVisitId, "відмінено"); hideVisitMenu(); rerenderCalendar(); }
function onRescheduleVisit() {
  const newDate = prompt("Нова дата (YYYY-MM-DD):");
  if (!newDate) return;
  rescheduleVisitLS(currentVisitId, newDate);
  hideVisitMenu(); rerenderCalendar();
}
function onEditLabCard() {
  const visits = loadVisitsLS();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;
  localStorage.setItem("editLabCard", JSON.stringify({ labId: v.labId }));
  window.location.href = "../labcards/labcard.html";
}

// ===== Ререндер календаря =====
function rerenderCalendar() {
  const events = eventsFromVisits(loadVisitsLS());
  calendar.removeAllEvents();
  events.forEach(e => calendar.addEvent(e));
}

// ===== Ініціалізація =====
document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    events: eventsFromVisits(loadVisitsLS()),
    eventClick: info => showVisitMenu(info.event.extendedProps.visit)
  });
  calendar.render();
});

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
export function loadVisits() {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  visits = visits.map(v => normalizeVisit(v));
  localStorage.setItem("visits", JSON.stringify(visits));
  return visits;
}

export function saveVisits(visits) {
  localStorage.setItem("visits", JSON.stringify(visits));
}

export function loadLabCards() {
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

// ===== Генерація візитів на основі labCards =====
export function parseReagentTask(taskText) {
  const match = taskText.match(/(.+?)\s*\((\d+)\s*уп\.\)/);
  if (match) {
    return {
      name: match[1].trim(),
      forecast: { quantity: parseInt(match[2]) },
      agreement: { quantity: 0 },
      fact: { quantity: 0, date: "" }
    };
  }
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
          reagents: [{ name: "Сервіс", forecast: { quantity: 0 }, agreement: { quantity: 0 }, fact: { quantity: 0, date: "" } }]
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
    if (typeof window.renderFullCalendar === "function") {
      window.renderFullCalendar();
    }
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
    // ⚠️ узгоджуємо формат devices
    const normalized = {
      id: `${visit.labId || visit.lab}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      labId: visit.labId || null,
      labName: visit.labName || visit.lab,
      date: visit.date,
      devices: visit.devices || [],
      notes: visit.notes || "",
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

  const filtered = visits.filter(v => !((v.labId || v.labName) === (labId || labName) && v.date === normalizedDate));

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
export function calculateFinancials({ devicePrice, reagentCosts, serviceCosts, replacementCosts }) {
  const totalCosts = reagentCosts + serviceCosts + replacementCosts;
  const profit = devicePrice - totalCosts;
  return { totalCosts, profit };
}

// ===== Синхронізація факту у labCard =====
export function syncFactToLabCard(visit) {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const lab = labCards.find(l => l.id === visit.labId);
  if (!lab) return;

  visit.devices.forEach(device => {
    const labDevice = lab.devices.find(d => d.name === device.name);
    if (!labDevice) return;

    device.reagents.forEach(r => {
      const labReagent = labDevice.reagents.find(lr => lr.name === r.name);
      if (!labReagent || !r.fact?.quantity || !r.fact?.date) return;

      labReagent.lastDelivery = {
        quantity: r.fact.quantity,
        date: r.fact.date
      };
    });
  });

  localStorage.setItem("labCards", JSON.stringify(labCards));
}

// ===== Прогноз наступного візиту =====
export function predictNextVisitDate(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return [];

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const predictions = [];

  lab.devices.forEach(device => {
    device.reagents.forEach(reagent => {
      const lastDelivery = reagent.lastDelivery;
      if (!lastDelivery?.quantity || !lastDelivery?.date) return;

      let totalUsed = 0;
      visits.forEach(v => {
        if (v.labId !== labId) return;
        (v.devices || []).forEach(d => {
          if (d.name !== device.name) return;
          (d.reagents || []).forEach(r => {
            if (r.name !== reagent.name || !r.fact?.date || !r.fact?.quantity) return;
            const factDate = new Date(r.fact.date);
            if (factDate >= startWindow && factDate <= now) {
              totalUsed += r.fact.quantity;
            }
          });
        });
      });

      const daysUsed = (now - startWindow) / (1000 * 60 * 60 * 24);
      const dailyRate = totalUsed / daysUsed || 0.01;

      const daysLeft = reagent.lastDelivery.quantity / dailyRate;
      const nextVisitDate = new Date(new Date(reagent.lastDelivery.date).getTime() + (daysLeft - reserveDays) * 24 * 60 * 60 * 1000);

      predictions.push({
        reagent: reagent.name,
        device: device.name,
        nextVisitDate: nextVisitDate.toISOString().split("T")[0],
        daysLeft: Math.round(daysLeft),
        dailyRate: dailyRate.toFixed(2)
      });
    });
  });

  return predictions;
}

// ===== Автопланування задач =====
export function autoPlanNextTasks(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return;

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  (lab.devices || []).forEach(device => {
    (device.reagents || []).forEach(reagent => {
      if (!reagent.lastDelivery?.quantity || !reagent.lastDelivery?.date) return;

      let totalUsed = 0;
      visits.forEach(v => {
        if (v.labId !== labId) return;
        (v.devices || []).forEach(d => {
          if (d.name !== device.name) return;
          (d.reagents || []).forEach(r => {
            if (r.name !== reagent.name || !r.fact?.date || !r.fact?.quantity) return;
            const factDate = new Date(r.fact.date);
            if (factDate >= startWindow && factDate <= now) {
              totalUsed += r.fact.quantity;
            }
          });
        });
      });

      const daysUsed = (now - startWindow) / (1000 * 60 * 60 * 24);
      const dailyRate = totalUsed / daysUsed || 0.01;

      const daysLeft = reagent.lastDelivery.quantity / dailyRate;
      const nextVisitDate = new Date(new Date(reagent.lastDelivery.date).getTime() + (daysLeft - reserveDays) * 24 * 60 * 60 * 1000);

      lab.tasks.push({
        taskType: "reagents",
        reagentName: reagent.name,
        neededQuantity: Math.round(dailyRate * reserveDays),
        date: nextVisitDate.toISOString().split("T")[0]
      });
    });
  });

  localStorage.setItem("labCards", JSON.stringify(labCards));
}

// ===== Планування наступного візиту =====
export function scheduleNextVisit(labId, reserveDays = 14, daysWindow = 60) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return null;

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  let earliestEndDate = null;

  lab.devices.forEach(device => {
    (device.reagents || []).forEach(reagent => {
      if (!reagent.lastDelivery?.quantity || !reagent.lastDelivery?.date) return;

      let totalUsed = 0;
      visits.forEach(v => {
        if (v.labId !== labId) return;
        (v.devices || []).forEach(d => {
          if (d.deviceName !== device.device) return;
          (d.reagents || []).forEach(r => {
            if (r.name !== reagent.name || !r.fact?.date || !r.fact?.quantity) return;
            const factDate = new Date(r.fact.date);
            if (factDate >= startWindow && factDate <= now) {
              totalUsed += r.fact.quantity;
            }
          });
        });
      });

      const daysUsed = (now - startWindow) / (1000 * 60 * 60 * 24);
      const dailyRate = totalUsed / daysUsed || 0.01;

      const daysLeft = reagent.lastDelivery.quantity / dailyRate;
      const endDate = new Date(new Date(reagent.lastDelivery.date).getTime() + daysLeft * 24 * 60 * 60 * 1000);

      if (!earliestEndDate || endDate < earliestEndDate) {
        earliestEndDate = endDate;
      }
    });
  });

  if (!earliestEndDate) return null;

  const nextVisitDate = new Date(earliestEndDate.getTime() - reserveDays * 24 * 60 * 60 * 1000);
  const dateKey = nextVisitDate.toISOString().split("T")[0];

  const newVisit = {
    id: `${labId}_${dateKey}`,
    labId,
    labName: lab.partner,
    date: dateKey,
    devices: lab.devices.map(device => ({
      deviceName: device.device,
      forecast: { quantity: 0 },
      agreement: { quantity: 0 },
      fact: { quantity: 0, date: "" },
      testsPerDay: device.testsPerDay || 0,
      reagents: [
        ...(device.reagents || []).map(r => ({
          name: r.name,
          forecast: { quantity: 0 },
          agreement: { quantity: 0 },
          fact: { quantity: 0, date: "" }
        })),
        { name: "Сервіс", forecast: { quantity: 0 }, agreement: { quantity: 0 }, fact: { quantity: 0, date: "" } }
      ]
    })),
    notes: "",
    status: "заплановано"
  };

  const existingKey = `${labId}_${dateKey}`;
  const filtered = visits.filter(v => `${v.labId}_${v.date}` !== existingKey);

  localStorage.setItem("visits", JSON.stringify([...filtered, newVisit]));
  return newVisit;
}

// ===== Завершення візиту =====
export function completeVisit(visitId, factUpdates) {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx === -1) return;

  visits[idx].devices.forEach(device => {
    device.reagents.forEach(r => {
      if (factUpdates[r.name]) {
        r.fact = {
          quantity: factUpdates[r.name].quantity,
          date: factUpdates[r.name].date
        };
      }
    });
  });

  visits[idx].status = "проведено";
  localStorage.setItem("visits", JSON.stringify(visits));

  syncFactToLabCard(visits[idx]);
  scheduleNextVisit(visits[idx].labId);

  if (typeof window.renderFullCalendar === "function") {
    window.renderFullCalendar();
  }
}

// ===== Відмінити =====
export function cancelVisit(visitId) {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx === -1) return;

  visits[idx].status = "відмінено";
  localStorage.setItem("visits", JSON.stringify(visits));

  if (typeof window.renderFullCalendar === "function") {
    window.renderFullCalendar();
  }
}

// ===== Перенести =====
export function rescheduleVisit(visitId, newDate) {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx === -1) return;

  visits[idx].date = newDate;
  visits[idx].status = "перенесено";
  localStorage.setItem("visits", JSON.stringify(visits));

  if (typeof window.renderFullCalendar === "function") {
    window.renderFullCalendar();
  }
}
