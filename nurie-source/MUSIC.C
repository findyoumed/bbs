/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : music.c  -- ·q´b µeº ¡¡—I                    |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <fcntl.h>
#include    <process.h>
#include    <stdlib.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */
#include    "adsound.h"			/* ¬a¶…—aµA ”Ðe ¬w® ¸÷· */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     ErrNoSDSpace     -1
#define     ErrFileNotFound  -2
#define     ErrReadFile      -3
#define     BankFileNotFound -6
#define     NoErr             0

#define     NOT_ALL_SENT      1
#define     ALL_SENT          0

#define     STILL_PLAYING     1
#define     DONE_PLAYING      0

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     rfile[50] = { "*.ROL" };

int      playflag = hgFALSE;		/* ·q´b ‹¡“w µa¦ */
int      drawflag = hgFALSE;		/* ·q´b ¬wÈ µa¦ */

extern   int      vol_adjust;
extern   int      basicTempo;
extern   int      tickPerBeat;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreMusicPlay();		/* ·q´b ‹¡“w  @P */

void     adVerifyMusic();
void     adPlaySpeaker();
void     adPlayAdlib();

void     adMusicStateDraw();
void     display_pitch(int voice, int pitch, int base);
void     display_volume(int voice, int volume, int base);
void     display_relvolume(int volume, int base);
void     display_timbre(int voice, char *name);


void     nreMusicPlay()
{
	int   flag;

	flag = adGetSoundVersion();

	if (!flag) adPlaySpeaker();
	else adPlayAdlib();
}

void     adVerifyMusic()
{
	if (playflag) {
		hgSetSaveOn();
		hgDisplayMessage(" ·q´b·i  ñÂ““¡”a. ", BLUE);
		adTurnOffDriver();
		adSetEnd();
		delay(500);
		hgRestore();
		hgSetSaveOff();

		playflag = hgFALSE;
		return;
	}
}

void     adPlaySpeaker()
{
	hgSetSaveOn();
	hgDisplayMessage(" ·q´b·i µeºÐs“¡”a. ", BLUE);
	if (spawnlp(P_WAIT, "song.nu", NULL) == -1) errorsound();
	hgRestore();
	hgSetSaveOff();
}

void     adPlayAdlib()
{
	char   str[40];
	int    key;
	int    flag;
	int    ret;
	int    transp = 0;

	if (playflag) {
		hgSetSaveOn();
		hgDisplayMessage(" ·q´b·i  ñÂ““¡”a. ", BLUE);
		adTurnOffDriver();
		adSetEnd();
		delay(500);
		hgRestore();
		hgSetSaveOff();

		playflag = hgFALSE;
		return;
	}

	flag = hgGetFileName(" µeºÐi ÑÁ·© ·¡Ÿq·e? ", rfile);
	if (!flag) return;

	ret = adSetUpMelody(rfile, "standard.bnk");

	if (ret == NoErr) {
		playflag = hgTRUE;
		drawflag = hgTRUE;

		hgSetSaveOn();
		adMusicStateDraw();
		hgEngInModeOn();

		do {
			ret = adSendMelody();

			key = inkey(NOWAIT);
			if (key == ESC) break;
			if (key == '>' || key == '.') {
				basicTempo++;
				adSetTempo((int)basicTempo, 0, tickPerBeat);
			}
			if (key == '<' || key == ',') {
				basicTempo--;
				if (basicTempo < 1) basicTempo = 1;
				adSetTempo((int)basicTempo, 0, tickPerBeat);
			}
			if (key == '=' || key == '+') {
				transp++;
				adSetTranspose(transp);
			}
			if (key == '-' || key == '_') {
				transp--;
				adSetTranspose(transp);
			}
			if (key == UP) {
				vol_adjust += 5;
				if (vol_adjust > 128) vol_adjust = 128;
				display_relvolume(vol_adjust, 128);
				adAdjustVolume();
			}
			if (key == DOWN) {
				vol_adjust -= 5;
				if (vol_adjust < 0) vol_adjust = 0;
				display_relvolume(vol_adjust, 128);
				adAdjustVolume();
			}
			if (key == ALT_P) {
				adTurnOffDriver();
				ret = ALL_SENT;
			}
		} while (ret == NOT_ALL_SENT);

		hgEngInModeOff();
		hgRestore();
		hgSetSaveOff();

		drawflag = hgFALSE;

		if (ret == ALL_SENT) {
			adSetEnd();
			playflag = hgFALSE;
		}
	}
	else {
		switch (ret) {
			case ErrFileNotFound :
				strcpy(str, " ROL ÑÁ·©·¡ ´ô¯s“¡”a. ");
				break;
			case ErrReadFile :
				strcpy(str, " ROL ÑÁ·©·i ·ª“e•A ¯©ÌÐ–¯s“¡”a. ");
				break;
			case BankFileNotFound :
				strcpy(str, " BANK ÑÁ·©·¡ ´ô¯s“¡”a. ");
				break;
		}
		str[strlen(str) - 1] = 0;

		hgSetSaveOn();
		hgDisplayMessage(str, RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();
	}
}

void     adMusicStateDraw()
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - 400 / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - 300 / 2;

	int   i;
	int   xs, ys;

	xs = 400;
	ys = 290;

	hgPrtWindowXy(x, y, x + xs, y + ys, " ·q´b ¬wÈ ");

	hgHideMouse();

	hgBoxFill(x + 14, y + 34, x + xs - 13, y + ys - 13, LIGHTGRAY);
	hgHline(x + 14, x + xs - 13, y + 235, ZERO);
	hgHline(x + 14, x + xs - 13, y + 236, WHITE);

	hgDrawBorder(x + 60, y + 38, x + 180, y + 58, BOXNORMAL, NOFILL);
	hgDrawBorder(x + 232, y + 38, x + 342, y + 58, BOXNORMAL, NOFILL);
	hgOutTextXy(x + 65, y + 40, "  ·q ‘¼ ·¡ ");
	hgOutTextXy(x + 237, y + 40, " ­¡Ÿ¡ Ça‹¡ ");

	for (i = 0;i < NR_VOICES;i++) {
		hgDrawBorder(x + 40, y + 60 + i * 10, x + 190, y + 67 + i * 10, BOXREVERSE, NOFILL);
		hgDrawBorder(x + 212, y + 60 + i * 10, x + 362, y + 67 + i * 10, BOXREVERSE, NOFILL);
	}
	hgDrawBorder(x + 212, y + 175, x + 362, y + 182, BOXREVERSE, NOFILL);

	hgDrawBorder(x + 20, y + 188, x + 380, y + 208, BOXNORMAL, NOFILL);
	hgOutTextXy(x + 25, y + 190, "¬åÈ‚´b‹¡: ");

	hgDrawBorder(x + 20, y + 210, x + 380, y + 230, BOXNORMAL, NOFILL);
	hgOutTextXy(x + 25, y + 212, "µeº‰¢: ");
	hgOutTextXy(x + 96, y + 212, rfile);

	hgOutTextXy(x + 30, y + 240, "ÙD ÙE : ÉQÍ¡ ¹¡¸÷  Ú= Ú; : ·q¹¡ ¹¡¸÷ ");
	hgOutTextXy(x + 30, y + 260, "Ùx Ùy : ¥©ŸQ ¹¡¸÷  ESC  ALT_P : º—”e ");

	hgShowMouse();

	display_relvolume(vol_adjust, 128);
}

void     display_pitch(int voice, int pitch, int base)
{
	char   color;
	int    i;
	int    x = (hgGetx2r() + hgGetx1r()) / 2 - 400 / 2;
	int    y = (hgGety2r() + hgGety1r()) / 2 - 300 / 2;
	int    length;

	if (!drawflag) return;

	if (hgIsHerc()) color = WHITE;
	else color = GREEN;

	length = (148 * pitch) / base;
	if (length > 148) length = 148;

	hgHideMouse();
	hgBoxFill(x + 41, y + 61 + voice * 10, x + 189, y + 66 + voice * 10, ZERO);
	for (i = 0;i < length;i += 4)
		hgBoxFill(x + 41 + i, y + 61 + voice * 10, x + 41 + i + 2, y + 66 + voice * 10, color);
	hgShowMouse();
}

void     display_volume(int voice, int volume, int base)
{
	char   color;
	int    i;
	int    x = (hgGetx2r() + hgGetx1r()) / 2 - 400 / 2;
	int    y = (hgGety2r() + hgGety1r()) / 2 - 300 / 2;
	int    length;

	if (!drawflag) return;

	if (hgIsHerc()) color = WHITE;
	else color = RED;

	length = (148 * volume) / base;
	if (length > 148) length = 148;

	hgHideMouse();
	hgBoxFill(x + 213, y + 61 + voice * 10, x + 361, y + 66 + voice * 10, ZERO);
	for (i = 0;i < length;i += 4)
		hgBoxFill(x + 213 + i, y + 61 + voice * 10, x + 213 + i + 2, y + 66 + voice * 10, color);
	hgShowMouse();
}

void     display_relvolume(int volume, int base)
{
	char   color;
	int    i;
	int    x = (hgGetx2r() + hgGetx1r()) / 2 - 400 / 2;
	int    y = (hgGety2r() + hgGety1r()) / 2 - 300 / 2;
	int    length;

	if (!drawflag) return;

	if (hgIsHerc()) color = WHITE;
	else color = CYAN;

	length = (148 * volume) / base;
	if (length > 148) length = 148;

	hgHideMouse();
	hgBoxFill(x + 213, y + 176, x + 361, y + 181, ZERO);
	for (i = 0;i < length;i += 4)
		hgBoxFill(x + 213 + i, y + 176, x + 213 + i + 2, y + 181, color);
	hgShowMouse();
}

void     display_timbre(int voice, char *name)
{
	char   temp[5];
	int    x = (hgGetx2r() + hgGetx1r()) / 2 - 400 / 2;
	int    y = (hgGety2r() + hgGety1r()) / 2 - 300 / 2;

	if (!drawflag) return;

	itoa(voice + 1, temp, 10);

	hgHideMouse();
	hgBoxFill(x + 104, y + 190, x + 300, y + 206, LIGHTGRAY);
	hgOutTextXy(x + 104, y + 190, "Àé[");
	hgOutTextXy(x + 144, y + 190, temp);
	hgOutTextXy(x + 160, y + 190, "]");
	hgForeTextXy(x + 176, y + 190, name, BLUE);
	hgShowMouse();
}