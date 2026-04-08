import http.server
import threading
import socketserver
import os
import time
from playwright.sync_api import sync_playwright

PORT = 8005
DIRECTORY = "web"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

def test_markdown_loading():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)  # Wait for server to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}")

        # Check if new UI elements exist
        assert page.is_visible("#mdUrl")
        assert page.is_visible("#fetchMd")
        assert page.is_visible("#mdTableSelect")
        assert page.is_visible("#runMdTable")

        # Set the URL
        md_url = "https://raw.githubusercontent.com/chatelao/ttihp-fp8-mul/ihp-sg13cmos5l/TEST_CASES.md"
        page.fill("#mdUrl", md_url)

        # Mock the fetch or just let it fetch if internet is available
        # To be safe and fast, let's mock the fetch
        page.evaluate("""
            window.fetch = async (url) => {
                const urlStr = (url && typeof url === 'object') ? url.url : url;
                if (urlStr && typeof urlStr === 'string' && urlStr.includes('TEST_CASES.md')) {
                    return {
                        ok: true,
                        text: async () => `
# Test Chapter
| Cycle | ui_in | uio_in | Description |
|:---:|:---:|:---:|---|
| 0 | 0x10 | 0x20 | Start |
| 1-2 | 0x30 | 0x40 | Range |
| 3 | 0x80+cycle | 0x00 | Expr |
`
                    };
                }
                return { ok: false };
            };
        """)

        page.click("#fetchMd")

        # Wait for table to be loaded in dropdown
        page.wait_for_selector("#mdTableSelect option[value='0-0']", state="attached")

        # Select the table
        page.select_option("#mdTableSelect", "0-0")

        # Run the table
        page.click("#runMdTable")

        # Check console logs for expected transactions
        # We expect cycles 0, 1, 2, 3.
        # Cycle 0: ui=0x10, uio=0x20
        # Cycle 1: ui=0x30, uio=0x40
        # Cycle 2: ui=0x30, uio=0x40
        # Cycle 3: ui=0x83, uio=0x00 (0x80 + 3 = 0x83)

        expected_msgs = [
            "Sending: ui_in=0x10, uio_in=0x20",
            "Sending: ui_in=0x30, uio_in=0x40", # for cycle 1
            "Sending: ui_in=0x30, uio_in=0x40", # for cycle 2
            "Sending: ui_in=0x83, uio_in=0x00"  # for cycle 3
        ]

        # In '1/0' clock mode (default), each performTransaction is called twice if clk selection is 1/0
        # Actually in my implementation:
        # if (clkSelection === '1/0') {
        #     await performTransaction(uiVal, uioVal, 1, rstVal, enaVal);
        #     await performTransaction(uiVal, uioVal, 0, rstVal, enaVal);
        # }

        # So we expect 2 transactions per cycle.

        # Let's check the console for these messages
        console_content = page.inner_text("#console")
        for msg in expected_msgs:
            assert msg in console_content
            print(f"Verified: {msg}")

        print("Markdown loading test passed!")
        browser.close()

if __name__ == "__main__":
    test_markdown_loading()
