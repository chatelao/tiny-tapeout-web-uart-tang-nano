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
    const clearDataBtn = document.getElementById('clearData');
    const historyBody = document.getElementById('history');
    const consoleDiv = document.getElementById('console');
    const historyData = [];

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

    function performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal) {
        const timestamp = new Date().toLocaleTimeString();
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

        historyData.push({
            time: timestamp,
            ...inputs,
            ...outputs
        });

        addHistoryRow(inputs, outputs, timestamp);
        logToConsole(`Received (Emulated): uo_out=0x${result.toString(16).padStart(2, '0')}`);
    }

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

        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
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

    exportCsvBtn.addEventListener('click', exportToCsv);

    clearDataBtn.addEventListener('click', () => {
        historyData.length = 0;
        historyBody.innerHTML = '';
        consoleDiv.textContent = '';
        logToConsole('History and console cleared');
    });

    logToConsole('Tiny Tapeout Web Tester Initialized');
    logToConsole('Note: WebSerial functionality is TBD');
});
