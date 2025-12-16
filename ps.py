import json

# === Налаштування ===
MAIN_FILE = "main.json"       # головний JSON
SUB_FILE = "sub.json"         # підлеглий JSON
OUTPUT_FILE = "merged.json"   # результат

# Завантаження
with open(MAIN_FILE, "r", encoding="utf-8") as f:
    main_data = json.load(f)

with open(SUB_FILE, "r", encoding="utf-8") as f:
    sub_data = json.load(f)

# Індекс для швидкого пошуку по єдрпоу
main_index = {item["edrpou"]: item for item in main_data}
sub_index = {item["edrpou"]: item for item in sub_data}

merged = []

# 1. Обходимо всі єдрпоу з головного
for edrpou, main_item in main_index.items():
    if edrpou in sub_index:
        sub_item = sub_index[edrpou]
        merged.append({
            "region": main_item.get("region"),
            "city": main_item.get("city"),
            "name": main_item.get("name"),
            "address": main_item.get("address"),
            "edrpou": edrpou,
            "devices": sub_item.get("devices", []),
            "reagents": sub_item.get("reagents", [])
        })
    else:
        merged.append({
            "region": main_item.get("region"),
            "city": main_item.get("city"),
            "name": main_item.get("name"),
            "address": main_item.get("address"),
            "edrpou": edrpou,
            "devices": [],
            "reagents": []
        })

# 2. Додаємо ті, що є тільки в підлеглому
for edrpou, sub_item in sub_index.items():
    if edrpou not in main_index:
        merged.append({
            "region": sub_item.get("region"),
            "city": sub_item.get("city"),  # може бути None
            "name": sub_item.get("name"),
            "address": sub_item.get("address"),
            "edrpou": edrpou,
            "devices": sub_item.get("devices", []),
            "reagents": sub_item.get("reagents", [])
        })

# Збереження
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"✅ Злиття завершено. Результат у {OUTPUT_FILE}")
