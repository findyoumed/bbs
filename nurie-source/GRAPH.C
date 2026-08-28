/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : graph.c  -- Ëb® ¢…¸a ·³Â‰b ¡¡—I             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <ctype.h>
#include    <string.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

ExtFont *graph;				/* Ëb® ¢…¸a ¶A¦ ‹i© */

int      sgpos = 0;			/* Ëb® ¢…¸a ¤b¯a· ¥e® */
int      sspos[7] = {0, };
int      sobjt[7] = {0, };
int      sapos[7] = {0, };

char    *selectg[] = {
	" ¬q¥¡‹aŸ±¢…¸a       ",
	" •¡Ñw¢…¸a           ",
	" ¸åˆbµw¢…, Ðe‹i{¸a ",
	" ¡ a®•¸a, ‰á¬å¢…¸a ",
	" ”e¶á‹¡Ñ¡, œaË¥(1)  ",
	" œaË¥(2), ·©¥¥(1)   ",
	" ·©¥¥(2), œá¯¡´a    ",
	""
};

extern   int     _xpos, _ypos;
extern   char     graphokflag;		/* Ëb® ¢…¸a Ãib ˆa“w µa¦ */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgGraphicCharInit();
void     hgGraphCharEnd();

void     hgGraphCharType();
int      isgraphic(char *str, int pos);
int      hgGraphCharIn(int *ch);
void     graph_real_out(char *str, int pos);

ExtFont *hgOpenExtFont(char *fname, int x, int y, int qsize);

			/* function pointer */
extern   void   (*grps)(char *str, int pos);


void     hgGraphicCharInit(char *fname, int qsize)
{
	if (qsize > 500) qsize = 500;
	graph = hgOpenExtFont(fname, 2, 16, qsize);

	if (graph != NULL) {
		graphokflag = hgTRUE;
		grps = &graph_real_out;
	}
}

void     hgGraphicCharEnd()
{
	if (graphokflag) hgCloseExtFont(graph);
}

void     hgGraphCharType()
{
	int   ret;

	hgSetSaveOn();
	ret = hgSelectXyM(selectg, sgpos);
	hgSetSaveOff();

	if (ret != -1) sgpos = ret;
}

int      isgraphic(char *str, int pos)
{
	byte   fontID[] = {
		0xd4, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde
	};
	byte   high, low;
	int    i;

	for (i = 0;i < 7;i++) {
		high = fontID[i];
		if (high == 0xd4) low = 0x80;
		else low = 0x31;

		if ((byte)str[pos] == high && (byte)str[pos + 1] >= low)
			return(hgSUCCESS);
	}
	return(hgFAIL);
}

int      hgGraphCharIn(int *ch)
{
	HDIRBOX *p;
	WIDTH    w = { 280, 178 };

	byte   fontID[] = {
		0xd4, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde
	};
	int    addoff[] = {
		125, 162, 188, 162, 188, 177, 175
	};
	int    sblank[] = {
		1,  1,  0,  0,  0,  0,  0
	};
	byte   high, low = 0x31;

	char   *items[_MAXDIR];
	byte   ret[5];
	int    i;
	int    x, y;
	int    retflag;

	x = (hgGetx2r() + hgGetx1r()) / 2 - w.xwidth / 2;
	y = (hgGety2r() + hgGety1r()) / 2 - w.ywidth / 2;

	high = fontID[sgpos];
	if (high == 0xd4) low = 0x80;

	for (retflag = 0;retflag < (addoff[sgpos] + sblank[sgpos]);retflag++) {
		items[retflag] = (char *)malloc((size_t)3);
		items[retflag][0] = high;
		items[retflag][1] = low;
		items[retflag][2] = 0;

		low++;
		if (high != 0xd4 && low == 0x7f) low = 0x91;
	}
	items[retflag] = (char *)malloc((size_t)3);
	items[retflag][0] = 0;
	items[retflag][1] = 0;
	items[retflag][1] = 0;

	hgSetRecPosOn();
	hgChangeDirBox(sspos[sgpos], sobjt[sgpos], sapos[sgpos]);

	hgSetSaveOn();
	p = hgHDIRBOX_Load(items, w, 8, 6);
	hgHDIRBOX_Choose(p, x, y, selectg[sgpos], ret);
	hgHDIRBOX_Free(&p);
	hgSetSaveOff();
	hgRestore();

	hgGetDirBox(&sspos[sgpos], &sobjt[sgpos], &sapos[sgpos]);
	hgSetRecPosOff();

	for (retflag = 0;retflag <= (addoff[sgpos] + sblank[sgpos]);retflag++)
		free(items[retflag]);

	if (!strcmp(ret, "")) return(hgFAIL);
	else {
		*ch = (ret[0] << 8) + ret[1];
		return(hgSUCCESS);
	}
}

void     graph_real_out(char *str, int pos)
{
	byte   fontID[] = {
		0xd4, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde
	};
	int    addoff[] = {
		125, 162, 188, 162, 188, 177, 175
	};
	int    sblank[] = {
		1,  1,  0,  0,  0,  0,  0
	};
	byte   high, low;
	byte   temp;

	char   sattr;
	int    i, j;
	int    fac = 1;
	unsigned  off;

	for (i = 0;i < 7;i++) {
		high = fontID[i];
		if (high == 0xd4) low = 0x80;
		else low = 0x31;

		if ((byte)str[pos] == high && (byte)str[pos + 1] >= low)
			break;
	}
	temp = (byte)str[pos + 1];
	off = temp - low;

	if (high == 0xd4) {
		if ((off < sblank[i]) || (off > addoff[i]))  off = 486;
	}
	else {
		if ((off < sblank[i]) || (temp > 0x7e && temp < 0x91)
		   || (off >= (addoff[i] + sblank[i] + 18))) off = 486;
	}

	if (off != 486) {
		if ((high != 0xd4) && (temp >= 0x91)) off -= 18;
		off -= sblank[i];
		for (j = 0;j < i;j++) off += addoff[j];
	}

	sattr = hgGetExtAttr();
	hgSetExtAttr(hgGetHAttr());
	hgPutExtFont(graph, _xpos, _ypos, off);
	hgSetExtAttr(sattr);

	for (i = 1;i < hgGetXFactor();i++) fac *= 2;
	_xpos += (16 * fac);
}
