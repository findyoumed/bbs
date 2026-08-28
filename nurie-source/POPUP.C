/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : popup.c  -- Ìs´ó & Î‰”a¶… ¡A“A ¡¡—I           |
 |       ¹A¸b·©¯¡    : 93/10/31(É¡)                                  |
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

int      xb[MAXPOPUP];
int      xw[MAXPOPUP];
int      xe[MAXPOPUP];
int      xn;				/* counter */
int      xp;				/* pointer */
int      maxlen = -1;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

HPOPUP  *hgHPOPUP_Load(char *i[], WCOLOR c, WIDTH w);
void     hgHPOPUP_Loadcode(HPOPUP *p, int c[MAXITEM]);
void     hgHPOPUP_Free(HPOPUP **p);
HPULLDOWN *hgHPULLDOWN_Load(char *i[], int x[MAXITEM], WIDTH w, HPOPUP *pop[MAXPOPUP]);
void     hgHPULLDOWN_Loadcode(HPULLDOWN *p, int c[MAXITEM]);
void     hgHPULLDOWN_Free(HPULLDOWN **p);
int      hgHPOPUP_Choose(HPOPUP *p, int x, int y, int start);
void     hgHPULLDOWN_Choose(HPULLDOWN *p, int x, int y, int start, int *xx, int *yy);


HPOPUP  *hgHPOPUP_Load(char *i[], WCOLOR c, WIDTH w)
{
	HPOPUP  *p;

	int   pos = 0;
	int   j;

	p = (HPOPUP *)malloc(sizeof(HPOPUP));

	while (strcmp(i[pos], "")) {
		p->items[pos] = (char *)malloc((size_t)(strlen(i[pos]) + 2));
		strcpy(p->items[pos], i[pos]);
		pos++;
	}

	for (j = 0;j < pos;j++)
		p->code[j] = hgEnable;

	p->items[pos] = (char *)malloc((size_t)3);
	strcpy(p->items[pos], "");

	p->color = c;
	p->size = w;
	p->start = 0;

	return(p);
}

void     hgHPOPUP_Loadcode(HPOPUP *p, int c[MAXITEM])
{
	int   i;

	for (i = 0;i < MAXITEM;i++) {
		if (!strcmp(p->items[i], "")) break;
		p->code[i] = c[i];
	}
}

void     hgHPOPUP_Free(HPOPUP **p)
{
	int   pos = 0;

	while (strcmp((*p)->items[pos], ""))
		free((*p)->items[pos++]);
	if ((*p)->items[pos]) free((*p)->items[pos]);
	free(*p);
}

HPULLDOWN *hgHPULLDOWN_Load(char *i[], int x[MAXITEM], WIDTH w, HPOPUP *pop[MAXPOPUP])
{
	HPULLDOWN  *p;

	int   pos = 0;
	int   j;

	p = (HPULLDOWN *)malloc(sizeof(HPULLDOWN));

	while (strcmp(i[pos], "")) {
		p->items[pos] = (char *)malloc((size_t)(strlen(i[pos]) + 2));
		strcpy(p->items[pos], i[pos]);
		pos++;
	}

	for (j = 0;j < pos;j++) {
		p->xpos[j] = x[j];
		p->p[j] = pop[j];
		p->code[j] = hgEnable;
	}

	p->items[pos] = (char *)malloc((size_t)3);
	strcpy(p->items[pos], "");

	p->size = w;
	p->start = 0;

	return(p);
}

void     hgHPULLDOWN_Loadcode(HPULLDOWN *p, int c[MAXITEM])
{
	int   i;

	for (i = 0;i < MAXITEM;i++) {
		if (!strcmp(p->items[i], "")) break;
		p->code[i] = c[i];
	}
}

void     hgHPULLDOWN_Free(HPULLDOWN **p)
{
	int   pos = 0;

	while (strcmp((*p)->items[pos], ""))
		free((*p)->items[pos++]);
	if ((*p)->items[pos]) free((*p)->items[pos]);
	free(*p);
}

int      hgHPOPUP_Choose(HPOPUP *p, int x, int y, int start)
{
	HBAR     *bar;
	BCOLOR   bc;
	WIDTH    bw;

	int    ch;
	int    xx, yy;
	int    num;
	int    i;
	int    mousedrag = hgFALSE;
	int    x1, y1, xwidth, ywidth;
	int    save, prvs;

	if (start < 0) start = p->start;
	num = ret_number(p->items) / 16 / hgGetYFactor();

	while (p->code[start] == hgDisable) {
		start++;
		if (start < 0) start = num - 1;
		if (start > num - 1) start = 0;
	}
	prvs = start;

	hgWIDTH_Load(&bw, p->size.xwidth - 4, 20);
	hgBCOLOR_Load(&bc, wcBARNORMAL, wcBARNORMAL);
	bar = hgHBAR_Load(bc, bw);

	hgHideMouse();
	hgGetImageVIRTUAL(x, y, x + p->size.xwidth, y + p->size.ywidth, &p->buff);

	hgDrawBorder(x, y, x + p->size.xwidth, y + p->size.ywidth, dft_bstyle[p->color.border], FILL);

	for (i = 0;i < num;i++) {
		if (p->code[i] == hgDisable) {
			if (!hgIsHerc()) {
				hgSetHAttr(DIM);
				hgSetEAttr(DIM);
			}
		}
		hgOutTextXy(x + 6, y + 4 + i * 20, p->items[i]);
		if (p->code[i] == hgDisable) {
			if (!hgIsHerc()) {
				hgSetEAttr(NORMAL);
				hgSetHAttr(NORMAL);
			}
		}
	}

	xx = x + 2;
	yy = y + 2 + start * 20;
	hgHBAR_Draw(bar, xx, yy, DRAW);

	while (1) {
		hgShowMouse();
		ch = inkey(NOWAIT);
		if (ch == MOUSE_LEFT) {
			start = get_mpos(x + 2, y + 2, p->size.xwidth - 4, 20, num);
			if (start != -1)
				if (p->code[start] != hgDisable && !mousedrag) {
					yy = y + 2 + prvs * 20;
					hgHBAR_Draw(bar, xx, yy, ERASE);
					yy = y + 2 + start * 20;
					hgHBAR_Draw(bar, xx, yy, DRAW);
					delay(100);
					hgHBAR_Draw(bar, xx, yy, ERASE);
					break;
				}
				else {
					if (p->code[start] == hgDisable)
						start = prvs;
					mousedrag = hgTRUE;
				}
			else mousedrag = hgTRUE;
			if (start == -1) start = prvs;

			if (maxlen != -1) {
				save = get_xwpos(xb, y + 2 - 14 - 16 + 5, xw, 4 + 16, xn);
				if (save != -1)
					if (xp != save && xe[save] != hgDisable) {
						xp = save;
						ch = -2;
						xx = x + 2;
						yy = y + 2 + prvs * 20;
						hgHBAR_Draw(bar, xx, yy, ERASE);
						break;
					}
					else mousedrag = hgTRUE;
			}
		}
		if (ch != MOUSE_LEFT && mousedrag) {
			start = get_mpos(x + 2, y + 2, p->size.xwidth - 4, 20, num);
			if (start != -1) {
				hgHBAR_Draw(bar, x + 2, y + prvs * 20 + 2, ERASE);
				hgHBAR_Draw(bar, x + 2, y + start * 20 + 2, DRAW);
				delay(100);
				hgHBAR_Draw(bar, x + 2, y + start * 20 + 2, ERASE);
				prvs = start;
				break;
			}
			else {
				start = prvs;
				if (maxlen != -1) {
				x1 = x + 2;
				xwidth = maxlen;
				y1 = y + 2 - 14 - 16 + 5;
				ywidth = 4 + 16;
				if (get_mpos(x1, y1, xwidth, ywidth, 1) == -1)
					ch = ESC;
				}
			}
			mousedrag = hgFALSE;
		}

		if (ch == ESC || ch == RETURN || ch == MOUSE_RIGHT) {
			xx = x + 2;
			yy = y + 2 + prvs * 20;
			hgHBAR_Draw(bar, xx, yy, ERASE);
			break;
		}
		if (ch == UP) start--;
		if (ch == DOWN) start++;
		if (ch == LEFT || ch == RIGHT) {
			xx = x + 2;
			yy = y + 2 + prvs * 20;
			hgHBAR_Draw(bar, xx, yy, ERASE);
			break;
		}

		if (start < 0) start = num - 1;
		if (start > num - 1) start = 0;
		while (p->code[start] == hgDisable) {
			if (ch == UP) start--;
			else start++;
			if (start < 0) start = num - 1;
			if (start > num - 1) start = 0;
		}
		if (prvs != start) {
			yy = y + 2 + prvs * 20;
			hgHBAR_Draw(bar, xx, yy, ERASE);
			yy = y + 2 + start * 20;
			hgHBAR_Draw(bar, xx, yy, DRAW);
			prvs = start;
		}
	}

	hgHideMouse();
	hgPutImageVIRTUAL(x, y, x + p->size.xwidth, y + p->size.ywidth, p->buff);
	hgFreeVIMAGE(&p->buff);
	hgShowMouse();

	hgHBAR_Free(&bar);

	p->start = start;

	if (ch == -2) return(-2);
	if (ch == ESC) return(-1);
	if (ch == MOUSE_RIGHT) {
		while (hgRightMouse());
		return(-1);
	}
	if (ch == LEFT) return(-LEFT);
	if (ch == RIGHT) return(-RIGHT);

	return(start);
}

void     hgHPULLDOWN_Choose(HPULLDOWN *p, int x, int y, int start, int *xx, int *yy)
{
	HBAR     *bar;
	BCOLOR   bc;
	WIDTH    bw;

	int    ch;
	int    num;
	int    i;
	int    ret = 0;
	int    prvs;

	if (start < 0) start = p->start;
	num = ret_number(p->items) / 16 / hgGetYFactor();

	while (p->code[start] == hgDisable) {
		start++;
		if (start < 0) start = num - 1;
		if (start > num - 1) start = 0;
	}
	prvs = start;

	hgHideMouse();
	hgDrawBorder(x, y, x + p->size.xwidth, y + 14 + 16, BOXNORMAL, FILL);

	maxlen = ret_maxlength(p->items) + 10;

	hgWIDTH_Load(&bw, maxlen, 4 + 16);
	hgBCOLOR_Load(&bc, wcBARNORMAL, wcBARNORMAL);
	bar = hgHBAR_Load(bc, bw);

	for (i = 0;i < num;i++) {
		if (p->code[i] == hgDisable) {
			if (!hgIsHerc()) {
				hgSetEAttr(DIM);
				hgSetHAttr(DIM);
			}
		}
		hgOutTextXy(x + p->xpos[i], y + 8, p->items[i]);
		if (p->code[i] == hgDisable) {
			if (!hgIsHerc()) {
				hgSetEAttr(NORMAL);
				hgSetHAttr(NORMAL);
			}
		}
		xb[i] = x + p->xpos[i] - 5;
		xw[i] = maxlen;
		xe[i] = p->code[i];
	}

	xn = num;

	do {
		hgHBAR_Draw(bar, x + p->xpos[start] - 5, y + 5, DRAW);
		prvs = start;
		while (1) {
			hgShowMouse();
			do {
				ch = inkey(NOWAIT);
			} while (ch == NOKEY);

			if (ch == MOUSE_LEFT) {
				start = get_xwpos(xb, y + 5, xw, 20, num);
				if (start != -1 && p->code[start] != hgDisable) {
					hgHBAR_Draw(bar, x + p->xpos[prvs] - 5, y + 5, ERASE);
					break;
				}
				start = prvs;
			}

			if (ch == ESC || ch == MOUSE_RIGHT || ch == RETURN || ch == DOWN) {
				hgHBAR_Draw(bar, x + p->xpos[prvs] - 5, y + 5, ERASE);
				break;
			}
			if (ch == LEFT) start--;
			if (ch == RIGHT) start++;

			if (start < 0) start = num - 1;
			if (start > num - 1) start = 0;
			while (p->code[start] == hgDisable) {
				if (ch == LEFT) start--;
				else start++;
				if (start < 0) start = num - 1;
				if (start > num - 1) start = 0;
			}
			if (start != prvs) {
				hgHBAR_Draw(bar, x + p->xpos[prvs] - 5, y + 5, ERASE);
				hgHBAR_Draw(bar, x + p->xpos[start] - 5, y + 5, DRAW);
				prvs = start;
			}
		}

		if (ch == ESC || ch == MOUSE_RIGHT) {
			p->start = start;
			hgHBAR_Free(&bar);
			*xx = -1;
			*yy = -1;
			return;
		}

		do {
			xp = start;
			hgHBAR_Draw(bar, x + p->xpos[start] - 5, y + 5, DRAW);
			ret = hgHPOPUP_Choose(p->p[start], x + p->xpos[start] - 5, y + 14 + 16, -1);
			hgHBAR_Draw(bar, x + p->xpos[start] - 5, y + 5, ERASE);

			if (ret == -LEFT) start--;
			else if (ret == -RIGHT) start++;
			else if (ret == -1) break;
			else if (ret == -2) start = xp;
			else break;

			if (start < 0) start = num - 1;
			if (start > num - 1) start = 0;
			while (p->code[start] == hgDisable) {
				if (ret == -LEFT) start--;
				else start++;
				if (start < 0) start = num - 1;
				if (start > num - 1) start = 0;
			}
		} while (1);
		p->start = start;
	} while (ret == -1);

	*xx = start;
	*yy = ret;

	hgHBAR_Free(&bar);

	maxlen = -1;			/* re-initialize */

	hgShowMouse();

	if (ch == ESC || ch == MOUSE_RIGHT) {
		*xx = -1;
		*yy = -1;
		return;
	}

	return;
}
