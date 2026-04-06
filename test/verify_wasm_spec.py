import os
import time
import subprocess
from playwright.sync_api import sync_playwright

# Configuration
PORT = 8001
DIRECTORY = "web"

def test_wasm_spec_compliance():
    # Start the server separately in bash or use subprocess here
    # Assuming the server is started outside or we start it here
    server_process = subprocess.Popen(["python3", "-m", "http.server", str(PORT), "--directory", DIRECTORY],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()

            # Inject mock factory BEFORE page load
            context.add_init_script("""
                window.mockCalls = [];
                class MockProjectWasm {
                    constructor() {
                        console.log("Mock constructor called");
                        window.mockCalls.push('constructor');
                    }
                    eval() {
                        console.log("Mock eval called");
                        window.mockCalls.push('eval');
                    }
                    set_ui_in(val) {
                        console.log("Mock set_ui_in called", val);
                        window.mockCalls.push(['set_ui_in', val]);
                    }
                    set_uio_in(val) {
                        console.log("Mock set_uio_in called", val);
                        window.mockCalls.push(['set_uio_in', val]);
                    }
                    set_ena(val) {
                        console.log("Mock set_ena called", val);
                        window.mockCalls.push(['set_ena', val]);
                    }
                    set_clk(val) {
                        console.log("Mock set_clk called", val);
                        window.mockCalls.push(['set_clk', val]);
                    }
                    set_rst_n(val) {
                        console.log("Mock set_rst_n called", val);
                        window.mockCalls.push(['set_rst_n', val]);
                    }
                    get_uo_out() { return 0x42; }
                    get_uio_out() { return 0x11; }
                    get_uio_oe() { return 0x22; }
                }
                window.tt3404 = async function(config) {
                    console.log("Mock factory called");
                    return {
                        ProjectWasm: MockProjectWasm
                    };
                };
            """)

            page = context.new_page()

            # Capture console logs
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

            # Intercept WASM JS load to prevent it from overwriting our mock
            page.route("**/tt3404.js", lambda route: route.fulfill(
                status=200,
                content_type="application/javascript",
                body="// Mocked by test"
            ))

            page.goto(f"http://localhost:{PORT}/index.html?wasm=tt3404", wait_until="networkidle")

            # Wait for the app to initialize
            page.wait_for_selector("#useFullWasm")

            # Enable WASM simulation
            page.evaluate("document.getElementById('useFullWasm').checked = true; document.getElementById('useFullWasm').dispatchEvent(new Event('change'));")

            # Trigger a transaction (Send button)
            # We need to set some values first
            page.evaluate("document.getElementById('ui_in_hex').value = 'AA'; document.getElementById('ui_in_hex').dispatchEvent(new Event('input'));")

            # Wait a bit for the UI to be ready and and then click
            page.wait_for_timeout(1000)
            page.click("#sendReceive")

            # Wait for calls to be recorded
            page.wait_for_timeout(2000)

            calls = page.evaluate("window.mockCalls")
            print(f"Recorded calls for Send: {calls}")

            # Check for spec compliance in Send transaction
            # Expecting set_ui_in, set_uio_in, set_ena, set_rst_n, set_clk, and eval.

            # Verify eval was called
            assert 'eval' in calls, "eval() was not called"

            # Verify set_clk was called (since it's a 1/0 clock by default)
            assert any(isinstance(c, list) and c[0] == 'set_clk' for c in calls), "set_clk() was not called"

            # Now test Reset button (clearDataBtn)
            page.evaluate("window.mockCalls.length = 0;")
            page.click("#clearData")
            page.wait_for_timeout(1000)

            reset_calls = page.evaluate("window.mockCalls")
            print(f"Recorded calls for Reset: {reset_calls}")

            # Spec-compliant reset sequence: set_rst_n(false), set_clk(false), eval(), set_rst_n(true), eval()
            # Note: set_clk(false) might not be called if set_clk is not used elsewhere or if it's already false.
            # But app.js now explicitly calls it if available.

            # Filter for the essential reset sequence calls
            filtered_reset = [c for c in reset_calls if (isinstance(c, list) and c[0] in ['set_rst_n', 'set_clk']) or c == 'eval']

            print(f"Filtered reset calls: {filtered_reset}")

            # Verify the sequence
            assert ['set_rst_n', False] in filtered_reset
            assert ['set_rst_n', True] in filtered_reset
            assert filtered_reset.count('eval') >= 2

            print("WASM spec compliance verification PASSED!")

            browser.close()
    finally:
        server_process.terminate()

if __name__ == "__main__":
    try:
        test_wasm_spec_compliance()
    except Exception as e:
        print(f"Test FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
