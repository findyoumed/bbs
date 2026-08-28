/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : key.c  -- Ç¡ ·³bˆt ¤eÑÅ ¡¡—I                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <bios.h>
#include    <ctype.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     HANMODE     1		/* Ðe/µw ¸åÑÅ¯¡ */
#define     ENGMODE     0

#define     FBASE       (0x8000)
#define     MBASE       (0x8000 + 100)
#define     LBASE       (0x8000 + 200)

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     HANMETHOD = hgHAN2;		/* Ðe‹i ·³b ¸aÌe */
char     mode = ENGMODE;                /* Ðe/µw ¸åÑÅ */

extern   char     enginmode;
extern   char     digitinmode;

/* –¤é¯¢ ·³b ´i‰¡Ÿ¡»qµA ¬a¶w–A“e Àq¹¡Îa  */
			/* No Shift¯¡ a - zµA Ð”wÐa“e Ðe‹i Å¡—a ¸aÌe Àq¹¡Îa
			  ¡¡·q‰Á ¸a·q·i Š¥iÐa‹¡ ¶áÐaµa  ¡¡·q Å¡—a“e º—¬÷ Å¡—a + 100 */
byte     NoShiftkey[] = {
	  0,   8, 126,  16,  13,   5,   7,  20, 113, 105,
	107, 103, 129, 127, 120, 104, 110,   9,   2,   4,
	 11, 111,  19,  14,  18, 119,  17
};
			/* Shift¯¡ a - z(A - Z)µA Ð”wÐa“e Ðe‹i Å¡—a ¸aÌe Àq¹¡Îa
			  ¡¡·q‰Á ¸a·q·i Š¥iÐa‹¡ ¶áÐaµa  ¡¡·q Å¡—a“e º—¬÷ Å¡—a + 100
			  ¤A ¸A ”A ˆA ¬A „ …A· ·q­¡ˆa ShiftÇ¡ˆa ’‰a»¥ ¬wÈµA¬á“e
			  ¨A ¼A ˜A ŒA °A „Á …· ·q­¡µA Ð”wÐa£a¡ Ðe‹i Å¡—aŸi ®¸÷ */
byte     Shiftedkey[] = {
	  0,   8, 126,  16,  13,   6,   7,  20, 113, 105,
	107, 103, 129, 127, 120, 106, 112,  10,   3,   4,
	 12, 111,  19,  15,  18, 119,  17
};

/* ­A¤é¯¢ ·³b ´i‰¡Ÿ¡»qµA ¬a¶w–A“e Àq¹¡Îa  */
			/* No Shift¯¡ Ðe‹i Å¡—a ¸aÌe Àq¹¡Îa(¯aÄ… Å¡—a ®…¬á)
			  –¤é¯¢µA¬á Ðe‹i ¸aÌe·a¡ ¬a¶wÐa»¡ ´g´v”å
			  1 2 3 4 5 6 7 8 9 0 ; ' , . /—w·i Ðe‹i ¸aÌe·a¡ ¬a¶wÐe”a.
			  Á¡¬÷, º—¬÷, ¹·¬÷·i Š¥iÐa‹¡ ¶áÐaµa  Á¡¬÷ Å¡—a“e ‹a”¡
			  º—¬÷ Å¡—a“e º—¬÷ Å¡—a + 100, ¹·¬÷ Å¡—a“e ¹·¬÷ Å¡—a + 200 */
unsigned NoShiftkey3[] =  {
		 0,          0, LBASE + 29, LBASE + 22,
	LBASE + 19, MBASE + 19, MBASE + 26, MBASE +  5,
	MBASE + 12, MBASE + 28, MBASE + 20, FBASE + 17,
	       '-',        '=',         BS,        TAB,
	LBASE + 21, LBASE +  9, MBASE + 11, MBASE +  4,
	MBASE +  7, FBASE +  7, FBASE +  5, FBASE +  8,
	FBASE + 16, FBASE + 19,        '[',        ']',
	    RETURN,          0, LBASE + 23, LBASE +  5,
	MBASE + 29, MBASE +  3, MBASE + 27, FBASE +  4,
	FBASE + 13, FBASE +  2, FBASE + 14, FBASE +  9,
	FBASE + 18,        '`',          0,       '\\',
	LBASE + 17, LBASE +  2, MBASE + 10, MBASE + 13,
	MBASE + 20, FBASE + 11, FBASE + 20,        ',',
	       '.', MBASE + 13
};
			/* Shift¯¡ Ðe‹i Å¡—a ¸aÌe Àq¹¡Îa(¯aÄ… Å¡—a ®…¬á)
			  –¤é¯¢µA¬á Ðe‹i ¸aÌe·a¡ ¬a¶wÐa»¡ ´g´v”å
			  1 2 3 4 5 6 7 8 9 0 ; ' , . /—w·i Ðe‹i ¸aÌe·a¡ ¬a¶wÐe”a.
			  Á¡¬÷, º—¬÷, ¹·¬÷·i Š¥iÐa‹¡ ¶áÐaµa  Á¡¬÷ Å¡—a“e ‹a”¡
			  º—¬÷ Å¡—a“e º—¬÷ Å¡—a + 100, ¹·¬÷ Å¡—a“e ¹·¬÷ Å¡—a + 200 */
unsigned Shiftedkey3[] = {
		 0,          0, LBASE + 24,        '@',
	       '#',        '$',        '%',        '^',
	       '&',        '*',        '(',        ')',
	       '_',        '+',         BS,        TAB,
	LBASE + 28, LBASE + 27, LBASE + 26, MBASE +  6,
	       ';',        '<',        '7',        '8',
	       '9',        '>',        '{',        '}',
	    RETURN,          0, LBASE +  8, LBASE +  7,
	LBASE + 10, LBASE +  3,        '/',       '\'',
	       '4',        '5',        '6',        ':',
	       '"',        '~',          0,        '|',
	LBASE + 25, LBASE + 20, LBASE + 11, LBASE + 16,
	       '!',        '0',        '1',        '2',
	       '3',        '?'
};

byte     NumCode[] = {
	0x52, 0x4f, 0x50, 0x51, 0x4b,
	0x4c, 0x4d, 0x47, 0x48, 0x49,
	0x37, 0x4a, 0x4e, 0x53
};

char     mouseinflag = hgTRUE;		/*  a¶¯a¡ ·³b ˆa“w µa¦ */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgSetInMethod(char mode);
char     hgGetInMethod();
void     hgSetEngMode();
void     hgSetHanMode();
char     hgGetInStatus();

int      is_numpad(byte key);
int      getkey();
int      inkey(char mode);
int      minkey();
int      winkey();
int      windelay(int x1, int y1, int x2, int y2);

void     clock_routine();
void     in_null();
void     hgSetClock(void (*func)());
void     hgResetClock();

void     hgMouseInFlagOff();
void     hgMouseInFlagOn();

			/* function pointer */
void   (*clock_inter)() = &in_null;


void     hgSetInMethod(char mode)
{
	if (mode == hgHAN2) {
		HANMETHOD = hgHAN2;
		hg2bulInit();
	}
	else if (mode == hgHAN3) {
		HANMETHOD = hgHAN3;
		hg3bulInit();
	}
}

char     hgGetInMethod()
{
	return(HANMETHOD);
}

void     hgSetEngMode()
{
	mode = ENGMODE;
}

void     hgSetHanMode()
{
	mode = HANMODE;
}

char     hgGetInStatus()
{
	if (mode == ENGMODE) return(hgENGLISH);
	else if (HANMETHOD == hgHAN2) return(hgHAN2);
	else return(hgHAN3);
}

int      is_numpad(byte key)
{
	int   i;

	for (i = 0;i < 14;i++)
		if (NumCode[i] == key) break;
	return(i < 14);
}

int      getkey()
{
	char   bios1, bios2;
	byte   high, low;
	int    key;

	key = bioskey(0);
	bios1 = bios2 = bioskey(2);
	bios1 &= (LEFT_SHIFT | RIGHT_SHIFT);
	bios2 &= ALT;

	high = (byte)(key >> 8);
	low = (byte)key;

	if (high == 57 && bios1)
		return(SHIFT_SPC);	/* Ðe/µw ¸åÑÅÇ¡ */
	if (high == 57 && bios2)
		return(ALT_SPC);

	if (low) {
		if (low > 0x20 && !enginmode && !digitinmode) {
			if (HANMETHOD == hgHAN2) {
				if (mode == HANMODE && isalpha(low)) {
					if (bios1) return(Shiftedkey[toupper(low) - '@'] | 0x8000);
					else return(NoShiftkey[toupper(low) - '@'] | 0x8000);
				}
				else return(low);
			}
			else {
				if (mode == HANMODE) {
					if (is_numpad(high)) return(low);
					if (bios1) return(Shiftedkey3[high]);
					else {
						if (NoShiftkey3[high]) return(NoShiftkey3[high]);
						else return(low);
					}
				}
				else return(low);
			}
                }
		else return(low);
	}
	else return(high + 256);
}

int      inkey(char mode)
{
	int   key;

	clock_routine();
	if (mode == WAIT) {		/* WAIT¯¡“e Ç¡ˆa ·³b–I˜Œa»¡ ‹¡”aŸ¡”aˆa
					   ·³b¯¡ ·³b–E ¢…¸a Å¡—a ¤eÑÅ */
		while (!bioskey(1)) clock_routine();
		key = getkey();
		return(key);
	}

	if (mouseinflag) {		/*  a¶¯a¡ ·³b ˆa“w¯¡ */
		key = minkey();
		if (key != NOKEY) return(key);	/* MOUSE_LEFT, MOUSE_RIGHT, MOUSE_MIDDLE */
	}

	if (!bioskey(1)) return(NOKEY);	/* NOWAIT¯¡“e ·³b–E ¢…¸a Å¡—a ¤eÑÅÐa¡a
					   ·³b–E ¢…¸a Å¡—a ´ô·a¡e NOKEY ¤eÑÅ */
	key = getkey();
	return(key);
}

int      minkey()
{
	if (!hgGetMouse()) return(NOKEY);
	if (hgLeftMouse()) return(MOUSE_LEFT);
	if (hgRightMouse()) return(MOUSE_RIGHT);
	if (hgMiddleMouse()) return(MOUSE_MIDDLE);
	return(NOKEY);
}

int      winkey()
{
	int   key;

	if (hgLeftMouse()) {
		key = statuskey();
		if (key != NOKEY) return(key);
	}

	key = inkey(NOWAIT);
	return(key);
}

int      windelay(int x1, int y1, int x2, int y2)
{
	int   mx, my;
	int   key;

	y2 &= 0xff;			/* warning ¡A­A»¡ ´ô´‹¡ ¶áÐ */

	if (hgLeftMouse()) {
		hgGetMousePos(&mx, &my);

		if (mx > x1 + 8 && mx < x1 + 24 && my > y1 + 8 && my < y1 + 28) {
			hgHideMouse();
			putmend(x1 + 8, y1 + 8);
			hgShowMouse();
			while (hgLeftMouse());
			hgHideMouse();
			putmark(x1 + 8, y1 + 8);
			hgShowMouse();
			return(LEFTMARK);
		}
		else if (mx > x2 - 24 && mx < x2 - 8 && my > y1 + 8 && my < y1 + 28) {
			hgHideMouse();
			putmend_R(x2 - 24, y1 + 8);
			hgShowMouse();
			while (hgLeftMouse());
			hgHideMouse();
			putmark_R(x2 - 24, y1 + 8);
			hgShowMouse();
			return(RIGHTMARK);
		}
	}

	key = inkey(NOWAIT);
	return(key);
}

void     clock_routine()
{
	(*clock_inter)();
}

void     in_null()			/* null function */
{}

void     hgSetClock(void (*func)())
{
	clock_inter = func;
}

void     hgResetClock()
{
	clock_inter = &in_null;
}

void     hgMouseInFlagOff()
{
	mouseinflag = hgFALSE;
}

void     hgMouseInFlagOn()
{
	mouseinflag = hgTRUE;
}
