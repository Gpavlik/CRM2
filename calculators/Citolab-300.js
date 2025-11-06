window.citolab300Config = {
  analyses: {
    "CITOLAB™ 10 М": {
      formula: (count) => ({
        "CITOLAB™ 10 М": count * 1,
        "Калібровочні смужки": 0.05 * count
      })
    },
    "CITOLAB™ 11 М": {
      formula: (count) => ({
        "CITOLAB™ 11 М": count * 1,
        "Калібровочні смужки": 0.05 * count
      })
    },
    "CITOLAB™ 10 МAC": {
      formula: (count) => ({
        "CITOLAB™ 10 МAC": count * 1,
        "Калібровочні смужки": 0.05 * count
      })
    }
  }
};
