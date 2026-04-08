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
            page.set_viewport_size({"width": 1280, "height": 1024})

            url = "http://localhost:8000/?wasm=tt3990"
            print(f"Navigating to {url}")
            page.goto(url)

            # Wait for WASM to be ready
            print("Waiting for WASM tt3990 to be ready...")
            page.wait_for_function("window.lastLogs && window.lastLogs.some(log => log.includes('WASM Simulation initialized: tt3990'))", timeout=20000)

            # Enable WASM Simulation
            if not page.is_checked("#useFullWasm"):
                page.check("#useFullWasm")

            # Load Markdown
            md_url = "https://github.com/chatelao/ttihp-fp8-mul/blob/ihp-sg13cmos5l/TEST_CASES.md"
            print(f"Loading Markdown from {md_url}")
            page.fill("#mdUrl", md_url)
            page.click("#fetchMd")

            # Wait for tables to load
            print("Waiting for tables to be parsed...")
            page.wait_for_selector("#mdTableSelect option:nth-child(2)", state="attached", timeout=20000)

            options = page.locator("#mdTableSelect option").all()
            table_values = []
            for i in range(1, len(options)):
                val = options[i].get_attribute("value")
                if val:
                    table_values.append(val)

            print(f"Found {len(table_values)} tables.")

            all_results = []

            for val in table_values:
                table_name = page.locator(f"#mdTableSelect option[value='{val}']").text_content()
                print(f"--- Running {table_name} ---")

                # Reset before each table
                page.click("#clearData")

                page.select_option("#mdTableSelect", val)
                page.click("#runMdTable")

                # Wait for execution to complete
                page.wait_for_function("document.getElementById('mdTableInfo').textContent.includes('Execution complete')", timeout=120000)

                # Capture logs for this table
                logs = page.evaluate("window.lastLogs")
                all_results.append(f"TABLE: {table_name}")
                all_results.extend(logs)
                all_results.append("-" * 40)

                # Clear logs for next table
                page.evaluate("window.lastLogs = []")

            with open("test_output_after_fix.log", "w") as f:
                for log in all_results:
                    f.write(log + "\n")

            print("Testing completed. Results saved to test_output_after_fix.log")
            browser.close()
    except Exception as e:
        print(f"An error occurred: {e}")
        raise e
    finally:
        if server_process:
            os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
