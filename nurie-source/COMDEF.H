/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : comdef.h -- É·¯¥ ¬w®· ¸÷·                  |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __COMDEF_H
#define     __COMDEF_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     BUFLEN       0x01000	/* length of data buffer */

#define     DATA         0x3f8		/* data buffer reg. of com1
					   0x2f8 : com2
					   0x3e8 : com3
					   0x2e8 : com4 */
#define     IER          0x3f9		/* interrupt enable reg. of com1 */
#define     IIR          0x3fa		/* interrupt identification reg. of com1 */
#define     MCR          0x3fc		/* modem control reg. of com1 */
#define     MSR          0x3fe		/* modem status reg. of com1 */
#define     LSR          0x3fd		/* line status reg. of com1 */
#define     LCR          0x3fb		/* line control reg. of com1 */

#define     ONMASK1      0xef		/* turn IRQ4(serial port1) on */
#define     ONMASK2      0xf7		/* turn IRQ3(serial port2) on */
#define     OFFMASK1     0x10		/* turn IRQ4(serial port1) off */
#define     OFFMASK2     0x08		/* turn IRQ3(serial port2) off */

#define     PICMASK      0x21		/* 8259 programmable interrupt controller
					   mask reg. */
#define     PICEOI       0x20		/* 8259 PIC EOI instruction */
#define     XON          0x11		/* define cross on character */
#define     XOFF         0x13		/* define cross off character */

#define     IRQVECT1     0x0c		/* interrupt service routine */
#define     IRQVECT2     0x0b

#define     ASCIIUP      0
#define     MACRO        1
#define     CHATMODE     2

#define     VT100        0		/* Èá£¡é ¡¡—a */
#define     VT200        1
#define     FS220B       2

#ifdef      __cplusplus
}
#endif

#endif
