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
        locale: 'pl',
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
            extendedProps: { id: ev.id, location: ev.location }
        });
    });
}

// --- remove event ---
function removeEvent(id) {
    events = events.filter(e => e.id !== id);
    renderEventList();

    fetch("/api/save/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ service })
            });

            refreshIndicators();
        });
    });

    refreshIndicators();
});

/* --- LAYOUT CREATOR PAGE --- */
const workspace = document.getElementById('workspace');
let widgetCount = 0;
let draggedType = null;

// --- Drag start z panelu górnego ---
document.querySelectorAll('.widget-item').forEach(item => {
    item.addEventListener('dragstart', e => {
        draggedType = e.target.dataset.type;
    });
});

// --- Drop na workspace ---
workspace.addEventListener('dragover', e => e.preventDefault());
workspace.addEventListener('drop', e => {
    e.preventDefault();
    if (!draggedType) return;

    const widget = document.createElement('div');
    widget.className = 'widget';
    widget.id = 'widget' + widgetCount++;
    widget.style.left = e.offsetX + 'px';
    widget.style.top = e.offsetY + 'px';
    widget.style.width = '150px';
    widget.style.height = '150px';

    switch(draggedType) {
        case 'events':
            widget.innerHTML = '<strong>Lista Eventów</strong><ul><li>Event 1</li><li>Event 2</li></ul>';
            break;
        case 'digitalClock':
            widget.innerHTML = '<div id="digital'+widget.id+'">00:00:00</div>';
            setInterval(() => {
                const now = new Date();
                document.getElementById('digital'+widget.id).innerText = now.toLocaleTimeString();
            }, 1000);
            break;
        case 'analogClock':
            widget.innerHTML = '<canvas width="100" height="100"></canvas>';
            drawAnalogClock(widget.querySelector('canvas'));
            setInterval(() => drawAnalogClock(widget.querySelector('canvas')), 1000);
            break;
        case 'text':
            widget.innerHTML = 'Twój tekst...';
            widget.contentEditable = true;
            break;
        case 'calendar':
            const calDiv = document.createElement('div');
            calDiv.id = 'fc-' + widget.id;
            widget.appendChild(calDiv);
            workspace.appendChild(widget); // musimy dodać przed renderem FullCalendar
            const calendar = new FullCalendar.Calendar(calDiv, {
                initialView: 'dayGridMonth',
                height: '100%',
                contentHeight: '100%',
                expandRows: true
            });
            calendar.render();
            makeDraggableResizable(widget, calendar);
            draggedType = null;
            return; // wyjście, bo widget już dodany
    }

    workspace.appendChild(widget);
    makeDraggableResizable(widget);
    draggedType = null;
});

// --- Funkcja do draggable + resizable ---
function makeDraggableResizable(el, calendar=null) {
    // --- Draggable ---
    let offsetX, offsetY, isDragging = false;
    el.addEventListener('mousedown', e => {
        if (e.target.classList.contains('resizer')) return;
        isDragging = true;
        offsetX = e.clientX - el.offsetLeft;
        offsetY = e.clientY - el.offsetTop;
        el.style.borderColor = '#2980b9';
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        el.style.borderColor = '#7f8c8d';
    });
    document.addEventListener('mousemove', e => {
        if (isDragging) {
            el.style.left = e.clientX - offsetX + 'px';
            el.style.top = e.clientY - offsetY + 'px';
        }
    });

    // --- Resizable ---
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    el.appendChild(resizer);

    let isResizing = false;
    resizer.addEventListener('mousedown', e => {
        e.stopPropagation();
        isResizing = true;
        document.addEventListener('mousemove', resizeMove);
        document.addEventListener('mouseup', resizeStop);
    });

    function resizeMove(e) {
        if (!isResizing) return;
        const rect = el.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        const newHeight = e.clientY - rect.top;
        if (newWidth > 50) el.style.width = newWidth + 'px';
        if (newHeight > 30) el.style.height = newHeight + 'px';

        // Aktualizacja FullCalendar przy resize
        if (calendar) {
            calendar.setOption('height', el.clientHeight);
            calendar.setOption('contentHeight', el.clientHeight);
        }

        // Aktualizacja canvas analog clock
        const canvas = el.querySelector('canvas');
        if (canvas) {
            canvas.width = el.clientWidth - 20; // padding
            canvas.height = el.clientHeight - 20;
            drawAnalogClock(canvas);
        }
    }

    function resizeStop() {
        isResizing = false;
        document.removeEventListener('mousemove', resizeMove);
        document.removeEventListener('mouseup', resizeStop);
    }
}

// --- Analog clock ---
function drawAnalogClock(canvas) {
    const ctx = canvas.getContext('2d');
    const radius = Math.min(canvas.width, canvas.height) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width/2, canvas.height/2);

    ctx.beginPath();
    ctx.arc(0, 0, radius-2, 0, 2*Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    ctx.stroke();

    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes();
    const hr = now.getHours() % 12;

    // Hour
    ctx.save();
    ctx.rotate((Math.PI/6)*hr + (Math.PI/360)*min + (Math.PI/21600)*sec);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(0, -radius/2);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Minute
    ctx.save();
    ctx.rotate((Math.PI/30)*min + (Math.PI/1800)*sec);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(0, -radius*0.7);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Second
    ctx.save();
    ctx.rotate((Math.PI/30)*sec);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(0, -radius*0.9);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.translate(-canvas.width/2, -canvas.height/2);
}
