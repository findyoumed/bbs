/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : plot.c  -- ¸ñ ¡¡—I                            |
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

extern   int      xbyte;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgEnablePlot(void (*p)(int x, int y, char color));
void     hgPlotXy(int x, int y, char color);
void     hgEnableGetPlot(char (*p)(int x, int y));
char     hgGetPlotXy(int x, int y);

void     hgc_plot(int x, int y, char color);
char     hgc_getplot(int x, int y);
void     vga_plot(int x, int y, char color);
char     vga_getplot(int x, int y);

			/* function pointer */
void   (*plot)(int x, int y, char color);
char   (*glot)(int x, int y);


void     hgEnablePlot(void (*p)(int x, int y, char color))
{
	plot = p;
}

void     hgPlotXy(int x, int y, char color)
{
	(*plot)(x, y, color);
}

void     hgEnableGetPlot(char (*p)(int x, int y))
{
	glot = p;
}

char     hgGetPlotXy(int x, int y)
{
	char   ret;

	ret = (*glot)(x, y);
	return(ret);
}

void     hgc_plot(int x, int y, char color)
{
		asm  mov  ax, y
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  shr  ax, 1		/* ax = y / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y & 1) + x / 2 */
		asm  shr  ax, 1		/* ax = y / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y & 3) + x / 4 */
		asm  shr  bx, 1		/* bx = 0x2000 * (y & 3) + x / 8
					      = 0x2000 * (y % 4) + x / 8 */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y / 4) */
		asm  add  bx, ax	/* bx = 0x2000 * (y % 4) + x / 8 + 80 * (y / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  cmp  BYTE PTR color, BLACK
		asm  jnz  pnext

		asm  not  ah
		asm  and  es:[bx], ah
	return;

pnext:		asm  or   es:[bx], ah
	return;
}

char     hgc_getplot(int x, int y)
{
		asm  mov  ax, y
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  shr  ax, 1		/* ax = y / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y & 1) + x / 2 */
		asm  shr  ax, 1		/* ax = y / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y & 3) + x / 4 */
		asm  shr  bx, 1		/* bx = 0x2000 * (y & 3) + x / 8
					      = 0x2000 * (y % 4) + x / 8 */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y / 4) */
		asm  add  bx, ax	/* bx = 0x2000 * (y % 4) + x / 8 + 80 * (y / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  al, 15	/* Ó…¬‚ Ï¢­I¯¡ */
		asm  and  ah, es:[bx]
		asm  jnz  pnext
		asm  mov  al, 0		/* ˆñ·e¬‚ Ï¢­I¯¡ */

pnext:		asm  xor  ah, ah
}

void     vga_plot(int x, int y, char color)
{
	int   xw = xbyte;

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0205h	/* al = 5(GRCTRL Mode reg.)
					   ah = 2(reg. 5 value)
						bit 3 = 0(read mode 0)
						bits 0 - 1 = 2(write mode 2) */
		asm  out  dx, ax

		asm  mov  ax, y
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask(reg. 8 value) */
		asm  out  dx, ax

		asm  mov  ah, BYTE PTR es:[bx]
		asm  mov  ah, BYTE PTR color
		asm  mov  es:[bx], ah

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax
}

char     vga_getplot(int x, int y)
{
	int   xw = xbyte;

		asm  mov  ax, y
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  ah, 80h	/* ah = 10000000b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */
		asm  mov  ch, ah

		asm  mov  si, bx	/* es:si = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  xor  bl, bl	/* Ï¢­Iˆt·i ´è“e•A ¬a¶w */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0304h	/* al = 4(GRCTRL Read Map Select reg.)
					   ah = 3(reg. 5 value)
						first bit plane to read */
gloop:		asm  out  dx, ax	/* select next memory map to read */
		asm  mov  bh, BYTE PTR es:[si]
		asm  and  bh, ch	/* masking */
		asm  neg  bh		/* bit 7 of bh = 1 if masked bit = 1
							 0 if masked bit = 0 */
		asm  rol  bx, 1
		asm  dec  ah
		asm  jge  gloop

		asm  mov  al, bl
		asm  xor  ah, ah
}
