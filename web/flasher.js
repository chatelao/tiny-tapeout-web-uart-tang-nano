import { runOpenFPGALoader as openFPGALoader } from 'https://cdn.jsdelivr.net/npm/@yowasp/openfpgaloader@1.1.1-18.211/gen/bundle.js';

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('bitstreamInput');
    const flashBtn = document.getElementById('flashBtn');
    const flasherStatus = document.getElementById('flasherStatus');
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
            flasherStatus.textContent = "Ready to flash";
        } else {
            flasherStatus.textContent = "Ready";
        }
    });

    flashBtn.addEventListener('click', async () => {
        if (!fileInput.files.length) return;

        try {
            flashBtn.disabled = true;
            flashBtn.textContent = "Flashing...";
            flasherStatus.textContent = "Reading bitstream...";

            const file = fileInput.files[0];
            logToConsole(`Reading bitstream: ${file.name}...`);

            const arrayBuffer = await file.arrayBuffer();
            const bitstream = new Uint8Array(arrayBuffer);

            flasherStatus.textContent = "Requesting device...";
            logToConsole("Initializing JTAG and writing to SRAM...");

            const filesIn = {
                'bitstream.fs': bitstream
            };
            const args = ['-b', 'tangnano4k', '--write-sram', 'bitstream.fs'];

            const decoder = new TextDecoder();
            const logHandler = (bytes) => {
                if (bytes) {
                    const text = decoder.decode(bytes, { stream: true });
                    logToConsole(text);
                    if (text.includes('%')) {
                        flasherStatus.textContent = `Writing: ${text.trim()}`;
                    }
                }
            };

            await openFPGALoader(args, filesIn, {
                stdout: logHandler,
                stderr: logHandler
            });

            flasherStatus.textContent = "SRAM Flash Complete!";
            logToConsole("SRAM Flash Complete!");
        } catch (err) {
            flasherStatus.textContent = "Error: Flashing failed";
            logToConsole(`Error: ${err.message || err}`);
            console.error("Flashing failed:", err);
        } finally {
            flashBtn.disabled = false;
            flashBtn.textContent = "Flash to SRAM";
        }
    });

    logToConsole("SRAM Flasher Initialized");
    logToConsole("Note: This tool requires a browser with WebUSB support (e.g., Chrome, Edge).");
});
