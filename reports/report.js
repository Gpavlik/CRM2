// ===== Завантаження реагентів з калькуляторів =====
async function loadReagentsFromCalculators() {
  const files = [
    "../calculators/dh36.json",
    "../calculators/df50.json",
    "../calculators/un73.json",
    "../calculators/ls1100.json",
    "../calculators/citolab300.json"
    // додай сюди інші калькулятори
  ];

  const allReagents = {};

  for (const file of files) {
    try {
      const res = await fetch(file);
      const data = await res.json();

      if (Array.isArray(data.reagents)) {
        data.reagents.forEach(r => {
          allReagents[r.name] = {
            price: r.price || 0,
            packageSize: r.packageSize || 0,
            perTest: r.perTest || 0
          };
        });
      }
    } catch (err) {
      console.warn("⚠️ Не вдалося завантажити файл:", file, err);
    }
  }

  window.allReagents = allReagents;
  return allReagents;
}

// ===== Заповнення випадаючого списку =====
document.addEventListener("DOMContentLoaded", populateReagentSelect);
async function populateReagentSelect() {
  const allReagents = await loadReagentsFromCalculators();
  const select = document.getElementById("reagentSelect");

  Object.keys(allReagents).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

const reagentMap = {
  "DIL-E": "DIL-E",
  "LYE-1": "LYE-1",
  "CLE-P": "CLE-P",
  "CBC-3D": "CBC-3D",
  "DIL-C": "DIL-C",
  "LYC-1": "LYC-1",
  "LYC-2": "LYC-2",
  "CBC-DH": "CBC-DH"
};

// ===== Генерація звіту залежно від режиму =====
function generateReport() {
  const mode = document.getElementById("reportMode").value;   // simple / detailed
  const type = document.getElementById("reportType").value;   // forecast / needs / facts

  if (type === "forecast") {
    if (mode === "simple") {
      showReagentReportPeriod();       // прогноз, простий
    } else {
      showReagentReportDetailed();     // прогноз, детальний
    }
  } else if (type === "needs") {
    if (mode === "simple") {
      showNeedsReportPeriod();         // потреба, простий
    } else {
      showNeedsReportDetailed();       // потреба, детальний
    }
  } else if (type === "facts") {
    if (mode === "simple") {
      showFactsReportPeriod();         // факт, простий
    } else {
      showFactsReportDetailed();       // факт, детальний
    }
  }
}


// Функція форматування
function formatNumber(num) {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

// ===== Звичайний звіт =====
function showReagentReportPeriod() {
  const labs = JSON.parse(localStorage.getItem("labCards")) || [];
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const reagentFilter = document.getElementById("reagentSelect").value;

  const allReagents = window.allReagents || {};
  const summary = {};

  labs.forEach(lab => {
    (lab.tasks || []).forEach(task => {
      if (task.taskType === "reagents") {
        const taskDate = new Date(task.date);
        if (taskDate < startDate || taskDate > endDate) return;

        const name = task.reagentName;
        if (reagentFilter && name !== reagentFilter) return;

        if (!summary[name]) summary[name] = 0;
        summary[name] += task.neededQuantity || 0;
      }
    });
  });

  const container = document.getElementById("reagentReport");
  if (Object.keys(summary).length === 0) {
    container.innerHTML = "<p>⚠️ Немає даних по реагентах у вибраному періоді.</p>";
    return;
  }

  // Підрахунок загальної суми
  let grandTotal = 0;

  container.innerHTML = `
    <h3>📦 Звичайний звіт по реагентах</h3>
    <table id="reagentTable" border="1" cellpadding="6" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th>Реагент</th>
          <th>Кількість</th>
          <th>Ціна за од.</th>
          <th>Сума (грн)</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(summary).map(([name, total]) => {
          const info = allReagents[name] || {};
          const price = info.price || 0;
          const cost = total * price;
          grandTotal += cost;
          return `
            <tr>
              <td>${name}</td>
              <td>${total}</td>
              <td>${formatNumber(price)}</td>
              <td>${formatNumber(cost)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
      <tfoot>
        <tr style="font-weight:bold; background:#f0f0f0;">
          <td colspan="3">Загальна сума:</td>
          <td>${grandTotal.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <button onclick="exportTableToCSV('reagentTable','reagents_simple_report.csv')">⬇️ Експорт у CSV</button>
    <button onclick="exportTableToExcel('reagentTable','reagents_simple_report.xlsx')">📊 Експорт у Excel</button>
  `;
}

// ===== Детальний звіт =====
function showReagentReportDetailed() {
  const labs = JSON.parse(localStorage.getItem("labCards")) || [];
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const reagentFilter = document.getElementById("reagentSelect").value;

  const allReagents = window.allReagents || {};
  const summary = {};

  labs.forEach(lab => {
    (lab.tasks || []).forEach(task => {
      if (task.taskType === "reagents") {
        const taskDate = new Date(task.date);
        if (taskDate < startDate || taskDate > endDate) return;

        const name = task.reagentName;
        if (reagentFilter && name !== reagentFilter) return;

        const labContractor = lab.contractor || "—";
        const institution = lab.institution || "—";
        const edrpou = lab.edrpou || "—";

        (lab.devices || []).forEach(deviceObj => {
          const kp = deviceObj.kp || "—";
          const deviceName = task.device || deviceObj.device || "—";

          const key = `${name}|${lab.region}|${lab.city}|${lab.manager}|${deviceName}|${labContractor}|${kp}|${institution}|${edrpou}`;
          if (!summary[key]) summary[key] = 0;
          summary[key] += task.neededQuantity || 0;
        });
      }
    });
  });

  const container = document.getElementById("reagentReport");
  if (Object.keys(summary).length === 0) {
    container.innerHTML = "<p>⚠️ Немає даних по реагентах у вибраному періоді.</p>";
    return;
  }

container.innerHTML = `
  <h3>📦 Детальний звіт по реагентах</h3>
  <div style="margin-bottom:10px;">
    <button onclick="exportTableToCSV('reagentTable','reagents_detailed_report.csv')">⬇️ Експорт у CSV</button>
    <button onclick="exportTableToExcel('reagentTable','reagents_detailed_report.xlsx')">📊 Експорт у Excel</button>
    <button onclick="clearAllFilters('reagentTable')">🧹 Очистити всі фільтри</button>
  </div>
  <table id="reagentTable" border="1" cellpadding="6" style="border-collapse:collapse;">
    <thead>
      <tr>
        <th onclick="sortTable(0)">Реагент</th>
        <th onclick="sortTable(1)">Кількість</th>
        <th onclick="sortTable(2)">Ціна за од.</th>
        <th onclick="sortTable(3)">Сума (грн)</th>
        <th onclick="sortTable(4)">Регіон</th>
        <th onclick="sortTable(5)">Місто</th>
        <th onclick="sortTable(6)">Менеджер</th>
        <th onclick="sortTable(7)">Прилад</th>
        <th onclick="sortTable(8)">Лабораторія (Contractor)</th>
        <th onclick="sortTable(9)">КП</th>
        <th onclick="sortTable(10)">Установа</th>
        <th onclick="sortTable(11)">ЄДРПОУ</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(summary).map(([key, total]) => {
        const [reagent, region, city, manager, device, contractor, kp, institution, edrpou] = key.split("|");
        const info = allReagents[reagent] || {};
        const price = info.price || 0;
        const cost = total * price;
        return `
          <tr>
            <td>${reagent}</td>
            <td>${total}</td>
            <td>${formatNumber(price)}</td>
            <td>${formatNumber(cost)}</td>
            <td>${region}</td>
            <td>${city}</td>
            <td>${manager}</td>
            <td>${device}</td>
            <td>${contractor}</td>
            <td>${kp}</td>
            <td>${institution}</td>
            <td>${edrpou}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
    <tfoot>
      <tr style="font-weight:bold; background:#f0f0f0;">
        <td colspan="3">Загальна сума:</td>
        <td id="grandTotal"></td>
        <td colspan="8"></td>
      </tr>
    </tfoot>
  </table>
`;

// Підрахунок загальної суми
let grandTotal = 0;
Object.entries(summary).forEach(([key, total]) => {
  const reagent = key.split("|")[0];
  const info = allReagents[reagent] || {};
  const price = info.price || 0;
  grandTotal += total * price;
});
document.getElementById("grandTotal").innerText = formatNumber(grandTotal);

// Додаємо фільтри
addTableFilters("reagentTable");

}

// ===== Фільтри для таблиці =====
function addTableFilters(tableId) {
  const table = document.getElementById(tableId);
  const headerRow = table.querySelector("thead tr");
  const filterRow = document.createElement("tr");

  const inputs = [];

  headerRow.querySelectorAll("th").forEach((th, i) => {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Фільтр...";
    input.style.width = "100%";

    const datalistId = `filterOptions_${i}`;
    const datalist = document.createElement("datalist");
    datalist.id = datalistId;
    input.setAttribute("list", datalistId);

    function updateOptions() {
      datalist.innerHTML = "";
      const uniqueValues = new Set();
      table.querySelectorAll("tbody tr").forEach(row => {
        if (row.style.display === "none") return;
        const cell = row.querySelectorAll("td")[i];
        if (cell) uniqueValues.add(cell.innerText.trim());
      });
      uniqueValues.forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        datalist.appendChild(option);
      });
    }

    // первинне заповнення
    updateOptions();

    // фільтрація
    input.onkeyup = function () {
      const filter = this.value.toLowerCase();
      table.querySelectorAll("tbody tr").forEach(row => {
        const cell = row.querySelectorAll("td")[i];
        if (cell) {
          const text = cell.innerText.toLowerCase();
          row.style.display = text.includes(filter) ? "" : "none";
        }
      });
      updateOptions();
      updateGrandTotal(tableId); // перерахунок суми після фільтрації
    };

    th.addEventListener("click", () => {
      updateOptions();
      updateGrandTotal(tableId); // перерахунок після сортування
    });

    const td = document.createElement("td");
    td.appendChild(input);
    td.appendChild(datalist);
    filterRow.appendChild(td);

    inputs.push(input);
  });

  table.querySelector("thead").appendChild(filterRow);
}
function updateGrandTotal(tableId) {
  const table = document.getElementById(tableId);
  let grandTotal = 0;

  table.querySelectorAll("tbody tr").forEach(row => {
    if (row.style.display === "none") return;
    const sumCell = row.querySelectorAll("td")[3]; // колонка "Сума (грн)"
    if (sumCell) {
      const val = parseFloat(sumCell.innerText);
      if (!isNaN(val)) grandTotal += val;
    }
  });

  const totalCell = table.querySelector("tfoot #grandTotal");
  if (totalCell) totalCell.innerText = grandTotal.toFixed(2);
}


// ===== Експорт у CSV =====
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) {
    alert("⚠️ Таблиця не знайдена.");
    return;
  }

  let csv = [];
  const rows = table.querySelectorAll("tr");

  rows.forEach(row => {
    const cols = row.querySelectorAll("td, th");
    const rowData = [];
    cols.forEach(col => rowData.push(`"${col.innerText}"`));
    csv.push(rowData.join(","));
  });

  const csvString = csv.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportTableToExcel(tableId, filename = "report.xlsx") {
  const table = document.getElementById(tableId);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename);
}
function clearAllFilters(tableId) {
  const table = document.getElementById(tableId);
  const inputs = table.querySelectorAll("thead input");

  // очищаємо всі інпути
  inputs.forEach(input => input.value = "");

  // показуємо всі рядки
  table.querySelectorAll("tbody tr").forEach(row => row.style.display = "");

  // оновлюємо підказки для кожної колонки
  inputs.forEach((input, i) => {
    const datalistId = input.getAttribute("list");
    const datalist = document.getElementById(datalistId);
    if (datalist) {
      datalist.innerHTML = "";
      const uniqueValues = new Set();
      table.querySelectorAll("tbody tr").forEach(row => {
        const cell = row.querySelectorAll("td")[i];
        if (cell) uniqueValues.add(cell.innerText.trim());
      });
      uniqueValues.forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        datalist.appendChild(option);
      });
    }
  });
}
function showNeedsReportPeriod() {
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const reagentFilter = document.getElementById("reagentSelect").value;

  const allReagents = window.allReagents || {};
  const summary = {};

  visits.forEach(v => {
    const visitDate = new Date(v.date);
    if (visitDate < startDate || visitDate > endDate) return;

    (v.devices || []).forEach(device => {
      (device.reagents || []).forEach(r => {
        const name = r.name;
        if (reagentFilter && name !== reagentFilter) return;

        if (!summary[name]) summary[name] = 0;
        summary[name] += r.agreement?.quantity || 0;
      });
    });
  });

  renderSimpleReport(summary, allReagents, "📦 Звіт по потребах");
}
function showFactsReportPeriod() {
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const reagentFilter = document.getElementById("reagentSelect").value;

  const allReagents = window.allReagents || {};
  const summary = {};

  visits.forEach(v => {
    (v.devices || []).forEach(device => {
      (device.reagents || []).forEach(r => {
        const factDate = r.fact?.date ? new Date(r.fact.date) : null;
        if (!factDate || factDate < startDate || factDate > endDate) return;

        const name = r.name;
        if (reagentFilter && name !== reagentFilter) return;

        if (!summary[name]) summary[name] = 0;
        summary[name] += r.fact?.quantity || 0;
      });
    });
  });

  renderSimpleReport(summary, allReagents, "📦 Звіт по фактах");
}

function renderSimpleReport(summary, allReagents, title) {
  const container = document.getElementById("reagentReport");
  if (Object.keys(summary).length === 0) {
    container.innerHTML = "<p>⚠️ Немає даних у вибраному періоді.</p>";
    return;
  }
  let grandTotal = 0;
  container.innerHTML = `
    <h3>${title}</h3>
    <table id="reagentTable" border="1" cellpadding="6" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th>Реагент</th>
          <th>Кількість</th>
          <th>Ціна за од.</th>
          <th>Сума (грн)</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(summary).map(([name, total]) => {
          const info = allReagents[name] || {};
          const price = info.price || 0;
          const cost = total * price;
          grandTotal += cost;
          return `
            <tr>
              <td>${name}</td>
              <td>${total}</td>
              <td>${formatNumber(price)}</td>
              <td>${formatNumber(cost)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
      <tfoot>
        <tr style="font-weight:bold; background:#f0f0f0;">
          <td colspan="3">Загальна сума:</td>
          <td>${grandTotal.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <button onclick="exportTableToCSV('reagentTable','report.csv')">⬇️ Експорт у CSV</button>
    <button onclick="exportTableToExcel('reagentTable','report.xlsx')">📊 Експорт у Excel</button>
  `;
}
// ===== Детальний звіт по потребах =====
function showNeedsReportDetailed() {
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const labs = JSON.parse(localStorage.getItem("labCards")) || [];
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const reagentFilter = document.getElementById("reagentSelect").value;

  const allReagents = window.allReagents || {};
  const summary = {};

  visits.forEach(v => {
    const visitDate = new Date(v.date);
    if (visitDate < startDate || visitDate > endDate) return;

    const labInfo = labs.find(l => l.id === v.labId) || {};

    (v.devices || []).forEach(device => {
      (device.reagents || []).forEach(r => {
        const name = r.name;
        if (reagentFilter && name !== reagentFilter) return;

        const key = `${name}|${labInfo.region || "—"}|${labInfo.city || "—"}|${labInfo.manager || "—"}|${device.deviceName || "—"}|${v.labName || "—"}|${labInfo.contractor || "—"}|${labInfo.institution || "—"}|${labInfo.edrpou || "—"}`;
        if (!summary[key]) summary[key] = 0;
        summary[key] += r.agreement?.quantity || 0;
      });
    });
  });

  renderDetailedReport(summary, allReagents, "📦 Детальний звіт по потребах");
}


// ===== Детальний звіт по фактах =====
function showFactsReportDetailed() {
  const visits = JSON.parse(localStorage.getItem("visits")) || [];
  const labs = JSON.parse(localStorage.getItem("labCards")) || [];
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const reagentFilter = document.getElementById("reagentSelect").value;

  const allReagents = window.allReagents || {};
  const summary = {};

  visits.forEach(v => {
    const labInfo = labs.find(l => l.id === v.labId) || {};

    (v.devices || []).forEach(device => {
      (device.reagents || []).forEach(r => {
        const factDate = r.fact?.date ? new Date(r.fact.date) : null;
        if (!factDate || factDate < startDate || factDate > endDate) return;

        const name = r.name;
        if (reagentFilter && name !== reagentFilter) return;

        const key = `${name}|${labInfo.region || "—"}|${labInfo.city || "—"}|${labInfo.manager || "—"}|${device.deviceName || "—"}|${v.labName || "—"}|${labInfo.contractor || "—"}|${labInfo.institution || "—"}|${labInfo.edrpou || "—"}|${r.fact.date}`;
        if (!summary[key]) summary[key] = 0;
        summary[key] += r.fact?.quantity || 0;
      });
    });
  });

  renderDetailedReport(summary, allReagents, "📦 Детальний звіт по фактах", true);
}


// ===== Універсальний рендер для детальних звітів =====
function renderDetailedReport(summary, allReagents, title, includeFactDate = false) {
  const container = document.getElementById("reagentReport");
  if (Object.keys(summary).length === 0) {
    container.innerHTML = "<p>⚠️ Немає даних у вибраному періоді.</p>";
    return;
  }

  container.innerHTML = `
    <h3>${title}</h3>
    <div style="margin-bottom:10px;">
      <button onclick="exportTableToCSV('reagentTable','report_detailed.csv')">⬇️ Експорт у CSV</button>
      <button onclick="exportTableToExcel('reagentTable','report_detailed.xlsx')">📊 Експорт у Excel</button>
      <button onclick="clearAllFilters('reagentTable')">🧹 Очистити всі фільтри</button>
    </div>
    <table id="reagentTable" border="1" cellpadding="6" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th>Реагент</th>
          <th>Кількість</th>
          <th>Ціна за од.</th>
          <th>Сума (грн)</th>
          <th>Регіон</th>
          <th>Місто</th>
          <th>Менеджер</th>
          <th>Прилад</th>
          <th>Лабораторія</th>
          <th>Contractor</th>
          <th>Установа</th>
          <th>ЄДРПОУ</th>
          ${includeFactDate ? "<th>Факт дата</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${Object.entries(summary).map(([key, total]) => {
          const parts = key.split("|");
          const reagent = parts[0];
          const info = allReagents[reagent] || {};
          const price = info.price || 0;
          const cost = total * price;

          return `
            <tr>
              <td>${reagent}</td>
              <td>${total}</td>
              <td>${formatNumber(price)}</td>
              <td>${formatNumber(cost)}</td>
              <td>${parts[1]}</td>
              <td>${parts[2]}</td>
              <td>${parts[3]}</td>
              <td>${parts[4]}</td>
              <td>${parts[5]}</td>
              <td>${parts[6]}</td>
              <td>${parts[7]}</td>
              <td>${parts[8]}</td>
              ${includeFactDate ? `<td>${parts[9]}</td>` : ""}
            </tr>
          `;
        }).join("")}
      </tbody>
      <tfoot>
        <tr style="font-weight:bold; background:#f0f0f0;">
          <td colspan="3">Загальна сума:</td>
          <td id="grandTotal"></td>
          <td colspan="${includeFactDate ? 9 : 8}"></td>
        </tr>
      </tfoot>
    </table>
  `;

  // Підрахунок загальної суми
  let grandTotal = 0;
  Object.entries(summary).forEach(([key, total]) => {
    const reagent = key.split("|")[0];
    const info = allReagents[reagent] || {};
    const price = info.price || 0;
    grandTotal += total * price;
  });
  document.getElementById("grandTotal").innerText = formatNumber(grandTotal);

  // Додаємо фільтри
  addTableFilters("reagentTable");
}
