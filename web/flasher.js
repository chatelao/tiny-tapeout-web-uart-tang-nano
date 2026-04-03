import { openFPGALoader } from 'https://cdn.jsdelivr.net/npm/@yowasp/openfpgaloader/dist/web.js';

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('bitstreamInput');
    const flashBtn = document.getElementById('flashBtn');
    const consoleDiv = document.getElementById('console');

    function logToConsole(message) {
        const timestamp = new Date().toLocaleTimeString();
        consoleDiv.textContent += `[${timestamp}] ${message}\n`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    fileInput.addEventListener('change', () => {
        flashBtn.disabled = !fileInput.files.length;
        if (fileInput.files.length) {
            logToConsole(`Selected file: ${fileInput.files[0].name}`);
        }
    });

    flashBtn.addEventListener('click', async () => {
        if (!fileInput.files.length) return;

        try {
            flashBtn.disabled = true;
            const file = fileInput.files[0];
            logToConsole(`Reading bitstream: ${file.name}...`);

            const arrayBuffer = await file.arrayBuffer();
            const bitstream = new Uint8Array(arrayBuffer);

            logToConsole("Requesting WebUSB device (BL702)...");
            const device = await navigator.usb.requestDevice({
                filters: [{ vendorId: 0x0403, productId: 0x6010 }]
            });

            logToConsole("Initializing JTAG and writing to SRAM...");
            // Redirecting openFPGALoader output to console if possible would be nice,
            // but the basic implementation uses console.log internally often.
            await openFPGALoader.flash(device, bitstream, { board: 'tangnano4k', target: 'sram' });

            logToConsole("SRAM Flash Complete!");
        } catch (err) {
            logToConsole(`Error: ${err.message || err}`);
            console.error("Flashing failed:", err);
        } finally {
            flashBtn.disabled = false;
        }
    });

    logToConsole("SRAM Flasher Initialized");
    logToConsole("Note: This tool requires a browser with WebUSB support (e.g., Chrome, Edge).");
});
