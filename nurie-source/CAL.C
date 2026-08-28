/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : cal.c  -- ”ib ¡¡—I                           |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <conio.h>
#include    <dos.h>
#include    <stdlib.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     CURRENT      0
#define     YEAR         1
#define     MONTH        2

#define     NOCHANGE     0
#define     INCREASE     1
#define     DECREASE     2

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

					/* ˆb ”i· i ® */
int      days[] = { 0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
int      calyear, calmonth;		/* ÑÁ¡e¬w· ‘e, ¶© */
struct   date     today;

char     calfore, calback;
int      calx1, calx2, caly1, caly2;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreCalendar();			/* ”ib ¥¡‹¡  @Y */

int      is_holiday(int day);
void     display_day(int option, int change);


void     nreCalendar()
{
	int   xs = 180;
	int   ys = 180;
	int   xmid = (hgGetx2r() + hgGetx1r()) / 2;
	int   ymid = (hgGety2r() + hgGety1r()) / 2;
	int   ch = NOKEY;

	if (hgIsHerc()) {
		calfore = BLACK;
		calback = WHITE;
	}
	else {
		calfore = YELLOW;
		calback = BLUE;
	}

	calx1 = xmid - xs / 2;
	calx2 = xmid + xs / 2;
	caly1 = ymid - ys / 2;
	caly2 = ymid + ys / 2;

	getdate(&today);

	calyear = today.da_year;
	calmonth = today.da_mon;

	hgSetSaveOn();

	hgHideMouse();
	savearea(calx1, caly1, calx2, caly2);
	hgDrawBorder(calx1, caly1, calx2, caly2, BLUEBOX, FILL);
	if (hgIsHerc()) hgFBTextXy(calx1 + 10, caly1 + 30, "SU MO TU WE TH FR SA", BLACK, WHITE);
	else hgFBTextXy(calx1 + 10, caly1 + 30, "SU MO TU WE TH FR SA", MAGENTA, BLUE);
	hgShowMouse();

	display_day(CURRENT, NOCHANGE);

	while (ch != ESC && ch != MOUSE_RIGHT) {
		ch = inkey(WAIT);
		switch (ch) {
			case RIGHT :	/* ¶© »wˆa */
				display_day(MONTH, INCREASE);
				break;
			case LEFT :	/* ¶© ˆq­¡ */
				display_day(MONTH, DECREASE);
				break;
			case UP :	/* ‘e »wˆa */
				display_day(YEAR, INCREASE);
				break;
			case DOWN :	/* ‘e ˆq­¡ */
				display_day(YEAR, DECREASE);
				break;
		}
	}

	hgRestore();
	hgSetSaveOff();
}

int      is_holiday(int day)
{
	int   mo[] = { 1, 1, 3, 4, 5, 6, 7, 8, 10, 10, 12 };
	int   da[] = { 1, 2, 1, 5, 5, 6, 17, 15, 1, 3, 25 };
	int   i;

	for (i = 0;i < 11;i++)
		if (calmonth == mo[i] && day == da[i]) return(hgTRUE);

	return(hgFALSE);
}

void     display_day(int option, int change)

{
	char   temp1[25], temp2[5];
	int    i, flag;
	int    year;
	int    last;
	int    count = 0;
	long   tot_nalsu;
	div_t  aa, bb, cc;

	if (option == YEAR) {
		if (change == INCREASE) calyear++;
		else if (change == DECREASE) calyear--;
		if (calyear > 2999) calyear = 2999;
		if (calyear < 1001) calyear = 1001;
	}

	if (option == MONTH) {
		if (change == INCREASE) calmonth++;
		else if (change == DECREASE) calmonth--;
		if (calmonth > 12) {
			if (calyear >= 2999) calmonth--;
			else {
				calyear++;
				calmonth = 1;
			}
		}
		else if (calmonth < 1) {
			if (calyear <= 1001) calmonth++;
			else {
				calyear--;
				calmonth = 12;
			}
		}
	}

	hgHideMouse();

	sprintf(temp1, "%c %4d YEAR %2d MON %c", 6, calyear, calmonth, 6);
	if (hgIsHerc()) {
		hgFBTextXy(calx1 + 10, caly1 + 10, temp1, BLACK, WHITE);
		hgBoxFill(calx1 + 10, caly1 + 50, calx2 - 10, caly2 - 10, WHITE);
	}
	else {
		hgFBTextXy(calx1 + 10, caly1 + 10, temp1, GREEN, BLUE);
		hgBoxFill(calx1 + 10, caly1 + 50, calx2 - 10, caly2 - 10, BLUE);
	}
					/* ·E”i ‰¬e */
	if (((calyear % 4 == 0) && (calyear % 100 != 0)) || (calyear % 400 == 0)) days[2] = 29;

	year = calyear - 1;
	aa = div(year, 4);
	bb = div(year, 100);
	cc = div(year, 400);
	tot_nalsu = year * (long)365 + aa.quot - bb.quot  + cc.quot;
	for (i = 1;i < calmonth;i++)
		tot_nalsu = tot_nalsu + days[i];
	tot_nalsu++;
	last = tot_nalsu % 7;

	for (i = 1;i <= days[calmonth];i++) {
		flag = is_holiday(i);
		if (hgIsHerc()) {
			if (flag) {
				calfore = WHITE;
				calback = BLACK;
			}
			else {
				calfore = BLACK;
				calback = WHITE;
			}
		}
		else {
			if (flag || (((i + last) % 7) == 1)) {
				calfore = RED;
				calback = BLUE;
			}
			else if (((i + last) % 7) == 0) {
				calfore = GREEN;
				calback = BLUE;
			}
			else {
				calfore = WHITE;
				calback = BLUE;
			}
		}

		itoa(i, temp2, 10);
		if (i == today.da_day)
			hgFBTextXy(calx1 + 10 + ((last + i - 1) % 7) * 24, caly1 + 50 + count * 20,
				   temp2, calback, calfore);
		else hgFBTextXy(calx1 + 10 + ((last + i - 1) % 7) * 24, caly1 + 50 + count * 20,
				temp2, calfore, calback);

		if (((i + last) % 7) == 0) count++;
	}

	hgShowMouse();
}
