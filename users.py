import json

USERS_FILE = "users.json"
PARTNERS_FILE = "lpzlist_with_districts.json"

def authenticate(login, password):
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)
    for user in users:
        if user["login"] == login and user["password"] == password:
            return user
    return None

def get_partners_for_user(user):
    with open(PARTNERS_FILE, "r", encoding="utf-8") as f:
        partners = json.load(f)

    if user["role"] == "admin":
        return partners

    elif user["role"] == "employer":
        return [p for p in partners if user["district"] in p.get("district", [])]

    elif user["role"] == "territorial_manager":
        allowed = user["districts"]
        return [p for p in partners if any(d in allowed for d in p.get("district", []))]

    return []

# === Використання ===
login = input("Логін: ")
password = input("Пароль: ")

user = authenticate(login, password)
if user:
    partners = get_partners_for_user(user)
    print(f"✅ Авторизація успішна. Ви увійшли як {user['role']} ({user.get('territory', user.get('district',''))}).")
    print(f"Доступно {len(partners)} партнерів.")
    print(json.dumps(partners, ensure_ascii=False, indent=2))
else:
    print("❌ Невірний логін або пароль")
