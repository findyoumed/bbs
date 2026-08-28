/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : image.c  -- ·¡£¡»¡ ‰ÅŸ¡ ¡¡—I                  |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <alloc.h>
#include    <dos.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

int      maxpages = 4;

extern   int      xbyte;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgEnableImage(void (*g)(int x1, int y1, int x2, int y2, char *buff),
		       void (*p)(int x1, int y1, int x2, int y2, char *buff));
void     hgGetImage(int x1, int y1, int x2, int y2, char *buff);
void     hgPutImage(int x1, int y1, int x2, int y2, char *buff);

void     hgEnableImage4(void (*g)(int x1, int y1, int x2, int y2, CIMAGE **p),
			void (*p)(int x1, int y1, int x2, int y2, CIMAGE *p));
void     hgGetImage4(int x1, int y1, int x2, int y2, CIMAGE **p);
void     hgPutImage4(int x1, int y1, int x2, int y2, CIMAGE *p);

void     hgEnableImageVIRTUAL(void (*g)(int x1, int y1, int x2, int y2, VIMAGE **p),
			      void (*p)(int x1, int y1, int x2, int y2, VIMAGE *p));
void     hgGetImageVIRTUAL(int x1, int y1, int x2, int y2, VIMAGE **p);
void     hgPutImageVIRTUAL(int x1, int y1, int x2, int y2, VIMAGE *p);

void     hgEnableImgSize(unsigned (*i)(int x1, int y1, int x2, int y2));
unsigned hgImgSize(int x1, int y1, int x2, int y2);
void     hgEnableImgSize4(unsigned (*i)(int x1, int y1, int x2, int y2));
unsigned hgImgSize4(int x1, int y1, int x2, int y2);

void     hgetimage(int x1, int y1, int x2, int y2, char *buff);
void     hputimage(int x1, int y1, int x2, int y2, char *buff, byte mask);
void     hgc_getimage(int x1, int y1, int x2, int y2, char *buff);
void     hgc_putimage(int x1, int y1, int x2, int y2, char *buff);
void     hgc_getimage4(int x1, int y1, int x2, int y2, CIMAGE **p);
void     hgc_putimage4(int x1, int y1, int x2, int y2, CIMAGE *p);

void     vgetimage(int x1, int y1, int x2, int y2, char *buff);
void     vputimage(int x1, int y1, int x2, int y2, char *buff, byte mask);
void     vga_getimage(int x1, int y1, int x2, int y2, char *buff);
void     vga_putimage(int x1, int y1, int x2, int y2, char *buff);

void     vgetimageplane(int x1, int y1, int x2, int y2, char *buff, char plane);
void     vputimageplane(int x1, int y1, int x2, int y2, char *buff, char plane, byte mask);
void     vga_getimageplane(int x1, int y1, int x2, int y2, char *buff, char plane);
void     vga_putimageplane(int x1, int y1, int x2, int y2, char *buff, char plane);
void     vga_getimage4(int x1, int y1, int x2, int y2, CIMAGE **p);
void     vga_putimage4(int x1, int y1, int x2, int y2, CIMAGE *p);

void     hgc_getimagevirtual(int x1, int y1, int x2, int y2, VIMAGE **p);
void     hgc_putimagevirtual(int x1, int y1, int x2, int y2, VIMAGE *p);
void     vga_getimagevirtual(int x1, int y1, int x2, int y2, VIMAGE **p);
void     vga_putimagevirtual(int x1, int y1, int x2, int y2, VIMAGE *p);

unsigned hgc_imgsize(int x1, int y1, int x2, int y2);
unsigned vga_imgsize(int x1, int y1, int x2, int y2);
unsigned hgc_imgsize4(int x1, int y1, int x2, int y2);
unsigned vga_imgsize4(int x1, int y1, int x2, int y2);

void     hgSetMaxPages(int num);
int      hgGetMaxPages();
void     hgFreeCIMAGE(CIMAGE **p);
void     hgFreeVIMAGE(VIMAGE **p);

			/* function pointer */
void   (*getimg)(int x1, int y1, int x2, int y2, char *buff);
void   (*putimg)(int x1, int y1, int x2, int y2, char *buff);
void   (*getimg4)(int x1, int y1, int x2, int y2, CIMAGE **p);
void   (*putimg4)(int x1, int y1, int x2, int y2, CIMAGE *p);
void   (*vgetimg4)(int x1, int y1, int x2, int y2, VIMAGE **p);
void   (*vputimg4)(int x1, int y1, int x2, int y2, VIMAGE *p);
unsigned (*imgsize)(int x1, int y1, int x2, int y2);
unsigned (*imgsize4)(int x1, int y1, int x2, int y2);


void     hgEnableImage(void (*g)(int x1, int y1, int x2, int y2, char *buff),
		       void (*p)(int x1, int y1, int x2, int y2, char *buff))
{
	getimg = g;
	putimg = p;
}

void     hgGetImage(int x1, int y1, int x2, int y2, char *buff)
{
	(*getimg)(x1, y1, x2, y2, buff);
}

void     hgPutImage(int x1, int y1, int x2, int y2, char *buff)
{
	(*putimg)(x1, y1, x2, y2, buff);
}

void     hgEnableImage4(void (*g)(int x1, int y1, int x2, int y2, CIMAGE **p),
			void (*p)(int x1, int y1, int x2, int y2, CIMAGE *p))
{
	getimg4 = g;
	putimg4 = p;
}

void     hgGetImage4(int x1, int y1, int x2, int y2, CIMAGE **p)
{
	(*getimg4)(x1, y1, x2, y2, p);
}

void     hgPutImage4(int x1, int y1, int x2, int y2, CIMAGE *p)
{
	(*putimg4)(x1, y1, x2, y2, p);
}

void     hgEnableImageVIRTUAL(void (*g)(int x1, int y1, int x2, int y2, VIMAGE **p),
			      void (*p)(int x1, int y1, int x2, int y2, VIMAGE *p))
{
	vgetimg4 = g;
	vputimg4 = p;
}

void     hgGetImageVIRTUAL(int x1, int y1, int x2, int y2, VIMAGE **p)
{
	(*vgetimg4)(x1, y1, x2, y2, p);
}

void     hgPutImageVIRTUAL(int x1, int y1, int x2, int y2, VIMAGE *p)
{
	(*vputimg4)(x1, y1, x2, y2, p);
}

void     hgEnableImgSize(unsigned (*i)(int x1, int y1, int x2, int y2))
{
	imgsize = i;
}

unsigned hgImgSize(int x1, int y1, int x2, int y2)
{
	unsigned   size;

	size = (*imgsize)(x1, y1, x2, y2);
	return(size);
}

void     hgEnableImgSize4(unsigned (*i)(int x1, int y1, int x2, int y2))
{
	imgsize4 = i;
}

unsigned hgImgSize4(int x1, int y1, int x2, int y2)
{
	unsigned   size;

	size = (*imgsize4)(x1, y1, x2, y2);
	return(size);
}

void     hgetimage(int x1, int y1, int x2, int y2, char *buff)
{
	int   x_width = x2 - x1 + 1;

		asm  push ds

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
		asm  mov  ds, ax	/* ds:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  les  di, buff	/* es:di = ÑÁ¡e ¸á¸w¶w ¤áÌá· º­¡ */

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

getloop:	asm  push cx
		asm  mov  si, bx	/* ds:si = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  cx, x_width
		asm  cld
		asm  REP  movsb

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp1
		asm  sub  bx, 7fb0h

jp1:		asm  pop  cx
		asm  loop getloop

		asm  pop  ds
}

void     hputimage(int x1, int y1, int x2, int y2, char *buff, byte mask)
{
	int   x_width = x2 - x1 + 1;

		asm  push ds

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
		asm  lds  si, buff	/* ds:si = ÑÁ¡e ¸á¸w¶w ¤áÌá· º­¡ */

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

		asm  mov  ah, BYTE PTR mask

putloop1:	asm  push cx
		asm  mov  cx, x_width
		asm  mov  di, bx	/* es:di = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

putloop2:	asm  mov  al, ds:[si]
		asm  not  ah
		asm  and  es:[di], ah
		asm  not  ah
		asm  and  al, ah
		asm  or   es:[di], al
		asm  inc  si
		asm  inc  di
		asm  dec  cx
		asm  jnz  putloop2

		asm  add  bx, 2000h
		asm  cmp  bx, 8000h
		asm  jb   jp1
		asm  sub  bx, 7fb0h

jp1:		asm  pop  cx
		asm  loop putloop1

		asm  pop  ds
}

void     hgc_getimage(int x1, int y1, int x2, int y2, char *buff)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  offset = 2;

	buff[0] = 0xff >> (x1 & 7);
	buff[1] = 0xff << (7 - (x2 & 7));

	if (xs <= xe) {
		hgetimage(xs, y1, xe, y2, &buff[2]);
		offset += (y2 - y1 + 1) * (xe - xs + 1);
	}
	if (xs <= xe + 1) {
		hgetimage(xs - 1, y1, xs - 1, y2, &buff[offset]);
		offset += y2 - y1 + 1;
		hgetimage(xe + 1, y1, xe + 1, y2, &buff[offset]);
	}
	else hgetimage(xs - 1, y1, xs - 1, y2, &buff[offset]);
}

void     hgc_putimage(int x1, int y1, int x2, int y2, char *buff)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	byte  lmask, rmask;
	unsigned  offset = 2;

	lmask = buff[0];
	rmask = buff[1];

	if (xs <= xe) {
		hputimage(xs, y1, xe, y2, &buff[2], 0xff);
		offset += (y2 - y1 + 1) * (xe - xs + 1);
	}
	if (xs <= xe + 1) {
		hputimage(xs - 1, y1, xs - 1, y2, &buff[offset], lmask);
		offset += y2 - y1 + 1;
		hputimage(xe + 1, y1, xe + 1, y2, &buff[offset], rmask);
	}
	else hputimage(xs - 1, y1, xs - 1, y2, &buff[offset], lmask & rmask);
}

void     hgc_getimage4(int x1, int y1, int x2, int y2, CIMAGE **p)
{
	(*p) = (CIMAGE *)malloc(sizeof(CIMAGE));

	(*p)->buff[0] = (char *)malloc((size_t)hgImgSize4(x1, y1, x2, y2));
	hgc_getimage(x1, y1, x2, y2, (*p)->buff[0]);
}

void     hgc_putimage4(int x1, int y1, int x2, int y2, CIMAGE *p)
{
	hgc_putimage(x1, y1, x2, y2, p->buff[0]);
}

void     vgetimage(int x1, int y1, int x2, int y2, char *buff)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 + 1;

		asm  push ds

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  ds, ax	/* ds:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  les  di, buff	/* es:di = ÑÁ¡e ¸á¸w¶w ¤áÌá· º­¡ */

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

getloop1:	asm  push cx
		asm  mov  ah, 3

getloop2:	asm  mov  al, 4		/* al = 4(GRCTRL Read Map Select reg.) */
		asm  out  dx, ax

		asm  mov  si, bx	/* ds:si = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  cx, x_width
		asm  cld
		asm  REP  movsb
		asm  dec  ah
		asm  jns  getloop2

		asm  add  bx, xw
		asm  pop  cx
		asm  loop getloop1

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0ff04h	/* al = 4(GRCTRL Read Map Select reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vputimage(int x1, int y1, int x2, int y2, char *buff, byte mask)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 + 1;

		asm  push ds

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  lds  si, buff	/* ds:si = ÑÁ¡e ¸á¸w¶w ¤áÌá· º­¡ */

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRC) Í¡Ëa º­¡ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.)
					   ah = 0(reg. 5 value)
					    bit 3 = 0(read mode 0)
					    bits 0 - 1 = 0(write mode 0) */
		asm  out  dx, ax

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.) */
		asm  mov  ah, BYTE PTR mask	/* ah = bit mask */
		asm  out  dx, ax

		asm  sub  dx, 10	/* dx = ¯¡ÆÅ¬á(SEQPORT) Í¡Ëa º­¡ */

putloop1:	asm  push cx
		asm  mov  ah, 8

putloop2:	asm  mov  al, 2
		asm  out  dx, ax

		asm  mov  di, bx	/* es:di = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  cx, x_width
		asm  cld

putloop3:	asm  mov  al, es:[di]
		asm  movsb
		asm  loop putloop3

		asm  shr  ah, 1
		asm  jnc  putloop2

		asm  add  bx, xw
		asm  pop  cx
		asm  loop putloop1

		asm  mov  ax, 0f02h	/* ¯¡ÆÅ¬á Í¡Ëaˆt Á¡‹¡ÑÁ */
		asm  out  dx, ax
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  dx, 3ceh
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_getimage(int x1, int y1, int x2, int y2, char *buff)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  offset = 2;

	buff[0] = 0xff >> (x1 & 7);
	buff[1] = 0xff << (7 - (x2 & 7));

	if (xs <= xe) {
		vgetimage(xs, y1, xe, y2, &buff[2]);
		offset += (y2 - y1 + 1) * (xe - xs + 1) * 4;
	}
	if (xs <= xe + 1) {
		vgetimage(xs - 1, y1, xs - 1, y2, &buff[offset]);
		offset += (y2 - y1 + 1) * 4;
		vgetimage(xe + 1, y1, xe + 1, y2, &buff[offset]);
	}
	else vgetimage(xs - 1, y1, xs - 1, y2, &buff[offset]);
}

void     vga_putimage(int x1, int y1, int x2, int y2, char *buff)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	byte  lmask, rmask;
	unsigned  offset = 2;

	lmask = buff[0];
	rmask = buff[1];

	if (xs <= xe) {
		vputimage(xs, y1, xe, y2, &buff[2], 0xff);
		offset += (y2 - y1 + 1) * (xe - xs + 1) * 4;
	}
	if (xs <= xe + 1) {
		vputimage(xs - 1, y1, xs - 1, y2, &buff[offset], lmask);
		offset += (y2 - y1 + 1) * 4;
		vputimage(xe + 1, y1, xe + 1, y2, &buff[offset], rmask);
	}
	else vputimage(xs - 1, y1, xs - 1, y2, &buff[offset], lmask & rmask);
}

void     vgetimageplane(int x1, int y1, int x2, int y2, char *buff, char plane)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 + 1;

		asm  push ds

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  ds, ax	/* ds:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  les  di, buff	/* es:di = ÑÁ¡e ¸á¸w¶w ¤áÌá· º­¡ */

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */
		asm  mov  al, 4		/* al = 4(GRCTRL Read Map Select reg.) */
		asm  mov  ah, plane
		asm  out  dx, ax

getloop:	asm  push cx
		asm  mov  si, bx	/* ds:si = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  cx, x_width
		asm  cld
		asm  REP  movsb
		asm  add  bx, xw
		asm  pop  cx
		asm  loop getloop

					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  ax, 0ff04h	/* al = 4(GRCTRL Read Map Select reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vputimageplane(int x1, int y1, int x2, int y2, char *buff, char plane, byte mask)
{
	int   xw = xbyte;
	int   x_width = x2 - x1 + 1;

		asm  push ds

		asm  mov  ax, WORD PTR y1
		asm  mov  dx, xw
		asm  mul  dx		/* ax = y1 * 1 œa·¥”w ¤a·¡Ëa ® */
		asm  mov  bx, ax
		asm  add  bx, WORD PTR x1	/* bx = §¡•Aµ¡ ¡A¡¡Ÿ¡· ¤a·¡Ëa µ¡Ïa­U */

		asm  mov  ax, 0a000h
		asm  mov  es, ax	/* es:bx = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  lds  si, buff	/* ds:si = ÑÁ¡e ¸á¸w¶w ¤áÌá· º­¡ */

		asm  mov  cx, y2
		asm  sub  cx, y1
		asm  inc  cx		/* ¤e¥¢ ÒU® */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 3ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRC) Í¡Ëa º­¡ */
		asm  mov  ax, 0005h	/* al = 5(GRCTRL Mode reg.)
					   ah = 0(reg. 5 value)
					    bit 3 = 0(read mode 0)
					    bits 0 - 1 = 0(write mode 0) */
		asm  out  dx, ax

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.) */
		asm  mov  ah, BYTE PTR mask	/* ah = bit mask */
		asm  out  dx, ax

		asm  sub  dx, 10	/* dx = ¯¡ÆÅ¬á(SEQPORT) Í¡Ëa º­¡ */
		asm  mov  al, 2
		asm  mov  ah, plane
		asm  out  dx, ax

putloop1:	asm  push cx
		asm  mov  di, bx	/* es:di = (x1, y1)¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  cx, x_width
		asm  cld

putloop2:	asm  mov  al, es:[di]
		asm  movsb
		asm  loop putloop2

		asm  add  bx, xw
		asm  pop  cx
		asm  loop putloop1

		asm  mov  ax, 0f02h	/* ¯¡ÆÅ¬á Í¡Ëaˆt Á¡‹¡ÑÁ */
		asm  out  dx, ax
					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  mov  dx, 3ceh
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_getimageplane(int x1, int y1, int x2, int y2, char *buff, char plane)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  offset = 2;

	buff[0] = 0xff >> (x1 & 7);
	buff[1] = 0xff << (7 - (x2 & 7));

	if (xs <= xe) {
		vgetimageplane(xs, y1, xe, y2, &buff[2], plane);
		offset += (y2 - y1 + 1) * (xe - xs + 1);
	}
	if (xs <= xe + 1) {
		vgetimageplane(xs - 1, y1, xs - 1, y2, &buff[offset], plane);
		offset += y2 - y1 + 1;
		vgetimageplane(xe + 1, y1, xe + 1, y2, &buff[offset], plane);
	}
	else vgetimageplane(xs - 1, y1, xs - 1, y2, &buff[offset], plane);
}

void     vga_putimageplane(int x1, int y1, int x2, int y2, char *buff, char plane)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	byte  lmask, rmask;
	unsigned  offset = 2;

	lmask = buff[0];
	rmask = buff[1];

	if (xs <= xe) {
		vputimageplane(xs, y1, xe, y2, &buff[2], plane, 0xff);
		offset += (y2 - y1 + 1) * (xe - xs + 1);
	}
	if (xs <= xe + 1) {
		vputimageplane(xs - 1, y1, xs - 1, y2, &buff[offset], plane, lmask);
		offset += y2 - y1 + 1;
		vputimageplane(xe + 1, y1, xe + 1, y2, &buff[offset], plane, rmask);
	}
	else vputimageplane(xs - 1, y1, xs - 1, y2, &buff[offset], plane, lmask & rmask);
}

void     vga_getimage4(int x1, int y1, int x2, int y2, CIMAGE **p)
{
	int   i;

	(*p) = (CIMAGE *)malloc(sizeof(CIMAGE));

	for (i = 0;i < maxpages;i++) {
		(*p)->buff[i] = (char *)malloc((size_t)hgImgSize4(x1, y1, x2, y2));
		vga_getimageplane(x1, y1, x2, y2, (*p)->buff[i], i);
	}
}
void     vga_putimage4(int x1, int y1, int x2, int y2, CIMAGE *p)
{
	int   i, j = 1;

	for (i = 0;i < maxpages;i++) {
		vga_putimageplane(x1, y1, x2, y2, p->buff[i], j);
		j *= 2;
	}
}

void     hgc_getimagevirtual(int x1, int y1, int x2, int y2, VIMAGE **p)
{
	(*p) = (VIMAGE *)malloc(sizeof(VIMAGE));

	(*p)->buff[0] = (VMEM *)hgVMalloc((size_t)hgImgSize4(x1, y1, x2, y2));
	hgc_getimage(x1, y1, x2, y2, vgbuff);
	hgVSaveBuff((*p)->buff[0]);
}

void     hgc_putimagevirtual(int x1, int y1, int x2, int y2, VIMAGE *p)
{
	hgVSetBuff(p->buff[0]);
	hgc_putimage(x1, y1, x2, y2, vgbuff);
}

void     vga_getimagevirtual(int x1, int y1, int x2, int y2, VIMAGE **p)
{
	int   i;

	(*p) = (VIMAGE *)malloc(sizeof(VIMAGE));

	for (i = 0;i < maxpages;i++) {
		(*p)->buff[i] = (VMEM *)hgVMalloc((size_t)hgImgSize4(x1, y1, x2, y2));
		vga_getimageplane(x1, y1, x2, y2, vgbuff, i);
		hgVSaveBuff((*p)->buff[i]);
	}
}

void     vga_putimagevirtual(int x1, int y1, int x2, int y2, VIMAGE *p)
{
	int   i, j = 1;

	for (i = 0;i < maxpages;i++) {
		hgVSetBuff(p->buff[i]);
		vga_putimageplane(x1, y1, x2, y2, vgbuff, j);
		j *= 2;
	}
}

unsigned hgc_imgsize(int x1, int y1, int x2, int y2)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  size = 0;

	if (xs <= xe) size += (xe - xs + 1) * (y2 - y1 + 1);
	if (xs <= xe + 1) size += (y2 - y1 + 1) * 2;
	else size += y2 - y1 + 1;
	size += 2;			/* for two masks */
	return(size);
}

unsigned vga_imgsize(int x1, int y1, int x2, int y2)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  size = 0;

	if (xs <= xe) size += (xe - xs + 1) * (y2 - y1 + 1) * 4;
	if (xs <= xe + 1) size += (y2 - y1 + 1) * 2 * 4;
	else size += (y2 - y1 + 1) * 4;
	size += 2;			/* for two masks */
	return(size);
}

unsigned hgc_imgsize4(int x1, int y1, int x2, int y2)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  size = 0;

	if (xs <= xe) size += (xe - xs + 1) * (y2 - y1 + 1);
	if (xs <= xe + 1) size += (y2 - y1 + 1) * 2;
	else size += y2 - y1 + 1;
	size += 2;			/* for two masks */
	return(size);
}

unsigned vga_imgsize4(int x1, int y1, int x2, int y2)
{
	int   xs = x1 / 8 + 1;
	int   xe = x2 / 8 - 1;
	unsigned  size = 0;

	if (xs <= xe) size += (xe - xs + 1) * (y2 - y1 + 1);
	if (xs <= xe + 1) size += (y2 - y1 + 1) * 2;
	else size += y2 - y1 + 1;
	size += 2;			/* for two masks */
	return(size);
}

void     hgSetMaxPages(int num)
{
	maxpages = num;
}

int      hgGetMaxPages()
{
	return(maxpages);
}

void     hgFreeCIMAGE(CIMAGE **p)
{
	int  i;

	for (i = 0;i < maxpages;i++)
		free((*p)->buff[i]);
	free(*p);
}

void     hgFreeVIMAGE(VIMAGE **p)
{
	int  i;
	int  max;

	for (i = 0;i < maxpages;i++)
		hgVFree(&((*p)->buff[i]));
	free(*p);
}
