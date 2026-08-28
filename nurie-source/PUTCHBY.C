/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : putch.c  -- Ðe ¢…¸a Â‰b ¡¡—I                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <dos.h>

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     ZERO         0              /* 0 is BLACK */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

extern   int  xbyte;
			/* extern function */
extern   void (*magh)(int x, int y, char *font, char color);
extern   void (*mage)(int x, int y, char *font, char color);

			/* function pointer */
void   (*puth)(int x, int y, char *font, char color);
void   (*pute)(int x, int y, char *font, char color);
void   (*putm)(int x, int y, char *font, int m, int n, char color);
void   (*puthbyte)(int x, int y, char *font, char color);
void   (*putebyte)(int x, int y, char *font, char color);

void     hgSetHanOut(void (*hout)(int x, int y, char *font, char color))
{
	puth = hout;
	magh = hout;
}

void     hgSetEngOut(void (*eout)(int x, int y, char *font, char color))
{
	pute = eout;
	mage = eout;
}

void     hgSetMagOut(void (*mout)(int x, int y, char *font, int m, int n, char color))
{
	putm = mout;
}

void     hgSetHanByteOut(void (*hbout)(int x, int y, char *font, char color))
{
	puthbyte = hbout;
}

void     hgSetEngByteOut(void (*ebout)(int x, int y, char *font, char color))
{
	putebyte = ebout;
}

void     puthan(int x, int y, char *font, char color)
{
	(*puth)(x, y, font, color);
}

void     puteng(int x, int y, char *font, char color)
{
	(*pute)(x, y, font, color);
}

void     puthanbyte(int x, int y, char *font, char color)
{
	(*puthbyte)(x, y, font, color);
}

void     putengbyte(int x, int y, char *font, char color)
{
	(*putebyte)(x, y, font, color);
}

void     putmag(int x, int y, char *font, int m, int n, char color)
{
	(*putm)(x, y, font, m, n, color);
}

void     hgc_pute(int x, int y, char *font, char color)
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
		asm  mov  al, cl	/* al = x % 8 */
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax	/* bx <- ax */

eloop:		asm  push cx
		asm  mov  cl, al
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  mov  ch, al
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  enext2

		asm  not  al		/* Ó…¬‚ ¤aÈw· ˆñ·e¬‚ ‹i³¡ */
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di], ah
		asm  jmp  jp1

enext2:		asm  and  ah, al	/* ˆñ·e¬‚ ¤aÈw· Ó…¬‚ ‹i³¡ */
		asm  or   es:[di], ah

jp1:		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  enext3

		asm  not  al
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di + 1], ah
		asm  jmp  jp2

enext3:		asm  and  ah, al
		asm  or   es:[di + 1], ah

jp2:		asm  mov  ax, bx
		asm  inc  si
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   enext
		asm  sub  di, 7fb0h

enext:		asm  pop  cx
		asm  loop eloop

		asm  pop  ds
}

void     hgc_puteb(int x, int y, char *font, char color)
{
		asm  push ds

		asm  mov  ax, y
		asm  mov  bx, x
		asm  dec  ax
		asm  dec  bx
		asm  mov  dx, 140h
		asm  mul  dx
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */

eloop:		asm  mov  al, ds:[si]
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  enext2
		asm  not  al		/* Ó…¬‚ ¤aÈw· ˆñ·e¬‚ ‹i³¡ */
		asm  and  es:[di], al
		asm  jmp  jp1

enext2:		asm  or   es:[di], al	/* ˆñ·e¬‚ ¤aÈw· Ó…¬‚ ‹i³¡ */

jp1:		asm  inc  si
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   enext
		asm  sub  di, 7fb0h

enext:		asm  loop eloop

		asm  pop  ds
}

void     hgc_puth(int x, int y, char *font, char color)
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
		asm  mov  al, cl	/* al = x % 8 */
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax	/* bx <- ax */

hloop:		asm  push cx
		asm  mov  cl, al
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  mov  ch, al
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  hnext2

		asm  not  al		/* Ó…¬‚ ¤aÈw· ˆñ·e¬‚ ‹i³¡ */
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di], ah
		asm  jmp  jp1

hnext2:		asm  and  ah, al	/* ˆñ·e¬‚ ¤aÈw· Ó…¬‚ ‹i³¡ */
		asm  or   es:[di], ah

jp1:		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  hnext5

		asm  not  al
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di + 1], ah
		asm  jmp  jp2

hnext5:		asm  and  ah, al
		asm  or   es:[di + 1], ah

jp2:		asm  mov  ax, bx
		asm  inc  si
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  mov  ch, al
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  hnext3

		asm  not  al
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di + 1], ah
		asm  jmp  jp3

hnext3:		asm  and  ah, al
		asm  or   es:[di + 1], ah

jp3:		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  hnext4

		asm  not  al
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di + 2], ah
		asm  jmp  jp4

hnext4:		asm  and  ah, al
		asm  or   es:[di + 2], ah

jp4:		asm  mov  ax, bx
		asm  inc  si
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   hnext
		asm  sub  di, 7fb0h

hnext:		asm  pop  cx
		asm  dec  cx
		asm  cmp  cx, 0
		asm  je   final
		asm  jmp  hloop

final:		asm  pop  ds
}

void     hgc_puthb(int x, int y, char *font, char color)
{
		asm  push ds

		asm  mov  ax, y
		asm  mov  bx, x
		asm  dec  ax
		asm  dec  bx
		asm  mov  dx, 140h
		asm  mul  dx
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0b000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */

hloop:		asm  mov  ax, ds:[si]
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  hnext2
		asm  not  ax		/* Ó…¬‚ ¤aÈw· ˆñ·e¬‚ ‹i³¡ */
		asm  and  es:[di], ax
		asm  jmp  jp1

hnext2:		asm  or   es:[di], ax	/* ˆñ·e¬‚ ¤aÈw· Ó…¬‚ ‹i³¡ */

jp1:		asm  inc  si
		asm  inc  si
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   hnext
		asm  sub  di, 7fb0h

hnext:		asm  loop hloop

		asm  pop  ds
}

void     hgc_putmn(int x, int y, char *font, int m, int n, char color)
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
		asm  mov  al, cl	/* al = x % 8 */
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, WORD PTR n
		asm  mov  bx, ax	/* bx <- ax */

nloop:		asm  push cx
		asm  push di
		asm  mov  cx, WORD PTR m

mloop:		asm  push cx
		asm  mov  cl, al
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  mov  ch, al
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  mnext2

		asm  not  al		/* Ó…¬‚ ¤aÈw· ˆñ·e¬‚ ‹i³¡ */
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di], ah
		asm  jmp  jp1

mnext2:		asm  and  ah, al	/* ˆñ·e¬‚ ¤aÈw· Ó…¬‚ ‹i³¡ */
		asm  or   es:[di], ah

jp1:		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  cmp  BYTE PTR color, ZERO
		asm  jnz  mnext3

		asm  not  al
		asm  not  ah
		asm  or   ah, al
		asm  and  es:[di + 1], ah
		asm  jmp  jp2

mnext3:		asm  and  ah, al
		asm  or   es:[di + 1], ah

jp2:		asm  mov  ax, bx
		asm  inc  si
		asm  inc  di
		asm  pop  cx
		asm  loop mloop

		asm  pop  di
		asm  pop  cx
		asm  add  di, 2000h
		asm  cmp  di, 8000h
		asm  jb   mnext
		asm  sub  di, 7fb0h

mnext:		asm  loop nloop

		asm  pop  ds
}

void     vga_pute(int x, int y, char *font, char color)
{
	int  xwidth = xbyte;

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
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xwidth
		asm  mul  dx		/* ax = y * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  al, cl	/* al = x % 8 */
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax	/* bx <- ax */

eloop:		asm  push cx
		asm  mov  cl, al
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  and  ah, al
		asm  mov  ch, al

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
		asm  out  dx, ax

		asm  mov  ah, es:[di]
		asm  mov  es:[di], ah

		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  and  ah, al

		asm  mov  al, 8
		asm  out  dx, ax

		asm  mov  ah, es:[di + 1]
		asm  mov  es:[di + 1], ah

		asm  mov  ax, bx
		asm  inc  si
		asm  add  di, xwidth

		asm  pop  cx
		asm  loop eloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_puteb(int x, int y, char *font, char color)
{
	int  xwidth = xbyte;

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
		asm  mov  bx, x
		asm  dec  ax
		asm  dec  bx
		asm  push dx
		asm  mov  dx, xwidth
		asm  mul  dx
		asm  pop  dx
		asm  mov  cl, 4
		asm  shl  ax, cl
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
eloop:		asm  mov  ah, ds:[si]
		asm  out  dx, ax

		asm  mov  ah, es:[di]
		asm  mov  es:[di], ah
		asm  inc  si
		asm  add  di, xwidth
		asm  loop eloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_puth(int x, int y, char *font, char color)
{
	int  xwidth = xbyte;

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
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xwidth
		asm  mul  dx		/* ax = y * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  al, cl	/* al = x % 8 */
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */
		asm  mov  bx, ax	/* bx <- ax */

hloop:		asm  push cx
		asm  mov  cl, al
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  and  ah, al
		asm  mov  ch, al

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
		asm  out  dx, ax

		asm  mov  ah, es:[di]
		asm  mov  es:[di], ah

		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  and  ah, al

		asm  mov  al, 8
		asm  out  dx, ax

		asm  mov  ah, es:[di + 1]
		asm  mov  es:[di + 1], ah

		asm  mov  ax, bx
		asm  inc  si
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  and  ah, al
		asm  mov  ch, al

		asm  mov  al, 8
		asm  out  dx, ax

		asm  mov  ah, es:[di + 1]
		asm  mov  es:[di + 1], ah

		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  and  ah, al

		asm  mov  al, 8
		asm  out  dx, ax

		asm  mov  ah, es:[di + 2]
		asm  mov  es:[di + 2], ah

		asm  mov  ax, bx
		asm  inc  si
		asm  add  di, xwidth

		asm  pop  cx
		asm  loop hloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_puthb(int x, int y, char *font, char color)
{
	int  xwidth = xbyte;

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
		asm  mov  bx, x
		asm  dec  ax
		asm  dec  bx
		asm  push dx
		asm  mov  dx, xwidth
		asm  mul  dx
		asm  pop  dx
		asm  mov  cl, 4
		asm  shl  ax, cl
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, 16	/* cx = ¤e¥¢ÒU®(1¢…¸a”w 16º‰) */

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
hloop:		asm  mov  ah, ds:[si]
		asm  out  dx, ax

		asm  mov  ah, es:[di]
		asm  mov  es:[di], ah
		asm  inc  si
		asm  mov  ah, ds:[si]
		asm  out  dx, ax

		asm  mov  ah, es:[di + 1]
		asm  mov  es:[di + 1], ah
		asm  inc  si
		asm  add  di, xwidth
		asm  loop hloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_putmn(int x, int y, char *font, int m, int n, char color)
{
	int  xwidth = xbyte;

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
		asm  mov  bx, x

		asm  mov  cl, bl	/* cl = xˆt· Ða¶á ¤a·¡Ëa */
		asm  push dx
		asm  mov  dx, xwidth
		asm  mul  dx		/* ax = y * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  pop  dx
		asm  shr  bx, 1
		asm  shr  bx, 1
		asm  shr  bx, 1		/* bx = x / 8 */
		asm  add  bx, ax	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  and  cl, 7		/* cl = x & 7 = x % 8 */
		asm  mov  al, cl	/* al = x % 8 */
		asm  mov  ah, 0ffh	/* ah = 11111111b = unshifted bit mask */
		asm  shr  ah, cl	/* ah = §¡Ëa  a¯aÇa */

		asm  mov  di, bx	/* es:di = (x, y)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, font	/* ds:si = ¢…¸a ‹i©· º­¡ */

		asm  mov  cx, WORD PTR n
		asm  mov  bx, ax	/* bx <- ax */

nloop:		asm  push cx
		asm  push di
		asm  mov  cx, WORD PTR m

mloop:		asm  push cx
		asm  mov  cl, al
		asm  mov  al, ds:[si]
		asm  ror  al, cl
		asm  and  ah, al
		asm  mov  ch, al

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
		asm  out  dx, ax

		asm  mov  ah, es:[di]
		asm  mov  es:[di], ah

		asm  mov  ax, bx
		asm  mov  al, ch
		asm  not  ah
		asm  and  ah, al

		asm  mov  al, 8
		asm  out  dx, ax

		asm  mov  ah, es:[di + 1]
		asm  mov  es:[di + 1], ah

		asm  mov  ax, bx
		asm  inc  si
		asm  inc  di
		asm  pop  cx
		asm  loop mloop

		asm  pop  di
		asm  pop  cx
		asm  add  di, xwidth
		asm  loop nloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0001h	/* al = 1(GRCTRL Enable Set/Reset reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}
