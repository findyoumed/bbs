/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : window.c  -- ¶å•¡¶ ¡¡—I                      |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

			/* ¤b¯a ¯aÈa·© */
int      dft_bstyle[MAXSTYLE][4] = {
	{ WHITE, ZERO, ZERO, 1 },		/* INSIDE */
	{ LIGHTGRAY, ZERO, ZERO, 1 },		/* INSIDE2 */
	{ LIGHTGRAY, WHITE, DARKGRAY, 1 },	/* BOXNORMAL */
	{ LIGHTGRAY, DARKGRAY, WHITE, 1 },	/* BOXREVERSE */
	{ BLUE, WHITE, DARKGRAY, 1 },		/* BLUEBOX */
	{ LIGHTGRAY, WHITE, DARKGRAY, 2 },	/* BARNORMAL */
	{ LIGHTGRAY, ZERO, WHITE, 2 },		/* BARREVERSE */
	{ LIGHTGRAY, LIGHTGRAY, LIGHTGRAY, 1 }	/* ERASER */
};
int      dspos = 7;			/* ¤b¯a ¯aÈa·© ® */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgDrawBorder(int x1, int y1, int x2, int y2, int sty[4], int fill);

void     hgBSTYLE_Load(BSTYLE *p, int back, int color1, int color2, int deep);
void     hgWCOLOR_Load(WCOLOR *p, int border, int tfore, int tback, int back);
void     hgBCOLOR_Load(BCOLOR *p, int border, int back);
void     hgWIDTH_Load(WIDTH *p, int xwidth, int ywidth);

HBOX    *hgHBOX_Load(char *i[MAXITEM], WCOLOR c, WIDTH w);
void     hgHBOX_Free(HBOX **p);
void     hgHBOX_Draw(HBOX *p, int x, int y);
void     hgHBOX_Save(HBOX *p, int x, int y);
void     hgHBOX_Restore(HBOX *p, int x, int y);

HBAR    *hgHBAR_Load(BCOLOR c, WIDTH w);
void     hgHBAR_Free(HBAR **p);
void     hgHBAR_Draw(HBAR *p, int x, int y, int draw);

HBUTTON *hgHBUTTON_Load(char *i, WCOLOR c, WIDTH s);
void     hgHBUTTON_Free(HBUTTON **p);
void     hgHBUTTON_Draw(HBUTTON *p, int x, int y, int push);

HWINDOW *hgHWINDOW_Load(char *t, WCOLOR c, WIDTH s);
void     hgHWINDOW_Free(HWINDOW **p);
void     hgHWINDOW_Draw(HWINDOW *p, int x, int y);

HSCRLBAR *hgHSCRLBAR_Load(int total, int screen, char direc, WIDTH w);
void     hgHSCRLBAR_Free(HSCRLBAR **p);
void     hgHSCRLBAR_Draw(HSCRLBAR *p, int x, int y);
void     hgHSCRLBAR_Update(HSCRLBAR *p, int x, int y);
void     hgHSCRLBAR_Choose(HSCRLBAR *p, int x, int y);
int      hgHSCRLBAR_Area(HSCRLBAR *p, int x, int y);


void     hgDrawBorder(int x1, int y1, int x2, int y2, int sty[4], int fill)
{
	int   i;

	if (fill == FILL) hgBoxFill(x1, y1, x2, y2, sty[0]);

	for (i = 0;i < sty[3];i++) {
		hgHline(x1, x2, y1, sty[1]);
		hgVline(x1, y1, y2, sty[1]);
		hgVline(x2, y1, y2, sty[2]);
		hgHline(x1, x2, y2, sty[2]);

		x1++;
		y1++;
		x2--;
		y2--;
	}
}

void     hgBSTYLE_Load(BSTYLE *p, int back, int color1, int color2, int deep)
{
	p->back = back;
	p->color1 = color1;
	p->color2 = color2;
	p->deep = deep;
}

void     hgWCOLOR_Load(WCOLOR *p, int border, int tfore, int tback, int back)
{
	p->border = border;
	p->tfore = tfore;
	p->tback = tback;
	p->back = back;
}

void     hgBCOLOR_Load(BCOLOR *p, int border, int back)
{
	p->border = border;
	p->back = back;
}

void     hgWIDTH_Load(WIDTH *p, int xwidth, int ywidth)
{
	p->xwidth = xwidth;
	p->ywidth = ywidth;
}

HBOX    *hgHBOX_Load(char *i[MAXITEM], WCOLOR c, WIDTH w)
{
	HBOX  *p;
	int    pos = 0;

	p = (HBOX *)malloc(sizeof(HBOX));

	while (strcmp(i[pos], "")) {
		p->items[pos] = (char *)malloc((size_t)(strlen(i[pos]) + 2));
		strcpy(p->items[pos], i[pos]);
		pos++;
	}
	p->items[pos] = (char *)malloc((size_t)3);
	strcpy(p->items[pos], "");

	p->color = c;
	p->size = w;

	return(p);
}

void     hgHBOX_Free(HBOX **p)
{
	int   pos = 0;

	while (strcmp((*p)->items[pos], ""))
		free((*p)->items[pos++]);
	if ((*p)->items[pos]) free((*p)->items[pos]);
	free(*p);
}

void     hgHBOX_Draw(HBOX *p, int x, int y)
{
	int   bd;
	int   xs, ys;
	int   i, pos = 0;

	bd = p->color.border;
	xs = p->size.xwidth;
	ys = p->size.ywidth;

	hgHideMouse();

	hgDrawBorder(x, y, x + xs, y + ys, dft_bstyle[bd], FILL);
	for (i = y + 4;;i += (20 * hgGetYFactor()))  {
		hgOutTextXy(x + 6, i, p->items[pos++]);
		if (!strcmp(p->items[pos], "")) break;
	}

	hgShowMouse();
}

void     hgHBOX_Save(HBOX *p, int x, int y)
{
	int   xs, ys;

	xs = p->size.xwidth;
	ys = p->size.ywidth;

	hgGetImageVIRTUAL(x, y, x + xs, y + ys, &p->buff);
}

void     hgHBOX_Restore(HBOX *p, int x, int y)
{
	int   xs, ys;

	xs = p->size.xwidth;
	ys = p->size.ywidth;

	hgPutImageVIRTUAL(x, y, x + xs, y + ys, p->buff);
	hgFreeVIMAGE(&p->buff);
}

HBAR    *hgHBAR_Load(BCOLOR c, WIDTH w)
{
	HBAR  *p;

	p = (HBAR *)malloc(sizeof(HBAR));

	p->color = c;
	p->size = w;

	return(p);
}

void     hgHBAR_Free(HBAR **p)
{
	free(*p);
}

void     hgHBAR_Draw(HBAR *p, int x, int y, int draw)
{
	int   bd;
	int   xs, ys;

	bd = p->color.border;
	xs = p->size.xwidth;
	ys = p->size.ywidth;

	hgHideMouse();

	if (draw == DRAW) {
		hgGetImage4(x, y, x + xs, y + ys, &(p->buff));
		hgDrawBorder(x, y, x + xs, y + ys, dft_bstyle[bd], NOFILL);
	}
	else {
		hgPutImage4(x, y, x + xs, y + ys, p->buff);
		hgFreeCIMAGE(&(p->buff));
	}

	hgShowMouse();
}

HBUTTON *hgHBUTTON_Load(char *i, WCOLOR c, WIDTH s)
{
	HBUTTON  *p;

	p = (HBUTTON *)malloc(sizeof(HBUTTON));

	p->item = (char *)malloc((size_t)(strlen(i) + 2));
	strcpy(p->item, i);

	p->color = c;
	p->size = s;

	return(p);
}

void     hgHBUTTON_Free(HBUTTON **p)
{
	free((*p)->item);
	free(*p);
}

void     hgHBUTTON_Draw(HBUTTON *p, int x, int y, int push)
{
	int   bd, bk;
	int   xs, ys;
	int   xoffset;

	bd = p->color.border;
	bk = p->color.back;
	xs = p->size.xwidth;
	ys = p->size.ywidth;

	hgHideMouse();

	if (push == NOPUSH)
		hgDrawBorder(x, y, x + xs, y + ys, dft_bstyle[bd], FILL);
	else hgDrawBorder(x, y, x + xs, y + ys, dft_bstyle[bk], FILL);

	xoffset = x + xs / 2 - strlen(p->item) * (1 << (hgGetXFactor() - 1)) * 4;
	hgOutTextXy(xoffset, y + 3, p->item);

	hgShowMouse();
}

HWINDOW *hgHWINDOW_Load(char *t, WCOLOR c, WIDTH s)
{
	HWINDOW  *p;

	p = (HWINDOW *)malloc(sizeof(HWINDOW));

	p->titl = (char *)malloc((size_t)(strlen(t) + 2));
	strcpy(p->titl, t);

	p->color = c;
	p->size = s;

	return(p);
}

void     hgHWINDOW_Free(HWINDOW **p)
{
	free((*p)->titl);
	free(*p);
}

void     hgHWINDOW_Draw(HWINDOW *p, int x, int y)
{
	int   bd, wback;
	int   temp, temp1, temp2, temp3, temp4;
	int   xs, ys;
	int   xoffset;

	bd = p->color.border;
	wback = p->color.back;
	xs = p->size.xwidth - 1;
	ys = p->size.ywidth - 1;

	temp = dft_bstyle[4][0];
	dft_bstyle[4][0] = p->color.tback;

	hgHideMouse();

	hgBoxFill(x, y, x + xs, y + 32, dft_bstyle[bd][0]);
	hgBoxFill(x, y + ys - 12, x + xs, y + ys, dft_bstyle[bd][0]);
	hgBoxFill(x, y + 32, x + 12, y + ys - 12, dft_bstyle[bd][0]);
	hgBoxFill(x + xs - 12, y + 32, x + xs, y + ys - 12, dft_bstyle[bd][0]);

	hgDrawBorder(x, y, x + xs, y + ys, dft_bstyle[bd], NOFILL);

	temp1 = dft_bstyle[3][1];
	temp2 = dft_bstyle[3][2];
	dft_bstyle[3][1] = dft_bstyle[bd][2];
	dft_bstyle[3][2] = dft_bstyle[bd][1];
	hgDrawBorder(x + 8, y + 8, x + xs - 8, y + ys - 8, dft_bstyle[3], NOFILL);

	hgDrawBorder(x + 8, y + 8, x + 8 + 16, y + 8 + 20, dft_bstyle[bd], FILL);
	hgDrawBorder(x + xs - 8 - 16, y + 8, x + xs - 8, y + 8 + 20, dft_bstyle[bd], FILL);
	hgDrawBorder(x + 8 + 4, y + 8 + 20 + 4, x + xs - 8 - 4, y + ys - 8 - 4, dft_bstyle[wback], FILL);

	temp3 = dft_bstyle[4][1];
	temp4 = dft_bstyle[4][2];
	dft_bstyle[4][1] = dft_bstyle[bd][1];
	dft_bstyle[4][2] = dft_bstyle[bd][2];
	hgDrawBorder(x + 8 + 16, y + 8, x + xs - 8 - 16, y + 8 + 20, dft_bstyle[4], FILL);

	dft_bstyle[3][1] = temp1;
	dft_bstyle[3][2] = temp2;
	dft_bstyle[4][1] = temp3;
	dft_bstyle[4][2] = temp4;

	putmark(x + 8, y + 8);
	putmark_R(x + xs - 8 - 16, y + 8);

	dft_bstyle[4][0] = temp;

	xoffset = ((x + 8 + 16) + (x + xs - 8 - 16)) / 2;
	xoffset = xoffset - strlen(p->titl) * 4;
	hgForeTextXy(xoffset, y + 10, p->titl, p->color.tfore);

	hgShowMouse();
}

HSCRLBAR *hgHSCRLBAR_Load(int total, int screen, char direc, WIDTH w)
{
	HSCRLBAR  *p;

	p = (HSCRLBAR *)malloc(sizeof(HSCRLBAR));

	if (total < screen) total = screen;

	p->total = total;
	p->screen = screen;
	p->direc = direc;
	p->size = w;
	p->pos = 0;

	return(p);
}

void     hgHSCRLBAR_Free(HSCRLBAR **p)
{
	free(*p);
}

void     hgHSCRLBAR_Draw(HSCRLBAR *p, int x, int y)
{
	int   x1, x2, y1, y2;
	int   width;
	int   bwidth;
	int   start;

	x1 = x;
	x2 = x + p->size.xwidth;
	y1 = y;
	y2 = y + p->size.ywidth;

	if (p->direc == HORIZ) width = (x2 - x1 - 44);
	else width = (y2 - y1 - 44);

	if (p->total != 0) {
		start = (int)((long)p->pos * (long)width / (long)p->total);
		bwidth = (int)((long)p->screen * (long)width / (long)p->total);
	}
	else {
		start = 0;
		bwidth = width;
	}

	hgHideMouse();

	if (p->direc == VERT) {
		hgBoxFill(x1 + 1, y1, x1 + 16, y2, LIGHTGRAY);
		hgBox(x1, y1, x1 + 16, y2, DARKGRAY);
		hgHline(x1 + 1, x1 + 15, y1 + 20, ZERO);
		hgHline(x1 + 1, x1 + 15, y2 - 20, ZERO);

		hgLine(x1 + 8, y1 + 3, x1 + 3, y1 + 16, WHITE);
		hgLine(x1 + 8, y1 + 3, x1 + 13, y1 + 16, ZERO);
		hgLine(x1 + 3, y1 + 16, x1 + 13, y1 + 16, ZERO);

		hgLine(x1 + 8, y2 - 3, x1 + 3, y2 - 16, WHITE);
		hgLine(x1 + 8, y2 - 3, x1 + 13, y2 - 16, ZERO);
		hgLine(x1 + 3, y2 - 16, x1 + 13, y2 - 16, ZERO);

		hgHline(x1 + 2, x1 + 14, y1 + 22 + start, WHITE);
		hgVline(x1 + 2, y1 + 22 + start, y1 + 22 + start + bwidth, WHITE);
		hgHline(x1 + 2, x1 + 14, y1 + 22 + start + bwidth, ZERO);
		hgVline(x1 + 14, y1 + 22 + start, y1 + 22 + start + bwidth, ZERO);
	}
	else {
		hgBoxFill(x1, y1 + 1, x2, y1 + 16, LIGHTGRAY);
		hgBox(x1, y1, x2, y1 + 16, DARKGRAY);
		hgVline(x1 + 20, y1 + 1, y1 + 15, ZERO);
		hgVline(x2 - 20, y1 + 1, y1 + 15, ZERO);

		hgLine(x1 + 3, y1 + 8, x1 + 16, y1 + 3, WHITE);
		hgLine(x1 + 3, y1 + 8, x1 + 16, y1 + 13, ZERO);
		hgLine(x1 + 16, y1 + 3, x1 + 16, y1 + 13, ZERO);

		hgLine(x2 - 3, y1 + 8, x2 - 16, y1 + 3, WHITE);
		hgLine(x2 - 3, y1 + 8, x2 - 16, y1 + 13, ZERO);
		hgLine(x2 - 16, y1 + 3, x2 - 16, y1 + 13, ZERO);

		hgHline(x1 + 22 + start, x1 + 22 + start + bwidth, y + 2, WHITE);
		hgVline(x1 + 22 + start, y1 + 2, y1 + 14, WHITE);
		hgHline(x1 + 22 + start, x1 + 22 + start + bwidth, y + 14, ZERO);
		hgVline(x1 + 22 + start + bwidth, y1 + 2, y1 + 14, ZERO);
	}

	hgShowMouse();
}

void     hgHSCRLBAR_Update(HSCRLBAR *p, int x, int y)
{
	int   x1, x2, y1, y2;
	int   width;
	int   bwidth;
	int   start;
	int   save;

	x1 = x;
	x2 = x + p->size.xwidth;
	y1 = y;
	y2 = y + p->size.ywidth;

	if (p->direc == HORIZ) width = (x2 - x1 - 44);
	else width = (y2 - y1 - 44);

	save = p->pos;
	if ((p->pos + p->screen) > p->total) p->pos = p->total - p->screen;

	if (p->total != 0) {
		start = (int)((long)p->pos * (long)width / (long)p->total);
		bwidth = (int)((long)p->screen * (long)width / (long)p->total);
	}
	else {
		start = 0;
		bwidth = width;
	}

	hgHideMouse();

	if (p->direc == VERT) {
		hgBoxFill(x1 + 2, y1 + 21, x1 + 14, y2 - 21, LIGHTGRAY);

		hgHline(x1 + 2, x1 + 14, y1 + 22 + start, WHITE);
		hgVline(x1 + 2, y1 + 22 + start, y1 + 22 + start + bwidth, WHITE);
		hgHline(x1 + 2, x1 + 14, y1 + 22 + start + bwidth, ZERO);
		hgVline(x1 + 14, y1 + 22 + start, y1 + 22 + start + bwidth, ZERO);
	}
	else {
		hgBoxFill(x1 + 22, y1 + 2, x2 - 22, y1 + 14, LIGHTGRAY);

		hgHline(x1 + 22 + start, x1 + 22 + start + bwidth, y + 2, WHITE);
		hgVline(x1 + 22 + start, y1 + 2, y1 + 14, WHITE);
		hgHline(x1 + 22 + start, x1 + 22 + start + bwidth, y + 14, ZERO);
		hgVline(x1 + 22 + start + bwidth, y1 + 2, y1 + 14, ZERO);
	}

	hgShowMouse();

	p->pos = save;
}

void     hgHSCRLBAR_Choose(HSCRLBAR *p, int x, int y)
{
	int   x1, x2, y1, y2;
	int   width;
	int   bwidth;
	int   start;
	int   mx, my;
	int   mmx, mmy;
	int   prvs = -1;
	int   ch;
	int   temp;

	hgGetMousePos(&mx, &my);

	x1 = x;
	x2 = x + p->size.xwidth;
	y1 = y;
	y2 = y + p->size.ywidth;

	if (p->direc == HORIZ) width = (x2 - x1 - 44);
	else width = (y2 - y1 - 44);

	if (p->total != 0) {
		start = (int)((long)p->pos * (long)width / (long)p->total);
		bwidth = (int)((long)p->screen * (long)width / (long)p->total);
	}
	else {
		start = 0;
		bwidth = width;
	}

	if (p->direc == VERT) {
		if (mx > x1 && mx < x1 + 16 && my > y1 && my < y1 + 20) {
			if (p->pos > 0) p->pos--;

			hgHideMouse();
			hgLine(x1 + 8, y1 + 3, x1 + 3, y1 + 16, ZERO);
			hgLine(x1 + 8, y1 + 3, x1 + 13, y1 + 16, WHITE);
			hgLine(x1 + 3, y1 + 16, x1 + 13, y1 + 16, WHITE);
			hgShowMouse();

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			hgHideMouse();
			hgLine(x1 + 8, y1 + 3, x1 + 3, y1 + 16, WHITE);
			hgLine(x1 + 8, y1 + 3, x1 + 13, y1 + 16, ZERO);
			hgLine(x1 + 3, y1 + 16, x1 + 13, y1 + 16, ZERO);
			hgShowMouse();

			return;
		}
		if (mx > x1 && mx < x1 + 16 && my > y2 - 20 && my < y2) {
			if (p->pos + p->screen < p->total) p->pos++;

			hgHideMouse();
			hgLine(x1 + 8, y2 - 3, x1 + 3, y2 - 16, ZERO);
			hgLine(x1 + 8, y2 - 3, x1 + 13, y2 - 16, WHITE);
			hgLine(x1 + 3, y2 - 16, x1 + 13, y2 - 16, WHITE);
			hgShowMouse();

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			hgHideMouse();
			hgLine(x1 + 8, y2 - 3, x1 + 3, y2 - 16, WHITE);
			hgLine(x1 + 8, y2 - 3, x1 + 13, y2 - 16, ZERO);
			hgLine(x1 + 3, y2 - 16, x1 + 13, y2 - 16, ZERO);
			hgShowMouse();

			return;
		}
		if (mx > x1 && mx < x1 + 16 && my > y1 + 20 && my < y1 + 22 + start) {
			p->pos = (int)((long)(my - y1 - 20) * (long)p->total / (long)width) - p->screen / 2;
			if (p->pos < 0) p->pos = 0;

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			return;
		}
		if (mx > x1 && mx < x1 + 16 && my > y1 + 22 + start + bwidth && my < y2 - 20) {
			p->pos = (int)((long)(my - y1 - 20) * (long)p->total / (long)width) - p->screen / 2;
			if ((p->pos + p->screen) > p->total)
				p->pos = p->total - p->screen;

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			return;
		}
		if (mx > x1 && mx < x1 + 16 && my > y1 + 20 && my < y2 - 20) {
			temp = p->pos;
			do {
				hgGetMousePos(&mmx, &mmy);
				if (mmx > x1 + 2 && mmx < x1 + 14) {
					temp = p->pos - (int)((long)(my - mmy) * (long)p->total / (long)width);
					if (temp < 0) temp = 0;
					if (temp + p->screen > p->total)
						temp = p->total - p->screen;
					start = (int)((long)temp * (long)width / (long)p->total);
				}
				if (prvs != start) {
					hgHideMouse();
					hgBoxFill(x1 + 2, y1 + 21, x1 + 14, y2 - 21, LIGHTGRAY);
					hgHline(x1 + 2, x1 + 14, y1 + 22 + start, ZERO);
					hgVline(x1 + 2, y1 + 22 + start, y1 + 22 + start + bwidth, ZERO);
					hgHline(x1 + 2, x1 + 14, y1 + 22 + start + bwidth, WHITE);
					hgVline(x1 + 14, y1 + 22 + start, y1 + 22 + start + bwidth, WHITE);
					prvs = start;
					hgShowMouse();
				}
				ch = hgLeftMouse();
			} while (ch);
			if (mmx > x1 && mmx < x1 + 16 && mmy > y1 + 20 && mmy < y2 - 20)
				p->pos = temp;
			hgHSCRLBAR_Update(p, x, y);

			return;
		}
	}
	else {
		if (mx > x1 && mx < x1 + 20 && my > y1 && my < y1 + 16) {
			if (p->pos > 0) p->pos--;

			hgHideMouse();
			hgLine(x1 + 3, y1 + 8, x1 + 16, y1 + 3, ZERO);
			hgLine(x1 + 3, y1 + 8, x1 + 16, y1 + 13, WHITE);
			hgLine(x1 + 16, y1 + 3, x1 + 16, y1 + 13, WHITE);
			hgShowMouse();

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			hgHideMouse();
			hgLine(x1 + 3, y1 + 8, x1 + 16, y1 + 3, WHITE);
			hgLine(x1 + 3, y1 + 8, x1 + 16, y1 + 13, ZERO);
			hgLine(x1 + 16, y1 + 3, x1 + 16, y1 + 13, ZERO);
			hgShowMouse();

			return;
		}
		if (mx > x2 - 20 && mx < x2 && my > y1 && my < y1 + 16) {
			if (p->pos + p->screen < p->total) p->pos++;

			hgHideMouse();
			hgLine(x2 - 3, y1 + 8, x2 - 16, y1 + 3, ZERO);
			hgLine(x2 - 3, y1 + 8, x2 - 16, y1 + 13, WHITE);
			hgLine(x2 - 16, y1 + 3, x2 - 16, y1 + 13, WHITE);
			hgShowMouse();

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			hgHideMouse();
			hgLine(x2 - 3, y1 + 8, x2 - 16, y1 + 3, WHITE);
			hgLine(x2 - 3, y1 + 8, x2 - 16, y1 + 13, ZERO);
			hgLine(x2 - 16, y1 + 3, x2 - 16, y1 + 13, ZERO);
			hgShowMouse();

			return;
		}
		if (mx > x1 + 20 && mx < x1 + 22 + start && my > y1 && my < y1 + 16) {
			p->pos = (int)((long)(mx - x1 - 20) * (long)p->total / (long)width) - p->screen / 2;
			if (p->pos < 0) p->pos = 0;

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			return;
		}
		if (mx > x1 + 22 + start + bwidth && mx < x2 - 20 && my > y1 && my< y1 + 16) {
			p->pos = (int)((long)(mx - x1 - 20) * (long)p->total / (long)width) - p->screen / 2;
			if ((p->pos + p->screen) > p->total)
				p->pos = p->total - p->screen;

			hgHSCRLBAR_Update(p, x, y);
			while (hgLeftMouse());

			return;
		}
		if (mx > x1 + 20 && mx < x2 - 20 && my > y1 && my < y1 + 16) {
			temp = p->pos;
			do {
				hgGetMousePos(&mmx, &mmy);
				if (mmy > y1 + 2 && mmy < y1 + 14) {
					temp = p->pos - (int)((long)(mx - mmx) * (long)p->total / (long)width);
					if (temp < 0) temp = 0;
					if (temp + p->screen > p->total)
						temp = p->total - p->screen;
					start = (int)((long)temp * (long)width / (long)p->total);
				}
				if (prvs != start) {
					hgHideMouse();
					hgBoxFill(x1 + 22, y1 + 2, x2 - 22, y1 + 14, LIGHTGRAY);
					hgHline(x1 + 22 + start, x1 + 22 + start + bwidth, y + 2, ZERO);
					hgVline(x1 + 22 + start, y1 + 2, y1 + 14, ZERO);
					hgHline(x1 + 22 + start, x1 + 22 + start + bwidth, y + 14, WHITE);
					hgVline(x1 + 22 + start + bwidth, y1 + 2, y1 + 14, WHITE);
					prvs = start;
					hgShowMouse();
				}
				ch = hgLeftMouse();
			} while (ch);
			if (mmy > y1 && mmy < y1 + 16 && mmx > x1 + 20 && mmx < x2 - 20)
				p->pos = temp;
			hgHSCRLBAR_Update(p, x, y);

			return;
		}
	}
}

int      hgHSCRLBAR_Area(HSCRLBAR *p, int x, int y)
{
	int   x1, x2, y1, y2;
	int   mx, my;

	if (!hgGetMouse()) return(hgFAIL);

	hgGetMousePos(&mx, &my);

	x1 = x;
	x2 = x + p->size.xwidth;
	y1 = y;
	y2 = y + p->size.ywidth;

	if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) return(hgSUCCESS);
	return(hgFAIL);
}

