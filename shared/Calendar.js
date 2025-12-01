let currentVisitId = null;
let calendar = null;

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

    function showVisitMenu(visit) {
      currentVisitId = visit.id;
      document.getElementById("visitMenuInfo").innerHTML = `
        <p><strong>${visit.labName}</strong></p>
        <p>Дата: ${visit.date}</p>
        <p>Статус: ${visit.status || "заплановано"}</p>
        ${
          visit.devices
            ? `<p>Завдання:</p><ul>${
                visit.devices.map(d => `<li>${d.deviceName}: ${(d.reagents||[]).map(r => r.name).join(", ")}</li>`).join("")
              }</ul>`
            : (visit.tasks
                ? `<p>Завдання:</p><ul>${visit.tasks.map(t => `<li>${t.action || t.title}</li>`).join("")}</ul>`
                : ""
              )
        }
      `;
      document.getElementById("visitMenu").classList.add("show");
    }
function hideVisitMenu() { document.getElementById("visitMenu").classList.remove("show"); }

function onStartVisit() {
  const visits = loadVisits();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;

  const labCards = loadLabCards();
  const lab = labCards.find(l => l.id === v.labId);

  // Шапка модалки
  let headerHtml = `
    <h3>Візит: ${lab.partner}</h3>
    <p>Дата: ${v.date}</p>
  `;

  let buttonsHtml = "<div class='tab-buttons'>";
  let contentsHtml = "";

  (lab.devices || []).forEach((device, idx) => {
    const reagentsFromVisit = (v.tasks || [])
      .filter(t => t.device === device.device && t.taskType === "reagents");

    buttonsHtml += `<button onclick="openTab(${idx})" id="tabBtn_${idx}">${device.device}</button>`;
    contentsHtml += `
      <div class="tab-content" id="tab_${idx}">
        <label>Кількість аналізів на день:
          <input type="number" id="testsPerDay_${idx}" value="${device.testCount || 0}">
        </label>

        <h4>Реагенти</h4>
        <table>
          <tr>
            <th>Завдання (прогноз)</th>
            <th>Домовленість (потреба)</th>
            <th>Факт кількість</th>
            <th>Факт дата</th>
          </tr>
          ${reagentsFromVisit.map((t, j) => {
            const info = device.reagentsInfo?.[t.reagentName] || {};
            return `
              <tr>
                <td>${t.reagentName} — ${t.date}</td>
                <td><input type="number" id="agreement_${idx}_${j}" value="${t.neededQuantity || 0}"></td>
                <td><input type="number" id="factQty_${idx}_${j}" value="${info.lastOrderCount || 0}"></td>
                <td><input type="date" id="factDate_${idx}_${j}" value="${info.lastOrderDate || ""}"></td>
              </tr>
            `;
          }).join("")}
        </table>

        <h4>Сервіс</h4>
        <table>
          <tr><th></th><th>Вид сервісу</th><th>Дата</th></tr>
          <tr>
            <td>План</td>
            <td><input type="text" id="servicePlanType_${idx}" value="${device.workType || ''}"></td>
            <td><input type="date" id="servicePlanDate_${idx}" value="${(v.tasks.find(t => t.device === device.device && t.taskType === 'service')?.date) || ''}"></td>
          </tr>
          <tr>
            <td>Домовленість</td>
            <td><input type="text" id="serviceAgreementType_${idx}" value=""></td>
            <td><input type="date" id="serviceAgreementDate_${idx}" value=""></td>
          </tr>
          <tr>
            <td>Факт</td>
            <td><input type="text" id="serviceFactType_${idx}" value="${device.workType || ''}"></td>
            <td><input type="date" id="serviceFactDate_${idx}" value="${device.lastService || ''}"></td>
          </tr>
        </table>
      </div>
    `;
  });

  document.getElementById("visitModalTabs").innerHTML = headerHtml + buttonsHtml + contentsHtml;
  document.getElementById("visitModal").style.display = "block";
  openTab(0);
}


function openTab(idx) {
  const tab = document.getElementById(`tab_${idx}`);
  const btn = document.getElementById(`tabBtn_${idx}`);
  if (!tab || !btn) return; // якщо вкладки немає — нічого не робимо

  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-buttons button").forEach(el => el.classList.remove("active"));
  tab.classList.add("active");
  btn.classList.add("active");
}

function submitVisitData() {
  const labCards = loadLabCards();
  const lab = labCards.find(l => l.id === currentLabId);
  if (!lab) return;

  (lab.devices || []).forEach((device, idx) => {
    device.testCount = parseInt(document.getElementById(`testsPerDay_${idx}`).value) || 0;

    const reagentsFromVisit = (currentVisit.tasks || [])
      .filter(t => t.device === device.device && t.taskType === "reagents");

    reagentsFromVisit.forEach((task, j) => {
      const agreementQty = parseInt(document.getElementById(`agreement_${idx}_${j}`).value) || 0;
      const factQty = parseInt(document.getElementById(`factQty_${idx}_${j}`).value) || 0;
      const factDate = document.getElementById(`factDate_${idx}_${j}`).value || "";

      device.reagentsInfo[task.reagentName] = {
        lastOrderCount: factQty,
        lastOrderDate: factDate
      };

      task.agreement = { quantity: agreementQty };
      task.fact = { quantity: factQty, date: factDate };
    });

    device.service = {
      plan: {
        type: document.getElementById(`servicePlanType_${idx}`).value || "",
        date: document.getElementById(`servicePlanDate_${idx}`).value || ""
      },
      agreement: {
        type: document.getElementById(`serviceAgreementType_${idx}`).value || "",
        date: document.getElementById(`serviceAgreementDate_${idx}`).value || ""
      },
      fact: {
        type: document.getElementById(`serviceFactType_${idx}`).value || "",
        date: document.getElementById(`serviceFactDate_${idx}`).value || ""
      }
    };
    device.lastService = device.service.fact.date;
  });

  currentVisit.status = "проведено";
  saveLabCards(labCards);

  // 🔄 перерахунок майбутніх візитів
  recalculateSchedule(lab.id);

  closeVisitModal();
  rerenderCalendar();
}

function recalculateSchedule(labId) {
  const labCards = loadLabCards();
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return;

  let visits = [];

  (lab.devices || []).forEach(device => {
    // реагенти: кожні 3 місяці
    Object.keys(device.reagentsInfo || {}).forEach(name => {
      const info = device.reagentsInfo[name];
      if (info.lastOrderDate) {
        const nextDate = addMonths(info.lastOrderDate, 3);
        visits.push({
          labId: lab.id,
          labName: lab.partner,
          date: nextDate,
          tasks: [{ device: device.device, action: `Замов реагент — ${name}`, taskType: "reagents" }],
          status: "заплановано"
        });
      }
    });

    // сервіс: кожні 6 місяців
    if (device.lastService) {
      const nextServiceDate = addMonths(device.lastService, 6);
      visits.push({
        labId: lab.id,
        labName: lab.partner,
        date: nextServiceDate,
        tasks: [{ device: device.device, action: "Сервіс", taskType: "service" }],
        status: "заплановано"
      });
    }
  });

  saveVisits(visits);
}



function closeVisitModal() { document.getElementById("visitModal").style.display = "none"; }
function confirmStartVisit() {
  updateVisitStatus(currentVisitId, "в процесі");
  closeVisitModal();
  hideVisitMenu();
  rerenderCalendar();
}
function onCancelVisit() { cancelVisit(currentVisitId); hideVisitMenu(); rerenderCalendar(); }
function onRescheduleVisit() {
  const newDate = prompt("Нова дата (YYYY-MM-DD):");
  if (!newDate) return;
  rescheduleVisit(currentVisitId, newDate);
  hideVisitMenu(); rerenderCalendar();
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
  // Експортуємо в window, якщо треба викликати ззовні
      window.hideVisitMenu = hideVisitMenu;
      window.onStartVisit = onStartVisit;
      window.onCancelVisit = onCancelVisit;
      window.onRescheduleVisit = onRescheduleVisit;
      window.onEditLabCard = onEditLabCard;
      window.rerenderCalendar = rerenderCalendar;
});
