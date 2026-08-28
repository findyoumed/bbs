/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : crtout.c  -- É·¯¥¬å¬w· Ðe‹i ·³Â‰b ¡¡—I      |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <bios.h>
#include    <ctype.h>
#include    <dos.h>
#include    <string.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "comdef.h"			/* É·¯¥ ¬w®· ¸÷· */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     ENG_MODE     0
#define     ESC_MODE     1
#define     CSI_MODE     2

#define     MAXCOMKEY    6		/* ÂA” ‹¡“wÇ¡· ˆ•® */

#define     MAXESCOPT   10
#define     MAXCSIOPT   20
#define     MAXNUMOPT    5

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char    *C0[] = {			/* C0 µwµb ¹A´á ¢…¸a */
	"<NUL>", "<SOH>", "<STX>", "<ETX>", "<EOT>", "<ENQ>", "<ACK>",
	"<BEL>", "<B-S>", "<TAB>", "\012<L/F>", "<V/T>", "<F/F>", "<C/R>\r",
	"<S-O>", "<S-I>", "<DLE>", "<XON>", "<DC2>", "<XOF>", "<DC4>",
	"<NAK>", "<SYN>", "<ETB>", "<CAN>", "<E-M>", "<SUB>", "<ESC>",
	"<F-S>", "<G-S>", "<R-S>", "<U-S>"
};

char    *C1[] = {			/* C1 µwµb ¹A´á ¢…¸a */
	"< - >", "< - >", "<BPH>", "<NBH>", "<IND>", "<NEL>", "<SSA>",
	"<ESA>", "<HTS>", "<HTJ>", "<VTS>", "<PLD>", "<PLU>", "<R-I>",
	"<SS2>", "<SS3>", "<DCS>", "<PU1>", "<PU2>", "<STS>", "<CCH>",
	"<M-W>", "<SPA>", "<EPA>", "<SOS>", "< - >", "<SCI>", "<CSI>",
	"<S-T>", "<OSI>", "<P-M>", "<APC>"
};

char     queue[10];			/* ZMODEM auto invoking with DSZ.COM */

byte     comBuff[3] = { 0, 0, 0 };	/* É·¯¥¬å¬w· ·³b ¢…¸a¶w ¡A¡¡Ÿ¡ */
byte     hancode[3];			/* ·³b Å¡—a ¥eÑÅ */
int      hpos;
char     screen[30][80];		/* Ðe ÑÁ¡e¦…· ¯aÇaŸ¥ ¤áÌá */

			/* ˆb¹· É·¯¥¬å¬w· ¸åµb ¥e® */
int      curx, cury;
int      comx1, comy1, comx2, comy2;
int      scrolly1, scrolly2;
int      savex, savey;
int      gx, gy;
int      comrow, comcol;
char     comFORE, comBACK;
char     comTF, comTB;
char     bright = hgTRUE;
char     eattr, hattr;
char     comWMODE;
int      comFAC;

			/* ´e¯¡ Å¡—a ¦…¬â‹¡ */
char     scr_mode = ENG_MODE;
char     isoption = hgFALSE;
char     scr_opt[MAXCSIOPT];
int      num[MAXNUMOPT];
int      str_pos = 0;

extern   int      mode;

char     ansiflag = hgFALSE;		/* ‹aŸ± ¬wÈ µa¦ */
char     specialflag = hgFALSE;		/* Ëb¸÷ ”ÑÁ·¥·i Àx´v·i ˜ */
extern   char     capflag;
extern   char     debugflag;
extern   char     echoflag;
extern   char     hanjaflag;
extern   char     lineflag;
extern   char     sflag;

extern   int      base;
extern   int      terminal;
extern   FILE     *cap;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreToggleAnsi();		/* ‹aŸ± ¬wÈ  @N */
void     nreSetInitCSI();		/* ¸÷Ÿ¡ Ða‹¡ ^F8 */

void     comSetInit();
void     comclear_buff();
void     comclear_code();

void     combs_process();
void     comdel_process();
void     comhan2eng_process();
void     comgtype_process();
void     comgraphin_process();
void     comhanjain_process();
void     comeng_process(int key);
void     comhan_process(int key);
int      comKeyProcess(int key);

void     comcomplete_han();

void     comOutScreen(byte ch);
void     comengout(char ch);
void     comhanout(char *h);

int      read_option(char *opt1, char *opt2);
void     ESC_process();
void     CSI_process();
void     comESCOption(char ch);
void     comCSIOption(char ch);

void     comSetCursorPos(int x, int y);
void     comAdjustCursorPos(int dx, int dy);
void     comGetCursorPos(int *x, int *y);
void     comSaveCursorPos();
void     comRestoreCursorPos();
void     comCursorType(int n);

void     comScrUp();
void     comClearAll();
void     comClearAbove();
void     comClearBelow();
void     comClearLine();
void     comClearBOL();
void     comClearEOL();
void     comInsertChar(int n);
void     comBackDeleteChar(int n);
void     comDeleteChar(int n);
void     comInsertLine(int n);
void     comDeleteLine(int n);

void     comSetGraphCenter(int x, int y);
void     comGetGraphCenter(int *x, int *y);
void     comPlotXy(int x, int y, char color);
void     comLineO(int option, int size);
void     comLine(int x, int y, char color);
void     comBoxG(int xsize, int ysize);
void     comBox(int xsize, int ysize, char color);
void     comBoxFill(int xsize, int ysize, char color);
void     comCircle(int xsize, int ysize, char color);

void     comSetForeColor(char color);
void     comSetBackColor(char color);
void     comSetFore(int n);
void     comSetBack(int n);
void     comAdjustFore(char bright);
char     comGetForeColor();
char     comGetBackColor();

void     comRestoreScreen();
void     comFBTextXy(int x, int y, char *str);
int      comCursor();
void     comClearScreen();


int      comKeys[MAXCOMKEY] = {
	BS, DEL, SHIFT_SPC, F3, F4, F9
};

void   (*comKeyfunc[MAXCOMKEY])() = {
	combs_process, comdel_process, comhan2eng_process,
	comgtype_process, comgraphin_process, comhanjain_process
};


void     nreToggleAnsi()
{
	ansiflag = 1 - ansiflag;

	hgSetSaveOn();
	if (ansiflag) hgDisplayMessage(" ‹aŸ± ˆa“w ¬wÈ·³“¡”a. ", MAGENTA);
	else hgDisplayMessage(" ¥¡É· ¬wÈ·³“¡”a. ", MAGENTA);
	delay(1000);
	hgRestore();
	hgSetSaveOff();
}

void     nreSetInitCSI()
{
	bright = hgFALSE;
	comTF = comFORE;
	comTB = comBACK;
	eattr = hattr = NORMAL;

	comFAC = 1;
	comWMODE = UPDOWN;

	scrolly1 = 0;
	scrolly2 = comrow;

	hgSetCursorType(1);
}

void     comSetInit()
{
	comTF = comFORE;
	comTB = comBACK;
	eattr = hattr = NORMAL;

	comFAC = 1;
	comWMODE = UPDOWN;

	curx = 0;
	cury = 6;
	comx1 = hgGetx1r() + (7 - (hgGetx1r() + 7) % 8);
	comy1 = hgGety1r() + (15 - (hgGety1r() + 15) % 16);
	comx2 = hgGetx2r() - (hgGetx2r() + 1) % 8;
	comy2 = hgGety2r() - (hgGety2r() + 1) % 16;
	comcol = ((comx2 - comx1) >> 3) + 1;
	comrow = ((comy2 - comy1) >> 4) + 1;
	scrolly1 = 0;
	scrolly2 = comrow;

	init_code();
	comclear_buff();
	comclear_code();
}

void     comclear_buff()
{
	comBuff[0] = comBuff[1] = comBuff[2] = 0;
}

void     comclear_code()
{
	hancode[0] = hancode[1] = hancode[2] = hpos = 0;
}

void     combs_process()
{
	int    tch;
	char   temp[3] = { 0, 0, 0 };

	tch = back_process();

	if (tch == BS) comDataOut(BS);	/* µw¢…, µÅ¬÷–E Ðe‹i ¬b¹A¯¡ */
	else if (tch == DEL) {
		temp[0] = SPACE;
		temp[1] = SPACE;

		hgHideMouse();
		comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), temp);
		hgShowMouse();

		comclear_buff();
	}
	else {				/* Ðe‹i· ·q­¡ ¬b¹A¯¡ */
		tch = temp_combine();
		comBuff[0] = (tch >> 8);
		comBuff[1] = tch;

		hgHideMouse();
		comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), comBuff);
		hgShowMouse();
	}
}

void     comdel_process()
{
	int    ch;
	char   temp[3] = { 0, 0, 0 };

	if (!is_complete()) {
		init_code();
		temp[0] = SPACE;
		temp[1] = SPACE;

		hgHideMouse();
		comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), temp);
		hgShowMouse();
	}

	comclear_buff();
}

void     comhan2eng_process()
{
	mode = 1 - mode;

	if (!is_complete()) comcomplete_han();

	toggle_sound();
	han2eng_internal();
}

void     comgtype_process()
{
	if (!is_complete()) comcomplete_han();

	hgGraphCharType();
}

void     comgraphin_process()
{
	int   ch;

	if (!is_complete()) comcomplete_han();

	if (!hgGraphCharIn(&ch)) return;

	comBuff[0] = (ch >> 8);
	comBuff[1] = ch;
	hgCodeConvStr(SANGYONG, hgSrcCode(), comBuff);
	comDataOut(comBuff[0]);
	comDataOut(comBuff[1]);
	if (echoflag) {
		comDataToBuffer(comBuff[0]);
		comDataToBuffer(comBuff[1]);
	}

	comclear_buff();
}

void     comhanjain_process()
{
	int    ch;
	char   temp[3] = { 0, 0, 0 };

	if (!is_complete()) {
		init_code();
		temp[0] = SPACE;
		temp[1] = SPACE;

		hgHideMouse();
		comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), temp);
		hgShowMouse();
	}

	if (!is_han(comBuff)) return;

	ch = (comBuff[0] << 8) + comBuff[1];
	hgHanjaIn(&ch);
	comBuff[0] = (ch >> 8);
	comBuff[1] = ch;
	hgCodeConvStr(SANGYONG, hgSrcCode(), comBuff);
	comDataOut(comBuff[0]);
	comDataOut(comBuff[1]);
	if (echoflag) {
		comDataToBuffer(comBuff[0]);
		comDataToBuffer(comBuff[1]);
	}

	comclear_buff();
}

void     comeng_process(int key)
{
	if (!is_complete()) comcomplete_han();

	comDataOut((char)key);
	if (echoflag) {
		comDataToBuffer((char)key);
		if (key == RETURN) comDataToBuffer(LF);
	}
}

void    comhan_process(int key)
{
	int   ch, tch;

	ch = key;
	tch = hgCombine(&ch);

	if (tch) {
		comBuff[0] = (tch >> 8);
		comBuff[1] = tch;
		hgCodeConvStr(SANGYONG, hgSrcCode(), comBuff);
		comDataOut(comBuff[0]);
		comDataOut(comBuff[1]);
		if (echoflag) {
			comDataToBuffer(comBuff[0]);
			comDataToBuffer(comBuff[1]);
		}

		comclear_buff();
		comCrtOut(2);
	}

	comBuff[0] = (ch >> 8);
	comBuff[1] = ch;

	hgHideMouse();
	comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), comBuff);
	hgShowMouse();
}

int      comKeyProcess(int key)
{
	int   i;
	int   ret_flag = _NORMAL_KEYCODE;

	for (i = 0;i < MAXCOMKEY;i++)
		if (comKeys[i] == key) {
			(*comKeyfunc[i])();
			ret_flag = _SPECIAL_KEYCODE;
			break;
		}
	return(ret_flag);
}

void     comcomplete_han()
{
	char   temp[3] = { 0, 0, 0 };

	init_code();
	temp[0] = SPACE;
	temp[1] = SPACE;

	hgHideMouse();
	comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), temp);
	hgShowMouse();

	hgCodeConvStr(SANGYONG, hgSrcCode(), comBuff);
	comDataOut(comBuff[0]);
	comDataOut(comBuff[1]);
	if (echoflag) {
		comDataToBuffer(comBuff[0]);
		comDataToBuffer(comBuff[1]);
	}

	comclear_buff();
}

void     comOutScreen(byte ch)
{
	int   i;

	if (!hpos) {
		if (ch <= 94) comengout(ch);
		else if (ch < 128) {
			if (hgSrcCode() != SEWOON) comengout(ch);
			else hancode[hpos++] = ch;
		}
		else if (ch >= 128 && ch < 160) {
			if (debugflag) {
				if (capflag) fprintf(cap, "%s", C1[ch - 128]);

				if (curx >= comcol - 4) comAdjustCursorPos(-curx, 1);

				hgHideMouse();
				comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), C1[ch - 128]);
				hgShowMouse();

				for (i = 0;i < 4;i++)
					screen[cury][curx + i] = *(C1[ch - 128] + i);

				comAdjustCursorPos(strlen(C1[ch - 128]), 0);
			}
			else if (hgSrcCode() == KS5601 || hgSrcCode() == KSJOHAP) {
				if (capflag) fputc(ch, cap);

				switch (ch) {
					case 0x84 :	/* Index ‹¡“w */
						comAdjustCursorPos(0, 1);
						break;
					case 0x85 :	/* Next Line ‹¡“w */
						comAdjustCursorPos(-curx, 1);
						break;
					case 0x8d :	/* Reverse Index ‹¡“w */
						comAdjustCursorPos(0, -1);
						break;
					case 0x9b :	/* Control Sequence ‹¡“w */
						isoption = hgFALSE;
						str_pos = 0;
						scr_mode = CSI_MODE;
						break;
					default :
						break;
				}
			}
			else hancode[hpos++] = ch;
		}
		else hancode[hpos++] = ch;
	}
	else {
		hancode[hpos] = ch;
		hgCodeConvStr(hgSrcCode(), SANGYONG, hancode);
		if (hanjaflag) hgHanjaToHangulStr(hancode);
		comhanout(hancode);
		comclear_code();
	}

		    /* ZMODEM auto invoking with DSZ.COM */
	queue[0] = queue[1];
	queue[1] = queue[2];
	queue[2] = queue[3];
	queue[3] = queue[4];
	queue[4] = queue[5];
	queue[5] = ch;

	if (queue[0] == '*' && queue[1] == '*' && queue[2] == 0x18) {
		if (queue[5] == '0') DSZ(7);
		else {                        /* •A·¡Èa ®¯¥¯¡ ·¥ÈáœóËa ¤i¬—´e–A‰A */
			outport(IER - base, 0x00);
			DSZ(3);
			outport(IER - base, 0x01);
		}
	}
}

void     comengout(char ch)
{
	char   temp[2];
	int    i;
	int    xx, yy;
	int    fac = 1;

	if (comFAC != 1 || comWMODE != UPDOWN) fac = 2;

	if ((ch & 0xff) < 32) {
		if (debugflag) {
			if (capflag) fprintf(cap, "%s", C0[ch]);

			if (curx >= comcol - 4) comAdjustCursorPos(-curx, 1);

			hgHideMouse();
			comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), C0[ch]);
			hgShowMouse();

			for (i = 0;i < 4;i++)
				screen[cury][curx + i] = *(C0[ch] + i);

			comAdjustCursorPos(strlen(C0[ch]), 0);
		}
		else {
			if (capflag) fputc(ch, cap);

			switch (ch) {
				case ESC :
					isoption = hgFALSE;
					str_pos = 0;
					scr_mode = ESC_MODE;
					break;
				case 7 :		/* bell */
					beep();
					break;
				case BS :
					comAdjustCursorPos(-1, 0);
					break;
				case TAB :
					xx = ((curx - 1) / 8) * 8 + 9;
					comAdjustCursorPos(xx - curx, 0);
					break;
				case LF :
					if (!sflag) comAdjustCursorPos(0, 1);
					break;
				case 11 :		/* vertical tab */
					comAdjustCursorPos(0, -1);
					break;
				case 12 :		/* form feed */
					comClearAll();
					break;
				case RETURN :
					if (!sflag) comAdjustCursorPos(-curx, 0);
					if (lineflag) {
						if (!sflag) comAdjustCursorPos(0, 1);
						if (capflag) fputc(LF, cap);
					}
					break;
				default :
					break;
			}
		}
	}
	else {
		if (capflag) fputc(ch, cap);

		if (scr_mode == CSI_MODE) {
			comCSIOption(ch);
			if (isoption) CSI_process();
		}
		else if (scr_mode == ESC_MODE) {
			comESCOption(ch);
			if (isoption) ESC_process();
		}
		else if (ch == '@' && ansiflag) {
			isoption = hgFALSE;
			str_pos = 0;
			scr_mode = ESC_MODE;
		}
		else {
			if (curx + 1 * fac <= comcol) {
				temp[0] = ch;
				temp[1] = 0;

				hgHideMouse();
				comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), temp);
				hgShowMouse();

				screen[cury][curx] = ch;
			}

			comAdjustCursorPos(1, 0);
		}
	}
}

void     comhanout(char *h)
{
	int   i;
	int   fac = 1;

	if (comFAC != 1 || comWMODE != UPDOWN) fac = 2;

	if (capflag) {
		fputc(*h, cap);
		fputc(*(h + 1), cap);
	}

	if (curx + 2 * fac <= comcol) {
		hgHideMouse();
		comFBTextXy(comx1 + (curx << 3), comy1 + (cury << 4), h);
		hgShowMouse();

		screen[cury][curx] = *h;
		screen[cury][curx + 1] = *(h + 1);
	}

	comAdjustCursorPos(2, 0);
}

int      read_option(char *opt1, char *opt2)
{
	char   opt[5] = {
		'=', '?', '>', 's', 'u'
	};
	char   ch;
	int    i, j = 0;
	int    n;

	ch = scr_opt[j];

	for (i = 0;i < 5;i++)
		if (ch == opt[i]) break;
	if (i < 5) *opt1 = scr_opt[j++];
	else *opt1 = 0;

	if (j >= str_pos) {
		*opt2 = 0;
		return(0);
	}

	for (i = 0;i < MAXNUMOPT;i++) {
		n = 0;
		do {
			n *= 10;
			ch = scr_opt[j++];
			if (isdigit(ch)) n += (ch - 48);
		} while (ch >= 48 && ch <= 57);

		num[i] = n / 10;
		if (ch != ';' && j >= str_pos) break;
	}

	*opt2 = ch;
	return(i + 1);
}

void     ESC_process()
{
	char   *opt[25] = {
		"$)1", "(2", "#3", "#4", "#5", "#6", "7", "8",
		"A", "C", "D", "E", "G", "J", "K", "M",
		"W", "c", "s_", "s-", "sI", "si", "sL", "sl",
		"sR"
	};
	char   opt1, opt2;
	int    i, n;

	for (i = 0;i < 25;i++)
		if (!strcmp(opt[i], scr_opt)) break;

	switch (i) {
		case 0 :		/* ¸aÌe·i Ðe‹i ·³b ¬wÈ¡ ¬é¸÷ */
			if (terminal == VT200) hgEngInModeOff();
			break;
		case 1 :		/* ¸aÌe·i µw¢… ¸å¶w ·³b ¬wÈ¡ ¬é¸÷ */
			if (terminal == VT200) hgEngInModeOn();
			break;
		case 2 :		/* ˆa¡, ­A¡ 2¤ ÑÂ” ¢…¸a· ¶á½¢ ¤e */
			if (terminal == VT200) {
				comFAC = 1;
				comWMODE = UPHALF;
			}
			break;
		case 3 :		/* ˆa¡, ­A¡ 2¤ ÑÂ” ¢…¸a· ´aœ½¢ ¤e */
			if (terminal == VT200) {
				comFAC = 1;
				comWMODE = DOWNHALF;
			}
			break;
		case 4 :		/* ÑÂ” ¢…¸aŸi Ð¹A */
			if (terminal == VT200) {
				comFAC = 1;
				comWMODE = UPDOWN;
			}
			break;
		case 5 :		/* ˆa¡ 2¤ ÑÂ” ¢…¸a */
			if (terminal == VT200) {
				comFAC = 2;
				comWMODE = UPDOWN;
			}
			break;
		case 6 :		/* Äá¬á ¶áÃ¡Ÿi ‹¡´â */
			if (terminal == VT200) comSaveCursorPos();
			break;
		case 7 :		/* ‹¡´âÐ –… Äá¬á· ¶áÃ¡¡ ·¡•· */
			if (terminal == VT200) comRestoreCursorPos();
			break;
		case 8 :		/* Äá¬áŸi Ðe º‰ µ©Ÿ¥”a.(Reverse Index) */
			if (terminal == FS220B) comAdjustCursorPos(0, -1);
			break;
		case 9 :		/* Äá¬áŸi Ðaa µ¡Ÿe½¢·a¡ ¶‘»¢·¥”a. */
			if (terminal == FS220B) comAdjustCursorPos(1, 0);
			break;
		case 10 :		/* Äá¬áŸi Ðe º‰ Ÿ¥”a.(Index) */
			if (terminal == VT200) comAdjustCursorPos(0, 1);
			break;
		case 11 :		/* Äá¬áŸi ”a·q º‰· Àá·q·a¡ ¶‘»¢·¥”a.(NEL) */
			if (terminal == VT200) comAdjustCursorPos(-curx, 1);
			break;
		case 12 :		/* Äá¬áŸi Ñe¸ º‰· {·a¡ ¶‘»¢·¥”a. */
			if (terminal == VT200) comSetCursorPos(comcol - 1, cury);
			break;
		case 13 :		/* Ñe¸ Äá¬á ´aœ ¦¦…·i »¡¶…”a. */
			if (terminal == FS220B) comClearBelow();
			break;
		case 14 :		/* Äá¬á ·¡Ò· º‰·i »¡¶…”a. */
			if (terminal == FS220B) comClearEOL();
			break;
		case 15 :		/* Äá¬áŸi Ðe º‰ µ©Ÿ¥”a.(Reverse Index) */
			if (terminal == VT200) comAdjustCursorPos(0, -1);
			break;
		case 16 :		/* ¸åÁA ÑÁ¡e·i »¡¶…”a. */
			if (terminal == FS220B) comClearAll();
			break;
		case 17 :		/* Èá£¡é·i Á¡‹¡ÑÁ */
			if (terminal == VT200) comSetupPort();
			break;
		case 18 :		/* £»º‰ ‹u‹¡ ¯¡¸b */
			eattr |= UNDER;
			hattr |= UNDER;
			break;
		case 19 :		/* £»º‰ ‹u‹¡ Ð¹A */
			eattr &= (!UNDER);
			hattr &= (!UNDER);
			break;
		case 20 :		/* ¤e¸å ¢…¸a ¯¡¸b */
			eattr |= REVERSE;
			hattr |= REVERSE;
			break;
		case 21 :		/* ¤e¸å ¢…¸a Ð¹A */
			eattr &= (!REVERSE);
			hattr &= (!REVERSE);
			break;
		case 22 :		/* ÑÅÐa‰A Ða‹¡ */
			bright = hgTRUE;
			comAdjustFore(bright);
			break;
		case 23 :		/* ÑÅÐa‰A Ða‹¡ Ð¹A */
			bright = hgFALSE;
			comAdjustFore(bright);
			break;
		case 24 :		/* ¡¡—e ­¢¬÷·i Ð¹A *
			eattr = NORMAL;
			hattr = NORMAL;
			bright = hgFALSE;
			comAdjustFore(bright);
			break;
		case 25 :		/* Äá¬á· ¶áÃ¡Ÿi ¥e‰wÐe”a. */
			if (terminal == FS220B) {
				n = read_option(&opt1, &opt2);
				if (opt1 == 0 && opt2 == 'f' && n == 2)
					comSetCursorPos(num[0] - 32, num[1] - 32);
			}
			break;
	}

	isoption = hgFALSE;
	str_pos = 0;
	scr_mode = ENG_MODE;
}

void     CSI_process()
{
	char   opt1, opt2;
	int    i, n;
	int    x1, x2, y1, y2;

	n = read_option(&opt1, &opt2);

	if (opt1 == '=') {
					/* ¢…¸a· ¬‚Œi »¡¸÷ */
		if (opt2 == 'F' && n == 1) comSetForeColor(num[0]);
		else if (opt2 == 'G' && n == 1) comSetBackColor(num[0]);
					/* ¤b¯aŸi ‹aŸ¡‰¡ ¬‚·a¡ À¶…”a. */
		else if (opt2 == 'b' && n == 2) comBoxFill(num[0], num[1], comTF);
		else if (opt2 == 'b' && n == 3) comBoxFill(num[0], num[1], num[2]);
	}
	else if (opt1 == '?') {
					/* ¸aÌe·i Ðe‹i ·³b ¬wÈ¡ ¬é¸÷ */
		if (opt2 == 'h' && n == 1) {
			if (num[0] == 85) hgEngInModeOff();
		}
					/* ¸aÌe·i µw¢… ¸å¶w ·³b ¬wÈ¡ ¬é¸÷ */
		else if (opt2 == 'l' && n == 1) {
			if (num[0] == 85) hgEngInModeOn();
		}
					/* ¤b¯aŸi ‹aŸ¡‰¡ ¬‚·a¡ À¶…”a. */
		else if (opt2 == 'b' && n == 2) comBoxFill(num[0], num[1], comTB);
	}
	else if (opt1 == '>') {
					/* ¤b¯aŸi ‹aŸ¥”a. */
		if (opt2 == 'b' && n == 2) comBox(num[0], num[1], comTB);
					/* ¶¥·i ‹aŸ¥”a. */
		else if (opt2 == 'c' && n == 2) comCircle(num[0], num[1], comTB);
					/* ¬å·i ‹aŸ¥”a. */
		else if ((opt2 == 'l' || opt2 == 'i') && n == 2)
			comLine(num[0] - 1, num[1] - 1, comTB);
	}
					/* Äá¬á ¶áÃ¡Ÿi ‹¡´â */
	else if (opt1 == 's') comSaveCursorPos();
					/* ‹¡´âÐ –… Äá¬á· ¶áÃ¡¡ ·¡•· */
	else if (opt1 == 'u') comRestoreCursorPos();
	else if (opt1 == 0) {
					/* Äá¬áŸi ¶á¡ */
		if (opt2 == 'A' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comAdjustCursorPos(0, -num[0]);
		}
					/* Äá¬áŸi ´aœ¡ */
		else if (opt2 == 'B' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comAdjustCursorPos(0, num[0]);
		}
					/* Äá¬áŸi µ¡Ÿe½¢·a¡ */
		else if (opt2 == 'C' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comAdjustCursorPos(num[0], 0);
		}
					/* Äá¬áŸi ¶E½¢·a¡ */
		else if (opt2 == 'D' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comAdjustCursorPos(-num[0], 0);
		}
		else if (opt2 == 'J' && n == 1) {

			switch (num[0]) {
				case 0 :/* Äá¬á ·¡Ò· º‰‰Á Äá¬á ´aœ ¦¦…·i »¡¶…”a. */
					comClearEOL();
					comClearBelow();
					break;
				case 1 :/* Äá¬á ´|· º‰‰Á Äá¬á ¶õ ¦¦…·i »¡¶…”a. */
					comClearAbove();
					comClearBOL();
					break;
				case 2 :/* ¸åÁA ÑÁ¡e·i »¡¶…”a. */
					comClearAll();
					comSetCursorPos(0, 0);
					break;
				default :
					break;
			}
		}
		else if (opt2 == 'K' && n == 1) {

			switch (num[0]) {
				case 0 :/* Äá¬á ·¡Ò· º‰·i »¡¶…”a. */
					comClearEOL();
					break;
				case 1 :/* º‰· Àá·q¦Èá Äá¬á ¶áÃ¡Œa»¡ »¡¶…”a. */
					comClearBOL();
					break;
				case 2 :/* Äá¬áˆa ·¶“e º‰·i »¡¶…”a. */
					comClearLine();
					break;
				default :
					break;
			}
		}
					/* Äá¬á ´aœ¡ º‰·i ¬s·³Ðe”a. */
		else if (opt2 == 'L' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comInsertLine(num[0]);
		}
					/* Äá¬á ¶áÃ¡µA¬á º‰·i ¬b¹AÐe”a. */
		else if (opt2 == 'M' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comDeleteLine(num[0]);
		}
					/* Äá¬á ¶áÃ¡µA¬á ¶E½¢ ¢…¸aŸi ¬b¹AÐe”a. */
		else if (opt2 == 'P' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comBackDeleteChar(num[0]);
		}
					/* Äá¬á ¶áÃ¡µA ‰·¤‚·i ¬s·³Ðe”a. */
		else if (opt2 == '@' && n == 1) {
			if (num[0] == 0) num[0] = 1;
			comInsertChar(num[0]);
		}
					/* Äá¬á ¶áÃ¡µA¬á µ¡Ÿe½¢ ¢…¸aŸi »¡¶…”a. */
		else if (opt2 == 'X' && n == 1) {
			if (terminal == VT200) {
				if (num[0] == 0) num[0] = 1;
				comDeleteChar(num[0]);
			}
		}
		else if (opt2 == 'h' && n == 1) {
			if (num[0] == 12) echoflag = hgFALSE;
			else if (num[0] == 20) lineflag = hgFALSE;
/*			else if (num[0] == 30) */
		}
		else if (opt2 == 'l' && n == 1) {
			if (num[0] == 12) echoflag = hgTRUE;
			else if (num[0] == 20) lineflag = hgTRUE;
/*			else if (num[0] == 30) */
		}
					/* ÉB¯aËa ¤b¯aŸi ‹aŸ¥”a. */
		else if (opt2 == 'G' && n == 2) comBoxG(num[0], num[1]);
					/* Äá¬á· ¶áÃ¡Ÿi ¥e‰wÐe”a. */
		else if (opt2 == 'H' || opt2 == 'f') {
			if (n == 1) {
				if (num[0] == 0) num[0] = 1;
				comSetCursorPos(0, num[0] - 1);
			}
			else if (n == 2) {
				if (num[0] == 0) num[0] = 1;
				if (num[1] == 0) num[1] = 1;
				comSetCursorPos(num[1] - 1, num[0] - 1);
			}
		}
					/* ÉB¯aËa ¬å·i ‹aŸ¥”a. */
		else if (opt2 == 'O' && n == 2) comLineO(num[0], num[1]);
					/* ¤b¯aŸi ‹aŸ¥”a. */
		else if (opt2 == 'b' && n == 2) comBox(num[0], num[1], comTF);
					/* ¶¥·i ‹aŸ¥”a. */
		else if (opt2 == 'c' && n == 2) comCircle(num[0], num[1], comTF);
					/* ‹aœÏ¢ º—¯±¸ñ·i »¡¸÷ */
		else if (opt2 == 'g' && n == 2) comSetGraphCenter(num[0] - 1, num[1] - 1);
					/* ¬å·i ‹aŸ¥”a. */
		else if ((opt2 == 'l' || opt2 == 'i') && n == 2)
			comLine(num[0] - 1, num[1] - 1, comTF);
		else if (opt2 == 'm') {	/* ¢…¸a· ­¢¬÷ˆt »¡¸÷ */
			for (i = 0;i < n;i++) {

				switch (num[i]) {
					case 0 :
						eattr = NORMAL;
						hattr = NORMAL;
						bright = hgFALSE;
						comSetForeColor(comFORE);
						comSetBackColor(comBACK);
						break;
					case 1 :
						bright = hgTRUE;
						comAdjustFore(bright);
						break;
					case 4 :
						eattr |= UNDER;
						hattr |= UNDER;
						break;
					case 7 :
						eattr |= REVERSE;
						hattr |= REVERSE;
						break;
					case 22 :
						bright = hgFALSE;
						comAdjustFore(bright);
						break;
					case 24 :
						eattr &= (!UNDER);
						hattr &= (!UNDER);
						break;
					case 27 :
						eattr &= (!REVERSE);
						hattr &= (!REVERSE);
						break;
					case 30 : case 31 : case 32 : case 33 :
					case 34 : case 35 : case 36 : case 37 :
						comSetFore(num[i] - 30);
						break;
					case 40 : case 41 : case 42 : case 43 :
					case 44 : case 45 : case 46 : case 47 :
						comSetBack(num[i] - 40);
						break;
					default :
						break;
				}
			}
		}
					/* ¸ñ·i ¿¢“e”a. */
		else if (opt2 == 'p' && n == 2) comPlotXy(num[0] - 1, num[1] - 1, comTF);
		else if (opt2 == 'r' && n == 2) {
					/* ¥I·i ¶‰Ÿ¥”a. */
			if (num[0] == 0 && num[1] == 0) beep();
					/* ¯aÇa© µwµb·i ¸÷Ðe”a. */
			else {
				scrolly1 = num[0];
				scrolly2 = num[1] + 1;
			}
		}
					/* Äá¬á· ¡¡´··i ¸÷Ðe”a. */
		else if (opt2 == 'z') {
			if (n == 1) comCursorType(num[0]);
			else if (n == 3) ;
		}
					/* ¶¥Ñ¡Ÿi ‹aŸ¥”a. */
		else if (opt2 == 'a' && n == 3) ;
	}

	isoption = hgFALSE;
	str_pos = 0;
	scr_mode = ENG_MODE;
}

void     comESCOption(char ch)
{
	char   *opt1[25] = {
		"$)1", "(2", "#3", "#4", "#5", "#6", "7", "8",
		"A", "C", "D", "E", "G", "J", "K", "M",
		"W", "c", "s_", "s-", "sI", "si", "sL", "sl",
		"sR"
	};
	char   opt2 = 'f';
	char   opt3 = '[';
	int    i;

	if (ch == 0) return;
	else if (ch == opt2) {
		scr_opt[str_pos++] = ch;
		scr_opt[str_pos] = 0;
		isoption = hgTRUE;
		scr_mode = ENG_MODE;
	}
	else if (ch == opt3) {
		isoption = hgFALSE;
		str_pos = 0;
		scr_mode = CSI_MODE;
	}
	else {
		scr_opt[str_pos++] = ch;
		scr_opt[str_pos] = 0;

		for (i = 0;i < 25;i++)
			if (!strcmp(opt1[i], scr_opt)) {
				isoption = hgTRUE;
				scr_mode = ENG_MODE;
				return;
			}

		isoption = hgFALSE;
		scr_mode = ESC_MODE;
		if (str_pos >= MAXESCOPT - 1) scr_mode = ENG_MODE;
	}
}

void     comCSIOption(char ch)
{
	char   opt[30] = {
		'A', 'B', 'C', 'D', 'F', 'G', 'H', 'J',
		'K', 'L', 'M', 'O', 'P', 'R', 'X', '@',
		'a', 'b', 'c', 'f', 'g', 'h', 'i', 'l',
		'm', 'p', 'r', 's', 'u', 'z'
	};
	int    i;

	if (ch == 0) return;
	else {
		scr_opt[str_pos++] = ch;
		scr_opt[str_pos] = 0;

		for (i = 0;i < 30;i++)
			if (ch == opt[i]) {
				isoption = hgTRUE;
				scr_mode = ENG_MODE;
				return;
			}

		isoption = hgFALSE;
		scr_mode = CSI_MODE;
		if (str_pos >= MAXCSIOPT - 1) scr_mode = ENG_MODE;
	}
}

void     comSetCursorPos(int x, int y)
{
	if (x < 0) x = 0;
	if (x >= comcol) x = comcol - 1;
	if (y < 0) y = 0;
	if (y >= comrow) y = comrow - 1;

	comFAC = 1;
	comWMODE = UPDOWN;

	curx = x;
	cury = y;
}

void     comAdjustCursorPos(int dx, int dy)
{
	int   i, j;
	int   fac = 1;

	if (comFAC != 1 || comWMODE != UPDOWN) fac = 2;

	curx += dx * fac;
	if (curx < 0) curx = 0;
	else if (curx >= comcol) {
		curx = 0;
		dy++;
	}
	if (dy) {
		cury += dy;
		comFAC = 1;
		comWMODE = UPDOWN;
	}
	if (cury < 0) cury = 0;
	else if (cury < comrow && cury == scrolly2) {
		hgHideMouse();
		hgScrUp(comx1, scrolly1 << 4, comx2, (scrolly2 << 4) - 1, 16, comTB);
		hgShowMouse();

		for (j = scrolly1;j < scrolly2 - 1;j++)
			for (i = 0;i < comcol;i++)
				screen[j][i] = screen[j + 1][i];
		for (i = 0;i < comcol;i++)
			screen[scrolly2 - 1][i] = SPACE;

		cury = scrolly2 - 1;
	}
	else if (cury >= comrow) {
		comScrUp();
		cury = comrow - 1;
	}
}

void     comGetCursorPos(int *x, int *y)
{
	*x = curx;
	*y = cury;
}

void     comSaveCursorPos()
{
	savex = curx;
	savey = cury;
}

void     comRestoreCursorPos()
{
	curx = savex;
	cury = savey;
}

void     comCursorType(int n)
{
	if (n < 0 || n > 4) return;

	if (n > 2) n -= 2;
	hgSetCursorType(n);
}

void     comScrUp()
{
	int   i, j;

	hgHideMouse();
	hgScrUp(comx1, comy1, comx2, comy2, 16, comTB);
	hgShowMouse();

	for (j = 0;j < comrow - 1;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = screen[j + 1][i];
	for (i = 0;i < comcol;i++)
		screen[comrow - 1][i] = SPACE;
}

void     comClearAll()
{
	int   i, j;

	comClearScreen();

	for (j = 0;j < comrow;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = SPACE;
}

void     comClearAbove()
{
	int   i, j;

	if (cury == 0) return;

	hgHideMouse();
	hgBoxFill(comx1, comy1, comx2, comy1 - 1 + (cury << 4), comTB);
	hgShowMouse();

	for (j = 0;j < cury;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = SPACE;
}

void     comClearBelow()
{
	int   i, j;

	if (cury == comrow - 1) return;

	hgHideMouse();
	hgBoxFill(comx1, comy1 + ((cury + 1) << 4), comx2, comy2, comTB);
	hgShowMouse();

	for (j = cury + 1;j < comrow;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = SPACE;
}

void     comClearLine()
{
	int   i;

	hgHideMouse();
	hgBoxFill(comx1, comy1 + (cury << 4), comx2, comy1 + 15 + (cury << 4), comTB);
	hgShowMouse();

	for (i = 0;i < comcol;i++)
		screen[cury][i] = SPACE;
}

void     comClearBOL()
{
	int   i;

	hgHideMouse();
	hgBoxFill(comx1, comy1 + (cury << 4), comx1 + 7 + (curx << 3), comy1 + 15 + (cury << 4), comTB);
	hgShowMouse();

	for (i = 0;i <= curx;i++)
		screen[cury][i] = SPACE;
}

void     comClearEOL()
{
	int   i;

	hgHideMouse();
	hgBoxFill(comx1 + (curx << 3), comy1 + (cury << 4), comx2, comy1 + 15 + (cury << 4), comTB);
	hgShowMouse();

	for (i = curx;i < comcol;i++)
		screen[cury][i] = SPACE;
}

void     comInsertChar(int n)
{
	int   i;

	if (n >= comcol - curx) {
		n = comcol - curx;

		hgHideMouse();
		hgBoxFill(comx1 + (curx << 3), comy1 + (cury << 4), comx2, comy1 + 15 + (cury << 4), comTB);
		hgShowMouse();
	}
	else {
		hgHideMouse();
		for (i = 0;i < n;i++)
			hgScrRight(comx1 + (curx << 3), comy1 + (cury << 4), comx2, comy1 + 15 + (cury << 4), 1, comTB);
		hgShowMouse();
	}

	for (i = comcol - n - 1;i >= curx;i--)
		screen[cury][i + n] = screen[cury][i];
	for (i = curx;i < curx + n;i++)
		screen[cury][i] = SPACE;
}

void     comBackDeleteChar(int n)
{
	int   i;

	comAdjustCursorPos(-n, 0);
	comDeleteChar(n);
}

void     comDeleteChar(int n)
{
	int   i;

	if (n >= comcol - curx) {
		n = comcol - curx;

		hgHideMouse();
		hgBoxFill(comx1 + (curx << 3), comy1 + (cury << 4), comx2, comy1 + 15 + (cury << 4), comTB);
		hgShowMouse();
	}
	else {
		hgHideMouse();
		for (i = 0;i < n;i++)
			hgScrLeft(comx1 + (curx << 3), comy1 + (cury << 4), comx2, comy1 + 15 + (cury << 4), 1, comTB);
		hgShowMouse();
	}

	for (i = curx;i < comcol - n;i++)
		screen[cury][i] = screen[cury][i + n];
	for (i = comcol - n;i < comcol;i++)
		screen[cury][i] = SPACE;
}

void     comInsertLine(int n)
{
	int   i, j;

	if (n >= comrow - cury) {
		n = comrow - cury;

		hgHideMouse();
		hgBoxFill(comx1, comy1 + (cury << 4), comx2, comy2, comTB);
		hgShowMouse();
	}
	else {
		hgHideMouse();
		hgScrDown(comx1, comy1 + (cury << 4), comx2, comy2, 16 * n, comTB);
		hgShowMouse();
	}

	for (j = comrow - n - 1;j >= cury;j--)
		for (i = 0;i < comcol;i++)
			screen[j + n][i] = screen[j][i];
	for (j = cury;j < cury + n;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = SPACE;
}

void     comDeleteLine(int n)
{
	int   i, j;

	if (n >= comrow - cury) {
		n = comrow - cury;

		hgHideMouse();
		hgBoxFill(comx1, comy1 + (cury << 4), comx2, comy2, comTB);
		hgShowMouse();
	}
	else {
		hgHideMouse();
		hgScrUp(comx1, comy1 + (cury << 4), comx2, comy2, 16 * n, comTB);
		hgShowMouse();
	}

	for (j = cury;j < comrow - n;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = screen[j + n][i];
	for (j = comrow - n;j < comrow;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = SPACE;
}

void     comSetGraphCenter(int x, int y)
{
	if (x < comx1) x = comx1;
	if (x > comx2) x = comx2;
	if (y < comy1) y = comy1;
	if (y > comy2) y = comy2;

	gx = x;
	gy = y;
}

void     comGetGraphCenter(int *x, int *y)
{
	*x = gx;
	*y = gy;
}

void     comPlotXy(int x, int y, char color)
{
	if (x < comx1) x = comx1;
	if (x > comx2) x = comx2;
	if (y < comy1) y = comy1;
	if (y > comy2) y = comy2;

	hgHideMouse();
	hgPlotXy(x, y, color);
	hgShowMouse();
}

void     comLineO(int option, int size)
{
	int   x1, x2, y1, y2;
	int   temp;

	if (size == 0) size = 1;
	x1 = (curx << 3) + 3;
	y1 = (cury << 4) + 7;

	if (option) {			/* ­A¡ œa·¥ */
		temp = cury + size;
		if (temp > comrow) temp = comrow;
		y2 = (temp << 4) - 8;

		hgHideMouse();
		hgVline(x1, y1, y2, comTF);
		hgVline(x1 + 1, y1, y2, comTF);
		hgShowMouse();
	}
	else {				/* ˆa¡ œa·¥ */
		temp = curx + size;
		if (temp > comcol) temp = comcol;
		x2 = (temp << 3) - 4;

		hgHideMouse();
		hgHline(x1, x2, y1, comTF);
		hgShowMouse();
	}
}

void     comLine(int x, int y, char color)
{
	if (x < comx1) x = comx1;
	if (x > comx2) x = comx2;
	if (y < comy1) x = comy1;
	if (y > comy2) y = comy2;

	hgHideMouse();
	hgLine(gx, gy, x, y, color);
	hgShowMouse();

	gx = x;
	gy = y;
}

void     comBoxG(int xsize, int ysize)
{
	int   x1, x2, y1, y2;
	int   temp;

	if (xsize == 0) xsize = 1;
	if (ysize == 0) ysize = 1;

	x1 = (curx << 3) + 3;
	y1 = (cury << 4) + 7;
	temp = curx + xsize;
	if (temp > comcol) temp = comcol;
	x2 = (temp << 3) - 4;
	temp = cury + ysize;
	if (temp > comrow) temp = comrow;
	y2 = (temp << 4) - 8;

	hgHideMouse();
	hgBox(x1, y1, x2, y2, comTF);
	hgVline(x1 + 1, y1, y2, comTF);
	hgVline(x2 - 1, y1, y2, comTF);
	hgShowMouse();
}

void     comBox(int xsize, int ysize, char color)
{
	int   x1, x2, y1, y2;

	x1 = gx - xsize;
	y1 = gy - ysize;
	x2 = gx + xsize;
	y2 = gy + ysize;
	if (x1 < comx1) x1 = comx1;
	if (y1 < comy1) y1 = comy1;
	if (x2 > comx2) x2 = comx2;
	if (y2 > comy2) y2 = comy2;

	hgHideMouse();
	hgBox(x1, y1, x2, y2, color);
	hgShowMouse();
}

void     comBoxFill(int xsize, int ysize, char color)
{
	int   x1, x2, y1, y2;

	x1 = gx - xsize;
	y1 = gy - ysize;
	x2 = gx + xsize;
	y2 = gy + ysize;
	if (x1 < comx1) x1 = comx1;
	if (y1 < comy1) y1 = comy1;
	if (x2 > comx2) x2 = comx2;
	if (y2 > comy2) y2 = comy2;

	hgHideMouse();
	hgBoxFill(x1, y1, x2, y2, color);
	hgShowMouse();
}

void     comCircle(int xsize, int ysize, char color)
{
	hgHideMouse();
	hgEllipse(gx, gy, xsize, ysize, color);
	hgShowMouse();
}

void     comSetForeColor(char color)
{
	if (hgIsHerc()) return;
	if (color < 0 || color > 15) return;

	comTF = color;
}

void     comSetBackColor(char color)
{
	if (hgIsHerc()) return;
	if (color < 0 || color > 15) return;

	comTB = color;
}

void     comSetFore(int n)
{
	char   color[8] = {
		BLACK, RED, GREEN, BROWN, BLUE, MAGENTA, CYAN, LIGHTGRAY
	};

	if (hgIsHerc()) return;

	if (n < 0 || n > 7) return;

	comTF = color[n] + (char)(bright * 8);
}

void     comSetBack(int n)
{
	char   color[8] = {
		BLACK, RED, GREEN, BROWN, BLUE, MAGENTA, CYAN, LIGHTGRAY
	};

	if (hgIsHerc()) return;

	if (n < 0 || n > 7) return;

	comTB = color[n] + (char)(bright * 8);
}

void     comAdjustFore(char bright)
{
	if (hgIsHerc()) return;

	if (bright && comTF < 8) comTF += 8;
	else if (!bright && comTF > 7) comTF -= 8;
}

char     comGetForeColor()
{
	return(comTF);
}

char     comGetBackColor()
{
	return(comTB);
}

void     comRestoreScreen()
{
	byte   temp[3] = { 0, 0, 0 };
	int    i, j;

	hgHideMouse();

	for (j = 0;j < comrow;j++)
		for (i = 0;i < comcol;) {
			temp[0] = screen[j][i];
			if (temp[0] > 0x80) {
				temp[1] = screen[j][i + 1];
				comFBTextXy(comx1 + (i << 3), comy1 + (j << 4), temp);
				temp[1] = 0;
				i += 2;
			}
			else {
				comFBTextXy(comx1 + (i << 3), comy1 + (j << 4), temp);
				i++;
			}
		}

	hgShowMouse();
}

void     comFBTextXy(int x, int y, char *str)
{
	char   fsav, bsav;
	char   savee, saveh;
	char   wmode;
	int    xfac;

	fsav = hgGetTFcolor();
	bsav = hgGetTBcolor();
	savee = hgGetEAttr();
	saveh = hgGetHAttr();
	xfac = hgGetXFactor();
	wmode = hgGetWriteMode();

	hgSetTFcolor(comTF);
	hgSetTBcolor(comTB);
	hgSetEAttr(eattr);
	hgSetHAttr(hattr);
	if (specialflag) {
		hgSetEAttr(OUTLINE);
		hgSetHAttr(OUTLINE);
	}
	hgSetXFactor(comFAC);
	hgSetWriteMode(comWMODE);

	hgOverTextXy(x, y, str);

	hgSetTFcolor(fsav);
	hgSetTBcolor(bsav);
	hgSetEAttr(savee);
	hgSetHAttr(saveh);
	hgSetXFactor(xfac);
	hgSetWriteMode(wmode);
}

int      comCursor()
{
	int   key;

	key = hgCursor2(comx1 + (curx << 3), comy1 + (cury << 4), is_han(comBuff));
	return(key);
}

void     comClearScreen()
{
	hgHideMouse();
	hgBoxFill(comx1, comy1, comx2, comy2, comTB);
	hgShowMouse();
}
