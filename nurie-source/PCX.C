/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : pcx.c  --  PCX ÑÁ·© ¡¡—I                      |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <alloc.h>
#include    <stdio.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "hgpcx.h"			/* PCX ÑÁ·©µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

int      PCXMonoColor = 15;

extern   int      xbyte;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nrePCXFileDisplay();		/* PCXÑÁ·© ¥¡‹¡ @Z */

void     hgEnablePCXFileDisplay(void (*p)(int x, int y, char *fname));
void     hgPCXFileDisplay(int x, int y, char *fname);

int      getpcxmodefpt(FILE *fpt);
int      hgGetPCXMode(char *fname);
void     getpcxhdrfpt(PCXHDR *p, FILE *fpt);
void     hgGetPCXHdr(PCXHDR *p, char *fname);

int      readpcxline(char *s, FILE *fpt, int bytes);

void     hwritepcxline(unsigned off, char *buff, int n, byte lmask, byte rmask);
void     hgc_pcxdisplay(int x, int y, char *fname);
void     mwritepcxline(unsigned off, char *buff, int n, char color);
void     mono_pcxdisplay(int x, int y, char *fname);
void     vwritepcxline(unsigned off, char *buff, int n, byte lmask, byte rmask);
void     vga_pcxdisplay(int x, int y, char *fname);

void     hgSetPCXMonoColor(char color);

void     hgPrtPCXDisplayXy(int x, int y, char *fname);
void     hgPrtPCXDisplayXyM(char *fname);

			/* function pointer */
void   (*pcxq)(int x, int y, char *fname);


void     nrePCXFileDisplay()
{
	int    flag;
	char   pfile[50] = { "*.PCX" };

	flag = hgGetFileName(" PCX ÑÁ·© ·¡Ÿq·e? ", pfile);
	if (!flag) return;

	hgPrtPCXDisplayXyM(pfile);
}

void     hgEnablePCXFileDisplay(void (*p)(int x, int y, char *fname))
{
	pcxq = p;
}

void     hgPCXFileDisplay(int x, int y, char *fname)
{
	(*pcxq)(x, y, fname);
}

int      getpcxmodefpt(FILE *fpt)
{
	PCXHDR  *p;

	p = (PCXHDR *)malloc(sizeof(PCXHDR));

	getpcxhdrfpt(p, fpt);

	if (p->Manufacturer != 0x0a) {
		free(p);
		return(NO_PCX);
	}
	if (p->HRes == 720 && p->VRes == 348) {
		free(p);
		return(PCX_HERCULES);
	}
	if (p->NPlanes == 4) {
		free(p);
		return(PCX_VGA16);
	}

	free(p);
	return(NO_PCX);
}

int      hgGetPCXMode(char *fname)
{
	FILE  *fpt;

	int   value;

	fpt = fopen(fname, "rb");
	value = getpcxmodefpt(fpt);
	fclose(fpt);

	return(value);
}

void     getpcxhdrfpt(PCXHDR *p, FILE *fpt)
{
	fseek(fpt, 0, 0);
	fread(p, 128, 1, fpt);
}

void     hgGetPCXHdr(PCXHDR *p, char *fname)
{
	FILE  *fpt;

	int   value;

	fpt = fopen(fname, "rb");
	getpcxhdrfpt(p, fpt);
	fclose(fpt);
}

int      readpcxline(char *s, FILE *fpt, int bytes)
{
	int   c, i;
	int   n = 0;

	do {
		c = (fgetc(fpt) & 0xff);
		if ((c & 0xc0) == 0xc0) {
			i = c & 0x3f;
			c = fgetc(fpt);
			while (i--) s[n++] = c;
		}
		else s[n++] = c;
	} while (n < bytes);

	return(n);
}

void     hwritepcxline(unsigned off, char *buff, int n, byte lmask, byte rmask)
{
		asm  push ds

		asm  mov  ax, 0b000h
		asm  mov  es, ax
		asm  mov  di, off	/* es:di = ¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, buff	/* ds:si = PCX ·¡£¡»¡ •A·¡Èa· º­¡ */

		asm  mov  ah, ds:[si]
		asm  and  ah, lmask
		asm  mov  es:[di], ah

		asm  mov  cx, n		/* cx = ¤e¥¢ ÒU® */
		asm  cld
		asm  REP  movsb

		asm  mov  ah, ds:[si]
		asm  and  ah, rmask
		asm  mov  es:[di], ah

		asm  pop  ds
}

void     hgc_pcxdisplay(int x, int y, char *fname)
{
	FILE    *fpt;
	PCXHDR  *p;

	char   *temp;
	int    i;
	int    n, bytes;
	byte   lmask, rmask;
	unsigned  offset;

	fpt = fopen(fname, "rb");
	if (fpt == NULL) return;

	if (getpcxmodefpt(fpt) != PCX_HERCULES) return;

	p = (PCXHDR *)malloc(sizeof(PCXHDR));
	getpcxhdrfpt(p, fpt);

	temp = (char *)malloc((size_t)p->BytesperLine);
	offset = 0x2000 * (y % 4) + x / 8;

	lmask = 0xff;
	rmask = 0xff;

	bytes = p->BytesperLine;
	fseek(fpt, 128, 0);		/* pass header */
	for (i = y;i < y + p->y2 - p->y1 + 1;i++) {
		n = readpcxline(temp, fpt, bytes);
		hwritepcxline(offset, temp, n - 2, lmask, rmask);
		offset += 0x2000;
		if (offset >= 0x8000) offset -= 0x7fb0;
		if (i >= hgGety2r()) break;
	}
	fclose(fpt);

	free(temp);
	free(p);
}

void     mwritepcxline(unsigned off, char *buff, int n, char color)
{
		asm  push ds

		asm  mov  ax, 0a000h
		asm  mov  es, ax
		asm  mov  di, off	/* es:di = ¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */

		asm  lds  si, buff	/* ds:si = PCX ·¡£¡»¡ •A·¡Èa· º­¡ */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 03ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0205h
		asm  out  dx, ax

		asm  mov  al, 8		/* al = 8(GRCTRL Bit Mask reg.)
					   ah = bit mask */
		asm  out  dx, al

		asm  inc  dx
		asm  mov  al, color

		asm  mov  cx, n		/* cx = ¤e¥¢ ÒU® */
		asm  cld

mloop1:		asm  mov  ah, ds:[si]
		asm  xchg al, ah
		asm  out  dx, al
		asm  xchg al, ah
		asm  mov  ah, es:[di]
		asm  stosb
		asm  inc  si
		asm  loop mloop1


					/* ‹aœÏ¢ Å¥Ëa©œáˆt Á¡‹¡ÑÁ */
		asm  dec  dx
		asm  mov  ax, 0ff08h	/* al = 8(GRCTRL Bit Mask reg.) */
		asm  out  dx, ax
		asm  mov  ax, 0005h
		asm  out  dx, ax

		asm  pop  ds
}

void     mono_pcxdisplay(int x, int y, char *fname)
{
	FILE    *fpt;
	PCXHDR  *p;

	char   *temp;
	int    i;
	int    n, bytes;
	int    xwidth = xbyte;
	unsigned  offset;

	fpt = fopen(fname, "rb");
	if (fpt == NULL) return;

	if (getpcxmodefpt(fpt) != PCX_HERCULES) return;

	p = (PCXHDR *)malloc(sizeof(PCXHDR));
	getpcxhdrfpt(p, fpt);

	temp = (char *)malloc((size_t)p->BytesperLine);
	offset = y * xwidth + x / 8;

	bytes = p->BytesperLine;
	fseek(fpt, 128, 0);		/* pass header */

	for (i = y;i < y + p->y2 - p->y1 + 1;i++) {
		n = readpcxline(temp, fpt, bytes);
		n--;
		mwritepcxline(offset, temp, n, PCXMonoColor);
		offset += xwidth;
	}
	fclose(fpt);

	free(temp);
	free(p);
}

void     vwritepcxline(unsigned off, char *buff, int n, byte lmask, byte rmask)
{
		asm  push ds

		asm  mov  ax, 0a000h
		asm  mov  es, ax
		asm  mov  di, off	/* es:di = ¹ÁÎa· Ï¢­I· §¡•Aµ¡ ¡A¡¡Ÿ¡ º­¡ */
		asm  mov  bx, di

		asm  lds  si, buff	/* ds;si = PCX ·¡£¡»¡ •A·¡Èa· º­¡ */

					/* ‹aœÏ¢ Å¥Ëa©œáˆt ¬é¸÷ */
		asm  mov  dx, 03ceh	/* dx = ‹aœÏ¢ Å¥Ëa©œá(GRCTRL) Í¡Ëa º­¡ */

		asm  mov  ax, 0005h
		asm  out  dx, ax

		asm  mov  dx, 03c4h
		asm  mov  al, 2
		asm  out  dx, al
		asm  inc  dx
		asm  mov  al, 1
		asm  cld

		asm  mov  cx, 4

vloop1:		asm  push cx

		asm  push ax
		asm  mov  al, 8
		asm  mov  ah, lmask
		asm  mov  dx, 03ceh
		asm  out  dx, ax
		asm  mov  al, es:[di]
		asm  movsb
		asm  mov  ax, 0ff08h
		asm  out  dx, ax
		asm  pop  ax

		asm  mov  cx, n		/* cx = ¤e¥¢ ÒU® */

vloop2:		asm  mov  ah, es:[di]
		asm  movsb
		asm  loop vloop2

		asm  push ax
		asm  mov  al, 8
		asm  mov  ah, rmask
		asm  out  dx, ax
		asm  mov  al, es:[di]
		asm  movsb
		asm  mov  dx, 03c5h
		asm  pop  ax

		asm  shl  al, 1
		asm  out  dx, al
		asm  mov  di, bx
		asm  pop  cx
		asm  loop vloop1

		asm  dec  dx
		asm  mov  ax, 0f02h
		asm  out  dx, ax

		asm  pop  ds
}

void     vga_pcxdisplay(int x, int y, char *fname)
{
	FILE    *fpt;
	PCXHDR  *p;

	char   *temp;
	int    i;
	int    n, bytes;
	int    xwidth = xbyte;
	byte   lmask, rmask;
	unsigned  offset;

	fpt = fopen(fname, "rb");
	if (fpt == NULL) return;

	if (getpcxmodefpt(fpt) != PCX_VGA16) return;

	p = (PCXHDR *)malloc(sizeof(PCXHDR));
	getpcxhdrfpt(p, fpt);

	offset = y * xwidth + x / 8;

	lmask = 0xff;
	rmask = 0xff;

	bytes = p->BytesperLine * 4;
	temp = (char *)malloc((size_t)bytes);

	for (i = y;i < y + p->y2 - p->y1 + 1;i++) {
		n = readpcxline(temp, fpt, bytes);
		n >>= 2;
		vwritepcxline(offset, temp, n - 2, lmask, rmask);
		offset += xwidth;
		if (i >= hgGety2r()) break;
	}
	fclose(fpt);

	free(temp);
	free(p);
}

void     hgSetPCXMonoColor(char color)
{
	PCXMonoColor = color;
}

void     hgPrtPCXDisplayXy(int x, int y, char *fname)
{
	PCXHDR  *p;

	int   x1, y1, x2, y2;

	if (access(fname, 0)) return;

	p = (PCXHDR *)malloc(sizeof(PCXHDR));

	hgGetPCXHdr(p, fname);

	x1 = x / 8 * 8;
	y1 = y;
	x2 = x + p->x2 - p->x1;
	y2 = y + p->y2 - p->y1;

	hgSetSaveOn();

	hgHideMouse();
	savearea(x1, y1, x2, y2);
	hgPCXFileDisplay(x1, y1, fname);
	hgShowMouse();

	inkey(WAIT);

	hgRestore();
	hgSetSaveOff();

	free(p);
}

void     hgPrtPCXDisplayXyM(char *fname)
{
	PCXHDR  *p;

	int   x1, y1, x2, y2;
	int   ret;

	if (access(fname, 0)) return;

	ret = hgGetPCXMode(fname);
	if (ret == NO_PCX) return;

	p = (PCXHDR *)malloc(sizeof(PCXHDR));

	hgGetPCXHdr(p, fname);

	x1 = p->x1 / 8 * 8;
	y1 = p->y1;
	x2 = p->x2;
	y2 = p->y2;
	x1 = (hgGetx2r() + hgGetx1r()) / 2 - (x2 - x1) / 2;
	y1 = (hgGety2r() + hgGety1r()) / 2 - (y2 - y1) / 2;
	x2 = x1 + p->x2 - p->x1;
	y2 = y1 + p->y2 - p->y1;

	hgSetSaveOn();

	hgHideMouse();
	savearea(x1, y1, x2, y2);
	hgPCXFileDisplay(x1, y1, fname);
	hgShowMouse();

	inkey(WAIT);

	hgRestore();
	hgSetSaveOff();

	free(p);
}
