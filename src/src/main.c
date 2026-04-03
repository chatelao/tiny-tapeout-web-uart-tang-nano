#include "m3_regs.h"
#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>

#define BUFFER_SIZE 128

static uint8_t ui_in = 0;
static uint8_t uio_in = 0;
static uint8_t clk = 0;
static uint8_t rst_n = 1;
static uint8_t ena = 1;

void uart_putc(char c) {
    while (REG_UART0_STATE & (1 << 0)); // Wait for TX buffer not full
    REG_UART0_DATA = c;
}

void uart_puts(const char *s) {
    while (*s) {
        uart_putc(*s++);
    }
}

char uart_getc(void) {
    while (!(REG_UART0_STATE & (1 << 1))); // Wait for RX buffer full
    return (char)REG_UART0_DATA;
}

uint32_t parse_value(const char *s) {
    if (s[0] == '0') {
        if (s[1] == 'x' || s[1] == 'X') {
            return strtoul(s, NULL, 16);
        } else if (s[1] == 'b' || s[1] == 'B') {
            return strtoul(s + 2, NULL, 2);
        }
    }
    if (isdigit((unsigned char)s[0])) {
        return strtoul(s, NULL, 10);
    }
    // Booleanish
    if (strcmp(s, "true") == 0 || strcmp(s, "high") == 0 || strcmp(s, "1") == 0 || strcmp(s, "+") == 0) {
        return 1;
    }
    if (strcmp(s, "false") == 0 || strcmp(s, "low") == 0 || strcmp(s, "0") == 0 || strcmp(s, "-") == 0) {
        return 0;
    }
    return 0;
}

void perform_transaction(void) {
    REG_TT_DATA = ui_in;
    REG_TT_UIO_DATA = uio_in;
    REG_TT_CTRL = (clk & 1) | ((rst_n & 1) << 1) | ((ena & 1) << 2);

    // Read back outputs
    uint8_t uo_out = (uint8_t)REG_TT_DATA;
    uint8_t uio_out = (uint8_t)REG_TT_UIO_DATA;
    uint8_t uio_oe = (uint8_t)REG_TT_UIO_OE;

    char resp[64];
    sprintf(resp, "uo;%02X;uio;%02X;uio_oe;%02X\n", uo_out, uio_out, uio_oe);
    uart_puts(resp);
}

void process_line(char *line) {
    if (strcmp(line, "reset") == 0) {
        ui_in = 0;
        uio_in = 0;
        clk = 0;
        rst_n = 1;
        ena = 1;
        uart_puts("ok\n");
        return;
    }

    if (strchr(line, ';')) {
        // Semi-colon separated (Long or Short format)
        char *line_copy = strdup(line);
        char *token = strtok(line_copy, ";");
        int index = 0;
        while (token != NULL) {
            if (strcmp(token, "ui") == 0) {
                token = strtok(NULL, ";");
                if (token) ui_in = (uint8_t)parse_value(token);
            } else if (strcmp(token, "uio") == 0) {
                token = strtok(NULL, ";");
                if (token) uio_in = (uint8_t)parse_value(token);
            } else if (strcmp(token, "clk") == 0) {
                token = strtok(NULL, ";");
                if (token) clk = (uint8_t)parse_value(token);
            } else if (strcmp(token, "rst_n") == 0) {
                token = strtok(NULL, ";");
                if (token) rst_n = (uint8_t)parse_value(token);
            } else if (strcmp(token, "ena") == 0) {
                token = strtok(NULL, ";");
                if (token) ena = (uint8_t)parse_value(token);
            } else {
                // Short format or value for previous key (if not already handled)
                // Short format order: ui_in; clk_in; uio_in; rst_n_in; ena_in
                switch (index) {
                    case 0: ui_in = (uint8_t)parse_value(token); break;
                    case 1: clk = (uint8_t)parse_value(token); break;
                    case 2: uio_in = (uint8_t)parse_value(token); break;
                    case 3: rst_n = (uint8_t)parse_value(token); break;
                    case 4: ena = (uint8_t)parse_value(token); break;
                }
                index++;
            }
            token = strtok(NULL, ";");
        }
        free(line_copy);
        perform_transaction();
    } else if (strlen(line) == 6) {
        // Compact 6-char hex format: [ui][uio][ctrl]
        char tmp[3] = {0};

        tmp[0] = line[0]; tmp[1] = line[1];
        ui_in = (uint8_t)strtoul(tmp, NULL, 16);

        tmp[0] = line[2]; tmp[1] = line[3];
        uio_in = (uint8_t)strtoul(tmp, NULL, 16);

        tmp[0] = line[4]; tmp[1] = line[5];
        uint8_t ctrl = (uint8_t)strtoul(tmp, NULL, 16);
        clk = ctrl & 1;
        rst_n = (ctrl >> 1) & 1;
        ena = (ctrl >> 2) & 1;

        perform_transaction();
    }
}

int main(void) {
    // Configure UART0: 115200 baud @ 27MHz
    REG_UART0_BAUDDIV = 234;
    REG_UART0_CTRL = (1 << 1) | (1 << 0); // TX & RX Enable

    char buffer[BUFFER_SIZE];
    int pos = 0;

    while (1) {
        char c = uart_getc();
        if (c == '\n' || c == '\r') {
            buffer[pos] = '\0';
            if (pos > 0) {
                process_line(buffer);
            }
            pos = 0;
        } else if (pos < BUFFER_SIZE - 1) {
            buffer[pos++] = c;
        }
    }

    return 0;
}
