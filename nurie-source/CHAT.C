/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : chat.c  -- ·¡´¡‹¡  a”w ¡¡—I                   |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <string.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "comdef.h"			/* É·¯¥ ¬w®· ¸÷· */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MAXLINE      20

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     chatMode = hgFALSE;		/* ·¡´¡‹¡  a”w µa¦ */

char     chatstr[MAXLINE][80];		/* ·¡´¡‹¡  a”w¯¡ ·³b ¢…¸aµi */
int      clpos = 0;			/* ·³b ¢…¸aµi· ¤åÑ¡ */

char     lbuffer[200];			/* ¡¡•Q É·Ð —i´áµ¡“e Ðe œa·¥· ¢…¸aµi */
int      lpos = 0;			/* ¢…¸aµi· ¢…¸a ˆ•® */
char     chatman[25];			/* ”ÑÁ·¥ »¡¸÷¯¡ ”ÑÁ·¥· ·¡Ÿq */
char     manflag = hgFALSE;		/* ”ÑÁ·¥ »¡¸÷ µa¦ */
extern   char     specialflag;

extern   int      curx, cury;
extern   int      comx1, comy1, comx2, comy2;
extern   int      comrow, comcol;

extern   char     screen[30][80];
extern   char     tabstr[];

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreChatting();			/* ·¡´¡‹¡  a”w  @C */
void     nreChatMan();			/* ”ÑÁ·¥ »¡¸÷  F5 */

void     comInitChat();
void     comCloseChat();
void     comInputChat();
char     comIsChatting();
void     chat_out();

void     comFindChatMan();
int      line_read();
int      str_cmp(char *src, char *dest);
int      match(char *src, char *dest, int pos);


void     nreChatting()
{
	if (chatMode) {
		chatMode = hgFALSE;
		return;
	}

	comInitChat();
	comDisplayChatStatus();
	comInputChat();
	comCloseChat();
}

void     nreChatMan()
{
	if (!chatMode) {
		hgSetSaveOn();
		hgDisplayMessage(" ·¡´¡‹¡  a”wµA¬á e ¬a¶w ˆa“wÐs“¡”a. ", RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();
		return;
	}

	manflag = 1 - manflag;

	hgSetSaveOn();

	if (manflag) {
		hgSpecInModeOn();
		hgGetText(" ”ÑÁ·¥ »¡¸÷ ", chatman, 20, CYAN);
		hgSpecInModeOff();
	}
	else {
		hgDisplayMessage(" ”ÑÁ·¥ »¡¸÷·i {““¡”a. ", MAGENTA);
		delay(1000);
	}

	hgRestore();
	hgSetSaveOff();
}

void     comInitChat()
{
	int   i, j;

	while (cury > comrow - 5) {
		comScrUp();
		cury--;
	}

	for (j = comrow - 4;j < comrow;j++)
		for (i = 0;i < comcol;i++)
			screen[j][i] = SPACE;

	chatMode = hgTRUE;
	comrow -= 4;
	comy2 -= 64;

	comSetChatStatus(hgGetx1r(), comy2 + 1, hgGetx2r(), comy2 + 20);
}

void     comCloseChat()
{
	hgHideMouse();
	hgBoxFill(comx1, comy2 + 1, comx2, comy2 + (4 << 4), comGetBackColor());
	hgShowMouse();

	chatMode = hgFALSE;
	manflag = hgFALSE;
	comrow += 4;
	comy2 += 64;
}

void     comInputChat()
{
	int    fsave, bsave;
	int    key;
	int    len;
	int    extflag;

	while (1) {
		fsave = hgGetTFcolor();
		bsave = hgGetTBcolor();
		hgSetTFcolor(WHITE);
		hgSetTBcolor(BLACK);

		hgHideMouse();
		hgOverTextXy(comx1, comy2 + 1 + (3 << 4), chatstr[(clpos + 1) % MAXLINE]);
		hgShowMouse();

		hgSetCursInternal(&chat_out);

		hgSpecInModeOff();
		hgSetExtKeyOn();
		key = hgInTextXy(comx1, comy2 + 1 + (2 << 4), chatstr[clpos], 75);
		hgSetExtKeyOff();
		hgSpecInModeOn();

		hgResetCursInternal();

		hgSetTFcolor(fsave);
		hgSetTBcolor(bsave);

		if (key == ALT_C) return;

		extflag = comFuncProcess(key);
		if (extflag == _NORMAL_KEYCODE) {
			switch (key) {
				case CTRL_Z :
					comDataOut(CTRL_Z);
					break;
				case RETURN :
					len = strlen(chatstr[clpos]);
					chatstr[clpos][len] = RETURN;
					chatstr[clpos][len + 1] = 0;
					sendline(tabstr, CHATMODE);
					sendline(chatstr[clpos], CHATMODE);
					chatstr[clpos][len] = 0;

					clpos++;
					if (clpos > MAXLINE - 2) clpos = 0;
					hgInitStr(chatstr[clpos], 80);
					break;
				case ESC :
					return;
				case UP :
					clpos--;
					if (clpos < 0) clpos = MAXLINE - 1;
					break;
				case DOWN :
					clpos++;
					if (clpos > MAXLINE - 1) clpos = 0;
					break;
			}

			hgHideMouse();
			hgBoxFill(comx1, comy2 + 1 + (2 << 4), comx2, comy2 + (4 << 4), BLACK);
			hgShowMouse();
		}
		else if (extflag == _EXIT_KEYCODE) comChoosePulldown();

		if (!chatMode) return;
	}
}

char     comIsChatting()
{
	return(chatMode);
}

void     chat_out()
{
	comCrtOut(4);
}

void     comFindChatMan()
{
	byte   ch;
	int    i;
	int    flag;

	if (!line_read()) return;

	flag = str_cmp(lbuffer, chatman);

	if (flag) specialflag = hgTRUE;
	for (i = 0;i < lpos;i++) {
		ch = lbuffer[i];
		comCheckCode(ch);
	}
	specialflag = hgFALSE;

	lpos = 0;
	for (i = 0;i < 200;i++) lbuffer[i] = SPACE;
}

int      line_read()
{
	char   ch;

	if (comIsDataReady()) {
		ch = comDataIn();
		if (lpos >= 198 || ch == RETURN || ch == LF) {
			lbuffer[lpos++] = ch;
			lbuffer[lpos] = NULL;
			return(hgSUCCESS);
		}
		else {
			lbuffer[lpos++] = ch;
			return(hgFAIL);
		}
	}
	else return(hgFAIL);
}

int      str_cmp(char *src, char *dest)
{
	int   flag = hgFALSE;
	int   pos;

	pos = 0;
	while (pos < 4) {
		if (match(src, dest, pos)) {
			flag = hgTRUE;
			break;
		}
		pos++;
	}
	return(flag);
}

int      match(char *src, char *dest, int pos)
{
	char   temp[25];
	int    i, j;

	strcpy(temp, dest);
	hgCodeConvStr(SANGYONG, hgSrcCode(), temp);

	i = 0;
	j = pos;

	while (i < strlen(temp)) {
		if (src[j] != temp[i]) break;
		i++;
		j++;
	}

	if (i == strlen(temp)) return(hgTRUE);
	else return(hgFALSE);
}
