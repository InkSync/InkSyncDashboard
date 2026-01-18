const workspace = document.getElementById("workspace") || document.querySelector(".layout-workspace");
const toolbarItems = document.querySelectorAll(".widget-item");

const GRID_SIZE = 20;
let currentDraggedType = null;

toolbarItems.forEach(item => {
    if (item.dataset.type) {
        item.addEventListener("dragstart", e => {
            currentDraggedType = e.target.dataset.type;
        });
    }
});

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

function createWidget(type, x, y) {
    const widget = document.createElement("div");
    widget.classList.add("widget", `widget-${type}`);
    widget.dataset.type = type;
    widget.style.left = `${x}px`;
    widget.style.top = `${y}px`;
    widget.style.width = "200px";
    widget.style.height = "120px";

    switch (type) {
        case "events": {
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
        }

        case "time":
            widget.innerHTML = "<div class='time'></div>";
            startDigitalClock(widget);
            break;

        case "text":
            widget.innerHTML =
                "<textarea class='widget-textarea' style='width:100%;height:calc(100% - 30px);'></textarea>";
            break;

        case "calendar":
            widget.innerHTML = generateCalendar();
            break;
    }

    addResizeHandle(widget);
    enableDragging(widget);
    addCloseButton(widget);

    workspace.appendChild(widget);
}

function createWidgetFromLayout(elem) {
    const type = elem.type || 'calendar';
    const widget = document.createElement("div");
    widget.classList.add("widget", `widget-${type}`);
    widget.dataset.type = type;
    widget.style.left = `${elem.x}px`;
    widget.style.top = `${elem.y}px`;
    widget.style.width = `${elem.width || 200}px`;
    widget.style.height = `${elem.height || 120}px`;

    if (elem.font && elem.font.size) {
        widget.style.fontSize = `${elem.font.size}px`;
    }

    switch (type) {
        case "events": {
            widget.innerHTML = "";
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
        }
        case "time":
            widget.innerHTML = "<div class='time'></div>";
            startDigitalClock(widget);
            break;
        case "text":
            widget.innerHTML =
                "<textarea class='widget-textarea' style='width:100%;height:calc(100% - 30px);'></textarea>";
            if (elem.content) {
                const ta = widget.querySelector('.widget-textarea');
                ta.value = elem.content;
            }
            break;
        case "calendar":
            widget.innerHTML = generateCalendar();
            break;
    }

    addResizeHandle(widget);
    enableDragging(widget);
    addCloseButton(widget);

    workspace.appendChild(widget);
}

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

function startDigitalClock(widget) {
    const display = widget.querySelector('.time');

    function tick() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        display.textContent = `${hh}:${mm}`;

        const w = widget.clientWidth;
        const h = widget.clientHeight;
        const base = Math.min(w, h) / 2;
        display.style.fontSize = `${base}px`;
    }

    tick();
    setInterval(tick, 1000);
}

function generateCalendar() {
    const now = new Date();
    const month = now.toLocaleString('en-US', {month: 'long'});
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

window.addEventListener('DOMContentLoaded', () => {
    fetch('/api/layout')
        .then(r => r.json())
        .then(data => {
            if (data.elements && Array.isArray(data.elements)) {
                data.elements.forEach(el => createWidgetFromLayout(el));
            }
        })
        .catch(err => {
            console.warn('No saved layouts:', err);
        });
});

document.getElementById('saveLayoutBtn').addEventListener('click', () => {
    const elements = [];
    workspace.querySelectorAll('.widget').forEach(widget => {
        const typeMatch = widget.className.match(/widget-(\w+)/);
        if (!typeMatch) return;
        const type = typeMatch[1];

        const elem = {
            type: type,
            x: parseInt(widget.style.left, 10),
            y: parseInt(widget.style.top, 10),
            text_style: "bold",
            width: widget.offsetWidth,
            height: widget.offsetHeight
        };

        if (type === 'text') {
            const ta = widget.querySelector('.widget-textarea');
            elem.content = ta ? ta.value : "";
        }

        elements.push(elem);
    });

    const layoutData = { elements };

    fetch('/api/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutData)
    })
    .then(r => r.json())
    .then(res => {
        console.log('Layout saved:', res);
        alert('Layout saved!');
    })
    .catch(err => {
        console.error(err);
        alert('Error saving layout.');
    });
});
