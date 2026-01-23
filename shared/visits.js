// ==========================
// Робота з бекендом
// ==========================
async function loadVisits() {
  const token = localStorage.getItem("token");
  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    headers: { "Authorization": "Bearer " + token }
  });
  return await res.json();
}

async function saveVisit(visit) {
  const token = localStorage.getItem("token");
  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(visit)
  });
  return await res.json();
}

function loadLabCards() {
  return JSON.parse(localStorage.getItem("labCards") || "[]");
}

// ==========================
// Генерація візитів з карток
// ==========================
async function generateVisitsFromLabCards() {
  const labCards = loadLabCards();
  const nextDelivery = getNextDeliveryDate();
  const newVisits = [];

  for (const lab of labCards) {
    for (const device of (lab.devices || [])) {
      for (const r of (device.reagents || [])) {
        const visit = {
          labId: lab.id,
          labName: lab.partner,
          date: nextDelivery,
          devices: [{ deviceName: device.device, reagents: [{ name: r.name }] }],
          status: "заплановано"
        };
        await saveVisit(visit);
        newVisits.push(visit);
      }

      const serviceIntervalDays = device.serviceIntervalDays || 90;
      const startDate = device.soldDate ? new Date(device.soldDate) : new Date();
      const firstServiceDate = new Date(startDate);
      firstServiceDate.setDate(firstServiceDate.getDate() + serviceIntervalDays);

      const visit = {
        labId: lab.id,
        labName: lab.partner,
        date: formatDateYYYYMMDD(firstServiceDate),
        devices: [{ deviceName: device.device, reagents: [{ name: "Сервіс" }] }],
        status: "заплановано"
      };
      await saveVisit(visit);
      newVisits.push(visit);
    }
  }

  return newVisits;
}

// ==========================
// Оновлення статусу
// ==========================
async function updateVisitStatus(visitId, action, body = {}) {
  const token = localStorage.getItem("token");
  await fetch(`https://nodejs-production-7176.up.railway.app/visits/${visitId}/${action}`, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function cancelVisit(visitId) {
  await updateVisitStatus(visitId, "cancel");
}

async function completeVisit(visitId, factUpdates) {
  await updateVisitStatus(visitId, "finish", { factUpdates });
}

async function rescheduleVisit(visitId, newDate) {
  await updateVisitStatus(visitId, "reschedule", { newDate });
}

// ==========================
// Модалка перенесення
// ==========================
function rescheduleVisitModal(visitId, currentDate) {
  const modalHtml = `
    <div id="rescheduleModal" class="modal">
      <div class="modal-content">
        <span class="close" onclick="closeRescheduleModal()">&times;</span>
        <h3>Перенесення візиту</h3>
        <label>Оберіть нову дату:
          <input type="date" id="newVisitDate" value="${currentDate}">
        </label>
        <div class="modal-actions" style="margin-top:12px;text-align:right;">
          <button onclick="confirmReschedule('${visitId}')">✅ Зберегти</button>
          <button onclick="closeRescheduleModal()">❌ Скасувати</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  document.getElementById("rescheduleModal").style.display = "block";
}

async function confirmReschedule(visitId) {
  const newDate = document.getElementById("newVisitDate").value;
  if (!newDate) return;
  await rescheduleVisit(visitId, newDate);
  closeRescheduleModal();
  hideVisitMenu();
  rerenderCalendar();
}

function closeRescheduleModal() {
  const modal = document.getElementById("rescheduleModal");
  if (modal) modal.remove();
}

// ==========================
// Створення вручну
// ==========================
async function createManualVisit({ labId, labName, date, devices = [] }) {
  const token = localStorage.getItem("token");
  const newVisit = {
    labId,
    labName,
    date,
    devices,
    notes: "",
    status: "заплановано"
  };

  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newVisit)
  });

  return await res.json();
}

// ==========================
// Фінансові розрахунки
// ==========================
function calculateFinancials({ devicePrice, reagentCosts, serviceCosts, replacementCosts }) {
  const totalCosts = reagentCosts + serviceCosts + replacementCosts;
  const profit = devicePrice - totalCosts;
  return { totalCosts, profit };
}

// ==========================
// Синхронізація факту у labCard
// ==========================
async function syncFactToLabCard(visit) {
  const token = localStorage.getItem("token");
  await fetch(`https://nodejs-production-7176.up.railway.app/labs/${visit.labId}/sync`, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ visit })
  });
}

// ==========================
// Прогноз наступного візиту
// ==========================
async function predictNextVisitDate(labId, daysWindow = 60, reserveDays = 30) {
  const token = localStorage.getItem("token");
  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    headers: { "Authorization": "Bearer " + token }
  });
  const visits = await res.json();

  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return [];

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);
  const predictions = [];

  lab.devices.forEach(device => {
    (device.reagents || []).forEach(reagent => {
      const lastDelivery = reagent.lastDelivery;
      if (!lastDelivery?.quantity || !lastDelivery?.date) return;

      let totalUsed = 0;
      visits.forEach(v => {
        if (v.labId !== labId) return;
        (v.devices || []).forEach(d => {
          if (d.deviceName !== device.device) return;
          (d.reagents || []).forEach(r => {
            if (r.name === reagent.name && r.fact?.date && r.fact?.quantity) {
              const factDate = new Date(r.fact.date);
              if (factDate >= startWindow && factDate <= now) totalUsed += r.fact.quantity;
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
        device: device.device,
        nextVisitDate: nextVisitDate.toISOString().split("T")[0],
        daysLeft: Math.round(daysLeft),
        dailyRate: dailyRate.toFixed(2)
      });
    });
  });

  return predictions;
}

// ==========================
// Автопланування задач
// ==========================
async function autoPlanNextTasks(labId, daysWindow = 60, reserveDays = 30) {
  const predictions = await predictNextVisitDate(labId, daysWindow, reserveDays);

  const token = localStorage.getItem("token");
  await fetch(`https://nodejs-production-7176.up.railway.app/labs/${labId}/tasks`, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ tasks: predictions })
  });
}

/// ==========================
// Планування наступного візиту
// ==========================
async function scheduleNextVisit(labId, reserveDays = 14, daysWindow = 60) {
  const token = localStorage.getItem("token");

  // підтягнути лабораторію з бекенду
  const labRes = await fetch(`https://nodejs-production-7176.up.railway.app/labs/${labId}`, {
    headers: { "Authorization": "Bearer " + token }
  });
  const lab = await labRes.json();

  // підтягнути всі візити
  const visitsRes = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    headers: { "Authorization": "Bearer " + token }
  });
  const visits = await visitsRes.json();

  if (!lab) return null;

  const now = new Date();
  const startWindow = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);
  let earliestEndDate = null;

  (lab.devices || []).forEach(device => {
    (device.reagents || []).forEach(reagent => {
      if (!reagent.lastDelivery?.quantity || !reagent.lastDelivery?.date) return;

      let totalUsed = 0;
      visits.forEach(v => {
        if (v.labId !== labId) return;
        (v.devices || []).forEach(d => {
          if (d.deviceName !== device.device) return;
          (d.reagents || []).forEach(r => {
            if (r.name === reagent.name && r.fact?.date && r.fact?.quantity) {
              const factDate = new Date(r.fact.date);
              if (factDate >= startWindow && factDate <= now) {
                totalUsed += r.fact.quantity;
              }
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
    labId,
    labName: lab.partner,
    date: dateKey,
    devices: (lab.devices || []).map(device => ({
      deviceName: device.device,
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

  // створити візит у бекенді
  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newVisit)
  });

  return await res.json();
}

// ==========================
// Обробка звітів
// ==========================
async function processVisitReport(visitReports) {
  const token = localStorage.getItem("token");

  // оновлення карток лабораторій за звітами
  await fetch("https://nodejs-production-7176.up.railway.app/labs/syncReports", {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reports: visitReports })
  });

  // згенерувати нові візити
  const generated = await generateVisitsFromLabCards();

  // підтягнути існуючі
  const visitsRes = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    headers: { "Authorization": "Bearer " + token }
  });
  const visits = await visitsRes.json();

  const existingKeys = new Set(visits.map(v => `${v.labId}_${v.date}`));
  const toAdd = [];

  generated.forEach(visit => {
    const key = `${visit.labId}_${visit.date}`;
    if (!existingKeys.has(key)) toAdd.push(visit);
  });

  for (const v of toAdd) {
    await fetch("https://nodejs-production-7176.up.railway.app/visits", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(v)
    });
  }
}

// ==========================
// Відображення у календарі
// ==========================
window.onload = async () => {
  const token = localStorage.getItem("token");
  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    headers: { "Authorization": "Bearer " + token }
  });
  const visits = await res.json();

  const container = document.getElementById("calendar");
  visits.forEach(v => {
    const div = document.createElement("div");
    div.className = "visit-entry";
    div.innerHTML = `📅 ${v.date} ⏰ ${v.time || ""} — Лабораторія ID: ${v.labId}`;
    container.appendChild(div);
  });
};
