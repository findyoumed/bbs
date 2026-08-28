/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : video.c  -- §¡•Aµ¡ Äa—a Á¡‹¡ÑÁ ¡¡—I           |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <dos.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     hgTF = BLACK;			/* ¢…¸a· color */
char     hgTB = WHITE;

int      hgx1r, hgx2r;			/* real x, y Ï¢­I ”e¶á ¹ÁÎa */
int      hgy1r, hgy2r;

int      xbyte;				/* Ï¢­I 1 œa·¥· Á· ¤a·¡Ëa® */

int      hgMode;			/* §¡•Aµ¡ ¡¡—a */
int      hgDisplay;			/* ‹aœÏ¢ ¡¡—a */
int      hgColors;			/* ¯©¹A ÂA” colors */

int      _hgH = hgFALSE;		/* ÐáÇiA¯a Äa—a¯¡ */

int      ModeSet[] = {
	0x12, 0x29, 0x10, 0x0e, 0, 0
};

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      hgIsEGAVGA();
int      hgIsVGA();
int      hgIsEGA();
int      hgIsHerc();
int      hgGetTextMode();

void     hgSetDisplay(int disp);
void     hgSetHercDisplay(int disp);
void     hgSetColorDisplay(int disp);
void     hgAutoSetDisplay();

void     hgSetMode(int mode);
void     call_int10_0(int mode);
void     hgSetHercMode();
void     hgSetColorMode();
void     hgSetHerc720();
void     hgSetHerc640();

void     hgSetRealWindow(int x1, int y1, int x2, int y2);
int      hgGetx1r();
int      hgGety1r();
int      hgGetx2r();
int      hgGety2r();

int      hgGetMode();
int      hgGetDisplay();

void     hgSetTFcolor(char color);
void     hgSetTBcolor(char color);
char     hgGetTFcolor();
char     hgGetTBcolor();
int      hgGetMaxColors();


int      hgIsEGAVGA()
{
	union  REGS  r;

	r.h.ah = 0x12;
	r.h.bl = 0x10;
	r.h.bh = 0x55;

	int86(0x10, &r, &r);

	if (_BH != 0x55) return(hgTRUE);
	else return(hgFALSE);
}

int      hgIsVGA()
{
	union  REGS  r;

	r.h.ah = 0x1a;
	r.h.al = 0;

	int86(0x10, &r, &r);

	if (_AL == 0x1a && (_BL == 7 || _BL == 8)) return(hgTRUE);
	else return(hgFALSE);
}

int      hgIsEGA()
{
	union  REGS  r;

	r.h.ah = 0x1a;
	r.h.al = 0;

	int86(0x10, &r, &r);

	if (_AL == 0x1a && (_BL == 3 || _BL == 4 || _BL == 5)) return(hgTRUE);
	else return(hgFALSE);
}

int      hgIsHerc()
{
	return(_hgH);
}

int      hgGetTextMode()
{
	union  REGS  r;

	r.h.ah = 0x0f;

	int86(0x10, &r, &r);

	return(r.h.al);
}

void     hgSetDisplay(int disp)
{
	if (disp == hgHERC720x348 || disp == hgHERC640x400)
		hgSetHercDisplay(disp);
	else hgSetColorDisplay(disp);
}

void     hgSetHercDisplay(int disp)
{
	_hgH = hgTRUE;
	hgDisplay = disp;

	hgSetMaxPages(1);

	if (hgGetTextMode() != hgMonoText) {
		printf("\nError: incorrect video setting occured.\n");
		printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
		exit(1);
	}

	if (disp == hgHERC720x348) 	/* 720 * 349 * B/W */
		hgSetRealWindow(0, 0, 719, 347);
	else 				/* 640 * 400 * B/W */
		hgSetRealWindow(0, 0, 639, 399);

	hgColors = 2;
	hgEnableClearScreen(&hgc_cls);
}

void     hgSetColorDisplay(int disp)
{
	_hgH = hgFALSE;
	hgDisplay = disp;

	if (!hgIsEGAVGA() || (hgIsEGA() && disp != hgEGA640x350x16 && disp != hgEGA640x200x16)) {
		printf("\nError: incorrect video setting occured.\n");
		printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
		exit(1);
	}

	switch (disp) {
		case hgVGA640x480x16 :
			hgSetRealWindow(0, 0, 639, 479);
			hgSetMaxPages(4);
			break;
		case hgVGA800x600x16 :
			hgSetRealWindow(0, 0, 799, 599);
			hgSetMaxPages(4);
			break;
		case hgEGA640x350x16 :
			hgSetRealWindow(0, 0, 639, 349);
			hgSetMaxPages(4);
			break;
		case hgEGA640x200x16 :
			hgSetRealWindow(0, 0, 639, 199);
			hgSetMaxPages(4);
			break;
	}

	xbyte = (hgx2r + 1) / 8;
	hgColors = 16;
	hgEnableClearScreen(&vga_cls);
}

void     hgAutoSetDisplay()
{
	if (hgGetTextMode() != hgMonoText) {
		if (!hgIsEGAVGA()) {
			printf("\nNurie Library 1.5 doesn't support this video card.\n");
			printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
			exit(1);
		}

		if (hgIsVGA()) hgSetDisplay(hgVGA640x480x16);
		else hgSetDisplay(hgEGA640x350x16);
	}
	else hgSetDisplay(hgHERC640x400);
}

void     hgSetMode(int mode)
{
	hgMode = mode;

	switch (mode) {
		case hgTEXT :
			if (_hgH) call_int10_0(7);
			else call_int10_0(3);
			break;
		case hgGRAPHICS :
			if (_hgH) hgSetHercMode();
			else hgSetColorMode();
			break;
	}
}

void     call_int10_0(int mode)
{
	union  REGS  r;

	if (mode == -1 || mode == 0) {
		printf("\nError: can't set video mode.\n");
		printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
		exit(1);
	}

	r.h.ah = 0;
	r.h.al = mode;

	int86(0x10, &r, &r);
}

void     hgSetHercMode()
{
	if (hgGetTextMode() != hgMonoText) {
		printf("\nError: incorrect video setting occured.\n");
		printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
		exit(1);
	}

	if (hgDisplay == hgHERC720x348) hgSetHerc720();
	else hgSetHerc640();
}

void     hgSetColorMode()
{
	call_int10_0(ModeSet[hgDisplay]);
}

void     hgSetHerc720()
{
	char  data[8] = {
		0x35, 0x2d, 0x2e, 0x07, 0x5b, 0x02, 0x57, 0x57
	};
	int   i;

	outportb(0x3b8, 0);			/* DMC reg. port address */

	for (i = 0;i < 8;i++) {
		outportb(0x3b4, i);		/* CRTC 6845 Index reg. port address */
		outportb(0x3b5, data[i]);	/* CRTC 6845 Data reg. port address */
	}
	outportb(0x3b4, 9);
	outportb(0x3b5, 3);

	outportb(0x3bf, 3);			/* Configuration Switch reg. address */
	outportb(0x3b8, 0x0a);			/* video enable */

	hgc_cls();
}

void     hgSetHerc640()
{
	char  data[8] = {
		0x31, 0x28, 0x29, 0x08, 0x68, 0x02, 0x64, 0x65
	};
	int   i;

	outportb(0x3b8, 0);			/* DMC reg. port address */

	for (i = 0;i < 8;i++) {
		outportb(0x3b4, i);		/* CRTC 6845 Index reg. port address */
		outportb(0x3b5, data[i]);	/* CRTC 6845 Data reg. port address */
	}
	outportb(0x3b4, 9);
	outportb(0x3b5, 3);

	outportb(0x3bf, 3);			/* Configuration Switch reg. address */
	outportb(0x3b8, 0x1e);

	hgc_cls();
}

void     hgSetRealWindow(int x1, int y1, int x2, int y2)
{
	hgx1r = x1;
	hgx2r = x2;
	hgy1r = y1;
	hgy2r = y2;
}

int      hgGetx1r()
{
	return(hgx1r);
}

int      hgGety1r()
{
	return(hgy1r);
}

int      hgGetx2r()
{
	return(hgx2r);
}

int      hgGety2r()
{
	return(hgy2r);
}

int      hgGetMode()
{
	return(hgMode);
}

int      hgGetDisplay()
{
	return(hgDisplay);
}

void     hgSetTFcolor(char color)
{
	hgTF = color;
}

void     hgSetTBcolor(char color)
{
	hgTB = color;
}

char     hgGetTFcolor()
{
	return(hgTF);
}

char     hgGetTBcolor()
{
	return(hgTB);
}

int      hgGetMaxColors()
{
	return(hgColors);
}
