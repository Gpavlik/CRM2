window.labsCache = JSON.parse(localStorage.getItem("labs") || "[]");
window.visitsCache = JSON.parse(localStorage.getItem("visits") || "[]");

function loadLabs() { return window.labsCache; }
function loadVisits() { return window.visitsCache; }

function saveLabs(labs) {
  window.labsCache = labs;
  localStorage.setItem("labs", JSON.stringify(labs));
}
function saveVisits(visits) {
  window.visitsCache = visits;
  localStorage.setItem("visits", JSON.stringify(visits));
}
