window.df50Config = {
  analyses: {
    "DF50: DIL-C": {
      formula: (count) => ({
        "DIL-C": +(104 + 500.64 + 32.80 * count)
      })
    },
    "DF50: LYC-1": {
      formula: (count) => ({
        "LYC-1": +(0.16 + 0 + 0.19 * count)
      })
    },
    "DF50: LYC-2": {
      formula: (count) => ({
        "LYC-2": +(13 + 1.183 + 0.66 * count)
      })
    },
    "DF50: CLE-P": {
      formula: (count) => ({
        "CLE-P": +(0 + 3.6 + 0 * count)
      })
    },
    "DF50: CBC-DH": {
      formula: (count) => ({
        "CBC-DH": +(0.1 + 0 + 0 * count)
      })
    }
  }
};
