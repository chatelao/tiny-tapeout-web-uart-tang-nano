#include "m3_regs.h"

void tt_init(void) {
    // Release reset and enable module
    // CTRL: [0]=clk, [1]=rst_n, [2]=ena
    REG_TT_CTRL = (1 << 2) | (1 << 1); // ena=1, rst_n=1, clk=0
}

uint8_t tt_send(uint8_t ui_in) {
    // Write input to ui_in
    REG_TT_DATA = ui_in;

    // Pulse clock high
    REG_TT_CTRL |= (1 << 0);
    // Pulse clock low
    REG_TT_CTRL &= ~(1 << 0);

    // Read result from uo_out
    return (uint8_t)REG_TT_DATA;
}

int main(void) {
    // Configure UART0: 115200 baud @ 27MHz
    // Divider = 27,000,000 / 115,200 = 234.375 -> 234
    REG_UART0_BAUDDIV = 234;

    // Enable UART0 TX and RX
    // CTRL[0] = TX Enable, CTRL[1] = RX Enable
    REG_UART0_CTRL = (1 << 1) | (1 << 0);

    // Configure GPIO0 (LED) as output
    REG_GPIO_OUTENSET = (1 << 0);

    // Initialize Tiny Tapeout module
    tt_init();

    while (1) {
        // Poll for RX buffer full (STATE[1])
        if (REG_UART0_STATE & (1 << 1)) {
            // Read received character
            uint8_t c = (uint8_t)REG_UART0_DATA;

            // Toggle LED to indicate activity
            REG_GPIO_DATAOUT ^= (1 << 0);

            // Pass character through Tiny Tapeout module
            uint8_t result = tt_send(c);

            // Wait for TX buffer not full (STATE[0] == 0)
            while (REG_UART0_STATE & (1 << 0));

            // Echo result back
            REG_UART0_DATA = result;
        }
    }

    return 0;
}
