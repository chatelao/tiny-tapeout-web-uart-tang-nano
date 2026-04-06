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

            page = context.new_page()
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

            print("Navigating to http://localhost:8000")
            page.goto("http://localhost:8000")

            # Enable WASM Simulation
            print("Checking #useFullWasm")
            page.check("#useFullWasm")

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

                # Wait for page reload (since app.js reloads on change)
                page.wait_for_load_state("networkidle")

                # Re-enable WASM Simulation if it was reset by reload
                if not page.is_checked("#useFullWasm"):
                    page.check("#useFullWasm")

                # Wait for WASM to be ready
                print(f"Waiting for WASM {project} to be ready...")
                try:
                    # We look for the message in the console log
                    # This might fail if it happened before we started waiting
                    with page.expect_console_message(lambda m: f"CONSOLE_MSG: WASM Simulation initialized: {project}" in m.text, timeout=10000):
                        pass
                except:
                     # Check if it is already in the div
                     content = page.evaluate("document.getElementById('console').textContent")
                     if f"WASM Simulation initialized: {project}" not in content:
                         print(f"WARNING: Could not confirm WASM {project} is initialized. Content: {content}")
                         # Let's wait a bit more just in case
                         time.sleep(2)

                # Step 1: 0xDD
                print(f"Executing step 1: 0xDD for {project}")
                page.fill("#ui_in_hex", "DD")
                page.press("#ui_in_hex", "Enter")

                page.click("#sendReceive")
                page.wait_for_function("window.lastLog && window.lastLog.includes('Received (Emulated WASM)')", timeout=10000)
                page.evaluate("window.lastLog = ''")

                # Step 2: 0x55
                print(f"Executing step 2: 0x55 for {project}")
                page.fill("#ui_in_hex", "55")
                page.press("#ui_in_hex", "Enter")

                page.click("#sendReceive")
                page.wait_for_function("window.lastLog && window.lastLog.includes('Received (Emulated WASM)')", timeout=10000)
                page.evaluate("window.lastLog = ''")

            print("WASM Project switching test completed!")
            browser.close()
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
