/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : scroll.c  -- ¯aÇa© ¡¡—I                      |
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

void     hgEnableScrUp(void (*u)(int x1, int y1, int x2, int y2, int lines, char color));
void     hgEnableScrDown(void (*d)(int x1, int y1, int x2, int y2, int lines, char color));
void     hgEnableScrLeft(void (*l)(int x1, int y1, int x2, int y2, int rows, char color));
void     hgEnableScrRight(void (*r)(int x1, int y1, int x2, int y2, int rows, char color));
void     hgScrUp(int x1, int y1, int x2, int y2, int lines, char color);
void     hgScrDown(int x1, int y1, int x2, int y2, int lines, char color);
void     hgScrLeft(int x1, int y1, int x2, int y2, int rows, char color);
void     hgScrRight(int x1, int y1, int x2, int y2, int rows, char color);

void     hscrup(int x1, int y1, int x2, int y2, int lines);
void     hsideup(int x, int y1, int y2, int lines, byte mask);
void     hgc_scrup(int x1, int y1, int x2, int y2, int lines, char color);
void     hscrdown(int x1, int y1, int x2, int y2, int lines);
void     hsidedown(int x, int y1, int y2, int lines, byte mask);
void     hgc_scrdown(int x1, int y1, int x2, int y2, int lines, char color);
void     hscrleft(int x1, int y1, int x2, int y2, int rows);
void     hgc_scrleft(int x1, int y1, int x2, int y2, int rows, char color);
void     hscrright(int x1, int y1, int x2, int y2, int rows);
void     hgc_scrright(int x1, int y1, int x2, int y2, int rows, char color);

void     vscrup(int x1, int y1, int x2, int y2, int lines);
void     vsideup(int x, int y1, int y2, int lines, byte mask);
void     vga_scrup(int x1, int y1, int x2, int y2, int lines, char color);
void     vscrdown(int x1, int y1, int x2, int y2, int lines);
void     vsidedown(int x, int y1, int y2, int lines, byte mask);
void     vga_scrdown(int x1, int y1, int x2, int y2, int lines, char color);
void     vscrleft(int x1, int y1, int x2, int y2, int rows);
void     vga_scrleft(int x1, int y1, int x2, int y2, int rows, char color);
void     vscrright(int x1, int y1, int x2, int y2, int rows);
void     vga_scrright(int x1, int y1, int x2, int y2, int rows, char color);

			/* function pointer */
void   (*scrlu)(int x1, int y1, int x2, int y2, int lines, char color);
void   (*scrld)(int x1, int y1, int x2, int y2, int lines, char color);
void   (*scrll)(int x1, int y1, int x2, int y2, int rows, char color);
void   (*scrlr)(int x1, int y1, int x2, int y2, int rows, char color);


void     hgEnableScrUp(void (*u)(int x1, int y1, int x2, int y2, int lines, char color))
{
	scrlu = u;
}

void     hgEnableScrDown(void (*d)(int x1, int y1, int x2, int y2, int lines, char color))
{
	scrld = d;
}

void     hgEnableScrLeft(void (*l)(int x1, int y1, int x2, int y2, int rows, char color))
{
	scrll = l;
}

void     hgEnableScrRight(void (*r)(int x1, int y1, int x2, int y2, int rows, char color))
{
	scrlr = r;
}

void     hgScrUp(int x1, int y1, int x2, int y2, int lines, char color)
{
	(*scrlu)(x1, y1, x2, y2, lines, color);
}

void     hgScrDown(int x1, int y1, int x2, int y2, int lines, char color)
{
	(*scrld)(x1, y1, x2, y2, lines, color);
}

void     hgScrLeft(int x1, int y1, int x2, int y2, int rows, char color)
{
	(*scrll)(x1, y1, x2, y2, rows, color);
}

void     hgScrRight(int x1, int y1, int x2, int y2, int rows, char color)
{
	(*scrlr)(x1, y1, x2, y2, rows, color);
}

void     hscrup(int x1, int y1, int x2, int y2, int lines)
{
	int   x_width = x2 - x1 + 1;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  push cx

		asm  mov  ax, y1
		asm  xor  bx, bx

		asm  shr  ax, 1		/* ax = y1 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y1 & 1) */
		asm  shr  ax, 1		/* ax = y1 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y1 & 3) */
		asm  shr  bx, 1		/* bx = 0x2000 * (y1 & 3) = 0x2000 * (y1 % 4) */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y1 / 4) */
		asm  add  bx, ax
		asm  add  bx, x1	/* bx = 0x2000 * (y1 % 4) + x1 / 8 + 80 * (y1 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax
		asm  mov  dx, bx

		asm  mov  cx, WORD PTR lines

uploop:		asm  add  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp1
		asm  sub  dx, 7fb0h

jp1:		asm  loop uploop
		asm  pop  cx

uploop1:	asm  push cx
		asm  mov  di, bx
		asm  mov  si, dx
		asm  mov  cx, x_width
		asm  cld
		asm  REP movsb

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp2
		asm  sub  bx, 7fb0h

jp2:		asm  add  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp3
		asm  sub  dx, 7fb0h

jp3:		asm  pop  cx
		asm  loop uploop1

		asm  pop  ds
}

void     hsideup(int x, int y1, int y2, int lines, byte mask)
{
		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  push cx

		asm  mov  ax, y1
		asm  xor  bx, bx

		asm  shr  ax, 1		/* ax = y1 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y1 & 1) */
		asm  shr  ax, 1		/* ax = y1 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y1 & 3) */
		asm  shr  bx, 1		/* bx = 0x2000 * (y1 & 3) = 0x2000 * (y1 % 4) */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y1 / 4) */
		asm  add  bx, ax
		asm  add  bx, x		/* bx = 0x2000 * (y1 % 4) + x / 8 + 80 * (y1 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax
		asm  mov  dx, bx
		asm  mov  al, BYTE PTR mask

		asm  mov  cx, WORD PTR lines

uploop:		asm  add  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp1
		asm  sub  dx, 7fb0h

jp1:		asm  loop uploop
		asm  pop  cx

uploop1:	asm  mov  di, bx
		asm  mov  si, dx
		asm  mov  ah, ds:[si]
		asm  and  ah, al
		asm  not  al
		asm  and  es:[di], al
		asm  not  al
		asm  or   es:[di], ah

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp2
		asm  sub  bx, 7fb0h

jp2:		asm  add  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp3
		asm  sub  dx, 7fb0h

jp3:		asm  loop uploop1

		asm  pop  ds
}

void     hgc_scrup(int x1, int y1, int x2, int y2, int lines, char color)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;

	byte  lmask = 0xff >> (x1 & 7);
	byte  rmask = 0xff << (7 - (x2 & 7));

	if (xs <= xe) hscrup(xs, y1, xe, y2, lines);
	if (xs <= xe + 1) {
		hsideup(xs - 1, y1, y2, lines, lmask);
		hsideup(xe + 1, y1, y2, lines, rmask);
	}
	else hsideup(xs - 1, y1, y2, lines, lmask & rmask);
	hgc_boxfill(x1, y2 - lines + 1, x2, y2, color);
}

void     hscrdown(int x1, int y1, int x2, int y2, int lines)
{
	int   x_width = x2 - x1 + 1;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  push cx

		asm  mov  ax, y2
		asm  xor  bx, bx

		asm  shr  ax, 1		/* ax = y2 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y2 & 1) */
		asm  shr  ax, 1		/* ax = y2 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y2 & 3) */
		asm  shr  bx, 1		/* bx = 0x2000 * (y2 & 3) = 0x2000 * (y2 % 4) */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y2 / 4) */
		asm  add  bx, ax
		asm  add  bx, x1	/* bx = 0x2000 * (y2 % 4) + x1 / 8 + 80 * (y2 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x1, y2)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax
		asm  mov  dx, bx

		asm  mov  cx, WORD PTR lines

dnloop:		asm  sub  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp1
		asm  add  dx, 7fb0h

jp1:		asm  loop dnloop
		asm  pop  cx

dnloop1:	asm  push cx
		asm  mov  di, bx
		asm  mov  si, dx
		asm  mov  cx, x_width
		asm  cld
		asm  REP movsb

		asm  sub  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp2
		asm  add  bx, 7fb0h

jp2:		asm  sub  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp3
		asm  add  dx, 7fb0h

jp3:		asm  pop  cx
		asm  loop dnloop1

		asm  pop  ds
}

void     hsidedown(int x, int y1, int y2, int lines, byte mask)
{
		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  push cx

		asm  mov  ax, y2
		asm  xor  bx, bx

		asm  shr  ax, 1		/* ax = y2 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y2 & 1) */
		asm  shr  ax, 1		/* ax = y2 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y2 & 3) */
		asm  shr  bx, 1		/* bx = 0x2000 * (y2 & 3) = 0x2000 * (y2 % 4) */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y2 / 4) */
		asm  add  bx, ax
		asm  add  bx, x		/* bx = 0x2000 * (y2 % 4) + x / 8 + 80 * (y2 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y2)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax
		asm  mov  dx, bx
		asm  mov  al, BYTE PTR mask

		asm  mov  cx, WORD PTR lines

dnloop:		asm  sub  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp1
		asm  add  dx, 7fb0h

jp1:		asm  loop dnloop
		asm  pop  cx

dnloop1:	asm  mov  di, bx
		asm  mov  si, dx
		asm  mov  ah, ds:[si]
		asm  and  ah, al
		asm  not  al
		asm  and  es:[di], al
		asm  not  al
		asm  or   es:[di], ah

		asm  sub  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp2
		asm  add  bx, 7fb0h

jp2:		asm  sub  dx, 2000h
		asm  cmp  dx, 8000h
		asm  jb   jp3
		asm  add  dx, 7fb0h

jp3:		asm  loop dnloop1

		asm  pop  ds
}

void     hgc_scrdown(int x1, int y1, int x2, int y2, int lines, char color)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;

	byte  lmask = 0xff >> (x1 & 7);
	byte  rmask = 0xff << (7 - (x2 & 7));

	if (xs <= xe) hscrdown(xs, y1, xe, y2, lines);
	if (xs <= xe + 1) {
		hsidedown(xs - 1, y1, y2, lines, lmask);
		hsidedown(xe + 1, y1, y2, lines, rmask);
	}
	else hsidedown(xs - 1, y1, y2, lines, lmask & rmask);
	hgc_boxfill(x1, y1, x2, y1 + lines - 1, color);
}

void     hscrleft(int x1, int y1, int x2, int y2, int rows)
{
	int   x_width = x2 - x1 - rows + 1;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, y1
		asm  xor  bx, bx

		asm  shr  ax, 1		/* ax = y1 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y1 & 1) */
		asm  shr  ax, 1		/* ax = y1 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y1 & 3) */
		asm  shr  bx, 1		/* bx = 0x2000 * (y1 & 3) = 0x2000 * (y1 % 4) */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y1 / 4) */
		asm  add  bx, ax
		asm  add  bx, x1	/* bx = 0x2000 * (y1 % 4) + x1 / 8 + 80 * (y1 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

ltloop:		asm  push cx
		asm  mov  di, bx
		asm  mov  si, di
		asm  add  si, rows
		asm  mov  cx, x_width
		asm  cld
		asm  REP movsb

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp1
		asm  sub  bx, 7fb0h

jp1:		asm  pop  cx
		asm  loop ltloop

		asm  pop  ds
}

void     hgc_scrleft(int x1, int y1, int x2, int y2, int rows, char color)
{
	int   xs = x1 / 8;
	int   xe = x2 / 8;

	hscrleft(xs, y1, xe, y2, rows);
	hgc_boxfill(x2 - (rows * 8) + 1, y1, x2, y2, color);
}

void     hscrright(int x1, int y1, int x2, int y2, int rows)
{
	int   x_width = x2 - x1 - rows + 1;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, y1
		asm  xor  bx, bx

		asm  shr  ax, 1		/* ax = y1 / 2 */
		asm  rcr  bx, 1		/* bx = 0x8000 * (y1 & 1) */
		asm  shr  ax, 1		/* ax = y1 / 4 */
		asm  rcr  bx, 1		/* bx = 0x4000 * (y1 & 3) */
		asm  shr  bx, 1		/* bx = 0x2000 * (y1 & 3) = 0x2000 * (y1 % 4) */
		asm  mov  ah, 80
		asm  mul  ah		/* ax = 80 * (y1 / 4) */
		asm  add  bx, ax
		asm  add  bx, x2	/* bx = 0x2000 * (y1 % 4) + x2 / 8 + 80 * (y1 / 4)
					      = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x2, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

rtloop:		asm  push cx
		asm  mov  di, bx
		asm  mov  si, di
		asm  sub  si, rows
		asm  mov  cx, x_width
		asm  std
		asm  REP movsb

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp1
		asm  sub  bx, 7fb0h

jp1:		asm  pop  cx
		asm  loop rtloop

		asm  pop  ds
}

void     hgc_scrright(int x1, int y1, int x2, int y2, int rows, char color)
{
	int   xs = x1 / 8;
	int   xe = x2 / 8;

	hscrright(xs, y1, xe, y2, rows);
	hgc_boxfill(x1, y1, x1 + (rows * 8) - 1, y2, color);
}

void     vscrup(int x1, int y1, int x2, int y2, int lines)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 + 1;
	unsigned  y_width = xw * lines;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0105h	/* al = 5(GRCTRL Mode reg.)
					   ah = 1(reg. 5 value)
						bit 3 = 0(read mode 0)
						bits 0 - 1 = 1(write mode 1) */
		asm  out  dx, ax

uploop:		asm  push cx
		asm  mov  cx, x_width
		asm  mov  di, bx
		asm  mov  si, di
		asm  add  si, y_width
		asm  cld
		asm  REP  movsb
		asm  add  bx, xw
		asm  pop  cx
		asm  loop uploop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vsideup(int x, int y1, int y2, int lines, byte mask)
{
	int   xw = xbyte;
	unsigned  y_width = xw * lines;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRC) Í¡Ëa º­¡ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.)
					   ah = 0(reg. 5 value)
					    bit 3 = 0(read mode 0)
					    bits 0 - 1 = 0(write mode 0) */
		asm  out  dx, ax

		asm  mov  ax, 0000h	/* al = 0(GRCTRL Set/Reset reg.)
					   ah = color value of reg. 0 */
		asm  out  dx, ax

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.) */
		asm  mov  ah, BYTE PTR mask	/* ah = bit mask */
		asm  out  dx, ax

		asm  mov  di, bx
		asm  mov  si, di
		asm  add  si, y_width

		asm  sub  dx, 10

uploop1:	asm  push cx
		asm  mov  cx, 3
		asm  mov  bl, 8

uploop2:	asm  add  dx, 10
		asm  mov  al, 4		/* al = 4(GRCTRL Read Map Select reg.) */
		asm  mov  ah, cl
		asm  out  dx, ax

		asm  mov  bh, ds:[si]

		asm  sub  dx, 10	/* dx = ¯¡ÆÅ¬á(SEQPORT) Í¡Ëa º­¡ */
		asm  mov  al, 2		/* al = 2(SEQPORT Map Mask reg.) */
		asm  mov  ah, bl
		asm  out  dx, ax

		asm  mov  ch, es:[di]
		asm  mov  es:[di], bh
		asm  shr  bl, 1
		asm  mov  ch, 0
		asm  dec  cx
		asm  cmp  cx, -1
		asm  jne  uploop2

		asm  add  si, xw
		asm  add  di, xw

		asm  pop  cx
		asm  loop uploop1

		asm  mov  ax, 0f02h	/* ¯¡ÆÅ¬á Í¡Ëaˆt Á¡‹¡ÑÁ */
		asm  out  dx, ax
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  dx, 3ceh
		asm  mov  ax, 0ff04h	/* al = 4(GRCTRL Read Map Select reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_scrup(int x1, int y1, int x2, int y2, int lines, char color)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;

	byte  lmask = 0xff >> (x1 & 7);
	byte  rmask = 0xff << (7 - (x2 & 7));

	if (xs <= xe) vscrup(xs, y1, xe, y2, lines);
	if (xs <= xe + 1) {
		vsideup(xs - 1, y1, y2, lines, lmask);
		vsideup(xe + 1, y1, y2, lines, rmask);
	}
	else vsideup(xs - 1, y1, y2, lines, lmask & rmask);
	vga_boxfill(x1, y2 - lines + 1, x2, y2, color);
}

void     vscrdown(int x1, int y1, int x2, int y2, int lines)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 + 1;
	unsigned  y_width = xw * lines;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, WORD PTR y2
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y2 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y2)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax


					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0105h	/* al = 5(GRCTRL Mode reg.)
					   ah = 1(reg. 5 value)
						bit 3 = 0(read mode 0)
						bits 0 - 1 = 1(write mode 1) */
		asm  out  dx, ax

dnloop:		asm  push cx
		asm  mov  cx, x_width
		asm  mov  di, bx
		asm  mov  si, di
		asm  sub  si, y_width
		asm  cld
		asm  REP  movsb
		asm  sub  bx, xw
		asm  pop  cx
		asm  loop dnloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vsidedown(int x, int y1, int y2, int lines, byte mask)
{
	int   xw = xbyte;
	unsigned  y_width = xw * lines;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  sub  cx, lines
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, WORD PTR y2
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y2 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y2)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRC) Í¡Ëa º­¡ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.)
					   ah = 0(reg. 5 value)
					    bit 3 = 0(read mode 0)
					    bits 0 - 1 = 0(write mode 0) */
		asm  out  dx, ax

		asm  mov  ax, 0000h	/* al = 0(GRCTRL Set/Reset reg.)
					   ah = color value of reg. 0 */
		asm  out  dx, ax

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.) */
		asm  mov  ah, BYTE PTR mask	/* ah = bit mask */
		asm  out  dx, ax

		asm  mov  di, bx
		asm  mov  si, di
		asm  sub  si, y_width

		asm  sub  dx, 10

dnloop1:	asm  push cx
		asm  mov  cx, 3
		asm  mov  bl, 8

dnloop2:	asm  add  dx, 10
		asm  mov  al, 4		/* al = 4(GRCTRL Read Map Select reg.) */
		asm  mov  ah, cl
		asm  out  dx, ax

		asm  mov  bh, ds:[si]

		asm  sub  dx, 10	/* dx = ¯¡ÆÅ¬á(SEQPORT) Í¡Ëa º­¡ */
		asm  mov  al, 2		/* al = 2(SEQPORT Map Mask reg.) */
		asm  mov  ah, bl
		asm  out  dx, ax

		asm  mov  ch, es:[di]
		asm  mov  es:[di], bh
		asm  shr  bl, 1
		asm  mov  ch, 0
		asm  dec  cx
		asm  cmp  cx, -1
		asm  jne  dnloop2

		asm  sub  si, xw
		asm  sub  di, xw

		asm  pop  cx
		asm  loop dnloop1

		asm  mov  ax, 0f02h	/* ¯¡ÆÅ¬á Í¡Ëaˆt Á¡‹¡ÑÁ */
		asm  out  dx, ax
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  dx, 3ceh
		asm  mov  ax, 0ff04h	/* al = 4(GRCTRL Read Map Select reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_scrdown(int x1, int y1, int x2, int y2, int lines, char color)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;

	byte  lmask = 0xff >> (x1 & 7);
	byte  rmask = 0xff << (7 - (x2 & 7));

	if (xs <= xe) vscrdown(xs, y1, xe, y2, lines);
	if (xs <= xe + 1) {
		vsidedown(xs - 1, y1, y2, lines, lmask);
		vsidedown(xe + 1, y1, y2, lines, rmask);
	}
	else vsidedown(xs - 1, y1, y2, lines, lmask & rmask);
	vga_boxfill(x1, y1, x2, y1 + lines - 1, color);
}

void     vscrleft(int x1, int y1, int x2, int y2, int rows)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 - rows + 1;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0105h	/* al = 5(GRCTRL Mode reg.)
					   ah = 1(reg. 5 value)
						bit 3 = 0(read mode 0)
						bits 0 - 1 = 1(write mode 1) */
		asm  out  dx, ax

ltloop:		asm  push cx
		asm  mov  di, bx
		asm  mov  si, di
		asm  add  si, rows
		asm  mov  cx, x_width
		asm  cld
		asm  REP  movsb
		asm  add  bx, xw
		asm  pop  cx
		asm  loop ltloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_scrleft(int x1, int y1, int x2, int y2, int rows, char color)
{
	int   xs = x1 / 8;
	int   xe = x2 / 8;

	vscrleft(xs, y1, xe, y2, rows);
	vga_boxfill(x2 - (rows * 8) + 1, y1, x2, y2, color);
}

void     vscrright(int x1, int y1, int x2, int y2, int rows)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 - rows + 1;

		asm  push ds

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x2	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x2, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  ds, ax

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0105h	/* al = 5(GRCTRL Mode reg.)
					   ah = 1(reg. 5 value)
						bit 3 = 0(read mode 0)
						bits 0 - 1 = 1(write mode 1) */
		asm  out  dx, ax

rtloop:		asm  push cx
		asm  mov  di, bx
		asm  mov  si, di
		asm  sub  si, rows
		asm  mov  cx, x_width
		asm  std
		asm  REP  movsb
		asm  add  bx, xw
		asm  pop  cx
		asm  loop rtloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_scrright(int x1, int y1, int x2, int y2, int rows, char color)
{
	int   xs = x1 / 8;
	int   xe = x2 / 8;

	vscrright(xs, y1, xe, y2, rows);
	vga_boxfill(x1, y1, x1 + (rows * 8) - 1, y2, color);
}
