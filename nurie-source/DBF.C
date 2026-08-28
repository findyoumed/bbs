/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : dbf.c  -- ID ‰ÅŸ¡ ¡¡—I                        |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <dos.h>
#include    <fcntl.h>
#include    <io.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "data.h"			/* •A·¡Èa ÑÁ·©µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

IDREC    IdData;			/* Ðeˆ· •A·¡Èa AÅ¡—a */

int      Dtahd, Idxhd;			/* •A·¡ÈaµÁ ·¥•B¯a· ÑÁ·© Ð…—i */

HEADER   hd;
int      findflag;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  declaration                           |
 |-------------------------------------------------------------------*/

void     nreIdDBF();			/* ´a·¡—¡ ‰ÅŸ¡  @F */

void     display_format(int x, int y);
void     display_btbutton(int x, int y);
int      get_btkey(int x, int y, int mx, int my);

void     btIdChoose(int x, int y, int xs, int ys, char *title);
int      btIdEdit(int x, int y, long *pos);
int      btIdSearch(int x, int y, long *pos);
int      btIdDelete(int x, int y, long *pos);
int      btIdInsert(int x, int y, long *pos);
int      btIdBefore(int x, int y, long *pos);
int      btIdNext(int x, int y, long *pos);
int      btIdFirst(int x, int y, long *pos);
int      btIdLast(int x, int y, long *pos);
int      btIdReindex(int x, int y, long *pos);
void     btIdDisplay(int x, int y, long *pos);


void     nreIdDBF()
{
	int    x = (hgGetx2r() + hgGetx1r()) / 2 - 420 / 2;
	int    y = (hgGety2r() + hgGety1r()) / 2 - (190 + 60) / 2;
	long   i, rec_no;

	if ((Dtahd = btOpenDataFile("NURIE", ID_SIZE, sizeof(IdData.name))) == -1) {
		hgSetSaveOn();
		hgDisplayMessage(" •A·¡Èa ÑÁ·©·i µa“e•A ¯©ÌÐ–¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();

		return;
	}

	if ((Idxhd = btOpenIdxFile("NURIE.NDX")) == -1) {
		hgSetSaveOn();
		hgDisplayMessage(" ·¥•B¯a ÑÁ·©·i  e—s“¡”a. ", MAGENTA);
		rec_no = btGetLastRecordNo(Dtahd);
		btMakeIdxFile("NURIE.NDX", sizeof(IdData.name), hgTRUE);
		Idxhd = btOpenIdxFile("NURIE.NDX");
		for (i = 1L;i <= rec_no;i++) {
			btReadData(Dtahd, i, (byte *)&IdData);
			btInsKey(Idxhd, IdData.name, i);
			if (IdData.next != 0L) {
				IdData.next = 0L;
				btWriteData(Dtahd, i, (byte *)&IdData);
			}
		}
		btGetDataHeader(Dtahd, &hd);
		hd.del_rec = 0L;
		hd.next_rec = i;
		btSetDataHeader(Dtahd, &hd);
		hgRestore();
		hgSetSaveOff();
	}

	findflag = hgFALSE;
	memset((byte *)&IdData, '\0', (size_t)ID_SIZE);

	hgSetSaveOn();
	btIdChoose(x, y, 420, (190 + 60), " ID ‰ÅŸ¡ ¤b¯a ");
	hgRestore();
	hgSetSaveOff();

	btCloseDataFile(Dtahd);
	btCloseIdxFile(Idxhd);
}

void     display_format(int x, int y)
{
	hgHideMouse();
	hgOverTextXy(x + 14, y + 34, " •A·¡Èa Á·ˆ•® :       Ñe¸ •A·¡Èa ¤åÑ¡ :        ");
	hgOverTextXy(x + 14, y + 54, " ·¡Ÿq :                      ´a·¡—¡ :            ");
	hgOverTextXy(x + 14, y + 74, " º­¡ :                                          ");
	hgOverTextXy(x + 14, y + 94, " ¸åÑÁ :                 »¢´ó :                   ");
	hgOverTextXy(x + 14, y + 114, " Âá£¡ :                      ¬a¶wPC :            ");
	hgOverTextXy(x + 14, y + 134, " Ðbb :                      ‰Å  ‰ :            ");
	hgOverTextXy(x + 14, y + 154, " ‹¡Èa :                                          ");
	hgShowMouse();
}

void     display_btbutton(int x, int y)
{
	hgDrawBorder(x, y, x + 79, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x, y + 20, x + 79, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 80, y, x + 159, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 80, y + 20, x + 159, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 160, y, x + 239, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 160, y + 20, x + 239, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 240, y, x + 319, y + 19, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 240, y + 20, x + 319, y + 39, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 320, y, x + 389, y + 39, BOXNORMAL, NOFILL);

	hgOutTextXy(x + 8, y + 2, "®¸÷F2  ");
	hgOutTextXy(x + 8, y + 22, "ˆñ¬‚F3  ");
	hgOutTextXy(x + 88, y + 2, "¬b¹ADel ");
	hgOutTextXy(x + 88, y + 22, "¬s·³Ins ");
	hgOutTextXy(x + 168, y + 2, "  ´|PgUp");
	hgOutTextXy(x + 168, y + 22, "”a·qPgDn");
	hgOutTextXy(x + 248, y + 2, "Àá·qHome");
	hgOutTextXy(x + 248, y + 22, "  {End ");
	hgOutTextXy(x + 328, y + 2, "·¥•B¯a ");
	hgOutTextXy(x + 328, y + 22, "¬¡F10");
}

int      get_btkey(int x, int y, int mx, int my)
{
	int   key = NOKEY;

	if (my > y && my < y + 19) {
		if (mx > x && mx < x + 79) key = F2;
		if (mx > x + 80 && mx < x + 159) key = DEL;
		if (mx > x + 160 && mx < x + 239) key = PgUp;
		if (mx > x + 240 && mx < x + 319) key = HOME;
		if (mx > x + 320 && mx < x + 389) key = F10;
	}
	else if (my > y + 20 && my < y + 39) {
		if (mx > x && mx < x + 79) key = F3;
		if (mx > x + 80 && mx < x + 159) key = INS;
		if (mx > x + 160 && mx < x + 239) key = PgDn;
		if (mx > x + 240 && mx < x + 319) key = END;
		if (mx > x + 320 && mx < x + 389) key = F10;
	}

	return(key);
}

void     btIdChoose(int x, int y, int xs, int ys, char *title)
{
	char   *text[] = { "" };
	int    ch;
	int    flag = hgSUCCESS;
	int    mx, my;
	long   pos = 0L;

	hgPrtWTextXy(x, y, x + xs, y + ys, title, text);

	hgHideMouse();
	hgBoxFill(x + 14, y + ys - 71, x + xs - 13, y + ys - 13, LIGHTGRAY);
	hgHline(x + 14, x + xs - 13, y + ys - 71, ZERO);
	hgHline(x + 14, x + xs - 13, y + ys - 70, WHITE);
	display_btbutton(x + 17, y + ys - 60);
	hgShowMouse();

	btIdDisplay(x, y, &pos);

	do {
		do {
			ch = windelay(x, y, x + xs, y + ys);
		} while (ch == NOKEY);

		if (ch == MOUSE_LEFT) {
			hgGetMousePos(&mx, &my);
			ch = get_btkey(x + 17, y + ys - 60, mx, my);
			while (hgLeftMouse());
		}

		if (ch == F2) flag = btIdEdit(x, y, &pos);
		if (ch == F3) flag = btIdSearch(x, y, &pos);
		if (ch == DEL) flag = btIdDelete(x, y, &pos);
		if (ch == INS) flag = btIdInsert(x, y, &pos);
		if (ch == PgUp) flag = btIdBefore(x, y, &pos);
		if (ch == PgDn) flag = btIdNext(x, y, &pos);
		if (ch == HOME) flag = btIdFirst(x, y, &pos);
		if (ch == END) flag = btIdLast(x, y, &pos);
		if (ch == F10) flag = btIdReindex(x, y, &pos);
		if (ch == ESC || ch == LEFTMARK || ch == RIGHTMARK) break;

		if (flag == hgFAIL) break;
	} while (1);
}

int      btIdEdit(int x, int y, long *pos)
{
	int   key;

	if (findflag == hgFALSE) {
		hgDisplayMessage("  å¸á ˆñ¬‚·i Ða­A¶a. ", RED);
		delay(1000);
		hgRestore();

		return(hgSUCCESS);
	}

	while (1) {
		key = hgInTextXy(x + 14 + 38 * 8, y + 54, IdData.id, sizeof(IdData.id) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 74, IdData.address, sizeof(IdData.address) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 94, IdData.tel, sizeof(IdData.tel) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 31 * 8, y + 94, IdData.job, sizeof(IdData.job) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 114, IdData.hobby, sizeof(IdData.hobby) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 38 * 8, y + 114, IdData.pcname, sizeof(IdData.pcname) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 134, IdData.school, sizeof(IdData.school) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 38 * 8, y + 134, IdData.rel, sizeof(IdData.rel) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 154, IdData.etc, sizeof(IdData.etc) - 2);
		break;
	}

	if (btWriteData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);

	btIdDisplay(x, y, pos);

	return(hgSUCCESS);
}

int      btIdSearch(int x, int y, long *pos)
{
	IDREC  data;

	int    key;
	long   spos;

	display_format(x, y);

	memset((byte *)&data, '\0', (size_t)ID_SIZE);
	key = hgInTextXy(x + 14 + 8 * 8, y + 54, data.name, sizeof(data.name) - 2);
	if (key == ESC) {
		btIdDisplay(x, y, pos);
		return(hgSUCCESS);
	}

	spos = *pos;

	*pos = btFindKey(Idxhd, data.name);
	if (*pos != -1L) {
		if (btReadData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);

		findflag = hgTRUE;
		btIdDisplay(x, y, pos);
	}
	else {
		hgDisplayMessage(" Ð”w •A·¡Èaˆa ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();

		*pos = spos;
		btIdDisplay(x, y, pos);
	}

	return(hgSUCCESS);
}

int      btIdDelete(int x, int y, long *pos)
{
	long   spos;

	if (findflag == hgFALSE) {
		hgDisplayMessage("  å¸á ˆñ¬‚·i Ða­A¶a. ", RED);
		delay(1000);
		hgRestore();

		return(hgSUCCESS);
	}

	if (btDelKey(Idxhd, IdData.name, *pos) == hgFAIL) {
		hgDisplayMessage(" ¬b¹AµA ¯©ÌÐÖ¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();
	}
	else {
		hgDisplayMessage(" ¬b¹AÐ–¯s“¡”a. ", MAGENTA);
		delay(1000);
		hgRestore();

		btGetDataHeader(Dtahd, &hd);
		IdData.next = hd.del_rec;
		hd.del_rec = *pos;
		btSetDataHeader(Dtahd, &hd);

		if (btWriteData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);
		btIdDisplay(x, y, pos);
	}

	return(hgSUCCESS);
}

int      btIdInsert(int x, int y, long *pos)
{
	IDREC  data;

	int   key;

	display_format(x, y);

	memset((byte *)&data, '\0', (size_t)ID_SIZE);
	key = hgInTextXy(x + 14 + 8 * 8, y + 54, data.name, sizeof(data.name) - 2);
	if (key == ESC) {
		btIdDisplay(x, y, pos);
		return(hgSUCCESS);
	}

	while (1) {
		key = hgInTextXy(x + 14 + 38 * 8, y + 54, data.id, sizeof(data.id) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 74, data.address, sizeof(data.address) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 94, data.tel, sizeof(data.tel) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 31 * 8, y + 94, data.job, sizeof(data.job) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 114, data.hobby, sizeof(data.hobby) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 38 * 8, y + 114, data.pcname, sizeof(data.pcname) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 134, data.school, sizeof(data.school) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 38 * 8, y + 134, data.rel, sizeof(data.rel) - 2);
		if (key == ESC) break;

		key = hgInTextXy(x + 14 + 8 * 8, y + 154, data.etc, sizeof(data.etc) - 2);
		break;
	}
	data.next = 0L;
	IdData = data;

	if ((*pos = btAppendData(Dtahd, (byte *)&IdData)) == -1L) return(hgFAIL);
	if (btInsKey(Idxhd, IdData.name, *pos) == hgFAIL) return(hgFAIL);

	findflag = hgTRUE;
	btIdDisplay(x, y, pos);

	return(hgSUCCESS);
}

int      btIdBefore(int x, int y, long *pos)
{
	long   spos;

	if (findflag == hgFALSE) {
		hgDisplayMessage("  å¸á ˆñ¬‚·i Ða­A¶a. ", RED);
		delay(1000);
		hgRestore();

		return(hgSUCCESS);
	}

	spos = *pos;

	*pos = btBeforeKey(Idxhd);
	if (*pos != -1L) {
		if (btReadData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);
		btIdDisplay(x, y, pos);
	}
	else {
		hgDisplayMessage(" Ð”w •A·¡Èaˆa ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();

		*pos = spos;
	}

	return(hgSUCCESS);
}

int      btIdNext(int x, int y, long *pos)
{
	long   spos;

	if (findflag == hgFALSE) {
		hgDisplayMessage("  å¸á ˆñ¬‚·i Ða­A¶a. ", RED);
		delay(1000);
		hgRestore();

		return(hgSUCCESS);
	}

	spos = *pos;

	*pos = btNextKey(Idxhd);
	if (*pos != -1L) {
		if (btReadData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);
		btIdDisplay(x, y, pos);
	}
	else {
		hgDisplayMessage(" Ð”w •A·¡Èaˆa ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();

		*pos = spos;
	}

	return(hgSUCCESS);
}

int      btIdFirst(int x, int y, long *pos)
{
	*pos = btFirstKey(Idxhd);
	if (*pos != -1L) {
		if (btReadData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);

		findflag = hgTRUE;
		btIdDisplay(x, y, pos);
	}
	else {
		hgDisplayMessage(" •A·¡Èaˆa Ðaa•¡ ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();

		findflag = hgFALSE;
		*pos = 0L;
	}

	return(hgSUCCESS);
}

int      btIdLast(int x, int y, long *pos)
{
	*pos = btLastKey(Idxhd);
	if (*pos != -1L) {
		if (btReadData(Dtahd, *pos, (byte *)&IdData) == -1L) return(hgFAIL);

		findflag = hgTRUE;
		btIdDisplay(x, y, pos);
	}
	else {
		hgDisplayMessage(" •A·¡Èaˆa Ðaa•¡ ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();

		findflag = hgFALSE;
		*pos = 0L;
	}

	return(hgSUCCESS);
}

int      btIdReindex(int x, int y, long *pos)
{
	long   i, rec_no;

	hgDisplayMessage(" ·¥•B¯a ÑÁ·©·i ”a¯¡  e—s“¡”a. ", MAGENTA);
	rec_no = btGetLastRecordNo(Dtahd);
	btCloseIdxFile(Idxhd);
	btMakeIdxFile("NURIE.NDX", sizeof(IdData.name), hgTRUE);
	Idxhd = btOpenIdxFile("NURIE.NDX");
	for (i = 1L;i <= rec_no;i++) {
		btReadData(Dtahd, i, (byte *)&IdData);
		btInsKey(Idxhd, IdData.name, i);
		if (IdData.next != 0L) {
			IdData.next = 0L;
			btWriteData(Dtahd, i, (byte *)&IdData);
		}
	}
	btGetDataHeader(Dtahd, &hd);
	hd.del_rec = 0L;
	hd.next_rec = i;
	btSetDataHeader(Dtahd, &hd);
	hgRestore();

	findflag = hgFALSE;
	*pos = 0;
	memset((byte *)&IdData, '\0', (size_t)ID_SIZE);
	btIdDisplay(x, y, pos);

	return(hgSUCCESS);
}

void     btIdDisplay(int x, int y, long *pos)
{
	long   rec_no = btGetLastRecordNo(Dtahd);

	display_format(x, y);

	hgHideMouse();
	hgPrintfXy(x + 14 + 17 * 8, y + 34, "%ld", rec_no);
	hgPrintfXy(x + 14 + 42 * 8, y + 34, "%ld", *pos);
	hgOutTextXy(x + 14 + 8 * 8, y + 54, IdData.name);
	hgOutTextXy(x + 14 + 38 * 8, y + 54, IdData.id);
	hgOutTextXy(x + 14 + 8 * 8, y + 74, IdData.address);
	hgOutTextXy(x + 14 + 8 * 8, y + 94, IdData.tel);
	hgOutTextXy(x + 14 + 31 * 8, y + 94, IdData.job);
	hgOutTextXy(x + 14 + 8 * 8, y + 114, IdData.hobby);
	hgOutTextXy(x + 14 + 38 * 8, y + 114, IdData.pcname);
	hgOutTextXy(x + 14 + 8 * 8, y + 134, IdData.school);
	hgOutTextXy(x + 14 + 38 * 8, y + 134, IdData.rel);
	hgOutTextXy(x + 14 + 8 * 8, y + 154, IdData.etc);
	hgShowMouse();
}
