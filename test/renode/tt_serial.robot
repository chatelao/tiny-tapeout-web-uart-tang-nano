*** Settings ***
Suite Setup                   Setup
Suite Teardown                Teardown
Test Setup                    Prepare Test
Test Teardown                 Test Teardown
Resource                      ${RENODEKEYWORDS}

*** Variables ***
${UART}                       sysbus.uart0
${TT_REG_DATA}                0x40002400
${TT_REG_UIO_DATA}            0x40002404
${TT_REG_UIO_OE}              0x40002408
${TT_REG_CTRL}                0x4000240C

*** Keywords ***
Prepare Test
    Reset Emulation
    Execute Command           include @m3.resc
    Create Terminal Tester    ${UART}

*** Test Cases ***
Should Handle Reset Command
    Write Line To Uart        reset
    Wait For Line On Uart     ok

Should Handle Long Format Transaction
    # ui;0x55;clk;1;rst_n;1;ena;1
    # This should set REG_TT_DATA = 0x55, REG_TT_CTRL = 1 | 2 | 4 = 7
    Write Line To Uart        ui;0x55;clk;1;rst_n;1;ena;1
    # Check if registers were written
    ${data}=                  Execute Command    sysbus ReadByte ${TT_REG_DATA}
    Should Be Equal As Integers    ${data}    0x55
    ${ctrl}=                  Execute Command    sysbus ReadByte ${TT_REG_CTRL}
    Should Be Equal As Integers    ${ctrl}    0x07
    Wait For Line On Uart     uo;55;uio;00;uio_oe;00

Should Handle Short Format Transaction
    # ui_in; clk_in; uio_in; rst_n_in; ena_in
    # 0xAA; 0; 0x12; 1; 1
    # REG_TT_DATA = 0xAA, REG_TT_UIO_DATA = 0x12, REG_TT_CTRL = 0 | 2 | 4 = 6
    Write Line To Uart        0xAA;0;0x12;1;1
    ${data}=                  Execute Command    sysbus ReadByte ${TT_REG_DATA}
    Should Be Equal As Integers    ${data}    0xAA
    ${uio_data}=              Execute Command    sysbus ReadByte ${TT_REG_UIO_DATA}
    Should Be Equal As Integers    ${uio_data}    0x12
    ${ctrl}=                  Execute Command    sysbus ReadByte ${TT_REG_CTRL}
    Should Be Equal As Integers    ${ctrl}    0x06
    Wait For Line On Uart     uo;AA;uio;12;uio_oe;00

Should Handle Compact Hex Format
    # [ui][uio][ctrl]
    # 010203 -> ui=0x01, uio=0x02, ctrl=0x03 (clk=1, rst=1, ena=0)
    Write Line To Uart        010203
    ${data}=                  Execute Command    sysbus ReadByte ${TT_REG_DATA}
    Should Be Equal As Integers    ${data}    0x01
    ${uio_data}=              Execute Command    sysbus ReadByte ${TT_REG_UIO_DATA}
    Should Be Equal As Integers    ${uio_data}    0x02
    ${ctrl}=                  Execute Command    sysbus ReadByte ${TT_REG_CTRL}
    Should Be Equal As Integers    ${ctrl}    0x03
    Wait For Line On Uart     uo;01;uio;02;uio_oe;00
