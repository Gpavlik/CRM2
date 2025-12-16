import pandas as pd
import json
from collections import defaultdict

# === Налаштування ===
INPUT_FILE = "purchases.xlsx"
OUTPUT_FILE = "partners_with_products.json"

# Завантаження таблиці
df = pd.read_excel(INPUT_FILE)
df.columns = df.columns.str.strip().str.lower()

# Визначення колонок (точно під твою таблицю)
col_is_device = "чи прилад"
col_group     = "група"
col_product   = "товар"
col_region    = "область"
col_period    = "период"   # саме так, без "і"
col_partner   = "контрагент"
col_edrpou    = "єдрпоу"
col_address   = "адрес"
col_qty       = "q(шт)"

partners = defaultdict(lambda: {
    "region": None,
    "name": None,
    "edrpou": None,
    "address": None,
    "devices": [],
    "reagents": []
})

def find_by_name(items, name):
    return next((x for x in items if x["name"] == name), None)

def to_period(v):
    try:
        return pd.to_datetime(v, dayfirst=True).strftime("%Y-%m-%d")
    except:
        return None

def to_int(v):
    try:
        return int(float(v))
    except:
        return 0

# Обробка рядків
for _, row in df.iterrows():
    edrpou = ""
    if pd.notna(row[col_edrpou]):
        try:
            edrpou = str(int(float(row[col_edrpou])))
        except:
            edrpou = str(row[col_edrpou]).strip()
    is_device= bool(row[col_is_device])
    group    = str(row[col_group]).strip()
    product  = str(row[col_product]).strip()
    region   = str(row[col_region]).strip()
    period   = to_period(row[col_period])
    name     = str(row[col_partner]).strip()
    address  = str(row[col_address]).strip() if pd.notna(row[col_address]) else ""
    quantity = to_int(row[col_qty])

    if not edrpou or not product or not period:
        continue

    partner = partners[edrpou]
    partner["region"] = region
    partner["name"] = name
    partner["address"] = address
    partner["edrpou"] = edrpou
    purchase = {"date": period, "quantity": quantity}

    if is_device:
        device = find_by_name(partner["devices"], product)
        if not device:
            device = {
                "name": product,
                "products": [product],
                "purchases": [],
                "lastPurchases": []
            }
            partner["devices"].append(device)
        device["purchases"].append(purchase)
        device["lastPurchases"] = [purchase]
    else:
        reagent = find_by_name(partner["reagents"], product)
        if not reagent:
            reagent = {
                "name": product,
                "device": group,
                "purchases": [],
                "lastPurchases": []
            }
            partner["reagents"].append(reagent)
        reagent["purchases"].append(purchase)
        reagent["lastPurchases"] = [purchase]

# Збереження у JSON
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(list(partners.values()), f, ensure_ascii=False, indent=2)

print(f"✅ Готово! Дані збережено у {OUTPUT_FILE}")
