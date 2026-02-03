

// === Кешування ===
let visitsCache = JSON.parse(localStorage.getItem("visits") || "[]");
let labCardsCache = JSON.parse(localStorage.getItem("labCards") || "[]");


function loadVisits() {
  return visitsCache;
}

function saveVisits(visits) {
  visitsCache = visits;
  localStorage.setItem("visits", JSON.stringify(visits));
}

function loadLabCards() {
  return labCardsCache;
}

function saveLabCards(labs) {
  labCardsCache = labs;
  localStorage.setItem("labCards", JSON.stringify(labs));
}

// === Глобальні змінні ===
let currentVisitId = null;
let calendar = null;

// === Допоміжні функції ===
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
  const elMap = {
    "заплановано": "filterPlanned",
    "в процесі": "filterInProgress",
    "відмінено": "filterCancelled",
    "перенесено": "filterRescheduled",
    "проведено": "filterDone"
  };
  const id = elMap[(status || "заплановано").toLowerCase()];
  const el = id ? document.getElementById(id) : null;
  return el ? el.checked : true; // якщо чекбокса немає — не фільтруємо
}


function eventsFromVisits(visits) {
  return visits
    .filter(v => filterByStatus(v.status))
    .map(v => ({
      id: v.id,
      title: `${v.labName} — ${v.status || "заплановано"}`,
      start: v.date,
      backgroundColor: statusColor(v.status),
      borderColor: statusColor(v.status),
      extendedProps: { visit: v }
    }));
}

// === Оновлення статусів ===
function updateVisitStatus(visitId, status) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  v.status = status;
  saveVisits(visits);
}

function cancelVisit(visitId) {
  updateVisitStatus(visitId, "відмінено");
}

// === Календар ===
function rerenderCalendar() {
  const events = eventsFromVisits(loadVisits());
  calendar.removeAllEvents();
  events.forEach(e => calendar.addEvent(e));
}

document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
    },
    events: eventsFromVisits(loadVisits()),
    eventClick: info => showVisitMenu(info.event.extendedProps.visit)
  });
  calendar.render();

  // Експортуємо у window
  window.hideVisitMenu = hideVisitMenu;
  window.onStartVisit = onStartVisit;
  window.onCancelVisit = onCancelVisit;
  window.onRescheduleVisit = onRescheduleVisit;
  window.rerenderCalendar = rerenderCalendar;
});

// === Меню візиту ===
function showVisitMenu(visit) {
  currentVisitId = visit.id;

  document.getElementById("visitMenuInfo").innerHTML = `
    <p><strong>${visit.labName}</strong></p>
    <p>Дата: ${visit.date}</p>
    <p>Статус: ${visit.status || "заплановано"}</p>
    ${visit.tasks ? `<p>Завдання:</p><ul>${visit.tasks.map(t => `<li>${t.action || t.title}</li>`).join("")}</ul>` : ""}
  `;

  document.querySelector("#visitMenu .btn-start").onclick = () => onStartVisit();
  document.querySelector("#visitMenu .btn-cancel").onclick = () => onCancelVisit();
  document.querySelector("#visitMenu .btn-reschedule").onclick = () => onRescheduleVisit();
  document.querySelector("#visitMenu .btn-edit").onclick = () => editLabCard(visit.labId);

  document.getElementById("visitMenu").classList.add("show");
}

function hideVisitMenu() {
  document.getElementById("visitMenu").classList.remove("show");
}

// === Дії з візитами ===
function onStartVisit() {
  updateVisitStatus(currentVisitId, "в процесі");
  hideVisitMenu();
  rerenderCalendar();
}

function onCancelVisit() {
  cancelVisit(currentVisitId);
  hideVisitMenu();
  rerenderCalendar();
}

function onRescheduleVisit() {
  rescheduleVisit(currentVisitId);
}

function rescheduleVisit(visitId) {
  // Remove existing modal if any
  const existing = document.getElementById("rescheduleModal");
  if (existing) existing.remove();

  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;

  const modalHtml = `
    <div id="rescheduleModal" class="modal">
      <div class="modal-content">
        <span class="close" onclick="closeRescheduleModal()">&times;</span>
        <h3>Перенесення візиту</h3>
        <label>Оберіть нову дату:
          <input type="date" id="newVisitDate" value="${v.date}">
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

function confirmReschedule(visitId) {
  const visits = loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;

  const newDate = document.getElementById("newVisitDate").value;
  if (!newDate) return;

  v.date = newDate;
  v.status = "перенесено"; // позначаємо як перенесений
  saveVisits(visits);

  closeRescheduleModal();
  hideVisitMenu();
  rerenderCalendar();

  alert(`✅ Візит перенесено на ${newDate}`);
}

function closeRescheduleModal() {
  const modal = document.getElementById("rescheduleModal");
  if (modal) modal.remove();
}

window.rerenderCalendar = rerenderCalendar;
function loadVisitsFromCache() {
  return JSON.parse(localStorage.getItem("visits") || "[]");
}
document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    events: loadVisitsFromCache().map(v => ({
      id: v.id,
      title: `${v.labName} (${v.city})`,
      start: v.date,
      extendedProps: {
        tasks: v.tasks,
        status: v.status,
        distanceKm: v.distanceKm,
        travelHours: v.travelHours
      }
    })),
    eventClick: function(info) {
      const visit = info.event.extendedProps;
      alert(
        `📋 Лабораторія: ${info.event.title}\n` +
        `📅 Дата: ${info.event.start.toLocaleDateString()}\n` +
        `🛠️ Завдання: ${visit.tasks?.length || 0}\n` +
        `📍 Відстань: ${visit.distanceKm} км\n` +
        `⏱️ Час у дорозі: ${visit.travelHours} год\n` +
        `Статус: ${visit.status}`
      );
    }
  });

  calendar.render();
  window.rerenderCalendar = () => {
    calendar.removeAllEvents();
    calendar.addEventSource(loadVisitsFromCache().map(v => ({
      id: v.id,
      title: `${v.labName} (${v.city})`,
      start: v.date,
      extendedProps: v
    })));
  };
});
window.rerenderCalendar = () => {
  calendar.removeAllEvents();
  calendar.addEventSource(loadVisitsFromCache().map(v => ({
    id: v.id,
    title: `${v.labName} (${v.city})`,
    start: v.date,
    extendedProps: v
  })));
};
function formatDateYYYYMMDD(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}