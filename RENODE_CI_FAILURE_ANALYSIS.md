# Renode CI Failure Analysis

The GitHub Actions CI/CD pipeline encountered several failures during the integration of Renode tests. This document outlines the root causes and the solutions implemented.

## 1. Environment Compatibility (Ubuntu 24.04 vs 22.04)

### Problem
The default `ubuntu-latest` runner (currently Ubuntu 24.04) lacks the `gtk-sharp2` package, which is a required dependency for the `antmicro/renode-test-action`. Attempting to install this package in the CI job resulted in a "package not found" error.

### Solution
The CI workflow was pinned to `ubuntu-22.04` for the testing job, where `gtk-sharp2` is still available in the official repositories.

## 2. Path Resolution in Robot Framework

### Problem
When the Renode Monitor command `include @m3.resc` is executed from within a Robot Framework test, Renode evaluates the path relative to the **current working directory** (the repository root), not the location of the `.robot` file. This caused the "File does not exist: m3.resc" error.

### Solution
The Robot Framework variable `${CURDIR}` is used to provide an absolute path to the script. However, Renode's `@` operator inside the included script still evaluates relative to the **current working directory**, not the script's location.

To solve this, we now:
1. Define a Renode variable `$CONF_DIR` in the Robot file using `${CURDIR}`.
2. Use `$CONF_DIR` within `m3.resc` to load `m3.repl` and `firmware.bin` using absolute paths.

## 3. Linker and Heap Issues

### Problem
The initial MCU implementation used `strdup`, which requires a functional heap. The previous linker script (`m3.ld`) did not define the `end` and `__end__` symbols expected by the `sbrk` syscall in the ARM GNU toolchain (`nosys.specs`), leading to linker errors.

### Solution
The firmware was refactored to use **static buffers** for all protocol parsing, eliminating dynamic memory allocation entirely. Additionally, the linker script was updated to provide proper symbols and section alignment to ensure a robust binary layout.

## 4. Simulation Boot Sequence

### Problem
Raw binaries loaded with `sysbus LoadBinary` in Renode do not automatically set the CPU's Stack Pointer (SP) and Program Counter (PC). This meant the simulation would "start" at address 0x0 but not actually execute the vector table logic.

### Solution
The Renode simulation script (`m3.resc`) was updated to explicitly read the first two words of the vector table (at 0x0 and 0x4) and initialize the CPU's SP and PC registers accordingly.
