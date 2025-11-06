const dh36Config = {
  device: "DH-36",
  reagents: [
    {
      name: "DIL-E",
      startup: 112.96,
      shutdown: 450.0,
      perTest: 23.81,
      packageSize: 20000,
      price: 2395
    },
    {
      name: "LYE-1",
      startup: 1.473,
      shutdown: 0,
      perTest: 0.5,
      packageSize: 500,
      price: 2650
    },
    {
      name: "CLE-P",
      startup: 0,
      shutdown: 1.8,
      perTest: 0,
      packageSize: 50,
      price: 395
    },
    {
      name: "CBC-3D",
      startup: 0.1,
      shutdown: 0,
      perTest: 0,
      packageSize: 1,
      price: 2750
    }
  ],

  getWorkingDays(period) {
    const perMonth = 21;
    switch (period) {
      case "month": return perMonth;
      case "quarter": return perMonth * 3;
      case "year": return perMonth * 12;
      default: return 1;
    }
  },

  calculateUsage({ testsPerDay, testPrice, devicePrice }) {
    const workDays = this.getWorkingDays("year");
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
    let paybackDay = "не досягається";

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

      if (accumulatedProfit >= devicePrice && paybackDay === "не досягається") {
        paybackDay = day;
      }
    }

    const annualProfit = annualRevenue - totalReagentCost;
    const costPerTest = totalTests > 0 ? totalReagentCost / totalTests : 0;
    const finalNetProfit = annualProfit - devicePrice;

    return {
      workDays,
      totalTests,
      totalReagentCost,
      annualRevenue,
      annualProfit,
      costPerTest,
      paybackDay,
      finalNetProfit
    };
  },

  planReagents(testsPerDay) {
    const periods = ["month", "quarter", "year"];
    const plans = {};

    periods.forEach(period => {
      const days = this.getWorkingDays(period);
      const tests = testsPerDay * days;
      const plan = [];

      this.reagents.forEach(r => {
        const volume = days * (r.startup + r.shutdown) + tests * r.perTest;
        const bottles = Math.ceil(volume / r.packageSize);
        const cost = bottles * r.price;
        plan.push({
          reagent: r.name,
          bottles,
          cost: +cost.toFixed(2)
        });
      });

      plans[period] = plan;
    });

    return plans;
  }
};
