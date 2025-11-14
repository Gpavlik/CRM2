// logistics.js

export const ORS_TOKEN = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA3YmNiYmQxNWVmNTQxZTFhMzU3ZjkyMjZmZTVhNDc1IiwiaCI6Im11cm11cjY0In0=";
export const orsDistanceCache = {};


export async function getDistanceKmORS(cityA, cityB, token = ORS_TOKEN) {
  const key = `${cityA}__${cityB}`;
  if (orsDistanceCache[key]) return orsDistanceCache[key];

  const geocode = async city => {
    const res = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${token}&text=${encodeURIComponent(city)}`);
    const data = await res.json();
    return data.features[0]?.geometry?.coordinates;
  };

  const [coordA, coordB] = await Promise.all([geocode(cityA), geocode(cityB)]);
  if (!coordA || !coordB) return Infinity;

  const res = await fetch(`https://api.openrouteservice.org/v2/matrix/driving-car`, {
    method: "POST",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locations: [coordA, coordB],
      metrics: ["distance"]
    })
  });

  const data = await res.json();
  const meters = data.distances?.[0]?.[1];
  const km = meters ? meters / 1000 : Infinity;

  orsDistanceCache[key] = km;
  return km;
}

export async function findNearbyAvailableDate(taskCity, taskSchedule, token = ORS_TOKEN, preferredDate = null) {
  const maxTasksPerDay = 6;
  const candidate = preferredDate ? new Date(preferredDate) : new Date();
  let fallbackDate = null;

  for (let i = 0; i < 60; i++) {
    const day = candidate.getDay();
    if (day === 0 || day === 6) {
      candidate.setDate(candidate.getDate() + 1);
      continue;
    }

    const key = candidate.toISOString().split("T")[0];
    const tasks = taskSchedule[key] || [];

    const hasSpace = tasks.length < maxTasksPerDay;
    let nearby = false;

    for (const t of tasks) {
      const dist = await getDistanceKmORS(taskCity, t.city, token);
      if (dist <= 20) {
        nearby = true;
        break;
      }
    }

    if (hasSpace && nearby) return key;
    if (!fallbackDate && hasSpace) fallbackDate = key;

    candidate.setDate(candidate.getDate() + 1);
  }

  return fallbackDate || candidate.toISOString().split("T")[0];
}




window.findNearbyAvailableDate = findNearbyAvailableDate;
window.ORS_TOKEN = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA3YmNiYmQxNWVmNTQxZTFhMzU3ZjkyMjZmZTVhNDc1IiwiaCI6Im11cm11cjY0In0=";