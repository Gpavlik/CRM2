window.un73Config = {
  deviceName: "UN-73",
  price: 35200,
  testPrice: 120,
  testsPerDay: 40,
  reagents: [
    { name: "DIL-A", startup: 176.03, shutdown: 260.233, perTest: 36.963, packageSize: 20000, price: 2607 },
    { name: "LYG-1", startup: 4.00, shutdown: 0, perTest: 0.5, packageSize: 500, price: 3520 },
    { name: "LYA-2", startup: 3.00, shutdown: 0.104, perTest: 0.5, packageSize: 500, price: 6490 },
    { name: "LYA-3", startup: 3.00, shutdown: 1.19, perTest: 1.4, packageSize: 1000, price: 4743 },
    { name: "CLE-P", startup: 0, shutdown: 3.6, perTest: 0, packageSize: 50, price: 395 },
    { name: "CBC-DH", startup: 0.1, shutdown: 0, perTest: 0, packageSize: 1, price: 3520 }
  ],
  analyses: {
    "UN73: DIL-A": {
      formula: (count) => ({
        "DIL-A": +(176.03 + 260.233 + 36.963 * count)
      })
    },
    "UN73: LYG-1": {
      formula: (count) => ({
        "LYG-1": +(4.00 + 0 + 0.5 * count)
      })
    },
    "UN73: LYA-2": {
      formula: (count) => ({
        "LYA-2": +(3.00 + 0.104 + 0.5 * count)
      })
    },
    "UN73: LYA-3": {
      formula: (count) => ({
        "LYA-3": +(3.00 + 1.19 + 1.4 * count)
      })
    },
    "UN73: CLE-P": {
      formula: (count) => ({
        "CLE-P": +(0 + 3.6 + 0 * count)
      })
    },
    "UN73: CBC-DH": {
      formula: (count) => ({
        "CBC-DH": +(0.1 + 0 + 0 * count)
      })
    }
  },
  calculateFinancials: function(testsPerDay = this.testsPerDay, testPrice = this.testPrice) {
    const workDays = 21 * 12;
    const totalTests = testsPerDay * workDays;
    const annualRevenue = totalTests * testPrice;

    let totalReagentCost = 0;
    let reagentState = this.reagents.map(r => ({
      remainingVolume: r.packageSize,
      bottlesUsed: 0,
      totalVolumeUsed: 0,
      price: r.price,
      packageSize: r.packageSize
    }));

    let accumulatedProfit = 0;
    let paybackDay = 'не досягається';

    for (let day = 1; day <= workDays; day++) {
      let dailyCost = 0;
      const revenue = testsPerDay * testPrice;

      reagentState.forEach((state, i) => {
        const r = this.reagents[i];
        const dailyVolume = r.startup + r.shutdown + r.perTest * testsPerDay;
        state.totalVolumeUsed += dailyVolume;

        if (state.remainingVolume < dailyVolume) {
          state.bottlesUsed += 1;
          totalReagentCost += r.price;
          dailyCost += r.price;
          state.remainingVolume = r.packageSize - dailyVolume;
        } else {
          state.remainingVolume -= dailyVolume;
        }
      });

      const dailyProfit = revenue - dailyCost;
      accumulatedProfit += dailyProfit;

      if (accumulatedProfit >= this.price && paybackDay === 'не досягається') {
        paybackDay = day;
      }
    }

    const annualProfit = annualRevenue - totalReagentCost;
    const costPerTest = totalTests > 0 ? totalReagentCost / totalTests : 0;
    const finalNetProfit = annualProfit - this.price;

    return {
      workDays,
      totalTests,
      annualRevenue,
      totalReagentCost,
      annualProfit,
      costPerTest,
      paybackDay,
      finalNetProfit
    };
  }
};
