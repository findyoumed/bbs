/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : line.c -- ¬å ¡¡—I                             |
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

byte     hlxpat[16];			/* ÐáÇiA¯aµA¬á· ¬å ÌÈå */
byte     hlypat[16];

extern   int      xbyte;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgEnableLine(void (*l)(int x1, int y1, int x2, int y2, char color));
void     hgLine(int x1, int y1, int x2, int y2, char color);
void     hgEnableHVline(void (*h)(int x1, int x2, int y, char color),
			void (*v)(int x, int y1, int y2, char color));
void     hgHline(int x1, int x2, int y, char color);
void     hgVline(int x, int y1, int y2, char color);
void     hgDHline(int x1, int x2, int y);
void     hgDVline(int x, int y1, int y2);

byte     hgGetHlinePattern(char color);
byte     hgGetVlinePattern(char color);
void     hgSetHlinePattern(char color, byte pat);
void     hgSetVlinePattern(char color, byte pat);
void     hgSetHVlineDefault();

void     hgc_hline(int x1, int x2, int y, char color);
void     hgc_vline(int x, int y1, int y2, char color);
void     vga_hline(int x1, int x2, int y, char color);
void     vga_vline(int x, int y1, int y2, char color);
void     hgc_lineg(int x1, int y1, int x2, int y2, char color);
void     vga_lineg(int x1, int y1, int x2, int y2, char color);
void     hgBox(int x1, int y1, int x2, int y2, char color);

			/* function pointer */
void   (*lineg)(int x1, int y1, int x2, int y2, char color);
void   (*hline)(int x1, int x2, int y, char color);
void   (*vline)(int x, int y1, int y2, char color);


void     hgEnableLine(void (*l)(int x1, int y1, int x2, int y2, char color))
{
	lineg = l;
}

void     hgLine(int x1, int y1, int x2, int y2, char color)
{
	(*lineg)(x1, y1, x2, y2, color);
}

void     hgEnableHVline(void (*h)(int x1, int x2, int y, char color),
			void (*v)(int x, int y1, int y2, char color))
{
	hline = h;
	vline = v;
}

void     hgHline(int x1, int x2, int y, char color)
{
	(*hline)(x1, x2, y, color);
}

void     hgVline(int x, int y1, int y2, char color)
{
	(*vline)(x, y1, y2, color);
}

void     hgDHline(int x1, int x2, int y)
{
	(*hline)(x1, x2, y, DARKGRAY);
	(*hline)(x1, x2, y+1, WHITE);
}

void     hgDVline(int x, int y1, int y2)
{
	(*vline)(x, y1, y2, WHITE);
	(*vline)(x + 1, y1, y2, DARKGRAY);
}

byte     hgGetHlinePattern(char color)
{
	return(hlxpat[color]);
}

byte     hgGetVlinePattern(char color)
{
	return(hlypat[color]);
}

void     hgSetHlinePattern(char color, byte pat)
{
	hlxpat[color] = pat;
}

void     hgSetVlinePattern(char color, byte pat)
{
	hlypat[color] = pat;
}

void     hgSetHVlineDefault()
{
	byte  xx[16] = {
		0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xaa,
		0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
	};
	byte  yy[16] = {
		0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xaa,
		0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff
	};
	int   i;

	for (i = 0;i < 16;i++) {
		hgSetHlinePattern(i, xx[i]);
		hgSetVlinePattern(i, yy[i]);
	}
}

void     hgc_hline(int x1, int x2, int y, char color)
{
	byte   xpattern = hgGetHlinePattern(color);

		asm  push ds

		asm  mov  ax, y
		asm  mov  bx, x1

		asm  mov  cl, bl	/* cl = x1ˆt· Ða¶á ¤a·¡Ëa */
		asm  shr  ax, 1		/* ax = y / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y & 1) + x1 / 2 */
		asm  shr  ax, 1		/* ax = y / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y & 3) + x1 / 4 */
		asm  shr  bx, 1		/* bx = 0x2000 * (y & 3) + x1 / 8
					      = 0x2000 * (y % 4) + x1 / 8 */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y / 4) */
		asm  add  bx, ax	/* bx = 0x2000 * (y % 4) + x1 / 8 + 80 * (y / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x1, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x1, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x1 & 7 = x1 % 8 */
		asm  mov  dh, 0ffh	/* dh = 11111111b = unshifted bit mask */
		asm  shr  dh, cl	/* dh =  … ¶E½¢· §¡Ëa  a¯aÇa */

		asm  mov  cx, x2
		asm  and  cl, 7		/* cl = x2 & 7 = x2 % 8 */
		asm  xor  cl, 7
		asm  mov  dl, 0ffh	/* dl = 11111111b = unshifted bit mask */
		asm  shl  dl, cl	/* dl =   … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */

		asm  mov  ax, x2
		asm  mov  bx, x1
		asm  mov  cl, 3
		asm  shr  ax, cl
		asm  shr  bx, cl
		asm  mov  cx, ax
		asm  sub  cx, bx	/* cx = Ðe œa·¥”w ¤a·¡Ëa® - 1 */

		asm  mov  al, xpattern

			/* œa·¥·  … ¶E½¢· Ï¢­Iˆt »¡¸÷ */
		asm  cmp  dh, 0ffh
		asm  je   hnext2	/* ¤a·¡Ëa ”e¶á¡ ¸÷i¯¡ */

		asm  or   cx, cx
		asm  jnz  hnext1	/* 1 ¤a·¡Ëa ·¡¬w· œa·¥¯¡ */

		asm  and  dl, dh	/* §¡Ëa  a¯aÇa */
		asm  jmp  SHORT hnext3

hnext1:		asm  mov  ah, al
		asm  and  ah, dh
		asm  not  dh
		asm  and  es:[di], dh
		asm  or   es:[di], ah
		asm  inc  di
		asm  dec  cx

			/* œa·¥· º—ˆe¦¦… */
hnext2:		asm  REP  stosb

			/* œa·¥·  … µ¡Ÿe½¢· Ï¢­Iˆt »¡¸÷ */
hnext3:		asm  and  al, dl
		asm  not  dl
		asm  and  es:[di], dl
		asm  or   es:[di], al

		asm  pop  ds
}

void     hgc_vline(int x, int y1, int y2, char color)
{
	byte   ypattern = hgGetVlinePattern(color);

		asm  push ds

		asm  mov  ax, y1
		asm  mov  bx, y2
		asm  mov  cx, bx
		asm  sub  cx, ax
		asm  inc  cx		/* Ðe œa·¥”w ¤e¥¢ÒU® */
		asm  mov  bx, x
		asm  push cx

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  shr  ax, 1		/* ax = y1 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y1 & 1) + x / 2 */
		asm  shr  ax, 1		/* ax = y1 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y1 & 3) + x / 4 */
		asm  shr  bx, 1		/* bx = 0x2000 * (y1 & 3) + x / 8
					      = 0x2000 * (y1 % 4) + x / 8 */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y1 / 4) */
		asm  add  bx, ax	/* bx = 0x2000 * (y1 % 4) + x / 8 + 80 * (y1 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  dh, 80h	/* dh = 10000000b = unshifted bit mask */
		asm  shr  dh, cl	/* dh = §¡Ëa  a¯aÇa */
		asm  mov  al, dh
		asm  mov  dl, ypattern

		asm  pop  cx

vloop:		asm  test dl, dl
		asm  jnz  vnext2

		asm  not  al		/* Ï¢­Iˆt·¡ 0·©˜ */
		asm  and  es:[di], al
		asm  not  al
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   jp2
		asm  sub  di, 7fb0h

jp2:		asm  jmp  vnext

vnext2:		asm  or   es:[di], al	/* Ï¢­Iˆt·¡ 0·¡ ´a“©˜ */
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   jp3
		asm  sub  di, 7fb0h

jp3:		asm  rol  dl, 1
		asm  jc   jp4
		asm  mov  al, 0
		asm  jmp  vnext

jp4:		asm  mov  al, dh

vnext:		asm  loop vloop

		asm  pop  ds
}

void     vga_hline(int x1, int x2, int y, char color)
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

		asm  mov  ax, y
		asm  mov  bx, x1

		asm  mov  cl, bl	/* cl = x1ˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x1 / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x1, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x1 & 7 = x1 % 8 */
		asm  mov  dh, 0ffh	/* dh = 11111111b = unshifted bit mask */
		asm  shr  dh, cl	/* dh =  … ¶E½¢· §¡Ëa  a¯aÇa */

		asm  mov  cx, x2
		asm  and  cl, 7		/* cl = x2 & 7 = x2 % 8 */
		asm  xor  cl, 7
		asm  mov  dl, 0ffh	/* dl = 11111111b = unshifted bit mask */
		asm  shl  dl, cl	/* dl =   … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */

		asm  mov  ax, x2
		asm  mov  bx, x1
		asm  mov  cl, 3
		asm  shr  ax, cl
		asm  shr  bx, cl
		asm  mov  cx, ax
		asm  sub  cx, bx	/* cx = Ðe œa·¥”w ¤a·¡Ëa® - 1 */

		asm  mov  bx, dx	/* bh =  … ¶E½¢· §¡Ëa  a¯aÇa
					   bl =  … µ¡Ÿe½¢· §¡Ëa  a¯aÇa */
		asm  mov  dx, 3ceh
		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.) */

		asm  push es
		asm  pop  ds
		asm  mov  si, di	/* ds:si = (x1, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

			/* œa·¥·  … ¶E½¢· Ï¢­Iˆt »¡¸÷ */
		asm  cmp  bh, 0ffh
		asm  je   hnext2	/* ¤a·¡Ëa ”e¶á¡ ¸÷i¯¡ */

		asm  or   cx, cx
		asm  jnz  hnext1	/* 1 ¤a·¡Ëa ·¡¬w· œa·¥¯¡ */

		asm  and  bl, bh	/* §¡Ëa  a¯aÇa */
		asm  jmp  SHORT hnext3

hnext1:		asm  mov  ah, bh
		asm  out  dx, ax
		asm  movsb
		asm  dec  cx

			/* œa·¥· º—ˆe¦¦… */
hnext2:		asm  mov  ah, 0ffh
		asm  out  dx, ax
		asm  REP  movsb

			/* œa·¥·  … µ¡Ÿe½¢· Ï¢­Iˆt »¡¸÷ */
hnext3:		asm  mov  ah, bl
		asm  out  dx, ax
		asm  movsb

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_vline(int x, int y1, int y2, char color)
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
		asm  mov  bx, y2
		asm  mov  cx, bx
		asm  sub  cx, ax
		asm  inc  cx		/* Ðe œa·¥”w ¤e¥¢ÒU® */
		asm  mov  bx, x
		asm  push cx

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  pop  cx

		asm  mov  al, 8		/* al = 0(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

vloop:		asm  mov  al, es:[di]
		asm  mov  es:[di], ah
		asm  add  di, xw
		asm  loop vloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     hgc_lineg(int x1, int y1, int x2, int y2, char color)
{
	int   vdx, vdy, vix, viy, vinc;

		asm  push ds

		asm  mov  ax, x2	/* vdx, vdy, vix, viy ‰¬e */
		asm  sub  ax, x1
		asm  mov  vdx, ax
		asm  test ax, 8000h
		asm  jz   jp1
		asm  neg  ax

jp1:		asm  mov  vix, ax
		asm  mov  ax, y2
		asm  sub  ax, y1
		asm  mov  vdy, ax
		asm  test ax, 8000h
		asm  jz   jp2
		asm  neg  ax

jp2:		asm  mov  viy, ax
		asm  mov  ax, vix	/* vinc“e vixµÁ viyº— Çe ˆt */
		asm  cmp  ax,viy
		asm  jc   jp3
		asm  mov  vinc, ax
		asm  jmp  lnext2

jp3:		asm  mov  ax, viy
		asm  mov  vinc, ax

lnext2:		asm  mov  ax, y1
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
		asm  add  bx, ax	/* bx = 0x2000 * (y1 % 4) + x1 / 8 + 80 * (y1 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x1 & 7 = x1 % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  cmp  BYTE PTR color, BLACK
		asm  jz   jp4

		asm  or   es:[bx], ah	/* Ï¢­Iˆt·¡ 0·¡ ´a“©˜ */
		asm  jmp  jp5

jp4:		asm  not  ah		/* Ï¢­Iˆt·¡ 0·©˜ */
		asm  and  es:[bx], ah
		asm  not  ah

jp5:		asm  mov  si, 0		/* si = x */
		asm  mov  di, 0		/* di = y */
		asm  mov  cx, vinc	/* cx = ¤e¥¢ÒU® */
		asm  inc  cx

lloop:		asm  mov  al, 0
		asm  add  si, vix	/* x += vix */
		asm  add  di, viy	/* y += viy */
		asm  cmp  si, vinc	/* si > inc ? */
		asm  jle  yproc
		asm  mov  al, 1
		asm  sub  si, vinc
		asm  cmp  WORD PTR vdx, 0
		asm  jle  lnext3

		asm  shr  ah, 1		/* »wˆa »¢¬å */
		asm  jnz  yproc
		asm  mov  ah, 80h	/* §¡Ëa  a¯aÇa ¸¬é¸÷ */
		asm  inc  bx
		asm  jmp  yproc

lnext3:		asm  shl  ah, 1		/* ˆq­¡ »¢¬å */
		asm  jnz  yproc
		asm  mov  ah, 01h	/* §¡Ëa  a¯aÇa ¸¬é¸÷ */
		asm  dec  bx

yproc:		asm  cmp  di, vinc
		asm  jle  lnext5
		asm  mov  al, 1
		asm  sub  di, vinc
		asm  cmp  WORD PTR vdy, 0
		asm  jle  lnext4

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp6
		asm  sub  bx, 7fb0h

jp6:		asm  jmp  lnext5

lnext4:		asm  sub  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   lnext5
		asm  add  bx, 7fb0h

lnext5:		asm  cmp  al, 1
		asm  jnz  end

		asm  cmp  BYTE PTR color, BLACK
		asm  jz   jp7
		asm  or   es:[bx], ah
		asm  jmp  end

jp7:		asm  not  ah
		asm  and  es:[bx], ah
		asm  not  ah

end:		asm  loop lloop

		asm  pop  ds
}

void     vga_lineg(int x1, int y1, int x2, int y2, char color)
{
	int   vdx, vdy, vix, viy, vinc;
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

		asm  mov  ax, x2	/* vdx, vdy, vix, viy ‰¬e */
		asm  sub  ax, x1
		asm  mov  vdx, ax
		asm  test ax, 8000h
		asm  jz   jp1
		asm  neg  ax

jp1:		asm  mov  vix, ax
		asm  mov  ax, y2
		asm  sub  ax, y1
		asm  mov  vdy, ax
		asm  test ax, 8000h
		asm  jz   jp2
		asm  neg  ax

jp2:		asm  mov  viy, ax
		asm  mov  ax, vix	/* vinc“e vixµÁ viyº— Çe ˆt */
		asm  cmp  ax,viy
		asm  jc   jp3
		asm  mov  vinc, ax
		asm  jmp  lnext2

jp3:		asm  mov  ax, viy
		asm  mov  vinc, ax

lnext2:		asm  mov  ax, y1
		asm  mov  bx, x1

		asm  mov  cl, bl	/* cl = x1ˆt· Ða¶á ¤a·¡Ëa */
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

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  al, 8
		asm  out  dx, ax
		asm  mov  al, es:[bx]
		asm  mov  es:[bx], al

		asm  mov  si, 0		/* si = x */
		asm  mov  di, 0		/* di = y */
		asm  mov  cx, vinc	/* cx = ¤e¥¢ÒU® */
		asm  inc  cx

lloop:		asm  mov  al, 0
		asm  add  si, vix	/* x += vix */
		asm  add  di, viy	/* y += viy */
		asm  cmp  si, vinc	/* si > inc ? */
		asm  jle  yproc
		asm  mov  al, 1
		asm  sub  si, vinc
		asm  cmp  WORD PTR vdx, 0
		asm  jle  lnext3

		asm  shr  ah, 1		/* »wˆa »¢¬å */
		asm  jnz  yproc
		asm  mov  ah, 80h	/* §¡Ëa  a¯aÇa ¸¬é¸÷ */
		asm  inc  bx
		asm  jmp  yproc

lnext3:		asm  shl  ah, 1		/* ˆq­¡ »¢¬å */
		asm  jnz  yproc
		asm  mov  ah, 01h	/* §¡Ëa  a¯aÇa ¸¬é¸÷ */
		asm  dec  bx

yproc:		asm  cmp  di, vinc
		asm  jle  lnext5
		asm  mov  al, 1
		asm  sub  di, vinc
		asm  cmp  WORD PTR vdy, 0
		asm  jle  lnext4

		asm  add  bx, xw
		asm  jmp  lnext5

lnext4:		asm  sub  bx, xw

lnext5:		asm  cmp  al, 1
		asm  jnz  end

		asm  mov  al, 8
		asm  out  dx, ax
		asm  mov  al, es:[bx]
		asm  mov  es:[bx], al

end:		asm  loop lloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     hgBox(int x1, int y1, int x2, int y2, char color)
{
	hgHline(x1, x2, y1, color);
	hgHline(x1, x2, y2, color);
	hgVline(x1, y1, y2, color);
	hgVline(x2, y1, y2, color);
}
