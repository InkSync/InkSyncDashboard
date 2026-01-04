document.addEventListener("DOMContentLoaded", () => {
    const listEl = document.getElementById("automation-list");
    const countEl = document.getElementById("automation-count");
    const popup = document.getElementById("automation-popup");
    const popupClose = document.getElementById("popup-close");
    const popupTitle = document.getElementById("popup-title");
    const blocksContainer = document.getElementById("editor-blocks");
    const addBlockBtn = document.getElementById("add-block-btn");
    const blockTypeSelect = document.getElementById("block-type-select");
    const saveBtn = document.getElementById("save-automation-btn");
    const cancelBtn = document.getElementById("cancel-automation-btn");
    const deleteBtn = document.getElementById("delete-automation-btn");
    const createBtn = document.getElementById("create-automation-btn");
    const nameInput = document.getElementById("automation-name-input");

    let automations = [];
    let currentAutomation = null;

    function fetchAutomations() {
        fetch("/api/automations")
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    automations = data;
                } else {
                    automations = [];
                }
                renderAutomationList();
            })
            .catch(() => {
                automations = [];
                renderAutomationList();
            });
    }

    function saveAutomationsToServer() {
        return fetch("/api/automations/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(automations)
        }).then(r => r.json());
    }

    function renderAutomationList() {
        listEl.innerHTML = "";
        automations.forEach(auto => {
            const card = document.createElement("div");
            card.className = "automation-card";
            card.dataset.id = auto.id;

            const header = document.createElement("div");
            header.className = "auto-header";

            const titleSpan = document.createElement("span");
            titleSpan.className = "auto-title";
            titleSpan.textContent = auto.name;

            const toggleLabel = document.createElement("label");
            toggleLabel.className = "switch";

            const toggleInput = document.createElement("input");
            toggleInput.type = "checkbox";
            toggleInput.checked = !!auto.enabled;
            toggleInput.addEventListener("click", e => {
                e.stopPropagation();
                auto.enabled = toggleInput.checked;
                saveAutomationsToServer();
            });

            const sliderSpan = document.createElement("span");
            sliderSpan.className = "slider";

            toggleLabel.appendChild(toggleInput);
            toggleLabel.appendChild(sliderSpan);

            header.appendChild(titleSpan);
            header.appendChild(toggleLabel);

            const flow = document.createElement("div");
            flow.className = "auto-flow";
            auto.blocks.forEach((b, idx) => {
                flow.appendChild(makeFlowItem(blockLabel(b)));
                if (idx < auto.blocks.length - 1) {
                    const arrow = document.createElement("div");
                    arrow.className = "flow-arrow";
                    arrow.textContent = "→";
                    flow.appendChild(arrow);
                }
            });

            card.appendChild(header);
            card.appendChild(flow);
            card.addEventListener("click", () => openEditor(auto.id));
            listEl.appendChild(card);
        });
        countEl.textContent = `Automations: ${automations.length}`;
    }

    function makeFlowItem(txt) {
        const d = document.createElement("div");
        d.className = "flow-item";
        d.textContent = txt;
        return d;
    }

    function blockLabel(block) {
        switch (block.type) {
            case "Send a key": return `Send key ${block.config?.key || "?"}`;
            case "Send a command": return `Cmd "${truncate(block.config?.command || "", 14)}"`;
            case "Timeout": return `Timeout ${block.config?.seconds || 0}s`;
            case "Key pressed": return `Key pressed ${block.config?.key || "?"}`;
            case "Web request": return `Web request ${truncate(block.config?.url || "", 24) || "?"}`;
            case "Start":
            case "End":
            default: return block.type;
        }
    }

    function truncate(str, max) {
        return str.length > max ? str.slice(0, max - 1) + "…" : str;
    }

    function openEditor(id) {
        currentAutomation = automations.find(a => a.id === id);
        if (!currentAutomation) return;
        popupTitle.textContent = `Automation: ${currentAutomation.name}`;
        nameInput.value = currentAutomation.name;
        renderBlockEditor();
        popup.classList.remove("hidden");
    }

    nameInput.addEventListener("input", () => {
        if (currentAutomation) {
            const v = nameInput.value.trim();
            currentAutomation.name = v || "Bez nazwy";
            popupTitle.textContent = `Automation: ${currentAutomation.name}`;
        }
    });

    function renderBlockEditor() {
        blocksContainer.innerHTML = "";
        currentAutomation.blocks.forEach(block => {
            blocksContainer.appendChild(renderBlockEntry(block));
        });
    }

    function renderBlockEntry(block) {
        const wrapper = document.createElement("div");
        wrapper.className = "block-entry";
        wrapper.dataset.blockId = block.id;

        const header = document.createElement("div");
        header.className = "block-header";
        header.innerHTML = `<span>${block.type}</span>`;

        const del = document.createElement("button");
        del.className = "block-delete";
        del.textContent = "Delete";
        del.addEventListener("click", () => {
            currentAutomation.blocks = currentAutomation.blocks.filter(b => b.id !== block.id);
            renderBlockEditor();
        });
        header.appendChild(del);

        wrapper.appendChild(header);

        // Config fields
        const cfgDiv = document.createElement("div");

        switch (block.type) {
            case "Send a key": {
                const input = document.createElement("input");
                input.type = "text";
                input.placeholder = "for ex. KEY1 / ENTER";
                input.value = block.config?.key || "";
                input.addEventListener("input", () => block.config.key = input.value.trim());
                cfgDiv.appendChild(input);
                break;
            }
            case "Send a command": {
                const input = document.createElement("input");
                input.type = "text";
                input.placeholder = "Command (for ex. poweroff)";
                input.value = block.config?.command || "";
                input.addEventListener("input", () => block.config.command = input.value);
                cfgDiv.appendChild(input);
                break;
            }
            case "Timeout": {
                const input = document.createElement("input");
                input.type = "number";
                input.min = "0";
                input.placeholder = "Seconds";
                input.value = block.config?.seconds ?? "";
                input.addEventListener("input", () => block.config.seconds = parseInt(input.value || "0", 10));
                cfgDiv.appendChild(input);
                break;
            }
            case "Key pressed": {
                const select = document.createElement("select");
                ["KEY0","KEY1","KEY2","KEY3","KEY4","KEY5","KEY6","KEY7","KEY8"].forEach(k => {
                    const opt = document.createElement("option");
                    opt.value = k;
                    opt.textContent = k;
                    select.appendChild(opt);
                });
                select.value = block.config?.key || "KEY0";
                select.addEventListener("change", () => block.config.key = select.value);
                cfgDiv.appendChild(select);
                break;
            }
            case "Web request": {
                const input = document.createElement("input");
                input.type = "url";
                input.placeholder = "URL (np. https://example.com/hook)";
                input.value = block.config?.url || "";
                input.addEventListener("input", () => {
                    if (!block.config) block.config = {};
                    block.config.url = input.value.trim();
                });
                cfgDiv.appendChild(input);
                break;
            }
        }

        wrapper.appendChild(cfgDiv);
        return wrapper;
    }

    function createAutomation() {
        const id = crypto.randomUUID();
        const auto = {
            id,
            name: `Automation ${automations.length + 1}`,
            enabled: true,
            blocks: []
        };

        automations.push(auto);
        saveAutomationsToServer().then(() => {
            renderAutomationList();
            openEditor(id);
        });
    }

    function addBlock() {
        if (!currentAutomation) return;
        const type = blockTypeSelect.value;
        if (!type) return;

        const insertionIndex = currentAutomation.blocks.length > 0 ? currentAutomation.blocks.length : 0;
        const newBlock = buildBlock(type);
        currentAutomation.blocks.splice(insertionIndex, 0, newBlock);
        blockTypeSelect.value = "";
        renderBlockEditor();
    }

    function buildBlock(type) {
        const base = { id: crypto.randomUUID(), type, config: {} };
        switch (type) {
            case "Send a key": base.config = { key: "" }; break;
            case "Send a command": base.config = { command: "" }; break;
            case "Timeout": base.config = { seconds: 0 }; break;
            case "Key pressed": base.config = { key: "KEY0" }; break;
            case "Web request": base.config = { url: "" }; break;
        }
        return base;
    }

    function deleteAutomation() {
        if (!currentAutomation) return;
        automations = automations.filter(a => a.id !== currentAutomation.id);
        currentAutomation = null;
        saveAutomationsToServer().then(() => {
            renderAutomationList();
            popup.classList.add("hidden");
        });
    }

    function saveCurrentAutomation() {
        if (!currentAutomation) return;
        saveAutomationsToServer().then(() => {
            renderAutomationList();
            popup.classList.add("hidden");
        });
    }

    // --- Events ---
    createBtn.addEventListener("click", createAutomation);
    addBlockBtn.addEventListener("click", addBlock);
    saveBtn.addEventListener("click", saveCurrentAutomation);
    cancelBtn.addEventListener("click", () => popup.classList.add("hidden"));
    deleteBtn.addEventListener("click", deleteAutomation);
    popupClose.addEventListener("click", () => popup.classList.add("hidden"));

    // Init
    fetchAutomations();
});
