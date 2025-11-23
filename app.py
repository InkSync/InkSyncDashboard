# ... istniejące importy ...
import json
from flask import Flask, render_template, jsonify, request
import os
from enum import Enum
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', template_folder='templates')

MODULES_DIR = 'modules'
CONFIG_DIR  = "configs"
EVENTS_DIR  = 'events'
LAYOUT_DIR  = 'layout'        # <-- nowy katalog na layouty


integration_status = {
    "microsoft": False,
    "apple": False,
    "google": False
}

class ModuleType(str, Enum):
    KEYPAD = "keypad"
    KNOB_ARRAY = "knob_array"


# Domyślna konfiguracja gdy brak pliku
DEFAULT_CONFIG = {
    "KEY0": [None, None],
    "KEY1": [None, None],
    "KEY2": [None, None],
    "KEY3": [None, None],
    "KEY4": [None, None],
    "KEY5": [None, None],
    "KEY6": [None, None],
    "KEY7": [None, None],
    "KEY8": [None, None]
}

@app.route('/')
def home():
    return render_template('index.html', title='Device', key='device')


@app.route('/layout')
def layout():
    return render_template('layout.html', title='Layout', key='layout')


@app.route('/automation')
def automation():
    return render_template('automation.html', title='Automation', key='automation')


@app.route('/settings')
def settings():
    return render_template('settings.html', title='Settings', key='settings')


@app.route('/events')
def events():
    return render_template('events.html', title='Events', key='events')


@app.get("/api/config/<uuid>")
def get_or_create_config(uuid):
    path = os.path.join(CONFIG_DIR, f"{uuid}.json")

    # --- If config exists, return it ---
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))

    # --- If not, create a new config ---
    with open(path, "w", encoding="utf-8") as f:

        json.dump(DEFAULT_CONFIG, f, indent=2)

    return jsonify(DEFAULT_CONFIG)

@app.route('/api/<string:page>')
def get_module(page):
    # sanitize filename
    filename = secure_filename(f'{page}.json')
    file_path = os.path.join(MODULES_DIR, filename)
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({'error': 'not found'}), 404


@app.route('/api/check')
def check_files():
    return jsonify({
        'module1': os.path.exists(os.path.join(MODULES_DIR, 'module1.json')),
        'module2': os.path.exists(os.path.join(MODULES_DIR, 'module2.json'))
    })


@app.route('/api/events')
def get_events():
    file_path = os.path.join(EVENTS_DIR, 'internal.json')
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify([])

@app.route('/api/save/events', methods=['POST'])
def save_events():
    file_path = os.path.join(EVENTS_DIR, 'internal.json')
    data = request.get_json()
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    return jsonify({'status': 'saved'})


@app.route("/api/integrate", methods=["POST"])
def set_integration():
    data = request.get_json()
    service = data.get("service")

    if service not in integration_status:
        return jsonify({"error": "Unknown service"}), 400

    integration_status[service] = True
    return jsonify({"status": "OK"})


@app.route("/api/integration-status/<service>", methods=["GET"])
def get_integration_status(service):
    if service not in integration_status:
        return jsonify({"error": "Unknown service"}), 400

    return jsonify({
        "service": service,
        "integrated": integration_status[service]
    })

@app.route('/api/layout', methods=['GET'])
def get_layout():
    file_path = os.path.join(LAYOUT_DIR, 'layout.json')
    if not os.path.exists(file_path):
        return jsonify({"elements": []})
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/api/layout', methods=['POST'])
def save_layout():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload"}), 400

    os.makedirs(LAYOUT_DIR, exist_ok=True)
    file_path = os.path.join(LAYOUT_DIR, 'layout.json')
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify({"status": "saved", "path": file_path})


if __name__ == '__main__':
    os.makedirs(MODULES_DIR, exist_ok=True)
    os.makedirs(EVENTS_DIR, exist_ok=True)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    os.makedirs(LAYOUT_DIR, exist_ok=True)
    app.run(debug=True)
