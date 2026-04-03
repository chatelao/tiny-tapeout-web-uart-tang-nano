/* top.v - m3_uart_echo */
module top (
    input  wire       clk_27m,      // Pin 45
    output wire       uart0_txd,    // Pin 44
    input  wire       uart0_rxd,    // Pin 46
    //inout wire [15:0] m3_gpio,      // Led: Pin 10, Btn1: Pin 15
    output wire       led_pin,             // Led: Pin 10, Btn1: Pin 15
    input  wire       btn1_pin ,            // Pin 14
    input  wire       btn2_pin             // Pin 15
);

    wire [15:0] m3_gpio;

    Gowin_EMPU_Top m3_inst (
		.sys_clk(clk_27m),     //input sys_clk

		.gpio(m3_gpio),        //inout [15:0] gpio

		.uart0_rxd(uart0_rxd), //input uart0_rxd
		.uart0_txd(uart0_txd), //output uart0_txd

		.reset_n(btn2_pin)
    );

    assign led_pin = btn1_pin ^ btn2_pin ^ uart0_txd;

endmodule
