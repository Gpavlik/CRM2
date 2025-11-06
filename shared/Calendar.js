export function generateEvents({ device, partner, soldDate, testsPerDay, reagents, serviceIntervalDays = 90, replacementAfterDays = 365 }) {
  const events = [];
  const startDate = new Date(soldDate);

  // Події закупівлі реагентів
  reagents.forEach(r => {
    const dailyUsage = r.usagePerTest * testsPerDay;
    const daysToDepletion = Math.floor(r.volume / dailyUsage);
    const depletionDate = new Date(startDate);
    depletionDate.setDate(depletionDate.getDate() + daysToDepletion - 5); // буфер 5 днів

    events.push({
      date: depletionDate.toISOString().split("T")[0],
      type: "реагенти",
      title: `🔬 Закупівля ${r.name}`,
      partner,
      device,
      description: `Очікуване вичерпання реагенту ${r.name}. Рекомендується зв’язатися з партнером.`
    });
  });

  // Сервіс кожні serviceIntervalDays
  for (let i = serviceIntervalDays; i < replacementAfterDays; i += serviceIntervalDays) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    events.push({
      date: date.toISOString().split("T")[0],
      type: "сервіс",
      title: `🛠️ Сервісне обслуговування ${device}`,
      partner,
      device,
      description: `Плановий сервіс приладу ${device}`
    });
  }

  // Заміна приладу
  const replacementDate = new Date(startDate);
  replacementDate.setDate(replacementDate.getDate() + replacementAfterDays);
  events.push({
    date: replacementDate.toISOString().split("T")[0],
    type: "заміна",
    title: `🔁 Пропозиція заміни ${device}`,
    partner,
    device,
    description: `Оцінити потребу в оновленні приладу ${device}`
  });

  return events;
}
function generateEventsFromLabCards() {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const events = [];

  labCards.forEach(lab => {
    lab.devices.forEach(device => {
      device.reagents.forEach(r => {
        const reagentList = Object.entries(r.usage)
          .map(([name, amount]) => `${name}: ${amount.toFixed(2)} мл`)
          .join(", ");

        events.push({
          date: getNextDeliveryDate(), // або фіксована дата
          title: `🔬 ${r.name} — ${r.count} тестів`,
          description: `📦 Витрата: ${reagentList}`,
          lab: lab.partner,
          device: device.device
        });
      });
    });
  });

  return events;
}

function getNextDeliveryDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth.toISOString().split("T")[0];
}
function generateCalendarTasks() {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const tasks = [];

  labCards.forEach(lab => {
    lab.devices.forEach(device => {
      device.reagents.forEach(r => {
        const reagentList = Object.entries(r.usage)
          .map(([name, amount]) => `${name}: ${amount.toFixed(2)} мл`)
          .join(", ");

        tasks.push({
          date: getDeliveryDate(), // наприклад, перше число наступного місяця
          title: `🔬 ${r.name} — ${r.count} тестів`,
          description: `📦 ${reagentList}`,
          lab: lab.partner,
          device: device.device
        });
      });
    });
  });

  return tasks;
}
function getDeliveryDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth.toISOString().split("T")[0]; // формат YYYY-MM-DD
}

function generateCalendarTasks() {
  const labCards = JSON.parse(localStorage.getItem("labCards")) || [];
  const tasks = [];

  labCards.forEach((lab, labIndex) => {
    lab.devices.forEach((device, devIndex) => {
      device.reagents.forEach((r, rIndex) => {
        const reagentList = Object.entries(r.usage)
          .map(([name, amount]) => `${name}: ${amount.toFixed(2)} мл`)
          .join(", ");

        tasks.push({
          id: `task_${labIndex}_${devIndex}_${rIndex}`,
          date: getDeliveryDate(),
          title: `🔬 ${r.name} — ${r.count} тестів`,
          description: `📦 ${reagentList}`,
          lab: lab.partner,
          device: device.device,
          status: "заплановано"
        });
      });
    });
  });

  localStorage.setItem("calendarTasks", JSON.stringify(tasks));
  return tasks;
}

function updateTask(updatedTask) {
  const tasks = JSON.parse(localStorage.getItem("calendarTasks")) || [];
  const index = tasks.findIndex(t => t.id === updatedTask.id);
  if (index !== -1) {
    tasks[index] = updatedTask;
    localStorage.setItem("calendarTasks", JSON.stringify(tasks));
  }
}


export default {
  calculateFinancials({
    devicePrice,
    reagentCosts,
    serviceCosts,
    replacementCosts
  }) {
    const totalCosts = reagentCosts + serviceCosts + replacementCosts;
    const profit = devicePrice - totalCosts;

    return {
      totalCosts,
      profit
    };
  }
};