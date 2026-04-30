class SPIPeripheral {
    constructor(name, size = 1024 * 1024, jedecId = [0xEF, 0x40, 0x14]) {
        this.name = name;
        this.memory = new Uint8Array(size);
        this.jedecId = new Uint8Array(jedecId);
        this.reset();
    }

    reset() {
        this.state = 'IDLE';
        this.command = 0;
        this.address = 0;
        this.bitCount = 0;
        this.byteCount = 0;
        this.dataBuffer = 0;
        this.writeEnabled = false;
        this.outputEnable = false;
        this.currentOutput = 0;
        this.qspiMode = false;
        this.dummyCycles = 0;
    }

    processCycle(sck, cs_n, sdi, sdo, sd2, sd3, sdi_oe, sdo_oe, sd2_oe, sd3_oe) {
        // Active low CS
        if (cs_n) {
            if (this.state !== 'IDLE') {
                this.reset();
            }
            return { data: 0, oe: 0 };
        }

        // Falling edge of SCK for output (simplified, usually output on falling, sample on rising)
        // Actually, most SPI devices sample on rising edge and output on falling edge (Mode 0).
        // Let's assume Mode 0.

        // We need to track the previous SCK state to detect edges
        if (this.lastSck === 0 && sck === 1) {
            // Rising edge: Sample
            this.handleRisingEdge(sdi, sdo, sd2, sd3);
        } else if (this.lastSck === 1 && sck === 0) {
            // Falling edge: Update output
            this.handleFallingEdge();
        }

        // console.log(`${this.name}: SCK=${sck}, CS=${cs_n}, SDI=${sdi}, State=${this.state}, BitCount=${this.bitCount}`);
        this.lastSck = sck;

        return {
            data: this.currentOutput,
            oe: this.outputEnable ? (this.qspiMode ? 0x0F : 0x02) : 0 // SD1 is MISO in standard SPI
        };
    }

    handleRisingEdge(sdi, sdo, sd2, sd3) {
        if (this.qspiMode) {
            // QSPI sample 4 bits
            const nibble = (sd3 << 3) | (sd2 << 2) | (sdo << 1) | sdi;
            this.dataBuffer = (this.dataBuffer << 4) | nibble;
            this.bitCount += 4;
        } else {
            // Standard SPI sample 1 bit (MOSI is sdi)
            this.dataBuffer = (this.dataBuffer << 1) | sdi;
            this.bitCount++;
        }

        if (this.state === 'IDLE' && this.bitCount === 8) {
            this.command = this.dataBuffer & 0xFF;
            this.dataBuffer = 0;
            this.bitCount = 0;
            this.decodeCommand();
        } else if (this.state === 'ADDRESS' && this.bitCount === 24) {
            this.address = this.dataBuffer & 0xFFFFFF;
            this.dataBuffer = 0;
            this.bitCount = 0;
            this.startOperation();
        } else if (this.state === 'WRITE_DATA' && this.bitCount === 8) {
            if (this.writeEnabled) {
                this.memory[this.address % this.memory.length] = this.dataBuffer & 0xFF;
                this.address++;
            }
            this.dataBuffer = 0;
            this.bitCount = 0;
        } else if (this.state === 'DUMMY') {
            this.dummyCycles--;
            if (this.dummyCycles <= 0) {
                this.state = 'READ_DATA';
                this.prepareReadByte();
            }
        } else if (this.state === 'READ_DATA') {
            // In read mode, we sample but don't do much with it usually,
            // except to advance to next byte after 8 bits (or 2 nibbles in QSPI)
            if (this.bitCount === 8) {
                this.address++;
                this.prepareReadByte();
                this.bitCount = 0;
            }
        }
    }

    handleFallingEdge() {
        if (this.state === 'READ_DATA' || this.state === 'READ_ID') {
            this.outputEnable = true;
            if (this.qspiMode) {
                // Output 4 bits
                const nibble = (this.readBuffer >> 4) & 0x0F;
                this.readBuffer = (this.readBuffer << 4) & 0xFF;
                this.currentOutput = nibble; // Mapping: SD0=bit0, SD1=bit1, SD2=bit2, SD3=bit3
            } else {
                // Output 1 bit (MISO is SD1)
                const bit = (this.readBuffer >> 7) & 0x01;
                this.readBuffer = (this.readBuffer << 1) & 0xFF;
                this.currentOutput = bit << 1; // Bit 1 is SD1/MISO
            }
        } else {
            this.outputEnable = false;
            this.currentOutput = 0;
        }
    }

    decodeCommand() {
        switch (this.command) {
            case 0x06: // Write Enable
                this.writeEnabled = true;
                this.state = 'IDLE';
                break;
            case 0x04: // Write Disable
                this.writeEnabled = false;
                this.state = 'IDLE';
                break;
            case 0x9F: // Read ID
                this.state = 'READ_ID';
                this.byteCount = 0;
                this.prepareReadID();
                break;
            case 0x03: // Read Data
            case 0x0B: // Fast Read
            case 0x02: // Page Program
                this.state = 'ADDRESS';
                break;
            case 0xEB: // Fast Read Quad I/O
                this.state = 'ADDRESS';
                this.qspiMode = true;
                break;
            default:
                this.state = 'IDLE';
        }
    }

    startOperation() {
        switch (this.command) {
            case 0x03: // Read Data
                this.state = 'READ_DATA';
                this.prepareReadByte();
                break;
            case 0x0B: // Fast Read
                this.state = 'DUMMY';
                this.dummyCycles = 8;
                break;
            case 0xEB: // Fast Read Quad I/O
                this.state = 'DUMMY';
                this.dummyCycles = 6; // Usually 6 dummy cycles for EB
                break;
            case 0x02: // Page Program
                this.state = 'WRITE_DATA';
                break;
        }
    }

    prepareReadByte() {
        this.readBuffer = this.memory[this.address % this.memory.length];
    }

    prepareReadID() {
        this.readBuffer = this.jedecId[this.byteCount % this.jedecId.length];
        this.byteCount++;
    }
}

class PMODManager {
    constructor() {
        this.flash = new SPIPeripheral('Flash', 1024 * 1024, [0xEF, 0x40, 0x14]);
        this.psramA = new SPIPeripheral('PSRAM A', 1024 * 1024, [0x0D, 0x5D, 0x00]);
        this.psramB = new SPIPeripheral('PSRAM B', 1024 * 1024, [0x0D, 0x5D, 0x00]);
        this.enabled = { flash: true, psramA: true, psramB: true };
    }

    update(uio_out, uio_oe) {
        // Pinout:
        // uio[0] CS0 (Flash)
        // uio[1] SD0/MOSI
        // uio[2] SD1/MISO
        // uio[3] SCK
        // uio[4] SD2
        // uio[5] SD3
        // uio[6] CS1 (RAM A)
        // uio[7] CS2 (RAM B)

        const cs0 = (uio_out >> 0) & 1;
        const sd0 = (uio_out >> 1) & 1;
        const sd1 = (uio_out >> 2) & 1;
        const sck = (uio_out >> 3) & 1;
        const sd2 = (uio_out >> 4) & 1;
        const sd3 = (uio_out >> 5) & 1;
        const cs1 = (uio_out >> 6) & 1;
        const cs2 = (uio_out >> 7) & 1;

        const sd0_oe = (uio_oe >> 1) & 1;
        const sd1_oe = (uio_oe >> 2) & 1;
        const sd2_oe = (uio_oe >> 4) & 1;
        const sd3_oe = (uio_oe >> 5) & 1;

        let combinedData = 0;
        let combinedOE = 0;

        const mapToUio = (devData, devOE) => {
            // devData bits 0-3 map to uio 1, 2, 4, 5
            let data = ((devData & 0x01) << 1) | ((devData & 0x02) << 1) | ((devData & 0x04) << 2) | ((devData & 0x08) << 2);
            let oe = ((devOE & 0x01) << 1) | ((devOE & 0x02) << 1) | ((devOE & 0x04) << 2) | ((devOE & 0x08) << 2);
            return { data, oe };
        };

        if (this.enabled.flash) {
            const res = this.flash.processCycle(sck, cs0, sd0, sd1, sd2, sd3, sd0_oe, sd1_oe, sd2_oe, sd3_oe);
            const mapped = mapToUio(res.data, res.oe);
            combinedData |= mapped.data;
            combinedOE |= mapped.oe;
        }
        if (this.enabled.psramA) {
            const res = this.psramA.processCycle(sck, cs1, sd0, sd1, sd2, sd3, sd0_oe, sd1_oe, sd2_oe, sd3_oe);
            const mapped = mapToUio(res.data, res.oe);
            combinedData |= mapped.data;
            combinedOE |= mapped.oe;
        }
        if (this.enabled.psramB) {
            const res = this.psramB.processCycle(sck, cs2, sd0, sd1, sd2, sd3, sd0_oe, sd1_oe, sd2_oe, sd3_oe);
            const mapped = mapToUio(res.data, res.oe);
            combinedData |= mapped.data;
            combinedOE |= mapped.oe;
        }

        // Only bits 1, 2, 4, 5 are data lines
        const result = {
            data: combinedData & 0x36,
            oe: combinedOE & 0x36
        };
        // console.log(`PMOD Update: uio_out=0x${uio_out.toString(16)}, result=0x${result.data.toString(16)} (oe=0x${result.oe.toString(16)})`);
        return result;
    }
}

window.PMODManager = PMODManager;
