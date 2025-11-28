// ===== Робота зі сховищем =====
function loadVisits() {
  let visits = JSON.parse(localStorage.getItem("visits") || "[]");
  return visits;
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
      // реагенти
      (device.reagents || []).forEach(r => {
        newVisits.push({
          id: `${lab.id}_${Date.now()}`,
          labId: lab.id,
          labName: lab.partner,
          date: nextDelivery,
          devices: [{
            deviceName: device.device,
            reagents: [{ name: r.name }]
          }],
          status: "заплановано"
        });
      });

      // сервіс
      const serviceIntervalDays = device.serviceIntervalDays || 90;
      const startDate = device.soldDate ? new Date(device.soldDate) : new Date();
      const firstServiceDate = new Date(startDate);
      firstServiceDate.setDate(firstServiceDate.getDate() + serviceIntervalDays);

      newVisits.push({
        id: `${lab.id}_${Date.now()}`,
        labId: lab.id,
        labName: lab.partner,
        date: formatDateYYYYMMDD(firstServiceDate),
        devices: [{
          deviceName: device.device,
          reagents: [{ name: "Сервіс" }]
        }],
        status: "заплановано"
      });
    });
  });

  saveVisits([...visits, ...newVisits]);
  return newVisits;
}

// ===== Оновлення статусу =====
function updateVisitStatus(visitId, status) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (v) {
    v.status = status;
    saveVisits(visits);
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
        r.fact = {
          quantity: factUpdates[r.name].quantity,
          date: factUpdates[r.name].date
        };
      }
    });
  });

  v.status = "проведено";
  saveVisits(visits);
}

// ===== Відмінити =====
function cancelVisit(visitId) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (v) {
    v.status = "відмінено";
    saveVisits(visits);
  }
}

// ===== Перенести =====
function rescheduleVisit(visitId, newDate) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (v) {
    v.date = newDate;
    v.status = "перенесено";
    saveVisits(visits);
  }
}

// ===== Утиліти дат =====
function formatDateYYYYMMDD(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getNextDeliveryDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return formatDateYYYYMMDD(nextMonth);
}
