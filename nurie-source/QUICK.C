/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : quick.c  -- Íe· Ðq® ¡¡—I                    |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <io.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MAXBUTTON    10
#define     MAXSTACK     50

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     saveflag = hgFALSE;		/* ÑÁ¡e ¸á¸w µa¦ */

int      wintitlefore = WHITE;
int      wintitleback = DARKGRAY;
int      winback = wcINSIDE;
int      winborder = wcBOXNORMAL;

VIMAGE   *gbuff[MAXSTACK];		/* ÑÁ¡e ¸á¸w¶w ¤áÌá */
int      stacktop = 0;
int      gx1[MAXSTACK], gy1[MAXSTACK];
int      gx2[MAXSTACK], gy2[MAXSTACK];

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgQuickHOutInit();
void     hgQuickVOutInit();
void     hgQuickInInit();
void     hgQuickOutInit();
void     hgQuickHGraphInit();
void     hgQuickVGraphInit();
void     hgQuickGraphInit();

int      ret_number(char *text[]);
int      ret_maxlength(char *text[]);

void     hgRetMSize(char *text[], int *x1, int *y1, int *x2, int *y2);
void     savearea(int x1, int y1, int x2, int y2);
void     hgRestore();
void     hgDelete();
void     hgSetSaveOn();
void     hgSetSaveOff();

void     hgDisplayText(char *text[], char color);
void     hgDisplayMessage(char *text, char color);
int      hgGetText(char *title, char *str, int n, char color);
void     hgPrtWTextXy(int x1, int y1, int x2, int y2, char *title, char *text[]);
void     hgPrtWTextXyQ(int x, int y, char *title, char *text[]);
void     hgPrtWTextXyM(char *title, char *text[]);
void     hgPrtWindowXy(int x1, int y1, int x2, int y2, char *title);

void     hgClearWindowXy(int x1, int y1, int x2, int y2);
void     hgColorWindowXy(int x1, int y1, int x2, int y2, int color);
void     hgScrUpWindowXy(int x1, int y1, int x2, int y2, int n);
void     hgScrDownWindowXy(int x1, int y1, int x2, int y2, int n);

void     hgSetTitleFore(int color);
void     hgSetTitleBack(int color);
int      hgGetTitleFore();
int      hgGetTitleBack();
void     hgSetWinBack(int style);
int      hgGetWinBack();
void     hgSetWinBorder(int style);
int      hgGetWinBorder();

void     hgPrtBoxXy(int x1, int y1, int x2, int y2, char *items[]);
void     hgPrtBoxXyM(char *items[]);
void     hgPrtButtonXy(int x, int y, char *text, int mode);
void     hgPrtButtonXyM(char *text, int mode);
int      hgPrtButtonBarXy(int x1, int y1, int x2, int y2, char *msg[], char *items[]);
int      hgPrtButtonBarXyM(char *msg[], char *items[]);
void     hgPrtPullWindowXy(HPULLDOWN *p, char *title, int x, int y1, int y2);
void     hgPrtPullDownXy(HPULLDOWN *p, int x, int y, int start, int *xx, int *yy);
int      hgSelectXy(int x1, int y1, int x2, int y2, char *items[], int start);
int      hgSelectXyM(char *items[], int start);


void     hgQuickHOutInit()
{
	hgSetEngOut(&hgc_pute);
	hgSetHanOut(&hgc_puth);
	hgSetMagOut(&hgc_putmn);
	hgEnableCursor(&hgc_curh, &hgc_cure);
	hgEnableAttr(fREVERSE);
	hgEnableAttr(fUNDER);
	hgEnableAttr(fOUTLINE);
	hgEnableAttr(fTHREED);
	hgEnableAttr(fBOLD);
	hgEnableAttr(fSHADOW);
	hgEnableAttr(fDIM);
}

void     hgQuickVOutInit()
{
	hgSetEngOut(&vga_pute);
	hgSetHanOut(&vga_puth);
	hgSetMagOut(&vga_putmn);
	hgEnableCursor(&vga_curh, &vga_cure);
	hgEnableAttr(fREVERSE);
	hgEnableAttr(fUNDER);
	hgEnableAttr(fOUTLINE);
	hgEnableAttr(fTHREED);
	hgEnableAttr(fBOLD);
	hgEnableAttr(fSHADOW);
	hgEnableAttr(fDIM);
}

void     hgQuickInInit()
{
	hgSetInInit();
	hgEnableAttr(fREVERSE);
}

void     hgQuickOutInit()
{
	if (hgGetTextMode() == hgMonoText || hgIsHerc()) hgQuickHOutInit();
	else hgQuickVOutInit();
}

void     hgQuickHGraphInit()
{
	hgSetHFillDPattern();
	hgSetHVlineDefault();
	hgEnablePlot(&hgc_plot);
	hgEnableHVline(&hgc_hline, &hgc_vline);
	hgEnableLine(&hgc_lineg);
	hgEnableBoxFill(&hgc_boxfill);
	hgEnableImage(&hgc_getimage, &hgc_putimage);
	hgEnableImage4(&hgc_getimage4, &hgc_putimage4);
	hgEnableImageVIRTUAL(&hgc_getimagevirtual, &hgc_putimagevirtual);
	hgEnableImgSize(&hgc_imgsize);
	hgEnableImgSize4(&hgc_imgsize4);
	hgEnableScrUp(&hgc_scrup);
	hgEnableScrDown(&hgc_scrdown);
	hgEnableScrLeft(&hgc_scrleft);
	hgEnableScrRight(&hgc_scrright);
	hgEnablePCXFileDisplay(&hgc_pcxdisplay);
}

void     hgQuickVGraphInit()
{
	hgEnablePlot(&vga_plot);
	hgEnableHVline(&vga_hline, &vga_vline);
	hgEnableLine(&vga_lineg);
	hgEnableBoxFill(&vga_boxfill);
	hgEnableImage(&vga_getimage, &vga_putimage);
	hgEnableImage4(&vga_getimage4, &vga_putimage4);
	hgEnableImageVIRTUAL(&vga_getimagevirtual, &vga_putimagevirtual);
	hgEnableImgSize(&vga_imgsize);
	hgEnableImgSize4(&vga_imgsize4);
	hgEnableScrUp(&vga_scrup);
	hgEnableScrDown(&vga_scrdown);
	hgEnableScrLeft(&vga_scrleft);
	hgEnableScrRight(&vga_scrright);
	hgEnablePCXFileDisplay(&vga_pcxdisplay);
}

void     hgQuickGraphInit()
{
	if (hgGetTextMode() == hgMonoText || hgIsHerc()) hgQuickHGraphInit();
	else hgQuickVGraphInit();
}

int      ret_number(char *text[])
{
	int   pos = 0;

	while (strcmp(text[pos], "")) pos++;
	return(pos * 16 * hgGetYFactor());
}

int      ret_maxlength(char *text[])
{
	int   pos = 0;
	int   length = -1;
	int   slen;

	while (strcmp(text[pos], "")) {
		slen = strlen(text[pos]);
		if (slen >= length) length = slen;
		pos++;
	}

	return(length * 8 * (1 << (hgGetXFactor() - 1)));
}

void     hgRetMSize(char *text[], int *x1, int *y1, int *x2, int *y2)
{
	int   max = ret_maxlength(text);
	int   num = ret_number(text);
	int   xmid = (hgGetx2r() + hgGetx1r()) / 2;
	int   ymid = (hgGety2r() + 20 + hgGety1r()) / 2;
	int   xs;
	int   ys;

	xs = max + 33;
	ys = num + 55;

	*x1 = xmid - xs / 2;
	*y1 = ymid - ys / 2;
	*x2 = xmid + xs / 2;
	*y2 = ymid + ys / 2;
}

void     savearea(int x1, int y1, int x2, int y2)
{
	stacktop++;
	if (stacktop >= 50) return;

	hgGetImageVIRTUAL(x1, y1, x2, y2, &gbuff[stacktop]);
	gx1[stacktop] = x1;
	gy1[stacktop] = y1;
	gx2[stacktop] = x2;
	gy2[stacktop] = y2;
}

void     hgRestore()
{
	if (stacktop == 0) return;

	hgHideMouse();

	hgPutImageVIRTUAL(gx1[stacktop], gy1[stacktop], gx2[stacktop], gy2[stacktop], gbuff[stacktop]);
	hgFreeVIMAGE(&gbuff[stacktop]);
	stacktop--;

	hgShowMouse();
}

void     hgDelete()
{
	hgFreeVIMAGE(&gbuff[stacktop]);
}

void     hgSetSaveOn()
{
	saveflag = hgTRUE;
}

void     hgSetSaveOff()
{
	saveflag = hgFALSE;
}

void     hgDisplayText(char *text[], char color)
{
	int   pos = 0;
	int   max = ret_maxlength(text);
	int   num = ret_number(text);
	int   xx, yy;
	int   x, y;
	int   xs, ys;

	xs = max + 32;
	ys = num + 30;

	xx = (hgGetx2r() + hgGetx1r()) / 2;
	yy = (hgGety2r() + hgGety1r()) / 2;
	x = xx - xs / 2;
	y = yy - ys / 2;

	if (hgIsHerc()) color = DARKGRAY;

	hgHideMouse();

	if (saveflag) savearea(x, y, x + xs, y + ys);

	hgDrawBorder(x, y, x + xs, y + ys, BOXNORMAL, FILL);
	hgDrawBorder(x + 6, y + 14, x + xs - 6, y + ys - 6, BOXREVERSE, NOFILL);

	hgBoxFill(x + 7, y + 15, x + xs - 7, y + ys - 7, color);

	while (strcmp(text[pos], "")) {
		hgForeTextXy(x + 16, y + 20 + pos * 16 * hgGetYFactor(), text[pos], WHITE);
		pos++;
	}

	hgShowMouse();
}

void     hgDisplayMessage(char *text, char color)
{
	char   *items[2];

	items[0] = (char *)malloc((size_t)(strlen(text) + 2));
	items[1] = (char *)malloc((size_t)3);

	strcpy(items[0], text);
	strcpy(items[1], "");

	hgDisplayText(items, color);
}

int      hgGetText(char *title, char *str, int n, char color)
{
	char   fsave, bsave;
	int    max = (n > strlen(title) + 4) ? n : strlen(title) + 4;
	int    xx, yy;
	int    x, y;
	int    xs, ys;
	int    xoffset;
	int    flag;

	fsave = hgGetTFcolor();
	bsave = hgGetTBcolor();
	hgSetTFcolor(WHITE);

	if (hgIsHerc()) color = DARKGRAY;
	hgSetTBcolor(color);

	xs = max * 8 + 32;
	ys = 30 + 20 + 16;

	xx = (hgGetx2r() + hgGetx1r()) / 2;
	yy = (hgGety2r() + hgGety1r()) / 2;
	x = xx - xs / 2;
	y = yy - ys / 2;

	hgHideMouse();

	if (saveflag) savearea(x, y, x + xs, y + ys);

	hgDrawBorder(x, y, x + xs, y + ys, BOXNORMAL, FILL);
	hgDrawBorder(x + 6, y + 15, x + xs - 6, y + ys - 6, BOXREVERSE, NOFILL);

	hgBoxFill(x + 7, y + 16, x + xs - 7, y + 35, color);
	hgDrawBorder(x + 7, y + 16, x + xs - 7, y + 35, BOXNORMAL, NOFILL);

	xoffset = ((x + 16) + (x + xs - 16)) / 2;
	xoffset = xoffset - strlen(title) * 4;
	hgOutTextXy(xoffset, y + 18, title);

	hgShowMouse();

	hgSetTFcolor(ZERO);
	hgSetTBcolor(dft_bstyle[2][0]);

	flag = hgInTextXy(x + 16, y + 38, str, n);

	hgSetTFcolor(fsave);
	hgSetTBcolor(bsave);

	return(flag);
}

void     hgPrtWTextXy(int x1, int y1, int x2, int y2, char *title, char *text[])
{
	WCOLOR   msgc;
	WIDTH    msgs;
	HWINDOW  *msgw;

	int   xs = x2 - x1 + 1;
	int   ys = y2 - y1 + 1;
	int   pos = 0;

	hgWCOLOR_Load(&msgc, winborder, wintitlefore, wintitleback, winback);
	hgWIDTH_Load(&msgs, xs, ys);
	msgw = hgHWINDOW_Load(title, msgc, msgs);

	hgHideMouse();

	if (saveflag) savearea(x1, y1, x1 + xs, y1 + ys);

	hgHWINDOW_Draw(msgw, x1, y1);

	hgHideMouse();

	while (strcmp(text[pos], "")) {
		hgOutTextXy(x1 + 16, y1 + 38 + pos * 16 * hgGetYFactor(), text[pos]);
		pos++;
	}

	hgShowMouse();

	hgHWINDOW_Free(&msgw);
}

void     hgPrtWTextXyQ(int x, int y, char *title, char *text[])
{
	int   max = ret_maxlength(text);
	int   num = ret_number(text);

	hgPrtWTextXy(x, y, x + max + 32, y + num + 54, title, text);
}

void     hgPrtWTextXyM(char *title, char *text[])
{
	int   max = ret_maxlength(text);
	int   num = ret_number(text);
	int   xmid = (hgGetx2r() + hgGetx1r()) / 2;
	int   ymid = (hgGety2r() + 20 + hgGety1r()) / 2;
	int   xs = max + 33;
	int   ys = num + 55;

	hgPrtWTextXy(xmid - xs / 2, ymid - ys / 2, xmid + xs / 2, ymid + ys / 2, title, text);
}

void     hgPrtWindowXy(int x1, int y1, int x2, int y2, char *title)
{
	char   *text[] = { "" };

	hgPrtWTextXy(x1, y1, x2, y2, title, text);
}

void     hgClearWindowXy(int x1, int y1, int x2, int y2)
{
	hgHideMouse();
	hgBoxFill(x1 + 13, y1 + 33, x2 - 13, y2 - 13, dft_bstyle[winback][0]);
	hgShowMouse();
}

void     hgColorWindowXy(int x1, int y1, int x2, int y2, int color)
{
	hgHideMouse();
	hgBoxFill(x1 + 13, y1 + 33, x2 - 13, y2 - 13, color);
	hgShowMouse();
}

void     hgScrUpWindowXy(int x1, int y1, int x2, int y2, int n)
{
	hgHideMouse();
	hgScrUp(x1 + 13, y1 + 33, x2 - 13, y2 - 13, n, dft_bstyle[winback][0]);
	hgShowMouse();
}

void     hgScrDownWindowXy(int x1, int y1, int x2, int y2, int n)
{
	hgHideMouse();
	hgScrDown(x1 + 13, y1 + 33, x2 - 13, y2 - 13, n, dft_bstyle[winback][0]);
	hgShowMouse();
}

void     hgSetTitleFore(int color)
{
	wintitlefore = color;
}

void     hgSetTitleBack(int color)
{
	wintitleback = color;
}

int      hgGetTitleFore()
{
	return(wintitlefore);
}

int      hgGetTitleBack()
{
	return(wintitleback);
}

void     hgSetWinBack(int style)
{
	winback = style;
}

int      hgGetWinBack()
{
	return(winback);
}

void     hgSetWinBorder(int style)
{
	winborder = style;
}

int      hgGetWinBorder()
{
	return(winborder);
}

void     hgPrtBoxXy(int x1, int y1, int x2, int y2, char *items[])
{
	WCOLOR  boxc;
	WIDTH   boxw;
	HBOX    *boxb;

	hgWCOLOR_Load(&boxc, wcBOXNORMAL, ZERO, LIGHTGRAY, wcINSIDE);
	hgWIDTH_Load(&boxw, x2 - x1 + 1, y2 - y1 + 1);
	boxb = hgHBOX_Load(items, boxc, boxw);

	if (saveflag) {
		hgHideMouse();
		savearea(x1, y1, x2 + 1, y2 + 1);
		hgShowMouse();
	}

	hgHBOX_Draw(boxb, x1, y1);
	hgHBOX_Free(&boxb);
}

void     hgPrtBoxXyM(char *items[])
{
	int   max = ret_maxlength(items);
	int   num = ret_number(items);
	int   xs, ys;
	int   xmid = (hgGetx2r() + hgGetx1r()) / 2;
	int   ymid = (hgGety2r() + hgGety1r()) / 2;

	num *= 20;
	num /= 16;

	xs = max + 13;
	ys = num + 4;

	hgPrtBoxXy(xmid - xs / 2, ymid - ys / 2, xmid + xs / 2, ymid + ys / 2, items);
}

void     hgPrtButtonXy(int x, int y, char *text, int mode)
{
	WCOLOR   btc;
	WIDTH    btw;
	HBUTTON  *btb;

	int    max = strlen(text) * (1 << (hgGetXFactor() - 1));

	hgWCOLOR_Load(&btc, wcBARNORMAL, ZERO, LIGHTGRAY, wcBARREVERSE);
	hgWIDTH_Load(&btw, max * 8 + 10, 16 * hgGetYFactor() + 4);
	btb = hgHBUTTON_Load(text, btc, btw);
	hgHBUTTON_Draw(btb, x, y, mode);
	hgHBUTTON_Free(&btb);
}

void     hgPrtButtonXyM(char *text, int mode)
{
	WCOLOR   btc;
	WIDTH    btw;
	HBUTTON  *btb;

	int   xmid = (hgGetx2r() + hgGetx1r()) / 2;
	int   ymid = (hgGety2r() + hgGety1r()) / 2;
	int   max = strlen(text) * (1 << (hgGetXFactor() - 1));

	hgWCOLOR_Load(&btc, wcBARNORMAL, ZERO, LIGHTGRAY, wcBARREVERSE);
	hgWIDTH_Load(&btw, max * 8 + 10, 16 * hgGetYFactor() + 4);
	btb = hgHBUTTON_Load(text, btc, btw);
	hgHBUTTON_Draw(btb, xmid - max * 4 - 5, ymid - 8 * hgGetYFactor() - 2, mode);
	hgHBUTTON_Free(&btb);
}

int      hgPrtButtonBarXy(int x1, int y1, int x2, int y2, char *msg[], char *items[])
{
	CIMAGE  *buff;

	int   pos;
	int   ch;
	int   length;
	int   num, i, j, prvs, prvi;
	int   xincre, xpos;
	int   x[MAXBUTTON];
	int   xw[MAXBUTTON];

	hgHideMouse();

	if (saveflag) savearea(x1, y1, x2, y2);

	hgDrawBorder(x1, y1, x2, y2, BOXNORMAL, FILL);
	hgDrawBorder(x1 + 4, y1 + 4, x2 - 4, y2 - 4, BOXREVERSE, NOFILL);

	num = ret_number(msg) / 16 / hgGetYFactor();

	pos = y1 + 10;
	for (i = 0;i < num;i++) {
		hgOutTextXy(x1 + 10, pos, msg[i]);
		pos += 16 * hgGetYFactor();
	}

	pos += 4;
	hgDHline(x1 + 6, x2 - 6, pos);
	pos += 16;

	num = ret_number(items) / 16 / hgGetYFactor();

	xincre = (x2 - x1 + 1 - 32) / num;
	xpos = x1 + 11 + xincre / 2;

	for (i = 0;i < num;i++) {
		length = strlen(items[i]) * (1 << (hgGetXFactor() - 1));
		hgPrtButtonXy(xpos - length * 4, pos, items[i], NOPUSH);
		x[i] = xpos - length * 4;
		xw[i] = length * 8 + 10;
		xpos += xincre;
	}

	xpos = x1 + 11 + xincre / 2;
	i = 0;
	prvs = xpos;
	prvi = i;

	length = strlen(items[i]) * (1 << (hgGetXFactor() - 1));
	hgGetImage4(xpos - length * 4 - 5, pos - 5, xpos + length * 4 + 15,
		    pos + 26 + 16 * (hgGetYFactor() - 1), &buff);
	hgDrawBorder(xpos - length * 4 - 5, pos - 5, xpos + length * 4 + 15,
		     pos + 26 + 16 * (hgGetYFactor() - 1), BOXREVERSE, NOFILL);

	hgShowMouse();

	do {
		do {
			ch = inkey(NOWAIT);
			if (ch == MOUSE_RIGHT || ch == MOUSE_MIDDLE) ch = NOKEY;
		} while (ch == NOKEY);

		if (ch == MOUSE_LEFT) {
			j = get_xwpos(x, pos - 5, xw, 20 + 16 * (hgGetYFactor() - 1), num);
			if (j >= 0 && j < num) {
				i = j;

				hgHideMouse();
				length = strlen(items[prvi]) * (1 << (hgGetXFactor() - 1));
				hgPutImage4(prvs - length * 4 - 5, pos - 5, prvs + length * 4 + 15,
					    pos + 26 + 16 * (hgGetYFactor() - 1), buff);
				hgFreeCIMAGE(&buff);

				length = strlen(items[i]) * (1 << (hgGetXFactor() - 1));
				xpos = x1 + 11 + xincre / 2 + i * xincre;
				hgDrawBorder(xpos - length * 4 - 5, pos - 5, xpos + length * 4 + 15,
					     pos + 26 + 16 * (hgGetYFactor() - 1), BOXREVERSE, NOFILL);
				break;
			}
		}

		if (ch == RIGHT || ch == TAB) {
			xpos += xincre;
			i++;
		}
		if (ch == LEFT) {
			xpos -= xincre;
			i--;
		}

		if (i < 0) {
			xpos += xincre * num;
			i = num - 1;
		}
		if (i > num - 1) {
			xpos = 11 + xincre / 2 + x1;
			i = 0;
		}

		if (xpos != prvs) {
			hgHideMouse();
			length = strlen(items[prvi]) * (1 << (hgGetXFactor() - 1));
			hgPutImage4(prvs - length * 4 - 5, pos - 5, prvs + length * 4 + 15,
				    pos + 26 + 16 * (hgGetYFactor() - 1), buff);
			hgFreeCIMAGE(&buff);

			length = strlen(items[i]) * (1 << (hgGetXFactor() - 1));
			hgGetImage4(xpos - length * 4 - 5, pos - 5, xpos + length * 4 + 15,
				    pos + 26 + 16 * (hgGetYFactor() - 1), &buff);
			hgDrawBorder(xpos - length * 4 - 5, pos - 5, xpos + length * 4 + 15,
				     pos + 26 + 16 * (hgGetYFactor() - 1), BOXREVERSE, NOFILL);
			prvs = xpos;
			prvi = i;
			hgShowMouse();
		}
		if (ch == RETURN || ch == ESC) {
			hgHideMouse();
			length = strlen(items[prvi]) * (1 << (hgGetXFactor() - 1));
			hgPutImage4(prvs - length * 4 - 5, pos - 5, prvs + length * 4 + 15,
				    pos + 26 + 16 * (hgGetYFactor() - 1), buff);
			hgFreeCIMAGE(&buff);
			break;
		}
	} while (1);

	length = strlen(items[i]) * (1 << (hgGetXFactor() - 1));

	hgHideMouse();
	hgPrtButtonXy(xpos - length * 4, pos, items[i], PUSH);
	hgShowMouse();

	while (hgLeftMouse());
	if (ch == ESC) return(-1);
	else return(i);
}

int      hgPrtButtonBarXyM(char *msg[], char *items[])
{
	int   max = ret_maxlength(msg);
	int   num = ret_number(msg);
	int   xs = max + 33;
	int   ys = num + 55 + 16 * hgGetYFactor();
	int   xmid = (hgGetx1r() + hgGetx2r()) / 2;
	int   ymid = (hgGety1r() + hgGety2r()) / 2;
	int   flag;

	flag = hgPrtButtonBarXy(xmid - xs / 2, ymid - ys / 2, xmid + xs / 2, ymid + ys / 2, msg, items);

	return(flag);
}

void     hgPrtPullWindowXy(HPULLDOWN *p, char *title, int x, int y1, int y2)
{
	int   pxs = p->size.xwidth;

	hgPrtWindowXy(x - 12, y1, x + pxs + 12, y2, title);
}

void     hgPrtPullDownXy(HPULLDOWN *p, int x, int y, int start, int *xx, int *yy)
{
	hgHPULLDOWN_Choose(p, x, y + 32, start, xx, yy);
}

int      hgSelectXy(int x1, int y1, int x2, int y2, char *items[], int start)
{
	WIDTH   mesgs;
	WCOLOR  mesgc;
	HBOX    *mesgb;

	WIDTH   mbars;
	BCOLOR  mbarc;
	HBAR    *mbarb;

	int   xs = x2 - x1 + 1;
	int   ys = y2 - y1 + 1;
	int   pos = 0;
	int   ch;
	int   max;
	int   prvs;
	int   mousedrag = 0;
	int   i;

	hgWIDTH_Load(&mbars, xs - 4, 20 * hgGetYFactor());
	hgBCOLOR_Load(&mbarc, wcBARNORMAL, wcBARNORMAL);
	mbarb = hgHBAR_Load(mbarc, mbars);

	hgWIDTH_Load(&mesgs, xs, ys);
	hgWCOLOR_Load(&mesgc, wcBOXNORMAL, ZERO, LIGHTGRAY, wcINSIDE);
	mesgb = hgHBOX_Load(items, mesgc, mesgs);

	while (strcmp(items[pos], "")) pos++;

	max = pos;
	pos = start;
	prvs = pos;                        /* for no match */

	hgHideMouse();

	if (saveflag) hgHBOX_Save(mesgb, x1, y1);

	hgHBOX_Draw(mesgb, x1, y1);
	hgHBAR_Draw(mbarb, x1 + 2, y1 + prvs * 20 * hgGetYFactor() + 2, DRAW);

	hgShowMouse();

	while (1) {
		ch = inkey(NOWAIT);
		if (ch == MOUSE_LEFT) {
			pos = get_mpos(x1 + 2, y1 + 2, xs - 4, 20 * hgGetYFactor(), max);
			if (pos >= 0 && pos < max && !mousedrag) {
				hgHideMouse();
				hgHBAR_Draw(mbarb, x1 + 2, y1 + prvs * 20 * hgGetYFactor() + 2, ERASE);
				hgHBAR_Draw(mbarb, x1 + 2, y1 + pos * 20 * hgGetYFactor() + 2, DRAW);
				delay(100);
				hgHBAR_Draw(mbarb, x1 + 2, y1 + pos * 20 * hgGetYFactor() + 2, ERASE);
				prvs = pos;
				break;
			}
			if (pos < 0 || pos >= max) {
				mousedrag = 1;
				pos = prvs;
			}
		}
		if (ch != MOUSE_LEFT && mousedrag) {
			pos = get_mpos(x1 + 2, y1 + 2, xs - 4, 20 * hgGetYFactor(), max);
			if (pos >= 0 && pos < max) {
				if (prvs != pos) {
					hgHideMouse();
					hgHBAR_Draw(mbarb, x1 + 2, y1 + prvs * 20 * hgGetYFactor() + 2, ERASE);
					hgHBAR_Draw(mbarb, x1 + 2, y1 + pos * 20 * hgGetYFactor() + 2, DRAW);
					delay(100);
					hgHBAR_Draw(mbarb, x1 + 2, y1 + pos * 20 * hgGetYFactor() + 2, ERASE);
					prvs = pos;
				}
				break;
			}
			else pos = prvs;
			mousedrag = 0;
		}

		if (ch == UP) pos--;
		if (ch == DOWN) pos++;
		if (pos < 0) pos = max - 1;
		if (pos >= max) pos = 0;

		if (prvs != pos) {
			hgHideMouse();
			hgHBAR_Draw(mbarb, x1 + 2, y1 + prvs * 20 * hgGetYFactor() + 2, ERASE);
			hgHBAR_Draw(mbarb, x1 + 2, y1 + pos * 20 * hgGetYFactor() + 2, DRAW);
			hgShowMouse();
			prvs = pos;
		}

		if (ch == MOUSE_RIGHT || ch == ESC || ch == RETURN) {
			hgHideMouse();
			hgHBAR_Draw(mbarb, x1 + 2, y1 + prvs * 20 * hgGetYFactor() + 2, ERASE);
			hgShowMouse();
			break;
		}
	}

	hgHideMouse();
	if (saveflag) hgHBOX_Restore(mesgb, x1, y1);
	hgShowMouse();

	hgHBOX_Free(&mesgb);
	hgHBAR_Free(&mbarb);

	if (ch == ESC || ch == MOUSE_RIGHT)  return(-1);
	return(pos);
}

int      hgSelectXyM(char *items[], int start)
{
	int   flag;

	int   max = ret_maxlength(items);
	int   num = ret_number(items);
	int   xmid = (hgGetx2r() + hgGetx1r()) / 2;
	int   ymid = (hgGety2r() + hgGety1r()) / 2;
	int   xs = max + 13;
	int   ys;

	num = num * 20;
	num = num / 16;

	ys = num + 4;

	flag = hgSelectXy(xmid - xs / 2, ymid - ys / 2, xmid + xs / 2, ymid + ys / 2, items, start);
	return(flag);
}
