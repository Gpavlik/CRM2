// logistics.js — кешова версія без export/import

const ORS_TOKEN =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA3YmNiYmQxNWVmNTQxZTFhMzU3ZjkyMjZmZTVhNDc1IiwiaCI6Im11cm11cjY0In0=";

const orsDistanceCache = {};

// ===== Утиліта для форматування дат =====
function formatDateYYYYMMDD(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ===== Отримання відстані та часу між містами через OpenRouteService =====
async function getDistanceAndTimeORS(cityA, cityB, token = ORS_TOKEN) {
  const key = [cityA, cityB].sort().join("__");
  if (orsDistanceCache[key]) return orsDistanceCache[key];

  const geocode = async city => {
    const res = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${token}&text=${encodeURIComponent(city)}&boundary.country=UA`
    );
    const data = await res.json();
    return data.features[0]?.geometry?.coordinates;
  };

  const [coordA, coordB] = await Promise.all([geocode(cityA), geocode(cityB)]);
  if (!coordA || !coordB) return { km: Infinity, hours: Infinity };

  const res = await fetch(`https://api.openrouteservice.org/v2/matrix/driving-car`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locations: [coordA, coordB],
      metrics: ["distance", "duration"]
    })
  });

  const data = await res.json();
  const meters = data.distances?.[0]?.[1];
  const seconds = data.durations?.[0]?.[1];

  const km = meters ? meters / 1000 : Infinity;
  const hours = seconds ? (seconds / 3600).toFixed(2) : Infinity;

  orsDistanceCache[key] = { km, hours };
  return { km, hours };
}

// ===== Пошук найближчої доступної дати для задачі =====
async function findNearbyAvailableDate(
  taskCity,
  taskSchedule,
  {
    token = ORS_TOKEN,
    preferredDate = null,
    maxTasksPerDay = 3,
    nearbyDistanceKm = 25,
    nearbyDurationHours = 0.75
  } = {}
) {
  const candidate = preferredDate ? new Date(preferredDate) : new Date();
  let fallbackDate = null;

  for (let i = 0; i < 60; i++) {
    const day = candidate.getDay();
    // пропускаємо неділю (0) та суботу (6)
    if (day === 0 || day === 6) {
      candidate.setDate(candidate.getDate() + 1);
      continue;
    }

    const key = formatDateYYYYMMDD(candidate);
    const tasks = taskSchedule[key] || [];

    const hasSpace = tasks.length < maxTasksPerDay;
    let nearby = false;

    for (const t of tasks) {
      const { km, hours } = await getDistanceAndTimeORS(taskCity, t.city, token);
      if (km <= nearbyDistanceKm || hours <= nearbyDurationHours) {
        nearby = true;
        break;
      }
    }

    if (hasSpace && nearby) return formatDateYYYYMMDD(candidate);
    if (!fallbackDate && hasSpace) fallbackDate = formatDateYYYYMMDD(candidate);

    candidate.setDate(candidate.getDate() + 1);
  }

  return fallbackDate || formatDateYYYYMMDD(candidate);
}

// ===== Планування логістики для списку візитів =====
async function planLogisticsForVisits(visits, taskSchedule = {}) {
  const plannedVisits = [];

  for (const visit of visits) {
    const availableDate = await findNearbyAvailableDate(
      visit.city,
      taskSchedule,
      {
        token: ORS_TOKEN,
        maxTasksPerDay: 3,
        nearbyDistanceKm: 40,
        nearbyDurationHours: 0.75
      }
    );

    const { km, hours } = await getDistanceAndTimeORS("Київ", visit.city, ORS_TOKEN);

    const plannedVisit = {
      id: `${visit.labId}_${availableDate}_${Date.now()}`,
      labId: visit.labId,
      labName: visit.labName,
      city: visit.city,
      date: availableDate,
      tasks: visit.tasks || [],
      status: "заплановано",
      distanceKm: km,
      travelHours: hours
    };

    plannedVisits.push(plannedVisit);

    if (!taskSchedule[availableDate]) taskSchedule[availableDate] = [];
    taskSchedule[availableDate].push({ city: visit.city });
  }

  // Зберігаємо у кеш
  const visitsCache = JSON.parse(localStorage.getItem("visits") || "[]");
  const updatedVisits = [...visitsCache, ...plannedVisits];
  localStorage.setItem("visits", JSON.stringify(updatedVisits));
  window.visitsCache = updatedVisits;

  alert(`✅ Заплановано ${plannedVisits.length} візитів (збережено у кеш)`);
  return plannedVisits;
}

// ===== Робимо глобально доступним =====
window.ORS_TOKEN = ORS_TOKEN;
window.orsDistanceCache = orsDistanceCache;
window.getDistanceKmORS = getDistanceAndTimeORS;
window.getDistanceAndTimeORS = getDistanceAndTimeORS;
window.findNearbyAvailableDate = findNearbyAvailableDate;
window.formatDateYYYYMMDD = formatDateYYYYMMDD;
window.planLogisticsForVisits = planLogisticsForVisits;
