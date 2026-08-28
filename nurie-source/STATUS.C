/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : status.c  -- ¬wÈ œa·¥ ¡¡—I                   |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <dos.h>
#include    <string.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     HANMODE     1		/* Ðe/µw ¸åÑÅ¯¡ */
#define     ENGMODE     0

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     second = 0xff;			/* ¯¡‰· Á¡ˆt */
int      minute = -1;
extern   long     connecttime;

int      stx1, sty1, stx2, sty2;	/* ¬wÈ œa·¥ ¹ÁÎa */
int      stxx1, styy1, stxx2, styy2;

extern   char     mode;
extern   char     HANMETHOD;

extern   char     edMode;

extern   char     connectflag;
extern   char     echoflag;
extern   char     capflag;
extern   char     debugflag;

extern   char     tabstr[];

extern   char     ins_flag;
extern   char     indentflag;
extern   char     savedflag;

extern   unsigned Basey, Basex;
extern   unsigned Curx, Cury;
extern   char     work_file[];

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     comDisplayStatus(int x1, int y1, int x2, int y2);
void     edDisplayStatus(int x1, int y1, int x2, int y2);
void     comSetChatStatus(int x1, int y1, int x2, int y2);
void     comDisplayChatStatus();

void     inmethod_status();
void     connect_status();
void     hosthan_status();
void     echo_status();
void     modem_status();
void     capture_status();
void     debug_status();
void     tab_status();

void     rowcol_status();
void     ins_status();
void     indent_status();
void     saved_status();
void     workfile_status();
void     time_status();

char    *split_name(char *fname);

int      statuskey();


void     comDisplayStatus(int x1, int y1, int x2, int y2)
{
	int   i;

	stx1 = x1;
	sty1 = y1;
	stx2 = x2;
	sty2 = y2;
	minute = -1;

	hgHideMouse();

	putmark(stx1, sty1);

	hgBoxFill(stx1 + 16, sty1, stx2, sty2, LIGHTGRAY);
	hgVline(stx1 + 95, sty1, sty2, BLACK);
	hgVline(stx1 + 96, sty1, sty2, WHITE);
	hgVline(stx1 + 183, sty1, sty2, BLACK);
	hgVline(stx1 + 184, sty1, sty2, WHITE);
	hgVline(stx1 + 287, sty1, sty2, BLACK);
	hgVline(stx1 + 288, sty1, sty2, WHITE);
	hgVline(stx1 + 431, sty1, sty2, BLACK);
	hgVline(stx1 + 432, sty1, sty2, WHITE);
	hgVline(stx1 + 527, sty1, sty2, BLACK);
	hgVline(stx1 + 528, sty1, sty2, WHITE);
	hgVline(stx1 + 559, sty1, sty2, BLACK);
	hgVline(stx1 + 560, sty1, sty2, WHITE);

	for (i = 0;i < 2;i++) {
		hgHline(stx1 + 16 + i, stx2 - i, sty1 + i, WHITE);
		hgVline(stx1 + 16 + i, sty1 + i, sty2 - i, WHITE);
		hgHline(stx1 + 16 + i, stx2 - i, sty2 - i, BLACK);
		hgVline(stx2 - i, sty1 + i, sty2 - i, BLACK);
	}

	hgShowMouse();

	hgSetToggInternal(&inmethod_status);
	hgSetClock(&time_status);

	inmethod_status();
	connect_status();
	hosthan_status();
	echo_status();
	modem_status();
	capture_status();
	debug_status();
}

void     edDisplayStatus(int x1, int y1, int x2, int y2)
{
	int   i;

	stx1 = x1;
	sty1 = y1;
	stx2 = x2;
	sty2 = y2;

	hgHideMouse();

	putmark(stx1, sty1);

	hgBoxFill(stx1 + 16, sty1, stx2, sty2, LIGHTGRAY);
	hgVline(stx1 + 95, sty1, sty2, BLACK);
	hgVline(stx1 + 96, sty1, sty2, WHITE);
	hgVline(stx1 + 223, sty1, sty2, BLACK);
	hgVline(stx1 + 224, sty1, sty2, WHITE);
	hgVline(stx1 + 271, sty1, sty2, BLACK);
	hgVline(stx1 + 272, sty1, sty2, WHITE);
	hgVline(stx1 + 351, sty1, sty2, BLACK);
	hgVline(stx1 + 352, sty1, sty2, WHITE);
	hgVline(stx1 + 559, sty1, sty2, BLACK);
	hgVline(stx1 + 560, sty1, sty2, WHITE);

	for (i = 0;i < 2;i++) {
		hgHline(stx1 + 16 + i, stx2 - i, sty1 + i, WHITE);
		hgVline(stx1 + 16 + i, sty1 + i, sty2 - i, WHITE);
		hgHline(stx1 + 16 + i, stx2 - i, sty2 - i, BLACK);
		hgVline(stx2 - i, sty1 + i, sty2 - i, BLACK);
	}

	hgShowMouse();

	inmethod_status();
	rowcol_status();
	ins_status();
	indent_status();
	saved_status();
	workfile_status();
}

void     comSetChatStatus(int x1, int y1, int x2, int y2)
{
	stxx1 = x1;
	styy1 = y1;
	stxx2 = x2;
	styy2 = y2;
}

void     comDisplayChatStatus()
{
	int   i;

	hgHideMouse();

	hgBoxFill(stxx1, styy1, stxx2, styy1 + 63, BLACK);

	putmark(stxx1, styy1);

	hgBoxFill(stxx1 + 16, styy1, stxx2, styy2, LIGHTGRAY);
	hgVline(stxx1 + 279, styy1, styy2, BLACK);
	hgVline(stxx1 + 280, styy1, styy2, WHITE);

	for (i = 0;i < 2;i++) {
		hgHline(stxx1 + 16 + i, stxx2 - i, styy1 + i, WHITE);
		hgVline(stxx1 + 16 + i, styy1 + i, styy2 - i, WHITE);
		hgHline(stxx1 + 16 + i, stxx2 - i, styy2 - i, BLACK);
		hgVline(stxx2 - i, styy1 + i, styy2 - i, BLACK);
	}

	hgFBTextXy(stxx1 + 24, styy1 + 2, "ÙLF3ÙMÙLF4ÙM‹aŸ±¢…¸a ÙLF9ÙMÐe¢…", BLACK, LIGHTGRAY);

	hgShowMouse();

	tab_status();
}

void     inmethod_status()
{
	hgHideMouse();

	if (mode == HANMODE)
		hgFBTextXy(stx1 + 24, sty1 + 2, "<Ðe‹i>  ", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 24, sty1 + 2, "<µw¢…>  ", BLACK, LIGHTGRAY);
	if (HANMETHOD == hgHAN2)
		hgFBTextXy(stx1 + 72, sty1 + 2, "-2", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 72, sty1 + 2, "-3", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     connect_status()
{
	char   tmline[7] = { "00:00\0" };
	int    min, hour;
	int    temp;
	int    mx, my;

	if (connectflag) {
		temp = (int)(connecttime / 60);
		hour = temp / 60;
		min = temp % 60;
		if (min != minute) {
			minute = min;
			tmline[0] = (byte)(hour / 10) + 0x30;
			tmline[1] = (byte)(hour % 10) + 0x30;
			tmline[3] = (byte)(min / 10) + 0x30;
			tmline[4] = (byte)(min % 10) + 0x30;

			hgGetMousePos(&mx, &my);
			if (my >= sty1 - 10 && my <= sty2 && mx >= stx1 + 104 && mx <= stx1 + 175) {
				hgHideMouse();
				hgFBTextXy(stx1 + 104, sty1 + 2, "µe‰i", BLACK, LIGHTGRAY);
				hgFBTextXy(stx1 + 136, sty1 + 2, tmline, BLACK, LIGHTGRAY);
				hgShowMouse();
			}
			else {
				hgFBTextXy(stx1 + 104, sty1 + 2, "µe‰i", BLACK, LIGHTGRAY);
				hgFBTextXy(stx1 + 136, sty1 + 2, tmline, BLACK, LIGHTGRAY);
			}
		}
	}
	else {
		minute = -1;

		hgHideMouse();
		hgFBTextXy(stx1 + 104, sty1 + 2, "F1-•¡¶‘ i", BLACK, LIGHTGRAY);
		hgShowMouse();
	}
}

void     hosthan_status()
{
	char   *text[] = {
		"¬w¶w   ¹¡Ðs",
		"¬q¬÷   ¹¡Ðs",
		"‹q¬÷   ¹¡Ðs",
		"•¡Œ§¡ ¹¡Ðs",
		"µ• KS  ¹¡Ðs",
		"7 §¡Ëa µÅ¬÷",
		"KS5601 µÅ¬÷"
	};

	hgHideMouse();

	hgFBTextXy(stx1 + 192, sty1 + 2, text[hgSrcCode() - 1], BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     echo_status()
{
	hgHideMouse();

	if (echoflag) hgFBTextXy(stx1 + 296, sty1 + 2, "Ù¿", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 296, sty1 + 2, "  ", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     modem_status()
{
	char   mline[15];

	hgHideMouse();

	comGetModemState(mline);
	hgFBTextXy(stx1 + 312, sty1 + 2, mline, BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     capture_status()
{
	hgHideMouse();

	if (capflag) hgFBTextXy(stx1 + 440, sty1 + 2, "ˆi¢Ÿ¡¯¡¸b", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 440, sty1 + 2, "ˆi¢Ÿ¡ { ", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     debug_status()
{
	hgHideMouse();

	if (debugflag) hgFBTextXy(stx1 + 536, sty1 + 2, "ÚT", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 536, sty1 + 2, "Û]", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     tab_status()
{
	hgHideMouse();

	hgFBTextXy(stxx1 + 288, styy1 + 2, "”õ i ¶w: ", BLACK, LIGHTGRAY);
	hgFBTextXy(stxx1 + 376, styy1 + 2, "                              ", BLACK, LIGHTGRAY);
	hgFBTextXy(stxx1 + 376, styy1 + 2, tabstr, BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     rowcol_status()
{
	char   rcline[15];
	int    mx, my;

	sprintf(rcline, "%5uµi%5uÐ—", Basex + Curx + 1, Basey + Cury + 1);

	hgGetMousePos(&mx, &my);
	if (my >= sty1 - 10 && my <= sty2 && mx >= stx1 + 96 && mx <= stx1 + 215) {
		hgHideMouse();
		hgFBTextXy(stx1 + 104, sty1 + 2, rcline, BLACK, LIGHTGRAY);
		hgShowMouse();
	}
	else hgFBTextXy(stx1 + 104, sty1 + 2, rcline, BLACK, LIGHTGRAY);
}

void     ins_status()
{
	hgHideMouse();

	if (ins_flag) hgFBTextXy(stx1 + 232, sty1 + 2, "¬s·³", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 232, sty1 + 2, "®¸÷", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     indent_status()
{
	hgHideMouse();

	if (indentflag) hgFBTextXy(stx1 + 280, sty1 + 2, "—iµa³a‹¡", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 280, sty1 + 2, "        ", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     saved_status()
{
	hgHideMouse();

	if (savedflag) hgFBTextXy(stx1 + 360, sty1 + 2, "  ", BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 360, sty1 + 2, "Ùh", BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     workfile_status()
{
	hgHideMouse();

	hgFBTextXy(stx1 + 384, sty1 + 2, "                     ", BLACK, LIGHTGRAY);
	if (strlen(work_file) > 21)
		hgFBTextXy(stx1 + 384, sty1 + 2, split_name(work_file), BLACK, LIGHTGRAY);
	else hgFBTextXy(stx1 + 384, sty1 + 2, work_file, BLACK, LIGHTGRAY);

	hgShowMouse();
}

void     time_status()
{
	struct time  ttm;

	char   tmline[10] = { "00:00:00\0" };
	int    mx, my;

	gettime(&ttm);
	if (ttm.ti_sec != second) {
		second = ttm.ti_sec;
		tmline[0] = (ttm.ti_hour / 10) + 0x30;
		tmline[1] = (ttm.ti_hour % 10) + 0x30;
		tmline[3] = (ttm.ti_min / 10) + 0x30;
		tmline[4] = (ttm.ti_min % 10) + 0x30;
		tmline[6] = (ttm.ti_sec / 10) + 0x30;
		tmline[7] = (ttm.ti_sec % 10) + 0x30;

		hgGetMousePos(&mx, &my);
		if (my >= sty1 - 10 && my <= sty2 && mx >= stx1 + 560 && mx <= stx1 + 631) {
			hgHideMouse();
			hgFBTextXy(stx1 + 568, sty1 + 2, tmline, BLACK, LIGHTGRAY);
			hgShowMouse();
		}
		else hgFBTextXy(stx1 + 568, sty1 + 2, tmline, BLACK, LIGHTGRAY);
	}
}

char    *split_name(char *fname)
{
	int   len;

	if (*fname) {
		len = strlen(fname) - 1;
		while (len >= 0 && *(fname + len) != '\\' && *(fname + len) != ':') len--;

		return(fname + len + 1);
	}

	return(NULL);
}

int      statuskey()
{
	int   mx, my;
	int   key = NOKEY;

	hgGetMousePos(&mx, &my);
	if (my > sty1 && my < sty2) {
		if (mx > stx1 && mx < stx1 + 16) {
			hgHideMouse();
			putmend(stx1, sty1);
			hgShowMouse();
			while (hgLeftMouse());
			hgHideMouse();
			putmark(stx1, sty1);
			hgShowMouse();
			return(LEFTMARK);
		}
		if (mx > stx1 + 32 && mx < stx1 + 64) key = SHIFT_SPC;
		if (mx > stx1 + 80 && mx < stx1 + 88) key = F6;
		if (!edMode) {
			if (mx > stx1 + 104 && mx < stx1 + 176)
				if (!connectflag) key = F1;
			if (mx > stx1 + 192 && mx < stx1 + 280) key = ALT_9;
			if (mx > stx1 + 296 && mx < stx1 + 312) key = ALT_R;
			if (mx > stx1 + 312 && mx < stx1 + 320) key = ALT_1;
			if (mx > stx1 + 328 && mx < stx1 + 376) key = ALT_2;
			if (mx > stx1 + 384 && mx < stx1 + 392) key = ALT_3;
			if (mx > stx1 + 400 && mx < stx1 + 408) key = ALT_4;
			if (mx > stx1 + 416 && mx < stx1 + 424) key = ALT_5;
			if (mx > stx1 + 440 && mx < stx1 + 520) key = ALT_L;
			if (mx > stx1 + 536 && mx < stx1 + 552) key = CTRL_F10;
		}
		else {
			if (mx > stx1 + 232 && mx < stx1 + 264) key = INS;
			if (mx > stx1 + 280 && mx < stx1 + 344) edindent_toggle();
			if (mx > stx1 + 360 && mx < stx1 + 376)
				if (!savedflag) key = ALT_S;
			if (mx > stx1 + 384 && mx < stx1 + 552) key = ALT_O;
		}

		while (hgLeftMouse());
		return(key);
	}
	else if (comIsChatting() && my > styy1 && my < styy2) {
		if (mx > stxx1 && mx < stxx1 + 16) {
			hgHideMouse();
			putmend(stxx1, styy1);
			hgShowMouse();
			while (hgLeftMouse());
			hgHideMouse();
			putmark(stxx1, styy1);
			hgShowMouse();
			return(ALT_C);
		}
		if (mx > stxx1 + 24 && mx < stxx1 + 72) key = F3;
		if (mx > stxx1 + 72 && mx < stxx1 + 120) key = F4;
		if (mx > stxx1 + 192 && mx < stxx1 + 240) key = F9;
		if (mx > stxx1 + 288 && mx < stxx1 + 368) key = ALT_T;

		while (hgLeftMouse());
		return(key);
	}

	return(NOKEY);
}
