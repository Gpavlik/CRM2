import csv
import json

# Вхідний файл
input_file = "obl.csv"
output_file = "regions.json"

regions = {}

# Читаємо CSV
with open(input_file, "r", encoding="utf-8") as f:
    reader = csv.reader(f, delimiter=";")
    for row in reader:
        if len(row) != 2:
            continue
        city, oblast = row
        city = city.strip()
        oblast = oblast.strip()
        regions.setdefault(oblast, []).append(city)

# Зберігаємо у JSON
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(regions, f, ensure_ascii=False, indent=4)


print(f"✅ Словник областей збережено у '{output_file}'")
