import json

# === Налаштування ===
INPUT_FILE = "lpzlist.json"
OUTPUT_FILE = "lpzlist_with_districts.json"

# Матриця округів
districts = {
    "Східно-поліський": ["чернігівська"],
    "Таврійський": ["кіровоградська", "миколаївська"],
    "Наддніпрянський": ["дніпропетровська", "запорізька", "херсонська"],
    "Слобожанський": ["полтавська", "харківська"],
    "Центральний": ["черкаська", "вінницька"],
    "Волиньський": ["рівненська", "волинська"],
    "Закарпатський": ["закарпатська"],
    "Прикарпатський": ["івано-франківська", "чернівецька"],
    "Галицький": ["львівська"],
    "Подільський": ["тернопільська", "хмельницька"],
    "Західно-поліський": ["житомирська"]
}

# Завантаження JSON
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    partners = json.load(f)

# Призначення округів
for partner in partners:
    region = partner.get("region", "").lower()
    city   = partner.get("city", "").lower() if partner.get("city") else ""
    assigned = []

    # Київська область і Київ → два округи
    if "київська" in region or "київ" in city:
        assigned = ["Східно-поліський", "Західно-поліський"]
    else:
        for district, territories in districts.items():
            for terr in territories:
                if terr in region or terr in city:
                    assigned = [district]
                    break
            if assigned:
                break

    partner["district"] = assigned if assigned else ["Не визначено"]

# Збереження результату
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(partners, f, ensure_ascii=False, indent=2)

print(f"✅ Дістрікти додані. Результат у {OUTPUT_FILE}")
