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
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

def test_md_jump_link():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)  # Wait for server to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}")

        # Check if jump link exists and is hidden initially
        assert page.locator("#mdJumpToLink").is_hidden()

        # Set the URL
        md_url = "https://github.com/user/repo/blob/main/TEST_CASES.md"
        page.fill("#mdUrl", md_url)

        # Mock the fetch
        page.evaluate("""
            window.fetch = async (url) => {
                const urlStr = (url && typeof url === 'object') ? url.url : url;
                if (urlStr && typeof urlStr === 'string' && (urlStr.includes('TEST_CASES.md') || urlStr.includes('raw.githubusercontent.com'))) {
                    return {
                        ok: true,
                        status: 200,
                        text: async () => `
This is a table before any header.

| Cycle | ui_in | uio_in |
|---|---|---|
| 0 | 0x10 | 0x20 |

# Detailed Test Chapter

More info.

| Cycle | ui_in | uio_in |
|---|---|---|
| 0 | 0x10 | 0x20 |
`
                    };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ([])
                };
            };
        """)

        page.click("#fetchMd")

        # Wait for tables to be loaded
        page.wait_for_selector("#mdTableSelect option[value='0-0']", state="attached")
        page.wait_for_selector("#mdTableSelect option[value='1-0']", state="attached")

        # 1. Select 'General' table
        page.select_option("#mdTableSelect", "0-0")
        assert page.locator("#mdJumpToLink").is_hidden()

        # 2. Select 'Detailed Test Chapter' table
        page.select_option("#mdTableSelect", "1-0")
        assert page.locator("#mdJumpToLink").is_visible()

        href = page.get_attribute("#mdJumpToLink", "href")
        expected_href = md_url + "#detailed-test-chapter"
        assert href == expected_href

        # 3. Clear data and check if link is hidden
        page.click("#clearData")
        assert page.locator("#mdJumpToLink").is_hidden()

        browser.close()

if __name__ == "__main__":
    test_md_jump_link()
