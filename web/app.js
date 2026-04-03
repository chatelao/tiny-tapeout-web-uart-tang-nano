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
    const importCsvBtn = document.getElementById('importCsv');
    const importCsvFile = document.getElementById('importCsvFile');
    const clearDataBtn = document.getElementById('clearData');
    const testsetSelect = document.getElementById('testsetSelect');
    const loadTestsetBtn = document.getElementById('loadTestset');
    const runTestsetBtn = document.getElementById('runTestset');
    const copyPermalinkBtn = document.getElementById('copyPermalink');
    const diagramScaling = document.getElementById('diagram-scaling');
    const diagramImg = document.getElementById('diagram-img');
    const testsetInfo = document.getElementById('testsetInfo');
    const historyBody = document.getElementById('history');
    const consoleDiv = document.getElementById('console');
    const testerTable = document.querySelector('.tester-table');

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

        // Action placeholder
        const actionTd = document.createElement('td');
        actionTd.textContent = '-';
        row.appendChild(actionTd);

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

        const channels = ['ui_in', 'uio_in', 'clk', 'rst_n', 'ena', 'uo_out', 'uio_out', 'uio_oe'];
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

        // Definitions
        channels.forEach(ch => {
            const type = config[ch];
            if (type === 'hidden') return;

            if (type === 'bits') {
                for (let i = 7; i >= 0; i--) {
                    puml += `binary "${ch}[${i}]" as ${ch}_${i}\n`;
                }
            } else if (type === 'binary') {
                puml += `binary "${ch}" as ${ch}\n`;
            } else {
                puml += `concise "${ch}" as ${ch}\n`;
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
                            puml += `${ch} is "0x${val.toString(16).toUpperCase().padStart(2, '0')}"\n`;
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

    function performTransaction(uiValue, uioInValue, clkVal, rstVal, enaVal, skipUpdate = false) {
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
        if (!skipUpdate) updateDiagram();
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

                performTransaction(uiInVal, uioInVal, clkVal, rstVal, enaVal, true);

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
        historyBody.innerHTML = '';
        consoleDiv.textContent = '';
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

    runTestsetBtn.addEventListener('click', async () => {
        if (!currentTestset || !currentTestset.test_steps) return;

        logToConsole(`Running testset: ${currentTestset.project || 'Unnamed'}`);
        runTestsetBtn.disabled = true;

        // Initial state from UI
        let uiVal = getBits(uiIn);
        let uioVal = getBits(uioIn);
        let rstVal = rstN.checked ? 1 : 0;
        let enaVal = ena.checked ? 1 : 0;
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
                    performTransaction(uiVal, uioVal, 1, rstVal, enaVal);
                    performTransaction(uiVal, uioVal, 0, rstVal, enaVal);
                } else {
                    const cVal = parseInt(clkSelection);
                    performTransaction(uiVal, uioVal, cVal, rstVal, enaVal);
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
    logToConsole('Note: WebSerial functionality is TBD');
});
