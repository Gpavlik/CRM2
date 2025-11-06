function showReagentReport() {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const summary = {};

  labCards.forEach(lab => {
    lab.devices.forEach(device => {
      device.reagents?.forEach(r => {
        Object.entries(r.usage || {}).forEach(([name, amount]) => {
          summary[name] = (summary[name] || 0) + amount;
        });
      });
    });
  });

  const container = document.getElementById("reagentReport");
  container.innerHTML = "<h3>📦 Сумарне використання реагентів</h3><ul>" +
    Object.entries(summary)
      .map(([name, total]) => `<li>${name}: ${total.toFixed(2)} мл</li>`)
      .join("") +
    "</ul>";
}
