/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : dirbox.c  -- ¬åÈ‚ ¤b¯a ¡¡—I                   |
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

char     recpos = hgFALSE;		/* ¬åÈ‚ ¤b¯a ¤a ¶áÃ¡· ‹¡´â µa¦ */

int      dbpos = 0;			/* ¬åÈ‚ ¤b¯a ¤a ¶áÃ¡· Ðw¡¢ ¤åÑ¡ */
int      dobjt = 0;
int      dtpos = 0;			/* ¬åÈ‚ ¤b¯a ¯¡¸b ¶áÃ¡· Ðw¡¢ ¤åÑ¡ */

int      mbpos = 0;
int      mobjt = 0;
int      stpos = 0;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgChangeDirBox(int a, int b, int c);
void     hgSetDirBox(int a, int b, int c);
void     hgGetDirBox(int *a, int *b, int *c);
void     hgSetRecPosOn();
void     hgSetRecPosOff();

HDIRBOX *hgHDIRBOX_Load(char *i[MAXITEM], WIDTH w, int xnum, int ynum);
void     hgHDIRBOX_Free(HDIRBOX **p);
void     print_oneline(int x, int y, char *items[], int pos, int num, int xnum, int xw);
void     hgHDIRBOX_Choose(HDIRBOX *p, int x, int y, char *title, char *ret);
void     hgHDIRHELPBOX_Choose(HDIRBOX *p, int x, int y, char *title, char *hp, char *ix);

void     hgSelectDirBoxXy(int x, int y, char *items[], char *title, char *ret);
void     hgSelectDirBoxXyM(char *items[], char *title, char *ret);
void     hgSelectDirHelpBoxXy(int x, int y, char *items[], char *title, char *hp, char *ix);
void     hgSelectDirHelpBoxXyM(char *items[], char *title, char *hp, char *ix);


void     hgChangeDirBox(int a, int b, int c)
{
	mbpos = a;
	mobjt = b;
	stpos = c;
}

void     hgSetDirBox(int a, int b, int c)
{
	dbpos = a;
	dobjt = b;
	dtpos = c;
}

void     hgGetDirBox(int *a, int *b, int *c)
{
	*a = dbpos;
	*b = dobjt;
	*c = dtpos;
}

void     hgSetRecPosOn()
{
	recpos = hgTRUE;
}

void     hgSetRecPosOff()
{
	recpos = hgFALSE;
}

HDIRBOX *hgHDIRBOX_Load(char *i[MAXITEM], WIDTH w, int xnum, int ynum)
{
	HDIRBOX  *p;

	int   pos = 0;

	p = (HDIRBOX *)malloc(sizeof(HDIRBOX));

	while (strcmp(i[pos], "")) {
		p->items[pos] = (char *)malloc((size_t)(strlen(i[pos]) + 2));
		strcpy(p->items[pos], i[pos]);
		pos++;
	}

	p->items[pos] = (char *)malloc((size_t)3);
	strcpy(p->items[pos], "");

	p->size = w;
	p->xnum = xnum;
	p->ynum = ynum;

	return(p);
}

void     hgHDIRBOX_Free(HDIRBOX **p)
{
	int   pos = 0;

	while (strcmp((*p)->items[pos], ""))
		free((*p)->items[pos++]);
	if ((*p)->items[pos]) free((*p)->items[pos]);
	free(*p);
}

void     print_oneline(int x, int y, char *items[], int pos, int num, int xnum, int xw)
{
	int   i;
	int   xpos = (pos / xnum) * xnum;

	for (i = 0;i < xnum;i++) {
		if ((xpos + i) >= num) return;
		hgOutTextXy(x + i * xw + 6, y + 1, items[xpos + i]);
	}
}

void     hgHDIRBOX_Choose(HDIRBOX *p, int x, int y, char *title, char *ret)
{
	HBAR     *bar;
	BCOLOR   barc = { wcBARNORMAL, wcINSIDE };
	WIDTH    barw;
	HSCRLBAR *sbar;
	WIDTH    sbarw;

	char   fill = LIGHTGRAY;
	int    i, ch;
	int    num, max;
	int    xx, yy;
	int    px, py;
	int    scrmax;
	int    pos, offset, os = 0;
	int    ps = 0, diff;
	int    savetemp;
	int    mx, my;
	int    xc, yc;

	max = ret_maxlength(p->items) / hgGetXFactor();

	hgWIDTH_Load(&barw, max + 16, 20);
	bar = hgHBAR_Load(barc, barw);

	hgPrtWindowXy(x, y, x + p->size.xwidth, y + p->size.ywidth, title);

	hgHideMouse();
	hgBoxFill(x + 14, y + 34, x + p->size.xwidth - 13, y + p->size.ywidth - 13, fill);

	num = ret_number(p->items) / 16 / hgGetYFactor();
	max = (p->size.xwidth - 24 - 12 - 13) / (p->xnum);

	scrmax = y + 40 + p->ynum * 20;

	hgWIDTH_Load(&sbarw, 16, p->size.ywidth - 47);
	sbar = hgHSCRLBAR_Load((num - 1) / p->xnum + 1, p->ynum, VERT, sbarw);

	if (recpos) dtpos = stpos;
	else dtpos = 0;

	xx = x + 17;
	yy = y + 40;

	for (i = 0;i < p->ynum;i++) {
		print_oneline(xx, yy + i * 20, p->items, dtpos, num, p->xnum, max);
		dtpos += p->xnum;
		if (dtpos >= num) break;
	}

	if (recpos) {
		dtpos = stpos;
		pos = mbpos;
		offset = mobjt;
	}
	else {
		dtpos = 0;
		pos = 0;
		offset = 0;
	}

	sbar->pos = offset / (-20);

	px = xx = x + 17 + (pos % p->xnum) * max;
	py = yy = y + 40 + (pos / p->xnum) * 20 + offset;

	hgHSCRLBAR_Draw(sbar, x + p->size.xwidth - 29, y + 34);
	hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

	os = offset;

	do {
		if (xx != px || yy != py) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			px = xx;
			py = yy;
		}

		do {
			ch = windelay(x, y, x + p->size.xwidth, y + p->size.ywidth);
		} while (ch == NOKEY);

		if (ch == MOUSE_LEFT)
			if (hgHSCRLBAR_Area(sbar, x + p->size.xwidth - 29, y + 34)) {
				ps = sbar->pos;
				hgHSCRLBAR_Choose(sbar, x + p->size.xwidth - 29, y + 34);
				diff = sbar->pos - ps;
				ps = diff;
				if (ps != 0) {
					pos += (ps * p->xnum);
					ps = sbar->pos;
					offset = -ps * 20;
					os = offset;
					hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

					if (diff == 1) {
						hgScrUp(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
						print_oneline(x + 17, y + 40 + (p->ynum - 1) * 20, p->items,
							      ps * p->xnum + (p->ynum - 1) * p->xnum, num, p->xnum, max);
						dtpos += p->xnum;
					}
					else if (diff == -1) {
						hgScrDown(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
						print_oneline(x + 17, y + 40, p->items,
							      ps * p->xnum, num, p->xnum, max);
						dtpos -= p->xnum;
					}
					else
						for (i = 0;i < p->ynum;i++) {
							hgBoxFill(x + 14, y + 40 + i * 20,
								  x + p->size.xwidth - 30, y + 60 + i * 20, fill);
							print_oneline(x + 17, y + 40 + i * 20, p->items,
								      ps * p->xnum + i * p->xnum, num, p->xnum, max);
							dtpos = (offset / (-20)) * p->xnum;
						}

					hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
				}
				while (hgLeftMouse());
			}
			else {
				hgGetMousePos(&mx, &my);
				if (mx > x + 17 && mx < x + p->size.xwidth - 29
					&& my > y + 40 && my < y + p->size.ywidth - 13) {
					xc = (mx - x - 17) / max;
					yc = (my - y - 40) / 20;
					savetemp = -offset * p->xnum / 20 + xc + yc * p->xnum;

					if (savetemp < num) {
						pos = savetemp;
						xx = x + 17 + (pos % p->xnum) * max;
						yy = y + 40 + (pos / p->xnum) * 20 + offset;

						hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
						hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
						while (hgLeftMouse());
						hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);
						break;
					}
				}
			}
		if (ch == RETURN) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			break;
		}
		if (ch == ESC || ch == LEFTMARK || ch == RIGHTMARK) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			break;
		}
		if (ch == RIGHT) pos++;
		if (ch == LEFT) pos--;
		if (ch == UP) pos -= p->xnum;
		if (ch == DOWN) pos += p->xnum;
		if (pos < 0) pos = 0;
		if (pos >= num) pos = num - 1;

		xx = x + 17 + (pos % p->xnum) * max;
		yy = y + 40 + (pos / p->xnum) * 20 + offset;

		if ((yy + 20) > (scrmax)) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			hgHideMouse();
			hgScrUp(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
			print_oneline(x + 17, y + 40 + (p->ynum - 1) * 20, p->items, pos, num, p->xnum, max);
			hgHBAR_Draw(bar, px - 2, py - 2, DRAW);

			offset -= 20;
			dtpos += p->xnum;
			yy = y + 40 + (pos / p->xnum) * 20 + offset;
		}
		if (yy < (y + 40)) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			hgHideMouse();
			hgScrDown(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
			print_oneline(x + 17, y + 40, p->items, pos, num, p->xnum, max);
			hgHBAR_Draw(bar, px - 2, py - 2, DRAW);

			offset += 20;
			dtpos -= p->xnum;
			yy = y + 40 + (pos / p->xnum) * 20 + offset;
		}

		if (os != offset) {
			sbar->pos = sbar->pos - (offset - os) / 20;
			if (sbar->pos < 0) sbar->pos = 0;
			if (sbar->pos + sbar->screen >= sbar->total)
				sbar->pos = sbar->total - sbar->screen;
			hgHSCRLBAR_Update(sbar, x + p->size.xwidth - 29, y + 34);
			os = offset;
		}
	} while (1);

	if (recpos) hgSetDirBox(pos, offset, dtpos);

	hgHBAR_Free(&bar);
	hgHSCRLBAR_Free(&sbar);

	if (ch == ESC || ch == LEFTMARK || ch == RIGHTMARK) {
		strcpy(ret, "");
		return;
	}
	strcpy(ret, p->items[pos]);
	hgShowMouse();
}

void     hgHDIRHELPBOX_Choose(HDIRBOX *p, int x, int y, char *title, char *hp, char *ix)
{
	HBAR     *bar;
	BCOLOR   barc = { wcBARNORMAL, wcINSIDE };
	WIDTH    barw;
	HSCRLBAR *sbar;
	WIDTH    sbarw;

	char   fill = LIGHTGRAY;
	int    i, ch;
	int    num, max;
	int    xx, yy;
	int    px, py;
	int    scrmax;
	int    pos, offset, os = 0;
	int    ps = 0, diff;
	int    savetemp;
	int    mx, my;
	int    xc, yc;

	max = ret_maxlength(p->items) / hgGetXFactor();

	hgWIDTH_Load(&barw, max + 16, 20);
	bar = hgHBAR_Load(barc, barw);

	hgPrtWindowXy(x, y, x + p->size.xwidth, y + p->size.ywidth, title);

	hgHideMouse();
	hgBoxFill(x + 14, y + 34, x + p->size.xwidth - 13, y + p->size.ywidth - 13, fill);

	num = ret_number(p->items) / 16 / hgGetYFactor();
	max = (p->size.xwidth - 24 - 12 - 13) / (p->xnum);

	scrmax = y + 40 + p->ynum * 20;

	hgWIDTH_Load(&sbarw, 16, p->size.ywidth - 47);
	sbar = hgHSCRLBAR_Load((num - 1) / p->xnum + 1, p->ynum, VERT, sbarw);

	if (recpos) dtpos = stpos;
	else dtpos = 0;

	xx = x + 17;
	yy = y + 40;

	for (i = 0;i < p->ynum;i++) {
		print_oneline(xx, yy + i * 20, p->items, dtpos, num, p->xnum, max);
		dtpos += p->xnum;
		if (dtpos >= num) break;
	}

	if (recpos) {
		dtpos = stpos;
		pos = mbpos;
		offset = mobjt;
	}
	else {
		dtpos = 0;
		pos = 0;
		offset = 0;
	}

	sbar->pos = offset / (-20);

	px = xx = x + 17 + (pos % p->xnum) * max;
	py = yy = y + 40 + (pos / p->xnum) * 20 + offset;

	hgHSCRLBAR_Draw(sbar, x + p->size.xwidth - 29, y + 34);
	hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

	os = offset;

	do {
		if (xx != px || yy != py) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			px = xx;
			py = yy;
		}

		do {
			ch = windelay(x, y, x + p->size.xwidth, y + p->size.ywidth);
		} while (ch == NOKEY);

		if (ch == MOUSE_LEFT)
			if (hgHSCRLBAR_Area(sbar, x + p->size.xwidth - 29, y + 34)) {
				ps = sbar->pos;
				hgHSCRLBAR_Choose(sbar, x + p->size.xwidth - 29, y + 34);
				diff = sbar->pos - ps;
				ps = diff;
				if (ps != 0) {
					pos += (ps * p->xnum);
					ps = sbar->pos;
					offset = -ps * 20;
					os = offset;
					hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

					if (diff == 1) {
						hgScrUp(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
						print_oneline(x + 17, y + 40 + (p->ynum - 1) * 20, p->items,
							      ps * p->xnum + (p->ynum - 1) * p->xnum, num, p->xnum, max);
						dtpos += p->xnum;
					}
					else if (diff == -1) {
						hgScrDown(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
						print_oneline(x + 17, y + 40, p->items,
							      ps * p->xnum, num, p->xnum, max);
						dtpos -= p->xnum;
					}
					else
						for (i = 0;i < p->ynum;i++) {
							hgBoxFill(x + 14, y + 40 + i * 20,
								  x + p->size.xwidth - 30, y + 60 + i * 20, fill);
							print_oneline(x + 17, y + 40 + i * 20, p->items,
								      ps * p->xnum + i * p->xnum, num, p->xnum, max);
							dtpos = (offset / (-20)) * p->xnum;
						}

					hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
				}
				while (hgLeftMouse());
			}
			else {
				hgGetMousePos(&mx, &my);
				if (mx > x + 17 && mx < x + p->size.xwidth - 29
					&& my > y + 40 && my < y + p->size.ywidth - 13) {
					xc = (mx - x - 17) / max;
					yc = (my - y - 40) / 20;
					savetemp = -offset * p->xnum / 20 + xc + yc * p->xnum;

					if (savetemp < num) {
						pos = savetemp;
						xx = x + 17 + (pos % p->xnum) * max;
						yy = y + 40 + (pos / p->xnum) * 20 + offset;

						hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
						hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
						while (hgLeftMouse());
						hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

						hgSetTextAttrOn();
						if (hgFileHelpBoxXyM(hp, ix, (p->size.xwidth - 50) / 8,
								     p->ynum, p->items[pos]) != -1)
							hgRestore();
						hgSetTextAttrOff();

						hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

						px = xx;
						py = yy;
					}
				}
			}
		if (ch == RETURN) {
			hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

			hgSetTextAttrOn();
			if (hgFileHelpBoxXyM(hp, ix, (p->size.xwidth - 50) / 8, p->ynum, p->items[pos]) != -1)
				hgRestore();
			hgSetTextAttrOff();

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
		}
		if (ch == ESC || ch == LEFTMARK || ch == RIGHTMARK) {
			hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);
			break;
		}
		if (ch == RIGHT) pos++;
		if (ch == LEFT) pos--;
		if (ch == UP) pos -= p->xnum;
		if (ch == DOWN) pos += p->xnum;
		if (pos < 0) pos = 0;
		if (pos >= num) pos = num - 1;

		xx = x + 17 + (pos % p->xnum) * max;
		yy = y + 40 + (pos / p->xnum) * 20 + offset;

		if ((yy + 20) > (scrmax)) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			hgHideMouse();
			hgScrUp(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
			print_oneline(x + 17, y + 40 + (p->ynum - 1) * 20, p->items, pos, num, p->xnum, max);
			hgHBAR_Draw(bar, px - 2, py - 2, DRAW);

			offset -= 20;
			dtpos += p->xnum;
			yy = y + 40 + (pos / p->xnum) * 20 + offset;
		}
		if (yy < (y + 40)) {
			hgHBAR_Draw(bar, px - 2, py - 2, ERASE);
			hgHideMouse();
			hgScrDown(x + 14, y + 40, x + p->size.xwidth - 30, scrmax, 20, fill);
			print_oneline(x + 17, y + 40, p->items, pos, num, p->xnum, max);
			hgHBAR_Draw(bar, px - 2, py - 2, DRAW);

			offset += 20;
			dtpos -= p->xnum;
			yy = y + 40 + (pos / p->xnum) * 20 + offset;
		}

		if (os != offset) {
			sbar->pos = sbar->pos - (offset - os) / 20;
			if (sbar->pos < 0) sbar->pos = 0;
			if (sbar->pos + sbar->screen >= sbar->total)
				sbar->pos = sbar->total - sbar->screen;
			hgHSCRLBAR_Update(sbar, x + p->size.xwidth - 29, y + 34);
			os = offset;
		}
	} while (1);

	if (recpos) hgSetDirBox(pos, offset, dtpos);

	hgHBAR_Free(&bar);
	hgHSCRLBAR_Free(&sbar);

	hgShowMouse();
}

void     hgSelectDirBoxXy(int x, int y, char *items[], char *title, char *ret)
{
	HDIRBOX  *p;
	WIDTH    w = { 494, 194 };

	p = hgHDIRBOX_Load(items, w, 4, 7);
	hgHDIRBOX_Choose(p, x, y, title, ret);
	hgHDIRBOX_Free(&p);
}

void     hgSelectDirBoxXyM(char *items[], char *title, char *ret)
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - 478 / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - 194 / 2;

	hgSelectDirBoxXy(x, y, items, title, ret);
}

void     hgSelectDirHelpBoxXy(int x, int y, char *items[], char *title, char *hp, char *ix)
{
	HDIRBOX  *p;
	WIDTH    w = { 416, 254 };

	p = hgHDIRBOX_Load(items, w, 2, 10);
	hgHDIRHELPBOX_Choose(p, x, y, title, hp, ix);
	hgHDIRBOX_Free(&p);
}

void     hgSelectDirHelpBoxXyM(char *items[], char *title, char *hp, char *ix)
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - 416 / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - 254 / 2;

	hgSelectDirHelpBoxXy(x, y, items, title, hp, ix);
}
