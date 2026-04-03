# Project Goal
- Create a Webinterface based on WebSerial for Tiny Tapeout designs running to a Tang Nano 4K.

# Default Architecture
- **WebSerial**: The Browser communicates to the board over "WebSerial".
- **Static Webpage**: The web access is handled with a simple static webpage, hosted on GitHub Pages, but deployable anywhere else.

# Planning & Progress tracking
- Keep an up to date file `ROADMAP.md` with the next 5 steps and all past steps having checkboxes.

# Project structure
- `/` - Keep root directory clean with relevant `.md` files: `AUDIT.md`, `COMPLIANCE_TESTS.md`, `GEMINI.md`, `HOWTO_TINY_TAPEOUT.md`, `M3_FPGA_INTEGRATIONS.md`, `M3_MICROPYTHON.md`, `README.md`, `ROADMAP.md`, `SERIAL_PORT_ACCESS.md`, `TOOLCHAIN_SETUP.md`.
- `/definitions` - Datasheets and Standards to be used, download and convert to `.md` on first time read.
- `/examples` - Example data scripts
- `/examples/tt_projects` - Example Tiny-Tapeout FPGA projects.
- `/test` - Unit, System and End-2-End test concepts and cases to be executed after each change. Use Renode to verify the binaries.
- `/src` - Source files, only accepted if working and covered by tests.
- `/.github/workflows` - For release tag publish the installer/binary.
- `README.md` - Update overview of the product.
