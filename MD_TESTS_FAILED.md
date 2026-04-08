# Markdown Test Failures Analysis (Project tt3990)

This document analyzes the failures encountered when running the Markdown test cases from `TEST_CASES.md` against the `tt3990` (OCP MXFP8 Streaming MAC Unit) WASM simulation engine.

## FP8 Dot Product (Standard Protocol) - Table 1
### Analysis
- Cycles 1-2: `uo_out` returns `0x7F` instead of `0x00`. Since `ui_in` is `0x7F` (Scale A), it seems the module is echoing the input during the LOAD state or hasn't transitioned yet.
- Cycle 39: Expected `0x20`, Got `0x00`. The result byte is missing or delayed.

### Failure Logs
- Cycle 1 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x7F, uio_out: Match (0x00)
- Cycle 2 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x7F, uio_out: Match (0x00)
- Cycle 39 FAILED: uo_out: MISMATCH! Expected 0x20, Got 0x00, uio_out: Match (0x00)

## FP4 Fast Lane (Short Protocol) - Table 1
### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0xC4, uio_out: Match (0x00)

## Debug Mode: 0x0 (Default) - Table 1
### Failure Logs
- Cycle 23 FAILED: uo_out: MISMATCH! Expected 0x20, Got 0x00, uio_out: Match (0x00)
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x40, uio_out: Match (0x00)

## Debug Mode: 0x1 (FSM State & Timing) - Table 1
### Analysis
- The module is returning `0x00` instead of the expected state/cycle information. This suggests the Debug Probe for 0x1 is either not active or not implemented as expected in this WASM version.

### Failure Logs
- Cycle 1 FAILED: uo_out: MISMATCH! Expected 0x41, Got 0x00, uio_out: Match (0x00)
- Cycle 2 FAILED: uo_out: MISMATCH! Expected 0x42, Got 0x00, uio_out: Match (0x00)
- Cycle 3 FAILED: uo_out: MISMATCH! Expected 0x83, Got 0x00, uio_out: Match (0x00)

## Debug Mode: 0x2 (Exception Monitor) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 5 FAILED: uo_out: MISMATCH! Expected 0x85, Got 0x00, uio_out: Match (0x00)
- Cycle 6 FAILED: uo_out: MISMATCH! Expected 0x86, Got 0x00, uio_out: Match (0x00)
- Cycle 7 FAILED: uo_out: MISMATCH! Expected 0x87, Got 0x00, uio_out: Match (0x00)
- Cycle 8 FAILED: uo_out: MISMATCH! Expected 0x88, Got 0x00, uio_out: Match (0x00)
- Cycle 9 FAILED: uo_out: MISMATCH! Expected 0x89, Got 0x00, uio_out: Match (0x00)
- Cycle 10 FAILED: uo_out: MISMATCH! Expected 0x8A, Got 0x00, uio_out: Match (0x00)
- Cycle 11 FAILED: uo_out: MISMATCH! Expected 0x8B, Got 0x00, uio_out: Match (0x00)
- Cycle 12 FAILED: uo_out: MISMATCH! Expected 0x8C, Got 0x00, uio_out: Match (0x00)
- Cycle 13 FAILED: uo_out: MISMATCH! Expected 0x8D, Got 0x00, uio_out: Match (0x00)
- Cycle 14 FAILED: uo_out: MISMATCH! Expected 0x8E, Got 0x00, uio_out: Match (0x00)
- Cycle 15 FAILED: uo_out: MISMATCH! Expected 0x8F, Got 0x00, uio_out: Match (0x00)
- Cycle 16 FAILED: uo_out: MISMATCH! Expected 0x90, Got 0x00, uio_out: Match (0x00)
- Cycle 17 FAILED: uo_out: MISMATCH! Expected 0x91, Got 0x00, uio_out: Match (0x00)
- Cycle 18 FAILED: uo_out: MISMATCH! Expected 0x92, Got 0x7F, uio_out: Match (0x00)
- Cycle 19 FAILED: uo_out: MISMATCH! Expected 0x93, Got 0xC0, uio_out: Match (0x00)
- Cycle 20 FAILED: uo_out: MISMATCH! Expected 0x94, Got 0x00, uio_out: Match (0x00)
- Cycle 21 FAILED: uo_out: MISMATCH! Expected 0x95, Got 0x00, uio_out: Match (0x00)
- Cycle 22 FAILED: uo_out: MISMATCH! Expected 0x96, Got 0x00, uio_out: Match (0x00)
- Cycle 23 FAILED: uo_out: MISMATCH! Expected 0x97, Got 0x00, uio_out: Match (0x00)
- Cycle 24 FAILED: uo_out: MISMATCH! Expected 0x98, Got 0x00, uio_out: Match (0x00)
- Cycle 25 FAILED: uo_out: MISMATCH! Expected 0x99, Got 0x00, uio_out: Match (0x00)
- Cycle 26 FAILED: uo_out: MISMATCH! Expected 0x9A, Got 0x00, uio_out: Match (0x00)
- Cycle 27 FAILED: uo_out: MISMATCH! Expected 0x9B, Got 0x00, uio_out: Match (0x00)
- Cycle 28 FAILED: uo_out: MISMATCH! Expected 0x9C, Got 0x00, uio_out: Match (0x00)
- Cycle 29 FAILED: uo_out: MISMATCH! Expected 0x9D, Got 0x00, uio_out: Match (0x00)
- Cycle 30 FAILED: uo_out: MISMATCH! Expected 0x9E, Got 0x00, uio_out: Match (0x00)
- Cycle 31 FAILED: uo_out: MISMATCH! Expected 0x9F, Got 0x00, uio_out: Match (0x00)
- Cycle 32 FAILED: uo_out: MISMATCH! Expected 0xA0, Got 0x00, uio_out: Match (0x00)
- Cycle 33 FAILED: uo_out: MISMATCH! Expected 0xA1, Got 0x00, uio_out: Match (0x00)
- Cycle 34 FAILED: uo_out: MISMATCH! Expected 0xA2, Got 0x00, uio_out: Match (0x00)
- Cycle 36 FAILED: uo_out: MISMATCH! Expected 0xA4, Got 0x00, uio_out: Match (0x00)
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x10, Got 0x42, uio_out: Match (0x00)
- Cycle 3 FAILED: uo_out: MISMATCH! Expected 0x90, Got 0x47, uio_out: Match (0x00)

## Debug Mode: 0x3 (Accumulator [31:24]) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x43, uio_out: Match (0x00)

## Debug Mode: 0x4 (Accumulator [23:16]) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x44, uio_out: Match (0x00)

## Debug Mode: 0x5 (Accumulator [15:8]) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x45, uio_out: Match (0x00)

## Debug Mode: 0x6 (Accumulator [7:0]) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x46, uio_out: Match (0x00)

## Debug Mode: 0x7 (Multiplier Lane 0 [15:8]) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x47, uio_out: Match (0x00)

## Debug Mode: 0x8 (Multiplier Lane 0 [7:0]) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x48, uio_out: Match (0x00)

## Debug Mode: 0x9 (Control Signals) - Table 1
### Analysis
- Cycle 0 often fails with `Got 0x4[X]` where `X` is the probe selector. The module seems to be echoing `ui_in` or `uio_in` immediately upon debug enable.

### Failure Logs
- Cycle 0 FAILED: uo_out: MISMATCH! Expected 0x00, Got 0x49, uio_out: Match (0x00)
- Cycle 1 FAILED: uo_out: MISMATCH! Expected 0xD0, Got 0x7F, uio_out: Match (0x00)
- Cycle 2 FAILED: uo_out: MISMATCH! Expected 0xD0, Got 0x7F, uio_out: Match (0x00)
- Cycle 4 FAILED: uo_out: MISMATCH! Expected 0xE0, Got 0x00, uio_out: Match (0x00)
- Cycle 5 FAILED: uo_out: MISMATCH! Expected 0xE0, Got 0x00, uio_out: Match (0x00)
- Cycle 6 FAILED: uo_out: MISMATCH! Expected 0xE0, Got 0x00, uio_out: Match (0x00)
- Cycle 7 FAILED: uo_out: MISMATCH! Expected 0xE0, Got 0x00, uio_out: Match (0x00)
