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
function syncFactToLabCard(visit) {
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
function predictNextVisitDate(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return [];

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const predictions = [];

  lab.devices.forEach(device => {
    device.reagents.forEach(reagent => {
      const name = reagent.name;
      const lastDelivery = reagent.lastDelivery;
      if (!lastDelivery?.quantity || !lastDelivery?.date) return;

      // Знаходимо фактичні витрати за останні N днів
      let totalUsed = 0;
      visits.forEach(v => {
        if (v.labId !== labId) return;
        (v.devices || []).forEach(d => {
          if (d.name !== device.name) return;
          (d.reagents || []).forEach(r => {
            if (r.name !== name || !r.fact?.date || !r.fact?.quantity) return;
            const factDate = new Date(r.fact.date);
            if (factDate >= startWindow && factDate <= now) {
              totalUsed += r.fact.quantity;
            }
          });
        });
      });

      const daysUsed = (now - startWindow) / (1000 * 60 * 60 * 24);
      const dailyRate = totalUsed / daysUsed || 0.01; // мінімальний захист від ділення на 0

      const daysLeft = reagent.lastDelivery.quantity / dailyRate;
      const nextVisitDate = new Date(new Date(reagent.lastDelivery.date).getTime() + (daysLeft - reserveDays) * 24 * 60 * 60 * 1000);

      predictions.push({
        reagent: name,
        device: device.name,
        nextVisitDate: nextVisitDate.toISOString().split("T")[0],
        daysLeft: Math.round(daysLeft),
        dailyRate: dailyRate.toFixed(2)
      });
    });
  });

  return predictions;
}

function autoPlanNextTasks(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return;

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  (lab.devices || []).forEach(device => {
    (device.reagents || []).forEach(reagent => {
      if (!reagent.lastDelivery?.quantity || !reagent.lastDelivery?.date) return;

      // середнє споживання
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

      // додаємо новий task у labCard
      lab.tasks.push({
        taskType: "reagents",
        reagentName: reagent.name,
        neededQuantity: Math.round(dailyRate * reserveDays), // запас на резервний період
        date: nextVisitDate.toISOString().split("T")[0]
      });
    });
  });

  localStorage.setItem("labCards", JSON.stringify(labCards));
}
export { syncFactToLabCard, predictNextVisitDate }; 
export { autoPlanNextTasks };

function scheduleNextVisit(labId, reserveDays = 14, daysWindow = 60) {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return null;

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  let earliestEndDate = null;

  // шукаємо найшвидше закінчення реагента
  lab.devices.forEach(device => {
    (device.reagents || []).forEach(reagent => {
      if (!reagent.lastDelivery?.quantity || !reagent.lastDelivery?.date) return;

      // середнє споживання
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

  // дата наступного візиту = 14 днів до найшвидшого закінчення
  const nextVisitDate = new Date(earliestEndDate.getTime() - reserveDays * 24 * 60 * 60 * 1000);
  const dateKey = nextVisitDate.toISOString().split("T")[0];

  // формуємо новий візит
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

  // апсерт по labId+date
  const existingKey = `${labId}_${dateKey}`;
  const filtered = visits.filter(v => `${v.labId}_${v.date}` !== existingKey);

  localStorage.setItem("visits", JSON.stringify([...filtered, newVisit]));
  return newVisit;
}
export { scheduleNextVisit };
function completeVisit(visitId, factUpdates) {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx === -1) return;

  // оновлюємо факт у візиті
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

  // статус "проведено"
  visits[idx].status = "проведено";
  localStorage.setItem("visits", JSON.stringify(visits));

  // синхронізація факту у labCard
  syncFactToLabCard(visits[idx]);

  // створення наступного візиту
  scheduleNextVisit(visits[idx].labId);

  // оновлення календаря
  if (typeof window.renderFullCalendar === "function") {
    window.renderFullCalendar();
  }
}
export { completeVisit };
// ===== Розпочати =====
function completeVisit(visitId, factUpdates) {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  const idx = visits.findIndex(v => v.id === visitId);
  if (idx === -1) return;

  // оновлюємо факт у візиті
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

  // статус "проведено"
  visits[idx].status = "проведено";
  localStorage.setItem("visits", JSON.stringify(visits));

  // синхронізація факту у labCard
  syncFactToLabCard(visits[idx]);

  // створення наступного візиту
  scheduleNextVisit(visits[idx].labId);

  // оновлення календаря
  if (typeof window.renderFullCalendar === "function") {
    window.renderFullCalendar();
  }
}

// ===== Відмінити =====
function cancelVisit(visitId) {
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
function rescheduleVisit(visitId, newDate) {
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
export { completeVisit, cancelVisit, rescheduleVisit };