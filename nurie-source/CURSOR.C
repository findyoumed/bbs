/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : cursor.c  -- Äá¬á ¡¡—I                        |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <dos.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     invisible;			/* Äá¬á· ·A¢ µa¦ */
long     cursor_rate;			/* Äá¬á· Œq¤b·± */
int      curtype;

long     timedelay;			/* for check time */

extern   int      xbyte;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgEnableCursor(void (*h)(int x, int y), void (*e)(int x, int y));
void     hgHanCursor(int x, int y);
void     hgEngCursor(int x, int y);
int      hgCursor(int x, int y, int mode);
int      hgCursor2(int x, int y, int mode);

void     hgSetCursorType(int mode);
int      hgGetCursorType();
void     hgSetCursorRate(long rate);
void     settimerzero();
long     gettimerticks();

void     hgc_cure(int x, int y);
void     hgc_curh(int x, int y);
void     vga_cure(int x, int y);
void     vga_curh(int x, int y);

void     curs_internal();
extern   void     in_null();
void     hgSetCursInternal(void (*func)());
void     hgResetCursInternal();

			/* function pointer */
void   (*curh)(int x, int y);
void   (*cure)(int x, int y);

void   (*curs_inter)() = &in_null;


void     hgEnableCursor(void (*h)(int x, int y), void (*e)(int x, int y))
{
	curh = h;
	cure = e;
}

void     hgHanCursor(int x, int y)
{
	(*curh)(x, y);
}

void     hgEngCursor(int x, int y)
{
	(*cure)(x, y);
}

int      hgCursor(int x, int y, int mode)
{
	int    reversemode;
	int    key;
	long   saveticks;

	if (!invisible) {
		if (!mode) hgEngCursor(x, y);
		else hgHanCursor(x, y);
	}
	settimerzero();
	reversemode = 1;

	do {
		saveticks = gettimerticks();
		if (saveticks > cursor_rate && cursor_rate != 0) {
			reversemode = 1 - reversemode;
			if (!invisible) {
				if (!mode) hgEngCursor(x, y);
				else hgHanCursor(x, y);
			}
			settimerzero();
		}

		key = winkey();
		if (key == MOUSE_LEFT || key == MOUSE_RIGHT) key = NOKEY;
		curs_internal();
	} while (key == NOKEY);

	if (reversemode) {
		if (!invisible) {
			if (!mode) hgEngCursor(x, y);
			else hgHanCursor(x, y);
		}
	}

	return(key);
}

int      hgCursor2(int x, int y, int mode)
{
	int    reversemode;
	int    key;
	long   saveticks;

	if (!invisible) {
		if (!mode) hgEngCursor(x, y);
		else hgHanCursor(x, y);
	}
	settimerzero();
	reversemode = 1;

	do {
		saveticks = gettimerticks();
		if (saveticks > cursor_rate && cursor_rate != 0) {
			reversemode = 1 - reversemode;
			if (!invisible) {
				if (!mode) hgEngCursor(x, y);
				else hgHanCursor(x, y);
			}
			settimerzero();
		}

		key = winkey();
		if (key == MOUSE_LEFT || key == MOUSE_RIGHT) key = NOKEY;
		curs_internal();

		if (comIsDataReady()) break;
	} while (key == NOKEY);

	if (reversemode) {
		if (!invisible) {
			if (!mode) hgEngCursor(x, y);
			else hgHanCursor(x, y);
		}
	}

	return(key);
}

void     hgSetCursorType(int mode)
{
	switch (mode) {
		case 0 :
			invisible = hgTRUE;
			curtype = 0;
			break;
		case 1 :
		case 3 :
			invisible = hgFALSE;
			hgSetCursorRate(DEFAULTBLINK);
			curtype = 1;
			break;
		case 2 :
		case 4 :
			invisible = hgFALSE;
			hgSetCursorRate(NOBLINK);
			curtype = 2;
			break;
		default :
			break;
	}
}

int      hgGetCursorType()
{
	return(curtype);
}

void     hgSetCursorRate(long rate)
{
	cursor_rate = rate;
}

void     settimerzero()
{
	union  REGS  r;

	r.h.ah = 0;
	int86(0x1a, &r, &r);
	timedelay = (unsigned long)r.x.cx * 65536 + (long)r.x.dx;
}

long     gettimerticks()
{
	union  REGS  r;
	long   diff;

	r.h.ah = 0;
	int86(0x1a, &r, &r);
	diff = (unsigned long)r.x.cx * 65536 + (long)r.x.dx - timedelay;
	return(diff);
}

void     hgc_cure(int x, int y)
{
		asm  push ds

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
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  xor  al, al	/* al = 00000000b = unshifted bit mask */
		asm  shr  ax, cl	/* ax = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax

eloop:		asm  xor  es:[di], bh
		asm  xor  es:[di + 1], bl
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   enext
		asm  sub  di, 7fb0h

enext:		asm  loop eloop

		asm  pop  ds
}

void     hgc_curh(int x, int y)
{
		asm  push ds

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
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  xor  al, al	/* al = 00000000b = unshifted bit mask */
		asm  shr  ax, cl	/* ax = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax

hloop:		asm  xor  es:[di], bh
		asm  xor  BYTE PTR es:[di + 1], 0ffh
		asm  xor  es:[di + 2], bl
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   hnext
		asm  sub  di, 7fb0h

hnext:		asm  loop hloop

		asm  pop  ds
}

void     vga_cure(int x, int y)
{
	int   xw = xbyte;

		asm  push ds

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0805h	/* al = 5(GRCTRL Mode reg.)
					   ah = 8(reg. 5 value)
						bit 3 = 1(read mode 1)
						bits 0 - 1 = 0(write mode 0) */
		asm  out  dx, ax

		asm  mov  al, 3		/* al = 3(GRCTRL Data Rotate/Function Select reg.) */
		asm  mov  ah, 24	/* ah = 24(reg. 3 value): bits 3 = 1, 4 = 1(xor) */
		asm  out  dx, ax

		asm  mov  ax, 7		/* al = 7(GRCTRL Color Don't Care reg.)
					   ah = 0(reg. 7 value)
						don't care for all maps
						CPU reads always return 0ffh */
		asm  out  dx, ax

		asm  mov  dx, 3c4h	/* dx = ¯¡ÆÅ¬á(SEQPORT) Í¡Ëa º­¡ */
		asm  mov  ax, 0802h	/* al = 2(SEQPORT Map Mask reg.)
					   ah = 1000b(reg. 2 value) */
		asm  push ax

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
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  xor  al, al	/* al = 00000000b = unshifted bit mask */
		asm  shr  ax, cl	/* ax = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax

		asm  pop  ax

enext:		asm  out  dx, ax
		asm  push di
		asm  push cx

eloop:		asm  and  es:[di], bh
		asm  and  es:[di + 1], bl
		asm  add  di, xw
		asm  loop eloop

		asm  pop  cx
		asm  pop  di
		asm  shr  ah, 1		/* ah = next Map Mask value */
		asm  jnz  enext		/* loop across all bit planes */

		asm  mov  ax, 0f02h	/* ¯¡ÆÅ¬á Í¡Ëaˆt Á¡‹¡ÑÁ */
		asm  out  dx, ax
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */
		asm  mov  ax, 5		/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax

		asm  mov  ax, 3		/* al = 3(GRCTRL Data Rotate/Function Select reg.) */
		asm  out  dx, ax

		asm  mov  ax, 0f07h	/* al = 7(GRCTRL Color Don't Care reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_curh(int x, int y)
{
	int   xw = xbyte;

		asm  push ds

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0805h	/* al = 5(GRCTRL Mode reg.)
					   ah = 8(reg. 5 value)
						bit 3 = 1(read mode 1)
						bits 0 - 1 = 0(write mode 0) */
		asm  out  dx, ax

		asm  mov  al, 3		/* al = 3(GRCTRL Data Rotate/Function Select reg.) */
		asm  mov  ah, 24	/* ah = 24(reg. 3 value): bits 3 = 1, 4 = 1(xor) */
		asm  out  dx, ax

		asm  mov  ax, 7		/* al = 7(GRCTRL Color Don't Care reg.)
					   ah = 0(reg. 7 value)
						don't care for all maps
						CPU reads always return 0ffh */
		asm  out  dx, ax

		asm  mov  dx, 3c4h	/* dx = ¯¡ÆÅ¬á(SEQPORT) Í¡Ëa º­¡ */
		asm  mov  ax, 0802h	/* al = 2(SEQPORT Map Mask reg.)
					   ah = 1000b(reg. 2 value) */
		asm  push ax

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
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  xor  al, al	/* al = 00000000b = unshifted bit mask */
		asm  shr  ax, cl	/* ax = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax

		asm  pop  ax

hnext:		asm  out  dx, ax
		asm  push di
		asm  push cx

hloop:		asm  and  es:[di], bh
		asm  and  BYTE PTR es:[di + 1], 0ffh
		asm  and  es:[di + 2], bl
		asm  add  di, xw
		asm  loop hloop

		asm  pop  cx
		asm  pop  di
		asm  shr  ah, 1		/* ah = next Map Mask value */
		asm  jnz  hnext		/* loop across all bit planes */

		asm  mov  ax, 0f02h	/* ¯¡ÆÅ¬á Í¡Ëaˆt Á¡‹¡ÑÁ */
		asm  out  dx, ax
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */
		asm  mov  ax, 5		/* al = 5(GRCTRL Mode reg.) */
		asm  out  dx, ax

		asm  mov  ax, 3		/* al = 3(GRCTRL Data Rotate/Function Select reg.) */
		asm  out  dx, ax

		asm  mov  ax, 0f07h	/* al = 7(GRCTRL Color Don't Care reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     curs_internal()
{
	(*curs_inter)();
}

void     hgSetCursInternal(void (*func)())
{
	curs_inter = func;
}

void     hgResetCursInternal()
{
	curs_inter = &in_null;
}
