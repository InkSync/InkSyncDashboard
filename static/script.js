// --- UI Elements ---
const tab1 = document.getElementById("tab1");
const tab2 = document.getElementById("tab2");
const content = document.getElementById("module-content");

let currentModule = null;
let currentData = null;
let activePage = null; // startowo brak aktywnej zakładki

document.addEventListener("DOMContentLoaded", () => {
    checkFiles();
    setInterval(checkFiles, 1000); // co sekundę aktualizujemy taby
});

// --- Check if JSON files exist ---
async function checkFiles() {
    try {
        const res = await fetch('/api/check');
        const data = await res.json();

        updateTab(tab1, data.module1, "module1");
        updateTab(tab2, data.module2, "module2");
    } catch (err) {
        console.error("Error checking modules:", err);
    }
}

// --- Update individual tab ---
async function updateTab(tab, available, page) {
    tab.classList.remove("enabled", "disabled", "active");

    if (available) {
        tab.classList.add("enabled");

        // nadajemy active tylko jeśli to current activePage
        if (activePage === page) {
            tab.classList.add("active");
        }

        tab.onclick = async () => {
            activePage = page;       // ustawiamy activePage po kliknięciu
            setActiveTab(tab);       // zmienia klasę active
            await loadModule(page);  // ładujemy moduł
        };

        // pobierz device_name jeśli możliwe
        try {
            const res = await fetch(`/api/${page}`);
            if (res.ok) {
                const moduleData = await res.json();
                tab.textContent = moduleData.device_name || page;
            } else {
                tab.textContent = page;
            }
        } catch {
            tab.textContent = page;
        }
    } else {
        tab.classList.add("disabled");
        tab.onclick = null;
        tab.textContent = page;
    }
}

// --- Set active tab appearance po kliknięciu ---
function setActiveTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
}

// --- Load module specs from JSON + module config ---
async function loadModule(page) {
    try {
        const res = await fetch(`/api/${page}`);
        if (!res.ok) {
            content.innerHTML = `<p class="empty">Could not load ${page}.json</p>`;
            return;
        }

        const data = await res.json();
        currentModule = page;
        currentData = structuredClone(data);

        // --- Load configuration using UUID ---
        let config = null;
        if (data.uuid) {
            const cfgRes = await fetch(`/api/config/${data.uuid}`);
            if (cfgRes.ok) {
                config = await cfgRes.json();
            }
        }

        renderSpecs(currentData, config);

    } catch (err) {
        content.innerHTML = `<p class="empty">Error loading data.</p>`;
        console.error(err);
    }
}

function renderSpecs(data, config) {
    if (!data || Object.keys(data).length === 0) {
        content.innerHTML = `<p class="empty">No data available for this module.</p>`;
        return;
    }

    let html = "";

    // --- Module info ---
    html += `
    <div class="info-section">
        <h3>Module Information</h3>
        <table class="info-table">
            <tr><td>Module Type</td><td>${data.module_type}</td></tr>
            <tr><td>Device Name</td><td>${data.device_name}</td></tr>
            <tr><td>UUID</td><td>${data.uuid}</td></tr>
            <tr><td>Slot</td><td>${data.slot}</td></tr>
            <tr><td>Manufacturer</td><td>${data.manufacturer}</td></tr>
            <tr><td>Firmware Version</td><td>${data.fw_version}</td></tr>
        </table>
    </div>`;

    // --- Configuration display (read-only) ---
    if (config && Object.keys(config).length > 0) {
        html += `
        <div class="info-section">
            <h3>Module Configuration</h3>
            <table class="info-table">
                ${Object.entries(config).map(([key, arr]) => `
                    <tr>
                        <td>${key}</td>
                        <td>${arr.join(", ")}</td>
                    </tr>
                `).join("")}
            </table>
        </div>`;
    }

    content.innerHTML = html;

    // --- Update tab label to device name if active ---
    const activeTab = document.querySelector(".tab.active");
    if (activeTab && data.device_name) {
        activeTab.textContent = data.device_name;
    }
}

// --- Events ---
let events = [];
let calendar;

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("calendar")) {
        initEventsPage();
        fetchEventsFromServer();
    }
});

function initEventsPage() {
    const calendarEl = document.getElementById("calendar");

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        selectable: true,
        editable: false,
        locale: 'en-us',
        height: "100%",
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
        },
        events: events,
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        dateClick(info) {
            openAddEventPopup(info.dateStr);
        },
        eventClick(info) {
            if (confirm(`Delete event "${info.event.title}"?`)) {
                removeEvent(info.event.extendedProps.id);
            }
        }
    });

    calendar.render();
    document.querySelector(".add-event-btn").onclick = () => openAddEventPopup();
}

// --- fetch events from Flask ---
function fetchEventsFromServer() {
    fetch("/api/events")
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                events = data;
                renderEventList();
                renderCalendarEvents();
            } else {
                console.error("Unexpected response from server:", data);
            }
        })
        .catch(err => console.error("Error fetching events:", err));
}

// --- render list of events ---
function renderEventList() {
    const tbody = document.querySelector("#events-table tbody");
    tbody.innerHTML = "";
    events.forEach(event => {
        const tr = document.createElement("tr");

        const startStr = event.allDay
            ? new Date(event.start).toLocaleDateString()
            : formatDateTime(event.start);

        const endStr = event.allDay
            ? new Date(event.end).toLocaleDateString()
            : formatDateTime(event.end);

        tr.innerHTML = `
            <td>${event.name}</td>
            <td>${event.location}</td>
            <td>${startStr}</td>
            <td>${endStr}</td>
            <td>${event.allDay ? "Yes" : "No"}</td>
            <td>
                <button onclick="removeEvent('${event.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    renderCalendarEvents();
}

function renderCalendarEvents() {
    if (!calendar) return;
    calendar.removeAllEvents();
    events.forEach(ev => {
        calendar.addEvent({
            title: ev.name,
            start: ev.start,
            end: ev.end,
            allDay: ev.allDay,
            extendedProps: {id: ev.id, location: ev.location}
        });
    });
}

// --- remove event ---
function removeEvent(id) {
    events = events.filter(e => e.id !== id);
    renderEventList();

    fetch("/api/save/events", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(events)
    }).catch(err => console.error("Error saving events after delete:", err));
}

// --- format date time ---
function formatDateTime(dt) {
    const d = new Date(dt);
    return d.toLocaleString();
}

// --- popup to add new event ---
function openAddEventPopup(defaultDate = "") {
    const popup = document.createElement("div");
    popup.classList.add("popup");
    popup.innerHTML = `
        <div class="popup-content">
            <h3>Add Event</h3>
            <label>Name: <input type="text" id="event-name"></label>
            <label>Location: <input type="text" id="event-location"></label>
            <label>All Day: <input type="checkbox" id="event-allday"></label>
            <label>Start: <input type="datetime-local" id="event-start" value="${defaultDate ? defaultDate + 'T00:00' : ''}"></label>
            <label>End: <input type="datetime-local" id="event-end" value="${defaultDate ? defaultDate + 'T23:59' : ''}"></label>

            <div class="popup-actions">
                <button id="save-event-btn">Save</button>
                <button id="cancel-event-btn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const startInput = document.getElementById("event-start");
    const endInput = document.getElementById("event-end");
    const allDayCheckbox = document.getElementById("event-allday");

    allDayCheckbox.addEventListener("change", () => {
        if (allDayCheckbox.checked) {
            startInput.type = "date";
            endInput.type = "date";
        } else {
            startInput.type = "datetime-local";
            endInput.type = "datetime-local";
        }
    });

    document.getElementById("cancel-event-btn").onclick = () => popup.remove();

    document.getElementById("save-event-btn").onclick = () => {
        const name = document.getElementById("event-name").value.trim();
        const location = document.getElementById("event-location").value.trim();
        const start = startInput.value;
        const end = endInput.value;
        const allDay = allDayCheckbox.checked;

        if (!name || !location || !start || !end) {
            alert("Please fill all fields.");
            return;
        }
        if (!allDay && new Date(start) > new Date(end)) {
            alert("Start date/time cannot be after end date/time.");
            return;
        }

        const newEvent = {
            id: crypto.randomUUID(),
            name,
            location,
            start,
            end,
            allDay
        };

        events.push(newEvent);
        renderEventList();

        fetch("/api/save/events", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(events)
        }).catch(err => console.error("Error saving events:", err));

        popup.remove();
    };
}

// --- SETTINGS PAGE ---
async function refreshIndicators() {
    const services = ["microsoft", "apple", "google"];

    for (const s of services) {
        const res = await fetch(`/api/integration-status/${s}`);
        const data = await res.json();
        const indicator = document.getElementById(`indicator-${s}`);

        if (data.integrated === true) {
            indicator.classList.add("active");
        } else {
            indicator.classList.remove("active");
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".integration-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const service = btn.dataset.service;

            await fetch("/api/integrate", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({service})
            });

            refreshIndicators();
        });
    });

    refreshIndicators();
});

/* --- LAYOUT CREATOR PAGE --- */
const workspace = document.getElementById("workspace") || document.querySelector(".layout-workspace");
const toolbarItems = document.querySelectorAll(".widget-item");

const GRID_SIZE = 20;
let currentDraggedType = null;

/* ---- Drag start from toolbar ---- */
toolbarItems.forEach(item => {
    if (item.dataset.type) {            // tylko prawdziwe elementy, nie przycisk zapisu
        item.addEventListener("dragstart", e => {
            currentDraggedType = e.target.dataset.type;
        });
    }
});

/* ---- Allow dropping on workspace ---- */
workspace.addEventListener("dragover", e => e.preventDefault());

workspace.addEventListener("drop", e => {
    e.preventDefault();
    if (!currentDraggedType) return;

    const rect = workspace.getBoundingClientRect();

    let x = Math.round((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    let y = Math.round((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;

    createWidget(currentDraggedType, x, y);
    currentDraggedType = null;
});

/* ---- Create widget (drag‑drop) ---- */
function createWidget(type, x, y) {
    const widget = document.createElement("div");
    widget.classList.add("widget", `widget-${type}`);
    widget.dataset.type = type;
    widget.style.left = `${x}px`;
    widget.style.top = `${y}px`;
    widget.style.width = "200px";
    widget.style.height = "120px";

    switch (type) {
        case "events":
            /* ----------  Event list (English)  --------- */
            widget.innerHTML = "<b>Event List</b>";
            const ul = document.createElement('ul');
            ul.className = 'event-list';
            const sampleEvents = [
                "Meeting with team – 10:00",
                "Lunch – 12:30",
                "Project presentation – 15:45",
                "Interview – 18:20"
            ];
            sampleEvents.forEach(e => {
                const li = document.createElement('li');
                li.textContent = e;
                ul.appendChild(li);
            });
            widget.appendChild(ul);
            break;

        case "digitalClock":
            widget.innerHTML = "<b>Digital Clock</b><div class='clock-digital'></div>";
            startDigitalClock(widget);
            break;

        case "analogClock":
            widget.innerHTML = "<b>Analog Clock</b>";
            break;

        case "text":
            widget.innerHTML =
                "<b>Text</b>" +
                "<textarea class='widget-textarea' style='width:100%;height:calc(100% - 30px);'></textarea>";
            break;


        case "calendar":
            widget.innerHTML = "<b>Calendar</b>" + generateCalendar();
            break;
    }

    addResizeHandle(widget);
    enableDragging(widget);
    addCloseButton(widget);           // close button

    workspace.appendChild(widget);
}

/* ---- Create widget from saved layout JSON (English titles) ---- */
function createWidgetFromLayout(elem) {
    const type = elem.type || 'calendar';
    const widget = document.createElement("div");
    widget.classList.add("widget", `widget-${type}`);
    widget.dataset.type = type;
    widget.style.left = `${elem.x}px`;
    widget.style.top = `${elem.y}px`;
    widget.style.width = `${elem.width || 200}px`;
    widget.style.height = `${elem.height || 120}px`;

    /* optional font size */
    if (elem.font && elem.font.size) {
        widget.style.fontSize = `${elem.font.size}px`;
    }

    switch (type) {
        case "events":
            widget.innerHTML = "<b>Event List</b>";
            const ul = document.createElement('ul');
            ul.className = 'event-list';
            const sampleEvents = [
                "Meeting with team – 10:00",
                "Lunch – 12:30",
                "Project presentation – 15:45",
                "Interview – 18:20"
            ];
            sampleEvents.forEach(e => {
                const li = document.createElement('li');
                li.textContent = e;
                ul.appendChild(li);
            });
            widget.appendChild(ul);
            break;
        case "digitalClock":   // map “time” → “digitalClock”
        case "time":
            widget.innerHTML = "<b>Digital Clock</b><div class='clock-digital'></div>";
            startDigitalClock(widget);
            break;
        case "analogClock":
            widget.innerHTML = "<b>Analog Clock</b>";
            break;
        case "text":
            widget.innerHTML =
                "<b>Text</b>" +
                "<textarea class='widget-textarea' style='width:100%;height:calc(100% - 30px);'></textarea>";
            if (elem.content) {
                const ta = widget.querySelector('.widget-textarea');
                ta.value = elem.content;
            }
            break;
        case "calendar":
            widget.innerHTML = "<b>Calendar</b>" + generateCalendar();
            break;
    }

    addResizeHandle(widget);
    enableDragging(widget);
    addCloseButton(widget);

    workspace.appendChild(widget);
}

/* ---- Resizing ---- */
function addResizeHandle(widget) {
    const handle = document.createElement("div");
    handle.classList.add("resize-handle");

    let resizing = false, startX, startY, startW, startH;

    handle.addEventListener("mousedown", e => {
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = widget.offsetWidth;
        startH = widget.offsetHeight;
        e.stopPropagation();
    });

    document.addEventListener("mousemove", e => {
        if (!resizing) return;

        let newW = startW + (e.clientX - startX);
        let newH = startH + (e.clientY - startY);

        newW = Math.max(60, newW);
        newH = Math.max(40, newH);
        newW = Math.round(newW / GRID_SIZE) * GRID_SIZE;
        newH = Math.round(newH / GRID_SIZE) * GRID_SIZE;

        widget.style.width = `${newW}px`;
        widget.style.height = `${newH}px`;
    });

    document.addEventListener("mouseup", () => {
        resizing = false;
    });

    widget.appendChild(handle);
}

/* ---- Dragging inside workspace ---- */
function enableDragging(widget) {
    let dragging = false, offsetX, offsetY;

    widget.addEventListener("mousedown", e => {
        if (e.target.classList.contains('resize-handle')) return;
        dragging = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
    });

    document.addEventListener("mousemove", e => {
        if (!dragging) return;
        const rect = workspace.getBoundingClientRect();

        let x = e.clientX - rect.left - offsetX;
        let y = e.clientY - rect.top - offsetY;

        x = Math.round(x / GRID_SIZE) * GRID_SIZE;
        y = Math.round(y / GRID_SIZE) * GRID_SIZE;

        x = Math.max(0, Math.min(x, workspace.clientWidth - widget.offsetWidth));
        y = Math.max(0, Math.min(y, workspace.clientHeight - widget.offsetHeight));

        widget.style.left = `${x}px`;
        widget.style.top = `${y}px`;
    });

    document.addEventListener("mouseup", () => {
        dragging = false;
    });
}

/* ---- Close button helper ---- */
function addCloseButton(widget) {
    const btn = document.createElement('span');
    btn.classList.add('widget-close');
    btn.innerHTML = '&times;';
    btn.addEventListener('click', e => {
        e.stopPropagation();
        widget.remove();
    });
    widget.appendChild(btn);
}

/* ---- Digital clock logic (already present) ---- */
function startDigitalClock(widget) {
    const display = widget.querySelector('.clock-digital');

    function tick() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        display.textContent = `${hh}:${mm}`;

        /* dynamic font‑size relative to widget size */
        const w = widget.clientWidth;
        const h = widget.clientHeight;
        const base = Math.min(w, h) / 2;   // 4 → większa czcionka
        display.style.fontSize = `${base}px`;
    }

    tick();
    setInterval(tick, 1000);
}

/* ---- Analog clock logic (already present) ---- */
function startAnalogClock(widget) {
    function update() {
        const now = new Date();
        const sec = now.getSeconds();
        const min = now.getMinutes();
        const hour = (now.getHours() % 12) + min / 60;

        const secDeg = sec * 6;
        const minDeg = min * 6 + sec * 0.1;
        const hourDeg = hour * 30;

        widget.querySelector('.clock-hour').style.transform = `rotate(${hourDeg}deg)`;
        widget.querySelector('.clock-minute').style.transform = `rotate(${minDeg}deg)`;
        widget.querySelector('.clock-second').style.transform = `rotate(${secDeg}deg)`;
    }

    update();
    setInterval(update, 1000);
}

/* ---- Simple monthly calendar (English month names) ---- */
function generateCalendar() {
    const now = new Date();
    const month = now.toLocaleString('en-US', {month: 'long'});   // ← English
    const year = now.getFullYear();

    let html = `<b>${month} ${year}</b><table><tr>`;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(d => html += `<th>${d}</th>`);
    html += "</tr><tr>";

    const firstDay = (new Date(year, now.getMonth(), 1).getDay() + 6) % 7;
    for (let i = 0; i < firstDay; i++) html += '<td></td>';

    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
        if (d === now.getDate()) {
            html += `<td class="cal-today">${d}</td>`;
        } else {
            html += `<td>${d}</td>`;
        }
        if ((d + firstDay) % 7 === 0) html += "</tr><tr>";
    }

    html += "</tr></table>";
    return html;
}

/* ---- Load layout on page load ---- */
window.addEventListener('DOMContentLoaded', () => {
    fetch('/api/layout')
        .then(r => r.json())
        .then(data => {
            if (data.elements && Array.isArray(data.elements)) {
                data.elements.forEach(el => createWidgetFromLayout(el));
            }
        })
        .catch(err => {
            console.warn('Brak zapisanych layoutów:', err);
        });
});

/* ---- Save current layout on button click ---- */
document.getElementById('saveLayoutBtn').addEventListener('click', () => {
    const elements = [];
    workspace.querySelectorAll('.widget').forEach(widget=>{
        const typeMatch=widget.className.match(/widget-(\w+)/);
        if (!typeMatch) return;
        const type = typeMatch[1];

        const elem = {
            type: type,
            x: parseInt(widget.style.left,10),
            y: parseInt(widget.style.top,10),
            width: widget.offsetWidth,
            height: widget.offsetHeight
        };

        /* ---- capture text content if applicable ---- */
        if (type === 'text') {
            const ta = widget.querySelector('.widget-textarea');
            elem.content = ta ? ta.value : "";
        }

        elements.push(elem);
    });

    const layoutData = {elements};

    fetch('/api/layout', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(layoutData)
    })
    .then(r=>r.json())
    .then(res=>{
        console.log('Layout saved:', res);
        alert('Layout saved!');
    })
    .catch(err=>{
        console.error(err);
        alert('Error saving layout.');
    });
});
