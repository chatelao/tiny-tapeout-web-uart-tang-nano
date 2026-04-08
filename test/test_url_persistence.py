import http.server
import threading
import socketserver
import time
from playwright.sync_api import sync_playwright
import pytest

PORT = 8010
DIRECTORY = "web"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

@pytest.fixture(scope="module", autouse=True)
def server():
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)
    yield

def test_url_persistence():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock fetch
        page.add_init_script("""
            window.fetch = async (url) => {
                const urlStr = (url && typeof url === 'object') ? url.url : url;
                if (!urlStr) return { ok: false };

                if (urlStr.includes('tt-test-framework/contents/src/data')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => [
                            {
                                name: "tt3990_fp8_mul.yaml",
                                download_url: "https://raw.githubusercontent.com/chatelao/tt-test-framework/main/src/data/tt3990_fp8_mul.yaml"
                            },
                            {
                                name: "tt3647_systolic.yaml",
                                download_url: "https://raw.githubusercontent.com/chatelao/tt-test-framework/main/src/data/tt3647_systolic.yaml"
                            }
                        ]
                    };
                }

                if (urlStr.includes('tt-test-framework/contents/wasm')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => [
                            { name: "tt3990.js", download_url: "" },
                            { name: "tt3647.js", download_url: "" }
                        ]
                    };
                }

                if (urlStr.includes('tt3990_fp8_mul.yaml')) {
                    return {
                        ok: true,
                        status: 200,
                        text: async () => `
project: "tt3990"
metadata:
  source: "https://github.com/chatelao/ttihp-fp8-mul"
test_steps: []
`
                    };
                }

                if (urlStr.includes('api.github.com/repos/chatelao/ttihp-fp8-mul')) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ default_branch: "main" })
                    };
                }

                if (urlStr.includes('raw.githubusercontent.com/chatelao/ttihp-fp8-mul/main/docs/test.md')) {
                    return {
                        ok: true,
                        status: 200,
                        text: async () => "# Test\\n| ui_in | uo_out |\\n|---|---|\\n| 0x01 | 0x01 |"
                    };
                }

                return { ok: false, status: 404 };
            };
        """)

        page.goto(f"http://localhost:{PORT}/?wasm=tt3990&project=tt3990_fp8_mul")

        # 1. Verify WASM/Project clearing on WASM change
        page.wait_for_selector("#wasmEngineSelect")
        # Wait for options to load (state="attached" since options might be considered hidden by Playwright)
        page.wait_for_selector("#wasmEngineSelect option[value='tt3647']", state="attached")

        page.select_option("#wasmEngineSelect", "tt3647")
        # Page should reload
        page.wait_for_load_state("networkidle")

        # URL should have wasm=tt3647 and NO project
        url = page.url
        print(f"URL after WASM change: {url}")
        assert "wasm=tt3647" in url
        assert "project=" not in url
        print("Verified: Changing WASM clears project parameter")

        # 2. Verify mdUrl persistence and auto-fetch
        # Go to tt3990 to trigger auto-proposal
        page.goto(f"http://localhost:{PORT}/?wasm=tt3990")

        # Wait for auto-proposal and auto-fetch
        expected_md_url = "https://github.com/chatelao/ttihp-fp8-mul/blob/main/docs/test.md"
        page.wait_for_function(f"document.getElementById('mdUrl').value === '{expected_md_url}'")

        # Wait for tables to be loaded (auto-fetch triggered)
        page.wait_for_selector("#mdTableSelect option[value='0-0']", state="attached")

        # URL should now contain mdUrl
        url = page.url
        print(f"URL after MD fetch: {url}")
        assert "mdUrl=" in url
        print("Verified: mdUrl is persisted in URL after fetch")

        # 3. Verify auto-load on refresh
        page.reload()
        page.wait_for_load_state("networkidle")

        page.wait_for_function(f"document.getElementById('mdUrl').value === '{expected_md_url}'")
        page.wait_for_selector("#mdTableSelect option[value='0-0']", state="attached")
        print("Verified: mdUrl is auto-loaded and fetched on refresh")

        browser.close()

if __name__ == "__main__":
    test_url_persistence()
