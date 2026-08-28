/*-------------------------------------------------------------------|
 |                                                                   |
 |       …∑Ø• µA¢âùA∑°»· Nurie 1.5                                   |
 |       filename    : telbox.c  -- ∏Â—¡àÈã° §bØa °°óI               |
 |       πA∏b∑©Ø°    : 92/10/31(…°)                                  |
 |       πA∏b∏a      : ∑° ª¢¿w (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <dos.h>
#include    <fcntl.h>
#include    <io.h>
#include    <time.h>

#include    "key.h"			/* ã°ìw«°µA îÅ–e ¨wÆÅ ∏˜∑Å */
#include    "hghlib.h"			/* –eãi ∑≥¬âùbµA îÅ–e —Aî· */
#include    "hginit.h"			/* –eãi ¡°ã°—¡µA îÅ–e —Aî· */
#include    "hwindow.h"			/* –eãi ∂Âï°∂ÅµA îÅ–e —Aî· */
#include    "comtel.h"

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

CTEL    *tp;

int      tel_no = 1;
char     telfile[50] = { "NURIE.TEL" };	/* ∏Â—¡ §Â—°¶Å —¡∑© */

int      spos;

int      bspos;				/* ∏Â—¡àÈã° §bØaêÅ Ø°∏b ∂·√°∑Å –w°¢ §Â—° */
int      bpos;				/* ∏Â—¡àÈã° §bØaêÅ §a ∂·√°∑Å –w°¢ §Â—° */

extern   int      recpos;

extern   int      connectflag;
extern   int      phoneflag;
extern   char     phone[2];
extern   int      chaindial, dialdelay;
extern   int      baudflag, stopflag, dataflag;
extern   char     parflag;

extern   struct   time     ontime;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreDialing();			/* ∏Â—¡ àÈã°  @D */

void     comTelInit();
void     comTelEnd();

CTEL    *comCTEL_Load(WIDTH size, int ynum);
void     comCTEL_Free(CTEL **p);
void     print_tel_oneline(int x, int y, TELITEM *items[], int pos, int num);
void     display_button(int x, int y);
int      get_telkey(int x, int y, int mx, int my);
void     comCTEL_Choose(CTEL *p, int x, int y, char *title);

int      comTelRead();
void     comTelWrite();
void     comTelInsert(int tpos);
void     comTelDelete(int tpos);
void     comTelEdit(int x, int y, int tpos);
void     comdial_send(char *dial);
int      comTelDialing(int tpos);


void     nreDialing()
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - 526 / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - (254 + 60) / 2;

	hgSetSaveOn();
	hgSetRecPosOn();
	comCTEL_Choose(tp, x, y, " ∏Â—¡ àÈã° §bØa ");
	hgSetRecPosOff();
	hgRestore();
	hgSetSaveOff();
}

void     comTelInit()
{
	WIDTH  w = { 526, 254 + 60 };

	char   hdr[45];
	int    handle;
	int    pos = 0;
	long   fsize;

	tp = comCTEL_Load(w, 10);

	handle = open(telfile, O_RDONLY);
	if (handle == -1) {
		for (pos = 0;pos < MAXTEL;pos++) {
			strcpy(tp->items[pos]->name, "");
			strcpy(tp->items[pos]->telnum, "");
			tp->items[pos]->baud = 1;
			tp->items[pos]->parity = 'N';
			tp->items[pos]->data = 8;
			tp->items[pos]->stop = 1;
			tp->items[pos]->han = 7;
			strcpy(tp->items[pos]->hlp, "");
		}
		tel_no = MAXTEL;
		return;
	}

	lseek(handle, 0, 0);
	read(handle, hdr, (size_t)39);	/* —Aî· …BØaÀa 39 §a∑°Àa */
	hdr[33] = 0;

	if (strcmp(hdr, " <È≥ È∆ ƒø≥> Telephone File.  Ver") != 0) {
		close(handle);

		for (pos = 0;pos < MAXTEL;pos++) {
			strcpy(tp->items[pos]->name, "");
			strcpy(tp->items[pos]->telnum, "");
			tp->items[pos]->baud = 1;
			tp->items[pos]->parity = 'N';
			tp->items[pos]->data = 8;
			tp->items[pos]->stop = 1;
			tp->items[pos]->han = 7;
			strcpy(tp->items[pos]->hlp, "");
		}
		tel_no = MAXTEL;
		return;
	}

	fsize = filelength(handle);
	tel_no = (fsize - 39) / sizeof(TELITEM);
	if (tel_no > MAXTEL) tel_no = MAXTEL;

	lseek(handle, 39, 0);
	for (pos = 0;pos < tel_no;pos++)
		read(handle, (char *)tp->items[pos], sizeof(TELITEM));
	close(handle);
}

void     comTelEnd()
{
	comCTEL_Free(&tp);
}

CTEL    *comCTEL_Load(WIDTH size, int ynum)
{
	CTEL  *p;

	int    pos;

	p = (CTEL *)malloc(sizeof(CTEL));

	for (pos = 0;pos < MAXTEL;pos++)
		p->items[pos] = (TELITEM *)malloc(sizeof(TELITEM));

	p->size = size;
	p->ynum = ynum;

	return(p);
}

void     comCTEL_Free(CTEL **p)
{
	int   pos;

	for (pos = 0;pos < MAXTEL;pos++)
		free((*p)->items[pos]);
	free(*p);
}

void     print_tel_oneline(int x, int y, TELITEM *items[], int pos, int num)
{
	char   mline[15];
	char   temp[5];

	if (pos + 1 > num) return;

	itoa(pos + 1, temp, 10);
	hgOutTextXy(x + 6, y + 1, temp);
	hgOutTextXy(x + 6 + 3 * 8, y + 1, items[pos]->name);
	hgOutTextXy(x + 6 + 25 * 8, y + 1, items[pos]->telnum);
	modemvar2str(items[pos]->baud, items[pos]->parity, items[pos]->data, items[pos]->stop, mline);
	itoa(items[pos]->han, temp, 10);
	strcat(mline, "[");
	strcat(mline, temp);
	strcat(mline, "]");
	hgOutTextXy(x + 6 + 43 * 8, y + 1, mline);
}

void     display_button(int x, int y)
{
	hgDrawBorder(x, y, x + 79, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x, y + 20, x + 79, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 80, y, x + 159, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 80, y + 20, x + 159, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 160, y, x + 239, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 160, y + 20, x + 239, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 250, y, x + 329, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 250, y + 20, x + 329, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 330, y, x + 409, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 330, y + 20, x + 409, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 410, y, x + 489, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 410, y + 20, x + 489, y + 39, BOXNORMAL, NOFILL);

	hgOutTextXy(x + 8, y + 2, "   ‘û   ");
	hgOutTextXy(x + 8, y + 22, "   ‘ü   ");
	hgOutTextXy(x + 88, y + 2, "  PgUp  ");
	hgOutTextXy(x + 88, y + 22, "  PgDn  ");
	hgOutTextXy(x + 168, y + 2, "  Home  ");
	hgOutTextXy(x + 168, y + 22, "  End   ");
	hgOutTextXy(x + 258, y + 2, " ∑™ã°⁄b ");
	hgOutTextXy(x + 258, y + 22, " ∏·∏w⁄g ");
	hgOutTextXy(x + 338, y + 2, " ¨s∑≥⁄Y ");
	hgOutTextXy(x + 338, y + 22, " ª°∂ë⁄T ");
	hgOutTextXy(x + 418, y + 2, " â°√±⁄U ");
	hgOutTextXy(x + 418, y + 22, " àÈã°‘˙ ");
}

int      get_telkey(int x, int y, int mx, int my)
{
	int   key = NOKEY;

	if (my > y && my < y + 19) {
		if (mx > x && mx < x + 79) key = UP;
		if (mx > x + 80 && mx < x + 159) key = PgUp;
		if (mx > x + 160 && mx < x + 239) key = HOME;
		if (mx > x + 250 && mx < x + 329) key = 'R';
		if (mx > x + 330 && mx < x + 409) key = 'I';
		if (mx > x + 410 && mx < x + 489) key = 'E';
	}
	else if (my > y + 20 && my < y + 39) {
		if (mx > x && mx < x + 79) key = DOWN;
		if (mx > x + 80 && mx < x + 159) key = PgDn;
		if (mx > x + 160 && mx < x + 239) key = END;
		if (mx > x + 250 && mx < x + 329) key = 'W';
		if (mx > x + 330 && mx < x + 409) key = 'D';
		if (mx > x + 410 && mx < x + 489) key = RETURN;
	}

	return(key);
}

void     comCTEL_Choose(CTEL *p, int x, int y, char *title)
{
	HBAR     *bar;
	BCOLOR   barc = { wcBARNORMAL, wcINSIDE };
	WIDTH    barw;
	HSCRLBAR *sbar;
	WIDTH    sbarw;

	char   fill = LIGHTGRAY;
	int    i, flag;
	int    num, max;
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

	max = 460;

	hgWIDTH_Load(&barw, max + 16, 20);
	bar = hgHBAR_Load(barc, barw);

	xs = p->size.xwidth;
	ys = p->size.ywidth - 60;
	hgPrtWindowXy(x, y, x + p->size.xwidth, y + p->size.ywidth, title);

	hgHideMouse();
	hgBoxFill(x + 14, y + 34, x + xs - 13, y + p->size.ywidth - 13, fill);
	hgHline(x + 14, x + xs - 13, y + p->size.ywidth - 71, ZERO);
	hgHline(x + 14, x + xs - 13, y + p->size.ywidth - 70, WHITE);
	display_button(x + 17, y + p->size.ywidth - 60);

	num = tel_no;

	hgWIDTH_Load(&sbarw, 16, ys - 47);
	sbar = hgHSCRLBAR_Load(num, p->ynum, VERT, sbarw);

	if (recpos) spos = bspos;
	else spos = 0;

	xx = x + 17;
	yy = y + 40;

	for (i = 0;i < p->ynum;i++) {
		print_tel_oneline(xx, yy + i * 20, p->items, spos, num);
		spos++;
		if (spos >= num) break;
	}

	if (recpos) {
		spos = bspos;
		pos = bpos;
	}
	else {
		spos = 0;
		pos = 0;
	}

	offset = pos - spos;
	prvs = sbar->pos = spos;

	xx = x + 17;
	py = yy = y + 40 + (pos - spos) * 20;

	hgHSCRLBAR_Draw(sbar, x + xs - 29, y + 34);
	hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

	do {
		hgEngInModeOn();
		do {
			ch = windelay(x, y, x + xs, y + ys);
		} while (ch == NOKEY);
		hgEngInModeOff();

		prvs = spos;

		if (ch == MOUSE_LEFT)
			if (hgHSCRLBAR_Area(sbar, x + xs - 29, y + 34)) {
				ps = sbar->pos;
				hgHSCRLBAR_Choose(sbar, x + xs - 29, y + 34);
				diff = sbar->pos - ps;
				if (diff != 0) {
					if (diff == 1) ch = DOWN;
					else if (diff == -1) ch = UP;
					else {
						spos = sbar->pos;
						pos = spos + offset;
						if (pos >= num) pos = num - 1;
						offset = pos - spos;
					}
				}
				while (hgLeftMouse());
			}
			else {
				hgGetMousePos(&mx, &my);
				if (my > y + 40 && my < y + ys - 13
				 && mx > x + 17 && mx < x + xs - 29) {
					yc = (my - y - 40) / 20;
					savetemp = spos + yc;

					if (savetemp < num) {
						pos = savetemp;
						offset = pos - spos;
						xx = x + 17;
						yy = y + 40 + offset * 20;

						hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);
						hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
						while (hgLeftMouse());
						hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

						flag = comTelDialing(pos);
						if (flag) break;

						hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

						py = yy;
					}
				}
				else {
					ch = get_telkey(x + 17, y + p->size.ywidth - 60, mx, my);
					while (hgLeftMouse());
				}
			}

		if (ch != UP && ch != DOWN) {
			if (ch == HOME) {
				spos = 0;
				pos = 0;
				offset = 0;
			}
			if (ch == END) {
				spos = num - p->ynum;
				if (spos < 0) spos = 0;
				pos = num - 1;
				offset = pos - spos;
			}
			if (ch == PgUp) {
				spos -= p->ynum;
				if (spos < 0) spos = 0;
				pos -= p->ynum;
				if (pos < 0) pos = 0;
				offset = pos - spos;
			}
			if (ch == PgDn) {
				spos += p->ynum;
				if (spos >= num) spos -= p->ynum;
				pos += p->ynum;
				if (pos >= num) pos = num - 1;
				offset = pos - spos;
			}
			if (ch == 'r' || ch == 'R') {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

				flag = comTelRead();
				if (flag) {
					num = tel_no;
					spos = pos = 0;
					offset = 0;
					prvs = spos;
					xx = x + 17;
					yy = y + 40 + offset * 20;

					hgHideMouse();
					for (i = 0;i < p->ynum;i++) {
						hgBoxFill(x + 14, y + 40 + i * 20,
							  x + xs - 30, y + 60 + i * 20, fill);
						print_tel_oneline(x + 17, y + 40 + i * 20,
								  p->items, spos + i, num);
					}

					hgHSCRLBAR_Free(&sbar);
					sbar = hgHSCRLBAR_Load(num, p->ynum, VERT, sbarw);
				}

				hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

				py = yy;
			}
			if (ch == 'w' || ch == 'W') {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

				comTelWrite();

				hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
			}
			if (ch == 'i' || ch == 'I') {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

				if (num < MAXTEL) {
					comTelInsert(pos);
					num++;
				}

				hgHideMouse();
				for (i = 0;i < p->ynum;i++) {
					hgBoxFill(x + 14, y + 40 + i * 20,
						  x + xs - 30, y + 60 + i * 20, fill);
					print_tel_oneline(x + 17, y + 40 + i * 20,
							  p->items, spos + i, num);
				}

				hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

				hgHSCRLBAR_Free(&sbar);
				sbar = hgHSCRLBAR_Load(num, p->ynum, VERT, sbarw);
			}
			if (ch == 'd' || ch == 'D') {
				hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

				if (num > 1) {
					comTelDelete(pos);
					num--;
					if (pos > num - 1) pos--;
					if (pos < spos) spos = pos;
					offset = pos - spos;
				}
				xx = x + 17;
				yy = y + 40 + offset * 20;

				hgHideMouse();
				for (i = 0;i < p->ynum;i++) {
					hgBoxFill(x + 14, y + 40 + i * 20,
						  x + xs - 30, y + 60 + i * 20, fill);
					print_tel_oneline(x + 17, y + 40 + i * 20,
							  p->items, spos + i, num);
				}

				hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

				hgHSCRLBAR_Free(&sbar);
				sbar = hgHSCRLBAR_Load(num, p->ynum, VERT, sbarw);
				py = yy;
			}
			if (ch == 'e' || ch == 'E') {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

				comTelEdit(xx, yy, pos);

				hgHideMouse();
				hgBoxFill(x + 14, y + 40 + offset * 20,
					  x + xs - 30, y + 60 + offset * 20, fill);
				print_tel_oneline(x + 17, y + 40 + offset * 20, p->items, spos + offset, num);

				hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
			}
			if (ch == RETURN) {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);

				flag = comTelDialing(pos);
				if (flag) break;

				hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);
			}
			if (ch == ESC || ch == LEFTMARK || ch == RIGHTMARK) {
				hgHBAR_Draw(bar, xx - 2, yy - 2, ERASE);
				break;
			}

			xx = x + 17;
			yy = y + 40 + offset * 20;
			hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

			if (prvs != spos) {

				hgHideMouse();
				for (i = 0;i < p->ynum;i++) {
					hgBoxFill(x + 14, y + 40 + i * 20,
						  x + xs - 30, y + 60 + i * 20, fill);
					print_tel_oneline(x + 17, y + 40 + i * 20,
							  p->items, spos + i, num);
				}
				prvs = spos;
			}

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			py = yy;
		}

		if (ch == UP) {
			pos--;
			if (pos < 0) pos = 0;
			if (pos < spos) spos = pos;
			offset = pos - spos;
			xx = x + 17;
			yy = y + 40 + offset * 20;
			hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

			if (prvs != spos) {
				hgHideMouse();
				hgScrDown(x + 14, y + 40, x + xs - 30, y + 40 + p->ynum * 20, 20, fill);
				print_tel_oneline(x + 17, y + 40, p->items, spos, num);
				prvs = spos;
			}

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			py = yy;
		}
		if (ch == DOWN) {
			pos++;
			if (pos >= num) pos = num - 1;
			if (spos + p->ynum <= pos) spos = pos - p->ynum + 1;
			offset = pos - spos;
			xx = x + 17;
			yy = y + 40 + offset * 20;
			hgHBAR_Draw(bar, xx - 2, py - 2, ERASE);

			if (prvs != spos) {
				hgHideMouse();
				hgScrUp(x + 14, y + 40, x + xs - 30, y + 40 + p->ynum * 20, 20, fill);
				print_tel_oneline(x + 17, y + 40 + (p->ynum - 1) * 20, p->items, spos + p->ynum - 1, num);
				prvs = spos;
			}

			hgHBAR_Draw(bar, xx - 2, yy - 2, DRAW);

			py = yy;
		}

		sbar->pos = spos;
		hgHSCRLBAR_Update(sbar, x + xs - 29, y + 34);
	} while (1);

	if (recpos) {
		bspos = spos;
		bpos = pos;
	}

	hgHBAR_Free(&bar);
	hgHSCRLBAR_Free(&sbar);

	hgShowMouse();

	return;
}

int      comTelRead()
{
	char   hdr[45];
	int    handle;
	int    flag;
	int    pos = 0;
	long   fsize;

	flag = hgGetFileName(" ∑™∑i ∏Â—¡§Â—°¶Å —¡∑© ∑°üq∑e ? ", telfile);
	if (!flag) return(hgFAIL);

	handle = open(telfile, O_RDONLY);
	if (handle == -1) {
		hgSetSaveOn();
		hgDisplayMessage(" ∏Â—¡§Â—°¶Å —¡∑©∑° ¥ÙØsì°îa. ", RED);
		delay(500);
		hgRestore();
		hgSetSaveOff();

		return(hgFAIL);
	}

	lseek(handle, 0, 0);
	read(handle, hdr, (size_t)39);
	hdr[33] = 0;

	if (strcmp(hdr, " <È≥ È∆ ƒø≥> Telephone File.  Ver") != 0) {
		close(handle);

		hgSetSaveOn();
		hgDisplayMessage(" íÅü°µA 1.5 - ∏Â—¡§Â—°¶Å —¡∑©∑° ¥aì≥ì°îa. ", RED);
		delay(500);
		hgRestore();
		hgSetSaveOff();

		return(hgFAIL);
	}

	fsize = filelength(handle);
	tel_no = (fsize - 39) / sizeof(TELITEM);
	if (tel_no > MAXTEL) tel_no = MAXTEL;
	lseek(handle, 39, 0);
	for (pos = 0;pos < tel_no;pos++)
		read(handle, (char *)tp->items[pos], sizeof(TELITEM));
	close(handle);

	return(hgSUCCESS);
}

void     comTelWrite()
{
	char   hdr[45];
	int    handle;
	int    flag;
	int    pos = 0;

	flag = hgGetFileName(" ∏·∏w–i ∏Â—¡§Â—°¶Å —¡∑© ∑°üq∑e ? ", telfile);
	if (!flag) return;

	handle = open(telfile, O_WRONLY);
	if (handle == -1) {
		hgSetSaveOn();
		hgDisplayMessage(" ∏Â—¡§Â—°¶Å —¡∑©∑i †eói ÆÅ ¥ÙØsì°îa. ", RED);
		delay(500);
		hgRestore();
		hgSetSaveOff();

		return;
	}

	strcpy(hdr, " <È≥ È∆ ƒø≥> Telephone File.  Ver 5,3 ");
	hdr[38] = 26;			/* End of File */
	lseek(handle, 0, 0);
	write(handle, hdr, (size_t)39);

	lseek(handle, 39, 0);
	for (pos = 0;pos < tel_no;pos++)
		write(handle, (char *)tp->items[pos], sizeof(TELITEM));

	close(handle);
}

void     comTelInsert(int tpos)
{
	int   pos;

	for (pos = tel_no - 1;pos >= tpos;pos--) {
		strcpy(tp->items[pos + 1]->name, tp->items[pos]->name);
		strcpy(tp->items[pos + 1]->telnum, tp->items[pos]->telnum);
		tp->items[pos + 1]->baud = tp->items[pos]->baud;
		tp->items[pos + 1]->parity = tp->items[pos]->parity;
		tp->items[pos + 1]->data = tp->items[pos]->data;
		tp->items[pos + 1]->stop = tp->items[pos]->stop;
		tp->items[pos + 1]->han = tp->items[pos]->han;
		strcpy(tp->items[pos + 1]->hlp, tp->items[pos]->hlp);
	}

	strcpy(tp->items[tpos]->name, "");
	strcpy(tp->items[tpos]->telnum, "");
	tp->items[tpos]->baud = 1;
	tp->items[tpos]->parity = 'N';
	tp->items[tpos]->data = 8;
	tp->items[tpos]->stop = 1;
	tp->items[tpos]->han = 7;
	strcpy(tp->items[tpos]->hlp, "");

	tel_no++;
}

void     comTelDelete(int tpos)
{
	int   pos;

	for (pos = tpos;pos < tel_no - 1;pos++) {
		strcpy(tp->items[pos]->name, tp->items[pos + 1]->name);
		strcpy(tp->items[pos]->telnum, tp->items[pos + 1]->telnum);
		tp->items[pos]->baud = tp->items[pos + 1]->baud;
		tp->items[pos]->parity = tp->items[pos + 1]->parity;
		tp->items[pos]->data = tp->items[pos + 1]->data;
		tp->items[pos]->stop = tp->items[pos + 1]->stop;
		tp->items[pos]->han = tp->items[pos + 1]->han;
		strcpy(tp->items[pos]->hlp, tp->items[pos + 1]->hlp);
	}

	tel_no--;
}

void     comTelEdit(int x, int y, int tpos)
{
	char   bsave;
	char   mline[15];
	char   temp[5];
	int    flag;

	bsave = hgGetTBcolor();
	hgSetTBcolor(LIGHTGRAY);

	hgSpecInModeOn();

	while (1) {
		flag = hgInTextXy(x + 6 + 3 * 8, y + 1, tp->items[tpos]->name, 21);
		if (flag == ESC) break;

		hgHideMouse();
		hgOverTextXy(x + 6 + 3 * 8, y + 1, tp->items[tpos]->name);
		hgShowMouse();

		flag = hgInTextXy(x + 6 + 25 * 8, y + 1, tp->items[tpos]->telnum, 17);
		if (flag == ESC) break;

		hgHideMouse();
		hgOverTextXy(x + 6 + 25 * 8, y + 1, tp->items[tpos]->telnum);
		hgShowMouse();

		flag = speed_bps(tp->items[tpos]->baud);
		if (flag == -1) break;
		tp->items[tpos]->baud = flag;

		hgHideMouse();
		modemvar2str(tp->items[tpos]->baud, tp->items[tpos]->parity, tp->items[tpos]->data, tp->items[tpos]->stop, mline);
		hgBoxFill(x + 6 + 43 * 8, y, x + 6 + 54 * 8 + 7, y + 20, LIGHTGRAY);
		hgOutTextXy(x + 6 + 43 * 8, y + 1, mline);
		hgShowMouse();

		flag = parity_bit(tp->items[tpos]->parity);
		if (flag == -1) break;
		tp->items[tpos]->parity = flag;

		hgHideMouse();
		modemvar2str(tp->items[tpos]->baud, tp->items[tpos]->parity, tp->items[tpos]->data, tp->items[tpos]->stop, mline);
		hgBoxFill(x + 6 + 43 * 8, y, x + 6 + 54 * 8 + 7, y + 20, LIGHTGRAY);
		hgOutTextXy(x + 6 + 43 * 8, y + 1, mline);
		hgShowMouse();

		flag = data_bit(tp->items[tpos]->data - 7);
		if (flag == -1) break;
		tp->items[tpos]->data = flag + 7;

		hgHideMouse();
		modemvar2str(tp->items[tpos]->baud, tp->items[tpos]->parity, tp->items[tpos]->data, tp->items[tpos]->stop, mline);
		hgBoxFill(x + 6 + 43 * 8, y, x + 6 + 54 * 8 + 7, y + 20, LIGHTGRAY);
		hgOutTextXy(x + 6 + 43 * 8, y + 1, mline);
		hgShowMouse();

		flag = stop_bit(tp->items[tpos]->stop - 1);
		if (flag == -1) break;
		tp->items[tpos]->stop = flag + 1;

		hgHideMouse();
		modemvar2str(tp->items[tpos]->baud, tp->items[tpos]->parity, tp->items[tpos]->data, tp->items[tpos]->stop, mline);
		hgBoxFill(x + 6 + 43 * 8, y, x + 6 + 54 * 8 + 7, y + 20, LIGHTGRAY);
		hgOutTextXy(x + 6 + 43 * 8, y + 1, mline);
		hgShowMouse();

		flag = host_han(tp->items[tpos]->han - 1);
		if (flag == -1) break;
		tp->items[tpos]->han = flag + 1;

		break;
	}

	hgSpecInModeOff();

	hgSetTBcolor(bsave);
}

void     comdial_send(char *dial)
{
	int   i = 0;

	comDataOut('A');
	comDataOut('T');
	comDataOut('D');
	comDataOut(phone[phoneflag]);
	while (dial[i] != NULL) comDataOut(dial[i++]);
	comDataOut(RETURN);
}

int      comTelDialing(int tpos)
{
	struct  time  t;

	char   color;
	char   temp[5];
	char   count = 1;
	int    x, y;
	int    xs, ys;
	int    ret_t = 0, ret_t2 = 0;
	int    key;
	int    sdata, sstop, sbaud;
	char   spar;
	int    shosthan;

	if (comIsCarrier()) return(hgFAIL);

	xs = 450;
	ys = 100;
	x = (hgGetx2r() + hgGetx1r()) / 2 - xs / 2;
	y = (hgGety2r() + hgGety1r()) / 2 - ys / 2;

	if (hgIsHerc()) color = DARKGRAY;
	else color = BLUE;

	hgHideMouse();

	savearea(x, y, x + xs, y + ys);

	hgDrawBorder(x, y, x + xs, y + ys, BOXNORMAL, FILL);
	hgDrawBorder(x + 6, y + 20 + 14, x + xs - 6, y + ys - 6, BOXREVERSE, NOFILL);

	hgBoxFill(x + 7, y + 8, x + xs - 7, y + 28, color);

	hgForeTextXy(x + 16, y + 10, "          Ÿœ   ∏Â—¡üi à·ìe ∫ó∑≥ì°îa.  Ÿœ         ", WHITE);
	hgOutTextXy(x + 16, y + 20 + 16, "  ESC - ∏Â—¡àÈã° ∫óîe,  SPACE - ègâ° îaØ° àÈã°     ");
	hgOutTextXy(x + 16, y + 20 + 32, "  à·ìeâµ -                      , Ø°ï°“UÆÅ -    §Â ");
	hgOutTextXy(x + 16, y + 20 + 48, "  ∏Â—¡§Â—° -                    , êq∑eØ°àe -    ¡° ");
	hgOutTextXy(x + 16 + 96, y + 20 + 32, tp->items[tpos]->name);
	hgOutTextXy(x + 16 + 112, y + 20 + 48, tp->items[tpos]->telnum);

	hgShowMouse();

	sdata = dataflag;
	sstop = stopflag;
	spar = parflag;
	sbaud = baudflag;

	dataflag = tp->items[tpos]->data;
	stopflag = tp->items[tpos]->stop;
	parflag = tp->items[tpos]->parity;
	baudflag = tp->items[tpos]->baud;

	modem_status();
	comSetupPort();

	shosthan = hgSrcCode();
	hgSetCodeTable(tp->items[tpos]->han);
	hosthan_status();

	hgHideMouse();

	do {
		itoa(count, temp, 10);
		hgBoxFill(x + 16 + 46 * 8, y + 20 + 32, x + 47 + 46 * 8, y + 35 + 32, LIGHTGRAY);
		hgOutTextXy(x + 16 + 46 * 8, y + 20 + 32, temp);

		comdial_send(tp->items[tpos]->telnum);
		gettime(&t);

		key = NOKEY;
		while (ret_t != -1) {
			ret_t = time_delay(t, dialdelay);
			if (comIsCarrier()) break;

			hgEngInModeOn();
			key = inkey(NOWAIT);
			hgEngInModeOff();

			if (key == ESC || key == SPACE) break;

			if (ret_t != ret_t2) {
				itoa(ret_t, temp, 10);
				hgBoxFill(x + 16 + 46 * 8, y + 20 + 48, x + 47 + 46 * 8, y + 35 + 48, LIGHTGRAY);
				hgOutTextXy(x + 16 + 46 * 8, y + 20 + 48, temp);

				ret_t2 = ret_t;
			}
		}

		if (comIsCarrier()) break;

		comDataOut(RETURN);
		comClearBuffer();

		count++;
		ret_t = ret_t2 = 0;

		delay(chaindial * 10);
	} while (key != ESC);

	if (key == ESC) comClearBuffer();

	hgRestore();
	hgSetSaveOff();

	if (comIsCarrier()) {
		gettime(&ontime);
		connectflag = hgTRUE;
		connect_status();
		connect_sound();

		return(hgSUCCESS);
	}
	else {
		dataflag = sdata;
		stopflag = sstop;
		parflag = spar;
		baudflag = sbaud;

		modem_status();
		comSetupPort();

		hgSetCodeTable(shosthan);
		hosthan_status();

		return(hgFAIL);
	}
}

int      time_delay(struct time t, int del)
{
	struct  time  t2;

	int   dd;

	gettime(&t2);
	dd = (t2.ti_hour - t.ti_hour) * 3600 + (t2.ti_min - t.ti_min) * 60 + (t2.ti_sec - t.ti_sec);

	if (dd <= del) return(del - dd);
	else return(-1);
}
