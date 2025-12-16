from flask import Flask, request, jsonify, session, redirect, url_for
import json

app = Flask(__name__)
app.secret_key = "super_secret_key"  # 🔑 ключ для шифрування сесій

USERS_FILE = "users.json"
PARTNERS_FILE = "lpzlist_with_districts.json"

def load_json(filename):
    with open(filename, "r", encoding="utf-8") as f:
        return json.load(f)

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    login = data.get("login")
    password = data.get("password")

    users = load_json(USERS_FILE)
    user = next((u for u in users if u["login"] == login and u["password"] == password), None)

    if not user:
        return jsonify({"error": "Невірний логін або пароль"}), 401

    # зберігаємо дані користувача у сесії
    session["user"] = user
    return jsonify({"message": "Авторизація успішна", "role": user["role"], "territory": user.get("territory", user.get("district", "усі"))})

@app.route("/partners", methods=["GET"])
def partners():
    if "user" not in session:
        return jsonify({"error": "Неавторизований доступ"}), 403

    user = session["user"]
    partners = load_json(PARTNERS_FILE)

    if user["role"] == "admin":
        visible = partners
    elif user["role"] == "employer":
        visible = [p for p in partners if user["district"] in p.get("district", [])]
    elif user["role"] == "territorial_manager":
        allowed = user["districts"]
        visible = [p for p in partners if any(d in allowed for d in p.get("district", []))]
    else:
        visible = []

    return jsonify({"partners": visible})

@app.route("/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"message": "Ви вийшли із системи"})
    
if __name__ == "__main__":
    app.run(debug=True)
