/*
 * Tang Nano 4K SoC Top-Level Verilog (GW1NSR-4C)
 */

`default_nettype none

module top (
    input  wire clk_27m,      // Pin 45

    // UART0
    output wire uart_tx,      // Pin 18
    input  wire uart_rx,      // Pin 19

    // LED
    output wire led_pin,       // Pin 10

    // Debug Ports (Optional, based on tt_echo example)
    output wire debug_clk,
    output wire debug_rst_n,
    output wire debug_ena
);

    // --- Internal Reset Logic ---
    reg [7:0] reset_cnt = 8'h0;
    wire sys_reset_n = &reset_cnt;
    always @(posedge clk_27m) begin
        if (!sys_reset_n) reset_cnt <= reset_cnt + 1'b1;
    end

    // --- APB2 Expansion Bus ---
    wire [11:0] apb_paddr;
    wire [31:0] apb_pwdata;
    wire [31:0] apb_prdata_tt;
    wire [31:0] apb_prdata;
    wire        apb_psel;
    wire        apb_penable;
    wire        apb_pwrite;
    wire        apb_pready_tt;
    wire        apb_pready;

    // APB Slot Decoding
    // Slot 1 (TT): 0x40002400 (Offset 0x400) -> PADDR[11:8] = 4'h4
    wire apb_psel_tt = apb_psel && (apb_paddr[11:8] == 4'h4);

    assign apb_prdata = apb_psel_tt ? apb_prdata_tt : 32'h0;
    assign apb_pready = apb_psel_tt ? apb_pready_tt : 1'b1;

    // GPIO
    wire [15:0] m3_gpio_o;
    assign led_pin = m3_gpio_o[0];

    // --- M3 IP Core Instantiation (using EMCU primitive for open-source tools) ---
    EMCU m3_inst (
        .FCLK               (clk_27m),
        .UART0RXDI          (uart_rx),
        .UART0TXDO          (uart_tx),
        .PORESETN           (sys_reset_n),
        .SYSRESETN          (sys_reset_n),

        // APB2 Expansion (TargExp2)
        .APBTARGEXP2PSEL    (apb_psel),
        .APBTARGEXP2PENABLE (apb_penable),
        .APBTARGEXP2PADDR   (apb_paddr),
        .APBTARGEXP2PWRITE  (apb_pwrite),
        .APBTARGEXP2PWDATA  (apb_pwdata),
        .APBTARGEXP2PRDATA  (apb_prdata),
        .APBTARGEXP2PREADY  (apb_pready),

        // GPIO
        .IOEXPOUTPUTO       (m3_gpio_o)
    );

    // --- Tiny Tapeout Wrapper (APB2 Slot 1) ---
    tt_m3_wrapper tt_bridge (
        .PCLK        (clk_27m),
        .PRESETn     (sys_reset_n),
        .PADDR       (apb_paddr[7:0]),
        .PSEL        (apb_psel_tt),
        .PENABLE     (apb_penable),
        .PWRITE      (apb_pwrite),
        .PWDATA      (apb_pwdata),
        .PRDATA      (apb_prdata_tt),
        .PREADY      (apb_pready_tt),

        // Debug outputs
        .debug_clk   (debug_clk),
        .debug_rst_n (debug_rst_n),
        .debug_ena   (debug_ena)
    );

endmodule

// Blackbox definition for EMCU to satisfy open-source tools
module EMCU (
    input  wire        FCLK,
    input  wire        UART0RXDI,
    output wire        UART0TXDO,
    input  wire        PORESETN,
    input  wire        SYSRESETN,

    // APB2 Expansion
    output wire        APBTARGEXP2PSEL,
    output wire        APBTARGEXP2PENABLE,
    output wire [11:0] APBTARGEXP2PADDR,
    output wire        APBTARGEXP2PWRITE,
    output wire [31:0] APBTARGEXP2PWDATA,
    input  wire [31:0] APBTARGEXP2PRDATA,
    input  wire        APBTARGEXP2PREADY,

    // GPIO
    output wire [15:0] IOEXPOUTPUTO
);
    /* elective blackbox */
endmodule
