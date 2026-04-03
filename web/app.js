document.addEventListener('DOMContentLoaded', () => {
    const uiIn = document.getElementById('ui_in').querySelectorAll('input');
    const uioIn = document.getElementById('uio_in').querySelectorAll('input');
    const clk = document.getElementById('clk');
    const rstN = document.getElementById('rst_n');
    const ena = document.getElementById('ena');
    const uoOut = document.getElementById('uo_out').querySelectorAll('.bit');
    const uioOut = document.getElementById('uio_out').querySelectorAll('.bit');
    const uioOe = document.getElementById('uio_oe').querySelectorAll('.bit');
    const sendReceiveBtn = document.getElementById('sendReceive');
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

    function setBits(elements, value) {
        elements.forEach((el, index) => {
            const bit = (value >> (7 - index)) & 1;
            el.textContent = bit;
            if (bit) {
                el.classList.add('high');
            } else {
                el.classList.remove('high');
            }
        });
    }

    sendReceiveBtn.addEventListener('click', () => {
        const uiValue = getBits(uiIn);
        const uioInValue = getBits(uioIn);
        const clkVal = clk.checked ? 1 : 0;
        const rstVal = rstN.checked ? 1 : 0;
        const enaVal = ena.checked ? 1 : 0;

        logToConsole(`Sending: ui_in=0x${uiValue.toString(16).padStart(2, '0')}, uio_in=0x${uioInValue.toString(16).padStart(2, '0')}, clk=${clkVal}, rst_n=${rstVal}, ena=${enaVal}`);

        // Emulate behavior: Summing ui_in and uio_in as seen in the template
        const result = (uiValue + uioInValue) & 0xFF;

        // Update mock outputs
        setBits(uoOut, result);
        setBits(uioOut, 0);
        setBits(uioOe, 0);

        logToConsole(`Received (Emulated): uo_out=0x${result.toString(16).padStart(2, '0')}`);
    });

    logToConsole('Tiny Tapeout Web Tester Initialized');
    logToConsole('Note: WebSerial functionality is TBD');
});
