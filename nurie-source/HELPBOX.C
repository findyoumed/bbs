/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : helpbox.c  -- •¡¶‘ i ¤b¯a ¡¡—I                |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <stdlib.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

HHELP   *hgHHELP_Load(char *i[], int xc, int yl);
void     hgHHELP_Free(HHELP **p);
void     print_help_sub(int x, int y, char *items[], int max, int sline, int ylines, int xsize);
void     hgHHELP_Draw(HHELP *p, int x, int y, char *title);

void     hgPrtHelpBoxXy(int x, int y, char *items[], int xw, int yw, char *title);
void     hgPrtHelpBoxXyM(char *items[], int xw, int yw, char *title);

long     keysearch(FILE *idx, char *key);
int      hgFileHelpBoxXy(char *hp, char *ix, int x, int y, int xw, int yw, char *key);
int      hgFileHelpBoxXyM(char *hp, char *ix, int xw, int yw, char *key);


HHELP   *hgHHELP_Load(char *i[], int xc, int yl)
{
	HHELP  *p;

	int   pos = 0;

	p = (HHELP *)malloc(sizeof(HHELP));

	while (strcmp(i[pos], "")) {
		p->items[pos] = (char *)malloc((size_t)(strlen(i[pos]) + 2));
		strcpy(p->items[pos], i[pos]);
		pos++;
	}

	p->items[pos] = (char *)malloc((size_t)3);
	strcpy(p->items[pos], "");

	p->xchars = xc;
	p->ylines = yl;

	return(p);
}

void     hgHHELP_Free(HHELP **p)
{
	int   pos = 0;

	while (strcmp((*p)->items[pos], ""))
		free((*p)->items[pos++]);
	if ((*p)->items[pos]) free((*p)->items[pos]);
	free(*p);
}

void     print_help_sub(int x, int y, char *items[], int max, int sline, int ylines, int xsize)
{
	int   i, j;

	for (i = 0;i < ylines;i++) {
		hgBoxFill(x, y, x + xsize, y + 15, WHITE);
		hgOutTextXy(x, y, items[sline]);
		sline++;
		y += 16;
		if (sline >= max) break;
	}

	for (j = i + 1;j < ylines;j++) {
		hgBoxFill(x, y, x + xsize, y + 15, WHITE);
		y += 16;
	}
}

void     hgHHELP_Draw(HHELP *p, int x, int y, char *title)
{
	HSCRLBAR  *sbar;
	WIDTH     sbarw;

	char   eattr, hattr;
	char   fsave, bsave;
	int    xs, ys;
	int    prvs;
	int    sline;
	int    max = 0;
	int    ch;
	int    ps, diff;		/* for scroll bar */

	eattr = hgGetEAttr();
	hattr = hgGetHAttr();
	fsave = hgGetTFcolor();
	bsave = hgGetTBcolor();

	max = ret_number(p->items) / 16 / hgGetYFactor();
	xs = p->xchars * 8 + 28;
	ys = p->ylines * 16 + 32 + 12 + 4;

	hgWIDTH_Load(&sbarw, 16, p->ylines * 16 + 4);
	sbar = hgHSCRLBAR_Load(max, p->ylines, VERT, sbarw);

	hgPrtWindowXy(x, y, x + xs + 16, y + ys, title);
	hgHSCRLBAR_Draw(sbar, x + xs - 12, y + 32);

	hgHideMouse();
	prvs = sline = 0;
	print_help_sub(x + 14, y + 34, p->items, max, sline, p->ylines, xs - 28);

	while (1) {
		hgShowMouse();
		do {
			ch = windelay(x, y, x + xs + 16, y + ys);
		} while (ch == NOKEY);

		prvs = sline;

		if (ch == MOUSE_LEFT)
			if (hgHSCRLBAR_Area(sbar, x + xs - 12, y + 32)) {
				ps = sbar->pos;
				hgHSCRLBAR_Choose(sbar, x + xs - 12, y + 32);
				diff = sbar->pos - ps;
				if (diff != 0) {
					if (diff == 1) ch = DOWN;
					else if (diff == -1) ch = UP;
					else sline = sbar->pos;
				}
				while (hgLeftMouse());
			}
		if (ch == CTRL_PgUp) sline = 0;
		if (ch == CTRL_PgDn) {
			sline = max - p->ylines;
			if (sline < 0) sline = 0;
		}
		if (ch == PgUp) {
			sline -= p->ylines;
			if (sline < 0) sline = 0;
		}
		if (ch == PgDn) {
			sline += p->ylines;
			if (sline >= max) sline -= p->ylines;
		}
		if (ch == ESC || ch == RETURN || ch == LEFTMARK || ch == RIGHTMARK) break;

		if (prvs != sline) {
			hgHideMouse();
			print_help_sub(x + 14, y + 34, p->items, max, sline, p->ylines, xs - 28);
			sbar->pos = sline;
			hgHSCRLBAR_Update(sbar, x + xs - 12, y + 32);
		}

		if (ch == UP) {
			sline--;
			if (sline < 0) sline = 0;
			else {
				hgScrDownWindowXy(x, y, x + xs, y + ys, 16);
				hgHideMouse();
				hgOutTextXy(x + 14, y + 34, p->items[sline]);
				sbar->pos = sline;
				hgHSCRLBAR_Update(sbar, x + xs - 12, y + 32);
			}
		}
		if (ch == DOWN) {
			sline++;
			if ((sline + p->ylines - 1) >= max) sline--;
			else {
				hgScrUpWindowXy(x, y, x + xs, y + ys, 16);
				hgHideMouse();
				hgOutTextXy(x + 14, y + (p->ylines - 1) * 16 + 34, p->items[sline + p->ylines - 1]);
				sbar->pos = sline;
				hgHSCRLBAR_Update(sbar, x + xs - 12, y + 32);
			}
		}
	}

	hgHSCRLBAR_Free(&sbar);

	hgSetEAttr(eattr);
	hgSetHAttr(hattr);
	hgSetTFcolor(fsave);
	hgSetTBcolor(bsave);

	hgShowMouse();
}

void     hgPrtHelpBoxXy(int x, int y, char *items[], int xw, int yw, char *title)
{
	HHELP  *p;

	p = hgHHELP_Load(items, xw, yw);
	hgHHELP_Draw(p, x, y, title);
	hgHHELP_Free(&p);
}

void     hgPrtHelpBoxXyM(char *items[], int xw, int yw, char *title)
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - (xw * 8 + 44) / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - (yw * 16 + 48) / 2;

	hgPrtHelpBoxXy(x, y, items, xw, yw, title);
}

long     keysearch(FILE *idx, char *key)
{
	char   temp[80];
	int    i;
	long   offset;

	fseek(idx, 0, 0);
	while (fgets(temp, 80, idx) != NULL) {
		for (i = 0;i < strlen(temp);i++)
			if (temp[i] == ',') break;
		offset = atol(&temp[i + 1]);
		temp[i] = 0;
		if (!strcmp(temp, key)) return(offset);
	}

	return(-1L);
}

int      hgFileHelpBoxXy(char *hp, char *ix, int x, int y, int xw, int yw, char *key)
{
	FILE   *idx, *hlp;

	char   *items[MAXHELPLINE];
	char   temp[255];		/* max string length */
	char   keys[60];
	int    max = 0;
	int    i;
	long   offset;

	idx = fopen(ix, "r");
	if (idx == NULL) return(-1);

	strcpy(keys, "$");
	strcat(keys, key);

	for (i = strlen(keys) - 1;i >= 0;i--) {
		if (*(keys + i) != SPACE) break;
		*(keys + i) = 0;
	}

	offset = keysearch(idx, keys);
	fclose(idx);

	if (offset == -1L) return(-1);

	hlp = fopen(hp, "r");
	if (hlp == NULL) return(-1);

	fseek(hlp, offset, 0);

	while (fgets(temp, 255, hlp) != NULL) {
		if (temp[0] == '$') break;
		temp[strlen(temp) - 1] = 0;
		if (temp[0] == '/' && strlen(temp) == 1) strcpy(temp, " ");
		items[max] = (char *)malloc((size_t)strlen(temp) + 2);
		strcpy(items[max], temp);
		max++;
	}
	fclose(hlp);

	items[max] = (char *)malloc((size_t)3);
	items[max][0] = 0;
	items[max][1] = 0;

	hgPrtHelpBoxXy(x, y, items, xw, yw, key);

	for (i = 0;i <= max;i++)
		free(items[i]);

	return(1);
}

int      hgFileHelpBoxXyM(char *hp, char *ix, int xw, int yw, char *key)
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - (xw * 8 + 44) / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - (yw * 16 + 48) / 2;
	int   flag;

	flag = hgFileHelpBoxXy(hp, ix, x, y, xw, yw, key);
	return(flag);
}

