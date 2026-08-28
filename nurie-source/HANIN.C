/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hanin.c  -- Ðe‹i ·³b ¡A·¥ ¡¡—I               |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <ctype.h>
#include    <mem.h>
#include    <string.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     OFF0        0
#define     OFF2        2

#define     MAXKEYFUNC  12		/* ÂA” ‹¡“wÇ¡· ˆ•® */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char    *inbuff;			/* ·³b–E ¢…¸aµi ¤áÌá */
int      Xpos, Ypos;			/* Ñe¸ Äá¬á· ¸é”¸â·¥ ¹ÁÎa Îa¯¡ */
int      pos;				/* Ñe¸ Äá¬á· ¬w”¸â·¥ ¶áÃ¡ */
char     ins_flag = hgTRUE;		/* ¬s·³ ¡¡—a */
int      in_max;			/* ÂA” ·³b ˆa“w ¢…¸aµi® */

extern   char     mode;

char     specinmode = hgFALSE;		/* Ëb¥i ·³b ¡¡—a */
char     enginmode = hgFALSE;		/* µw¢… ¸å¶w ¡¡—a */
char     digitinmode = hgFALSE;		/* ®•¸a ¸å¶w ¡¡—a */

char     ext_enable = hgFALSE;		/* ÈiÂ‰ Ç¡ ¬a¶w µa¦ */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgInitStr(char *s, int n);
int      buf_len(char *str);
void     closeStr();

int      is_hangul();
void     home_process();
void     end_process();
void     right_process();
void     left_process();
void     bs_process();
void     del_process();
void     insert_buf(int n);
void     ins_process();
void     han2eng_process();
void     return_process();
void     gtype_process();
void     graphin_process();
void     hanjain_process();
void     ctrlb_process();
void     eng_process(int key);
void     han_process(int key);
int      key_process(int key);

int      hgInTextXy(int x, int y, char *retn_str, int max);

void     ins_internal();
void     han2eng_internal();
extern   void     in_null();
void     hgSetInsInternal(void (*func)());
void     hgSetToggInternal(void (*func)());
void     hgResetInsInternal();
void     hgResetToggInternal();

void     hgSpecInModeOn();
void     hgSpecInModeOff();
void     hgEngInModeOn();
void     hgEngInModeOff();
void     hgDigitInModeOn();
void     hgDigitInModeOff();
void     hgSetExtKeyOn();
void     hgSetExtKeyOff();

int      keys[MAXKEYFUNC] = {
	HOME, END, LEFT, RIGHT, BS, DEL, INS, SHIFT_SPC, F3, F4, F9, CTRL_B
};

void   (*keyfunc[MAXKEYFUNC])() = {
	home_process, end_process, left_process, right_process,
	bs_process, del_process, ins_process, han2eng_process,
	gtype_process, graphin_process, hanjain_process, ctrlb_process
};

			/* function pointer */
void   (*ins_inter)() = &in_null;
void   (*h2e_inter)() = &in_null;


void     hgInitStr(char *s, int n)
{
	memset(s, 0, n - 1);
}

int      buf_len(char *str)
{
	int   i;

	for (i = in_max;i >= 0;i--)
		if (str[i] != 0) return(i + 1);
	return(0);
}

void     closeStr()
{
	int   i, leng;

	leng = buf_len(inbuff);
	inbuff[leng] = 0;
	for (i = 0;i <= leng - 1;i++)
		if (inbuff[i] == 0) inbuff[i] = SPACE;
}

int      is_hangul()
{
	int   i, ret;

	for (i = 0;i < pos;)
		if (isascii(inbuff[i])) {
			ret = OFF0;
			i++;
		}
		else {
			ret = OFF2;
			i += 2;
		}
	return(ret);
}

void     home_process()
{
	if (!is_complete()) init_code();

	pos = 0;
}

void     end_process()
{
	if (!is_complete()) init_code();

	pos = buf_len(inbuff);
	if (pos > in_max - 1)  pos = in_max - 1;
}

void     right_process()
{
	if (pos >= in_max - 2 + isascii(inbuff[pos])) return;

	if (!is_complete()) init_code();

	if (isascii(inbuff[pos])) pos++;
	else pos += 2;
	if (inbuff[pos] == 0) inbuff[pos] = SPACE;
}

void     left_process()
{
	if (pos <= 0) return;

	if (!is_complete()) init_code();

	if (is_hangul())  pos -= 2;
	else pos--;
}

void     bs_process()
{
	int   tch;

	tch = back_process();

	if (tch == BS) {
		if (pos <= 0) return;

		if (!is_hangul()) {
			pos--;
			del_process();
		}
		else {
			pos -= 2;
			del_process();
		}
	}
	else if (tch == DEL) del_process();
	else {
		tch = temp_combine();
		inbuff[pos] = (tch >> 8);
		inbuff[pos + 1] = tch;

		hgHideMouse();
		hgOverTextXy(Xpos + pos * 8, Ypos, &inbuff[pos]);
		hgShowMouse();
	}
}

void     del_process()
{
	int   i, leng;

	leng = buf_len(inbuff);
	if (pos >= leng) return;

	if (!is_complete()) {
		init_code();
		pos += 2;
		if (pos >= in_max) pos -= 2;
	}

	if (isascii(inbuff[pos])) {
		for (i = pos + 1;i <= leng - 1;i++)
			inbuff[i - 1] = inbuff[i];
		for (i = leng - 1;i < in_max + 4;i++)
			inbuff[i] = 0;

		hgHideMouse();
		hgOverTextXy(Xpos + (leng - 1) * 8, Ypos, " ");
		hgShowMouse();
	}
	else {
		for (i = pos + 2;i <= leng - 1;i++)
		inbuff[i - 2] = inbuff[i];
		for (i = leng - 2;i < in_max + 4;i++)
			inbuff[i] = 0;

		hgHideMouse();
		hgOverTextXy(Xpos + (leng - 2) * 8, Ypos, "  ");
		hgShowMouse();
	}

	hgHideMouse();
	hgOverTextXy(Xpos + pos * 8, Ypos, &inbuff[pos]);
	hgShowMouse();
}

void     insert_buf(int n)
{
	int   i, leng;

	leng = buf_len(inbuff);

	if (n == 1) {
		for (i = leng - 1;i >= pos;i--)
			inbuff[i + 1] = inbuff[i];
		inbuff[pos] = SPACE;
	}
	else {
		for (i = leng - 1;i >= pos;i--)
			inbuff[i + 2] = inbuff[i];
		inbuff[pos] = SPACE;
		inbuff[pos + 1] = SPACE;
	}
}

void     ins_process()
{
	ins_flag = !ins_flag;

	if (!is_complete()) {
		init_code();
		pos += 2;
		if (pos >= in_max) pos -= 2;
	}

	ins_internal();
}

void     han2eng_process()
{
	mode = 1 - mode;

	if (!is_complete()) {
		init_code();
		pos += 2;
		if (pos >= in_max) pos -= 2;
	}

	toggle_sound();
	han2eng_internal();
}

void     return_process()
{
	if (!is_complete()) init_code();

	closeStr();
}

void     gtype_process()
{
	if (!is_complete()) init_code();

	hgGraphCharType();
}

void     graphin_process()
{
	int   ch;

	if (!is_complete()) {
		init_code();
		pos += 2;
		if (pos >= in_max) pos -= 2;
	}

	if (!hgGraphCharIn(&ch)) return;

	if (ins_flag) {
		if (buf_len(inbuff) < in_max - 1) insert_buf(2);
		else return;
	}
	else if (isascii(inbuff[pos]) && inbuff[pos + 1] & 0x80) inbuff[pos + 2] = SPACE;
	inbuff[pos] = (ch >> 8);
	inbuff[pos + 1] = ch;

	hgHideMouse();
	hgOverTextXy(Xpos + pos * 8, Ypos, &inbuff[pos]);
	hgShowMouse();

	pos += 2;
	if (pos >= in_max) pos = in_max - 2;
}

void     hanjain_process()
{
	int   ch;

	if (!is_complete()) init_code();

	if (isascii(inbuff[pos])) return;

	ch = (inbuff[pos] << 8) + (byte)inbuff[pos + 1];
	hgHanjaIn(&ch);
	inbuff[pos] = (ch >> 8);
	inbuff[pos + 1] = ch;

	hgHideMouse();
	hgOverTextXy(Xpos + pos * 8, Ypos, &inbuff[pos]);
	hgShowMouse();

	pos += 2;
	if (pos >= in_max) pos = in_max - 2;
}

void     ctrlb_process()
{
	int   key;

	key = inkey(WAIT);

	switch (key) {
		case ESC :
			eng_process(ESC);
			break;
		default :
			break;
	}
}

void     eng_process(int key)
{
	char   temp[3] = { 0, 0, 0 };

	if (!is_complete()) {
		init_code();
		pos += 2;
		if (pos >= in_max) pos -= 2;
	}

	if (ins_flag) {
		if (buf_len(inbuff) < in_max) insert_buf(1);
		else return;
	}

	if (!isascii(inbuff[pos])) {
		inbuff[pos + 1] = SPACE;
		temp[1] = SPACE;
	}
	inbuff[pos] = key;
	temp[0] = key;

	if (ins_flag) {
		hgHideMouse();
		hgOverTextXy(Xpos + pos * 8, Ypos, &inbuff[pos]);
		hgShowMouse();
	}
	else {
		hgHideMouse();
		hgOverTextXy(Xpos + pos * 8, Ypos, temp);
		hgShowMouse();
	}

	if (pos < (in_max - 1)) pos++;
}

void     han_process(int key)
{
	char   temp[4] = { 0, 0, 0, 0};
	int    ch, tch;
	int    tpos, i, ishan;

	if (pos >= in_max - 1)  return;

	if (ins_flag && is_complete()) {
		if (buf_len(inbuff) < in_max - 1) insert_buf(2);
		else return;
	}

	ch = key;
	tch = hgCombine(&ch);

	if (tch) {
		inbuff[pos++] = (tch >> 8);
		inbuff[pos++] = tch;
		if (ins_flag) {
			if (buf_len(inbuff) < in_max) insert_buf(2);
			else pos -= 2;
		}
		else if (pos >= in_max - 1) pos -= 2;
	}

	if (!ins_flag)
		if (isascii(inbuff[pos]) && inbuff[pos + 1] & 0x80)
			inbuff[pos + 2] = SPACE;
	inbuff[pos] = (ch >> 8);
	inbuff[pos + 1] = ch;

	ishan = is_hangul();
	tpos = (pos > 2) ? pos - ishan : 0;
	if (ishan && pos >= 1) {
		for (i = 0;i < ishan;i++)
			temp[i] = inbuff[tpos + i];

		hgHideMouse();
		hgOverTextXy(Xpos + tpos * 8, Ypos, temp);
		hgShowMouse();
	}

	if (ins_flag) {
		if (pos < in_max) {
			hgHideMouse();
			hgOverTextXy(Xpos + pos * 8, Ypos, &inbuff[pos]);
			hgShowMouse();
		}
	}
	else {
		temp[0] = inbuff[pos];
		temp[1] = inbuff[pos + 1];
		if (inbuff[pos + 2] == ' ')  temp[2] = inbuff[pos + 2];
		else temp[2] = 0;

		hgHideMouse();
		hgOverTextXy(Xpos + pos * 8, Ypos, temp);
		hgShowMouse();
	}
}

int      key_process(int key)
{
	int   i;
	int   ret_flag = _NORMAL_KEYCODE;

	for (i = 0;i < MAXKEYFUNC;i++)
		if (keys[i] == key) {
			(*keyfunc[i])();
			ret_flag = _SPECIAL_KEYCODE;
			break;
		}
	if (key == RETURN || key == ESC)
		ret_flag = _EXIT_KEYCODE;

	return(ret_flag);
}

int      hgInTextXy(int x, int y, char *retn_str, int max)
{
	int    key;
	int    i, leng;
	int    extflag;
	int    isfirst = hgFALSE;

	Xpos = x;
	Ypos = y;
	in_max = max;
	pos = 0;

	inbuff = (char *)malloc((size_t)in_max + 4);
	hgInitStr(inbuff, in_max + 4);

	if (strlen(retn_str)) {
		memcpy(inbuff, retn_str, strlen(retn_str));
		for (i = strlen(retn_str);i < (in_max + 4);i++)
			inbuff[i] = 0;
	}

	if (specinmode) {
		hgSetEAttr(REVERSE);
		hgSetHAttr(REVERSE);
		pos = buf_len(inbuff);
		if (pos >= in_max - 1)  pos = in_max - 1;
	}

	hgHideMouse();
	hgOverTextXy(Xpos, Ypos, inbuff);
	hgShowMouse();

	if (specinmode) {
		hgSetEAttr(NORMAL);
		hgSetHAttr(NORMAL);
		isfirst = hgTRUE;
	}
	init_code();

	while (1) {
		key = hgCursor(Xpos + (pos << 3), Ypos, !isascii(inbuff[pos]));
		extflag = key_process(key);
		if (extflag == _SPECIAL_KEYCODE) {
			if (isfirst) {
				isfirst = hgFALSE;

				hgHideMouse();
				hgOverTextXy(Xpos, Ypos, inbuff);
				hgShowMouse();
			}
		}
		else if (extflag == _EXIT_KEYCODE) break;
		else if (extflag == _NORMAL_KEYCODE) {
			if (isfirst) {
				hgInitStr(inbuff, max + 4);

				hgHideMouse();
				hgBoxFill(Xpos, Ypos, Xpos + (max - 1) * 8 + 7, Ypos + 15, hgGetTBcolor());
				hgShowMouse();

				isfirst = hgFALSE;
				pos = 0;
			}
			if (key & 0x8000) han_process(key & 0x7fff);
			else if (key >= 32 && key <= 255) {
				if (digitinmode) {
					if (key >= '0' && key <= '9')
						eng_process(key);
				}
				else eng_process(key);
			}
			else if (ext_enable) break;
		}
	}

	if (isfirst) {
		isfirst = hgFALSE;

		hgHideMouse();
		hgOverTextXy(Xpos, Ypos, inbuff);
		hgShowMouse();
	}
	return_process();

	if (key != ESC) {
		leng = buf_len(inbuff);
		for (i = 0;i <= leng;i++) retn_str[i] = inbuff[i];
		retn_str[i] = 0;
	}
	free(inbuff);

	return(key);
}

void     ins_internal()
{
	(*ins_inter)();
}

void     han2eng_internal()
{
	(*h2e_inter)();
}

void     hgSetInsInternal(void (*func)())
{
	ins_inter = func;
}

void     hgResetInsInternal()
{
	ins_inter = &in_null;
}

void     hgSetToggInternal(void (*func)())
{
	h2e_inter = func;
}

void     hgResetToggInternal()
{
	h2e_inter = &in_null;
}

void     hgSpecInModeOn()
{
	specinmode = hgTRUE;
}

void     hgSpecInModeOff()
{
	specinmode = hgFALSE;
}

void     hgEngInModeOn()
{
	enginmode = hgTRUE;
}

void     hgEngInModeOff()
{
	enginmode = hgFALSE;
}

void     hgDigitInModeOn()
{
	digitinmode = hgTRUE;
}

void     hgDigitInModeOff()
{
	digitinmode = hgFALSE;
}

void     hgSetExtKeyOn()
{
	ext_enable = hgTRUE;
}

void     hgSetExtKeyOff()
{
	ext_enable = hgFALSE;
}
