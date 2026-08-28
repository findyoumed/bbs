/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : gomenu.c  -- ˆa‹¡ ¡A“A ¡¡—I                   |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <stdlib.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "gomenu.h"			/* ˆa‹¡ ¡A“AµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

MNUITEM  *mnu;

char     gocmd[GOCMD_LEN + 1];		/* ˆa‹¡ ¡ww´á */
char     mnutheme[MNUTHEME_LEN + 1];	/* ˆa‹¡ ¡A“A· ¹A¡¢ */
int      mnu_no;			/* ˆa‹¡ ¡A“A Ðw¡¢· Á· ˆ•® */

FILE    *mnufp;				/* ˆa‹¡ ¡A“A ÑÁ·© */
char     mnufile[50] = { "HITEL.MNU" };

char     mnu_buf[BUFFER_MAX + 1];

int      curline = 0;			/* ˆa‹¡ ¡A“A ¤b¯a ¯¡¸b ¶áÃ¡· Ðw¡¢ ¤åÑ¡ */
int      item_no = 0;			/* Ñe¸ ¡A“A Ðw¡¢ ¤åÑ¡ */
int      item_spos;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreSelectMenuFile();		/* ¡A“A ÑÁ·©  @Q */
void     nreGoMenu();			/* ˆa‹¡ ¡A“A  @SPC */

int      comReadMenuFile(char *file);
void     comSkipMenuHead();
void     comGetMenuTheme();
void     comGetMenuGoCmd();
void     comDoGoMenu(int pos);

int      comMNU_Load();
void     comMNU_Free();
void     comMNU_Choose(int x, int y, char *title);

void     comDrawMenuBox(int x1, int y1, int x2, int y2, char *title);

int      check_depth(int pos, int depth);
void     print_mnu_oneline(int x, int y, int pos, int num);
void     strip_return(char *str);
char    *string_find(char first, char last, char *str);


void     nreSelectMenuFile()
{
	int    flag;
	char   mfile[50] = { "*.MNU" };

	flag = hgGetFileName(" ¬åÈ‚Ði ¡A“A ÑÁ·© ·¡Ÿq·e? ", mfile);
	if (!flag) return;

	strcpy(mnufile, mfile);

	curline = 0;
	item_no = 0;
}

void     nreGoMenu()
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - 560 / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - 300 / 2;
	int   flag;

	flag = comReadMenuFile(mnufile);
	if (!flag) {
		hgSetSaveOn();
		hgDisplayMessage(" ¡A“A ÑÁ·©·¡ ´ôˆáa ¡A¡¡Ÿ¡ˆa ¡¡¸aœs“¡”a. ", RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();

		return;
	}

	hgSetSaveOn();
	comMNU_Choose(x, y, " ’Ÿ¡µA ");
	hgRestore();
	hgSetSaveOff();

	comMNU_Free();
}

int      comReadMenuFile(char *file)
{
	int   pos;
	int   flag;

	mnufp = fopen(file, "rt");
	if (mnufp == NULL) return(hgFAIL);

	comSkipMenuHead();
	comGetMenuTheme();
	comGetMenuGoCmd();

	flag = comMNU_Load();
	if (!flag) {
		fclose(mnufp);
		return(hgFAIL);
	}

	fclose(mnufp);
	return(hgSUCCESS);
}

void     comSkipMenuHead()
{
	int   i;

	for (i = 0;i < HEADER_LINE;i++)
		fgets(mnu_buf, BUFFER_MAX, mnufp);
}

void     comGetMenuTheme()
{
	fgets(mnu_buf, BUFFER_MAX, mnufp);
	strip_return(mnu_buf);
	strncpy(mnutheme, mnu_buf, MNUTHEME_LEN + 1);
}

void     comGetMenuGoCmd()
{
	fgets(mnu_buf, BUFFER_MAX, mnufp);
	strip_return(mnu_buf);
	strncpy(gocmd, mnu_buf, GOCMD_LEN);
}

void     comDoGoMenu(int pos)
{
	sendline(gocmd, 2);
	sendline(" ", 2);
	sendline(mnu[pos].go_target, 2);
	comDataOut(RETURN);
}

int      comMNU_Load()
{
	int   i;

	fgets(mnu_buf, BUFFER_MAX, mnufp);
	strip_return(mnu_buf);
	mnu_no = atoi(mnu_buf);

	mnu = malloc(sizeof(MNUITEM) * mnu_no);
	if (mnu == NULL) return(hgFAIL);

	fgets(mnu_buf, BUFFER_MAX, mnufp);
	strip_return(mnu_buf);
	mnu[0].depth = 0;
	strncpy(mnu[0].name, string_find('\\', ':', mnu_buf), NAME_LEN + 1);
	strncpy(mnu[0].go_target, string_find(':', 0, mnu_buf), GO_LEN + 1);

	for (i = 1;i < mnu_no;i++) {
		fgets(mnu_buf, BUFFER_MAX, mnufp);
		strip_return(mnu_buf);
		mnu[i].depth = atoi(string_find(0, '\\', mnu_buf));
		strncpy(mnu[i].name, string_find('\\', ':', mnu_buf), NAME_LEN + 1);
		strncpy(mnu[i].go_target, string_find(':', 0, mnu_buf), GO_LEN + 1);
	}

	return(hgSUCCESS);
}

void     comMNU_Free()
{
	free(mnu);
}

void     comMNU_Choose(int x, int y, char *title)
{
	HBAR     *bar;
	BCOLOR   barc = { wcBLUEBOX, wcINSIDE };
	WIDTH    barw;
	HSCRLBAR *sbar;
	WIDTH    sbarw;

	int    i, flag;
	int    num;
	int    xx, yy;
	int    xs, ys;
	int    py;
	int    pos;
	int    offset;
	int    prvs;
	int    ps = 0, diff;
	int    ch;
	int    savetemp;
	int    mx, my;
	int    xc, yc;

	xs = 560;
	ys = 300;

	hgWIDTH_Load(&barw, xs - 30, 20);
	bar = hgHBAR_Load(barc, barw);

	hgHideMouse();
	savearea(x, y, x + xs, y + ys);
	comDrawMenuBox(x, y, x + xs, y + ys, title);

	num = mnu_no;

	hgWIDTH_Load(&sbarw, 16, ys - 58);
	sbar = hgHSCRLBAR_Load(num, 15, VERT, sbarw);

	item_spos = curline;

	xx = x + 8;
	yy = y + 52;

	for (i = 0;i < 15;i++) {
		print_mnu_oneline(xx, yy + i * 16, item_spos, num);
		item_spos++;
		if (item_spos >= num) break;
	}

	item_spos = curline;
	pos = item_no;

	offset = pos - item_spos;
	prvs = sbar->pos = item_spos;

	xx = x + 8;
	py = yy = y + 52 + (pos - item_spos) * 16;

	hgHSCRLBAR_Draw(sbar, x + xs - 20, y + 53);
	hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

	do {
		do {
			ch = inkey(NOWAIT);
		} while (ch == NOKEY);

		prvs = item_spos;

		if (ch == MOUSE_LEFT)
			if (hgHSCRLBAR_Area(sbar, x + xs - 20, y + 53)) {
				ps = sbar->pos;
				hgHSCRLBAR_Choose(sbar, x + xs - 20, y + 53);
				diff = sbar->pos - ps;

				if (diff != 0) {
					if (diff == 1) ch = DOWN;
					else if (diff == -1) ch = UP;
					else {
						item_spos = sbar->pos;
						pos = item_spos + offset;
						if (pos >= num) pos = num - 1;
						offset = pos - item_spos;
					}
				}
				while (hgLeftMouse());
			}
			else {
				hgGetMousePos(&mx, &my);
				if (my > y + 52 && my < y + ys - 8
				 && mx > x + 4 && mx < x + xs - 20) {
					yc = (my - y - 52) / 16;
					savetemp = item_spos + yc;

					if (savetemp < num) {
						pos = savetemp;
						offset = pos - item_spos;
						xx = x + 8;
						yy = y + 52 + offset * 16;

						hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);
						hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
						while (hgLeftMouse());
						hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

						comDoGoMenu(pos);
						break;
					}
				}
			}

		if (ch != UP && ch != DOWN) {
			if (ch == HOME || ch == CTRL_PgUp) {
				item_spos = 0;
				pos = 0;
				offset = 0;
			}
			if (ch == END || ch == CTRL_PgDn) {
				item_spos = num - 15;
				if (item_spos < 0) item_spos = 0;
				pos = num - 1;
				offset = pos - item_spos;
			}
			if (ch == PgUp) {
				item_spos -= 15;
				if (item_spos < 0) item_spos = 0;
				pos -= 15;
				if (pos < 0) pos = 0;
				offset = pos - item_spos;
			}
			if (ch == PgDn) {
				item_spos += 15;
				if (item_spos >= num) item_spos -= 15;
				pos += 15;
				if (pos >= num) pos = num - 1;
				offset = pos - item_spos;
			}
			if (ch == RETURN) {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

				comDoGoMenu(pos);
				break;
			}
			if (ch == ESC || ch == MOUSE_RIGHT) {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);
				break;
			}

			xx = x + 8;
			yy = y + 52 + offset * 16;
			hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

			if (prvs != item_spos) {
				hgHideMouse();
				for (i = 0;i < 15;i++) {
					hgBoxFill(x + 4, y + 52 + i * 16,
						x + xs - 22, y + 68 + i * 16, BLACK);
					print_mnu_oneline(x + 8, y + 52 + i * 16,
							  item_spos + i, num);
				}
				prvs = item_spos;
			}

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			py = yy;
		}

		if (ch == UP) {
			pos--;
			if (pos < 0) pos = 0;
			if (pos < item_spos) item_spos = pos;
			offset = pos - item_spos;
			xx = x + 8;
			yy = y + 52 + offset * 16;
			hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

			if (prvs != item_spos) {
				hgHideMouse();
				hgScrDown(x + 4, y + 52, x + xs - 22, y + 52 + 15 * 16, 16, BLACK);
				print_mnu_oneline(x + 8, y + 52, item_spos, num);
				prvs = item_spos;
			}

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			py = yy;
		}
		if (ch == DOWN) {
			pos++;
			if (pos >= num) pos = num - 1;
			if (item_spos + 15 <= pos) item_spos = pos - 15 + 1;
			offset = pos - item_spos;
			xx = x + 8;
			yy = y + 52 + offset * 16;
			hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

			if (prvs != item_spos) {
				hgHideMouse();
				hgScrUp(x + 4, y + 52, x + xs - 22, y + 52 + 15 * 16, 16, BLACK);
				print_mnu_oneline(x + 8, y + 52 + 14 * 16, item_spos + 14, num);
				prvs = item_spos;
			}

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			py = yy;
		}

		sbar->pos = item_spos;
		hgHSCRLBAR_Update(sbar, x + xs - 20, y + 53);
	} while (1);

	curline = item_spos;
	item_no = pos;

	hgHBAR_Free(&bar);
	hgHSCRLBAR_Free(&sbar);

	hgShowMouse();

	return;
}

void     comDrawMenuBox(int x1, int y1, int x2, int y2, char *title)
{
	int   xfac, yfac;

	hgBoxFill(x1, y1, x2, y2, BLUE);
	hgBox(x1, y1, x2, y2, LIGHTCYAN);

	hgBoxFill(x1 + 2, y1 + 4, x2 - 2, y1 + 44, LIGHTBLUE);
	hgBox(x1 + 2, y1 + 4, x2 - 2, y1 + 44, DARKGRAY);

	hgBoxFill(x1 + 2, y1 + 48, x2 - 2, y2 - 4, BLACK);
	hgBox(x1 + 2, y1 + 48, x2 - 2, y2 - 4, LIGHTBLUE);

	hgDrawBorder(x2 - 21, y1 + 52, x2 - 4, y2 - 4, BOXNORMAL, FILL);

	xfac = hgGetXFactor();
	yfac = hgGetYFactor();
	hgSetXFactor(2);
	hgSetYFactor(2);
	if (hgIsHerc()) hgForeTextXy(x1 + 32, y1 + 8, title, BLACK);
	else hgSpecTextXy(x1 + 32, y1 + 8, title, WHITE, BLUE, 1);
	hgSetXFactor(xfac);
	hgSetYFactor(yfac);

	if (hgIsHerc()) hgForeTextXy(x1 + 200, y1 + 20, mnutheme, BLACK);
	else hgSpecTextXy(x1 + 200, y1 + 20, mnutheme, LIGHTCYAN, BLUE, 1);
}

int      check_depth(int pos, int depth)
{
	int   i;

	for (i = pos;i < mnu_no;i++) {
		if (mnu[i].depth < depth) return(hgFALSE);
		else if (mnu[i].depth == depth) return(hgTRUE);
	}
	return(hgFALSE);
}

void     print_mnu_oneline(int x, int y, int pos, int num)
{
	int   depth = 1;

	if (pos + 1 > num) return;

	if (pos != 0) {
		while (depth < mnu[pos].depth) {
			if (check_depth(pos, depth))
				hgVline(x + (depth << 5), y, y + 16, LIGHTGRAY);
			depth++;
		}

		if (check_depth(pos + 1, mnu[pos].depth)) {
			hgVline(x + (depth << 5), y, y + 16, LIGHTGRAY);
			hgHline(x + (depth << 5), x + 34 + (depth << 5), y + 8, LIGHTGRAY);
		}
		else {
			hgVline(x + (depth << 5), y, y + 8, LIGHTGRAY);
			hgHline(x + (depth << 5), x + 34 + (depth << 5), y + 8, LIGHTGRAY);
		}
		hgForeTextXy(x + 10 + (mnu[pos].depth + 1) * 32, y, mnu[pos].name, mnu[pos].depth * 2 + 5);
	}
	else {
		hgForeTextXy(x - 18 + (mnu[pos].depth + 1) * 32, y, "**", WHITE);
		hgForeTextXy(x + 10 + (mnu[pos].depth + 1) * 32, y, mnu[pos].name, WHITE);
	}
}

void     strip_return(char *str)
{
	int    i = 0;
	byte   *ptr;

	ptr = str;
	while ((*str) && (i++ < BUFFER_MAX)) {
		if (*str == '\n') {
			str++;
			break;
		}
		else *ptr++ = *str++;
	}
	*ptr = 0;
}

char    *string_find(char first, char last, char *str)
{
	char   temp[BUFFER_MAX + 1];
	int    pos = 0, pos2 = 0;

	if (first != 0) {
		for ( ;str[pos] != first && pos < BUFFER_MAX;pos++) ;
		pos++;
	}

	for ( ;str[pos] != last && pos < BUFFER_MAX;pos++)
		temp[pos2++] = str[pos];
	temp[pos2] = 0;
	return(temp);
}
