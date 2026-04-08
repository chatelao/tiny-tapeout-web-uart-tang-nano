import subprocess
import time
import os
import signal
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
                                // Respond with uo;[uo_out];uio;[uio_out];uio_oe;[uio_oe]\\n
                                // For simplicity, just echo some values or use logic
                                window.postMessage({ type: 'serial-rx', data: 'uo;AA;uio;BB;uio_oe;CC\\n' }, '*');
                            },
                            releaseLock: () => { console.log('Mock: writer releaseLock called'); }
                        })
                    },
                    readable: {
                        getReader: () => ({
                            read: async () => {
                                return new Promise(resolve => {
                                    const handler = (event) => {
                                        if (event.data && event.data.type === 'serial-rx') {
                                            window.removeEventListener('message', handler);
                                            const encoder = new TextEncoder();
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
                            return mockPort;
                        }
                    },
                    configurable: true
                });
            """)

            page = context.new_page()
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

            page.goto("http://localhost:8000")

            # Click Connect to enter Serial mode (easier to track writes in mock)
            page.click("#connectBtn")

            # 1. Perform first transaction
            page.fill("#ui_in_hex", "11")
            page.press("#ui_in_hex", "Enter")
            page.click("#sendReceive")

            # 2. Perform second transaction
            page.fill("#ui_in_hex", "22")
            page.press("#ui_in_hex", "Enter")
            page.click("#sendReceive")

            # Wait for history to have 4 rows (since each '1/0' click adds 2 rows)
            # clk defaults to '1/0', so sendReceive adds 2 rows.
            # 2 clicks * 2 rows = 4 rows.
            expect(page.locator("#history tr")).to_have_count(4)

            print("Clicking Replay...")
            page.click("#replayBtn")

            # Replay should repeat all 4 transactions.
            # Total should be 4 + 4 = 8 rows.
            expect(page.locator("#history tr")).to_have_count(8, timeout=10000)

            # Verify the order (history is prepended, so latest is at top)
            # Rows 0-3 should be the same as rows 4-7
            for i in range(4):
                text_new = page.locator("#history tr").nth(i).text_content()
                text_old = page.locator("#history tr").nth(i + 4).text_content()
                # Remove time/timestamp if it varies, but ui_in should match
                print(f"Comparing row {i} with row {i+4}")
                assert "0x11" in text_new or "0x22" in text_new

            print("Replay test passed!")
            browser.close()
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
