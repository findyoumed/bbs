/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hwp.c  --  HWP ÑÁ·© ¥¡‹¡ ¡¡—I                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <stdio.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MAXHWPLINE      100

			/* HWP Èa·¡Ïa */
#define     HWP12           0
#define     HWP15           1
#define     HWP20           2
#define     SECRETE         3
#define     NO_HWP          4

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char    *hwpErr[] = {
	" ´aœ´a Ðe‹i v1.2 ÑÁ·©·³“¡”a. ",
	" ´aœ´a Ðe‹i v1.5 ÑÁ·©·³“¡”a. ",
	" ´aœ´a Ðe‹i v2.0 ÑÁ·©·³“¡”a. ",
	" ´qÑ¡ˆa ˆéa ·¶¯s“¡”a.       ",
	" ´aœ´a Ðe‹i ÑÁ·©·¡ ´a“³“¡”a. "
};

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreSeeHWP();			/* HWPÑÁ·© ¥¡‹¡ @K */

int      gethwpmodefpt(FILE *fpt);
int      hgGetHWPMode(char *fname);
void     hgReadHWPLine(char *fname);


void     nreSeeHWP()
{
	int    flag;
	char   hfile[50] = { "*.HWP" };

	flag = hgGetFileName(" ¥© HWP ÑÁ·© ·¡Ÿq·e? ", hfile);
	if (!flag) return;

	hgReadHWPLine(hfile);
}

int      gethwpmodefpt(FILE *fpt)
{
	char   hdr[20];
	char   ver[5];
	int    value = NO_HWP;

	fseek(fpt, 0L, SEEK_SET);
	fread(hdr, 19, 1, fpt);
	fread(ver, 5, 1, fpt);
	hdr[19] = 0;
	ver[3] = 0;

	if (strcmp(hdr, "HWP Document File V") != 0) return(NO_HWP);

	if (strcmp(ver, "1.2") == 0) value = HWP12;
	if (strcmp(ver, "1.5") == 0) value = HWP15;
	if (strcmp(ver, "2.0") == 0) value = HWP20;

	fseek(fpt, 121L, SEEK_SET);
	if (getc(fpt) + getc(fpt)) value = SECRETE;

	return(value);
}

int      hgGetHWPMode(char *fname)
{
	FILE  *fpt;

	int   value;

	fpt = fopen(fname, "rb");
	value = gethwpmodefpt(fpt);
	fclose(fpt);

	return(value);
}

void     hgReadHWPLine(char *fname)
{
	FILE   *fpt;

	char   *items[MAXHWPLINE];
	char   temp[255];		/* max string length */
	int    value;
	int    max = 0;
	int    i, pos;
	int    size;
	int    ch1, ch2;
	int    charnum, attrnum;
	int    num1, num2;
	long   hanjavalue;
	long   data_pnt = 158L;

	fpt = fopen(fname, "rb");
	if (fpt == NULL) return;

	value = gethwpmodefpt(fpt);
	if (value != HWP12 && value != HWP15) {
		hgSetSaveOn();
		hgDisplayMessage(hwpErr[value], RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();

		fclose(fpt);
		return;
	}

	while (max < MAXHWPLINE - 1) {
		fseek(fpt, data_pnt, SEEK_SET);
		num1 = getc(fpt);
		if (feof(fpt)) goto end;

		num2 = getc(fpt);
		charnum = num1 * 256 + num2;

		while (charnum == 0) {
			fseek(fpt, 18L, SEEK_CUR);
			num1 = getc(fpt);
			if (feof(fpt)) goto end;

			num2 = getc(fpt);
			charnum = num1 * 256 + num2;
		}

		attrnum = 0;
		fseek(fpt, 18L, SEEK_CUR);
		while (charnum > attrnum) {
			attrnum = attrnum + getc(fpt);
			fseek(fpt, 2L, SEEK_CUR);
		}
		fseek(fpt, 1L, SEEK_CUR);
		data_pnt = ftell(fpt);
		data_pnt += (long)(charnum * 2);

		for (i = 0, pos = 0;i < charnum;i++) {
			ch2 = getc(fpt);
			ch1 = getc(fpt);
			if (ch1 >= 64 && ch1 <= 83) {
				hanjavalue = (ch1 - 64) * 256 + ch2;
				ch1 = (int)(224 + ((hanjavalue - 1) / 188));
				ch2 = (int)((hanjavalue - 1) % 188 + 50);
				if (ch2 > 127) ch2 = ch2 + 18;
			}
			if (ch1) temp[pos++] = (char)ch1;
			temp[pos] = (char)ch2;
			if (ch1 == 0 && ch2 >= 179) {
				temp[pos] = '+';
				if (ch2 == 188 || ch2 == 199 || ch2 == 210 || ch2 == 221
				 || ch2 == 232 || ch2 == 243 || ch2 == 254) temp[pos] = '-';
				if (ch2 == 189 || ch2 == 200 || ch2 == 211 || ch2 == 222
				 || ch2 == 233 || ch2 == 244 || ch2 == 255) temp[pos] = '|';
			}
			pos++;
			if (pos > 253) break;
		}
		size = (pos > 58) ? 58 : pos;
		for (i = 0;i < size;)
			if (temp[i] & 0x80) i += 2;
			else i++;
		temp[i] = 0;
		items[max] = (char *)malloc((size_t)(size + 2));
		strcpy(items[max], temp);
		max++;
	}
end:
	fclose(fpt);

	items[max] = (char *)malloc((size_t)3);
	items[max][0] = 0;
	items[max][1] = 0;

	hgSetSaveOn();
	hgPrtHelpBoxXyM(items, 60, 20, fname);
	hgRestore();
	hgSetSaveOff();

	for (i = 0;i <= max;i++)
		free(items[i]);
}
