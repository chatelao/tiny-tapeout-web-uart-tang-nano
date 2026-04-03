import subprocess
import time
import os
import signal
import json
from playwright.sync_api import sync_playwright, expect

def run_test():
    server_process = subprocess.Popen(
        ["python3", "-m", "http.server", "8000", "--directory", "web"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(2)  # Wait for server to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()

            # Mock navigator.serial
            context.add_init_script("""
                const mockPort = {
                    open: async () => { console.log('Mock: port open called'); },
                    close: async () => { console.log('Mock: port close called'); },
                    writable: {
                        getWriter: () => ({
                            write: async (data) => {
                                const decoder = new TextDecoder();
                                const text = decoder.decode(data);
                                console.log('Mock: serial write: ' + text);
                                window.lastWrittenSerial = text;
                                // Simulate response after a short delay
                                if (text === 'reset\\n') {
                                    window.postMessage({ type: 'serial-rx', data: 'ok\\n' }, '*');
                                } else if (text.includes(';')) {
                                    // Respond with uo;01;uio;02;uio_oe;03\n
                                    window.postMessage({ type: 'serial-rx', data: 'uo;01;uio;02;uio_oe;03\\n' }, '*');
                                }
                            },
                            releaseLock: () => { console.log('Mock: writer releaseLock called'); }
                        })
                    },
                    readable: {
                        getReader: () => ({
                            read: async () => {
                                console.log('Mock: reader read called');
                                return new Promise(resolve => {
                                    const handler = (event) => {
                                        if (event.data && event.data.type === 'serial-rx') {
                                            window.removeEventListener('message', handler);
                                            const encoder = new TextEncoder();
                                            console.log('Mock: reader returning data: ' + event.data.data);
                                            resolve({ value: encoder.encode(event.data.data), done: false });
                                        }
                                    };
                                    window.addEventListener('message', handler);
                                });
                            },
                            cancel: async () => { console.log('Mock: reader cancel called'); },
                            releaseLock: () => { console.log('Mock: reader releaseLock called'); }
                        })
                    }
                };

                Object.defineProperty(navigator, 'serial', {
                    value: {
                        requestPort: async () => {
                            console.log('Mock: requestPort called');
                            return mockPort;
                        }
                    },
                    configurable: true
                });
            """)

            page = context.new_page()
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

            page.goto("http://localhost:8000")

            # 1. Verify initial state
            expect(page.locator("#connectBtn")).to_have_text("Connect")
            expect(page.locator("#statusLabel")).to_have_text("Simulation Mode")

            # 2. Click Connect
            print("Clicking Connect...")
            page.click("#connectBtn")

            expect(page.locator("#connectBtn")).to_have_text("Simulation")
            expect(page.locator("#statusLabel")).to_have_text("Connected")

            # 3. Perform a Send
            print("Filling UI In...")
            # Set ui_in to 0x10 via hex input
            page.fill("#ui_in_hex", "10")
            page.press("#ui_in_hex", "Enter")

            print("Clicking Send...")
            page.click("#sendReceive")

            # Wait for console to show received data
            expect(page.locator("#console")).to_contain_text("Received (Serial): uo_out=0x01", timeout=5000)

            # Verify history row has correct values
            history_first_row = page.locator("#history tr").first
            expect(history_first_row).to_contain_text("0x01") # uo_out

            # 4. Click Simulation (to disconnect)
            print("Clicking Simulation (to disconnect)...")
            page.click("#connectBtn")

            expect(page.locator("#connectBtn")).to_have_text("Connect")
            expect(page.locator("#statusLabel")).to_have_text("Simulation Mode")

            # 5. Perform a Send in Simulation mode
            print("Clicking Send in simulation mode...")
            page.click("#sendReceive")
            expect(page.locator("#console")).to_contain_text("Received (Emulated): uo_out=0x10", timeout=5000)

            print("WebSerial functionality test passed!")
            browser.close()
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
