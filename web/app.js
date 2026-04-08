// Initialize WASM Engine dynamic loading
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const wasmParam = urlParams.get('wasm');

    // Security check: validate wasmParam
    let wasmEngine = 'tt3647';
    if (wasmParam && /^tt\d+$/.test(wasmParam)) {
        wasmEngine = wasmParam;
    }

    const config = {
        locateFile: function(path) {
            if (path.endsWith('.wasm')) {
                if (wasmEngine === 'default') {
                    return path; // Local file
                } else {
                    // Use jsdelivr CDN for correct MIME type
                    return `https://cdn.jsdelivr.net/gh/chatelao/tt-test-framework@main/wasm/${wasmEngine}.wasm`;
                }
            }
            return path;
        }
    };

    const script = document.createElement('script');
    if (wasmEngine === 'default') {
        window.Module = config;
        script.src = 'digital_twin_Full.js';
    } else {
        // Use jsdelivr CDN for correct MIME type
        script.src = `https://cdn.jsdelivr.net/gh/chatelao/tt-test-framework@main/wasm/${wasmEngine}.js`;
        script.onload = () => {
            const factory = window[wasmEngine];
            if (typeof factory === 'function') {
                factory(config).then(instance => {
                    // Log before merge
                    console.log(`WASM ${wasmEngine} instance created`);
                    // Merge instance into window.Module to keep references
                    window.Module = Object.assign(window.Module || {}, instance);

                    if (window.initDigitalTwin) {
                        window.initDigitalTwin();
                    }

                    if (window.Module.onRuntimeInitialized) {
                        window.Module.onRuntimeInitialized();
                    }
                });
            } else {
                console.error(`Factory window[${wasmEngine}] not found`);
            }
        };
    }
    document.head.appendChild(script);
    window.currentWasmEngine = wasmEngine;
})();

document.addEventListener('DOMContentLoaded', () => {
    const uiIn = document.getElementById('ui_in').querySelectorAll('input');
    const uioIn = document.getElementById('uio_in').querySelectorAll('input');
    const uiInHex = document.getElementById('ui_in_hex');
    const uioInHex = document.getElementById('uio_in_hex');
    const uiInReset = document.getElementById('ui_in_reset');
    const uioInReset = document.getElementById('uio_in_reset');
    const clk = document.getElementById('clk');
    const rstN = document.getElementById('rst_n');
    const ena = document.getElementById('ena');
    const sweepInputsBtn = document.getElementById('sweepInputs');
    const randomInputBtn = document.getElementById('randomInput');
    const sendReceiveBtn = document.getElementById('sendReceive');
    const exportCsvBtn = document.getElementById('exportCsv');
    const importCsvBtn = document.getElementById('importCsv');
    const importCsvFile = document.getElementById('importCsvFile');
    const clearDataBtn = document.getElementById('clearData');
    const testsetSelect = document.getElementById('testsetSelect');
    const loadTestsetBtn = document.getElementById('loadTestset');
    const runTestsetBtn = document.getElementById('runTestset');
    const copyPermalinkBtn = document.getElementById('copyPermalink');
    const mdUrlInput = document.getElementById('mdUrl');
    const fetchMdBtn = document.getElementById('fetchMd');
    const mdTableSelect = document.getElementById('mdTableSelect');
    const runMdTableBtn = document.getElementById('runMdTable');
    const mdTableInfo = document.getElementById('mdTableInfo');
    const diagramScaling = document.getElementById('diagram-scaling');
    const diagramImg = document.getElementById('diagram-img');
    const testsetInfo = document.getElementById('testsetInfo');
    const historyBody = document.getElementById('history');
    const consoleDiv = document.getElementById('console');
    const testerTable = document.querySelector('.tester-table');
    const connectBtn = document.getElementById('connectBtn');
    const statusLabel = document.getElementById('statusLabel');
    const useFullWasm = document.getElementById('useFullWasm');
    const wasmEngineSelect = document.getElementById('wasmEngineSelect');

    // Set dropdown value from current URL
    wasmEngineSelect.value = window.currentWasmEngine;

    wasmEngineSelect.addEventListener('change', () => {
        const url = new URL(window.location.href);
        const selectedWasm = wasmEngineSelect.value;
        if (selectedWasm === 'default') {
            url.searchParams.delete('wasm');
        } else {
            url.searchParams.set('wasm', selectedWasm);
        }
        window.location.href = url.toString();
    });

    // Initialize Use Full WASM from localStorage
    const savedWasmPreference = localStorage.getItem('useFullWasm');
    if (savedWasmPreference !== null) {
        useFullWasm.checked = savedWasmPreference === 'true';
    }

    useFullWasm.addEventListener('change', () => {
        localStorage.setItem('useFullWasm', useFullWasm.checked);
        logToConsole(`Use WASM Simulation: ${useFullWasm.checked}`);
    });

    let port = null;
    let reader = null;
    let writer = null;
    let isConnected = false;

    async function connect() {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            writer = port.writable.getWriter();

            isConnected = true;
            connectBtn.textContent = 'Simulation';
            statusLabel.textContent = 'Connected';
            logToConsole('Connected to serial port');

            // Send reset command on connect
            const encoder = new TextEncoder();
            await writer.write(encoder.encode('reset\n'));
            logToConsole('Sent reset command');

            // Set up reader
            readLoop();

        } catch (e) {
            console.error('Failed to connect', e);
            logToConsole('Failed to connect: ' + e.message);
            isConnected = false;
        }
    }

    async function disconnect() {
        try {
            if (reader) {
                await reader.cancel();
            }
            if (writer) {
                writer.releaseLock();
                writer = null;
            }
            if (port) {
                await port.close();
                port = null;
            }
        } catch (e) {
            console.error('Error during disconnect', e);
        } finally {
            isConnected = false;
            connectBtn.textContent = 'Connect';
            statusLabel.textContent = 'Simulation Mode';
            logToConsole('Disconnected/Simulation mode active');
        }
    }

    async function readLoop() {
        const decoder = new TextDecoder();
        while (port && port.readable && isConnected) {
            try {
                reader = port.readable.getReader();
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) {
                        const text = decoder.decode(value);
                        serialBuffer += text;
                        if (serialBuffer.includes('\n')) {
                            const lines = serialBuffer.split('\n');
                            serialBuffer = lines.pop(); // keep partial line
                            for (const line of lines) {
                                const trimmedLine = line.trim();
                                if (trimmedLine === "") continue;
                                if (trimmedLine.startsWith("uo;")) {
                                    if (serialDataPromiseResolve) {
                                        serialDataPromiseResolve(trimmedLine);
                                        serialDataPromiseResolve = null;
                                    }
                                } else if (trimmedLine === "ok") {
                                    logToConsole("Serial RX: ok");
                                } else {
                                    logToConsole(`Serial RX: ${trimmedLine}`);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Read error', e);
                break;
            } finally {
                reader.releaseLock();
                reader = null;
            }
        }
    }

    connectBtn.addEventListener('click', () => {
        if (isConnected) {
            disconnect();
        } else {
            connect();
        }
    });

    // Column visibility toggles
    ['uio_in', 'uio_out', 'uio_oe'].forEach(col => {
        const toggle = document.getElementById(`toggle-${col}`);
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                testerTable.classList.remove(`hide-${col}`);
            } else {
                testerTable.classList.add(`hide-${col}`);
            }
            updateDiagram();
        });
    });
    const historyData = [];
    let currentTestset = null;
    let cycleCount = 0;

    function updateURLParameter(projectName) {
        const url = new URL(window.location.href);
        if (projectName) {
            url.searchParams.set('project', projectName);
        } else {
            url.searchParams.delete('project');
        }
        window.history.pushState({}, '', url);
    }

    function logToConsole(message) {
        const timestamp = new Date().toLocaleTimeString();
        const newMessage = `[${timestamp}] ${message}\n`;
        consoleDiv.textContent += newMessage;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
        console.log(`CONSOLE_MSG: ${message}`);
        window.dispatchEvent(new CustomEvent('console-log', { detail: message }));
        console.log(`Dispatched console-log event with detail: ${message}`);
    }

    function getBits(inputs) {
        let val = 0;
        inputs.forEach((input, index) => {
            if (input.checked) {
                val |= (1 << (7 - index));
            }
        });
        return val;
    }

    function updateHexFromBits(inputs, hexInput) {
        const val = getBits(inputs);
        hexInput.value = val.toString(16).padStart(2, '0').toUpperCase();
    }

    function updateBitsFromHex(hexInput, inputs) {
        let val = parseInt(hexInput.value, 16);
        if (isNaN(val)) val = 0;
        val &= 0xFF;
        inputs.forEach((input, index) => {
            input.checked = (val >> (7 - index)) & 1;
        });
    }

    uiIn.forEach(input => {
        input.addEventListener('change', () => updateHexFromBits(uiIn, uiInHex));
    });

    uioIn.forEach(input => {
        input.addEventListener('change', () => updateHexFromBits(uioIn, uioInHex));
    });

    uiInHex.addEventListener('input', () => updateBitsFromHex(uiInHex, uiIn));
    uioInHex.addEventListener('input', () => updateBitsFromHex(uioInHex, uioIn));

    uiInReset.addEventListener('click', () => {
        uiInHex.value = '00';
        updateBitsFromHex(uiInHex, uiIn);
    });

    uioInReset.addEventListener('click', () => {
        uioInHex.value = '00';
        updateBitsFromHex(uioInHex, uioIn);
    });

    function createBitDisplay(value) {
        const container = document.createElement('div');
        container.className = 'bits-out';
        for (let i = 0; i < 8; i++) {
            const bitVal = (value >> (7 - i)) & 1;
            const span = document.createElement('span');
            span.className = 'bit' + (bitVal ? ' high' : '');
            span.textContent = bitVal;
            container.appendChild(span);
        }
        const hexSpan = document.createElement('span');
        hexSpan.className = 'hex-display';
        hexSpan.textContent = `0x${value.toString(16).padStart(2, '0').toUpperCase()}`;
        container.appendChild(hexSpan);
        return container;
    }

    function addHistoryRow(inputs, outputs, timestamp, cycle) {
        const row = document.createElement('tr');

        // Time
        const timeTd = document.createElement('td');
        timeTd.className = 'time-cell';
        timeTd.textContent = timestamp;
        row.appendChild(timeTd);

        // Cycle
        const cycleTd = document.createElement('td');
        cycleTd.className = 'time-cell';
        cycleTd.textContent = cycle;
        row.appendChild(cycleTd);

        // ui_in
        const uiInTd = document.createElement('td');
        uiInTd.appendChild(createBitDisplay(inputs.ui_in));
        row.appendChild(uiInTd);

        // uio_in
        const uioInTd = document.createElement('td');
        uioInTd.className = 'col-uio_in';
        uioInTd.appendChild(createBitDisplay(inputs.uio_in));
        row.appendChild(uioInTd);

        // clk, rst_n, ena
        [inputs.clk, inputs.rst_n, inputs.ena].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            row.appendChild(td);
        });

        // uo_out
        const uoOutTd = document.createElement('td');
        uoOutTd.appendChild(createBitDisplay(outputs.uo_out));
        row.appendChild(uoOutTd);

        // uio_out
        const uioOutTd = document.createElement('td');
        uioOutTd.className = 'col-uio_out';
        uioOutTd.appendChild(createBitDisplay(outputs.uio_out));
        row.appendChild(uioOutTd);

        // uio_oe
        const uioOeTd = document.createElement('td');
        uioOeTd.className = 'col-uio_oe';
        uioOeTd.appendChild(createBitDisplay(outputs.uio_oe));
        row.appendChild(uioOeTd);

        historyBody.prepend(row);
    }

    function formatFP8(val) {
        // E4M3: 1 sign, 4 exponent, 3 mantissa, bias 7
        const sign = (val >> 7) & 1;
        const exponent = (val >> 3) & 0xF;
        const mantissa = val & 0x7;

        let result = 0;
        if (exponent === 0) {
            // Subnormal
            result = (sign ? -1 : 1) * Math.pow(2, -6) * (mantissa / 8);
        } else if (exponent === 0xF && mantissa === 0x7) {
            // NaN (specific for E4M3 in some conventions)
            return "NaN";
        } else {
            // Normal
            result = (sign ? -1 : 1) * Math.pow(2, exponent - 7) * (1 + mantissa / 8);
        }
        return result.toFixed(3);
    }

    function formatFP4(val) {
        // E2M1: 1 sign, 2 exponent, 1 mantissa, bias 1
        const sign = (val >> 3) & 1;
        const exponent = (val >> 1) & 0x3;
        const mantissa = val & 1;

        let result = 0;
        if (exponent === 0) {
            // Subnormal
            result = (sign ? -1 : 1) * Math.pow(2, 0) * (mantissa / 2);
        } else {
            // Normal
            result = (sign ? -1 : 1) * Math.pow(2, exponent - 1) * (1 + mantissa / 2);
        }
        return result.toFixed(2);
    }

    function generatePlantUML() {
        if (historyData.length === 0) return "";

        const channels = ['cycle', 'ui_in', 'uio_in', 'clk', 'rst_n', 'ena', 'uo_out', 'uio_out', 'uio_oe'];
        const config = {};
        channels.forEach(ch => {
            let type = document.getElementById(`type-${ch}`).value;
            const toggle = document.getElementById(`toggle-${ch}`);
            if (toggle && !toggle.checked) {
                type = 'hidden';
            }
            config[ch] = type;
        });

        let puml = "@startuml\n";
        puml += "<style>\n";
        puml += "timingDiagram {\n";
        puml += "  .input {\n";
        puml += "    LineColor DarkRed\n";
        puml += "  }\n";
        puml += "}\n";
        puml += "</style>\n";

        // Definitions
        channels.forEach(ch => {
            const type = config[ch];
            if (type === 'hidden') return;

            const isInput = ['ui_in', 'uio_in', 'clk', 'rst_n', 'ena'].includes(ch);
            const stereotype = isInput ? ' <<input>>' : '';

            if (type === 'bits') {
                for (let i = 7; i >= 0; i--) {
                    puml += `binary "${ch}[${i}]" as ${ch}_${i}${stereotype}\n`;
                }
            } else if (type === 'binary') {
                puml += `binary "${ch}" as ${ch}${stereotype}\n`;
            } else {
                puml += `concise "${ch}" as ${ch}${stereotype}\n`;
            }
        });
        puml += "\n";

        let time = 0;
        const lastState = {};
        historyData.forEach((t) => {
            puml += `@${time}\n`;
            channels.forEach(ch => {
                const type = config[ch];
                if (type === 'hidden') return;

                const val = t[ch];
                if (type === 'bits') {
                    if (lastState[ch] === undefined) lastState[ch] = [];
                    for (let i = 7; i >= 0; i--) {
                        const bit = (val >> i) & 1;
                        if (lastState[ch][i] !== bit) {
                            puml += `${ch}_${i} is ${bit}\n`;
                            lastState[ch][i] = bit;
                        }
                    }
                } else {
                    if (lastState[ch] !== val) {
                        if (type === 'binary') {
                            puml += `${ch} is ${val}\n`;
                        } else if (type === 'hex') {
                            if (ch === 'cycle') {
                                puml += `${ch} is "0x${val.toString(16).toUpperCase()}"\n`;
                            } else {
                                puml += `${ch} is "0x${val.toString(16).toUpperCase().padStart(2, '0')}"\n`;
                            }
                        } else if (type === 'dec') {
                            puml += `${ch} is "${val}"\n`;
                        } else if (type === 'bin') {
                            puml += `${ch} is "0b${val.toString(2).padStart(8, '0')}"\n`;
                        } else if (type === 'fp8') {
                            puml += `${ch} is "${formatFP8(val)}"\n`;
                        } else if (type === 'dual_fp4') {
                            const high = formatFP4((val >> 4) & 0xF);
                            const low = formatFP4(val & 0xF);
                            puml += `${ch} is "${high} | ${low}"\n`;
                        }
                        lastState[ch] = val;
                    }
                }
            });
            time++;
        });

        puml += `@${time}\n`;
        puml += "@enduml";
        return puml;
    }

    async function encodePlantUML(text) {
        // UTF-8 to Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        // Deflate
        const cs = new CompressionStream('deflate-raw');
        const writer = cs.writable.getWriter();
        writer.write(data);
        writer.close();

        const response = new Response(cs.readable);
        const compressed = new Uint8Array(await response.arrayBuffer());

        // The PlantUML standard deflate requires skipping the first 2 bytes (zlib header)
        // and last 4 bytes (checksum) if using raw deflate.
        // However, CompressionStream 'deflate' provides zlib format.
        // PlantUML server usually expects the deflate data WITHOUT the zlib header/checksum
        // OR it uses a specific implementation.
        // Let's try the common JS implementation approach:

        return encode64(compressed);
    }

    function encode64(data) {
        let r = "";
        for (let i = 0; i < data.length; i += 3) {
            if (i + 2 < data.length) {
                r += append3bytes(data[i], data[i + 1], data[i + 2]);
            } else if (i + 1 < data.length) {
                r += append3bytes(data[i], data[i + 1], 0);
            } else {
                r += append3bytes(data[i], 0, 0);
            }
        }
        return r;
    }

    function append3bytes(b1, b2, b3) {
        const c1 = b1 >> 2;
        const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
        const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
        const c4 = b3 & 0x3F;
        let r = "";
        r += encode6bit(c1 & 0x3F);
        r += encode6bit(c2 & 0x3F);
        r += encode6bit(c3 & 0x3F);
        r += encode6bit(c4 & 0x3F);
        return r;
    }

    function encode6bit(b) {
        const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
        return alphabet[b] || '?';
    }

    async function updateDiagram() {
        const puml = generatePlantUML();
        if (!puml) return;

        try {
            const encoded = await encodePlantUML(puml);
            const diagramImg = document.getElementById('diagram-img');
            diagramImg.src = `https://www.plantuml.com/plantuml/img/${encoded}`;
        } catch (e) {
            console.error("Failed to update diagram", e);
        }
    }

    let digitalTwin = null;
    let wasmReady = false;

    function initDigitalTwin() {
        if (typeof Module !== 'undefined' && !wasmReady) {
            const DigitalTwinClass = Module.DigitalTwin || Module.ProjectWasm;
            if (DigitalTwinClass) {
                try {
                    digitalTwin = new DigitalTwinClass();
                    wasmReady = true;
                    logToConsole(`WASM Simulation initialized: ${window.currentWasmEngine}`);
                    return true;
                } catch (e) {
                    console.error('Failed to create DigitalTwin', e);
                }
            }
        }
        return false;
    }

    window.initDigitalTwin = initDigitalTwin;

    // The WASM module initialized by digital_twin_Full.js
    if (typeof Module !== 'undefined') {
        if (!initDigitalTwin()) {
            Module['onRuntimeInitialized'] = () => {
                initDigitalTwin();
            };
        }
    }

    // Fallback check for WASM readiness
    const wasmCheckInterval = setInterval(() => {
        if (wasmReady) {
            clearInterval(wasmCheckInterval);
        } else {
            if (initDigitalTwin()) {
                clearInterval(wasmCheckInterval);
            }
        }
    }, 500);

    function mockBoard(uiValue, uioInValue, clkVal, rstVal, enaVal) {
        if (useFullWasm.checked && wasmReady && digitalTwin) {
            try {
                if (typeof digitalTwin.set_ui_in === 'function') {
                    digitalTwin.set_ui_in(uiValue);
                }
                if (typeof digitalTwin.set_uio_in === 'function') {
                    digitalTwin.set_uio_in(uioInValue);
                }
                if (typeof digitalTwin.set_ena === 'function') {
                    digitalTwin.set_ena(enaVal === 1);
                }
                if (typeof digitalTwin.set_rst_n === 'function') {
                    digitalTwin.set_rst_n(rstVal === 1);
                }
                if (typeof digitalTwin.set_clk === 'function') {
                    digitalTwin.set_clk(clkVal === 1);
                }

                // Advance simulation
                if (typeof digitalTwin.eval === 'function') {
                    digitalTwin.eval();
                }
                if (typeof digitalTwin.step === 'function') {
                    // For modern DigitalTwins, step() should be called on every change
                    // if set_clk is available. For legacy, only on rising edges.
                    if (typeof digitalTwin.set_clk === 'function' || clkVal === 1) {
                        digitalTwin.step();
                    }
                }

                const res = {
                    source: 'WASM',
                    uo_out: typeof digitalTwin.get_uo_out === 'function' ? digitalTwin.get_uo_out() : 0,
                    uio_out: typeof digitalTwin.get_uio_out === 'function' ? digitalTwin.get_uio_out() : 0,
                    uio_oe: typeof digitalTwin.get_uio_oe === 'function' ? digitalTwin.get_uio_oe() : 0
                };
                console.log(`mockBoard results from WASM: ${JSON.stringify(res)}`);
                return res;
            } catch (e) {
                console.error("Error in WASM mockBoard:", e);
                logToConsole("Error in WASM mockBoard: " + e.message);
                // Fallback to XOR if WASM fails
                return {
                    source: 'WASM_ERROR',
                    uo_out: (uiValue ^ uioInValue) & 0xFF,
                    uio_out: 0,
                    uio_oe: 0
                };
            }
        } else {
            // Emulate behavior: uo_out = ui_in ^ uio_in (XOR)
            const result = (uiValue ^ uioInValue) & 0xFF;
            return {
                source: 'XOR',
                uo_out: result,
                uio_out: 0,
                uio_oe: 0
            };
        }
    }

    let serialDataPromiseResolve = null;
    let serialBuffer = "";

    async function performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal, skipUpdate = false) {
        const timestamp = new Date().toLocaleTimeString();

        if (rstVal === 0) {
            cycleCount = 0;
        } else if (clkVal === 1) {
            cycleCount++;
        }

        const inputs = {
            ui_in: uiValue,
            uio_in: uioInValue,
            clk: clkVal,
            rst_n: rstVal,
            ena: enaVal
        };

        logToConsole(`Sending: ui_in=0x${uiValue.toString(16).padStart(2, '0').toUpperCase()}, uio_in=0x${uioInValue.toString(16).padStart(2, '0').toUpperCase()}, clk=${clkVal}, rst_n=${rstVal}, ena=${enaVal}`);

        let outputs;

        if (isConnected) {
            const command = `0x${uiValue.toString(16).padStart(2, '0')};${clkVal};0x${uioInValue.toString(16).padStart(2, '0')};${rstVal};${enaVal}\n`;

            const encoder = new TextEncoder();
            const promise = new Promise(resolve => {
                serialDataPromiseResolve = resolve;
            });

            await writer.write(encoder.encode(command));

            // Timeout after 1 second if no response
            const timeout = setTimeout(() => {
                if (serialDataPromiseResolve) {
                    serialDataPromiseResolve(null);
                    serialDataPromiseResolve = null;
                }
            }, 1000);

            const response = await promise;
            clearTimeout(timeout);

            if (response) {
                // Parse: uo;[uo_out];uio;[uio_out];uio_oe;[uio_oe]\n
                const parts = response.split(';');
                outputs = {
                    uo_out: parts[1] ? parseInt(parts[1], 16) : 0,
                    uio_out: parts[3] ? parseInt(parts[3], 16) : 0,
                    uio_oe: parts[5] ? parseInt(parts[5], 16) : 0
                };
                logToConsole(`Received (Serial): uo_out=0x${outputs.uo_out.toString(16).padStart(2, '0').toUpperCase()}`);
            } else {
                logToConsole('Error: Serial transaction timed out');
                outputs = { uo_out: 0, uio_out: 0, uio_oe: 0 };
            }
        } else {
            outputs = mockBoard(uiValue, uioInValue, clkVal, rstVal, enaVal);
            const sourceText = (useFullWasm.checked && wasmReady && digitalTwin) ? "WASM" : "XOR";
            logToConsole(`Received (Emulated ${sourceText}): uo_out=0x${outputs.uo_out.toString(16).padStart(2, '0').toUpperCase()}`);
        }

        historyData.push({
            time: timestamp,
            cycle: cycleCount,
            ...inputs,
            ...outputs
        });

        addHistoryRow(inputs, outputs, timestamp, cycleCount);
        if (!skipUpdate) updateDiagram();
        return outputs;
    }

    function exportToCsv() {
        if (historyData.length === 0) {
            alert('No history to export');
            return;
        }

        const headers = ['Time', 'Cycle', 'ui_in', 'uio_in', 'clk', 'rst_n', 'ena', 'uo_out', 'uio_out', 'uio_oe'];
        const csvRows = [headers.join(',')];

        for (const row of historyData) {
            const values = [
                `"${row.time}"`,
                row.cycle,
                `0x${row.ui_in.toString(16).padStart(2, '0')}`,
                `0x${row.uio_in.toString(16).padStart(2, '0')}`,
                row.clk,
                row.rst_n,
                row.ena,
                `0x${row.uo_out.toString(16).padStart(2, '0')}`,
                `0x${row.uio_out.toString(16).padStart(2, '0')}`,
                `0x${row.uio_oe.toString(16).padStart(2, '0')}`
            ];
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'tiny_tapeout_history.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    randomInputBtn.addEventListener('click', async () => {
        const uiValue = Math.floor(Math.random() * 256);
        const uioInValue = Math.floor(Math.random() * 256);

        uiInHex.value = uiValue.toString(16).padStart(2, '0').toUpperCase();
        uioInHex.value = uioInValue.toString(16).padStart(2, '0').toUpperCase();
        updateBitsFromHex(uiInHex, uiIn);
        updateBitsFromHex(uioInHex, uioIn);

        const rstVal = rstN.checked ? 1 : 0;
        const enaVal = ena.checked ? 1 : 0;
        const clkSelection = clk.value;

        if (clkSelection === '1/0') {
            await performTransaction(uiValue, uioInValue, 1, rstVal, enaVal);
            await performTransaction(uiValue, uioInValue, 0, rstVal, enaVal);
        } else {
            const clkVal = parseInt(clkSelection);
            await performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal);
        }
    });

    sendReceiveBtn.addEventListener('click', async () => {
        const uiValue = getBits(uiIn);
        const uioInValue = getBits(uioIn);
        const rstVal = rstN.checked ? 1 : 0;
        const enaVal = ena.checked ? 1 : 0;
        const clkSelection = clk.value;

        if (clkSelection === '1/0') {
            await performTransaction(uiValue, uioInValue, 1, rstVal, enaVal);
            await performTransaction(uiValue, uioInValue, 0, rstVal, enaVal);
        } else {
            const clkVal = parseInt(clkSelection);
            await performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal);
        }
    });

    sweepInputsBtn.addEventListener('click', async () => {
        sweepInputsBtn.disabled = true;
        const rstVal = rstN.checked ? 1 : 0;
        const enaVal = ena.checked ? 1 : 0;
        const clkSelection = clk.value;

        logToConsole("Starting 0...255 sweep...");

        let clkVal = 0;
        for (let i = 0; i < 256; i++) {
            if (clkSelection === '1/0') {
                clkVal = 1;
                await performTransaction(i, i, clkVal, rstVal, enaVal, true);
                clkVal = 0;
                await performTransaction(i, i, clkVal, rstVal, enaVal, true);
            } else {
                clkVal = parseInt(clkSelection);
                await performTransaction(i, i, clkVal, rstVal, enaVal, true);
            }

            // Yield to main thread every 16 iterations
            if (i % 16 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        updateDiagram();
        logToConsole("Sweep complete (256 cycles added)");
        sweepInputsBtn.disabled = false;
    });

    async function importFromCsv(file) {
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) return;

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const colMap = {};
            ['ui_in', 'uio_in', 'clk', 'rst_n', 'ena'].forEach(col => {
                colMap[col] = headers.indexOf(col);
            });

            logToConsole(`Importing ${lines.length - 1} transactions from CSV...`);

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

                const parseVal = (val) => {
                    if (val.startsWith('0x')) return parseInt(val.substring(2), 16);
                    return parseInt(val, 10);
                };

                const uiInVal = colMap.ui_in !== -1 ? parseVal(values[colMap.ui_in]) : 0;
                const uioInVal = colMap.uio_in !== -1 ? parseVal(values[colMap.uio_in]) : 0;
                const clkVal = colMap.clk !== -1 ? parseVal(values[colMap.clk]) : 0;
                const rstVal = colMap.rst_n !== -1 ? parseVal(values[colMap.rst_n]) : 1;
                const enaVal = colMap.ena !== -1 ? parseVal(values[colMap.ena]) : 1;

                await performTransaction(uiInVal, uioInVal, clkVal, rstVal, enaVal, true);

                // Yield to main thread every 10 rows
                if (i % 10 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            updateDiagram();
            logToConsole('CSV import complete');
        } catch (e) {
            console.error('Failed to import CSV', e);
            logToConsole('Error importing CSV');
        }
    }

    exportCsvBtn.addEventListener('click', exportToCsv);

    importCsvBtn.addEventListener('click', () => {
        importCsvFile.click();
    });

    importCsvFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importFromCsv(e.target.files[0]);
            // Clear the value so the same file can be imported again
            e.target.value = '';
        }
    });

    document.querySelectorAll('.diagram-type').forEach(select => {
        select.addEventListener('change', updateDiagram);
    });

    function applyDiagramScaling(mode) {
        if (mode === 'details') {
            diagramImg.classList.remove('fit-width');
            diagramImg.classList.add('more-details');
        } else {
            diagramImg.classList.remove('more-details');
            diagramImg.classList.add('fit-width');
        }
        localStorage.setItem('diagramScaling', mode);
    }

    diagramScaling.addEventListener('change', (e) => {
        applyDiagramScaling(e.target.value);
    });

    // Initialize scaling from localStorage
    const savedScaling = localStorage.getItem('diagramScaling') || 'fit';
    diagramScaling.value = savedScaling;
    applyDiagramScaling(savedScaling);

    clearDataBtn.addEventListener('click', () => {
        historyData.length = 0;
        cycleCount = 0;
        historyBody.innerHTML = '';
        consoleDiv.textContent = '';

        // Reset WASM DigitalTwin state if available
        if (digitalTwin) {
            try {
                // Perform a hard reset in simulation
                digitalTwin.set_rst_n(false);
                digitalTwin.step();
                digitalTwin.step();
                digitalTwin.set_rst_n(true);
                digitalTwin.step();
                logToConsole('Simulation state reset');
            } catch (e) {
                console.error('Failed to reset DigitalTwin', e);
            }
        }

        logToConsole('History and console cleared');
    });

    copyPermalinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            logToConsole('Permalink copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy permalink', err);
            logToConsole('Failed to copy permalink');
        });
    });

    async function fetchWasmEngines() {
        try {
            logToConsole('Fetching WASM engines and project titles from GitHub...');
            // Fetch WASM files
            const wasmFilesResponse = await fetch('https://api.github.com/repos/chatelao/tt-test-framework/contents/wasm');
            if (!wasmFilesResponse.ok) throw new Error(`HTTP error fetching wasm! status: ${wasmFilesResponse.status}`);
            const wasmFiles = await wasmFilesResponse.json();
            const engines = wasmFiles.filter(f => f.name.endsWith('.js')).map(f => f.name.replace('.js', ''));

            // Fetch data files for titles
            const dataFilesResponse = await fetch('https://api.github.com/repos/chatelao/tt-test-framework/contents/src/data');
            if (!dataFilesResponse.ok) throw new Error(`HTTP error fetching data! status: ${dataFilesResponse.status}`);
            const dataFiles = await dataFilesResponse.json();

            // Map project number to title (e.g. tt3990 -> fp8_mul)
            const titleMap = {};
            dataFiles.forEach(f => {
                if (f.name.endsWith('.yaml')) {
                    const match = f.name.match(/^(tt\d+)[_-](.+)\.yaml$/);
                    if (match) {
                        titleMap[match[1]] = match[2];
                    }
                }
            });

            // Populate dropdown
            engines.forEach(engine => {
                const option = document.createElement('option');
                option.value = engine;
                const title = titleMap[engine] || '';
                option.textContent = `${engine} ${title}`.trim();
                wasmEngineSelect.appendChild(option);
            });

            // Ensure the selection is restored after populating
            wasmEngineSelect.value = window.currentWasmEngine;
            logToConsole(`Fetched ${engines.length} WASM engines`);
        } catch (e) {
            console.error('Failed to fetch WASM engines', e);
            logToConsole('Failed to fetch WASM engines from GitHub');
        }
    }

    fetchWasmEngines();

    async function fetchTestsets() {
        try {
            const response = await fetch('https://api.github.com/repos/chatelao/tt-test-framework/contents/src/data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const files = await response.json();

            const yamlFiles = files.filter(file => file.name.endsWith('.yaml'));

            testsetSelect.innerHTML = '<option value="">Select a testset...</option>';
            yamlFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.download_url;
                option.textContent = file.name;
                testsetSelect.appendChild(option);
            });
            logToConsole(`Fetched ${yamlFiles.length} testsets from GitHub`);

            // Handle permalink
            const urlParams = new URLSearchParams(window.location.search);
            const projectName = urlParams.get('project');
            if (projectName) {
                logToConsole(`Permalink detected for project: ${projectName}`);
                const options = Array.from(testsetSelect.options);
                const targetOption = options.find(opt => opt.textContent === `${projectName}.yaml`);
                if (targetOption) {
                    testsetSelect.value = targetOption.value;
                    loadTestsetBtn.click();
                } else {
                    logToConsole(`Project ${projectName} not found in testsets`);
                }
            }
        } catch (e) {
            console.error('Failed to fetch testsets', e);
            logToConsole('Failed to fetch testsets from GitHub');
            testsetSelect.innerHTML = '<option value="">Error loading testsets</option>';
        }
    }

    fetchTestsets();

    function githubToRaw(url) {
        if (!url) return url;
        if (url.includes('github.com') && url.includes('/blob/')) {
            return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }
        return url;
    }

    let mdChapters = [];

    function parseMarkdown(md) {
        const lines = md.split('\n');
        const chapters = [];
        let currentChapter = { title: 'General', tables: [] };
        let currentTable = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect Chapters (Headers)
            if (line.startsWith('#')) {
                const title = line.replace(/^#+\s*/, '');
                currentChapter = { title, tables: [] };
                chapters.push(currentChapter);
                continue;
            }

            // Detect Tables
            if (line.startsWith('|') && lines[i + 1] && lines[i + 1].trim().includes('|--')) {
                const headers = line.split('|').map(h => h.trim()).filter(h => h !== '');
                currentTable = { headers, rows: [] };
                i++; // Skip separator line
                i++;
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    const row = lines[i].split('|').map(v => v.trim()).filter((v, idx, arr) => idx > 0 && idx < arr.length - 1);
                    currentTable.rows.push(row);
                    i++;
                }
                if (currentTable.rows.length > 0) {
                    currentChapter.tables.push(currentTable);
                }
                currentTable = null;
                i--; // Adjust for outer loop
            }
        }
        return chapters;
    }

    fetchMdBtn.addEventListener('click', async () => {
        const urlRaw = mdUrlInput.value.trim();
        const url = githubToRaw(urlRaw);
        if (!url) {
            alert('Please enter a Markdown URL');
            return;
        }

        try {
            logToConsole(`Fetching Markdown from ${url}...`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const mdText = await response.text();

            mdChapters = parseMarkdown(mdText);
            mdTableSelect.innerHTML = '<option value="">Select a table...</option>';

            let tableCount = 0;
            mdChapters.forEach((chapter, cIdx) => {
                chapter.tables.forEach((table, tIdx) => {
                    const option = document.createElement('option');
                    option.value = `${cIdx}-${tIdx}`;
                    option.textContent = `${chapter.title} - Table ${tIdx + 1}`;
                    mdTableSelect.appendChild(option);
                    tableCount++;
                });
            });

            logToConsole(`Found ${tableCount} tables in Markdown`);
            mdTableInfo.textContent = `Found ${tableCount} tables. Select one and click Run Table.`;
            if (tableCount > 0) {
                mdTableSelect.disabled = false;
                runMdTableBtn.disabled = false;
            }
        } catch (e) {
            console.error('Failed to fetch Markdown', e);
            logToConsole('Failed to fetch Markdown');
            mdTableInfo.textContent = 'Error loading Markdown.';
        }
    });

    function parseCycle(cycleStr) {
        if (cycleStr.includes('-')) {
            const parts = cycleStr.split('-').map(p => parseInt(p.trim()));
            return { start: parts[0], end: parts[1] };
        }
        return { start: parseInt(cycleStr), end: parseInt(cycleStr) };
    }

    function parseMdValue(val, cycle) {
        val = val.trim().replace(/`/g, '');
        if (val === '') return undefined;
        if (val.startsWith('0x')) {
            // Handle expressions like 0x80+cycle
            if (val.includes('+')) {
                const parts = val.split('+');
                const base = parseInt(parts[0], 16);
                if (parts[1].trim() === 'cycle') {
                    return (base + cycle) & 0xFF;
                }
            }
            return parseInt(val, 16);
        }
        if (!isNaN(parseInt(val))) return parseInt(val);
        return undefined;
    }

    runMdTableBtn.addEventListener('click', async () => {
        const selection = mdTableSelect.value;
        if (!selection) return;

        const [cIdx, tIdx] = selection.split('-').map(Number);
        const table = mdChapters[cIdx].tables[tIdx];
        if (!table) return;

        logToConsole(`Running Markdown table: ${mdChapters[cIdx].title}`);
        runMdTableBtn.disabled = true;

        const colMap = {};
        table.headers.forEach((h, idx) => {
            const header = h.toLowerCase();
            if (header.includes('ui_in')) colMap.ui_in = idx;
            if (header.includes('uio_in')) colMap.uio_in = idx;
            if (header.includes('uo_out')) colMap.uo_out = idx;
            if (header.includes('uio_out')) colMap.uio_out = idx;
            if (header.includes('uio_oe')) colMap.uio_oe = idx;
            if (header.includes('cycle')) colMap.cycle = idx;
        });

        let lastUi = getBits(uiIn);
        let lastUio = getBits(uioIn);
        const rstVal = rstN.checked ? 1 : 0;
        const enaVal = ena.checked ? 1 : 0;
        const clkSelection = clk.value;

        let passCount = 0;
        let failCount = 0;
        let totalChecks = 0;

        for (const row of table.rows) {
            const cycleInfo = colMap.cycle !== undefined ? parseCycle(row[colMap.cycle]) : { start: 0, end: 0 };

            for (let c = cycleInfo.start; c <= cycleInfo.end; c++) {
                const uiVal = colMap.ui_in !== undefined ? (parseMdValue(row[colMap.ui_in], c) ?? lastUi) : lastUi;
                const uioVal = colMap.uio_in !== undefined ? (parseMdValue(row[colMap.uio_in], c) ?? lastUio) : lastUio;

                lastUi = uiVal;
                lastUio = uioVal;

                let results;
                if (clkSelection === '1/0') {
                    await performTransaction(uiVal, uioVal, 1, rstVal, enaVal);
                    results = await performTransaction(uiVal, uioVal, 0, rstVal, enaVal);
                } else {
                    const clkVal = parseInt(clkSelection);
                    results = await performTransaction(uiVal, uioVal, clkVal, rstVal, enaVal);
                }

                // Verification
                const expected = {
                    uo_out: colMap.uo_out !== undefined ? parseMdValue(row[colMap.uo_out], c) : undefined,
                    uio_out: colMap.uio_out !== undefined ? parseMdValue(row[colMap.uio_out], c) : undefined,
                    uio_oe: colMap.uio_oe !== undefined ? parseMdValue(row[colMap.uio_oe], c) : undefined
                };

                let stepPassed = true;
                let stepDetails = [];

                for (const key in expected) {
                    if (expected[key] !== undefined) {
                        totalChecks++;
                        if (results[key] === expected[key]) {
                            stepDetails.push(`${key}: Match (0x${results[key].toString(16).toUpperCase().padStart(2, '0')})`);
                        } else {
                            stepPassed = false;
                            stepDetails.push(`${key}: MISMATCH! Expected 0x${expected[key].toString(16).toUpperCase().padStart(2, '0')}, Got 0x${results[key].toString(16).toUpperCase().padStart(2, '0')}`);
                        }
                    }
                }

                if (stepDetails.length > 0) {
                    if (stepPassed) {
                        passCount++;
                        logToConsole(`Cycle ${c} PASSED: ${stepDetails.join(', ')}`);
                    } else {
                        failCount++;
                        logToConsole(`Cycle ${c} FAILED: ${stepDetails.join(', ')}`);
                    }
                }

                await new Promise(r => setTimeout(r, 0));
            }
        }

        const summary = `Execution complete. Passed: ${passCount}, Failed: ${failCount}, Total checks: ${totalChecks}`;
        logToConsole(summary);
        mdTableInfo.textContent = summary;
        runMdTableBtn.disabled = false;
    });

    runTestsetBtn.addEventListener('click', async () => {
        if (!currentTestset || !currentTestset.test_steps) return;

        logToConsole(`Running testset: ${currentTestset.project || 'Unnamed'}`);
        runTestsetBtn.disabled = true;

        // Initial state from UI
        let uiVal = getBits(uiIn);
        let uioVal = getBits(uioIn);
        let rstVal = rstN.checked ? 1 : 0;
        let enaVal = ena.checked ? 1 : 0;
        let clkVal = 0; // Start with clk low for consistency
        const clkSelection = clk.value;

        for (const step of currentTestset.test_steps) {
            logToConsole(`Executing step: ${step.name || 'unnamed'}`);

            // Update state from step values if present
            if (step.values) {
                if (step.values.ui_in !== undefined) uiVal = step.values.ui_in & 0xFF;
                if (step.values.uio_in !== undefined) uioVal = step.values.uio_in & 0xFF;
                if (step.values.rst_n !== undefined) rstVal = step.values.rst_n ? 1 : 0;
                if (step.values.ena !== undefined) enaVal = step.values.ena ? 1 : 0;
            }

            const numCycles = step.cycles || 1;
            for (let i = 0; i < numCycles; i++) {
                if (clkSelection === '1/0') {
                    // Toggle clock
                    clkVal = 1;
                    await performTransaction(uiVal, uioVal, clkVal, rstVal, enaVal);
                    clkVal = 0;
                    await performTransaction(uiVal, uioVal, clkVal, rstVal, enaVal);
                } else {
                    clkVal = parseInt(clkSelection);
                    await performTransaction(uiVal, uioVal, clkVal, rstVal, enaVal);
                }
                // Yield to main thread
                await new Promise(r => setTimeout(r, 0));
            }
        }
        logToConsole('Testset execution complete');
        runTestsetBtn.disabled = false;
    });

    loadTestsetBtn.addEventListener('click', async () => {
        const url = testsetSelect.value;
        if (!url) {
            alert('Please select a testset first');
            return;
        }

        try {
            logToConsole(`Loading testset from ${url}...`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const yamlText = await response.text();

            currentTestset = jsyaml.load(yamlText);
            const projectName = currentTestset.project || 'Unknown Project';
            logToConsole(`Loaded testset: ${projectName}`);

            const selectedOption = testsetSelect.options[testsetSelect.selectedIndex];
            if (selectedOption && selectedOption.textContent.endsWith('.yaml')) {
                const fileName = selectedOption.textContent.replace('.yaml', '');
                updateURLParameter(fileName);
            } else {
                updateURLParameter(projectName);
            }

            testsetInfo.innerHTML = '';

            const projectDiv = document.createElement('div');
            const projectLabel = document.createElement('strong');
            projectLabel.textContent = 'Project: ';
            projectDiv.appendChild(projectLabel);
            projectDiv.appendChild(document.createTextNode(currentTestset.project || 'N/A'));
            testsetInfo.appendChild(projectDiv);

            if (currentTestset.metadata && currentTestset.metadata.source) {
                const sourceDiv = document.createElement('div');
                const sourceLabel = document.createElement('strong');
                sourceLabel.textContent = 'Source: ';
                sourceDiv.appendChild(sourceLabel);
                const sourceLink = document.createElement('a');
                sourceLink.href = currentTestset.metadata.source;
                sourceLink.target = '_blank';
                sourceLink.textContent = currentTestset.metadata.source;
                sourceDiv.appendChild(sourceLink);
                testsetInfo.appendChild(sourceDiv);
            }

            if (currentTestset.test_steps) {
                const stepsDiv = document.createElement('div');
                const stepsLabel = document.createElement('strong');
                stepsLabel.textContent = 'Steps: ';
                stepsDiv.appendChild(stepsLabel);
                stepsDiv.appendChild(document.createTextNode(currentTestset.test_steps.length));
                testsetInfo.appendChild(stepsDiv);
            }

            runTestsetBtn.disabled = false;
        } catch (e) {
            console.error('Failed to load testset', e);
            logToConsole('Failed to load testset');
            testsetInfo.textContent = 'Error loading testset.';
            runTestsetBtn.disabled = true;
        }
    });

    logToConsole('Tiny Tapeout Web Tester Initialized');
});
