/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : nre_comm.c  -- É·¯¥ ¡A·¥ žË¥                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <ctype.h>
#include    <dos.h>
#include    <process.h>
#include    <stdlib.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "comdef.h"

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     UPLOAD       0
#define     DOWNLOAD     1

#define     NORMALOPT    0
#define     CODEOPT      1
#define     NUMOPT       2
#define     SYMOPT       3

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     capflag = hgFALSE;		/* ˆi¢Ÿ¡ µa¦ */
char     debugflag = hgFALSE;		/* —¡¤á‹a µa¦ */
char     echoflag = hgFALSE;		/* ¸aŠ‚ ¤eÐ· µa¦ */
char     hanjaflag;			/* Ðe¸a ¥eÑÅ µa¦ */
char     lineflag = hgFALSE;		/* CR/LF µa¦ */
char     connectflag = hgFALSE;		/* ¸åÑÁ µe‰i µa¦ */
char     _1vs1flag = hgFALSE;		/* ·©”·© É·¯¥ µa¦ */
char     sflag = hgFALSE;		/* ´a¯aÇ¡ ¥¡‹¡ µa¦ */
extern   char     manflag;

int      terminal;			/* Èá£¡i ¡¡—a */
struct   time     ontime, nowtime;
long     connecttime = 0L, totaltime = 0L;

char     phone[2] = { 'P', 'T' };	/* ¸åÑÁ ¹·ŸA */
int      phoneflag;
int      chardelay, linedelay;		/* »¡µe ¯¡ˆe */
int      dialdelay;			/* ¸åÑÁ ”‹¡ ¯¡ˆe */
int      chaindial;			/* ‰­¢ ˆé‹¡ */
extern   int      cport;
extern   int      dataflag, stopflag, baudflag;
extern   char     parflag;
extern   long     bauds[];

extern   char     comFORE, comBACK;
extern   char     comTF, comTB;
extern   char     edTF, edTB;

char     initcom[60] = { "" };		/* ¡¡•Q Á¡‹¡ÑÁ ¡ww */
char     upmethod[60] = { "" };		/* ¥¡‹¡ ¤w¤ó */
char     downmethod[60] = { "" };	/* ¤h‹¡ ¤w¤ó */
char     downdir[80] = { "" };		/* ¤h‹¡ ¡¢¢ */
extern   char     hanjafile[50];
extern   char     mnufile[50];

char     macros[20][50];		/* ‹i®A ¸÷· 20ˆ */
char     tabstr[40];			/* ”õ i */
extern   char     screen[30][80];

FILE    *cap;                           /* ˆi¢Ÿ¡ ÑÁ·© */
char     cfgfile[50] = { "NURIE.CFG" };
char     capfile[50] = { "NURIE.CAP" };
char     imgfile[50] = { "NURIE.IMG" };
char     upfile[50] = { "*.NRE" };

char     code_opt = NORMALOPT;
byte     code_str[10];
int      code_no = 0;
int      code_pos = 0;

extern   int      base;
extern   int      comrow, comcol;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nrePortNum();			/* ¬a¶w Í¡Ëa  @1 */
void     nreSpeedBPS();			/* ¸å­· ­¢•¡  @2 */
void     nreParityBit();		/* ÌŸ¡Ë¡ §¡Ëa  @3 */
void     nreDataBit();			/* •A·¡Èa §¡Ëa  @4 */
void     nreStopBit();			/* ¸÷»¡ §¡Ëa  @5 */
void     nrePhoneType();		/* ¸åÑÁ ¹·ŸA  @6 */
void     nreInitType();			/* Á¡‹¡ÑÁ ¡ww  @7 */
void     nreModemStatus();		/* ¡¡•Q ¬wÈ  @8 */

void     nreHostHangul();		/* ¸á½¢ Ðe‹i  @9 */
void     nreTerminal();			/* Èá£¡i ¬åÈ‚  @0 */
void     nreDelayTime();		/* »¡µe ¯¡ˆe  ^T */
void     nreDialDelay();		/* ¸åÑÁ ”‹¡ ¯¡ˆe  ^P */
void     nreChainDial();		/* ‰­¢ ˆé‹¡  ^C */
void     nreUpMethod();			/* ¥¡‹¡ ¤w¤ó  ^U */
void     nreDownMethod();		/* ¤h‹¡ ¤w¤ó ^D */
void     nreSaveCfg();			/* ÑÅ‰w ¸á¸w  @W */

void     nreFileUp();			/* ÑÁ·© ¥¡‘ PgUp */
void     nreFileDown();			/* ÑÁ·© ¤h‹¡ PgDn */
void     nreDownDir();			/* ¤h‹¡ ¡¢¢  ^L */
void     nreScreenCapture();		/* ÑÁ¡e ˆi¢Ÿ¡  @G */
void     nreCaptureToggle();		/* ˆi¢Ÿ¡ ¯¡¸b/{  @L */

void     nreLineToggle();		/* CR/LF ¥eÑÅ  ^F6 */
void     nreMacro();			/* ‹i®A ¸÷·  @M */
void     nreDebugToggle();		/* —¡¤á‹a ¯¡¸b/{  ^F0 */
void     nreHangUp();			/* ¸åÑÁ g‹¡  ^F9 */
void     nreBreak();			/* ¸÷»¡ ¯¥Ñ¡  @B */

void     nreHanjaConv();		/* Ðe¸a ¥eÑÅ  ^F7 */
void     nreChangeCrtColor();		/* ¬‚Œi ¤aŽ‘  @E */

void     nreInitModem();		/* Á¡‹¡ÑÁ ¡ww  @O */
void     nreEchoToggle();		/* ¸aŠ‚ ¤eÐ·  @R */
void     nre1vs1Comm();			/* ·©”·© É·¯¥  @U */
void     nreTabChange();		/* ”õ i ¤aŽ‘  @T */

void     nreSendCSI();			/* Control Sequence  ^S */
void     nreSendRI();			/* Reverse Index  ^R */
void     nreSendIND();			/* Index  ^I */
void     nreSendNEL();			/* Next Line  ^N */

void     comInitialize();
void     comInitVar();
int      comReadCfg();
void     comSaveCfg();
int      comVerify();

void     comCrtOut(int max);
void     comToPort(int key);
void     comStrOutScreen();
void     comCheckCode(byte ch);

int      speed_bps(int pos);
char     parity_bit(char parity);
int      data_bit(int pos);
int      stop_bit(int pos);
int      host_han(int pos);

void     DSZ(int mode);
void     KERMIT(int mode);
void     comUpLoadAscii();
void     comMacroSend(int n);
void     sendline(byte *str, int mstat);


void     nrePortNum()
{
	char   *text[] = {
		"  COM1  ",
		"  COM2  ",
		"  COM3  ",
		"  COM4  ", ""
	};
	int    ret;

	beep();

	hgSetSaveOn();
	hgDisplayMessage("  a¶¯aµÁ Â—•©·¡ –I ® ·¶·a“¡ º·Ða¯³¯¡¶a. ", MAGENTA);
	delay(1000);
	hgRestore();

	comEndPort(1);

	ret = hgSelectXyM(text, cport);
	if (ret != -1) cport = ret;

	modem_status();
	comInitPort();

	hgSetSaveOff();
}

void     nreSpeedBPS()
{
	int   ret;

	ret = speed_bps(baudflag);

	if (ret != -1) {
		baudflag = ret;

		modem_status();
		comSetupPort();
	}
}

void     nreParityBit()
{
	char   ret;

	ret = parity_bit(parflag);

	if (ret != -1) {
		parflag = ret;

		modem_status();
		comSetupPort();
	}
}

void     nreDataBit()
{
	int   ret;

	ret = data_bit(dataflag - 7);

	if (ret != -1) {
		dataflag = ret + 7;

		modem_status();
		comSetupPort();
	}
}

void     nreStopBit()
{
	int   ret;

	ret = stop_bit(stopflag - 1);

	if (ret != -1) {
		stopflag = ret + 1;

		modem_status();
		comSetupPort();
	}
}

void     nrePhoneType()
{
	char   *text[] = {
		" ‹¡‰¯¢ ",
		" ¸å¸a¯¢ ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, phoneflag);
	hgSetSaveOff();

	if (ret != -1) phoneflag = ret;
}

void     nreInitType()
{
	hgSetSaveOn();
	hgSpecInModeOn();
	hgEngInModeOn();
	hgGetText(" Á¡‹¡ÑÁ ¡ww ¬é¸÷ ", initcom, 55, CYAN);
	hgEngInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();
}

void     nreModemStatus()
{
	char   *items[4];
	char   addr[6];
	char   value[6];
	int    i;
	int    base_port;

	items[0] = (char *)malloc((size_t)50);
	items[1] = (char *)malloc((size_t)50);
	items[2] = (char *)malloc((size_t)50);
	items[3] = (char *)malloc((size_t)3);

	strcpy(items[0], "A»¡¯aÈá :  IER  IIR  LCR  MCR  LSR  MSR  ");
	strcpy(items[1], "  Í¡Ëa   :");
	strcpy(items[2], "   ˆt    :");
	strcpy(items[3], "");

	base_port = (DATA - base);
	for (i = (base_port + 1);i < (base_port + 7);i++) {
		sprintf(addr, "%5x", i);
		sprintf(value, "%5x", inportb(i));
		strcat(items[1], addr);
		strcat(items[2], value);
	}

	mouse_window(" ¡¡•Q ¬wÈ ¥¡‹¡ ", items);

	for (i = 0;i < 4;i++) free(items[i]);
}

void     nreDelayTime()
{
	char   temp1[10];
	char   temp2[10];

	itoa(chardelay, temp1, 10);
	itoa(linedelay, temp2, 10);

	hgSetSaveOn();
	hgSpecInModeOn();
	hgDigitInModeOn();

	hgGetText(" ¢…¸a »¡µe ¯¡ˆe ·³b(”e¶á ms) ", temp1, 5, CYAN);
	chardelay = atoi(temp1);
	hgRestore();

	hgGetText(" Ð—ˆe »¡µe ¯¡ˆe ·³b(”e¶á ms) ", temp2, 5, CYAN);
	linedelay = atoi(temp2);
	hgRestore();

	hgDigitInModeOff();
	hgSpecInModeOff();
	hgSetSaveOff();
}

void     nreHostHangul()
{
	int   ret;
	int   spos;

	spos = hgSrcCode();
	ret = host_han(spos - 1);

	if (ret != -1) hgSetCodeTable(ret + 1);

	hosthan_status();
}

void     nreTerminal()
{
	char   *text[] = {
		" VT 100  ",
		" VT 200  ",
		" FS 220b ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, terminal);
	hgSetSaveOff();

	if (ret != -1) terminal = ret;
}

void     nreDialDelay()
{
	char   temp[10];

	itoa(dialdelay, temp, 10);

	hgSetSaveOn();
	hgSpecInModeOn();
	hgDigitInModeOn();
	hgGetText(" ¸åÑÁ ”‹¡¯¡ˆe ·³b(”e¶á s) ", temp, 5, CYAN);
	dialdelay = atoi(temp);
	hgDigitInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();
}

void     nreChainDial()
{
	char   temp[10];

	itoa(chaindial, temp, 10);

	hgSetSaveOn();
	hgSpecInModeOn();
	hgDigitInModeOn();
	hgGetText(" µc´á ˆé‹¡ ¯¡ˆe ·³b(”e¶á ms) ", temp, 5, CYAN);
	chaindial = atoi(temp);
	hgDigitInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();
}

void     nreUpMethod()
{
	hgSetSaveOn();
	hgSpecInModeOn();
	hgEngInModeOn();
	hgGetText(" ¥¡‹¡ ¤w¤ó ", upmethod, 55, CYAN);
	hgEngInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();
}

void     nreDownMethod()
{
	hgSetSaveOn();
	hgSpecInModeOn();
	hgEngInModeOn();
	hgGetText(" ¤h‹¡ ¤w¤ó ", downmethod, 55, CYAN);
	hgEngInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();
}

void     nreSaveCfg()
{
	int   flag;

	flag = hgGetFileName(" ÑÅ‰w·i ¸á¸wÐi ÑÁ·© ·¡Ÿq·e? ", cfgfile);
	if (!flag) return;

	comSaveCfg();

	hgSetSaveOn();
	hgDisplayMessage(" ÑÅ‰w·i ¸á¸wÐ–¯s“¡”a. ", MAGENTA);
	delay(500);
	hgRestore();
	hgSetSaveOff();
}

void     nreFileUp()
{
	char   *text[] = {
		"  X  ¡¡ •Q  ",
		"  Y  ¡¡ •Q  ",
		"  Z  ¡¡ •Q  ",
		"   KERMIT   ",
		"    ASCII   ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, 0);
	hgSetSaveOff();

	if (ret != -1) {
		switch (ret) {
			case 0 :
			case 1 :
			case 2 :
				DSZ(ret);
				break;
			case 3 :
				KERMIT(UPLOAD);
				break;
			case 4 :
				comUpLoadAscii();
				break;
		}
	}
}

void     nreFileDown()
{
	char   *text[] = {
		"  X  ¡¡ •Q  ",
		"  Y  ¡¡ •Q  ",
		"  Z  ¡¡ •Q  ",
		"   KERMIT   ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, 0);
	hgSetSaveOff();

	if (ret != -1) {
		switch (ret) {
			case 0 :
			case 1 :
			case 2 :
				DSZ(ret + 4);
				break;
			case 3 :
				KERMIT(DOWNLOAD);
				break;
		}
	}
}

void     nreDownDir()
{
	char   drive[3], dir[66];

	if (strchr(downdir, '\\') == NULL) {
		sprintf(drive, "%c:", getdisk() + 'A');
		getcurdir(0, dir);
		sprintf(downdir, "%s\\%s", drive, dir);
	}

	hgSetSaveOn();
	hgSpecInModeOn();
	hgEngInModeOn();
	hgGetText(" ¤h‹¡ ¡¢¢ ", downdir, 70, CYAN);
	hgEngInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();
}

void     nreScreenCapture()
{
	FILE   *fp;

	int    ch;
	int    i, j;
	int    flag;

	flag = hgGetFileName(" ÑÁ¡e·i ¸á¸wÐi ÑÁ·© ·¡Ÿq·e? ", imgfile);
	if (!flag) return;

	fp = fopen(imgfile, "a");
	for (j = 0;j < comrow;j++) {
		for (i = 0;i < comcol;i++) {
			ch = screen[j][i];
			fputc(ch, fp);
		}
		fputc(RETURN, fp);
		fputc(LF, fp);
	}
	fclose(fp);

	hgSetSaveOn();
	hgDisplayMessage(" ÑÁ¡e·i ÑÁ·©¡ ¸á¸wÐ–¯s“¡”a. ", MAGENTA);
	delay(1000);
	hgRestore();
	hgSetSaveOff();
}

void     nreCaptureToggle()
{
	int   flag;

	if (!capflag) {
		flag = hgGetFileName(" ˆi¢Ÿ¡Ði ÑÁ·© ·¡Ÿq·e? ", capfile);
		if (!flag) return;

		cap = fopen(capfile, "a");
		if (cap) capflag = 1 - capflag;
	}
	else {
		fclose(cap);
		capflag = 1 - capflag;
	}

	capture_status();
}

void     nreLineToggle()
{
	lineflag = 1 - lineflag;
}

void     nreMacro()
{
	char   temp[15];
	int    i, ch;
	int    mx, my;
	int    ypos;

	hgSetSaveOn();

	hgPrtWindowXy(60, 80, 580, 320, " Ça¡ ¸÷· (Shift F1 - F10, | CR, ~ 1Á¡ »¡µe)");

	hgHideMouse();
	for (i = 0;i < 10;i++) {
		sprintf(temp, "%s%d%s", "SHIFT-F", i + 1, " : ");
		hgOutTextXy(100, 140 + i * 16, temp);
		hgOutTextXy(220, 140 + i * 16, macros[i]);
	}
	hgShowMouse();

	do {
		do {
			ch = windelay(60, 80, 580, 320);
		} while (ch == NOKEY);

		if (ch == MOUSE_LEFT) {
			hgGetMousePos(&mx, &my);
			if (my > 140 && my < 299 && mx > 100 && mx < 539) {
				ypos = (my - 140) / 16;
				ch = SHIFT_F1 + ypos;
			}
		}

		if (ch >= SHIFT_F1 && ch <= SHIFT_F10) {
			ypos = ch - (SHIFT_F1);

			hgSpecInModeOn();
			hgInTextXy(220, 140 + ypos * 16, macros[ypos], 40);
			hgSpecInModeOff();

			hgHideMouse();
			hgOverTextXy(220, 140 + ypos * 16, macros[ypos]);
			hgShowMouse();
		}
	} while (ch !=  LEFTMARK && ch != RIGHTMARK && ch != ESC);

	hgRestore();

	hgPrtWindowXy(60, 80, 580, 320, " Ça¡ ¸÷· (Alt F1 - F10, | CR, ~ 1Á¡ »¡µe)");

	hgHideMouse();
	for (i = 0;i < 10;i++) {
		sprintf(temp, "%s%d%s", "ALT-F", i + 1, " : ");
		hgOutTextXy(100, 140 + i * 16, temp);
		hgOutTextXy(220, 140 + i * 16, macros[i + 10]);
	}
	hgShowMouse();

	do {
		do {
			ch = windelay(60, 80, 580, 320);
		} while (ch == NOKEY);

		if (ch == MOUSE_LEFT) {
			hgGetMousePos(&mx, &my);
			if (my > 140 && my < 299 && mx > 100 && mx < 539) {
				ypos = (my - 140) / 16;
				ch = ALT_F1 + ypos;
			}
		}

		if (ch >= ALT_F1 && ch <= ALT_F10) {
			ypos = ch - (ALT_F1);

			hgSpecInModeOn();
			hgInTextXy(220, 140 + ypos * 16, macros[ypos + 10], 40);
			hgSpecInModeOff();

			hgHideMouse();
			hgOutTextXy(220, 140 + ypos * 16, macros[ypos + 10]);
			hgShowMouse();
		}
	} while (ch !=  LEFTMARK && ch != RIGHTMARK && ch != ESC);

	hgRestore();
	hgSetSaveOff();
}

void     nreDebugToggle()
{
	debugflag = 1 - debugflag;

	debug_status();
}

void     nreHangUp()
{
	hgSetSaveOn();
	if (!connectflag) {
		hgDisplayMessage(" ¬a¶wº—·¡ ´a“³“¡”a. ", RED);
		delay(1000);
	}
	else {
		hgDisplayMessage(" ¸åÑÁŸi g¯s“¡”a. ", MAGENTA);
		comHangUpPort();
	}
	hgRestore();
	hgSetSaveOff();

	connectflag = hgFALSE;

	connect_status();
	comSetupPort();
}

void     nreBreak()
{
	hgSetSaveOn();
	if (!connectflag) {
		hgDisplayMessage(" ¬a¶wº—·¡ ´a“³“¡”a. ", RED);
		delay(1000);
	}
	else {
		hgDisplayMessage(" §aA·¡Ça ¯¥Ñ¡Ÿi ¥¡““¡”a. ", MAGENTA);
		comSendBreak();
	}
	hgRestore();
	hgSetSaveOff();
}

void     nreHanjaConv()
{
	hanjaflag = 1 - hanjaflag;

	hgSetSaveOn();
	if (hanjaflag) hgDisplayMessage(" Ðe¸aŸi Ðe‹i¡ ¥eÑÅÐs“¡”a. ", MAGENTA);
	else hgDisplayMessage(" Ðe¸aŸi ‹a”¡ Â‰bÐs“¡”a. ", MAGENTA);
	delay(1000);
	hgRestore();
	hgSetSaveOff();
}

void     nreChangeCrtColor()
{
	char   *text[] = {
		"  ˆñ¸÷¬‚  ",
		"  Ìaœe¬‚  ",
		"  Á¡¢¬‚  ",
		"  Ða“i¬‚  ",
		"  ¨iˆw¬‚  ",
		"  ºÑ×¬‚  ",
		"  ˆi  ¬‚  ",
		" ¤j·eÒA¬‚ ",
		"  ÒA  ¬‚  ",
		" ¤j·eÌaœw ",
		"  µe–¬‚  ",
		" ¤j·eÐa“i ",
		" ¤j·e¨iˆw ",
		" ¤j·eºÑ× ",
		"  ‘¡œe¬‚  ",
		"  Ó…  ¬‚  ", ""
	};
	char   csave;
	int    ret;

	if (hgIsHerc()) {
		csave = comFORE;
		comTF = comFORE = comBACK;
		comTB = comBACK = csave;
	}
	else {
		hgSetSaveOn();
		hgDisplayMessage(" ‹i¸a¬‚ ¬åÈ‚ ", BLUE);
		delay(500);
		hgRestore();
		ret = hgSelectXyM(text, comFORE);
		hgSetSaveOff();

		if (ret != -1) comTF = comFORE = ret;

		hgSetSaveOn();
		hgDisplayMessage(" ¤‰w¬‚ ¬åÈ‚ ", BLUE);
		delay(500);
		hgRestore();
		ret = hgSelectXyM(text, comBACK);
		hgSetSaveOff();

		if (ret != -1) comTB = comBACK = ret;
	}
}

void     nreInitModem()
{
	sendline(initcom, ASCIIUP);
	comDataOut(RETURN);
	if (echoflag) {
		comDataToBuffer(RETURN);
		comDataToBuffer(LF);
	}
}

void     nreEchoToggle()
{
	echoflag = 1 - echoflag;

	echo_status();
}

void     nre1vs1Comm()
{
	_1vs1flag = 1 - _1vs1flag;

	if (_1vs1flag) {
		sendline("ATSO=3", ASCIIUP);
		echoflag = hgTRUE;
	}
	else  {
		echoflag = hgFALSE;
		sendline("ATSO=0", ASCIIUP);
	}
	comDataOut(RETURN);

	echo_status();

	hgSetSaveOn();
	if (_1vs1flag) hgDisplayMessage(" ·©”·© É·¯¥ ”‹¡ ¬wÈ·³“¡”a. ", MAGENTA);
	else hgDisplayMessage(" ¥¡É· ¬wÈ·³“¡”a. ", MAGENTA);
	delay(1000);
	hgRestore();
	hgSetSaveOff();
}

void     nreTabChange()
{
	hgSetSaveOn();
	hgSpecInModeOn();
	hgGetText("  i áŸ¡ ‰¡Ã¡‹¡ ", tabstr, 35, CYAN);
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();

	if (comIsChatting()) tab_status();
}

void     nreSendCSI()
{
	comDataOut(0x9b);
	if (echoflag) comDataToBuffer(0x9b);
}

void     nreSendRI()
{
	comDataOut(0x8d);
	if (echoflag) comDataToBuffer(0x8d);
}

void     nreSendIND()
{
	comDataOut(0x84);
	if (echoflag) comDataToBuffer(0x84);
}

void     nreSendNEL()
{
	comDataOut(0x85);
	if (echoflag) comDataToBuffer(0x85);
}

void     comInitialize()
{
	comInitVar();
	if (comReadCfg() == hgFAIL) comSaveCfg();
	comInitPort();
	comSetInit();
}

void     comInitVar()
{
	int    i;
	char   drive[3], dir[66];

	hgSetCodeTable(KS5601);

	cport = 1;
	dataflag = 8;
	stopflag = 1;
	parflag = 'N';
	baudflag = 1;
	phoneflag = 1;			/* ¸å¸a¯¢ */
	terminal = VT200;

	chardelay = 0;
	linedelay = 0;
	dialdelay = 30;
	chaindial = 100;

	comFORE = WHITE;
	comBACK = BLUE;
	if (hgIsHerc()) comBACK = BLACK;
	edTF = WHITE;
	edTB = BLACK;

	hgSetCursorType(1);
	hgSetMouseType(0);

	hanjaflag = hgFALSE;
	strcpy(hanjafile, "HANJA.FNT");
	hgHanjaInit(hanjafile, 100);

	strcpy(initcom, "AT &C1 B0 &T0");
	strcpy(upmethod, "%P %S d sz %F");
	strcpy(downmethod, "%P %S d rz");
	for (i = 0;i < 20;i++) strcpy(macros[i], "");

	sprintf(drive, "%c:", getdisk() + 'A');
	getcurdir(0, dir);
	sprintf(downdir, "%s\\%s", drive, dir);
}

int      comReadCfg()
{
	FILE   *fp;

	char   temp[40];
	int    code, method;
	int    fcolor, bcolor;
	int    type1, type2;
	int    flag;
	int    i, length;

	fp = fopen(cfgfile, "r");
	if (fp != NULL) {
		fseek(fp, 0L, SEEK_SET);

		length = strlen(fgets(temp, 30, fp));
		temp[length - 1] = 0;
		if (strcmp(temp, "’Ÿ¡µA 1.5 config ÑÁ·©") != 0) {
			errorsound();

			hgSetSaveOn();
			hgDisplayMessage(" ’Ÿ¡µA 1.5 - ÑÅ‰w ¸á¸w ÑÁ·©·¡ ´a“³“¡”a. ", RED);
			delay(1500);
			hgRestore();
			hgSetSaveOff();

			fclose(fp);
			return(hgFAIL);
		}

		for (i = 0;i < 20;i++) {
			length = strlen(fgets(macros[i], 40, fp));
			macros[i][length - 1] = 0;
		}
		length = strlen(fgets(tabstr, 35, fp));
		tabstr[length - 1] = 0;

		fscanf(fp, "%1d %d %d\n", &cport, &chardelay, &linedelay);
		fscanf(fp, "%d %d\n", &dialdelay, &chaindial);
		fscanf(fp, "%1d %1d %c %d\n", &dataflag, &stopflag, &parflag, &baudflag);
		fscanf(fp, "%1d %1d\n", &phoneflag, &terminal);
		fscanf(fp, "%1d %1d\n", &code, &method);
		hgSetCodeTable((char)code);
		hgSetInMethod((char)method);

		fscanf(fp, "%2d %2d\n", &fcolor, &bcolor);
		comFORE = (char)fcolor;
		comBACK = (char)bcolor;
		fscanf(fp, "%2d %2d\n", &fcolor, &bcolor);
		edTF = (char)fcolor;
		edTB = (char)bcolor;
		if (hgIsHerc()) {
			if (comFORE == WHITE) comBACK = BLACK;
			else {
				comFORE = BLACK;
				comBACK = WHITE;
			}
			if (edTF == WHITE) edTB = BLACK;
			else {
				edTF = BLACK;
				edTB = WHITE;
			}
		}

		fscanf(fp, "%1d %1d\n", &type1, &type2);
		hgSetCursorType(type1);
		hgSetMouseType(type2);

		fscanf(fp, "%1d\n", &flag);
		hanjaflag = (char)flag;

		length = strlen(fgets(hanjafile, 40, fp));
		hanjafile[length - 1] = 0;
		hgHanjaInit(hanjafile, 100);

		length = strlen(fgets(mnufile, 40, fp));
		mnufile[length - 1] = 0;

		length = strlen(fgets(initcom, 40, fp));
		initcom[length - 1] = 0;
		length = strlen(fgets(upmethod, 40, fp));
		upmethod[length - 1] = 0;
		length = strlen(fgets(downmethod, 40, fp));
		downmethod[length - 1] = 0;
		fscanf(fp, "%s", downdir);

		fclose(fp);
		return(hgSUCCESS);
	}
	return(hgFAIL);
}

void     comSaveCfg()
{
	FILE   *fp;

	char   temp[40];
	int    code, method;
	int    fcolor, bcolor;
	int    type1, type2;
	int    flag;
	int    i;

	fp = fopen(cfgfile, "w");
	if (fp != NULL) {
		fseek(fp, 0L, SEEK_SET);

		strcpy(temp, "’Ÿ¡µA 1.5 config ÑÁ·©");
		fprintf(fp, "%s\n", temp);

		for (i = 0;i < 20;i++)
			fprintf(fp, "%s\n", macros[i]);
		fprintf(fp, "%s\n", tabstr);

		fprintf(fp, "%1d %d %d\n", cport, chardelay, linedelay);
		fprintf(fp, "%d %d\n", dialdelay, chaindial);
		fprintf(fp, "%1d %1d %c %d\n", dataflag, stopflag, parflag, baudflag);
		fprintf(fp, "%1d %1d\n", phoneflag, terminal);
		code = hgSrcCode();
		method = hgGetInMethod();
		fprintf(fp, "%1d %1d\n", code, method);

		fcolor = (int)comFORE;
		bcolor = (int)comBACK;
		fprintf(fp, "%2d %2d\n", fcolor, bcolor);
		fcolor = (int)edTF;
		bcolor = (int)edTB;
		fprintf(fp, "%2d %2d\n", fcolor, bcolor);

		type1 = hgGetCursorType();
		type2 = hgGetMouseType();
		fprintf(fp, "%1d %1d\n", type1, type2);

		flag = (int)hanjaflag;
		fprintf(fp, "%d\n", flag);

		fprintf(fp, "%s\n", hanjafile);
		fprintf(fp, "%s\n", mnufile);
		fprintf(fp, "%s\n", initcom);
		fprintf(fp, "%s\n", upmethod);
		fprintf(fp, "%s\n", downmethod);
		fprintf(fp, "%s\n", downdir);

		fclose(fp);
	}
}

int      comVerify()
{
	char   *butt[] = {
		"   ¸åÑÁŸi g‰¡ aˆiŒa¶a?   ", ""
	};
	char   *buti[] = { "   µ   ", " ´a“¡¶a ", "" };
	int    flag;

	if (!connectflag) {
		if (capflag) fclose(cap);

		comEndPort(1);
		return(1);
	}

	hgSetSaveOn();
	flag = hgPrtButtonBarXyM(butt, buti);
	hgRestore();

	if (flag != -1) {
		if (capflag) fclose(cap);

		if (flag) hgDisplayMessage(" ‹a·  aÃ³“¡”a. ", MAGENTA);
		else hgDisplayMessage(" ¸åÑÁŸi g¯s“¡”a. ", MAGENTA);
		comEndPort(flag);
		delay(500);
		hgRestore();
	}

	hgSetSaveOff();

	return(flag);
}

void     comCrtOut(int max)
{
	char   tmline[7] = { "00:00\0" };
	char   mess[30];
	byte   ch;
	int    min, hour;
	int    temp;
	int    count = 0;

	if (comIsCarrier()) {
		if (!connectflag) {
			gettime(&ontime);
			connecttime = 0L;
			beep();
			connectflag = hgTRUE;
			connect_status();
		}
		else {
			gettime(&nowtime);
			connecttime = (long)(nowtime.ti_hour - ontime.ti_hour) * 3600
				    + (long)(nowtime.ti_min - ontime.ti_min) * 60
				    + (long)(nowtime.ti_sec - ontime.ti_sec);
			if (connecttime < 0L) connecttime += 86400L;
			connect_status();
		}
	}
	else {
		if (connectflag) {
			totaltime += connecttime;
			beep();
			connectflag = hgFALSE;
			connect_status();

			temp = (int)(totaltime / 60);
			hour = temp / 60;
			min = temp % 60;

			tmline[0] = (byte)(hour / 10) + 0x30;
			tmline[1] = (byte)(hour % 10) + 0x30;
			tmline[3] = (byte)(min / 10) + 0x30;
			tmline[4] = (byte)(min % 10) + 0x30;

			hgSetSaveOn();
			sprintf(mess, " Á· µe‰i¯¡ˆe·e %s ·³“¡”a. ", tmline);
			hgDisplayMessage(mess, BLUE);
			delay(1500);
			hgRestore();
			hgSetSaveOff();
		}
	}

	while (comIsDataReady()) {
		if (manflag) {
			comFindChatMan();
			return;
		}

		ch = comDataIn();
		comCheckCode(ch);
		if (++count > max) break;
	}
}

void     comToPort(int key)
{
	int   extflag;

	extflag = comKeyProcess(key);
	if (extflag == _NORMAL_KEYCODE) {
		if (key & 0x8000) comhan_process(key & 0x7fff);
		else if (key <= 255) comeng_process(key);
	}
}

void     comStrOutScreen()
{
	int   i;

	for (i = 0;i < code_pos;i++)
		comOutScreen(code_str[i]);
	code_pos = 0;
	code_opt = NORMALOPT;
	code_no = 0;
}

void     comCheckCode(byte ch)
{
	if (ch == '$') {
		if (code_opt == NORMALOPT) {
			code_opt = CODEOPT;
			code_str[code_pos++] = ch;
		}
		else if (code_opt == NUMOPT) {
			code_opt = SYMOPT;
			code_str[code_pos++] = ch;
		}
		else if (code_opt == SYMOPT) {
			comOutScreen((byte)code_no);
			comOutScreen('$');
			code_no = 0;
			code_pos = 0;
			code_opt = CODEOPT;
			code_str[code_pos++] = ch;
		}
		else {
			comStrOutScreen();
			code_opt = CODEOPT;
			code_str[code_pos++] = ch;
		}
	}

	else if (ch == '#') {
		if (code_opt == CODEOPT) {
			code_opt = NUMOPT;
			code_str[code_pos++] = ch;
		}
		else if (code_opt == NUMOPT) {
			comOutScreen((byte)code_no);
			comOutScreen('#');
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else {
			code_str[code_pos++] = ch;
			comStrOutScreen();
		}
	}

	else if (ch == ':') {
		if (code_opt == NUMOPT) {
			comOutScreen((byte)code_no);
			comOutScreen(':');
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else if (code_opt == SYMOPT) {
			comOutScreen((byte)code_no);
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else {
			code_str[code_pos++] = ch;
			comStrOutScreen();
		}
	}

	else if (ch == '=') {
		if (code_opt == NUMOPT) {
			comOutScreen((byte)code_no);
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else if (code_opt == SYMOPT) {
			comOutScreen((byte)code_no);
			comOutScreen('=');
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else {
			code_str[code_pos++] = ch;
			comStrOutScreen();
		}
	}

	else if (isdigit(ch)) {
		if (code_opt == NUMOPT) {
			code_str[code_pos++] = ch;
			code_no *= 10;
			code_no += (ch - 48);
		}
		else if (code_opt == SYMOPT) {
			comOutScreen((byte)code_no);
			comOutScreen(ch);
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else {
			code_str[code_pos++] = ch;
			comStrOutScreen();
		}
	}

	else {
		if (code_opt == NUMOPT || code_opt == SYMOPT) {
			comOutScreen((byte)code_no);
			comOutScreen(ch);
			code_pos = 0;
			code_opt = NORMALOPT;
			code_no = 0;
		}
		else {
			code_str[code_pos++] = ch;
			comStrOutScreen();
		}
	}
}

int      speed_bps(int pos)
{
	char   *text[] = {
		"   1200 ",
		"   2400 ",
		"   4800 ",
		"   9600 ",
		"  19200 ",
		"  38400 ",
		"  57600 ",
		" 115200 ",
		"    110 ",
		"    150 ",
		"    300 ",
		"    600 ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, pos);
	hgSetSaveOff();

	return(ret);
}

char     parity_bit(char parity)
{
	char   *text[] = {
		" ´ô·q(N) ",
		" Ñ©®(O) ",
		" ¼b®(E) ", ""
	};
	int    ret;
	int    spos;

	switch (parity) {
		case 'N' :
			spos = 0;
			break;
		case 'O' :
			spos = 1;
			break;
		case 'E' :
			spos = 2;
			break;
	}


	hgSetSaveOn();
	ret = hgSelectXyM(text, spos);
	hgSetSaveOff();

	if (ret == -1) return(-1);
	else {
		switch (ret) {
			case 0 :
				return('N');
			case 1 :
				return('O');
			case 2 :
				return('E');
		}
	}
}

int      data_bit(int pos)
{
	char   *text[] = {
		" 7 §¡Ëa ",
		" 8 §¡Ëa ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, pos);
	hgSetSaveOff();

	return(ret);
}

int      stop_bit(int pos)
{
	char   *text[] = {
		" 1 §¡Ëa ",
		" 2 §¡Ëa ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, pos);
	hgSetSaveOff();

	return(ret);
}

int      host_han(int pos)
{
	char   *text[] = {
		"  ¬w¶w   ¹¡ÐsÑw  ",
		"  ¬q¬÷   ¹¡ÐsÑw  ",
		"  ‹q¬÷   ¹¡ÐsÑw  ",
		"  •¡Œ§¡ ¹¡ÐsÑw  ",
		"  µ• KS  ¹¡ÐsÑw  ",
		"  7 §¡Ëa µÅ¬÷Ñw  ",
		"  KS5601 µÅ¬÷Ñw  ", ""
	};
	int    ret;

	hgSetSaveOn();
	ret = hgSelectXyM(text, pos);
	hgSetSaveOff();

	return(ret);
}

void     DSZ(int mode)
{
	char   file[50] = { "" };
	char   oldpath[40] = { "" };
	char   oldpath2[50] = { "" };
	char   dsz_set[50] = { "" };
	char   cmd[60] = { "" };
	char   port_baud[] = { "port 1 speed \0" };
	char   temp[] = { "1200  \0" };
	char   *option[] = {
		" d sx", " d sb", " d sz", "", " d rc -y", " d rb -y", " d rz -y", ""
	};
	int    i, j;
	int    flag, st;

	if (mode == 3) {
		for (i = 0, j = 0;i < strlen(upmethod); ) {
			if (upmethod[i] == '%') {
				switch (upmethod[i + 1]) {
					case 'P' :
					case 'p' :
						cmd[j++] = cport + 49;
						break;
					case 'S' :
					case 's' :
						ltoa(bauds[baudflag], temp, 10);
						strcat(cmd, temp);
						j += strlen(temp);
						cmd[j++] = SPACE;
						break;
					case 'F' :
					case 'f' :
						break;
					default :
						break;
				}
				i += 2;
			}
			else cmd[j++] = upmethod[i++];
		}
		cmd[j] = 0;
	}

	else if (mode == 7) {
		for (i = 0, j = 0;i < strlen(downmethod); ) {
			if (downmethod[i] == '%') {
				switch (downmethod[i + 1]) {
					case 'P' :
					case 'p' :
						cmd[j++] = cport + 49;
						break;
					case 'S' :
					case 's' :
						ltoa(bauds[baudflag], temp, 10);
						strcat(cmd, temp);
						j += strlen(temp);
						cmd[j++] = SPACE;
						break;
					case 'F' :
					case 'f' :
						break;
					default :
						break;
				}
				i += 2;
			}
			else cmd[j++] = downmethod[i++];
		}
		cmd[j] = 0;
	}

	else {
		port_baud[5] = cport + 49;
		strcat(cmd, port_baud);
		ltoa(bauds[baudflag], temp, 10);
		strcat(cmd, temp);
		strcat(cmd, option[mode]);
	}

	getcurdir(0, oldpath);

	if (mode < 4) {
		flag = hgGetFileName(" º‰¡ ¤h·i ÑÁ·© ·¡Ÿq·e? ", file);
		if (!flag) return;
	}
	else {
		i = 0;
		while (downdir[i] != 0) i++;
		if (i > 0) i--;
		if (downdir[i] == '\\') downdir[i] = 0;
		if (downdir[0] != 0) flag = chdir(downdir);
		if (flag == -1) {
			hgSetSaveOn();
			errorsound();
			hgDisplayMessage(" ¤h‹¡ ¡¢¢·¡ ´ôˆáa Ëiv¯s“¡”a. ", RED);
			delay(1000);
			hgRestore();
			hgSetSaveOff();

			return;
		}
	}

	sprintf(dsz_set, "%c:", getdisk() + 'A');
	strcat(dsz_set, "\\");
	strcat(dsz_set, oldpath);
	strcat(dsz_set, "\\");
	strcat(dsz_set, "DSZ.COM");

	hgSetMouseEnd();
	hgSetMode(hgTEXT);

	st = spawnlp(P_WAIT, dsz_set, "", cmd, file, NULL);

	sprintf(oldpath2, "%c:", getdisk() + 'A');
	strcat(oldpath2, "\\");
	strcat(oldpath2, oldpath);
	chdir(oldpath2);

	hgAutoSetDisplay();
	hgSetMode(hgGRAPHICS);
	hgSetRealWindow(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety2r() - 30);
	hgSetMouseInit();
	comClearScreen();
	comDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);
	if (comIsChatting()) comDisplayChatStatus();
	comRestoreScreen();

	hgSetSaveOn();
	if (st == -1) {
		errorsound();
		hgDisplayMessage(" DSZŸi ¯©Ð—¯¡Ç© ® ´ô¯s“¡”a. ", RED);
	}
	else hgDisplayMessage(" ÑÁ·© ¸å­··¡ {v¯s“¡”a. ", MAGENTA);
	delay(1000);
	hgRestore();
	hgSetSaveOff();
}

void     KERMIT(int mode)
{
	char   file1[50] = { "" };
	char   file2[80] = { "" };
	char   *cmd[] = {
		"set port ? , send    ",
		"set port ? , receive "
	};
	int    i;
	int    flag, st;

	flag = hgGetFileName(" º‰¡ ¤h·i ÑÁ·© ·¡Ÿq·e? ", file1);
	if (!flag && mode == UPLOAD) return;

	i = 0;
	while (downdir[i] != 0) i++;
	if (i > 0) i--;
	if (downdir[i] == '\\') downdir[i] = 0;
	strcpy(file2, downdir);
	strcpy(file2, "\\");
	strcat(file2, file1);

	*(cmd[mode] + 9) = cport + 49;

	hgSetMouseEnd();
	hgSetMode(hgTEXT);

	st = spawnlp(P_WAIT, "KERMIT.EXE", "KERMIT.EXE", cmd[mode], file2, NULL);

	hgAutoSetDisplay();
	hgSetMode(hgGRAPHICS);
	hgSetRealWindow(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety2r() - 30);
	hgSetMouseInit();
	comClearScreen();
	comDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);
	if (comIsChatting()) comDisplayChatStatus();
	comRestoreScreen();

	hgSetSaveOn();
	if (st == -1) {
		errorsound();
		hgDisplayMessage(" KERMITŸi ¯©Ð—¯¡Ç© ® ´ô¯s“¡”a. ", RED);
	}
	else hgDisplayMessage(" ÑÁ·© ¸å­··¡ {v¯s“¡”a. ", MAGENTA);
	delay(1000);
	hgRestore();
	hgSetSaveOff();
}

void     comUpLoadAscii()
{
	FILE   *fp;

	byte   linebuf[128];
	int    flag;

	flag = hgGetFileName(" ¥¡‰ ASCIIÑÁ·© ·¡Ÿq·e? ", upfile);
	if (!flag) return;

	fp = fopen(upfile, "r");
	if (fp != NULL) {
		while (fgets(linebuf, 128, fp) != NULL) {
			sendline(linebuf, ASCIIUP);

			if (inkey(NOWAIT) == ESC) {
				fclose(fp);
				return;
			}
		}
		fclose(fp);
	}
}

void     comMacroSend(int n)
{
	sendline(macros[n], MACRO);
}

void     sendline(byte *str, int mstat)
{
	byte   hg[3] = { 0, 0, 0 };

	sflag = hgTRUE;
	while (*str) {
		hg[0] = *str++;

		if (mstat == MACRO) {
			hg[0] = (hg[0] == '|') ? RETURN : hg[0];
			if (hg[0] == '~') {
				delay(1000);	/* 1Á¡ˆe ‹¡”aŸ± */
				continue;
			}
		}

		if (hg[0] > 128) {
			hg[1] = *str++;
			hgCodeConvStr(SANGYONG, hgSrcCode(), hg);
			comDataOut(hg[0]);
			comDataOut(hg[1]);
			if (echoflag) {
				comDataToBuffer(hg[0]);
				comDataToBuffer(hg[1]);
			}
			hg[1] = 0;
		}
		else {
			comDataOut(hg[0]);
			if (echoflag && hg[0] != RETURN) comDataToBuffer(hg[0]);
		}

		if (hg[0] == RETURN) delay(linedelay);	/* line delay */
		else delay(chardelay);			/* character delay  */

		if (mstat != CHATMODE) comCrtOut(80);
	}

	sflag = hgFALSE;
}
