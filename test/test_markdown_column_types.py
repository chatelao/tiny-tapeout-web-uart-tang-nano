import http.server
import threading
import socketserver
import os
import time
from playwright.sync_api import sync_playwright

PORT = 8006
DIRECTORY = "web"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

def test_markdown_column_types():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)  # Wait for server to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}")

        # Mock the fetch
        page.evaluate("""
            window.fetch = async (url) => {
                let urlStr = url;
                if (url && typeof url === 'object') {
                    urlStr = url.url || url.toString();
                }

                if (typeof urlStr === 'string') {
                    if (urlStr.includes('test_types.md')) {
                        return {
                            ok: true,
                            text: async () => `
# Type Test
| Cycle | ui_in (E4M3) | uio_in (Bits) | uo_out (Dual FP4) | Description |
|:---:|:---:|:---:|:---:|---|
| 0 | 0x38 | 0xAA | 0x00 | Test |
`
                        };
                    }
                    if (urlStr.includes('api.github.com')) {
                        return {
                            ok: true,
                            json: async () => []
                        };
                    }
                }
                return { ok: false, status: 404 };
            };
        """)

        page.fill("#mdUrl", "https://example.com/test_types.md")
        page.click("#fetchMd")

        # Wait for table to be loaded in dropdown
        page.wait_for_selector("#mdTableSelect option[value='0-0']", state="attached")

        # Select the table
        page.select_option("#mdTableSelect", "0-0")

        # Run the table
        page.click("#runMdTable")

        # Verify dropdowns
        ui_in_type = page.eval_on_selector("#table-type-ui_in", "el => el.value")
        uio_in_type = page.eval_on_selector("#table-type-uio_in", "el => el.value")
        uo_out_type = page.eval_on_selector("#table-type-uo_out", "el => el.value")

        print(f"ui_in type: {ui_in_type}")
        print(f"uio_in type: {uio_in_type}")
        print(f"uo_out type: {uo_out_type}")

        assert ui_in_type == "fp8_e4m3"
        assert uio_in_type == "bits"
        assert uo_out_type == "dual_fp4"

        print("Markdown column types test passed!")
        browser.close()

if __name__ == "__main__":
    test_markdown_column_types()
