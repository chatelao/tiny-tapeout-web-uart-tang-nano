import http.server
import threading
import socketserver
import os
import time
from playwright.sync_api import sync_playwright

PORT = 8007
DIRECTORY = "web"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

def test_markdown_verification():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)  # Wait for server to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}")

        # Mock the fetch and XOR behavior
        # XOR: uo_out = ui_in ^ uio_in
        page.evaluate("""
            window.fetch = async (url) => {
                const urlStr = (url && typeof url === 'object') ? url.url : url;
                if (urlStr && urlStr.includes('TEST_CASES.md')) {
                    return {
                        ok: true,
                        text: async () => `
# Test Verification
| Cycle | ui_in | uio_in | uo_out | Description |
|:---:|:---:|:---:|:---:|---|
| 0 | 0x10 | 0x20 | 0x30 | Match (10 ^ 20 = 30) |
| 1 | 0x10 | 0x20 | 0xFF | Mismatch |
`
                    };
                }
                return { ok: true, json: async () => [] };
            };
        """)

        page.fill("#mdUrl", "https://raw.githubusercontent.com/chatelao/ttihp-fp8-mul/ihp-sg13cmos5l/TEST_CASES.md")
        page.click("#fetchMd")

        page.wait_for_selector("#mdTableSelect option[value='0-0']", state="attached")
        page.select_option("#mdTableSelect", "0-0")

        page.click("#runMdTable")

        # Wait for summary
        page.wait_for_selector("#mdTableInfo:has-text('Execution complete')")

        console_content = page.inner_text("#console")
        print(console_content)

        assert "Cycle 0 PASSED: uo_out: Match (0x30)" in console_content
        assert "Cycle 1 FAILED: uo_out: MISMATCH! Expected 0xFF, Got 0x30" in console_content
        assert "Execution complete. Passed: 1, Failed: 1, Total checks: 2" in console_content

        assert "Execution complete. Passed: 1, Failed: 1, Total checks: 2" in page.inner_text("#mdTableInfo")

        print("Markdown verification test passed!")
        browser.close()

if __name__ == "__main__":
    test_markdown_verification()
