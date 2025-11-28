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
    default: return "#2196f3"; // заплановано
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

  // робимо функції доступними глобально
  window.hideVisitMenu = hideVisitMenu;
  window.onStartVisit = onStartVisit;
  window.onCancelVisit = onCancelVisit;
  window.onRescheduleVisit = onRescheduleVisit;
  window.onEditLabCard = onEditLabCard;
  window.rerenderCalendar = rerenderCalendar;
});

// ===== Утиліти дат =====
function formatDateYYYYMMDD(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ===== Генерація візитів з карток =====
function generateVisitsFromLabCards() {
  const labCards = JSON.parse(localStorage.getItem("labCards") || "[]");
  const visits = loadVisitsLS();
  const nextDelivery = getNextDeliveryDate();

  const newVisits = [];

  labCards.forEach(lab => {
    (lab.devices || []).forEach(device => {
      const reagents = device.reagents || [];

      // закупівля реагентів
      reagents.forEach(r => {
        const reagentTask = `Замов реагент — ${r.name} (${r.count} уп.)`;
        newVisits.push({
          id: `${lab.id || lab.partner}_${Date.now()}`,
          labId: lab.id || null,
          labName: lab.partner,
          date: nextDelivery,
          devices: [{
            deviceName: device.device || "",
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
        id: `${lab.id || lab.partner}_${Date.now()}`,
        labId: lab.id || null,
        labName: lab.partner,
        date: formatDateYYYYMMDD(firstServiceDate),
        devices: [{
          deviceName: device.device || "",
          reagents: [{ name: "Сервіс" }]
        }],
        status: "заплановано"
      });
    });
  });

  localStorage.setItem("visits", JSON.stringify([...visits, ...newVisits]));
  return newVisits;
}

// ===== Прості утиліти =====
function getNextDeliveryDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return formatDateYYYYMMDD(nextMonth);
}
