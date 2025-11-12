from flask import Flask, render_template, jsonify, request
import os
import json
from enum import Enum
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', template_folder='templates')

MODULES_DIR = 'modules'
EVENTS_DIR = 'events'


class ModuleType(str, Enum):
    KEYPAD = "keypad"
    KNOB_ARRAY = "knob_array"


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


@app.route('/api/save/<string:page>', methods=['POST'])
def save_module(page):
    file_path = f'modules/{page}.json'
    data = request.get_json()
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)
    return jsonify({'status': 'saved'})

@app.route('/api/events')
def get_events():
    file_path = os.path.join(EVENTS_DIR, 'events.json')
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify([])  # pusty array jeśli brak

@app.route('/api/save/events', methods=['POST'])
def save_events():
    file_path = os.path.join(EVENTS_DIR, 'internal.json')
    data = request.get_json()
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    return jsonify({'status': 'saved'})



if __name__ == '__main__':
    os.makedirs(MODULES_DIR, exist_ok=True)
    app.run(debug=True)
