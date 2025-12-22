// --- SETTINGS PAGE ---
async function refreshIndicators() {
    const services = ["microsoft", "google"];

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
