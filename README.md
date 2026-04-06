# Tiny Tapeout Web Serial for Tang Nano 4K

## Goal
Create a [Webinterface](https://chatelao.github.io/tiny-tapeout-web-uart-tang-nano/) based on WebSerial for Tiny Tapeout designs running to a Tang Nano 4K.

## Default Architecture
- **WebSerial**: The Browser communicates to the board over "WebSerial".
- **Static Webpage**: The web access is handled with a simple static webpage, hosted on GitHub Pages, but deployable anywhere else.

## Architecture Diagram
The diagram below shows the high-level integration of the Tiny Tapeout Web Serial interface with the Host PC and the Tang Nano 4K board.

![Architecture Diagram](https://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/chatelao/tiny-tapeout-web-uart-tang-nano/main/architecture.puml)

## Supported Tiny Tapeout Web Serial Features

For detailed information on the Web Serial API features utilized in this project, please refer to the **[Web Serial API Documentation](SERIAL_PORT_ACCESS.md)**.

### Key Capabilities:
- **Port Detection & Filtering**: Target specific hardware via USB `vendorId` and `productId`.
- **Interface Configuration**: Support for custom baud rates, data bits, stop bits, and parity.
- **Asynchronous I/O**: High-performance streaming with native backpressure management.
- **Hardware Flow Control**: Direct manipulation and monitoring of physical control lines (DTR, RTS, etc.).
- **Hot-Plugging**: Real-time detection of device connection and disconnection.

## Memory Layout

### Memory Regions (System Memory Map)

| Region - Role | Capacity | Base Address | Binary | Tiny Tapeout Web Serial Usage |
| :--- | :--- | :--- | :--- | :--- |
| **FPGA Cfg. Flash**     | ~200 KB  | -            | `bitstream.fs`     | SoC Internal Config Flash (Instant-on)       |
| **M3 Int. Boot-Flash**  |   32 KB* | `0x00000000` | `firmware_int.bin` | Vector Table & Reset Handler                 |
| **M3 Internal SRAM**    |   22 KB  | `0x20000000` | -                  | Stack (2KB) & Fast Heap (~18KB)              |
| **M3 APB2 Devices** |   16 B   | `0x40002400` | -                  | TT Wrapper, Slot (1/12): TT Control and Data |

*\* Note: Internal Flash address space is 128 KB, but physical hardware on Tang Nano 4K is limited to 32 KB.*

## Project Structure

| Path | Description | Status |
| :--- | :--- | :--- |
| `/` | Root directory with relevant `.md` files | Present |
| `/definitions` | Datasheets and Standards to be used | Planned |
| `/examples` | Example data scripts | Planned |
| `/examples/tt_projects` | Example Tiny-Tapeout FPGA projects | Planned |
| `/test` | Unit, System and End-2-End test concepts and cases | Planned |
| `/src` | Source files (only accepted if working and covered by tests) | Planned |
| `/.github/workflows` | CI/CD for release tag publish the installer/binary | Planned |
| `AUDIT.md` | Comprehensive project audit report | Planned |
| `COMPLIANCE_TESTS.md` | Tiny Tapeout Web Serial compliance testing results | Planned |
| `GEMINI.md` | Project goal and structural guidelines | Present |
| `HOWTO_TINY_TAPEOUT.md` | Guide to loading and testing Tiny Tapeout modules | Planned |
| `PMOD_PINOUT.md` | Documentation of common PMOD pinouts | Present |
| `README.md` | Overview of the product | Present |
| `ROADMAP.md` | Progress tracking and future steps | Planned |
| `SERIAL_PORT_ACCESS.md` | Guide to accessing the Cortex-M3 serial port | Present |
| `TOOLCHAIN_SETUP.md` | Instructions for setting up the toolchains | Planned |
| `WASM_INTEGRATION.md` | Documentation for the WASM simulation interface | Present |

## UART Configuration
The Tiny Tapeout Web Serial REPL is accessible via the Cortex-M3 UART0 peripheral.

## Pinout Tang Nano 4K

<img width="720" height="517" alt="image" src="https://github.com/user-attachments/assets/47908f11-3643-4ec7-9593-debdb9dc6cd9" />

### Onboard Peripherals

| Component | Pin | Bank | Logic |
| :--- | :--- | :--- | :--- |
| **LED** | 10 | 0 | Active-low |
| **Button 1 (S1)** | 15 | 3 | Active-high |
| **Button 2 (S2)** | 14 | 3 | Active-high |
| **System Clock** | 45 | 1 | 27 MHz Crystal |

### HDMI Interface (TMDS)

| Signal | Pin (+) | Pin (-) | Bank |
| :--- | :--- | :--- | :--- |
| **TMDS Lane 0** (Blue) | 30 | 29 | 2 |
| **TMDS Lane 1** (Green) | 32 | 31 | 2 |
| **TMDS Lane 2** (Red) | 35 | 34 | 2 |
| **TMDS Clock** | 28 | 27 | 2 |

### System & Programming

| Function | Pins | Bank | Description |
| :--- | :--- | :--- | :--- |
| **JTAG** | 3, 4, 6, 7, 8 | 0 | TDI, TDO, TMS, TCK, JTAGSEL_N |
| **SPI Flash** | 1, 2, 47, 48 | 0/1 | MCLK, MCS, MISO, MOSI |
| **UART0 (REPL)** | 44 (TX) | 3 | Debug Console, GPIO27 on BL702 (RX) |
| **UART0 (REPL)** | 46 (RX) | 3 | Debug Console, GPIO26 on BL702 (TX) |

### Available Header Pins

| Bank | Pins | Expected Voltage (VCCIO) |
| :--- | :--- | :--- |
| **Bank 0** | 9 (DONE) | 1.8V |
| **Bank 1** | 39, 40, 41, 42, 43, 44, 46 | 1.8V |
| **Bank 2** | 33 | 1.8V |
| **Bank 3** | 13, 16, 17, 20, 21, 22, 23 | 1.8V |

*Note: JTAG and Flash pins should be avoided for general use to maintain programmability. While the GW1NSR supports multiple I/O standards, this project's default configuration sets all VCCIO banks to 1.8V.*

## IP Core Configuration (Gowin EDA)

Setting up the SoC subsystem on the Tang Nano 4K requires specific IP core configurations in Gowin EDA:

| Feature / IP Core | Configuration / Notes |
| :--- | :--- |
| **Cortex-M3 (Gowin_EMPU_M3)** | Enable APB expansion to allow the M3 to communicate with logic in the FPGA fabric |
| **APB2 Expansion** | Each slot (256 bytes) is mapped starting at `0x40002400` |

For step-by-step instructions and pin constraints, see the **[M3-FPGA Integration Guide](M3_FPGA_INTEGRATIONS.md#3-apb2-expansion-slots)**.

### Installation with Gowin Programmer

| Step | Description | Details / Parameters |
| :--- | :--- | :--- |
| 1 | **Build** | Compile firmware |
| 2 | **Flash FPGA Bitstream** | Flash the `.fs` file |
| 3 | **Flash Internal Flash** | Access Mode: `MCU Mode`<br>Operation: `Flash Erase, Program, Verify`<br>File: `build/firmware_int.bin` |

For more details on M3-FPGA integration, see [M3_FPGA_INTEGRATIONS.md](M3_FPGA_INTEGRATIONS.md).

## Progress
Update `ROADMAP.md` for the current status and upcoming tasks.
