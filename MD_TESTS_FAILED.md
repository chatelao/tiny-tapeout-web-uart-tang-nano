# Markdown Test Failures Analysis (Project tt3990)

This document analyzes the failures encountered when running the Markdown test cases from `TEST_CASES.md` against the `tt3990` (OCP MXFP8 Streaming MAC Unit) WASM simulation engine, following the application of the simulation reset fix.

## Overview
Applying the reset synchronization fix resolved the major functional mismatches in the arithmetic data paths. The "FP8 Dot Product" and "FP4 Fast Lane" tests now successfully produce the expected results. However, failures persist in the **Debug Mode** test cases.

---

## Root Cause Analysis (Post-Fix)

### 1. Functional Success
The arithmetic logic (Standard and Short protocols) is verified to be working correctly. The previously observed "Cycle 39" mismatch was a timing artifact in the web tester, which has been corrected by ensuring outputs are sampled before the clock edge.

### 2. Debug Probe Implementation Issues
While the simulation now correctly identifies Cycle 0, the internal debug probes in the `tt3990` WASM module appear to be partially non-functional or returning inconsistent data:

- **Input Echoing during Debug Setup:** In many debug tests, Cycle 0 fails because `uo_out` returns the value of `ui_in` (e.g., `0x41`, `0x42`). This indicates that when `debug_en` (bit 6 of `ui_in`) is high, the module's output multiplexer is temporarily echoing the input instead of the probe data.
- **Zeroed Probe Data:** For modes like `0x1` (FSM State & Timing) and `0x3-0x6` (Accumulator), `uo_out` remains `0x00` throughout the STREAM phase. This suggests that these specific debug probes are either:
  1. Not correctly wired to the output multiplexer in the WASM model.
  2. Monitoring internal registers that are not being updated as expected in this simulation build.
- **Control Signal Mismatches:** In Debug Mode `0x9`, some control signals (like `strobe`) are detected, but others (like `acc_en`) do not match the expected patterns, returning `0xC0` instead of `0xE0`.

---

## Failure Details

### Debug Mode: 0x1 (FSM State & Timing)
- **Mismatches:** Cycle 1-34
- **Observation:** `uo_out` remains `0x00`.
- **Expected:** `0x41`, `0x42`, `0x83`, etc. (State + Cycle).
- **Reason:** The FSM state probe appears to be inactive or returning a constant zero in the simulation.

### Debug Mode: 0x2 (Exception Monitor)
- **Mismatches:** Cycle 0, 3, 5-36
- **Observation:** Cycle 0 returns `0x42` (Input Echo). STREAM phase returns `0x00`.
- **Reason:** The exception sticky bits and strobe signal are not being surfaced through the debug multiplexer.

### Accumulator & Multiplier Probes (0x3 - 0x8)
- **Observation:** These probes mostly return `0x00`.
- **Reason:** Real-time observability of the internal accumulator and multiplier pipelines is currently limited or unimplemented in the provided WASM binary.

---

## Conclusion
The **core MAC functionality is correct**. The simulation environment fix successfully synchronized the protocol cycles. The remaining failures are isolated to the **Logic Analyzer / Debug Mode** features of the `tt3990` project, which do not yet provide a high-fidelity representation of the internal signal states in the current WASM simulation.
