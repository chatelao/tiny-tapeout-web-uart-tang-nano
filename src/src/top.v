/*
 * top.v - m3_uart_echo
 *
 * Expected Voltage (VCCIO): 1.8V
 * I/O Standard: LVCMOS18
 */
module top (
    input  wire       clk_27m,
    output wire       uart0_txd,    // Pin 44
    input  wire       uart0_rxd,    // Pin 46
    //inout wire [15:0] m3_gpio,      // Led: Pin 10, Btn1: Pin 15
    output wire       led_pin,      // Led: Pin 10
    input  wire       btn1_pin ,    // Pin 14
    input  wire       btn2_pin      // Pin 15
);

 // Deklaration der fehlenden Signale
wire master_pclk;
wire master_prst; // ACHTUNG: Prüfen ob Active High oder Low!
wire [3:0] master_pstrb;
wire [2:0] master_pprot;
wire master_pslverr1;

assign master_pslverr1 = 1'b0; // Slave-Error auf OK festlegen

    Gowin_EMPU_Top m3_inst (
        .sys_clk(clk_27m),

        .gpio(m3_gpio),

        .uart0_rxd(uart0_rxd),
        .uart0_txd(uart0_txd),

        .reset_n(btn2_pin), // Empfehlung: Synchronisierten Reset nutzen

        .master_pclk(master_pclk),
        .master_prst(master_prst),
        .master_pstrb(master_pstrb),
        .master_pprot(master_pprot),
        .master_pslverr1(master_pslverr1),

        .master_penable( mst1_penable ),
        .master_paddr(   mst1_paddr ), // Jetzt 12-bit
        .master_pwrite(  mst1_pwrite ),
        .master_pwdata(  mst1_pwdata ),
        .master_psel1(   mst1_psel ),
        .master_pready1( mst1_pready ),
        .master_prdata1( mst1_prdata )
    );


    tt_m3_wrapper tt_wrapper_inst (
        .PCLK(master_pclk),      // Korrekt: Synchron zum APB-Master
        .PRESETn(~master_prst),  // Falls master_prst active high ist
        .PADDR(mst1_paddr),      // Breite im Wrapper anpassen!
        .PSEL(mst1_psel),
        .PENABLE(mst1_penable),
        .PWRITE(mst1_pwrite),
        .PWDATA(mst1_pwdata),
        .PRDATA(mst1_prdata),
        .PREADY(mst1_pready)

    );

    assign led_pin = btn1_pin ^ btn2_pin ^ uart0_txd;

endmodule
