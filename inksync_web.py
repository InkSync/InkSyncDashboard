import json
import os
import time
from datetime import datetime, date
from enum import Enum

import requests
from flask import Flask, render_template, jsonify, request
from werkzeug.utils import secure_filename
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Flask app
app = Flask(__name__, static_folder='static', template_folder='templates')

# --- Directories ---
MODULES_DIR = 'modules'
CONFIG_DIR = "configs"
EVENTS_DIR = 'events'
LAYOUT_DIR = 'layout'
AUTOMATIONS_DIR = 'automations'
CREDENTIALS_DIR = 'credentials'

# --- Integration status ---
integration_status = {
    "microsoft": os.path.exists(os.path.join(CREDENTIALS_DIR, "microsoft_session.json")),
    "google": os.path.exists(os.path.join(CREDENTIALS_DIR, "google_session.json")),
}

# --- Module type enum ---
class ModuleType(str, Enum):
    KEYPAD = "keypad"
    KNOB_ARRAY = "knob_array"

# --- Default config ---
DEFAULT_CONFIG = {f"KEY{i}": [None, None] for i in range(9)}

# ------------------ Routes for pages ------------------
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

@app.route('/settings/auth_google')
def auth_page_google():
    return render_template('auth_google.html')

@app.route('/settings/auth_microsoft')
def auth_page_microsoft():
    return render_template('auth_microsoft.html')

@app.route('/events')
def events():
    return render_template('events.html', title='Events', key='events')

# ------------------ Config API ------------------
@app.get("/api/config/<uuid>")
def get_or_create_config(uuid):
    path = os.path.join(CONFIG_DIR, f"{uuid}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(DEFAULT_CONFIG, f, indent=2)
    return jsonify(DEFAULT_CONFIG)

# ------------------ Module API ------------------
@app.route('/api/<string:page>')
def get_module(page):
    filename = secure_filename(f'{page}.json')
    file_path = os.path.join(MODULES_DIR, filename)
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({'error': 'not found'}), 404

@app.route('/api/check')
def check_files():
    return jsonify({
        'module1': os.path.exists(os.path.join(MODULES_DIR, 'module1.json')),
        'module2': os.path.exists(os.path.join(MODULES_DIR, 'module2.json'))
    })

# ------------------ Event parsing ------------------
def parse_event_date(value: str) -> date:
    if "T" in value:
        if "." in value:
            value = value.split(".")[0]
        return datetime.fromisoformat(value).date()
    return date.fromisoformat(value)

# ------------------ Events API ------------------
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
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as exc:
                print(f"Failed to load {path}: {exc}")
        return []

    all_events = load_events(internal_events_path) + load_events(google_events_path) + load_events(microsoft_events_path)

    filtered_events = []
    for event in all_events:
        try:
            start = parse_event_date(event.get("start")) if event.get("start") else None
            end = parse_event_date(event.get("end")) if event.get("end") else start
        except Exception as e:
            print(f"Skipping invalid event {event.get('id')}: {e}")
            continue
        if start and end and start <= date_to and end >= date_from:
            filtered_events.append(event)
    return jsonify(filtered_events)

@app.route('/api/save/event', methods=['POST'])
def save_event():
    file_path = os.path.join(EVENTS_DIR, 'internal.json')
    new_event = request.get_json()
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                events = json.load(f)
            if not isinstance(events, list):
                events = []
        except:
            events = []
    else:
        events = []
    events.append(new_event)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
    except Exception as exc:
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
    events = []
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                events = json.load(f)
            if not isinstance(events, list):
                events = []
        except Exception as exc:
            return jsonify({"status": "error", "message": str(exc)}), 500
    new_events = [ev for ev in events if ev.get("id") != event_id]
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(new_events, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500
    create_state()
    return jsonify({"status": "deleted", "id": event_id})

# ------------------ State ------------------
def create_state():
    today = date.today()
    paths = [os.path.join(EVENTS_DIR, f"{f}.json") for f in ["internal", "google", "microsoft"]]

    all_events = []
    for p in paths:
        if os.path.exists(p):
            try:
                all_events.extend(json.load(open(p, "r", encoding="utf-8")))
            except Exception as exc:
                print(f"Failed to load {p}: {exc}")

    todays_events = []
    for event in all_events:
        try:
            start = parse_event_date(event.get("start")) if event.get("start") else None
            end = parse_event_date(event.get("end")) if event.get("end") else start
        except Exception as exc:
            continue
        if start and end and start <= today <= end:
            time_str = event.get("start", "00:00")
            if "T" in time_str:
                time_str = time_str.split("T")[1][:5]
            else:
                time_str = "00:00"
            todays_events.append({"time": time_str, "event": event.get("name", "Unnamed Event")})
    state = {"events": todays_events}
    try:
        with open(os.path.join(EVENTS_DIR, "state.json"), "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"Failed to write state.json: {exc}")

# ------------------ Integration status ------------------

@app.route("/api/integration-status/<service>", methods=["GET"])
def get_integration_status(service):
    if service not in integration_status:
        return jsonify({"error": "Unknown service"}), 400
    return jsonify({"service": service, "integrated": integration_status[service]})

# ------------------ Layout API ------------------
@app.route('/api/layout', methods=['GET'])
def get_layout():
    file_path = os.path.join(LAYOUT_DIR, 'layout.json')
    if not os.path.exists(file_path):
        return jsonify({"elements": []})
    with open(file_path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

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

# ------------------ Automations API ------------------
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

# ------------------ Google Integration ------------------
if Credentials:
    GOOGLE_CLIENT_FILE = os.path.join(CREDENTIALS_DIR, "google_secret.json")
    GOOGLE_SESSION_FILE = os.path.join(CREDENTIALS_DIR, "google_session.json")
    GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
    google_creds = None

    if os.path.exists(GOOGLE_CLIENT_FILE):
        with open(GOOGLE_CLIENT_FILE, "r", encoding="utf-8") as f:
            GOOGLE_CLIENT = json.load(f).get("installed")
    else:
        GOOGLE_CLIENT = None

    def _load_google_session():
        """Load persisted session JSON (device_code / tokens). Returns dict."""
        if os.path.exists(GOOGLE_SESSION_FILE):
            try:
                with open(GOOGLE_SESSION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data if isinstance(data, dict) else {}
            except Exception:
                return {}
        return {}

    def _google_creds_from_session(sess: dict):
        """Build Credentials from session dict, or None if incomplete."""
        if not sess or not sess.get("access_token"):
            return None
        if not GOOGLE_CLIENT:
            return None
        return Credentials(
            sess["access_token"],
            refresh_token=sess.get("refresh_token"),
            token_uri=sess.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=sess.get("client_id", GOOGLE_CLIENT["client_id"]),
            client_secret=sess.get("client_secret", GOOGLE_CLIENT["client_secret"]),
            scopes=sess.get("scopes", GOOGLE_SCOPES),
        )

    def _save_google_session(data):
        os.makedirs(CREDENTIALS_DIR, exist_ok=True)
        sess = _load_google_session()
        sess.update(data or {})
        with open(GOOGLE_SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(sess, f, indent=2, ensure_ascii=False)

    def _google_time_to_str(value):
        # Google returns {"dateTime": "..."} or {"date": "..."}; keep a string for parse_event_date()
        if isinstance(value, dict):
            return value.get("dateTime") or value.get("date")
        return value

    @app.route("/api/auth_google/login")
    def api_google_login():
        global google_creds
        if not GOOGLE_CLIENT:
            return jsonify({"error": f"Missing Google client secrets at {GOOGLE_CLIENT_FILE}"}), 400

        sess = _load_google_session()
        google_creds = google_creds or _google_creds_from_session(sess)
        if google_creds:
            return jsonify({"status": "already_authenticated"})

        resp = requests.post(
            "https://oauth2.googleapis.com/device/code",
            data={"client_id": GOOGLE_CLIENT["client_id"], "scope": " ".join(GOOGLE_SCOPES)},
            timeout=30,
        ).json()
        if "device_code" not in resp:
            return jsonify({"error": resp}), 400

        _save_google_session({"device_code": resp["device_code"], "interval": resp.get("interval", 5)})

        return jsonify({
            "verification_uri": resp.get("verification_url") or resp.get("verification_uri"),
            "user_code": resp.get("user_code"),
            "expires_in": resp.get("expires_in"),
            "interval": resp.get("interval", 5),
        })

    @app.route("/api/auth_google/logout")
    def api_google_logout():
        global google_creds
        google_creds = None
        for path in (GOOGLE_SESSION_FILE, os.path.join(EVENTS_DIR, "google.json")):
            if os.path.exists(path):
                os.remove(path)
        integration_status["google"] = False
        create_state()
        return jsonify({"status": "logged_out"})

    @app.route("/api/auth_google/poll")
    def api_google_poll():
        global google_creds
        if not GOOGLE_CLIENT:
            return jsonify({"error": f"Missing Google client secrets at {GOOGLE_CLIENT_FILE}"}), 400

        sess = _load_google_session()
        device_code = sess.get("device_code")
        interval = int(sess.get("interval") or 5)
        if not device_code:
            return jsonify({"error": "Start auth first via /api/auth_google/login."}), 400

        start_time = time.time()
        token_resp = None
        while time.time() - start_time < 360:
            token_resp = requests.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT["client_id"],
                    "client_secret": GOOGLE_CLIENT["client_secret"],
                    "device_code": device_code,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                },
                timeout=30,
            ).json()
            if "error" in token_resp and token_resp["error"] in ["authorization_pending", "slow_down"]:
                time.sleep(interval)
                continue
            break

        if not token_resp or "access_token" not in token_resp:
            return jsonify(token_resp or {"error": "Unknown error"}), 400

        # Persist a complete session so we can rebuild creds later
        _save_google_session({
            "access_token": token_resp["access_token"],
            "refresh_token": token_resp.get("refresh_token"),
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": GOOGLE_CLIENT["client_id"],
            "client_secret": GOOGLE_CLIENT["client_secret"],
            "scopes": GOOGLE_SCOPES,
            "device_code": None,
            "interval": None,
        })

        google_creds = _google_creds_from_session(_load_google_session())
        integration_status["google"] = True
        return jsonify({"status": "ok"})

    @app.route("/api/auth_google/events")
    def api_google_events():
        global google_creds
        if not GOOGLE_CLIENT:
            return jsonify({"error": f"Missing Google client secrets at {GOOGLE_CLIENT_FILE}"}), 400

        google_creds = google_creds or _google_creds_from_session(_load_google_session())
        if not google_creds:
            return jsonify({"error": "Authenticate first"}), 400

        service = build("calendar", "v3", credentials=google_creds)

        events = []
        calendars = service.calendarList().list().execute().get("items", [])
        for cal in calendars:
            page_token = None
            while True:
                resp = (
                    service.events()
                    .list(
                        calendarId=cal["id"],
                        singleEvents=True,
                        orderBy="startTime",
                        pageToken=page_token,
                        maxResults=2500,
                        showDeleted=False,
                    )
                    .execute()
                )
                events.extend(resp.get("items", []))
                page_token = resp.get("nextPageToken")
                if not page_token:
                    break

        simple_events = [{
            "id": e.get("id"),
            "name": e.get("summary") or "Unnamed Event",
            "start": _google_time_to_str(e.get("start")),
            "end": _google_time_to_str(e.get("end")) or _google_time_to_str(e.get("start")),
        } for e in events]

        filename = os.path.join(EVENTS_DIR, "google.json")
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(simple_events, f, indent=2, ensure_ascii=False)

        create_state()
        return jsonify({"status": "saved", "count": len(simple_events)})

# ------------------ Microsoft Integration ------------------
MS_CLIENT_FILE = os.path.join(CREDENTIALS_DIR, "microsoft_secret.json")
MS_SESSION_FILE = os.path.join(CREDENTIALS_DIR, "microsoft_session.json")
MS_CLIENT, MS_SCOPES, MS_TENANT = "", "", "common"
if os.path.exists(MS_CLIENT_FILE):
    with open(MS_CLIENT_FILE, "r", encoding="utf-8") as f:
        cfg = json.load(f)
        MS_CLIENT = cfg.get("client_id", "")
        MS_SCOPES = cfg.get("scopes", "")

def _load_ms_session():
    if os.path.exists(MS_SESSION_FILE):
        with open(MS_SESSION_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def _save_ms_session(data):
    os.makedirs(CREDENTIALS_DIR, exist_ok=True)
    with open(MS_SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route("/api/auth_microsoft/login")
def api_ms_login():
    sess = _load_ms_session()
    if sess.get("access_token"):
        return jsonify({"status": "already_authenticated"})
    resp = requests.post(f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/devicecode",
                         data={"client_id": MS_CLIENT, "scope": MS_SCOPES}).json()
    sess.update({"device_code": resp["device_code"], "interval": resp.get("interval", 5)})
    _save_ms_session(sess)
    return jsonify({
        "verification_uri": resp.get("verification_uri"),
        "user_code": resp.get("user_code"),
        "expires_in": resp.get("expires_in"),
        "interval": resp.get("interval", 5),
    })

@app.route("/api/auth_microsoft/logout")
def logout():
    if os.path.exists(MS_SESSION_FILE):
        os.remove(MS_SESSION_FILE)
        integration_status["microsoft"] = False
        return jsonify({"status": "logged_out", "message": "Sesja została usunięta."})
    return jsonify({"status": "no_session", "message": "Brak pliku microsoft_session.json."}), 200

@app.route("/api/auth_microsoft/poll")
def api_ms_poll():
    sess = _load_ms_session()
    device_code, interval = sess.get("device_code"), sess.get("interval", 5)
    if not device_code:
        return jsonify({"error": "Start login first"}), 400
    resp = requests.post(f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/token",
                         data={"grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                               "client_id": MS_CLIENT, "device_code": device_code}).json()
    if "access_token" in resp:
        sess.update({"device_code": None, "interval": None, "access_token": resp["access_token"]})
        _save_ms_session(sess)
        integration_status["microsoft"] = True
        return jsonify({"status": "authenticated"})
    return jsonify(resp)

@app.route("/api/auth_microsoft/events")
def api_ms_events():
    sess = _load_ms_session()
    token = sess.get("access_token")
    if not token:
        return jsonify({"error": "Authenticate first"}), 401

    headers = {"Authorization": f"Bearer {token}"}

    all_items = []
    url = "https://graph.microsoft.com/v1.0/me/events"
    params = {"$top": "1000"}  # Graph caps per page; nextLink will paginate
    while True:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        data = resp.json()
        if resp.status_code >= 400:
            return jsonify({"error": data, "status_code": resp.status_code}), resp.status_code

        all_items.extend(data.get("value", []))
        next_link = data.get("@odata.nextLink")
        if not next_link:
            break
        url = next_link
        params = None  # nextLink already contains query params

    simple_events = [{
        "id": e.get("id"),
        "name": e.get("subject"),
        "start": (e.get("start") or {}).get("dateTime"),
        "end": (e.get("end") or {}).get("dateTime"),
    } for e in all_items]

    filename = os.path.join(EVENTS_DIR, "microsoft.json")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(simple_events, f, indent=2, ensure_ascii=False)

    create_state()
    return jsonify(simple_events)

# ------------------ Run ------------------
if __name__ == "__main__":
    for d in [MODULES_DIR, CONFIG_DIR, EVENTS_DIR, LAYOUT_DIR, AUTOMATIONS_DIR, CREDENTIALS_DIR]:
        os.makedirs(d, exist_ok=True)
    create_state()
    app.run(host='0.0.0.0', port=5000, debug=True)
