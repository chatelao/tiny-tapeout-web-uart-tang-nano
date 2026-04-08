import http.server
import threading
import socketserver
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

def test_md_proposal():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)  # Wait for server to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Use add_init_script to mock fetch BEFORE app.js runs
        page.add_init_script("""
            window.fetch = async (url) => {
                const urlStr = (url && typeof url === 'object') ? url.url : url;
                if (!urlStr) return { ok: false };

                // Mock testset list
                if (urlStr.includes('tt-test-framework/contents/src/data')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => [
                            {
                                name: "tt3990_fp8_mul.yaml",
                                download_url: "https://raw.githubusercontent.com/chatelao/tt-test-framework/main/src/data/tt3990_fp8_mul.yaml"
                            }
                        ]
                    };
                }

                // Mock WASM engines list
                if (urlStr.includes('tt-test-framework/contents/wasm')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => []
                    };
                }

                // Mock testset content
                if (urlStr.includes('tt3990_fp8_mul.yaml')) {
                    return {
                        ok: true,
                        status: 200,
                        text: async () => `
project: "OCP MXFP8 Streaming MAC Unit"
metadata:
  source: "https://github.com/chatelao/ttihp-fp8-mul"
test_steps: []
`
                    };
                }

                // Mock GitHub Repo API
                if (urlStr.includes('api.github.com/repos/chatelao/ttihp-fp8-mul')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            default_branch: "ihp-sg13cmos5l"
                        })
                    };
                }

                return { ok: false, status: 404 };
            };
        """)

        page.goto(f"http://localhost:{PORT}")

        # Wait for testsets to load (use attached state because option might not be "visible" in the sense Playwright expects)
        page.wait_for_selector("#testsetSelect option[value*='tt3990']", state="attached")

        # Select the project
        page.select_option("#testsetSelect", label="tt3990_fp8_mul.yaml")

        # Load it
        page.click("#loadTestset")

        # Check if the MD URL was proposed correctly
        # Proposed Markdown URL: https://github.com/chatelao/ttihp-fp8-mul/blob/ihp-sg13cmos5l/docs/test.md
        expected_url = "https://github.com/chatelao/ttihp-fp8-mul/blob/ihp-sg13cmos5l/docs/test.md"

        # Need to wait for the async fetch to complete and update the input
        page.wait_for_function(f"document.getElementById('mdUrl').value === '{expected_url}'", timeout=5000)

        proposed_url = page.input_value("#mdUrl")
        assert proposed_url == expected_url
        print(f"Verified Proposed URL: {proposed_url}")

        # Now test the auto-load via wasm param
        page.goto(f"http://localhost:{PORT}/?wasm=tt3990")

        # No need to re-mock, add_init_script persists across navigations

        # Wait for the auto-load to complete
        page.wait_for_function(f"document.getElementById('mdUrl').value === '{expected_url}'", timeout=5000)
        proposed_url_auto = page.input_value("#mdUrl")
        assert proposed_url_auto == expected_url
        print(f"Verified Auto-loaded Proposed URL: {proposed_url_auto}")

        print("MD proposal test passed!")
        browser.close()

if __name__ == "__main__":
    test_md_proposal()
