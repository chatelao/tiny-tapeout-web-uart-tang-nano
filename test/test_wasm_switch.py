import subprocess
import time
import os
import signal
import sys
from playwright.sync_api import sync_playwright, expect

def run_test():
    # Kill any existing server on port 8000
    subprocess.run(["fuser", "-k", "8000/tcp"], stderr=subprocess.DEVNULL)

    server_process = subprocess.Popen(
        ["python3", "-m", "http.server", "8000", "--directory", "web"],
        stdout=sys.stdout,
        stderr=sys.stderr
    )
    time.sleep(2)  # Wait for server to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()

            # Inject script to capture console-log events
            context.add_init_script("""
                window.lastLogs = [];
                window.addEventListener('console-log', (e) => {
                    window.lastLogs.push(e.detail);
                });
            """)

            page = context.new_page()
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

            print("Navigating to http://localhost:8000")
            page.goto("http://localhost:8000")

            # Wait for the dropdown to be populated
            print("Waiting for WASM engines to load...")
            page.wait_for_selector("#wasmEngineSelect option:nth-child(2)", state="attached", timeout=30000)

            # Get the first 10 projects (excluding 'default')
            options = page.locator("#wasmEngineSelect option").all()
            project_values = []
            for i in range(1, min(11, len(options))):
                val = options[i].get_attribute("value")
                if val and val != "default":
                    project_values.append(val)

            print(f"Testing projects: {project_values}")

            if not project_values:
                 print("No projects found to test.")
                 return

            for project in project_values:
                print(f"--- Testing Project: {project} ---")

                # Select the project
                page.select_option("#wasmEngineSelect", project)

                # Wait for page reload
                page.wait_for_load_state("networkidle")

                # Re-enable WASM Simulation if it was reset by reload
                # Also check if it's already checked due to localStorage
                if not page.is_checked("#useFullWasm"):
                    page.check("#useFullWasm")

                # Wait for WASM to be ready
                print(f"Waiting for WASM {project} to be ready...")
                page.wait_for_function(f"window.lastLogs && window.lastLogs.some(log => log.includes('WASM Simulation initialized: {project}'))", timeout=20000)

                # Step 1: 0xDD
                print(f"Executing step 1: 0xDD for {project}")
                page.fill("#ui_in_hex", "DD")
                page.press("#ui_in_hex", "Enter")

                page.click("#sendReceive")

                # Wait for "Received (Emulated WASM)"
                page.wait_for_function("window.lastLogs && window.lastLogs.some(log => log.includes('Received (Emulated WASM)'))", timeout=10000)

                # Verify it's actually in the console div too
                expect(page.locator("#console")).to_contain_text("Received (Emulated WASM)", timeout=5000)

                # Clear logs for next step
                page.evaluate("window.lastLogs = []")

                # Step 2: 0x55
                print(f"Executing step 2: 0x55 for {project}")
                page.fill("#ui_in_hex", "55")
                page.press("#ui_in_hex", "Enter")

                page.click("#sendReceive")
                page.wait_for_function("window.lastLogs && window.lastLogs.some(log => log.includes('Received (Emulated WASM)'))", timeout=10000)
                expect(page.locator("#console")).to_contain_text("Received (Emulated WASM)", timeout=5000)

                # Clear logs for next project
                page.evaluate("window.lastLogs = []")

            print("WASM Project switching test completed!")
            browser.close()
    except Exception as e:
        print(f"An error occurred: {e}")
        # Take a screenshot on failure
        if 'page' in locals():
            page.screenshot(path="wasm_switch_failure.png")
            print("Screenshot saved to wasm_switch_failure.png")
        raise e
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
