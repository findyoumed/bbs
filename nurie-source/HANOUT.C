/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hanout.c  -- Ðe‹i Â‰b ¡¡—I                   |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <alloc.h>
#include    <fcntl.h>
#include    <io.h>
#include    <mem.h>
#include    <stdarg.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

union {
	hcode  c;
	hchar  b;
} han;

char     *fir;				/* ˆb ¢…¸a· ‹i© */
char     *mid;
char     *las;
char     *eng;
char     *spe;

HTYPE    htypes;
ETYPE    etypes;

int      _xpos = 0;			/* Â‰b–I ¬w” ¶áÃ¡ */
int      _ypos = 0;

char     engflag = hgFALSE;		/* µw¢… Â‰b¯¡ */
char     specialenable = hgFALSE;	/* Ëb® ¢…¸a1(¶A¦ Í¥Ëa) Â‰b ˆa“w µa¦ */
char     graphokflag = hgFALSE;		/* Ëb® ¢…¸a Â‰b ˆa“w µa¦ */
char     hanjaokflag = hgFALSE;		/* Ðe¸a Â‰b ˆa“w µa¦ */
char     textattrflag = hgFALSE;	/* ­¢¬÷ »¡¸÷ ˆa“w µa¦ */

int      hgYFAC = 1;			/* ÑÂ” ¤® */
int      hgXFAC = 1;

char     hgWMODE = UPDOWN;		/* ¢…¸a Â‰b ¤w¯¢ */

		    /* Á¡¬÷, º—¬÷, ¹·¬÷¥i¡ ¹¡ÐsÑw Å¡—aµA Ð”wÐa“e ‹i©·
		       ¶áÃ¡Ÿi Àq¹¡Ða“e ÉA·¡§i·¡”a. */
char     CodeTable[3][32] = {
	{ 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
	  0x0f, 0x10, 0x11, 0x12, 0x13, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 },
	{ 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x00, 0x00, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
	  0x00, 0x00, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x00, 0x00, 0x12, 0x13, 0x14, 0x15, 0x00, 0x00 },
	{ 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
	  0x0f, 0x10, 0x00, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x00, 0x00 }
};

char     *RefCho;
char     *RefJung;
char     *RefJong;

		    /* ¹·¬÷· ·A¢µÁ º—¬÷ Å¡—aŸi ·¡¶wÐe Á¡¬÷ ¤é® Àq¹¡Îa */
char     RefChoTable[4][22][2] = {
	{ 0, 0,  0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 1, 6, 3, 7,
	  3, 7, 3, 7, 1, 6, 2, 6, 4, 7, 4, 7, 4, 7, 2, 6, 1, 6, 3, 7, 0, 5 },
	{ 0, 0,  0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2, 3, 4, 5,
	  4, 5, 4, 5, 2, 3, 3, 3, 4, 5, 4, 5, 4, 5, 3, 3, 2, 3,  4, 5, 0, 1 },
	{ 0, 0,  0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 1, 6, 3, 8,
	  3, 8, 3, 8, 1, 6, 2, 7, 4, 9, 4, 9, 4, 9, 2, 7, 1, 6, 3, 8, 0, 5 },
	{ 0, 0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0,
	  0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0 }
};
		    /* ¹·¬÷· ·A¢µÁ Á¡¬÷ Å¡—aŸi ·¡¶wÐe º—¬÷ ¤é® Àq¹¡Îa */
char     RefJungTable[4][20][2] = {
	{ 1, 3,  0, 2, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3,
	  1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 0, 2, 1, 3, 1, 3, 1, 3 },
	{ 0, 1,  0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
	  0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1 },
	{ 1, 3,  0, 2, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3,
	  1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 0, 2, 1, 3, 1, 3, 1, 3 },
	{ 0, 0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0, 0 }
};
		    /* º—¬÷ codeŸi ·¡¶wÐe º—¬÷ ¤é® Àq¹¡Îa */
char     RefJongTable[4][22] = {
	{0,   0, 2, 0, 2, 1, 2, 1, 2, 3, 0, 2, 1, 3, 3, 1, 2, 1, 3, 3, 1, 1 },
	{0,   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
	{0,   0, 2, 0, 2, 1, 2, 1, 2, 3, 0, 2, 1, 3, 3, 1, 2, 1, 3, 3, 1, 1 },
	{0,   1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1 }
};

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgSetCtable(int type);
void     hgSetFontInit();
void     hgSetFontEnd();
void     hgSetHanFontRoom(int type);
void     hgSetEngFontRoom(int type);
void     hgSetSpecialFontRoom(int type);
void     hgFreeHanRoom();
void     hgFreeEngRoom();
void     hgFreeSpecialRoom();
void     hgSetHanFont(char *fname, int type);
void     hgSetEngFont(char *fname, int type);
void     hgSetSpecialFont(char *fname, int type);
ExtFont *hgOpenExtFont(char *fname, int x, int y, int qsize);
void     hgGetExtFont(ExtFont *p, int n);
void     hgPutExtFont(ExtFont *p, int x, int y, int num);
void     hgCloseExtFont(ExtFont *p);
int      hgGetExtFontNum(ExtFont *p);
int      hgGetExtFontXsize(ExtFont *p);
int      hgGetExtFontYsize(ExtFont *p);

void     hanja_null_function(char *str, int pos);
void     pos_null_function(char *str, int *pos);

int      isspecial(char *str, int pos);
void     hgOutTextXy(int x, int y, char *str);
void     attribute_process(char *dest, int bytes);
void     englishout_process(char *str, int pos);
void     specialout_process(char *str, int pos);
void     hanjaout_process(char *str, int pos);
void     graphout_process(char *str, int pos);
void     textattr_process(char *str, int *pos);
void     hangulout_process(char *str, int pos);
void     complete_hangul(char mode, char *dest, char *src, char nums);

void     hgOutText(char *str);
void     hgPrintfXy(int x, int y, char *fmt, ...);
void     hgPrintf(char *fmt, ...);
void     hgGotoXy(int x, int y);
int      hgGetOutX();
int      hgGetOutY();
void     hgEngOutTextXy(int x, int y, char *str);
void     hgEngPutch(int x, int y, char num);
void     hgEngPrintfXy(int x, int y, char *fmt,...);
void     hgOverTextXy(int x, int y, char *str);
void     hgFBTextXy(int x, int y, char *str, int fore, int back);
void     hgForeTextXy(int x, int y, char *str, int fore);
void     hgBackTextXy(int x, int y, char *str, int back);
void     hgSetSpecialCharOn();
void     hgSetSpecialCharOff();
void     hgSpecTextXy(int x, int y, char *str, int color1, int color2, int deep);
void     hgTextAttrInit();
void     textattr_real_out(char *str, int *pos);
void     hgSetTextAttrOn();
void     hgSetTextAttrOff();

void     widen_sub(char *s1, char *s2, int bytes);
void     widen(char *s1, char *s2, int bytes);
void     lengthen(char *s1, char *s2, int xbytes, int yscan);
void     putmn(int x, int y, char *buff, char color);
void     puthalf(int x, int y, char *buff, char color);

void     hgSetXFactor(int n);
void     hgSetYFactor(int n);
int      hgGetXFactor();
int      hgGetYFactor();
void     hgSetWriteMode(char mode);
char     hgGetWriteMode();

			/* function pointer */
void   (*hjps)(char *str, int pos) = &hanja_null_function;
void   (*grps)(char *str, int pos) = &hanja_null_function;
void   (*atps)(char *str, int *pos) = &pos_null_function;
void   (*magh)(int x, int y, char *font, char color);
void   (*mage)(int x, int y, char *font, char color);
extern   void   (*puth)(int x, int y, char *font, char color);
extern   void   (*pute)(int x, int y, char *font, char color);


void     hgSetCtable(int type)
{
	RefJong = &RefJongTable[type][0];
	RefJung = &RefJungTable[type][0][0];
	RefCho = &RefChoTable[type][0][0];
}

void     hgSetFontInit()
{
	if (!isexist("haniyg.fnt")) {
		printf("\nError: hangul font file can not be opened.\n");
		printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
		exit(1);
	}
	if (!isexist("roman.fnt")) {
		printf("\nError: english font file can not be opened.\n");
		printf("- made by Lee Jikchang. Nurie 1.5.\n\n");
		exit(1);
	}

	hgSetHanFont(HANIYG_HAN);
	hgSetEngFont(ROMAN_ENG);
}

void     hgSetFontEnd()
{
	hgFreeHanRoom();
	hgFreeEngRoom();
}

void     hgSetHanFontRoom(int type)
{
	int   sizef[4] = { 8 * 20 * 32, 6 * 20 * 32, 10 * 20 * 32, 2 * 20 * 32 };
	int   sizem[4] = { 4 * 22 * 32, 2 * 22 * 32,  4 * 22 * 32, 1 * 22 * 32 };
	int   sizel[4] = { 4 * 28 * 32, 1 * 28 * 32,  4 * 28 * 32, 2 * 28 * 32 };

	fir = (char *)malloc((size_t)sizef[type]);
	mid = (char *)malloc((size_t)sizem[type]);
	las = (char *)malloc((size_t)sizel[type]);
}

void     hgSetEngFontRoom(int type)
{
	int   size[1] = { 256 * 16 };

	eng = (char *)malloc((size_t)size[type]);
}

void     hgSetSpecialFontRoom(int type)
{
	int   size = 128 * 32;

	type &= 0xaa;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	spe = (char *)malloc((size_t)size);
}

void     hgFreeHanRoom()
{
	free(fir);
	free(mid);
	free(las);

	fir = mid = las = NULL;
}

void     hgFreeEngRoom()
{
	free(eng);

	eng = NULL;
}

void     hgFreeSpecialRoom()
{
	free(spe);

	spe = NULL;
}

void     hgSetHanFont(char *fname, int type)
{
	int   sizef[4] = { 8 * 20 * 32, 6 * 20 * 32, 10 * 20 * 32, 2 * 20 * 32 };
	int   sizem[4] = { 4 * 22 * 32, 2 * 22 * 32,  4 * 22 * 32, 1 * 22 * 32 };
	int   sizel[4] = { 4 * 28 * 32, 1 * 28 * 32,  4 * 28 * 32, 2 * 28 * 32 };
	int   handle;

	handle = open(fname, O_RDWR | O_BINARY);
	if (handle == -1) return;

	htypes.firs = sizef[type];
	htypes.mids = sizem[type];
	htypes.lass = sizel[type];

	hgFreeHanRoom();
	hgSetHanFontRoom(type);

	read(handle, fir, sizef[type]);
	read(handle, mid, sizem[type]);
	read(handle, las, sizel[type]);

	close(handle);

	hgSetCtable(type);
}

void     hgSetEngFont(char *fname, int type)
{
	int   size[1] = { 256 * 16 };
	int   handle;

	handle = open(fname, O_RDWR|O_BINARY);
	if (handle == -1) return;

	etypes.engs = size[type];

	hgFreeEngRoom();
	hgSetEngFontRoom(type);

	read(handle, eng, size[type]);
	close(handle);
}

void     hgSetSpecialFont(char *fname, int type)
{
	int   size = 128 * 32;
	int   handle;

	type &= 0xaa;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	handle = open(fname, O_RDWR|O_BINARY);
	if (handle == -1) return;

	hgFreeSpecialRoom();
	hgSetSpecialFontRoom(type);

	read(handle, spe, size);
	close(handle);
}

ExtFont *hgOpenExtFont(char *fname, int x, int y, int qsize)
{
	ExtFont *p;
	FILE    *fpt;

	int    i;
	unsigned  size;
	long   fsize;

	fpt = fopen(fname, "rb");
	if (fpt == NULL) {
		fclose(fpt);
		return(NULL);
	}

	fseek(fpt, 0, SEEK_END);
	fsize = ftell(fpt);
	fseek(fpt, 0, SEEK_SET);

	fsize = fsize / (long)x;
	fsize = fsize / (long)y;

	p = (ExtFont *)malloc(sizeof(ExtFont));
	p->fpt = fpt;
	p->qsize = qsize;
	p->xsize = x;
	p->ysize = y;
	p->qh = p->qt = 0;		/* queue is empty */
	p->fnum = fsize;

	size = x * y;

	for (i = 0;i < qsize;i++)
		p->p[i] = (char *)malloc((size_t)size);

	p->buff = p->p[0];

	return(p);
}

void     hgGetExtFont(ExtFont *p, int n)
{
	char  *temp;
	int   pos = p->qh;
	int   flag = hgFAIL;
	int   m;
	long  offset = 0L;		/* file pointer offset */

	do {
		if (p->qh == p->qt) break;
		pos++;
		if (pos >= p->qsize) pos = 0;
		if (p->n[pos] == n) {
			flag = hgSUCCESS;
			break;
		}
	} while (pos != p->qt);

	if (flag) {
		p->buff = p->p[pos];
		return;
	}

	m = p->qt + 1;
	if (m >= p->qsize) m = 0;

	if (m == p->qh) {
		p->qh++;
		if (p->qh >= p->qsize) p->qh = 0;
	}
	p->qt++;
	if (p->qt >= p->qsize) p->qt = 0;

	offset = (long)n * (long)p->xsize * (long)p->ysize;
	fseek(p->fpt, offset, 0);

	fread(p->p[p->qt], (size_t)(p->xsize * p->ysize), 1, p->fpt);
	p->buff = p->p[p->qt];
	p->n[p->qt] = n;
}

void     hgPutExtFont(ExtFont *p, int x, int y, int num)
{
	char  *mbuff;			/* magnified character buffer */
	char  *nbuff;			/* magnified character buffer */
	char  *buff;			/* real external font buffer */

	int    bytes = p->xsize * p->ysize;
	int    i;
	int    fac = 1;

	for (i = 1;i < hgXFAC;i++)
		fac *= 2;

	mbuff = (char *)malloc((size_t)bytes * fac);
	nbuff = (char *)malloc((size_t)bytes * fac * hgYFAC);
	buff = (char *)malloc((size_t)bytes);

	hgGetExtFont(p, num);
	memcpy(buff, p->buff, bytes);
	attribute_process(buff, -bytes);

	if (hgXFAC != 1) widen(buff, mbuff, bytes);
	else memcpy(mbuff, buff, bytes);
	if (hgYFAC != 1) lengthen(mbuff, nbuff, p->xsize * fac, p->ysize);
	else  memcpy(nbuff, mbuff, bytes * fac);

	putmag(x, y, nbuff, p->xsize * fac, p->ysize * hgYFAC, hgGetTFcolor());

	free(mbuff);
	free(nbuff);
	free(buff);
}

void     hgCloseExtFont(ExtFont *p)
{
	int   i;

	for (i = 0;i < p->qsize;i++)
		free(p->p[i]);
	fclose(p->fpt);
	free(p);
}

int      hgGetExtFontNum(ExtFont *p)
{
	return(p->fnum);
}

int      hgGetExtFontXsize(ExtFont *p)
{
	return(p->xsize);
}

int      hgGetExtFontYsize(ExtFont *p)
{
	return(p->ysize);
}

void     hanja_null_function(char *str, int pos)
{
	hangulout_process(str, pos);
}

void     pos_null_function(char *str, int *pos)
{
	englishout_process(str, *pos);
	(*pos)++;
}

int      isspecial(char *str, int pos)
{
	if ((byte)str[pos] == SPECIAL_CODE && (byte)str[pos + 1] >= 0x80)
		return(hgSUCCESS);
	else return(hgFAIL);
}

void     hgOutTextXy(int x, int y, char *str)
{
	int   pos = 0;

	_xpos = x;
	_ypos = y;

	while (str[pos] != 0) {
		if (str[pos] == '/') textattr_process(str, &pos);
		else if (str[pos] == '\t') {
			_xpos = _xpos + (8 - (_xpos / 8) % 8) * 8;
			pos++;
		}
		else if (!(str[pos] & 0x80)) {
			englishout_process(str, pos);
			pos++;
		}
		else if (specialenable && isspecial(str, pos)) {
			specialout_process(str, pos);
			pos += 2;
		}
		else if (graphokflag && isgraphic(str, pos)) {
			graphout_process(str, pos);
			pos += 2;
		}
		else if (hanjaokflag && ishanja(str, pos)) {
			hanjaout_process(str, pos);
			pos += 2;
		}
		else {
			hangulout_process(str, pos);
			pos += 2;
		}
	}
}

void     attribute_process(char *dest, int bytes)
{
	char   attr;

	if (bytes == 16) attr = hgGetEAttr();
	else if (bytes == 32) attr = hgGetHAttr();
	else if (bytes < 0) {
		attr = hgGetExtAttr();
		bytes = -bytes;
	}

	if (attr == NORMAL)  return;

	if (attr & REVERSE) hgDoAttr(dest, bytes, 0);
	if (attr & DIM)     hgDoAttr(dest, bytes, 1);
	if (attr & SHADOW)  hgDoAttr(dest, bytes, 2);
	if (attr & THREED)  hgDoAttr(dest, bytes, 3);
	if (attr & OUTLINE) hgDoAttr(dest, bytes, 4);
	if (attr & BOLD)    hgDoAttr(dest, bytes, 5);
	if (attr & UNDER)   hgDoAttr(dest, bytes, 6);
}

void     englishout_process(char *str, int pos)
{
	char   ebuff[16];

	engflag = hgTRUE;
	memcpy(ebuff, eng + ((byte)str[pos]) * 16, 16);
	attribute_process(ebuff, 16);
	puteng(_xpos, _ypos, ebuff, hgGetTFcolor());
	_xpos += 8;
}

void     specialout_process(char *str, int pos)
{
	char   sbuff[32];

	memcpy(sbuff, spe + ((byte)str[pos + 1] - 128) * 32, 32);
	attribute_process(sbuff, 32);
	puthan(_xpos, _ypos, sbuff, hgGetTFcolor());
	_xpos += 16;
}

void     hanjaout_process(char *str, int pos)
{
	(*hjps)(str, pos);
}

void     graphout_process(char *str, int pos)
{
	(*grps)(str, pos);
}

void     textattr_process(char *str, int *pos)
{
	(*atps)(str, pos);
}

void     hangulout_process(char *str, int pos)
{
	char   hbuff[32];
	int    fcode, mcode, lcode;
	int    f1 = 0, f2 = 0, f3 = 0;
	int    hflag;

	han.b.fchar = str[pos];
	han.b.schar = str[pos + 1];

	fcode  = CodeTable[0][han.c.firc];
	mcode  = CodeTable[1][han.c.midc];
	lcode  = CodeTable[2][han.c.lasc];

	f3 = RefJong[mcode];
	f2 = RefJung[fcode * 2 + (lcode != 0)];
	f1 = RefCho[mcode * 2 + (lcode != 0)];

	hflag = 1;
	engflag = hgFALSE;

	if (fcode) {
		complete_hangul(1, hbuff, fir + (f1 * 20 + fcode) * 32, 16);
		hflag = 0;
	}
	if (mcode) {
		complete_hangul(hflag, hbuff, mid + (f2 * 22 + mcode) * 32, 16);
		hflag = 0;
	}
	if (lcode) {
		complete_hangul(hflag, hbuff, las + (f3 * 28 + lcode) * 32, 16);
		hflag = 0;
	}
	attribute_process(hbuff, 32);
	puthan(_xpos, _ypos, hbuff, hgGetTFcolor());
	_xpos += 16;
}

void     complete_hangul(char mode, char *dest, char *src, char nums)
{
		asm  push ds

		asm  mov  cl, BYTE PTR nums
		asm  xor  ch, ch	/* cx = ¤e¥¢ÒU® */
		asm  lds  si, src
		asm  les  di, dest

		asm  cmp  BYTE PTR mode, 1
		asm  jnz  orloop
		asm  cld
		asm  REP  movsw

		asm  pop  ds

	return;

orloop:		asm  lodsw
		asm  or   es:[di], ax
		asm  inc  di
		asm  inc  di
		asm  loop orloop

		asm  pop  ds
}

void     hgOutText(char *str)
{
	hgOutTextXy(_xpos, _ypos, str);
}

void     hgPrintfXy(int x, int y, char *fmt, ...)
{
	va_list  argptr;
	char  str[255];

	va_start(argptr, fmt);
	vsprintf(str, fmt, argptr);

	hgOutTextXy(x, y, str);
}

void     hgPrintf(char *fmt, ...)
{
	hgPrintfXy(_xpos, _ypos, fmt);
}

void     hgGotoXy(int x, int y)
{
	_xpos = x;
	_ypos = y;
}

int      hgGetOutX()
{
	return(_xpos);
}

int      hgGetOutY()
{
	return(_ypos);
}

void     hgEngOutTextXy(int x, int y, char *str)
{
	int   i;
	int   xs, ys;

	xs = _xpos;
	ys = _ypos;

	hgGotoXy(x, y);

	for (i = 0;i < strlen(str);i++)
		englishout_process(str, i);

	hgGotoXy(xs, ys);
}

void     hgEngPutch(int x, int y, char num)
{
	char   str[3];
	int    i;
	int    xs, ys;

	xs = _xpos;
	ys = _ypos;

	hgGotoXy(x, y);

	str[0] = num;
	str[1] = 0;
	englishout_process(str, 0);

	hgGotoXy(xs, ys);
}

void     hgEngPrintfXy(int x, int y, char *fmt,...)
{
	va_list  argptr;
	char   str[255];

	va_start(argptr, fmt);
	vsprintf(str, fmt, argptr);

	hgEngOutTextXy(x, y, str);
}

void     hgOverTextXy(int x, int y, char *str)
{
	char   temp[3];
	int    i;
	int    back;

	back = hgGetTBcolor();

	for (i = 0;i < strlen(str);) {
		if (str[i] & 0x80) {
			temp[0] = str[i];
			temp[1] = str[i + 1];
			temp[2] = 0;
			hgBoxFill(x + i * 8, y, x + i * 8 + 15, y + 15, back);
			hgOutTextXy(x + i * 8, y, temp);
			i += 2;
		}
		else if (str[i] == '\n') {
			x = 0;
			y += 16;
			i++;
		}
		else if (str[i] == '\t') {
			x += (8 - (x / 8) % 8) * 8;
			i++;
		}
		else {
			temp[0] = str[i];
			temp[1] = 0;
			hgBoxFill(x + i * 8, y, x + i * 8 + 7, y + 15, back);
			hgOutTextXy(x + i * 8, y, temp);
			i++;
		}
	}
}

void     hgFBTextXy(int x, int y, char *str, int fore, int back)
{
	int   fsav = hgGetTFcolor();
	int   bsav = hgGetTBcolor();

	hgSetTFcolor(fore);
	hgSetTBcolor(back);

	hgOverTextXy(x, y, str);

	hgSetTFcolor(fsav);
	hgSetTBcolor(bsav);
}

void     hgForeTextXy(int x, int y, char *str, int fore)
{
	int   fsav = hgGetTFcolor();

	hgSetTFcolor(fore);
	hgOutTextXy(x, y, str);
	hgSetTFcolor(fsav);
}

void     hgBackTextXy(int x, int y, char *str, int back)
{
	int   bsav = hgGetTBcolor();

	hgSetTBcolor(back);
	hgOverTextXy(x, y, str);
	hgSetTBcolor(bsav);
}

void     hgSetSpecialCharOn()
{
	specialenable = hgTRUE;
}

void     hgSetSpecialCharOff()
{
	specialenable = hgFALSE;
}

void     hgSpecTextXy(int x, int y, char *str, int color1, int color2, int deep)
{
	hgForeTextXy(x + deep, y + deep, str, color2);
	hgForeTextXy(x, y, str, color1);
}

void     hgTextAttrInit()
{
	atps = &textattr_real_out;
	textattrflag = hgTRUE;
}

void     textattr_real_out(char *str, int *pos)
{
	char   *color[16] = {
		"ZERO", "BLUE", "GREEN", "CYAN", "RED", "MAGENTA", "BROWN", "LIGHTGRAY",
		"DARKGRAY", "LIGHTBLUE", "LIGHTGREEN", "LIGHTCYAN", "LIGHTRED", "LIGHTMAGENTA",	"YELLOW", "WHITE"
	};
	char   *attr[8] = {
		"NORMAL", "REVERSE", "DIM", "SHADOW", "THREED", "OUTLINE", "UNDER", "BOLD"
	};

	char   cmd[15];
	char   opr;
	int    afac = 1;
	int    i;
	int    save;

	if (!textattrflag) {
		englishout_process(str, *pos);
		(*pos)++;
		return;
	}

	if (str[*pos + 1] == 0) {
		(*pos)++;
		return;
	}

	if (str[*pos + 1] == '/') {
		englishout_process(str, *pos);
		(*pos) += 2;
		return;
	}

	for (i = *pos + 2;i < strlen(str);i++) {
		if (str[i] != '/') cmd[i - *pos - 2] = str[i];
		else break;
		if ((i - *pos - 2) >= 14) break;
	}
	opr = str[*pos + 1];
	cmd[i - *pos - 2] = 0;

	if (str[i] == '/')  save = i + 1;
	else {
		englishout_process(str, *pos);
		(*pos)++;
		return;
	}

	switch (opr) {
		case 'c' :
		case 'C' :
			for (i = 0;i < 16;i++)
				if (!strcmp(color[i], cmd)) break;
			if (i == 16) {
				englishout_process(str, *pos);
				(*pos)++;
				return;
			}

			if (hgIsHerc()) hgSetTFcolor(ZERO);
			else hgSetTFcolor(i);
			break;
		case 'a' :
		case 'A' :
			for (i = 0;i < 8;i++) {
				if (!strcmp(attr[i], cmd)) break;
				afac *= 2;
			}
			if (i == 8) {
				englishout_process(str, *pos);
				(*pos)++;
				return;
			}

			hgSetHAttr(NORMAL);
			hgSetEAttr(NORMAL);
			hgSetHAttr(afac);
			hgSetEAttr(afac);
			break;
		case 's' :
		case 'S' :
			hgSetXFactor(cmd[0] - '0');
			hgSetYFactor(cmd[1] - '0');
			break;
		default  :
			englishout_process(str, *pos);
			(*pos)++;
			return;
	}
	*pos = save;
}

void     hgSetTextAttrOn()
{
	textattrflag = hgTRUE;
}

void     hgSetTextAttrOff()
{
	textattrflag = hgFALSE;
}

void     widen_sub(char *s1, char *s2, int bytes)
{
		asm  push ds

		asm  lds  si, s1	/* ds:si = ¢…¸a ‹i©1· º­¡ */
		asm  les  di, s2	/* es:di = ¢…¸a ‹i©2· º­¡ */
		asm  mov  cx, bytes	/* cx = ¤e¥¢ÒU® */

wloop:		asm  xor  ax, ax
		asm  mov  dl, ds:[si]
		asm  push cx
		asm  mov  cx, 8
wloop1:		asm  shl  ax, 1
		asm  xor  bl, bl
		asm  shl  dl, 1
		asm  adc  bl, 0
		asm  add  al, bl
		asm  shl  ax, 1
		asm  add  al, bl
		asm  loop wloop1
		asm  mov  es:[di], ah
		asm  inc  di
		asm  mov  es:[di], al
		asm  inc  di
		asm  inc  si
		asm  pop  cx
		asm  loop wloop

		asm  pop  ds
}

void     widen(char *s1, char *s2, int bytes)
{
	char   *temp;
	int    i, j;
	int    mul;
	unsigned  size;

	temp = (char *)malloc((size_t)(1 << (hgXFAC - 1)) * bytes);
	memcpy(temp, s1, bytes);

	for (i = 1;i < hgXFAC;i++) {
		mul = bytes * (1 << (i - 1));
		widen_sub(temp, s2, mul);
		if (i == (hgXFAC - 1)) break;
		memcpy(temp, s2, mul << 1);
	}
	free(temp);
}

void     lengthen(char *s1, char *s2, int xbytes, int yscan)
{
	int   count = hgYFAC;

		asm  push ds

		asm  lds  si, s1	/* ds:si = ¢…¸a ‹i©1· º­¡ */
		asm  les  di, s2	/* es:di = ¢…¸a ‹i©2· º­¡ */
		asm  mov  cx, yscan	/* cx = ¤e¥¢ÒU® */

lloop:		asm  push cx
		asm  mov  cx, WORD PTR count
		asm  mov  bx, si
lloop1:		asm  push cx
		asm  mov  cx, WORD PTR xbytes
		asm  REP  movsb
		asm  mov  si, bx
		asm  pop  cx
		asm  loop lloop1
		asm  add  si, WORD PTR xbytes
		asm  pop  cx
		asm  loop lloop

		asm  pop  ds
}

void     putmn(int x, int y, char *buff, char color)
{
	char   *mbuff;
	char   *nbuff;			/* ÑÂ” ¢…¸a ‹i©¶w ·¡£¡»¡ ¤áÌá */

	int    i;
	int    xx;
	int    fac = 1;
	int    eh = 1;			/* µw¢… ÑÂ” ¢…¸a */

	if (!engflag) eh = 2;		/* Ðe‹i ÑÂ” ¢…¸a */

	for (i = 1;i < hgXFAC;i++)
		fac *= 2;
	if (!engflag) fac *= 2;

	mbuff = (char *)malloc((size_t)16 * fac);
	nbuff = (char *)malloc((size_t)16 * fac * hgYFAC);

	if (hgXFAC != 1) widen(buff, mbuff, 16 * eh);
	else memcpy(mbuff, buff, 16 * eh);
	if (hgYFAC != 1) lengthen(mbuff, nbuff, fac, 16);
	else memcpy(nbuff, mbuff, 16 * fac);

	putmag(x, y, nbuff, fac, hgYFAC << 4, color);

	xx = _xpos;
	xx -= ((engflag) ? 8 : 16);
	xx += fac * 8;
	_xpos = xx;

	free(mbuff);
	free(nbuff);
}

void     puthalf(int x, int y, char *buff, char color)
{
	char   *mbuff;
	char   *nbuff;			/* ÑÂ” ¢…¸a ‹i©¶w ·¡£¡»¡ ¤áÌá */

	int    xx;
	int    fac = 2;
	int    eh = 1;			/* µw¢… ÑÂ” ¢…¸a */
	int    xfac, yfac;

	if (!engflag) eh = 2;		/* Ðe‹i ÑÂ” ¢…¸a */
	if (!engflag) fac *= 2;

	mbuff = (char *)malloc((size_t)16 * fac);
	nbuff = (char *)malloc((size_t)16 * fac * 2);

	xfac = hgXFAC;
	yfac = hgYFAC;
	hgXFAC = 2;
	hgYFAC = 2;
	widen(buff, mbuff, 16 * eh);
	lengthen(mbuff, nbuff, fac, 16);
	hgXFAC = xfac;
	hgYFAC = yfac;

	if (hgWMODE == UPHALF) putmag(x, y, nbuff, fac, 16, color);
	else putmag(x, y, nbuff + 16 * fac, fac, 16, color);

	xx = _xpos;
	xx -= ((engflag) ? 8 : 16);
	xx += fac * 8;
	_xpos = xx;

	free(mbuff);
	free(nbuff);
}

void     hgSetXFactor(int n)
{
	if (n > 3) return;

	hgXFAC = n;

	if ((hgXFAC + hgYFAC) > 2) {
		puth = &putmn;
		pute = &putmn;
	}
	else {
		puth = magh;
		pute = mage;
	}
}

void     hgSetYFactor(int n)
{
	if (n > 4) return;

	hgYFAC = n;

	if ((hgXFAC + hgYFAC) > 2) {
		puth = &putmn;
		pute = &putmn;
	}
	else {
		puth = magh;
		pute = mage;
	}
}

int      hgGetXFactor()
{
	return(hgXFAC);
}

int      hgGetYFactor()
{
	return(hgYFAC);
}

void     hgSetWriteMode(char mode)
{
	if (mode > 2) return;

	hgWMODE = mode;

	if (hgWMODE) {
		puth = &puthalf;
		pute = &puthalf;
	}
	else {
		puth = magh;
		pute = mage;
	}
}

char     hgGetWriteMode()
{
	return(hgWMODE);
}
