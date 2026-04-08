# Markdown Test Failures Analysis (Project tt3990)

This document analyzes the failures encountered when running the Markdown test cases from `TEST_CASES.md` against the `tt3990` (OCP MXFP8 Streaming MAC Unit) WASM simulation engine.

## Root Cause Analysis

After investigating the Verilog source code and the simulation environment, two primary issues were identified that cause nearly all failures:

### 1. Simulation Phase Shift (Reset Sequence Bug)
The reset functionality in the web tester (`web/app.js`) contains a logic error in its sequence:
```javascript
digitalTwin.set_rst_n(false);
digitalTwin.step();
digitalTwin.step();
digitalTwin.set_rst_n(true);
digitalTwin.step(); // <--- This step causes the issue
```
The final `step()` call after releasing reset (`rst_n=true`) causes the internal `cycle_count` register in the WASM module to increment from **0 to 1**. Consequently, when the test runner begins its "Cycle 0" transaction, the hardware is already at **Cycle 1**. This creates a persistent one-cycle phase shift for the entire test run.

### 2. Accidental Metadata Capture & Loopback Mode
The `tt3990` project captures protocol metadata (like `debug_en` and `loopback_en`) strictly at `logical_cycle == 0`.
- Because the hardware is at Cycle 1 when the test's "Cycle 0" data arrives, the intended metadata is **ignored**.
- Instead, the hardware captures whatever values were on the input pins during the faulty reset `step()`.
- If `ui_in[5]` was high during that moment, the module enters **Loopback Mode**, where `uo_out = ui_in ^ uio_in`.

---

## Failure Details

### FP8 Dot Product (Standard Protocol)
- **Cycle 1-2 Mismatch:**
  - **Expected:** `uo_out = 0x00`
  - **Observed:** `uo_out = 0x7F` (matches `ui_in`)
  - **Reason:** The module is in Loopback Mode due to the metadata capture issue. It is mirroring `ui_in` directly to `uo_out`.
- **Cycle 39 Mismatch:**
  - **Expected:** `uo_out = 0x20` (Result Byte 1)
  - **Observed:** `uo_out = 0x00`
  - **Reason:** Due to the one-cycle phase shift, the hardware is actually at Cycle 40. According to the protocol, Cycle 40 returns Result Byte 0 (`0x00`).

### Debug Mode Tests
- **All Debug Tables:** Most failures show `uo_out` echoing `ui_in` or `uio_in`.
- **Reason:** Since Cycle 0 (where `debug_en` is sent) was skipped by the hardware, the debug probes are never actually enabled. The module remains in Loopback Mode (or Default mode), returning loopback values or zeros instead of internal probe data.

---

## Conclusion
The logic of the OCP MXFP8 MAC unit appears correct. The failures are artifacts of the **integration between the Web Tester and the WASM module**, specifically regarding the reset-to-start synchronization.
