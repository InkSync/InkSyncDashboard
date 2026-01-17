document.addEventListener("DOMContentLoaded", () => {
    //DOM Elements
    const listEl = document.getElementById("automation-list");
    const countEl = document.getElementById("automation-count");
    const popup = document.getElementById("automation-popup");
    const popupClose = document.getElementById("popup-close");
    const popupTitle = document.getElementById("popup-title");
    const actionsContainer = document.getElementById("editor-actions");
    const addActionBtn = document.getElementById("add-action-btn");
    const actionTypeSelect = document.getElementById("action-type-select");
    const saveBtn = document.getElementById("save-automation-btn");
    const cancelBtn = document.getElementById("cancel-automation-btn");
    const deleteBtn = document.getElementById("delete-automation-btn");
    const createBtn = document.getElementById("create-automation-btn");
    const nameInput = document.getElementById("automation-name-input");
    const automationTypeSelect = document.getElementById("automation-type-select");
    const triggerTypeSelect = document.getElementById("trigger-type-select");
    const triggerConfigContainer = document.getElementById("trigger-config-fields");

    let automations = [];
    let currentAutomation = null;

    //Predefined variables for use in actions
    const PREDEFINED_VARIABLES = [
        {id: 'current_time', name: 'Current time (hh:mm)'},
        {id: 'current_hour', name: 'Current hour (24h)'},
        {id: 'current_minute', name: 'Current minute'},
        {id: 'current_day', name: 'Current day'},
        {id: 'current_month', name: 'Current month'},
        {id: 'connected_modules', name: 'Count of connected modules'},
        {id: 'module1_name', name: 'Name of module 1'},
        {id: 'module2_name', name: 'Name of module 2'},
        {id: 'key_value', name: 'Value of key X from module Y'},
        {id: 'knob_value', name: 'Value of knob X from module Y'}
    ];

    //Action definitions with their parameters
    const ACTION_DEFINITIONS = {
        'simulate_key_press': {
            name: 'Simulate key press',
            pcOnly: true,
            description: 'Send a key press to the connected PC',
            params: [
                {id: 'key', name: 'Key', type: 'text', required: true, placeholder: 'e.g., F13, ENTER'},
                {
                    id: 'duration',
                    name: 'Duration (ms)',
                    type: 'number',
                    required: false,
                    placeholder: 'Optional: how long to press'
                }
            ]
        },
        'simulate_mouse_move': {
            name: 'Simulate mouse movement',
            pcOnly: true,
            description: 'Move mouse cursor on PC',
            params: [
                {id: 'x', name: 'X position', type: 'number', required: true},
                {id: 'y', name: 'Y position', type: 'number', required: true}
            ]
        },
        'simulate_gamepad': {
            name: 'Simulate gamepad',
            pcOnly: true,
            description: 'Send gamepad input to PC',
            params: [
                {id: 'button', name: 'Button', type: 'text', required: true, placeholder: 'Button ID'},
                {id: 'value', name: 'Value', type: 'number', required: true, min: 0, max: 1}
            ]
        },
        'execute_command': {
            name: 'Execute command',
            pcOnly: true,
            description: 'Execute a shell command on PC',
            params: [
                {id: 'command', name: 'Command', type: 'text', required: true, placeholder: 'e.g., poweroff'}
            ]
        },
        'web_request': {
            name: 'Send web request',
            pcOnly: false,
            description: 'Make HTTP request to a URL',
            params: [
                {id: 'url', name: 'URL', type: 'url', required: true, placeholder: 'https://example.com/hook'},
                {id: 'method', name: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE']},
                {
                    id: 'headers',
                    name: 'Headers',
                    type: 'json',
                    required: false,
                    placeholder: '{"Content-Type": "application/json"}'
                },
                {id: 'body', name: 'Body', type: 'text', required: false, placeholder: 'Request body'}
            ]
        },
        'add_calendar_event': {
            name: 'Add calendar event',
            pcOnly: false,
            description: 'Create calendar event',
            params: [
                {id: 'time_from_now', name: 'Time from now (min)', type: 'number', required: true},
                {id: 'title', name: 'Title', type: 'text', required: true},
                {id: 'description', name: 'Description', type: 'text', required: false}
            ]
        },
        'wait_for_time': {
            name: 'Wait',
            pcOnly: false,
            description: 'Wait a specific amount of time',
            params: [
                {id: 'minutes', name: 'Minutes', type: 'number', required: true},
                {id: 'seconds', name: 'Seconds', type: 'number', required: true},
                {id: 'milliseconds', name: 'Milliseconds', type: 'number', required: true}
            ]
        },
        'set_variable': {
            name: 'Set variable',
            pcOnly: false,
            description: 'Set variable to value',
            params: [
                {id: 'variable', name: 'Variable name', type: 'text', required: true},
                {id: 'value', name: 'Value', type: 'text', required: true}
            ]
        },
        'map_variable': {
            name: 'Map variable',
            pcOnly: false,
            description: 'Map variable value to items in list',
            // Parameters will be handled by custom renderer
            params: []
        },
        'stop_if': {
            name: 'Stop if condition met',
            pcOnly: false,
            description: 'Stop automation if condition is true',
            params: [
                {id: 'variable1', name: 'First variable', type: 'text', required: true},
                {
                    id: 'condition',
                    name: 'Condition',
                    type: 'select',
                    options: ['==', '!=', '>', '<', '>=', '<='],
                    required: true
                },
                {id: 'variable2', name: 'Second variable/value', type: 'text', required: true},
                {id: 'invert', name: 'Invert condition', type: 'checkbox', required: false}
            ]
        },
        'format_text': {
            name: 'Format text variable',
            pcOnly: false,
            description: 'Format text with variable replacements',
            params: [
                {id: 'output_variable', name: 'Output variable', type: 'text', required: true},
                {
                    id: 'format',
                    name: 'Format string',
                    type: 'text',
                    required: true,
                    placeholder: 'Hello {name}, time is {time}'
                },
                {
                    id: 'replacements',
                    name: 'Replacements',
                    type: 'json',
                    required: true,
                    placeholder: '[{"from": "{name}", "to": "user"}, {"from": "{time}", "to": "12:00"}]'
                }
            ]
        }
    };

    //Trigger definitions
    const TRIGGER_DEFINITIONS = {
        'key_press': {
            name: 'On key press',
            description: 'Trigger when a key is pressed',
            params: [
                {
                    id: 'key',
                    name: 'Key ID',
                    type: 'select',
                    options: ['1', '2', "3", '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'],
                    required: true
                },
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true}
            ]
        },
        'key_release': {
            name: 'On key release',
            description: 'Trigger when a key is released',
            params: [
                {
                    id: 'key',
                    name: 'Key ID',
                    type: 'select',
                    options: ['1', '2', "3", '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'],
                    required: true
                },
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true}
            ]
        },
        'knob_change': {
            name: 'On knob change',
            description: 'Trigger when knob value changes',
            params: [
                {id: 'knob', name: 'Knob ID', type: 'number', min: 0, max: 3, required: true},
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true},
                {id: 'value', name: 'Value (optional)', type: 'number', min: 0, max: 100, required: false}
            ]
        },
        'knob_min': {
            name: 'On knob at minimum',
            description: 'Trigger when knob reaches minimum value',
            params: [
                {id: 'knob', name: 'Knob ID', type: 'number', min: 0, max: 3, required: true},
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true}
            ]
        },
        'knob_max': {
            name: 'On knob at maximum',
            description: 'Trigger when knob reaches maximum value',
            params: [
                {id: 'knob', name: 'Knob ID', type: 'number', min: 0, max: 3, required: true},
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true}
            ]
        },
        'module_connected': {
            name: 'On module connected',
            description: 'Trigger when module is connected',
            params: [
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true}
            ]
        },
        'module_disconnected': {
            name: 'On module disconnected',
            description: 'Trigger when module is disconnected',
            params: [
                {id: 'module', name: 'Module slot', type: 'select', options: ['1', '2'], required: true}
            ]
        }
    };

    //Helper function to create tooltip
    function createTooltip(text) {
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        tooltip.textContent = '?';
        tooltip.title = text;
        return tooltip;
    }

    //Fetch automations from server
    function fetchAutomations() {
        fetch("/api/automations")
            .then(r => r.json())
            .then(data => {
                automations = Array.isArray(data) ? data : [];
                renderAutomationList();
            })
            .catch(() => {
                automations = [];
                renderAutomationList();
            });
    }

    //Save automations to server
    function saveAutomationsToServer() {
        return fetch("/api/automations/save", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(automations)
        }).then(r => r.json());
    }

    //Render automation list
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

            const typeBadge = document.createElement("span");
            typeBadge.className = `auto-type-badge ${auto.type}`;
            typeBadge.textContent = auto.type === 'pc' ? ' PC ' : 'Auto';

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

            header.appendChild(typeBadge);
            header.appendChild(titleSpan);
            header.appendChild(toggleLabel);

            const flow = document.createElement("div");
            flow.className = "auto-flow";

            //Show trigger
            const triggerLabel = document.createElement("div");
            triggerLabel.className = "flow-trigger";
            const triggerDef = TRIGGER_DEFINITIONS[auto.trigger?.type] || {name: auto.trigger?.type || 'Unknown'};
            triggerLabel.textContent = `${triggerDef.name}`;
            flow.appendChild(triggerLabel);

            //Show actions
            auto.actions?.forEach((action, idx) => {
                if (idx === 0) {
                    const arrow = document.createElement("div");
                    arrow.className = "flow-arrow";
                    arrow.textContent = "→";
                    flow.appendChild(arrow);
                }

                const actionItem = document.createElement("div");
                actionItem.className = "flow-action";
                const actionDef = ACTION_DEFINITIONS[action.type] || {name: action.type};
                actionItem.textContent = actionDef.name;
                flow.appendChild(actionItem);

                if (idx < auto.actions.length - 1) {
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

    //Open editor
    function openEditor(id) {
        currentAutomation = automations.find(a => a.id === id);
        if (!currentAutomation) return;

        popupTitle.textContent = `Automation: ${currentAutomation.name}`;
        nameInput.value = currentAutomation.name;
        automationTypeSelect.value = currentAutomation.type || 'pc';
        triggerTypeSelect.value = currentAutomation.trigger?.type || 'key_press';

        renderTriggerConfig();
        renderActionEditor();
        filterActionOptions();
        popup.classList.remove("hidden");
    }

    //Render trigger configuration
    function renderTriggerConfig() {
        triggerConfigContainer.innerHTML = '';
        const triggerType = triggerTypeSelect.value;
        const triggerDef = TRIGGER_DEFINITIONS[triggerType];

        if (!triggerDef || !currentAutomation) return;

        //Initialize trigger if not exists
        if (!currentAutomation.trigger) {
            currentAutomation.trigger = {type: triggerType, config: {}};
        }

        //Create config fields
        triggerDef.params.forEach(param => {
            const wrapper = document.createElement('div');
            wrapper.className = 'config-field';

            const label = document.createElement('label');
            label.textContent = param.name;

            let input;
            switch (param.type) {
                case 'select':
                    input = document.createElement('select');
                    param.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        input.appendChild(option);
                    });
                    input.value = currentAutomation.trigger.config[param.id] || param.options[0];
                    break;
                case 'number':
                    input = document.createElement('input');
                    input.type = 'number';
                    input.min = param.min || 0;
                    input.max = param.max || 100;
                    input.value = currentAutomation.trigger.config[param.id] || '';
                    break;
                default:
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = currentAutomation.trigger.config[param.id] || '';
            }

            input.placeholder = param.placeholder || '';
            input.required = param.required || false;

            input.addEventListener('change', () => {
                currentAutomation.trigger.config[param.id] = input.value;
            });

            if (param.description) {
                label.appendChild(createTooltip(param.description));
            }

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            triggerConfigContainer.appendChild(wrapper);
        });
    }

    //Render action editor
    function renderActionEditor() {
        actionsContainer.innerHTML = '';
        if (!currentAutomation || !currentAutomation.actions) return;

        currentAutomation.actions.forEach(action => {
            actionsContainer.appendChild(renderActionEntry(action));
        });

        updateVariablesDisplay(); // Update variables after rendering
    }

    //Render single action entry
    function renderActionEntry(action) {
        // Special handling for map_variable action
        if (action.type === 'map_variable') {
            const actionDef = ACTION_DEFINITIONS[action.type] || {name: action.type};
            return renderMapVariableAction(action, actionDef);
        }

        // Original code for other actions...
        const wrapper = document.createElement("div");
        wrapper.className = "action-entry";
        wrapper.dataset.actionId = action.id;

        const header = document.createElement("div");
        header.className = "action-header";

        const actionDef = ACTION_DEFINITIONS[action.type] || {name: action.type};
        const titleSpan = document.createElement("span");
        titleSpan.textContent = actionDef.name;
        header.appendChild(titleSpan);

        if (actionDef.description) {
            header.appendChild(createTooltip(actionDef.description));
        }

        const del = document.createElement("button");
        del.className = "action-delete";
        del.textContent = "Delete";
        del.addEventListener("click", () => {
            currentAutomation.actions = currentAutomation.actions.filter(a => a.id !== action.id);
            renderActionEditor();
            updateVariablesDisplay();
        });
        header.appendChild(del);

        wrapper.appendChild(header);

        // Config fields
        const cfgDiv = document.createElement("div");
        cfgDiv.className = "action-config";

        if (actionDef.params) {
            actionDef.params.forEach(param => {
                const fieldWrapper = document.createElement('div');
                fieldWrapper.className = 'config-field';

                const label = document.createElement('label');
                label.textContent = param.name;

                let input;
                switch (param.type) {
                    case 'select':
                        input = document.createElement('select');
                        param.options.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt;
                            option.textContent = opt;
                            input.appendChild(option);
                        });
                        break;
                    case 'checkbox':
                        input = document.createElement('input');
                        input.type = 'checkbox';
                        input.checked = action.config?.[param.id] || false;
                        break;
                    case 'json':
                        input = document.createElement('textarea');
                        input.rows = 3;
                        try {
                            input.value = JSON.stringify(action.config?.[param.id], null, 2);
                        } catch {
                            input.value = action.config?.[param.id] || '';
                        }
                        break;
                    case 'number':
                        input = document.createElement('input');
                        input.type = 'number';
                        input.min = param.min || 0;
                        input.max = param.max || 100;
                        input.step = param.step || 1;
                        input.value = action.config?.[param.id] ?? param.default ?? '';
                        break;
                    default:
                        input = document.createElement('input');
                        input.type = param.type || 'text';
                        input.value = action.config?.[param.id] || '';
                }

                if (param.placeholder) input.placeholder = param.placeholder;
                if (param.required) input.required = true;

                input.addEventListener('input', () => {
                    if (!action.config) action.config = {};

                    if (param.type === 'json') {
                        try {
                            action.config[param.id] = JSON.parse(input.value);
                        } catch {
                            action.config[param.id] = input.value;
                        }
                    } else if (param.type === 'checkbox') {
                        action.config[param.id] = input.checked;
                    } else if (param.type === 'number') {
                        action.config[param.id] = parseFloat(input.value) || 0;
                    } else {
                        action.config[param.id] = input.value;
                    }

                    // Update variables display for text fields that might contain variables
                    if (param.type === 'text') {
                        updateVariablesDisplay();
                    }
                });

                if (param.description) {
                    label.appendChild(createTooltip(param.description));
                }

                fieldWrapper.appendChild(label);
                fieldWrapper.appendChild(input);
                cfgDiv.appendChild(fieldWrapper);
            });
        }

        wrapper.appendChild(cfgDiv);
        return wrapper;
    }

    //Filter action options based on automation type
    function filterActionOptions() {
        const automationType = automationTypeSelect.value;
        actionTypeSelect.innerHTML = '<option value="" disabled selected>Select action type</option>';

        Object.entries(ACTION_DEFINITIONS).forEach(([id, def]) => {
            if (automationType === 'pc' || !def.pcOnly) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = def.name;
                actionTypeSelect.appendChild(option);
            }
        });
    }

    //Generate UUID
    function uuidv4_time() {
        let t = Date.now()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (t + Math.random() * 16) % 16 | 0
            t = Math.floor(t / 16)
            const v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    }

    //Create new automation
    function createAutomation() {
        const id = uuidv4_time();
        const auto = {
            id,
            name: `Automation ${automations.length + 1}`,
            enabled: true,
            type: 'pc',
            trigger: {
                type: 'key_press',
                config: {
                    key: 0,
                    module: '1'
                }
            },
            actions: []
        };

        automations.push(auto);
        saveAutomationsToServer().then(() => {
            renderAutomationList();
            openEditor(id);
        });
    }

    //Add action
    function addAction() {
        if (!currentAutomation) return;
        const type = actionTypeSelect.value;
        if (!type) return;

        const actionDef = ACTION_DEFINITIONS[type];
        if (!actionDef) return;

        // Check if action is compatible with automation type
        if (currentAutomation.type === 'autonomous' && actionDef.pcOnly) {
            alert('This action is only available for PC automations');
            return;
        }

        const newAction = {
            id: uuidv4_time(),
            type: type,
            config: {}
        };

        // Initialize default values
        if (type === 'map_variable') {
            newAction.config = {
                variable_in: '',
                variable_out: '',
                min: 0,
                max: 100,
                mappings: []
            };
        } else if (actionDef.params) {
            actionDef.params.forEach(param => {
                if (param.default !== undefined) {
                    newAction.config[param.id] = param.default;
                }
            });
        }

        currentAutomation.actions.push(newAction);
        actionTypeSelect.value = "";
        renderActionEditor();
        updateVariablesDisplay();
    }

    //Delete automation
    function deleteAutomation() {
        if (!currentAutomation) return;
        automations = automations.filter(a => a.id !== currentAutomation.id);
        currentAutomation = null;
        saveAutomationsToServer().then(() => {
            renderAutomationList();
            popup.classList.add("hidden");
        });
    }

    //Save current automation
    function saveCurrentAutomation() {
        if (!currentAutomation) return;
        currentAutomation.type = automationTypeSelect.value;
        currentAutomation.trigger.type = triggerTypeSelect.value;

        saveAutomationsToServer().then(() => {
            renderAutomationList();
            popup.classList.add("hidden");
        });
    }

    //Event Listeners
    createBtn.addEventListener("click", createAutomation);
    addActionBtn.addEventListener("click", addAction);
    saveBtn.addEventListener("click", saveCurrentAutomation);
    cancelBtn.addEventListener("click", () => popup.classList.add("hidden"));
    deleteBtn.addEventListener("click", deleteAutomation);
    popupClose.addEventListener("click", () => popup.classList.add("hidden"));

    nameInput.addEventListener("input", () => {
        if (currentAutomation) {
            const v = nameInput.value.trim();
            currentAutomation.name = v || "Unnamed automation";
            popupTitle.textContent = `Automation: ${currentAutomation.name}`;
        }
    });

    automationTypeSelect.addEventListener("change", () => {
        if (currentAutomation) {
            currentAutomation.type = automationTypeSelect.value;
            filterActionOptions();
        }
    });

    triggerTypeSelect.addEventListener("change", () => {
        if (currentAutomation) {
            currentAutomation.trigger.type = triggerTypeSelect.value;
            currentAutomation.trigger.config = {}; // Reset config
        }
        renderTriggerConfig();
        updateVariablesDisplay(); // Update variables when trigger changes
    });

    //Initialize
    fetchAutomations();
    actionsContainer.addEventListener("change", () => {
        if (currentAutomation) {
            updateVariablesDisplay();
        }
    });


// Add these new functions to handle dynamic variables
    function extractVariablesFromAutomation() {
        const variables = new Set();

        // Add predefined variables based on trigger type
        if (currentAutomation && currentAutomation.trigger) {
            const triggerType = currentAutomation.trigger.type;

            // Always available
            variables.add('current_time');
            variables.add('current_hour');
            variables.add('current_minute');
            variables.add('current_day');
            variables.add('current_month');
            variables.add('connected_modules');
            variables.add('module1_name');
            variables.add('module2_name');

            // Trigger-specific variables
            if (triggerType.includes('key')) {
                variables.add('key_id');
                variables.add('key_module');
                variables.add('key_value');
            }

            if (triggerType.includes('knob')) {
                variables.add('knob_id');
                variables.add('knob_module');
                variables.add('knob_value');
            }

            if (triggerType.includes('module_')) {
                variables.add('module_slot');
            }
        }

        // Extract variables from actions
        if (currentAutomation && currentAutomation.actions) {
            currentAutomation.actions.forEach(action => {
                // Extract from set_variable and map_variable
                if (action.type === 'set_variable' && action.config?.variable) {
                    variables.add(action.config.variable);
                }
                if (action.type === 'map_variable') {
                    if (action.config?.variable_in) {
                        variables.add(action.config.variable_in);
                    }
                    if (action.config?.variable_out) {
                        variables.add(action.config.variable_out);
                    }
                }

                // Extract from all text fields with {variable} pattern
                if (action.config) {
                    Object.values(action.config).forEach(value => {
                        if (typeof value === 'string') {
                            const matches = value.match(/\{([^}]+)\}/g);
                            if (matches) {
                                matches.forEach(match => {
                                    const varName = match.slice(1, -1);
                                    variables.add(varName);
                                });
                            }
                        }
                    });
                }
            });
        }

        return Array.from(variables).sort();
    }

    function updateVariablesDisplay() {
        const variablesHelpEl = document.querySelector('.variables-help');
        if (!variablesHelpEl) return;

        const variables = extractVariablesFromAutomation();

        let html = '<h4>Available Variables:</h4><ul class="variables-list">';

        // Group variables by category
        const categories = {
            'Time Variables': [],
            'Module Variables': [],
            'Trigger Variables': [],
            'Custom Variables': []
        };

        variables.forEach(varName => {
            if (['current_time', 'current_hour', 'current_minute', 'current_day', 'current_month'].includes(varName)) {
                categories['Time Variables'].push(varName);
            } else if (['connected_modules', 'module1_name', 'module2_name', 'module_slot'].includes(varName)) {
                categories['Module Variables'].push(varName);
            } else if (['key_id', 'key_module', 'key_value', 'knob_id', 'knob_module', 'knob_value'].includes(varName)) {
                categories['Trigger Variables'].push(varName);
            } else {
                categories['Custom Variables'].push(varName);
            }
        });

        Object.entries(categories).forEach(([category, vars]) => {
            if (vars.length > 0) {
                html += `<li><strong>${category}:</strong><ul>`;
                vars.forEach(varName => {
                    html += `<li><code>{${varName}}</code></li>`;
                });
                html += '</ul></li>';
            }
        });

        html += '</ul>';
        variablesHelpEl.innerHTML = html;
    }

    function renderMapVariableAction(action, actionDef) {
        const wrapper = document.createElement("div");
        wrapper.className = "action-entry";
        wrapper.dataset.actionId = action.id;

        const header = document.createElement("div");
        header.className = "action-header";

        const titleSpan = document.createElement("span");
        titleSpan.textContent = actionDef.name;
        header.appendChild(titleSpan);

        if (actionDef.description) {
            header.appendChild(createTooltip(actionDef.description));
        }

        const del = document.createElement("button");
        del.className = "action-delete";
        del.textContent = "Delete";
        del.addEventListener("click", () => {
            currentAutomation.actions = currentAutomation.actions.filter(a => a.id !== action.id);
            renderActionEditor();
            updateVariablesDisplay();
        });
        header.appendChild(del);

        wrapper.appendChild(header);

        // Config fields for map_variable
        const cfgDiv = document.createElement("div");
        cfgDiv.className = "action-config";

        // Input variable field
        const inputVarField = document.createElement('div');
        inputVarField.className = 'config-field';
        const inputVarLabel = document.createElement('label');
        inputVarLabel.textContent = 'Input variable';
        const inputVarInput = document.createElement('input');
        inputVarInput.type = 'text';
        inputVarInput.value = action.config?.variable_in || '';
        inputVarInput.placeholder = 'e.g., knob_value';
        inputVarInput.addEventListener('input', () => {
            if (!action.config) action.config = {};
            action.config.variable_in = inputVarInput.value;
            updateVariablesDisplay();
        });
        inputVarField.appendChild(inputVarLabel);
        inputVarField.appendChild(inputVarInput);
        cfgDiv.appendChild(inputVarField);

        // Output variable field
        const outputVarField = document.createElement('div');
        outputVarField.className = 'config-field';
        const outputVarLabel = document.createElement('label');
        outputVarLabel.textContent = 'Output variable';
        const outputVarInput = document.createElement('input');
        outputVarInput.type = 'text';
        outputVarInput.value = action.config?.variable_out || '';
        outputVarInput.placeholder = 'e.g., mapped_value';
        outputVarInput.addEventListener('input', () => {
            if (!action.config) action.config = {};
            action.config.variable_out = outputVarInput.value;
            updateVariablesDisplay();
        });
        outputVarField.appendChild(outputVarLabel);
        outputVarField.appendChild(outputVarInput);
        cfgDiv.appendChild(outputVarField);

        // Min/Max values
        const rangeField = document.createElement('div');
        rangeField.className = 'config-field range-field';

        const minField = document.createElement('div');
        minField.className = 'range-input';
        const minLabel = document.createElement('label');
        minLabel.textContent = 'Min value';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.value = action.config?.min || 0;
        minInput.addEventListener('input', () => {
            if (!action.config) action.config = {};
            action.config.min = parseFloat(minInput.value) || 0;
        });
        minField.appendChild(minLabel);
        minField.appendChild(minInput);

        const maxField = document.createElement('div');
        maxField.className = 'range-input';
        const maxLabel = document.createElement('label');
        maxLabel.textContent = 'Max value';
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.value = action.config?.max || 100;
        maxInput.addEventListener('input', () => {
            if (!action.config) action.config = {};
            action.config.max = parseFloat(maxInput.value) || 100;
        });
        maxField.appendChild(maxLabel);
        maxField.appendChild(maxInput);

        rangeField.appendChild(minField);
        rangeField.appendChild(maxField);
        cfgDiv.appendChild(rangeField);

        // Mappings list
        const mappingsField = document.createElement('div');
        mappingsField.className = 'config-field';
        const mappingsLabel = document.createElement('label');
        mappingsLabel.textContent = 'Mappings';
        mappingsField.appendChild(mappingsLabel);

        const mappingsContainer = document.createElement('div');
        mappingsContainer.className = 'mappings-container';

        // Initialize mappings array if not exists
        if (!action.config.mappings || !Array.isArray(action.config.mappings)) {
            action.config.mappings = [];
        }

        // Render each mapping
        action.config.mappings.forEach((mapping, index) => {
            const mappingRow = document.createElement('div');
            mappingRow.className = 'mapping-row';

            const fromInput = document.createElement('input');
            fromInput.type = 'number';
            fromInput.className = 'mapping-from';
            fromInput.value = mapping.from || 0;
            fromInput.placeholder = 'Value';

            const toInput = document.createElement('input');
            toInput.type = 'text';
            toInput.className = 'mapping-to';
            toInput.value = mapping.to || '';
            toInput.placeholder = 'Result';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'mapping-delete';
            deleteBtn.textContent = '−';
            deleteBtn.title = 'Delete mapping';

            // Update mapping on input
            const updateMapping = () => {
                action.config.mappings[index] = {
                    from: parseFloat(fromInput.value) || 0,
                    to: toInput.value
                };
            };

            fromInput.addEventListener('input', updateMapping);
            toInput.addEventListener('input', updateMapping);

            deleteBtn.addEventListener('click', () => {
                action.config.mappings.splice(index, 1);
                renderActionEditor();
            });

            mappingRow.appendChild(fromInput);
            mappingRow.appendChild(document.createTextNode(' → '));
            mappingRow.appendChild(toInput);
            mappingRow.appendChild(deleteBtn);
            mappingsContainer.appendChild(mappingRow);
        });

        // Add mapping button
        const addMappingBtn = document.createElement('button');
        addMappingBtn.className = 'add-mapping-btn';
        addMappingBtn.textContent = '+ Add Mapping';
        addMappingBtn.type = 'button';
        addMappingBtn.addEventListener('click', () => {
            if (!action.config.mappings) {
                action.config.mappings = [];
            }
            action.config.mappings.push({from: 0, to: ''});
            renderActionEditor();
        });

        mappingsField.appendChild(mappingsContainer);
        mappingsField.appendChild(addMappingBtn);
        cfgDiv.appendChild(mappingsField);

        wrapper.appendChild(cfgDiv);
        return wrapper;
    }
});