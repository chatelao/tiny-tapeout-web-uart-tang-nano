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
    const sendReceiveBtn = document.getElementById('sendReceive');
    const exportCsvBtn = document.getElementById('exportCsv');
    const connectBtn = document.getElementById('connectBtn');
    const statusLabel = document.getElementById('statusLabel');
    const historyBody = document.getElementById('history');
    const consoleDiv = document.getElementById('console');
    const historyData = [];

    let port = null;
    let reader = null;
    let writer = null;
    let isConnected = false;

    // --- TT_SERIAL Mock Board ---
    const mockBoard = {
        ui_in: 0,
        uio_in: 0,
        clk: 0,
        rst_n: 1,
        ena: 1,
        processCommand: function(cmd) {
            cmd = cmd.trim();
            if (cmd === 'reset') return 'ok';

            // Compact Format: [ui_in][uio_in][ctrl] (6 hex chars)
            if (cmd.length === 6 && /^[0-9A-Fa-f]+$/.test(cmd)) {
                this.ui_in = parseInt(cmd.substring(0, 2), 16);
                this.uio_in = parseInt(cmd.substring(2, 4), 16);
                const ctrl = parseInt(cmd.substring(4, 6), 16);
                this.clk = ctrl & 1;
                this.rst_n = (ctrl >> 1) & 1;
                this.ena = (ctrl >> 2) & 1;

                const uo_out = (this.ui_in + this.uio_in) & 0xFF;
                const uio_out = 0x00;
                const uio_oe = 0x00;
                return uo_out.toString(16).padStart(2, '0').toUpperCase() +
                       uio_out.toString(16).padStart(2, '0').toUpperCase() +
                       uio_oe.toString(16).padStart(2, '0').toUpperCase();
            }

            // Short/Long formats would go here, but let's stick to Compact for the main logic
            return 'error';
        }
    };

    function logToConsole(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = type === 'error' ? 'ERROR: ' : (type === 'send' ? '-> ' : (type === 'recv' ? '<- ' : ''));
        consoleDiv.textContent += `[${timestamp}] ${prefix}${message}\n`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
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

    function addHistoryRow(inputs, outputs, timestamp) {
        const row = document.createElement('tr');

        const timeTd = document.createElement('td');
        timeTd.className = 'time-cell';
        timeTd.textContent = timestamp;
        row.appendChild(timeTd);

        const uiInTd = document.createElement('td');
        uiInTd.appendChild(createBitDisplay(inputs.ui_in));
        row.appendChild(uiInTd);

        const uioInTd = document.createElement('td');
        uioInTd.appendChild(createBitDisplay(inputs.uio_in));
        row.appendChild(uioInTd);

        [inputs.clk, inputs.rst_n, inputs.ena].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            row.appendChild(td);
        });

        const uoOutTd = document.createElement('td');
        uoOutTd.appendChild(createBitDisplay(outputs.uo_out));
        row.appendChild(uoOutTd);

        const uioOutTd = document.createElement('td');
        uioOutTd.appendChild(createBitDisplay(outputs.uio_out));
        row.appendChild(uioOutTd);

        const uioOeTd = document.createElement('td');
        uioOeTd.appendChild(createBitDisplay(outputs.uio_oe));
        row.appendChild(uioOeTd);

        const actionTd = document.createElement('td');
        actionTd.textContent = '-';
        row.appendChild(actionTd);

        historyBody.prepend(row);
    }

    function generatePlantUML() {
        if (historyData.length === 0) return "";

        let puml = "@startuml\n";
        puml += "concise \"ui_in\" as ui_in\n";
        puml += "concise \"uio_in\" as uio_in\n";
        puml += "binary \"clk\" as clk\n";
        puml += "binary \"rst_n\" as rst_n\n";
        puml += "binary \"ena\" as ena\n";
        puml += "concise \"uo_out\" as uo_out\n";
        puml += "concise \"uio_out\" as uio_out\n";
        puml += "concise \"uio_oe\" as uio_oe\n\n";

        let time = 0;
        historyData.forEach((t) => {
            puml += `@${time}\n`;
            puml += `ui_in is "0x${t.ui_in.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `uio_in is "0x${t.uio_in.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `clk is ${t.clk}\n`;
            puml += `rst_n is ${t.rst_n}\n`;
            puml += `ena is ${t.ena}\n`;
            puml += `uo_out is "0x${t.uo_out.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `uio_out is "0x${t.uio_out.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `uio_oe is "0x${t.uio_oe.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            time++;
        });

        puml += `@${time}\n`;
        puml += "@enduml";
        return puml;
    }

    async function encodePlantUML(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const cs = new CompressionStream('deflate-raw');
        const writer = cs.writable.getWriter();
        writer.write(data);
        writer.close();
        const response = new Response(cs.readable);
        const compressed = new Uint8Array(await response.arrayBuffer());
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

    async function performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal) {
        const timestamp = new Date().toLocaleTimeString();
        const inputs = {
            ui_in: uiValue,
            uio_in: uioInValue,
            clk: clkVal,
            rst_n: rstVal,
            ena: enaVal
        };

        const ctrl = clkVal | (rstVal << 1) | (enaVal << 2);
        const cmd = uiValue.toString(16).padStart(2, '0') +
                    uioInValue.toString(16).padStart(2, '0') +
                    ctrl.toString(16).padStart(2, '0');

        let responseLine = "";

        if (isConnected && writer && reader) {
            try {
                logToConsole(cmd, 'send');
                await writer.write(cmd + '\n');

                // Read response
                let { value, done } = await reader.read();
                if (done) {
                    throw new Error("Serial port closed");
                }
                responseLine = value.trim();
                logToConsole(responseLine, 'recv');
            } catch (e) {
                logToConsole(e.message, 'error');
                disconnect();
                return;
            }
        } else {
            // Simulation mode
            logToConsole(cmd + " (Sim)", 'send');
            responseLine = mockBoard.processCommand(cmd);
            logToConsole(responseLine + " (Sim)", 'recv');
        }

        if (responseLine.length === 6) {
            const uo_out = parseInt(responseLine.substring(0, 2), 16);
            const uio_out = parseInt(responseLine.substring(2, 4), 16);
            const uio_oe = parseInt(responseLine.substring(4, 6), 16);

            const outputs = {
                uo_out: uo_out,
                uio_out: uio_out,
                uio_oe: uio_oe
            };

            historyData.push({
                time: timestamp,
                ...inputs,
                ...outputs
            });

            addHistoryRow(inputs, outputs, timestamp);
            updateDiagram();
        } else {
            logToConsole("Invalid response: " + responseLine, 'error');
        }
    }

    async function connect() {
        if (!("serial" in navigator)) {
            // For testing in environments without WebSerial (like this sandbox)
            // or if we want to simulate connection
            if (window.confirm("WebSerial not supported in this browser. Use simulated connection?")) {
                isConnected = true;
                updateConnectionUI();
                logToConsole("Simulated connection established");
                return;
            }
            alert("WebSerial is not supported in this browser.");
            return;
        }

        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
            writer = textEncoder.writable.getWriter();

            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.getReader();

            isConnected = true;
            updateConnectionUI();
            logToConsole("Connected to " + (port.getInfo().usbVendorId || "device"));

            // Optional: send reset to sync
            await writer.write("reset\n");
            await reader.read(); // Consume 'ok'

        } catch (e) {
            logToConsole("Connection failed: " + e.message, 'error');
            isConnected = false;
            updateConnectionUI();
        }
    }

    async function disconnect() {
        isConnected = false;
        if (reader) {
            await reader.cancel();
            reader = null;
        }
        if (writer) {
            await writer.close();
            writer = null;
        }
        if (port) {
            await port.close();
            port = null;
        }
        updateConnectionUI();
        logToConsole("Disconnected");
    }

    function updateConnectionUI() {
        if (isConnected) {
            connectBtn.textContent = "Simulation";
            connectBtn.classList.add('connected');
            statusLabel.textContent = "Mode: Real Hardware";
        } else {
            connectBtn.textContent = "Connect";
            connectBtn.classList.remove('connected');
            statusLabel.textContent = "Mode: Simulation";
        }
    }

    connectBtn.addEventListener('click', () => {
        if (isConnected) {
            disconnect();
        } else {
            connect();
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

    function exportToCsv() {
        if (historyData.length === 0) {
            alert('No history to export');
            return;
        }

        const headers = ['Time', 'ui_in', 'uio_in', 'clk', 'rst_n', 'ena', 'uo_out', 'uio_out', 'uio_oe'];
        const csvRows = [headers.join(',')];

        for (const row of historyData) {
            const values = [
                `"${row.time}"`,
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

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    exportCsvBtn.addEventListener('click', exportToCsv);

    logToConsole('Tiny Tapeout Web Tester Initialized');
});
