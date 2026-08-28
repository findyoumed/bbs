/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : clrscr.c  -- ÑÁ¡e »¡¶‹¡ ¡¡—I                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

extern   int      hgx2r, hgy2r;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgEnableClearScreen(void (*p)());
void     hgClearScreen();

void     hcls(byte mask);
void     hgc_cls();
void     vcls(char color);
void     vga_cls();

			/* function pointer */
void   (*clr)();


void     hgEnableClearScreen(void (*p)())
{
	clr = p;
}

void     hgClearScreen()
{
	(*clr)();
}

void     hcls(byte mask)
{
		asm  mov  ax, 0b000h
		asm  mov  es, ax
		asm  xor  di, di
		asm  cld
		asm  mov  cx, 16384	/* B000:0000 - B000:7999 */
		asm  mov  ah, BYTE PTR mask
		asm  mov  al, ah
		asm  REP  stosw
}

void     hgc_cls()
{
	byte   mask = 0;

	hcls(mask);
}

void     vcls(char color)
{
					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  al, 0		/* al = 0(GRCTRL Set/Reset reg.) */
		asm  mov  ah, color	/* ah = color value of reg. 0 */
		asm  out  dx, ax

		asm  mov  ax, 0f01h	/* al = 1(GRCTRL Enable Set/Reset reg.)
					   ah = 0fh(reg. 1 value): bits 0 - 3 enable */
		asm  out  dx, ax

		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
		asm  out  dx, ax

		asm  mov  ax, 0a000h
		asm  mov  es, ax
		asm  xor  di, di

		asm  mov  ax, hgx2r
		asm  inc  ax		/* ax = hgx2r + 1 */
		asm  shr  ax, 1
		asm  shr  ax, 1
		asm  shr  ax, 1		/* ax = (hgx2r + 1) / 8 */
		asm  mov  bx, hgy2r
		asm  inc  bx		/* bx = hgy2r + 1 */
		asm  mul  bx		/* ax = ((hgx2r + 1) / 8) * (hgy2r + 1) */
		asm  cld
		asm  mov  cx, ax
		asm  shr  cx, 1
		asm  REP  stosw
		asm  adc  cx, 0
		asm  REP  stosb

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
}

void     vga_cls()
{
	vcls(BLACK);
}
