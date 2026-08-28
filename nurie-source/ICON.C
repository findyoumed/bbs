/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : icon.c  -- ´a·¡Å¥ ¡¡—I                        |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "hgicon.h"			/* ´a·¡Å¥µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

			/* 256 colorµA¬á· 16 color ¸÷· */
char     c256[16] = {
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
};
			/* global buff for icon bar */
CIMAGE  *ibuff;

HICON   *mark;
HICON   *mend;
HICON   *markr;
HICON   *mendr;

int      mark_enable = hgFALSE;		/* ´a·¡Å¥ ˆa“w µa¦ */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgMarkInit();
void     hgMarkEnd();

void     dither_gray(HICON *p);

HICON   *hgHICON_Load(char *fname);
void     hgHICON_Free(HICON **p);
void     hgHICON_Draw(HICON *p, int x, int y);
HICON   *hgHICON_Set(void (*iconset)(HICON *p));

int      get_pos(HICON *p, int x, int y);
void     winclose_icon(HICON *p);
void     winclr_icon(HICON *p);
void     winend_icon(HICON *p);
void     winenr_icon(HICON *p);

void     putmark(int x, int y);
void     putmend(int x, int y);
void     putmark_R(int x, int y);
void     putmend_R(int x, int y);

void     hgMarkOn();
void     hgMarkOff();


void     hgMarkInit()
{
	mark = hgHICON_Set(WINCLOSE_ICON);
	mend = hgHICON_Set(WINEND_ICON);
	markr = hgHICON_Set(WINCLOSER_ICON);
	mendr = hgHICON_Set(WINENDR_ICON);

	hgMarkOn();
}

void     hgMarkEnd()
{
	hgHICON_Free(&mark);
	hgHICON_Free(&mend);
	hgHICON_Free(&markr);
	hgHICON_Free(&mendr);

	hgMarkOff();
}

void     dither_gray(HICON *p)
{
	char   paltable[16] = {
		  0,  4, 24, 29, 12, 17, 24, 42,
		 21, 25, 45, 50, 33, 38, 58, 63
	};
	char   high, low;
	char   temp;
	int    i;

	int    xs = p->size.xwidth * 4;
	int    ys = p->size.ywidth;
	int    size = xs * ys;

	for (i = 0;i < size;i++) {
		temp = p->buff[i];
		high = (temp & 0xf0) >> 4;
		low = (temp & 0x0f);
		if (paltable[high] > 31) high = WHITE;
		else high = ZERO;
		if (paltable[low] > 31) low = WHITE;
		else low = ZERO;
		p->buff[i] = (high << 4) + low;
	}
}

HICON   *hgHICON_Load(char *fname)
{
	HICON   *p;
	FILE    *fpt;

	char    hdr[40];
	int     xs, ys;
	int     size;

	fpt = fopen(fname, "rb");
	if (fpt == NULL) return(NULL);

	p = (HICON *)malloc(sizeof(HICON));

	fseek(fpt, 31, 0);		/* ÑA”á ÉB¯aËa 31 ¤a·¡Ëa */
	xs = getc(fpt);
	ys = getc(fpt);
	fseek(fpt, 0, 0);
	fread(hdr, 33, 1, fpt);

	size = xs * 4 * ys;
	p->buff = (char *)malloc((size_t)size);

	fread(p->buff, size, 1, fpt);
	fclose(fpt);

	p->size.xwidth = xs;
	p->size.ywidth = ys;

	if (hgIsHerc()) dither_gray(p);

	return(p);
}

void     hgHICON_Free(HICON **p)
{
	free((*p)->buff);
	free(*p);
}

void     hgHICON_Draw(HICON *p, int x, int y)
{
	int   i, j;
	int   pos;

	for (i = 0;i < p->size.ywidth;i++)
		for (j = 0;j < p->size.xwidth * 4;j++) {
			pos = get_pos(p, j, i);
			hgPlotXy(x + j * 2, y + i, c256[(p->buff[pos] & 0xf0) >> 4]);
			hgPlotXy(x + j * 2 + 1, y + i, c256[(p->buff[pos] & 0x0f)]);
		}
}

HICON   *hgHICON_Set(void (*iconset)(HICON *p))
{
	HICON   *p;

	p = (HICON *)malloc(sizeof(HICON));
	(*iconset)(p);

	if (hgIsHerc()) dither_gray(p);

	return(p);
}

int      get_pos(HICON *p, int x, int y)
{
	int   pos;

	pos = p->size.xwidth * y * 4 + x;
	return(pos);
}

void     winclose_icon(HICON *p)
{
	char   s1[] = {
		255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 240,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 116,  71, 119, 119,   0, 255, 119, 116,  68,  68,  71, 119,   0,
		255, 119,  68,  68,  68,  68, 119,   0, 255, 119,  68,  68,  68,  68, 119,   0,
		255, 116,  68,  68,  65,  20,  71,   0, 255, 116,  68,  68,  17,  17,  71,   0,
		255, 113,  68,  68,  17,  17,  23,   0, 255, 113,  68,  65,  17,  17,  23,   0,
		255, 119,  17,  17,  17,  17, 119,   0, 255, 119,  17,  17,  17,  17, 119,   0,
		255, 119, 113,  17,  17,  23, 119,   0, 255, 119, 119, 113,  23, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255,   0,   0,   0,   0,   0,   0,   0, 240,   0,   0,   0,   0,   0,   0,   0
	};

	p->size.xwidth = 2;
	p->size.ywidth = 20;

	p->buff = (char *)malloc((size_t)160);

	memcpy(p->buff, s1, 160);
};

void     winclr_icon(HICON *p)
{
	char   s1[] = {
		255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 240,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255, 119, 119, 119, 119, 119, 119,   0, 255, 119, 119, 119, 119, 119, 119,   0,
		255,   0,   0,   0,   0,   0,   0,   0, 240,   0,   0,   0,   0,   0,   0,   0
	};

	p->size.xwidth = 2;
	p->size.ywidth = 20;

	p->buff = (char *)malloc((size_t)160);

	memcpy(p->buff, s1, 160);
};

void     winend_icon(HICON *p)
{
	char   s1[] = {
		  0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  15,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 116,  71, 119, 119, 255,   0, 119, 116,  68,  68,  71, 119, 255,
		  0, 119,  68,  68,  68,  68, 119, 255,   0, 119,  68,  68,  68,  68, 119, 255,
		  0, 116,  68,  68,  65,  20,  71, 255,   0, 116,  68,  68,  17,  17,  71, 255,
		  0, 113,  68,  68,  17,  17,  23, 255,   0, 113,  68,  65,  17,  17,  23, 255,
		  0, 119,  17,  17,  17,  17, 119, 255,   0, 119,  17,  17,  17,  17, 119, 255,
		  0, 119, 113,  17,  17,  17, 119, 255,   0, 119, 119, 113,  23, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 255, 255, 255, 255, 255, 255, 255,  15, 255, 255, 255, 255, 255, 255, 255
	};

	p->size.xwidth = 2;
	p->size.ywidth = 20;

	p->buff = (char *)malloc((size_t)160);

	memcpy(p->buff, s1, 160);
};

void     winenr_icon(HICON *p)
{
	char   s1[] = {
		  0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,  15,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 119, 119, 119, 119, 119, 119, 255,   0, 119, 119, 119, 119, 119, 119, 255,
		  0, 255, 255, 255, 255, 255, 255, 255,  15, 255, 255, 255, 255, 255, 255, 255
	};

	p->size.xwidth = 2;
	p->size.ywidth = 20;

	p->buff = (char *)malloc((size_t)160);

	memcpy(p->buff, s1, 160);
};

void     putmark(int x, int y)
{
	if (!mark_enable) return;

	hgHICON_Draw(mark, x, y);
}

void     putmend(int x, int y)
{
	if (!mark_enable) return;

	hgHICON_Draw(mend, x, y);
}

void     putmark_R(int x, int y)
{
	if (!mark_enable) return;

	hgHICON_Draw(markr, x, y);
}

void     putmend_R(int x, int y)
{
	if (!mark_enable) return;

	hgHICON_Draw(mendr, x, y);
}

void     hgMarkOn()
{
	mark_enable = hgTRUE;
}

void     hgMarkOff()
{
	mark_enable = hgFALSE;
}
