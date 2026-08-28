/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : modem.c  -- ¡¡•Q ¹A´á ¡¡—I                    |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <dos.h>
#include    <string.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "comdef.h"			/* É·¯¥ ¬w®· ¸÷· */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     DCD_MSK      0x80		/* data carrier detected */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

			/* ˆb¹· É·¯¥ ¸åµb ¥e® */
int      cport;				/* 0 : com1, 1 : com2, 2 : com3, 3 : com4 */
int      base;
int      irqvect;			/* RS 232 Í¡Ëa· ·¥ÈáœóËa */
int      onmask;
int      offmask;

int      dataflag;			/* •A·¡Èa §¡Ëa: 7 or 8 */
int      databit[2][2] = {
	{'7', 0x02 },
	{'8', 0x03 }
};

int      stopflag;			/* ¸÷»¡ §¡Ëa: 1 or 2 */
int      stopbit[2][2] = {
	{'1', 0x00 },
	{'2', 0x04 }
};

char     parflag;			/* ÌŸ¡Ë¡ §¡Ëa: none, odd or even */
int      parity[3][2] = {
	{'N', 0x00 },
	{'O', 0x08 },
	{'E', 0x18 }
};

int      baudflag;			/* ¥¡µ¡—a ·I */
long     bauds[12] = {
	 1200L,   2400L,   4800L,   9600L,  19200L,  38400L,
	57600L, 115200L,    110L,    150L,    300L,    600L
};

extern   char     sflag;

char     *ibuffer;			/* ¡¡•Q É·Ð —i´áµ¡“e •A·¡Èa ¤áÌá */
int      front, rear;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     comInitPort();
void     comSetPortVar();
void     comSetupPort();
void     comEndPort(int mode);

void     interrupt intsr();
int      comIsCarrier();
int      comIsDataReady();
char     comDataIn();
void     comUnGetData();
char     comgetdata();
char     comGetData();
void     comDataOut(char ch);
void     comDataToBuffer(char ch);
void     comClearBuffer();

void     comHangUpPort();
void     comSendBreak();

void     comGetModemState(char *str);
void     modemvar2str(int b, char p, int d, int s, char *str);

void     interrupt   (*oldvect)();


void     comInitPort()
{
	comSetPortVar();
	comSetupPort();

	front = rear = 0;
	ibuffer = (char *)malloc((size_t)BUFLEN);

	oldvect = getvect(irqvect);
	setvect(irqvect, intsr);

			/* modem status reg. 0x30 = 00110000b
			    bit 4 : clear to send (CTS)
			    bit 5 : data set ready (DSR) */
	outportb(MSR - base, inportb(MSR - base) | 0x30);

			/* programmable interrupt controller
			    0xf7 = 11110111
			     bit 3 : serial port2 interrupt no mask
			    0xef = 11101111
			     bit 4 : serial port1 interrupt no mask */
	outportb(PICMASK, (inportb(PICMASK) & onmask));

			/* clear pending interrupt */
	inportb(DATA - base);
	inportb(DATA - base);
}

void     comSetPortVar()
{
	switch (cport) {
		case 0 :
			base = 0;
			irqvect = IRQVECT1;
			onmask = ONMASK1;
			offmask = OFFMASK1;
			break;
		case 1 :
			base = 0x0100;
			irqvect = IRQVECT2;
			onmask = ONMASK2;
			offmask = OFFMASK2;
			break;
		case 2 :
			base = 0x0010;
			irqvect = IRQVECT1;
			onmask = ONMASK1;
			offmask = OFFMASK1;
			break;
		case 3 :
			base = 0x0110;
			irqvect = IRQVECT2;
			onmask = ONMASK2;
			offmask = OFFMASK2;
			break;
		default :
			break;
	}
}

void     comSetupPort()
{
	char   ch;
	char   temp;
	byte   high, low;
	int    i;
	unsigned  latch;

	for (i = 0;i < 3;i++)
		if (parity[i][0] == parflag) break;
	ch = databit[dataflag - 7][1] | stopbit[stopflag - 1][1] | parity[i][1] | 0x80;

	latch = (unsigned)(1843200L / (bauds[baudflag] * 16L));
	high = (byte)(latch >> 8);
	low = (byte)latch;

			/* line control reg. 0x80 = 10000000b
			    bit 7 : divisor latch access bit */
	outportb(LCR - base, inportb(LCR - base) | 0x80);
	outportb(LCR - base, ch);
	outportb(DATA - base, low);
	outportb(DATA - base + 1, high);
	outportb(LCR - base, inportb(LCR - base) & 0x7f);

			/* modem control reg. 0x0b = 00001011b
			    bit 0 : data terminal ready (DTR)
				1 : request to send (RTS)
				3 : enable interrupt */
	outportb(MCR - base, 0x0b);

			/* interrupt enable reg. 0x01 = 00000001b
			    bit 0 : data interrupt enable */
	outportb(IER - base, 0x01);
}

void     comEndPort(int mode)
{
	if (!mode) comHangUpPort();

			/* interrupt enable reg. :
			    no interrupt on data receive */
	outportb(IER - base, 0x00);
	outportb(PICMASK, (inportb(PICMASK) | offmask));
	setvect(irqvect, oldvect);

	free(ibuffer);
}

void     interrupt intsr()
{
	char   ch;

	rear %= BUFLEN;

	ch = inportb(DATA - base);	/* data buffer reg. */
	if (ch) *(ibuffer + rear++) = ch;

			/* programmable interrupt controller(PIC) EOI instruction
			   ·¥ÈáœóËa ¬á§¡¯a {v·q·i 8259µA ´iŸ± */
	outportb(PICEOI, 0x20);
}

int      comIsCarrier()
{
			/* modem status reg. 0x80 = 10000000b
			    bit 7 : data carrier detected */
	return(inportb(MSR - base) & DCD_MSK);
}

int      comIsDataReady()
{
	return((front != rear) ? hgSUCCESS : hgFAIL);
}

char     comDataIn()
{
	front %= BUFLEN;
	return(*(ibuffer + front++));
}

void     comUnGetData()
{
	front--;
	if (front < 0) front = BUFLEN - 1;
}

char     comgetdata()
{
	int   timelimit = 0;

	while (!comIsDataReady()) {
		if (timelimit++ > 30000) return(0);
	}
	return(comDataIn());
}

char     comGetData()
{
	if (sflag) return(comgetdata());
	while (!comIsDataReady());
	return(comDataIn());
}

void     comDataOut(char ch)
{
	char   stat;

	do {
			/* line status reg. 0x20 = 00100000b
			    bit 5 : THR(transport hold reg) empty
			    data buffer reg. empty */
		stat = inportb(LSR - base);
		stat &= 0x20;
	} while (!stat);		/* waiting for THR empty */

	outportb(DATA - base, ch);
}

void     comDataToBuffer(char ch)
{
	char   stat;

	do {
		stat = inportb(LSR - base);
		stat &= 0x20;
	} while (!stat);

	rear %= BUFLEN;
	*(ibuffer + rear++) = ch;
}

void     comClearBuffer()
{
	front = rear;
}

void     comHangUpPort()
{
	comDataOut('+');
	delay(300);
	comDataOut('+');
	delay(300);
	comDataOut('+');
	delay(2000);
	comDataOut('a');
	comDataOut('t');
	comDataOut('h');
	comDataOut('\r');

	while (comIsDataReady()) comDataIn();
}

void     comSendBreak()
{
	char   ch;

			/* line control reg. : data, stop, parity, baud rate ‰i¸÷
			    64 = 01000000b
			    bit 6 : set break */
	ch = inportb(LCR - base);
	outportb(LCR - base, ch | 64);
	delay(500);			/* ´¢ 250ms•·´e bit 6·i set¯¡Ç¡¡e
					   Ñ¡¯aËaµA §aA·¡Ça ¯¥Ñ¡ˆa ¸å”i–E”a. */

	outportb(LCR - base, ch);
}

void     comGetModemState(char *str)
{
	char   mline[15];
	int    n;

	sprintf(mline, "%1d-%6ld-%c-%c-%c", cport + 1, bauds[baudflag],
		parflag, databit[dataflag - 7][0], stopbit[stopflag - 1][0]);
	n = strlen(mline);
	memcpy(str, mline, n);
	*(str + n) = 0;
}

void     modemvar2str(int b, char p, int d, int s, char *str)
{
	char   mline[15];
	int    n;

	sprintf(mline, "%6ld-%c-%c-%c", bauds[b], p, databit[d - 7][0], stopbit[s - 1][0]);
	n = strlen(mline);
	memcpy(str, mline, n);
	*(str + n) = 0;
}

