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
            page = browser.new_page()
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

            print("Navigating to http://localhost:8000/projects.html")
            page.goto("http://localhost:8000/projects.html")

            # 1. Verify page title and header
            expect(page).to_have_title("Tiny Tapeout Projects")
            expect(page.locator("h1")).to_have_text("Tiny Tapeout Projects")

            # 2. Wait for projects to load
            print("Waiting for projects to load...")
            page.wait_for_selector(".project-card", timeout=30000)

            initial_count = page.locator(".project-card").count()
            print(f"Loaded {initial_count} projects.")
            assert initial_count > 100 # Should have lots of projects

            # 3. Test search functionality
            print("Testing search for 'tt3990'...")
            page.fill("#projectSearch", "tt3990")

            # Wait for filter
            time.sleep(1)

            filtered_count = page.locator(".project-card").count()
            print(f"Filtered count for 'tt3990': {filtered_count}")
            assert filtered_count >= 1
            expect(page.locator(".project-card").first).to_contain_text("tt3990")

            # 4. Clear search and test title search
            print("Testing search for 'mul'...")
            page.fill("#projectSearch", "")
            page.fill("#projectSearch", "mul")

            time.sleep(1)

            mul_count = page.locator(".project-card").count()
            print(f"Filtered count for 'mul': {mul_count}")
            assert mul_count >= 1

            # 5. Test clicking a project
            print("Clicking project tt3990...")
            page.fill("#projectSearch", "tt3990")
            time.sleep(1)
            page.click(".project-card")

            # Verify navigation back to index.html with wasm parameter
            page.wait_for_load_state("networkidle")
            url = page.url
            print(f"Navigated to URL: {url}")
            assert "index.html" in url
            assert "wasm=tt3990" in url

            # 6. Verify "Select Project" button on main page
            print("Verifying 'Select Project' button on index.html...")
            page.goto("http://localhost:8000")
            expect(page.locator("#selectProjectBtn")).to_be_visible()
            page.click("#selectProjectBtn")

            page.wait_for_load_state("networkidle")
            assert "projects.html" in page.url
            print("'Select Project' button navigation verified.")

            print("Projects page test passed!")
            browser.close()
    except Exception as e:
        print(f"An error occurred: {e}")
        if 'page' in locals():
            page.screenshot(path="projects_test_failure.png")
            print("Screenshot saved to projects_test_failure.png")
        raise e
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
