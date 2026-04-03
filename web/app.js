document.addEventListener('DOMContentLoaded', () => {
    const transactionHistory = [];
    const uiIn = document.getElementById('ui_in').querySelectorAll('input');
    const uioIn = document.getElementById('uio_in').querySelectorAll('input');
    const clk = document.getElementById('clk');
    const rstN = document.getElementById('rst_n');
    const ena = document.getElementById('ena');
    const sendReceiveBtn = document.getElementById('sendReceive');
    const historyBody = document.getElementById('history');
    const consoleDiv = document.getElementById('console');

    function logToConsole(message) {
        const timestamp = new Date().toLocaleTimeString();
        consoleDiv.textContent += `[${timestamp}] ${message}\n`;
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
        return container;
    }

    function addHistoryRow(inputs, outputs) {
        const row = document.createElement('tr');
        const timestamp = new Date().toLocaleTimeString();

        // Time
        const timeTd = document.createElement('td');
        timeTd.className = 'time-cell';
        timeTd.textContent = timestamp;
        row.appendChild(timeTd);

        // ui_in
        const uiInTd = document.createElement('td');
        uiInTd.appendChild(createBitDisplay(inputs.ui_in));
        row.appendChild(uiInTd);

        // uio_in
        const uioInTd = document.createElement('td');
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
        uioOutTd.appendChild(createBitDisplay(outputs.uio_out));
        row.appendChild(uioOutTd);

        // uio_oe
        const uioOeTd = document.createElement('td');
        uioOeTd.appendChild(createBitDisplay(outputs.uio_oe));
        row.appendChild(uioOeTd);

        // Action placeholder
        const actionTd = document.createElement('td');
        actionTd.textContent = '-';
        row.appendChild(actionTd);

        historyBody.prepend(row);
    }

    function generatePlantUML() {
        if (transactionHistory.length === 0) return "";

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
        transactionHistory.forEach((t) => {
            puml += `@${time}\n`;
            puml += `ui_in is "0x${t.inputs.ui_in.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `uio_in is "0x${t.inputs.uio_in.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `clk is ${t.inputs.clk}\n`;
            puml += `rst_n is ${t.inputs.rst_n}\n`;
            puml += `ena is ${t.inputs.ena}\n`;
            puml += `uo_out is "0x${t.outputs.uo_out.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `uio_out is "0x${t.outputs.uio_out.toString(16).toUpperCase().padStart(2, '0')}"\n`;
            puml += `uio_oe is "0x${t.outputs.uio_oe.toString(16).toUpperCase().padStart(2, '0')}"\n`;
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

    function performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal) {
        const inputs = {
            ui_in: uiValue,
            uio_in: uioInValue,
            clk: clkVal,
            rst_n: rstVal,
            ena: enaVal
        };

        logToConsole(`Sending: ui_in=0x${uiValue.toString(16).padStart(2, '0')}, uio_in=0x${uioInValue.toString(16).padStart(2, '0')}, clk=${clkVal}, rst_n=${rstVal}, ena=${enaVal}`);

        // Emulate behavior: Summing ui_in and uio_in
        const result = (uiValue + uioInValue) & 0xFF;

        const outputs = {
            uo_out: result,
            uio_out: 0,
            uio_oe: 0
        };

        transactionHistory.push({ inputs: { ...inputs }, outputs: { ...outputs } });
        addHistoryRow(inputs, outputs);
        logToConsole(`Received (Emulated): uo_out=0x${result.toString(16).padStart(2, '0')}`);
        updateDiagram();
    }

    sendReceiveBtn.addEventListener('click', () => {
        const uiValue = getBits(uiIn);
        const uioInValue = getBits(uioIn);
        const rstVal = rstN.checked ? 1 : 0;
        const enaVal = ena.checked ? 1 : 0;
        const clkSelection = clk.value;

        if (clkSelection === '1/0') {
            performTransaction(uiValue, uioInValue, 1, rstVal, enaVal);
            performTransaction(uiValue, uioInValue, 0, rstVal, enaVal);
        } else {
            const clkVal = parseInt(clkSelection);
            performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal);
        }
    });

    logToConsole('Tiny Tapeout Web Tester Initialized');
    logToConsole('Note: WebSerial functionality is TBD');
});
