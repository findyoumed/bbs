/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : nurie.c  -- ’Ÿ¡µA ¡A·¥ ¡¡—I                  |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <process.h>
#include    <stdlib.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "protocol.h"		/* Ðq® ¶¥Ñw· ¬å´å */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

HPOPUP    *cpu[7];			/* Î‰”a¶… ¡A“A */
HPULLDOWN *cpd;

HPOPUP    *epu[3];
HPULLDOWN *epd;

int      hfonttype = 2;			/* ŠŠ·eÁA */
int      efonttype = 5;			/* ROMAN ÁA */

char     endflag;			/* Ïa¡‹aœ‘ ¹·ža µa¦ */
extern   char     capflag;
extern   char     debugflag;
extern   char     lineflag;

char     hanjafile[50] = { "" };	/* Ðe¸a ÑÁ·© */

int      comHotkeys[8][9] = {
	{ ALT_H, F1, ALT_P, ALT_Y, ALT_F, ALT_SPC, ALT_J, ALT_S, ALT_X },
	{ ALT_1, ALT_2, ALT_3, ALT_4, ALT_5, ALT_6, ALT_7, ALT_8 },
	{ ALT_9, ALT_0, CTRL_T, CTRL_P, CTRL_C, CTRL_U, CTRL_D, ALT_W },
	{ PgUp, PgDn, ALT_V, CTRL_L, ALT_G, ALT_L, ALT_Z, ALT_K, ALT_I },
	{ ALT_A, CTRL_F6, ALT_D, ALT_C, ALT_M, CTRL_F10, CTRL_F9, ALT_B },
	{ F6, F7, F8, CTRL_F5, CTRL_F7, ALT_Q, ALT_E, CTRL_F1, CTRL_F2 },
	{ ALT_N, ALT_O, ALT_R, ALT_U, ALT_T, CTRL_F8, F5 },
	{ CTRL_S, CTRL_R, CTRL_I, CTRL_N }
};

void   (*comHotkeyfunc[8][9])() = {
	{ nreAboutComm, nreHelpComm, nreMusicPlay, nreCalendar, nreIdDBF,
	  nreGoMenu, nreDosComm, nreShellComm, comEndRoutine },
	{ nrePortNum, nreSpeedBPS, nreParityBit, nreDataBit,
	  nreStopBit, nrePhoneType, nreInitType, nreModemStatus },
	{ nreHostHangul, nreTerminal, nreDelayTime, nreDialDelay,
	  nreChainDial, nreUpMethod, nreDownMethod, nreSaveCfg },
	{ nreFileUp, nreFileDown, edMainRoutine, nreDownDir, nreScreenCapture,
	  nreCaptureToggle, nrePCXFileDisplay, nreSeeHWP, nreCompactView },
	{ comClearAll, nreLineToggle, nreDialing, nreChatting,
	  nreMacro, nreDebugToggle, nreHangUp, nreBreak },
	{ nreHanInTypeMain, nreEngFontMain, nreHanFontMain, nreHanjaFileMain,
	  nreHanjaConv, nreSelectMenuFile, nreChangeCrtColor, nreCursorMain, nreMouseCursMain },
	{ nreToggleAnsi, nreInitModem, nreEchoToggle,
	  nre1vs1Comm, nreTabChange, nreSetInitCSI, nreChatMan },
	{ nreSendCSI, nreSendRI, nreSendIND, nreSendNEL }
};


int      edHotkeys[3][7] = {
	{ ALT_H, F1, ALT_J, ALT_X },
	{ ALT_N, ALT_O, ALT_F3, ALT_W, ALT_S, ALT_D, ALT_C },
	{ F6, F7, F8, CTRL_F5, ALT_E, CTRL_F1, CTRL_F2 }
};

void   (*edHotkeyfunc[3][7])() = {
	{ nreAboutEdit, nreHelpEdit, nreShellEdit, edEndRoutine },
	{ nreNewEdit, nreLoadEdit, nreReloadEdit, nreWritetoEdit, nreSaveEdit, nreDirEdit, nreChDirEdit },
	{ nreHanInTypeMain, nreEngFontMain, nreHanFontMain, nreHanjaFileMain, nreChangeEdColor, nreCursorMain, nreMouseCursMain }
};

extern   int      errno;
extern   char    *sys_errlist[];

extern   unsigned edScreenjob;

char    *errmsg[] = {
	" ÑÁ·©·¡ á¢ Çs“¡”a. ",
	" Àx“e ¢…¸aµi·¡ ´ô¯s“¡”a. ",
	" ÑÁ·©·¡ ´ôˆáa ·¡Ÿq·¡ Ëiv¯s“¡”a. ",
	" —¡¯aÇaµA §¥¸aŸ¡ˆa ´ô¯s“¡”a. ",
	" Íe»³ ¡A¡¡Ÿ¡ˆa ¡¡¸aœs“¡”a. "
};

char  c_message[14][35] = {
	" —¡¯aÇaµA ³a‹¡ ¤w»¡ –A´á ·¶¯s“¡”a ",
	" —aœa·¡§a ·¡Ÿq·¡ Ëiv¯s“¡”a ",
	" —aœa·¡§a· ¢…·¡ µia ·¶¯s“¡”a ",
	" ¡ww´áˆa Ëiv¯s“¡”a ",
	" CRC ERROR ",
	" BAD REQUEST STRUCTURE LENGTH ",
	" SEEK ERROR ",
	" Îaº… Í¡ •·¡ ´a“³“¡”a ",
	" ­BÈáŸi ·ª·i ® ´ô¯s“¡”a ",
	" ÏaŸ¥ÈáµA ¹··¡ˆa ´ô·s“¡”a ",
	" ³a“e •·´e µAœáˆa ¤i¬— ",
	" ·ª“e •·´e µAœáˆa ¤i¬— ",
	" ¯¡¯aÉQ µAœá "
};

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreInitScreen();
void     nreEndScreen();

void     nreBeginLogo();
void     nreEndLogo();

void     nreAboutComm();		/* ’Ÿ¡µAœe..  @H */
void     nreHelpComm();			/* ¬a¶w¬é¡w¬á  F1 */
void     nreDosComm();			/* •¡¯a ¡ww  @J */
void     nreShellComm();		/* a—i·¡  @S */

void     nreHanInTypeMain();		/* Ðe‹i ¹·ŸA  F6 */
void     nreHanFontMain();		/* Ðe‹i ‹i©  F8 */
void     nreEngFontMain();		/* µw¢… ‹i©  F7 */
void     nreHanjaFileMain();		/* Ðe¸a ·¡Ÿq ^F5 */
void     nreCursorMain();		/* Äá¬á ¡¡´· ^F1 */
void     nreMouseCursMain();		/*  a¶¯a Äá¬á ^F2 */

void     comMainRoutine();
void     comEndRoutine();
void     edMainRoutine();

void     comInitPulldown();
void     comChoosePulldown();
void     comEndPulldown();
void     edInitPulldown();
void     edChoosePulldown();
void     edEndPulldown();

int      comFuncProcess(int key);
int      edFuncProcess(int key);

void     mouse_window(char *title, char *text[]);
void     prt_message(char *title, char *text);
int      host_han();

void     errorf();
void     handler();
int      cbrk_handler();
void     sethandle();

void     beep();
void     errorsound();
void     toggle_sound();
void     connect_sound();


void     main()
{
	nreInitScreen();
	hgSetRealWindow(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety2r() - 30);
	sethandle();

	comMainRoutine();
}

void     nreInitScreen()
{
	hgSetFontInit();

	hgAutoSetDisplay();
	hgSetMode(hgGRAPHICS);

	hgQuickOutInit();
	hgQuickInInit();
	hgQuickGraphInit();

	hgVMEMInit(64);
	hgMarkInit();
	hgSetMouseInit();

	hgGraphicCharInit("SAN.GRF", 100);

	hgTextAttrInit();
	hgSetTextAttrOff();
}

void     nreEndScreen()
{
	hgHanjaEnd();
	hgGraphicCharEnd();

	hgSetFontEnd();

	hgVMEMEnd();
	hgMarkEnd();
	hgSetMouseEnd();

	hgSetMode(hgTEXT);
}

void     nreBeginLogo()
{
	HICON  *p;

	char   *text[] = {
		"       ·¡  Ïa¡‹aœ‘·e   Ðe‹i  ¸w  É·¯¥   ",
		"       µA¢‰A·¡Èá  - ’Ÿ¡µA 1.5 -  ·³“¡”a. ",
		"       ‰·ˆ  Î‰‹aŸ±·¡“¡  ¥¢¬aÐ¬á ¬a¶wÐaµa ",
		"       ÐqA ’Ÿ¡“e £¡œŸi  e—i‹¡ ¤aœs“¡”a. ",
		" ”e, ¬w´óµA ·¡¶wÐ¬á“e ´e –S“¡”a.          ",
		"                                           ",
		"   Ñ¡¬á”   ÄñÏAÈá ‰·Ðb‰Á  89Ðb¤å  ¹©´ó¬—  ",
		"   ÄñÏAÈáŸi  ¬aœwÐa“e  ·¡ »¢Àw·¡           ", ""
	};
	int    i;
	int    x1, y1, x2, y2;
	int    ch;
	int    fsave;

	hgHideMouse();

	hgSetXFactor(2);
	hgSetYFactor(2);

	fsave = hgGetTFcolor();
	hgSetTFcolor(YELLOW);

	hgHline(16, 520, 50, YELLOW);
	hgOutTextXy(16, 52, " ÐqA ’Ÿ¡“e ¬aÒAŸi ¶áÐaµa ");

	for (i = 0;i < 8;i++) {
		hgSetTFcolor(i);
		if (hgIsHerc()) hgSetTFcolor(i % 2);
		hgOutTextXy(16, 16, " ’Ÿ¡µA 1.5 É·¯¥ µA¢‰A·¡Èá ");
		delay(30);
	}

	hgSetTFcolor(fsave);

	for (i = 0;i < 5;i++) {
		hgScrRight(16, 16, 639, 47, 2, comGetBackColor());
		delay(30);
	}

	hgSetXFactor(1);
	hgSetYFactor(1);

	hgShowMouse();

	hgSetSaveOn();
	hgPrtWTextXyM("’Ÿ¡µAŸi ´á ‘½·a¡a", text);

	hgRetMSize(text, &x1, &y1, &x2, &y2);
	hgDrawBorder(x1 + 24, y1 + 49, x1 + 22 + 36, y1 + 47 + 36, BOXNORMAL, FILL);

	p = hgHICON_Load("NURIE.HIC");
	if (p != NULL) {
		hgHICON_Draw(p, x1 + 26, y1 + 51);
		hgHICON_Free(&p);
	}

	do {
		ch = windelay(x1, y1, x2, y2);
		if (ch == MOUSE_LEFT || ch == MOUSE_RIGHT) ch = NOKEY;
	} while (ch == NOKEY);

	hgRestore();
	hgSetSaveOff();
}

void     nreEndLogo()
{
	HICON  *p;

	char   *text[] = {
		"       ’Ÿ¡µAˆa •¡¶‘·¡ –A­va¶a?   ",
		"       ¬a¶wº— ·¢…¸ñ·¡a, ˆ¬å¸ñ·e ",
		"       ´aœ µeœbÀá¡ µeœbº¯¡¡e    ",
		"       Â—¯©Ó¡ ®qÐa‰V¯s“¡”a.      ",
		" ai·¡ ¤i¸å–A´á»¡‹© ¤aœa¡a...     ",
		"                                   ",
		"   ·¡ »¢Àw :  (02) 924-8772        ",
		"   ‹e¢Àá : ¬á¶‰”Ðb ¥w¶¥          ",
		"   Ða·¡ÉI, Pc-Serve ID : jikchang  ", ""
	};
	int    x1, y1, x2, y2;
	int    ch;

	hgSetSaveOn();
	hgPrtWTextXyM("’Ÿ¡µAŸi  aÃ¡¡a", text);

	hgRetMSize(text, &x1, &y1, &x2, &y2);
	hgDrawBorder(x1 + 24, y1 + 49, x1 + 22 + 36, y1 + 47 + 36, BOXNORMAL, FILL);

	p = hgHICON_Load("nurie.hic");
	if (p != NULL) {
		hgHICON_Draw(p, x1 + 26, y1 + 51);
		hgHICON_Free(&p);
	}

	do {
		ch = windelay(x1, y1, x2, y2);
		if (ch == MOUSE_LEFT || ch == MOUSE_RIGHT) ch = NOKEY;
	} while (ch == NOKEY);

	hgRestore();
	hgSetSaveOff();
}

void     nreAboutComm()
{
	char   *text[] = {
		"  ’Ÿ¡µA œe ¸aÁA Ðe‹i·i ¸wÐe É·¯¥ ",
		" µA¢‰A·¡Èá·³“¡”a. EGA, VGA, HercµA ",
		" ‰Å‰´ô·¡ •·¸b–A‰¡ mouse•¡ »¡¶¥Ða¡a ",
		" ‹¡¹¥· µA¢‰A·¡Èá· ·A¶wÐe ‹¡“w·i  ",
		" Í¡ÐqÐa‰¡ ·¶¯s“¡”a.                 ",
		" ¯¥ ¬w•¥³¡· commtalkµÁ Ðe ¶»¥³¡· ",
		" Ðe‹i œa·¡§aœáŸ¡µA •¡¶‘·i ¤h´v·q·i  ",
		" ·¡ ¸aŸ¡µA¬á ˆq¬a —aŸ³“¡”a.         ",
		" ¥¡”a ÐqA ’Ÿ¡“e £¡œŸi ¶áÐ... ", ""
	};

	mouse_window("’Ÿ¡µAœe..", text);
}

void     nreHelpComm()
{
	char   *items[] = {
		"’Ÿ¡µA ­¡ˆ  ", "’Ÿ¡µA ‹i®A  ", "Íe»³‹¡ ‹i®A  ", "’Ÿ¡µAœe..   ",
		"¬a¶w¬é¡w¬á   ", "·q´b ‹¡“w    ", "”ib ¥¡‹¡    ", "´a·¡—¡ ‰ÅŸ¡  ",
		"ˆa‹¡ ¡A“A    ", "•¡¯a ¡ww    ", "a—i·¡       ", "{‹¡       ",
		"¬a¶w Í¡Ëa    ", "¸å­· ­¢•¡    ", "ÌŸ¡Ë¡ §¡Ëa  ", "•A·¡Èa §¡Ëa  ",
		"¸÷»¡ §¡Ëa    ", "¸åÑÁ ¹·ŸA    ", "Á¡‹¡ÑÁ ¡ww  ", "¡¡•Q ¬wÈ    ",
		"¸á½¢ Ðe‹i    ", "Èá£¡i ¬åÈ‚  ", "»¡µe ¯¡ˆe    ", "¸åÑÁ ”‹¡¯¡ˆe",
		"µc´á ˆé‹¡    ", "¥¡‹¡ ¤w¤ó  ", "¤h‹¡ ¤w¤ó    ", "ÑÅ‰w ¸á¸w    ",
		"ÑÁ·© ¥¡‘    ", "ÑÁ·© ¤h‹¡    ", "ÑÁ·© Íe»³    ", "¤h‹¡ ¡¢¢    ",
		"ÑÁ¡e ˆi¢Ÿ¡  ", "ˆi¢Ÿ¡ ¯¡¸b  ", "PCXÑÁ·© ¥¡‹¡ ", "HWPÑÁ·© ¥¡‹¡ ",
		"´sÂ‚ÑÁ·© ¥¡‹¡", "ÑÁ¡e »¡¶‹¡  ", "CR/LF ¥eÑÅ   ", "¸åÑÁ ˆé‹¡    ",
		"·¡´¡‹¡  a”w  ", "‹i®A ¸÷·    ", "—¡¤á‹a ¯¡¸b  ", "¸åÑÁ g‹¡    ",
		"¸÷»¡ ¯¥Ñ¡    ", "Ðe‹i ¹·ŸA    ", "µw¢… ‹i©    ", "Ðe‹i ‹i©    ",
		"Ðe¸a ·¡Ÿq    ", "Ðe¸a ¥eÑÅ    ", "¡A“A ÑÁ·©    ", "¬‚Œi ¤aŽ‘    ",
		"Äá¬á ¡¡´·    ", " a¶¯a Äá¬á  ", "‹aŸ± ¬wÈ    ", "¡¡•Q Á¡‹¡ÑÁ  ",
		"¸aŠ‚ ¤eÐ·    ", "·©”·© É·¯¥  ", "”õ i ¤aŽ‘    ", "¸÷Ÿ¡Ða‹¡     ",
		"”ÑÁ·¥ »¡¸÷  ", ""
	};

	hgSetSaveOn();
	hgSelectDirHelpBoxXyM(items, "•¡¶‘ i Àx´a¥¡‹¡", "nurie.hhf", "nurie.hix");
	hgRestore();
	hgSetSaveOff();
}

void     nreDosComm()
{
	char   temp[50];
	int    flag;

	hgSetSaveOn();
	hgEngInModeOn();
	hgInitStr(temp, 50);
	flag = hgGetText(" ¯©Ð—¯¡Ç© •¡¯a ¡ww·e? ", temp, 40, CYAN);
	hgEngInModeOff();
	hgRestore();
	hgSetSaveOff();

	if (flag == ESC) return;
	if (temp[0] == '\0') return;

	hgSetMouseEnd();
	hgSetMode(hgTEXT);

	system(temp);
	printf("Press any key to return to NURIE v1.5\n");
	inkey(WAIT);

	hgAutoSetDisplay();
	hgSetMode(hgGRAPHICS);
	hgSetRealWindow(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety2r() - 30);
	hgSetMouseInit();
	comClearScreen();
	comDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);
	if (comIsChatting()) comDisplayChatStatus();
	comRestoreScreen();
}

void     nreShellComm()
{
	char   *cspc;

	hgSetMouseEnd();
	hgSetMode(hgTEXT);

	printf("Type 'EXIT' to return to NURIE v1.5\n");
	printf("%s%ld%s\n", " Available memory :   ", coreleft(), " bytes ");
	cspc = getenv("COMSPEC");
	if (spawnlp(P_WAIT, cspc, cspc, NULL) == -1) errorsound();

	hgAutoSetDisplay();
	hgSetMode(hgGRAPHICS);
	hgSetRealWindow(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety2r() - 30);
	hgSetMouseInit();
	comClearScreen();
	comDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);
	if (comIsChatting()) comDisplayChatStatus();
	comRestoreScreen();
}

void     nreHanInTypeMain()
{
	char   *text[] = {
		"  –¤é¯¢  ",
		"  ­A¤é¯¢  ",""
	};
	int    ret;
	char   spos;

	hgSetSaveOn();
	spos = hgGetInMethod();
	ret = hgSelectXyM(text, (int)spos - 2);
	hgSetSaveOff();

	if (ret != -1) {
		switch (ret) {
			case 0 :
				hgSetInMethod(hgHAN2);
				break;
			case 1 :
				hgSetInMethod(hgHAN3);
				break;
		}
	}

	inmethod_status();
}

void     nreHanFontMain()
{
	char   *text[] = {
		"   ¡w¹¡ÁA   ",
		"   ¬‘¢‰ÁA   ",
		"   ŠŠ·eÁA   ",
		"   ‰¡—¢ÁA1  ",
		"   ‰¡—¢ÁA2  ",
		"   Ï©‹¡ÁA1  ",
		"   Ï©‹¡ÁA2  ",
		"  ­¥‹i³¡ÁA  ",
		" –—‹e‹i³¡ÁA ",
		" ´aœÐe‹iÁA ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, hfonttype);
	hgSetSaveOff();

	if (ret != -1) {
		switch (ret) {
			case 0 :
				hgSetHanFont(MYUNGJO_HAN);
				break;
			case 1 :
				hgSetHanFont(PPALAE_HAN);
				break;
			case 2 :
				hgSetHanFont(HANIYG_HAN);
				break;
			case 3 :
				hgSetHanFont(GODIK1_HAN);
				break;
			case 4 :
				hgSetHanFont(GODIK2_HAN);
				break;
			case 5 :
				hgSetHanFont(PILGI_HAN);
				break;
			case 6 :
				hgSetHanFont(HANPIL_HAN);
				break;
			case 7 :
				hgSetHanFont(HANSON_HAN);
				break;
			case 8 :
				hgSetHanFont(HANBOOT_HAN);
				break;
			case 9 :
				hgSetHanFont(HWP_HAN);
				break;
		}
		hfonttype = ret;
	}

	edScreenjob = 0x8000;
}

void     nreEngFontMain()
{
	char   *text[] = {
		"  »¥Ðe ‹i³¡ÁA  ",
		"  ¸b·e ‹i³¡ÁA  ",
		"   Çe ‹i³¡ÁA   ",
		"   ´e ‹i³¡ÁA   ",
		"    ·¡È‰Ÿ¢ÁA   ",
		"    Roman ÁA   ",
		"     AD24 ÁA   ",
		"     Ï©‹¡ÁA    ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, efonttype);
	hgSetSaveOff();

	if (ret != -1) {
		switch (ret) {
			case 0 :
				hgSetEngFont(BOLD_ENG);
				break;
			case 1 :
				hgSetEngFont(SMALL_ENG);
				break;
			case 2 :
				hgSetEngFont(BIG_ENG);
				break;
			case 3 :
				hgSetEngFont(INBOLD_ENG);
				break;
			case 4 :
				hgSetEngFont(ITALIC_ENG);
				break;
			case 5 :
				hgSetEngFont(ROMAN_ENG);
				break;
			case 6 :
				hgSetEngFont(AD24_ENG);
				break;
			case 7 :
				hgSetEngFont(PILGI_ENG);
				break;
		}
		efonttype = ret;
	}

	edScreenjob = 0x8000;
}

void     nreHanjaFileMain()
{
	int   flag;

	flag = hgGetFileName(" Ðe¸a ‹i© ÑÁ·© »¡¸÷ ", hanjafile);

	if (flag) {
		hgHanjaEnd();
		hgHanjaInit(hanjafile, 100);
	}
}

void     nreCursorMain()
{
	char   *text[] = {
		" Äá¬á ´e¥¡·± ",
		" §iœâ ¤e¼b·± ",
		" §iœâ ‰¡¸÷Ñw ", ""
	};
	int    ret;
	int    spos;

	hgSetSaveOn();
	spos = hgGetCursorType();
	ret = hgSelectXyM(text, spos);
	hgSetSaveOff();

	if (ret != -1) hgSetCursorType(ret);
}

void     nreMouseCursMain()
{
	char   *text[] = {
		" ¥¡É· ÑÁ¬iÎa ",
		" ¯³¸aÑw      ",
		" ¢‰·qÎa      ",
		" ´a“©˜      ",
		" ¯¡‰        ",
		" ¢‰¤w¶‰      ",
		" ÑÁ¬iÎa2     ",""
	};
	int    ret;
	int    spos;

	if (!hgGetMouse()) return;

	hgSetSaveOn();
	spos = hgGetMouseType();
	ret = hgSelectXyM(text, spos);
	hgSetSaveOff();

	if (ret != -1) hgSetMouseType(ret);
}

void     comMainRoutine()
{
	int   extflag;
	int   key;
	int   ret;

	comInitialize();

	comInitPulldown();

	comClearScreen();
	comDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);

	nreBeginLogo();
	nreInitModem();
	comTelInit();

	while (1) {
		comCrtOut(10);
		key = comCursor();
		if (key == NOKEY) continue;
		extflag = comFuncProcess(key);
		if (extflag == _NORMAL_KEYCODE) comToPort(key);
		else if (extflag == _EXIT_KEYCODE) comChoosePulldown();
	}
}

void     comEndRoutine()
{
	int   flag;

	flag = comVerify();
	if (flag == -1) return;

	adVerifyMusic();
	comEndPulldown();
	comTelEnd();

	nreEndLogo();
	nreEndScreen();

	exit(1);
}

void     edMainRoutine()
{
	int   key;
	int   extflag;

	if (!edSetInit()) return;

	edInitPulldown();

	edClearScreen();
	edDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);

	endflag = hgFALSE;

	do {
		if (edScreenjob) edScreenChange();
		key = edCursor();
		if (key == NOKEY) continue;
		extflag = edFuncProcess(key);
		if (extflag == _NORMAL_KEYCODE) {
			if (key & 0x8000) edhan_process(key & 0x7fff);
			else if ((key >= 32 && key <= 255) || (key == TAB) || (key == ESC))
				edeng_process(key);
			else edKeyProcess(key);
		}
		else if (extflag == _EXIT_KEYCODE) edChoosePulldown();
	} while (!endflag);
}

void     edEndRoutine()
{
	int   flag;

	flag = edVerify();
	if (flag == -1) return;

	endflag = hgTRUE;

	edEndPulldown();
	edSetEnd();

	comClearScreen();
	comDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);
	if (comIsChatting()) comDisplayChatStatus();
	comRestoreScreen();
}

void     comInitPulldown()
{
	WIDTH  pw[7] = {
		{ 136, 180 }, { 136, 160 }, { 152, 160 }, { 152, 180 },
		{ 144, 160 }, { 144, 180 }, { 144, 140 }
	};

	WIDTH   dw;
	WCOLOR  pc;

	char   *item[8] = {
		" ´e   ", " ¡¡ •Q  ", " ÑÅ ‰w  ", " ¬áŸAÀé ",
		"Ëb®‹¡“w", " Ðe ‹i  ", " ¸a •·  ", ""
	};
	char   *text[7][10] = {
		{ " ’Ÿ¡µAœe..  @H ", " ¬a¶w¬é¡w¬á  F1 ", " ·q´b ‹¡“w   @P ", " ”ib ¥¡‹¡   @Y ",
		  " ´a·¡—¡ ‰ÅŸ¡ @F ", " ˆa‹¡ ¡A“A @SPC ", " •¡¯a ¡ww   @J ", " a—i·¡      @S ", " {‹¡      @X ", "" },
		{ " ¬a¶w Í¡Ëa   @1 ", " ¸å­· ­¢•¡   @2 ", " ÌŸ¡Ë¡ §¡Ëa @3 ", " •A·¡Èa §¡Ëa @4 ",
		  " ¸÷»¡ §¡Ëa   @5 ", " ¸åÑÁ ¹·ŸA   @6 ", " Á¡‹¡ÑÁ ¡ww @7 ", " ¡¡•Q ¬wÈ   @8 ", ""},
		{ " ¸á½¢ Ðe‹i     @9 ", " Èá£¡i ¬åÈ‚   @0 ", " »¡µe ¯¡ˆe     ^T ", " ¸åÑÁ ”‹¡¯¡ˆe ^P ",
		  " ‰­¢ ˆé‹¡     ^C ", " ¥¡‹¡ ¤w¤ó   ^U ", " ¤h‹¡ ¤w¤ó     ^D ", " ÑÅ‰w ¸á¸w     @W ", ""},
		{ " ÑÁ·© ¥¡‘   PgUp ", " ÑÁ·© ¤h‹¡   PgDn ", " ÑÁ·© Íe»³     @V ", " ¤h‹¡ ¡¢¢     ^L ",
		  " ÑÁ¡e ˆi¢Ÿ¡   @G ", " ˆi¢Ÿ¡ ¯¡¸b   @L ", " PCXÑÁ·© ¥¡‹¡  @Z ", " HWPÑÁ·© ¥¡‹¡  @K ", " ´sÂ‚ÑÁ·© ¥¡‹¡ @I ", ""},
		{ " ÑÁ¡e »¡¶‹¡  @A ", " CR/LF ¥eÑÅ  ^F6 ", " ¸åÑÁ ˆé‹¡    @D ", " ·¡´¡‹¡  a”w  @C ",
		  " ‹i®A ¸÷·    @M ", " —¡¤á‹a ¯¡¸b ^F0 ", " ¸åÑÁ g‹¡   ^F9 ", " ¸÷»¡ ¯¥Ñ¡    @B ", ""},
		{ " Ðe‹i ¹·ŸA    F6 ", " µw¢… ‹i©    F7 ", " Ðe‹i ‹i©    F8 ", " Ðe¸a ·¡Ÿq   ^F5 ",
		  " Ðe¸a ¥eÑÅ   ^F7 ", " ¡A“A ÑÁ·©    @Q ", " ¬‚Œi ¤aŽ‘    @E ", " Äá¬á ¡¡´·   ^F1 ", "  a¶¯a Äá¬á ^F2 ", ""},
		{ " ‹aŸ± ¬wÈ    @N ", " ¡¡•Q Á¡‹¡ÑÁ  @O ", " ¸aŠ‚ ¤eÐ·    @R ", " ·©”·© É·¯¥  @U ",
		  " ”õ i ¤aŽ‘    @T ", " ¸÷Ÿ¡Ða‹¡    ^F8 ", " ”ÑÁ·¥ »¡¸÷  F5 ", ""}
	};

	int    x[7] = { 15, 90, 165, 240, 315, 390, 465 };
	int    tenable[7] = { 1, 1, 1, 1, 1, 1, 1 };
	int    enable[7][9] = {
		{ 1, 1, 1, 1, 1, 1, 1, 1, 1 }, { 1, 1, 1, 1, 1, 1, 1, 1 },
		{ 1, 1, 1, 1, 1, 1, 1, 1 }, { 1, 1, 1, 1, 1, 1, 1, 1, 1 },
		{ 1, 1, 1, 1, 1, 1, 1, 1 }, { 1, 1, 1, 1, 1, 1, 1, 1, 1 },
		{ 1, 1, 1, 1, 1, 1, 1 }
	};
	int     i;

	if (!hgGetMouse()) enable[5][7] = 0;	/* mouse cursor disable */

	hgWCOLOR_Load(&pc, wcBOXNORMAL, ZERO, DARKGRAY, LIGHTGRAY);

	for (i = 0;i < 7;i++) {
		cpu[i] = hgHPOPUP_Load(text[i], pc, pw[i]);
		hgHPOPUP_Loadcode(cpu[i], enable[i]);
	}

	hgWIDTH_Load(&dw, 640, 30);
	cpd = hgHPULLDOWN_Load(item, x, dw, cpu);
	hgHPULLDOWN_Loadcode(cpd, tenable);
}

void     comChoosePulldown()
{
	char   *Buff;
	int    xx, yy;

	Buff = (char *)malloc((size_t)hgImgSize(hgGetx1r(), hgGety1r(),
						hgGetx2r(), hgGety1r() + 30));
	hgHideMouse();
	hgGetImage(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety1r() + 30, Buff);
	hgShowMouse();

	if (capflag) strcpy(cpd->p[3]->items[5], " ˆi¢Ÿ¡ {     @L ");
	else strcpy(cpd->p[3]->items[5], " ˆi¢Ÿ¡ ¯¡¸b   @L ");
	if (lineflag) strcpy(cpd->p[4]->items[1], " CR¡ ¥eÑÅ   ^F6 ");
	else strcpy(cpd->p[4]->items[1], " CR/LF ¥eÑÅ  ^F6 ");
	if (debugflag) strcpy(cpd->p[4]->items[5], " —¡¤á‹a {   ^F0 ");
	else strcpy(cpd->p[4]->items[5], " —¡¤á‹a ¯¡¸b ^F0 ");

	hgHPULLDOWN_Choose(cpd, hgGetx1r(), hgGety1r(), -1, &xx, &yy);

	hgHideMouse();
	hgPutImage(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety1r() + 30, Buff);
	free(Buff);
	hgShowMouse();

	if (xx != -1) (*comHotkeyfunc[xx][yy])();
}

void     comEndPulldown()
{
	int   i;

	for (i = 0;i < 7;i++)
		hgHPOPUP_Free(&(cpu[i]));

	hgHPULLDOWN_Free(&cpd);
}

void     edInitPulldown()
{
	WIDTH  pw[3] = {
		{ 128, 80 }, { 144, 140 }, { 144, 140 }
	};

	WIDTH   dw;
	WCOLOR  pc;

	char   *item[4] = {
		"  ´e    ", "  ¬áŸAÀé  ", "  Ðe ‹i   ", ""
	};
	char   *text[3][8] = {
		{ " ’Ÿ¡µAœe.. @H ", " ¬a¶w¬é¡w¬á F1 ", " a—i·¡     @J ", " {‹¡     @X ", "" },
		{ " ¬  ‹i       @N ", " ˆa¹aµ¡‹¡     @O ", " ”a¯¡ ¦Ÿa‹¡ @F3 ", " ¬ ·¡Ÿq·a¡  @W ",
		  " ¸á¸wÐa‹¡     @S ", " ¡¢¢ ¥¡‹¡    @D ", " ¡¢¢ ¤aŽ‹¡  @C ", ""},
		{ " Ðe‹i ¹·ŸA    F6 ", " µw¢… ‹i©    F7 ", " Ðe‹i ‹i©    F8 ", " Ðe¸a ·¡Ÿq   ^F5 ",
		  " ¬‚Œi ¤aŽ‘    @E ", " Äá¬á ¡¡´·   ^F1 ", "  a¶¯a Äá¬á ^F2 ", ""}
	};

	int    x[3] = { 50, 220, 380 };
	int    tenable[3] = { 1, 1, 1 };
	int    enable[3][7] = {
		{ 1, 1, 1, 1 }, { 1, 1, 1, 1, 1, 1, 1 }, { 1, 1, 1, 1, 1, 1, 1 }
	};
	int     i;

	if (!hgGetMouse()) enable[2][6] = 0;	/* mouse cursor disable */

	hgWCOLOR_Load(&pc, wcBOXNORMAL, ZERO, DARKGRAY, LIGHTGRAY);

	for (i = 0;i < 3;i++) {
		epu[i] = hgHPOPUP_Load(text[i], pc, pw[i]);
		hgHPOPUP_Loadcode(epu[i], enable[i]);
	}

	hgWIDTH_Load(&dw, 640, 30);
	epd = hgHPULLDOWN_Load(item, x, dw, epu);
	hgHPULLDOWN_Loadcode(epd, tenable);
}

void     edChoosePulldown()
{
	char   *Buff;
	int    xx, yy;

	Buff = (char *)malloc((size_t)hgImgSize(hgGetx1r(), hgGety1r(),
						hgGetx2r(), hgGety1r() + 30));
	hgHideMouse();
	hgGetImage(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety1r() + 30, Buff);
	hgShowMouse();

	hgHPULLDOWN_Choose(epd, hgGetx1r(), hgGety1r(), -1, &xx, &yy);

	hgHideMouse();
	hgPutImage(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety1r() + 30, Buff);
	free(Buff);
	hgShowMouse();

	if (xx != -1) (*edHotkeyfunc[xx][yy])();
}

void     edEndPulldown()
{
	int   i;

	for (i = 0;i < 3;i++)
		hgHPOPUP_Free(&(epu[i]));

	hgHPULLDOWN_Free(&epd);
}

int     comFuncProcess(int key)
{
	int   ret_flag = _NORMAL_KEYCODE;
	int   i, j;

	for (i = 0;i < 8;i++)
		for (j = 0;j < 9;j++)
			if (comHotkeys[i][j] == key) {
				if (!is_complete()) init_code();
				(*comHotkeyfunc[i][j])();
				ret_flag = _SPECIAL_KEYCODE;
				break;
			}

	if (key >= SHIFT_F1 && key <= SHIFT_F10) {
		if (!is_complete()) init_code();
		comMacroSend(key - (SHIFT_F1));
		ret_flag = _SPECIAL_KEYCODE;
	}
	if (key >= ALT_F1 && key <= ALT_F10) {
		if (!is_complete()) init_code();
		comMacroSend(key - (ALT_F1) + 10);
		ret_flag = _SPECIAL_KEYCODE;
	}

	if (key == F10 || key == LEFTMARK)
		ret_flag = _EXIT_KEYCODE;

	return(ret_flag);
}

int     edFuncProcess(int key)
{
	int   ret_flag = _NORMAL_KEYCODE;
	int   i, j;

	for (i = 0;i < 3;i++)
		for (j = 0;j < 7;j++)
			if (edHotkeys[i][j] == key) {
				if (!is_complete()) init_code();
				(*edHotkeyfunc[i][j])();
				ret_flag = _SPECIAL_KEYCODE;
				break;
			}

	if (key == F10 || key == LEFTMARK)
		ret_flag = _EXIT_KEYCODE;

	return(ret_flag);
}

void     mouse_window(char *title, char *text[])
{
	int   x1, y1, x2, y2;
	int   ch;

	hgSetSaveOn();
	hgPrtWTextXyM(title, text);

	hgRetMSize(text, &x1, &y1, &x2, &y2);

	do {
		ch = windelay(x1, y1, x2, y2);
		if (ch == MOUSE_LEFT || ch == MOUSE_RIGHT) ch = NOKEY;
	} while (ch == NOKEY);

	hgRestore();
	hgSetSaveOff();
}

void     prt_message(char *title, char *text)
{
	char   *t[2];

	t[0] = (char *)malloc((size_t)(strlen(text) + 2));
	t[1] = (char *)malloc((size_t)3);

	strcpy(t[0], text);
	strcpy(t[1], "");

	mouse_window(title, t);

	free(t[0]);
	free(t[1]);
}

void     errorf()
{
	char   *text[3];

	text[0] = (char *)malloc((size_t)37);
	text[1] = (char *)malloc((size_t)37);
	text[2] = (char *)malloc((size_t)3);

	strncpy(text[0], (errno > 35) ? errmsg[errno - 36] : sys_errlist[errno], 36);
	strcpy(text[1], "  <ESC> Ç¡Ÿi ’Ÿa­A¶a.  ");
	strcpy(text[2], "");

	hgSetSaveOn();
	hgDisplayText(text, RED);
	while (inkey(WAIT) != ESC);
	hgRestore();
	hgSetSaveOff();

	free(text[0]);
	free(text[1]);
	free(text[2]);

	errno = 0;
}

void     handler()
{
	char   *butt[2];
	char   *buti[] = { " ”a¯¡ Ðe¤å ", " ¸b´ó Âá­¡ ", "" };
	int    error;
	int    flag;

	butt[0] = (char *)malloc((size_t)37);
	butt[1] = (char *)malloc((size_t)3);

	error = _DI;
	if (error < 14) strcpy(butt[0], c_message[error]);
	else strcpy(butt[0], "    SYSTEM ERROR    ");
	strcpy(butt[1], "");

	hgSetSaveOn();
	flag = hgPrtButtonBarXyM(butt, buti);
	hgRestore();
	hgSetSaveOff();

	free(butt[0]);
	free(butt[1]);

	hardretn(flag + 1);
}

int      cbrk_handler()
{
	return(1);
}

void     sethandle()
{
	ctrlbrk(cbrk_handler);		/* Ctrl-Break ÀáŸ¡ žË¥ :
					   void ctrlbrk(int (*handler)());
					   handlerµA ·Ð »¡¸÷–E ÀáŸ¡Ðq®Ÿi ¬é¸÷Ðaµa
					   ·¥ÈáœóËa 0x23·i ¥e‰wÐe”a. */
	harderr(handler);		/* Ða—a¶Á´á µAœá ¤i¬—¯¡ ÀáŸ¡Ði Ðq®Ÿi ¸÷·
					   void harderr(int (*handler)()); */
}

void     beep()
{
	sound(500);
	delay(50);
	nosound();
}

void     errorsound()
{
	sound(3000);
	delay(300);
	nosound();
}

void     toggle_sound()
{
	sound(500);
	delay(40);
	nosound();
	delay(30);
	sound(750);
	delay(30);
	nosound();
}

void    connect_sound()
{
	int   i;

	for (i = 0;i < 6;i++) {
		sound(500 + i * 100);
		delay(100);
		sound(500 - i * 50);
		delay(100);
	};
	sound(500 + i * 100);
	nosound();
}

