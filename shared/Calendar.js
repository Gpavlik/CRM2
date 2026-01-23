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
      id: v._id,
      title: `${v.labId?.institution || v.labName} — ${v.status || "заплановано"}`,
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
  currentVisitId = visit._id;
  document.getElementById("visitMenuInfo").innerHTML = `
    <p><strong>${visit.labId?.institution || visit.labName}</strong></p>
    <p>Дата: ${new Date(visit.date).toLocaleString()}</p>
    <p>Статус: ${visit.status || "заплановано"}</p>
    ${visit.tasks ? `<p>Завдання:</p><ul>${visit.tasks.map(t => `<li>${t.action || t.title}</li>`).join("")}</ul>` : ""}
  `;
  document.querySelector("#visitMenu .btn-start").onclick = () => onStartVisit();
  document.querySelector("#visitMenu .btn-finish").onclick = () => onFinishVisit();
  document.querySelector("#visitMenu .btn-cancel").onclick = () => onCancelVisit();
  document.querySelector("#visitMenu .btn-reschedule").onclick = () => onRescheduleVisit();
  document.querySelector("#visitMenu .btn-edit").onclick = () => onEditLabCard();

  document.getElementById("visitMenu").classList.add("show");
}

function hideVisitMenu() {
  document.getElementById("visitMenu").classList.remove("show");
}

// ==========================
// Виклики до бекенду
// ==========================
async function patchVisit(action, body = {}) {
  const token = localStorage.getItem("token");
  await fetch(`https://nodejs-production-7176.up.railway.app/visits/${currentVisitId}/${action}`, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  await rerenderCalendar();
}

// ==========================
// Дії з візитом
// ==========================
function onStartVisit() {
  patchVisit("start");
  hideVisitMenu();
}

function onCancelVisit() {
  patchVisit("cancel");
  hideVisitMenu();
}

function onRescheduleVisit() {
  const newDate = prompt("Введіть нову дату (YYYY-MM-DD HH:mm):");
  if (!newDate) return;
  patchVisit("reschedule", { newDate });
  hideVisitMenu();
}

function onFinishVisit() {
  patchVisit("finish");
  hideVisitMenu();
}

function onEditLabCard() {
  localStorage.setItem("editLabCard", JSON.stringify({ labId: currentVisitId }));
  window.location.href = "../labcards/labcard.html";
}

// ==========================
// Перерендер календаря
// ==========================
async function rerenderCalendar() {
  if (!calendar) return;
  const token = localStorage.getItem("token");
  const res = await fetch("https://nodejs-production-7176.up.railway.app/visits", {
    headers: { "Authorization": "Bearer " + token }
  });
  const visits = await res.json();

  const events = eventsFromVisits(visits);
  calendar.removeAllEvents();
  events.forEach(e => calendar.addEvent(e));
}

// ==========================
// Ініціалізація календаря
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
    },
    events: eventsFromVisits(await (await fetch("https://nodejs-production-7176.up.railway.app/visits", {
      headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })).json()),
    eventClick: info => showVisitMenu(info.event.extendedProps.visit)
  });
  calendar.render();

  // Експортуємо у window
  window.hideVisitMenu = hideVisitMenu;
  window.onStartVisit = onStartVisit;
  window.onCancelVisit = onCancelVisit;
  window.onRescheduleVisit = onRescheduleVisit;
  window.onEditLabCard = onEditLabCard;
  window.onFinishVisit = onFinishVisit;
  window.rerenderCalendar = rerenderCalendar;
});
