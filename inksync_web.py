import json
from datetime import datetime, date

from flask import Flask, render_template, jsonify, request
import os
from enum import Enum
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', template_folder='templates')

MODULES_DIR = 'modules'
CONFIG_DIR  = "configs"
EVENTS_DIR  = 'events'
LAYOUT_DIR  = 'layout'        # <-- nowy katalog na layouty
AUTOMATIONS_DIR = 'automations'  # <-- katalog na automacje


integration_status = {
    "microsoft": False,
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


def parse_event_date(value: str) -> date:
    if "T" in value:
        # Trim nanoseconds if present
        if "." in value:
            value = value.split(".")[0]
        return datetime.fromisoformat(value).date()
    return date.fromisoformat(value)

@app.route('/api/events')
def get_events():
    internal_events_path = os.path.join(EVENTS_DIR, 'internal.json')
    google_events_path = os.path.join(EVENTS_DIR, 'google.json')
    microsoft_events_path = os.path.join(EVENTS_DIR, 'microsoft.json')

    date_from_str = request.args.get('from')
    date_to_str = request.args.get('to')

    if not date_from_str or not date_to_str:
        return jsonify({"error": "from and to query parameters are required"}), 400

    date_from = parse_event_date(date_from_str)
    date_to = parse_event_date(date_to_str)

    def load_events(path):
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []

    all_events = (
        load_events(internal_events_path) +
        load_events(google_events_path) +
        load_events(microsoft_events_path)
    )

    filtered_events = []

    for event in all_events:
        # Always use the robust parser
        try:
            start = parse_event_date(event["start"])
            end = parse_event_date(event["end"])
        except Exception as e:
            # Skip invalid events instead of crashing
            print(f"Skipping invalid event {event.get('id')} due to parse error: {e}")
            continue

        # Overlap check
        if start <= date_to and end >= date_from:
            filtered_events.append(event)

    return jsonify(filtered_events)

@app.route('/api/save/event', methods=['POST'])
def save_event():
    file_path = os.path.join(EVENTS_DIR, 'internal.json')
    new_event = request.get_json()

    # Load existing events
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                events = json.load(f)
                if not isinstance(events, list):
                    events = []
        except Exception as exc:
            print(f"Failed to load existing events: {exc}")
            events = []
    else:
        events = []

    # Append new event
    events.append(new_event)

    # Save back
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"Failed to save event: {exc}")
        return jsonify({'status': 'error', 'message': str(exc)}), 500

    create_state()

    return jsonify({'status': 'saved', 'event': new_event})

@app.route('/api/delete/event', methods=['POST'])
def delete_event():
    file_path = os.path.join(EVENTS_DIR, 'internal.json')
    data = request.get_json()
    event_id = data.get("id")

    if not event_id:
        return jsonify({"status": "error", "message": "No id provided"}), 400

    # Load existing events
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                events = json.load(f)
                if not isinstance(events, list):
                    events = []
        except Exception as exc:
            print(f"Failed to load events for deletion: {exc}")
            return jsonify({"status": "error", "message": str(exc)}), 500
    else:
        events = []

    # Filter out the event with matching id
    new_events = [ev for ev in events if ev.get("id") != event_id]

    # Save back
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(new_events, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"Failed to save events after deletion: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500

    create_state()

    return jsonify({"status": "deleted", "id": event_id})


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


@app.get("/api/automations")
def get_automations():
    os.makedirs(AUTOMATIONS_DIR, exist_ok=True)
    file_path = os.path.join(AUTOMATIONS_DIR, "automations.json")
    if not os.path.exists(file_path):
        return jsonify([])
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@app.post("/api/automations/save")
def save_automations():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"error": "Payload must be a list"}), 400
    os.makedirs(AUTOMATIONS_DIR, exist_ok=True)
    file_path = os.path.join(AUTOMATIONS_DIR, "automations.json")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"status": "saved"})


def create_state():
    today = date.today()

    def load_events(path):
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as exc:
                print(f"Failed to load {path}: {exc}")
        return []

    paths = [
        os.path.join(EVENTS_DIR, "internal.json"),
        os.path.join(EVENTS_DIR, "google.json"),
        os.path.join(EVENTS_DIR, "microsoft.json"),
    ]

    all_events = []
    for p in paths:
        all_events.extend(load_events(p))

    todays_events = []
    for event in all_events:
        try:
            start = parse_event_date(event.get("start")) if event.get("start") else None
            end = parse_event_date(event.get("end")) if event.get("end") else start
        except Exception as exc:
            print(f"Skipping invalid event {event.get('id')}: {exc}")
            continue

        if start and end and start <= today <= end:
            # Map to {time, event} format for your frontend
            time_str = event.get("start", "00:00")
            if "T" in time_str:
                time_str = time_str.split("T")[1][:5] # get HH:MM
            else:
                time_str = "00:00"
            todays_events.append({
                "time": time_str,
                "event": event.get("name", "Unnamed Event")
            })

    state = {"events": todays_events}

    try:
        with open("state.json", "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"Failed to write `state.json`: {exc}")



if __name__ == '__main__':
    os.makedirs(MODULES_DIR, exist_ok=True)
    os.makedirs(EVENTS_DIR, exist_ok=True)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    os.makedirs(LAYOUT_DIR, exist_ok=True)
    os.makedirs(AUTOMATIONS_DIR, exist_ok=True)
    create_state()
    app.run(debug=True, host='0.0.0.0')
