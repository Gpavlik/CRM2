let currentVisitId = null;
let calendar = null;

// ==========================
// Кольори статусів
// ==========================
function statusColor(status) {
  switch ((status || "").toLowerCase()) {
    case "в процесі": return "#ff9800";
    case "відмінено": return "#9e9e9e";
    case "перенесено": return "#2196f3";
    case "проведено": return "#4caf50";
    default: return "#2196f3";
  }
}

// ==========================
// Фільтри
// ==========================
function filterByStatus(status) {
  const s = (status || "заплановано").toLowerCase();
  if (s === "заплановано") return document.getElementById("filterPlanned").checked;
  if (s === "в процесі") return document.getElementById("filterInProgress").checked;
  if (s === "відмінено") return document.getElementById("filterCancelled").checked;
  if (s === "перенесено") return document.getElementById("filterRescheduled").checked;
  if (s === "проведено") return document.getElementById("filterDone").checked;
  return true;
}

// ==========================
// Події для календаря
// ==========================
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

// ==========================
// Меню візиту
// ==========================
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
  document.querySelector("#visitMenu .btn-edit").onclick = () => onEditLabCard();

  document.getElementById("visitMenu").classList.add("show");
}

function hideVisitMenu() {
  document.getElementById("visitMenu").classList.remove("show");
}

// ==========================
// Модалка візиту
// ==========================
function closeVisitModal() {
  document.getElementById("visitModal").style.display = "none";
}

// ==========================
// Дії з візитом (через visits.js)
// ==========================
function onStartVisit() {
  updateVisitStatusLS(currentVisitId, "в процесі");
  closeVisitModal();
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

function onEditLabCard() {
  const visits = loadVisits();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;
  localStorage.setItem("editLabCard", JSON.stringify({ labId: v.labId }));
  window.location.href = "../labcards/labcard.html";
}

// ==========================
// Перерендер календаря
// ==========================
function rerenderCalendar() {
  const events = eventsFromVisits(loadVisits());
  calendar.removeAllEvents();
  events.forEach(e => calendar.addEvent(e));
}

// ==========================
// Ініціалізація календаря
// ==========================
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
  window.onEditLabCard = onEditLabCard;
  window.rerenderCalendar = rerenderCalendar;
});
