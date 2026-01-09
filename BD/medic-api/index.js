const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("medic");
  const labs = db.collection("labs");
  const history = db.collection("history");

  // 1. Отримати всі лабораторії
  app.get("/labs", async (req, res) => {
    const data = await labs.find().toArray();
    res.json(data);
  });

  // 2. Отримати лабораторію за ЄДРПОУ
  app.get("/labs/:edrpou", async (req, res) => {
    const lab = await labs.findOne({ edrpou: req.params.edrpou });
    res.json(lab);
  });

  // 3. Додати реагент у лабораторію
  app.post("/labs/:edrpou/reagent", async (req, res) => {
    const { device, reagent, quantity } = req.body;
    await labs.updateOne(
      { edrpou: req.params.edrpou },
      {
        $push: {
          "devices.$[d].reagents": {
            name: reagent,
            lastOrderCount: quantity,
            lastOrderDate: new Date()
          }
        },
        $set: { lastUpdated: new Date() }
      },
      { arrayFilters: [ { "d.device": device } ] }
    );

    await history.insertOne({
      lab_id: req.params.edrpou,
      action: "add_reagent",
      timestamp: new Date(),
      payload: { device, reagent, quantity }
    });

    res.json({ status: "ok" });
  });

  // 4. Звіт по кластерах (реагенти)
  app.get("/reports/reagents", async (req, res) => {
    const report = await labs.aggregate([
      { $unwind: "$devices" },
      { $unwind: "$devices.reagents" },
      { $group: { _id: "$manager", totalReagents: { $sum: "$devices.reagents.lastOrderCount" } } },
      { $sort: { totalReagents: -1 } }
    ]).toArray();
    res.json(report);
  });

  app.listen(3000, () => console.log("Medic API running on http://localhost:3000"));
}

run().catch(console.error);
