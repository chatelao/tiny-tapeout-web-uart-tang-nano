# Web Serial API Documentation

This document provides an overview of the Web Serial API features supported and used by the Tiny Tapeout Web Serial interface.

## Web Serial API Feature Spectrum

| Feature | Description | Technical Specifications & Details | Verified Source |
| :--- | :--- | :--- | :--- |
| **Port Detection & Filtering** | Searching and requesting devices. | `navigator.serial.requestPort()` allows targeted filtering by USB `vendorId` and `productId` to show only compatible hardware in the selection dialog. | [W3C Draft: requestPort](https://wicg.github.io/serial/#dom-navigator-requestport) |
| **Interface Configuration** | Parameterization of the serial connection. | `port.open(options)` supports settings for `baudRate` (up to proprietary rates >1Mbit/s), `dataBits` (7 or 8), `stopBits` (1 or 2), `parity` (none, even, odd), and `bufferSize`. | [W3C Draft: SerialOptions](https://wicg.github.io/serial/#dom-serialoptions) |
| **Asynchronous I/O Streaming** | Reading and writing payload data. | Uses the standard Streams API (`ReadableStream`, `WritableStream`). Data circulates as `Uint8Array`. Allows native backpressure management in the browser. | [W3C Draft: Streams](https://wicg.github.io/serial/#dom-serial-readable) |
| **Hardware Flow Control** | Manipulation of physical control lines. | `setSignals()` manipulates DTR, RTS, and Break signals. `getSignals()` reads the status of CTS, DSR, DCD, and RI (Ring Indicator). | [W3C Draft: Signals](https://wicg.github.io/serial/#dom-serialport-setsignals) |
| **Hot-Plugging Events** | Monitoring the physical status. | The `connect` and `disconnect` events on the `navigator.serial` object report in real-time when an authorized device is physically plugged in or unplugged. | [MDN: Serial Events](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/serial_event) |
