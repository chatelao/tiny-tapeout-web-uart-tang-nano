# Tiny Tapeout Serial Protocol (TT_SERIAL)

This document defines a simple, line-based protocol for communicating with Tiny Tapeout designs over WebSerial (UART).

## General Principles
- **Line-based**: Every request from the host must be a single line ending with a newline character (`\n`).
- **Synchronous**: Every request receives exactly one line of response from the device.
- **Hex-/Bin-/Dec-encoded**: Data is represented as hexadecimal strings to ensure readability and compatibility.
- **csv-compatible**: Data is easy processable in Excel / Spreadsheets

## Transaction Command

To perform a single transaction (update inputs and read outputs), the host sends a 6-character hexadecimal string or a semicolon-separated string.

### Request Format

Long (verbose) Format, any element omitted is kept to the same value "as is":
- `ui;[ui_in];uio;[uio_in];clk;[clk_in];rst_n;[rst_n_in];ena;[ena_in]\n`

Short Format, elements omitted at the end of the line are kept to the same value "as is":
- `[ui_in];[clk_in];[uio_in];[rst_n_in];[ena_in]\n`

Values:
- `ui_in` : dec, hex or bin Input data for the `ui_in[7:0]` pins.
- `uio_in` : dec, hex or bin Input data for `uio_in[7:0]` pins.
- `clk`, `rst_n`, `ena` : binary signals, allowing '0/1 '-/+', 'false/true', 'low/high'

### Response Format

Compact Format (used for compact requests):
- `[uo_out][uio_out][uio_oe]\n` (6 hex chars)

Long Format (used for verbose/short requests):
- `uo;[uo_out];uio;[uio_out];uio_oe;[uio_oe]\n`

- `uo_out` (2 hex chars): Output data from the `uo_out[7:0]` pins.
- `uio_out` (2 hex chars): Output data from the `uio_out[7:0]` pins.
- `uio_oe` (2 hex chars): Output enable signals from the `uio_oe[7:0]` pins.

## Special Commands

- `reset\n`: Resets the protocol state or the device. Returns `ok\n`.

## Examples

### Compact Format Transaction
Host sends: `00FF07\n` (ui_in=0x00, uio_in=0xFF, clk=1, rst_n=1, ena=1)
Device responds: `000000\n`

### Long Format Transaction
Host sends: `ui;0x55;clk;1;rst_n;1;ena;1\n`
Device responds: `uo;00;uio;00;uio_oe;00\n`

### Short Format Transaction
Host sends: `0xAA;1;0x00;1;1\n`
Device responds: `uo;00;uio;00;uio_oe;00\n`

### Special Commands
Host sends: `reset\n`
Device responds: `ok\n`
