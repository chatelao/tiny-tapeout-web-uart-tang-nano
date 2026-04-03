# Common PMOD Pinouts for Tiny Tapeout

This document summarizes the recommended pinouts for common peripherals and protocols used with Tiny Tapeout designs. Using these common pinouts makes it easier to reuse boards and connect external hardware.

Refer to the [Digilent Pmod Documentation](https://digilent.com/reference/pmod/start) and the [Pmod Interface Specification](https://digilent.com/reference/pmod/specification) for official hardware standards.

## Common Peripherals

### UART to USB
Used for interacting with the design over a serial console via the builtin RP2040 on the demo board. Based on [Pmod USBUART](https://digilent.com/reference/pmod/pmodusbuart/start).

| Signal | Option 1 | Option 2 |
| :--- | :--- | :--- |
| **RX** | `ui_in[3]` | `ui_in[7]` |
| **TX** | `uo_out[4]` | `uo_out[0]` |

### VGA Output
Recommended pinout for the [Tiny VGA](https://github.com/mole99/tiny-vga) board and [Pmod VGA](https://digilent.com/reference/pmod/pmodvga/start).

| Signal | Pin |
| :--- | :--- |
| **R1** | `uo_out[0]` |
| **G1** | `uo_out[1]` |
| **B1** | `uo_out[2]` |
| **vsync** | `uo_out[3]` |
| **R0** | `uo_out[4]` |
| **G0** | `uo_out[5]` |
| **B0** | `uo_out[6]` |
| **hsync** | `uo_out[7]` |

### Audio Output
Recommended pinout for the [TT Audio Pmod](https://github.com/MichaelBell/tt-audio-pmod), [Pmod I2S2](https://digilent.com/reference/pmod/pmodi2s2/start), or [Pmod AMP2](https://digilent.com/reference/pmod/pmodamp2/start).

| Signal | Pin (Mono) | Pin (Stereo Left) | Pin (Stereo Right) |
| :--- | :--- | :--- | :--- |
| **Audio Output** | `uio_out[7]` or `uo_out[7]` | `uio_out[6]` or `uo_out[6]` | `uio_out[7]` or `uo_out[7]` |

### SPI RAM
Default configuration for [spi-ram-emu](https://github.com/MichaelBell/spi-ram-emu/) and [Pmod SPIRAM](https://digilent.com/reference/pmod/pmodspiram/start).

| Signal | Pin |
| :--- | :--- |
| **CS** | `uio[0]` |
| **MOSI** | `uio[1]` |
| **MISO** | `uio[2]` |
| **SCK** | `uio[3]` |

---

## Common Protocols

### SPI
Standard SPI pinouts for Pmod connectors.

| Signal | Top Row | Bottom Row | Alternative (Middle PMOD) |
| :--- | :--- | :--- | :--- |
| **CS** | `uio[0]` | `uio[4]` | `uo_out[4]` |
| **MOSI** | `uio[1]` | `uio[5]` | `uo_out[3]` |
| **MISO** | `uio[2]` | `uio[6]` | `ui_in[2]` |
| **SCK** | `uio[3]` | `uio[7]` | `uo_out[5]` |

### SPI - Dual/Quad I/O
Pinout for [Pmod SF3](https://digilent.com/reference/pmod/pmodsf3/start) or similar.

| Signal | Pin |
| :--- | :--- |
| **CS** | `uio[0]` |
| **SD0/MOSI** | `uio[1]` |
| **SD1/MISO** | `uio[2]` |
| **SCK** | `uio[3]` |
| **SD2 / NC** | `uio[4]` |
| **SD3 / RST** | `uio[5]` |
| **WP** | `uio[6]` |
| **HLD** | `uio[7]` |

### UART (with optional hardware flow control)
Standard UART pinouts for Pmod connectors.

| Signal | Top Row | Bottom Row |
| :--- | :--- | :--- |
| **CTS** (Optional) | `uio[0]` | `uio[4]` |
| **TXD** | `uio[1]` | `uio[5]` |
| **RXD** | `uio[2]` | `uio[6]` |
| **RTS** (Optional) | `uio[3]` | `uio[7]` |

### I2C (with optional interrupt and reset)
Standard I2C pinouts for Pmod connectors.

| Signal | Top Row | Bottom Row |
| :--- | :--- | :--- |
| **INT** (Optional) | `uio[0]` | `uio[4]` |
| **RESET** (Optional) | `uio[1]` | `uio[5]` |
| **SCL** | `uio[2]` | `uio[6]` |
| **SDA** | `uio[3]` | `uio[7]` |

### QSPI Flash and PSRAM
Pinout for [QSPI Pmod](https://github.com/mole99/qspi-pmod).

| Signal | Pin |
| :--- | :--- |
| **CS0** (Flash) | `uio[0]` |
| **SD0/MOSI** | `uio[1]` |
| **SD1/MISO** | `uio[2]` |
| **SCK** | `uio[3]` |
| **SD2** | `uio[4]` |
| **SD3** | `uio[5]` |
| **CS1** (RAM A) | `uio[6]` |
| **CS2** (RAM B) | `uio[7]` |

---

## Input Devices

### Game Controllers
Recommended pinout for the [Gamepad Pmod](https://github.com/psychogenic/gamepad-pmod).

| Signal | Pin |
| :--- | :--- |
| **LATCH** | `ui_in[4]` |
| **CLOCK** | `ui_in[5]` |
| **DATA** | `ui_in[6]` |
