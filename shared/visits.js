// ===== Робота зі сховищем =====

    function loadVisits() {
      try {
        const visits = JSON.parse(localStorage.getItem("visits") || "[]");
        return Array.isArray(visits) ? visits : [];
      } catch {
        return [];
      }
    }
function saveVisits(visits) {
  localStorage.setItem("visits", JSON.stringify(visits));
}
function loadLabCards() {
  return JSON.parse(localStorage.getItem("labCards") || "[]");
}

// ===== Генерація візитів з карток =====
function generateVisitsFromLabCards() {
  const labCards = loadLabCards();
  const visits = loadVisits();
  const nextDelivery = getNextDeliveryDate();
  const newVisits = [];

  labCards.forEach(lab => {
    (lab.devices || []).forEach(device => {
      (device.reagents || []).forEach(r => {
        newVisits.push({
          id: `${lab.id}_${Date.now()}`,
          labId: lab.id,
          labName: lab.partner,
          date: nextDelivery,
          devices: [{ deviceName: device.device, reagents: [{ name: r.name }] }],
          status: "заплановано"
        });
      });

      const serviceIntervalDays = device.serviceIntervalDays || 90;
      const startDate = device.soldDate ? new Date(device.soldDate) : new Date();
      const firstServiceDate = new Date(startDate);
      firstServiceDate.setDate(firstServiceDate.getDate() + serviceIntervalDays);

      newVisits.push({
        id: `${lab.id}_${Date.now()}`,
        labId: lab.id,
        labName: lab.partner,
        date: formatDateYYYYMMDD(firstServiceDate),
        devices: [{ deviceName: device.device, reagents: [{ name: "Сервіс" }] }],
        status: "заплановано"
      });
    });
  });

  saveVisits([...visits, ...newVisits]);
  return newVisits;
}

// ===== Оновлення статусу =====

    function updateVisitStatusLS(visitId, status) {
      const visits = loadVisits();
      const v = visits.find(x => x.id === visitId);
      if (v) {
        v.status = status;
        localStorage.setItem("visits", JSON.stringify(visits));
      }
    }
// ===== Завершення =====
function completeVisit(visitId, factUpdates) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;

  v.devices.forEach(device => {
    device.reagents.forEach(r => {
      if (factUpdates[r.name]) {
        r.fact = { quantity: factUpdates[r.name].quantity, date: factUpdates[r.name].date };
      }
    });
  });

  v.status = "проведено";
  saveVisits(visits);
  syncFactToLabCard(v);
  scheduleNextVisit(v.labId);
}

// ===== Відмінити =====
function cancelVisit(visitId) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (v) { v.status = "відмінено"; saveVisits(visits); }
}

// ===== Перенести =====
    function rescheduleVisitLS(visitId, newDate) {
      const visits = loadVisits();
      const v = visits.find(x => x.id === visitId);
      if (v) {
        v.date = newDate;
        v.status = "перенесено";
        localStorage.setItem("visits", JSON.stringify(visits));
      }
    }

// ===== Створення вручну =====
function createManualVisit({ labId, labName, date, devices = [] }) {
  const visits = loadVisits();
  const filtered = visits.filter(v => !((v.labId || v.labName) === (labId || labName) && v.date === date));
  const newVisit = {
    id: `${labId || labName}_${Date.now()}`,
    labId: labId || null,
    labName,
    date,
    devices,
    notes: "",
    status: "заплановано"
  };
  saveVisits([...filtered, newVisit]);
  return newVisit;
}

// ===== Фінансові розрахунки =====
function calculateFinancials({ devicePrice, reagentCosts, serviceCosts, replacementCosts }) {
  const totalCosts = reagentCosts + serviceCosts + replacementCosts;
  const profit = devicePrice - totalCosts;
  return { totalCosts, profit };
}

// ===== Синхронізація факту у labCard =====
function syncFactToLabCard(visit) {
  const labCards = loadLabCards();
  const lab = labCards.find(l => l.id === visit.labId);
  if (!lab) return;
  visit.devices.forEach(device => {
    const labDevice = lab.devices.find(d => d.device === device.deviceName);
    if (!labDevice) return;
    device.reagents.forEach(r => {
      const labReagent = labDevice.reagents.find(lr => lr.name === r.name);
      if (labReagent && r.fact?.quantity && r.fact?.date) {
        labReagent.lastDelivery = { quantity: r.fact.quantity, date: r.fact.date };
      }
    });
  });
  localStorage.setItem("labCards", JSON.stringify(labCards));
}

// ===== Прогноз наступного візиту =====
function predictNextVisitDate(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = loadLabCards();
  const visits = loadVisits();
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

// ===== Автопланування задач =====
function autoPlanNextTasks(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = loadLabCards();
  const visits = loadVisits();
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
function scheduleNextVisit(labId, reserveDays = 14, daysWindow = 60) {
  const labCards = loadLabCards();
  const visits = loadVisits();
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
      const endDate = new Date(new Date(reagent.lastDelivery.date).getTime() + daysLeft * 24 * 60 * 60 * 1000);
      if (!earliestEndDate || endDate < earliestEndDate) earliestEndDate = endDate;
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
  saveVisits([...filtered, newVisit]);
  return newVisit;
}

// ===== Обробка звітів =====
function processVisitReport(visitReports) {
  const allLabs = loadLabCards();
  // тут можна додати оновлення карток за звітами
  localStorage.setItem("labCards", JSON.stringify(allLabs));

  const generated = generateVisitsFromLabCards();
  const visits = loadVisits();
  const existingKeys = new Set(visits.map(v => `${v.labId}_${v.date}`));
  const toAdd = [];

  generated.forEach(visit => {
    const key = `${visit.labId}_${visit.date}`;
    if (!existingKeys.has(key)) toAdd.push(visit);
  });

  saveVisits([...visits, ...toAdd]);
}

// ===== Синхронізація факту у labCard =====
function syncFactToLabCard(visit) {
  const labCards = loadLabCards();
  const lab = labCards.find(l => l.id === visit.labId);
  if (!lab) return;

  visit.devices.forEach(device => {
    const labDevice = lab.devices.find(d => d.device === device.deviceName);
    if (!labDevice) return;
    device.reagents.forEach(r => {
      const labReagent = labDevice.reagents.find(lr => lr.name === r.name);
      if (labReagent && r.fact?.quantity && r.fact?.date) {
        labReagent.lastDelivery = { quantity: r.fact.quantity, date: r.fact.date };
      }
    });
  });

  localStorage.setItem("labCards", JSON.stringify(labCards));
}

// ===== Прогноз наступного візиту =====
function predictNextVisitDate(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = loadLabCards();
  const visits = loadVisits();
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

// ===== Автопланування задач =====
function autoPlanNextTasks(labId, daysWindow = 60, reserveDays = 30) {
  const labCards = loadLabCards();
  const visits = loadVisits();
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
function scheduleNextVisit(labId, reserveDays = 14, daysWindow = 60) {
  {
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

}
// Меню дій
    function onStartVisit() { updateVisitStatusLS(currentVisitId, "в процесі"); hideVisitMenu(); rerenderCalendar(); }
    function onCancelVisit() { updateVisitStatusLS(currentVisitId, "відмінено"); hideVisitMenu(); rerenderCalendar(); }
    function onRescheduleVisit() {
      const newDate = prompt("Нова дата (YYYY-MM-DD):");
      if (!newDate) return;
      rescheduleVisitLS(currentVisitId, newDate);
      hideVisitMenu();
      rerenderCalendar();
    }
    function onEditLabCard() {
      const visits = loadVisits();
      const v = visits.find(x => x.id === currentVisitId);
      if (!v) return;
      localStorage.setItem("editLabCard", JSON.stringify({ labId: v.labId }));
      window.location.href = "../labcards/labcard.html";
    }

    function rerenderCalendar() {
      const events = eventsFromVisits(loadVisits());
      calendar.removeAllEvents();
      events.forEach(e => calendar.addEvent(e));
    }
// ===== Фінансові розрахунки =====
function calculateFinancials({ devicePrice, reagentCosts, serviceCosts, replacementCosts }) {
  const totalCosts = reagentCosts + serviceCosts + replacementCosts;
  const profit = devicePrice - totalCosts;
  return { totalCosts, profit };
}
