const tab1 = document.getElementById("tab1");
const tab2 = document.getElementById("tab2");
const content = document.getElementById("module-content");

let currentModule = null;
let currentData = null;
let activePage = null;

document.addEventListener("DOMContentLoaded", () => {
    checkFiles();
    setInterval(checkFiles, 1000);
});

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

async function updateTab(tab, available, page) {
    tab.classList.remove("enabled", "disabled", "active");

    if (available) {
        tab.classList.add("enabled");

        if (activePage === page) {
            tab.classList.add("active");
        }

        tab.onclick = async () => {
            activePage = page;
            setActiveTab(tab);
            await loadModule(page);
        };

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

function setActiveTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
}

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

    const activeTab = document.querySelector(".tab.active");
    if (activeTab && data.device_name) {
        activeTab.textContent = data.device_name;
    }
}
