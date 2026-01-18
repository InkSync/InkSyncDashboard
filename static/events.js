let calendar;
let currentEvents = [];

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("calendar")) {
        initEventsPage();
    }
});

function initEventsPage() {
    const calendarEl = document.getElementById("calendar");

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        selectable: true,
        editable: false,
        locale: "en-us",
        height: "100%",

        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
        },

        events: fetchEventsForCalendar,

        eventTimeFormat: {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        },

        dateClick(info) {
            openAddEventPopup(info.dateStr);
        },

        eventClick(info) {
            if (confirm(`Delete event "${info.event.title}"?`)) {
                deleteEvent(info.event.extendedProps.id);
            }
        }
    });

    calendar.render();
    document.querySelector(".add-event-btn").onclick = () => openAddEventPopup();
}

function fetchEventsForCalendar(info, successCallback, failureCallback) {
    fetch(`/api/events?from=${info.start.toISOString()}&to=${info.end.toISOString()}`)
        .then(res => res.json())
        .then(data => {
            if (!Array.isArray(data)) {
                throw new Error("Invalid event data");
            }

            currentEvents = data;
            renderEventList();

            successCallback(
                data.map(ev => ({
                    title: ev.name,
                    start: ev.start,
                    end: ev.end,
                    allDay: ev.allDay,
                    extendedProps: {
                        id: ev.id
                    }
                }))
            );
        })
        .catch(err => {
            console.error("Error fetching events:", err);
            failureCallback(err);
        });
}

function renderEventList() {
    const tbody = document.querySelector("#events-table tbody");
    tbody.innerHTML = "";

    currentEvents.forEach(event => {
        const tr = document.createElement("tr");

        const startStr = event.allDay
            ? new Date(event.start).toLocaleDateString()
            : formatDateTime(event.start);

        const endStr = event.allDay
            ? new Date(event.end).toLocaleDateString()
            : formatDateTime(event.end);

        tr.innerHTML = `
            <td>${event.name}</td>
            <td>${startStr}</td>
            <td>${endStr}</td>
            <td>${event.allDay ? "Yes" : "No"}</td>
            <td>
                <button onclick="deleteEvent('${event.id}')">Delete</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function deleteEvent(id) {
    fetch("/api/delete/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    })
    .then(() => calendar.refetchEvents())
    .catch(err => console.error("Error deleting event:", err));
}

function formatDateTime(dt) {
    return new Date(dt).toLocaleString();
}

function uuidv4_time() {
    let t = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (t + Math.random() * 16) % 16 | 0;
        t = Math.floor(t / 16);
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function openAddEventPopup(defaultDate = "") {
    const popup = document.createElement("div");
    popup.classList.add("popup");

    popup.innerHTML = `
        <div class="popup-content">
            <h3>Add an Event</h3>

            <label>Name:
                <input type="text" id="event-name">
            </label>

            <label>
                All Day:
                <input type="checkbox" id="event-allday">
            </label>

            <label>Start:
                <div>
                    <input type="time" id="event-start-time">
                    <input type="date" id="event-start-date" value="${defaultDate}">
                </div>
            </label>

            <label>End:
                <div>
                    <input type="time" id="event-end-time">
                    <input type="date" id="event-end-date" value="${defaultDate}">
                </div>
            </label>

            <div class="popup-actions">
                <button id="save-event-btn">Save</button>
                <button id="cancel-event-btn">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    const startTimeInput = document.getElementById("event-start-time");
    const endTimeInput = document.getElementById("event-end-time");
    const allDayCheckbox = document.getElementById("event-allday");

    allDayCheckbox.addEventListener("change", () => {
        const display = allDayCheckbox.checked ? "none" : "inline-block";
        startTimeInput.style.display = display;
        endTimeInput.style.display = display;
    });

    document.getElementById("cancel-event-btn").onclick = () => popup.remove();

    document.getElementById("save-event-btn").onclick = () => {
        const name = document.getElementById("event-name").value.trim();
        const startDate = document.getElementById("event-start-date").value;
        const endDate = document.getElementById("event-end-date").value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        const allDay = allDayCheckbox.checked;

        if (!name || !startDate || !endDate || (!allDay && (!startTime || !endTime))) {
            alert("Please fill all fields.");
            return;
        }

        const start = allDay ? startDate : `${startDate}T${startTime}`;
        const end = allDay ? endDate : `${endDate}T${endTime}`;

        if (!allDay && new Date(start) > new Date(end)) {
            alert("Start cannot be after end.");
            return;
        }

        const newEvent = {
            id: uuidv4_time(),
            name,
            start,
            end,
            allDay
        };

        fetch("/api/save/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEvent)
        })
        .then(() => calendar.refetchEvents())
        .catch(err => console.error("Error saving event:", err));

        popup.remove();
    };
}
