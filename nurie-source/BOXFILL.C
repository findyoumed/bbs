/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : boxfill.c  -- ¤b¯a À¶‘ ¡¡—I                  |
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

byte     hfxpat[16];			/* ÐáÇiA¯aµA¬á· ¤b¯a À¶‘ ÌÈå */
byte     hfypat[16];

extern   int      xbyte;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgEnableBoxFill(void (*b)(int x1, int y1, int x2, int y2, char color));
void     hgBoxFill(int x1, int y1, int x2, int y2, char color);

byte     hgGetHFillXPattern(char color);
byte     hgGetHFillYPattern(char color);
void     hgSetHFillXPattern(char color, byte pattern);
void     hgSetHFillYPattern(char color, byte pattern);
void     hgSetHFillDPattern();

void     hgc_boxfill(int x1, int y1, int x2, int y2, char color);
void     vga_boxfill(int x1, int y1, int x2, int y2, char color);

			/* function pointer */
void   (*boxfl)(int x1, int y1, int x2, int y2, char color);


void     hgEnableBoxFill(void (*b)(int x1, int y1, int x2, int y2, char color))
{
	boxfl = b;
}

void     hgBoxFill(int x1, int y1, int x2, int y2, char color)
{
	(*boxfl)(x1, y1, x2, y2, color);
}

byte     hgGetHFillXPattern(char color)
{
	return(hfxpat[color]);
}

byte     hgGetHFillYPattern(char color)
{
	return(hfypat[color]);
}

void     hgSetHFillXPattern(char color, byte pattern)
{
	hfxpat[color] = pattern;
}

void     hgSetHFillYPattern(char color, byte pattern)
{
	hfypat[color] = pattern;
}

void     hgSetHFillDPattern()
{
	int   i;
	byte  xx[16] = {
		0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xaa,
		0xaa, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
	};
	byte  yy[16] = {
		0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
		0xaa, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
	};

	for (i = 0;i < 16;i++) {
		hgSetHFillXPattern(i, xx[i]);
		hgSetHFillYPattern(i, yy[i]);
	}
}


void     hgc_boxfill(int x1, int y1, int x2, int y2, char color)
{
	byte   xpattern = hgGetHFillXPattern(color);
	byte   xpatt_temp = xpattern;
	byte   ypattern = hgGetHFillYPattern(color);

		asm  push ds

		asm  mov  ax, y1
		asm  mov  bx, x1

		asm  mov  cl, bl	/* cl = x1ˆt· Ða¶á ¤a·¡Ëa */
		asm  shr  ax, 1		/* ax = y1 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y1 & 1) + x1 / 2 */
		asm  shr  ax, 1		/* ax = y1 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y1 & 3) + x1 / 4 */
		asm  shr  bx, 1		/* bx = 0x2000 * (y1 & 3) + x1 / 8
					      = 0x2000 * (y1 % 4) + x1 / 8 */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y1 / 4) */
		asm  add  bx, ax	/* bx = 0x2000 * (y1 % 4) + x1 / 8 + 80 * (y / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  cx, x1
		asm  and  cx, 7		/* cx = x1 & 7 = x1 % 8 */
		asm  jz   fnext2	/* ¤a·¡Ëa ”e¶á¡ ¸÷i¯¡ */

		asm  mov  ax, x1
		asm  sub  ax, cx
		asm  add  ax, 8
		asm  mov  x1, ax	/* x1·e ”a·q· ¸÷i–E ¤a·¡ËaŸi ˆaŸ¡Ç¥”a. */

		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah =  … ¶E½¢· §¡Ëa  a¯aÇa */

		asm  mov  cx, x2
		asm  sub  cx, x1
		asm  jg   fnext1	/* 1 ¤a·¡Ëa ·¡¬w· ¤b¯a¯¡ */

		asm  mov  cx, x2
		asm  and  cl, 7		/* cl = x2 & 7 = x2 % 8 */
		asm  xor  cl, 7
		asm  mov  bl, 0ffh	/* bl = 11111111b = unshifted bit mask */
		asm  shl  bl, cl	/* bl =   … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */
		asm  and  ah, bl	/* §¡Ëa  a¯aÇa */

			/* ¤b¯a·  … ¶E½¢· Ï¢­Iˆt »¡¸÷ */
fnext1:		asm  mov  dh, BYTE PTR xpattern
		asm  mov  dl, BYTE PTR ypattern

		asm  rol  dl, 1
		asm  mov  bx, WORD PTR y1
		asm  shr  bx, 1
		asm  jnc  jp1
		asm  rol  dh, 1

jp1:		asm  mov  al, dh
		asm  and  al, ah

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx
		asm  push di

floop1:		asm  not  ah
		asm  and  es:[di], ah
		asm  not  ah
		asm  or   es:[di], al
		asm  rol  dh, 1
		asm  cmp  dh, 0
		asm  je   jp2
		asm  mov  BYTE PTR xpatt_temp, dh

jp2:		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   jp3
		asm  sub  di, 7fb0h

jp3:		asm  rol  dl, 1
		asm  jc   jp4
		asm  mov  dh, 0
		asm  jmp  bfnext

jp4:		asm  mov  dh, BYTE PTR xpatt_temp

bfnext:		asm  mov  al, dh
		asm  and  al, ah
		asm  loop floop1

		asm  pop  di
		asm  inc  di

			/* ¤b¯a· º—ˆe¦¦… */
fnext2:		asm  mov  cx, x2
		asm  sub  cx, x1
		asm  jnl  jp5
		asm  jmp  fnext4

jp5:		asm  inc  cx
		asm  cmp  cx, 8
		asm  jl   fnext3

		asm  mov  bx, y2
		asm  sub  bx, y1
		asm  inc  bx

		asm  shr  cx, 1
		asm  shr  cx, 1
		asm  shr  cx, 1		/* cx = Ðe œa·¥”w ¤a·¡Ëa· ˆ•® - 1 */

		asm  mov  dh, BYTE PTR xpattern
		asm  mov  dl, BYTE PTR ypattern

		asm  rol  dl, 1
		asm  push bx
		asm  mov  bx, WORD PTR y1
		asm  shr  bx, 1
		asm  jnc  jp6
		asm  rol  dh, 1

jp6:		asm  mov  al, dh
		asm  pop  bx
		asm  push di

floop2:		asm  push cx
		asm  push di
		asm  REP  stosb
		asm  rol  dh, 1
		asm  cmp  dh, 0
		asm  je   jp7
		asm  mov  BYTE PTR xpatt_temp, dh

jp7:		asm  pop  di
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   jp8
		asm  sub  di, 7fb0h

jp8:		asm  rol  dl, 1
		asm  jc   jp9
		asm  mov  dh, 0
		asm  jmp  bfnext1

jp9:		asm  mov  dh, BYTE PTR xpatt_temp

bfnext1:	asm  mov  al, dh

		asm  pop  cx
		asm  dec  bx
		asm  jg   floop2

		asm  pop  di
		asm  add  di, cx

			/* ¤b¯a·  … µ¡Ÿe½¢· Ï¢­Iˆt »¡¸÷ */
fnext3:		asm  mov  cx, x2
		asm  inc  cx
		asm  and  cl, 7
		asm  jz   fnext4	/* ¤a·¡Ëa ”e¶á¡ ¸÷i¯¡ */
		asm  mov  ax, 00ffh
		asm  ror  ax, cl	/* ah =  … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */

		asm  mov  dh, BYTE PTR xpattern
		asm  mov  dl, BYTE PTR ypattern

		asm  rol  dl, 1
		asm  mov  bx, WORD PTR y1
		asm  shr  bx, 1
		asm  jnc  jp10
		asm  rol  dh, 1

jp10:		asm  mov  al, dh
		asm  and  al, ah

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx

floop3:		asm  not  ah
		asm  and  es:[di], ah
		asm  not  ah
		asm  or   es:[di], al
		asm  rol  dh, 1
		asm  cmp  dh, 0
		asm  je   jp11
		asm  mov  BYTE PTR xpatt_temp, dh

jp11:		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   jp12
		asm  sub  di, 7fb0h

jp12:		asm  rol  dl, 1
		asm  jc   jp13
		asm  mov  dh, 0
		asm  jmp  bfnext2

jp13:		asm  mov  dh, BYTE PTR xpatt_temp

bfnext2:	asm  mov  al, dh
		asm  and  al, ah
		asm  loop floop3

fnext4:
		asm  pop  ds
}

void     vga_boxfill(int x1, int y1, int x2, int y2, char color)
{
	int   xw = xbyte;

		asm  push ds

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  al, 0		/* al = 0(GRCTRL Set/Reset reg.) */
		asm  mov  ah, color	/* ah = color value of reg. 0 */
		asm  out  dx, ax

		asm  mov  ax, 0f01h	/* al = 1(GRCTRL Enable Set/Reset reg.)
					   ah = 0fh(reg. 1 value): bits 0 - 3 enable */
		asm  out  dx, ax

		asm  mov  ax, y1
		asm  mov  bx, x1

		asm  push dx
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x1 / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  cx, x1
		asm  and  cx, 7		/* cx = x1 & 7 = x1 % 8 */
		asm  jz   fnext2	/* ¤a·¡Ëa ”e¶á¡ ¸÷i¯¡ */

		asm  mov  ax, x1
		asm  sub  ax, cx
		asm  add  ax, 8
		asm  mov  x1, ax	/* x1·e ”a·q· ¸÷i–E ¤a·¡ËaŸi ˆaŸ¡Ç¥”a. */

		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah =  … ¶E½¢· §¡Ëa  a¯aÇa */

		asm  mov  cx, x2
		asm  sub  cx, x1
		asm  jg   fnext1	/* 1 ¤a·¡Ëa ·¡¬w· ¤b¯a¯¡ */

		asm  mov  cx, x2
		asm  and  cl, 7		/* cl = x2 & 7 = x2 % 8 */
		asm  xor  cl, 7
		asm  mov  bl, 0ffh	/* bl = 11111111b = unshifted bit mask */
		asm  shl  bl, cl	/* bl =   … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */
		asm  and  ah, bl	/* §¡Ëa  a¯aÇa */

			/* ¤b¯a·  … ¶E½¢· Ï¢­Iˆt »¡¸÷ */
fnext1:		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx
		asm  push di

floop1:		asm  mov  al, es:[di]
		asm  mov  es:[di], al
		asm  add  di, xw
		asm  loop floop1

		asm  pop  di
		asm  inc  di

			/* ¤b¯a· º—ˆe¦¦… */
fnext2:		asm  mov  cx, x2
		asm  sub  cx, x1
		asm  jl   fnext4
		asm  inc  cx
		asm  cmp  cx, 8
		asm  jl   fnext3

		asm  mov  bx, y2
		asm  sub  bx, y1
		asm  inc  bx

		asm  shr  cx, 1
		asm  shr  cx, 1
		asm  shr  cx, 1		/* cx = Ðe œa·¥”w ¤a·¡Ëa· ˆ•® - 1 */

		asm  mov  ax, 0ff08h
		asm  out  dx, ax
		asm  push di

floop2:		asm  push cx
		asm  push di
		asm  REP  stosb
		asm  pop  di
		asm  add  di, xw
		asm  pop  cx
		asm  dec  bx
		asm  jg   floop2

		asm  pop  di
		asm  add  di, cx

			/* ¤b¯a·  … µ¡Ÿe½¢· Ï¢­Iˆt »¡¸÷ */
fnext3:		asm  mov  cx, x2
		asm  inc  cx
		asm  and  cl, 7
		asm  jz   fnext4	/* ¤a·¡Ëa ”e¶á¡ ¸÷i¯¡ */
		asm  mov  ax, 00ffh
		asm  ror  ax, cl	/* ah =  … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */

		asm  mov  al, 8
		asm  out  dx, ax

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx

floop3:		asm  mov  al, es:[di]
		asm  mov  es:[di], al
		asm  add  di, xw
		asm  loop floop3

fnext4:
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}
