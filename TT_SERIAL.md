# Tiny Tapeout Serial Protocol (TT_SERIAL)

This document defines a simple, line-based protocol for communicating with Tiny Tapeout designs over WebSerial (UART).

## Connection Settings
- **Baud Rate**: 115200
- **Data Bits**: 8
- **Stop Bits**: 1
- **Parity**: None
- **Flow Control**: None

## General Principles
- **Line-based**: Every request from the host must be a single line ending with a newline character (`\n`).
- **Synchronous**: Every request receives exactly one line of response from the device.
- **Hex-encoded**: Data is represented as hexadecimal strings to ensure readability and compatibility.

## Transaction Command

To perform a single transaction (update inputs and read outputs), the host sends a 6-character hexadecimal string.

### Request Format
`[ui_in][uio_in][ctrl]\n`

- `ui_in` (2 hex chars): Input data for the `ui_in[7:0]` pins.
- `uio_in` (2 hex chars): Input data for the `uio_in[7:0]` pins.
- `ctrl` (2 hex chars): Control signals.
  - Bit 0: `clk`
  - Bit 1: `rst_n`
  - Bit 2: `ena`
  - Bits 3-7: Reserved (must be 0)

**Example**: `010206\n`
- `ui_in` = 0x01
- `uio_in` = 0x02
- `ctrl` = 0x06 (binary `110`: `ena`=1, `rst_n`=1, `clk`=0)

### Response Format
`[uo_out][uio_out][uio_oe]\n`

- `uo_out` (2 hex chars): Output data from the `uo_out[7:0]` pins.
- `uio_out` (2 hex chars): Output data from the `uio_out[7:0]` pins.
- `uio_oe` (2 hex chars): Output enable signals from the `uio_oe[7:0]` pins.

**Example**: `030000\n`
- `uo_out` = 0x03
- `uio_out` = 0x00
- `uio_oe` = 0x00

## Special Commands

### Reset Command
Resets the protocol handler and optionally the Tiny Tapeout module.

- **Request**: `reset\n`
- **Response**: `ok\n`
