/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : mouse.c  --  a¶¯a ¡¡—I                       |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <dos.h>
#include    <mem.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "mouse.h"			/*  a¶¯aµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     mouse_ok = hgFAIL;
char     mouse_enable = hgFAIL;		/*  a¶¯a ¬a¶w ˆa“w µa¦ */
int      mstype;

extern   int      L_Pressed, R_Pressed, C_Pressed;
extern   int      L_Released, R_Released, C_Released;
extern   int      hgx1r, hgx2r, hgy1r, hgy2r;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgSetHMouseInit();
void     hgSetVMouseInit();
void     hgSetMouseInit();
void     hgSetMouseEnd();

void     hgSetMouse();
char     hgIfMouse();
char     hgGetMouse();
void     hgShowMouse();
void     hgHideMouse();
int      hgLeftMouse();
int      hgRightMouse();
int      hgMiddleMouse();
int      hgLeftMouseReleased();
int      hgRightMouseReleased();
int      hgMiddleMouseReleased();
void     hgGetMousePos(int *x, int *y);
void     hgMoveMouse(int x, int y);

void     hgSetMouseType(int type);
int      hgGetMouseType();

void     hgSetMouseCursor(void (*p)());
void     arrow();
void     arrow2();
void     bubble();
void     cross();
void     not();
void     question();
void     timer();

int      get_mpos(int x, int y, int xw, int yw, int num);
int      get_xwpos(int x[], int y, int xw[], int yw, int num);


void     hgSetHMouseInit()
{
	int   flag;

	flag = initMouse(MOU_HGC640);
	if (flag) hgSetMouse();

	mouse_enable = hgSUCCESS;
	mstype = 0;
	hgMoveMouse((hgx1r + hgx2r) / 2, (hgy1r + hgy2r) / 2);
	hgShowMouse();
}

void     hgSetVMouseInit()
{
	int   flag;

	flag = initMouse(MOU_EGAVGA);
	if (flag) hgSetMouse();

	mouse_enable = hgSUCCESS;
	mstype = 0;
	hgMoveMouse((hgx1r + hgx2r) / 2, (hgy1r + hgy2r) / 2);
	hgShowMouse();
}

void     hgSetMouseInit()
{
	if (hgIsHerc()) hgSetHMouseInit();
	else hgSetVMouseInit();
}

void     hgSetMouseEnd()
{
	if (hgIfMouse()) {
		hideMouse();
		closeMouse();
	}
}

void     hgSetMouse()
{
	mouse_ok = hgSUCCESS;
}

char     hgIfMouse()
{
	return(mouse_ok);
}

char     hgGetMouse()
{
	if (mouse_ok && mouse_enable) return(hgSUCCESS);
	else return(hgFAIL);
}

void     hgShowMouse()
{
	if (!hgGetMouse()) return;
	showMouse();
}

void     hgHideMouse()
{
	if (!hgGetMouse()) return;
	hideMouse();
}

int      hgLeftMouse()
{
	if (!hgGetMouse()) return(hgFAIL);
	return(L_Pressed);
}

int      hgRightMouse()
{
	if (!hgGetMouse()) return(hgFAIL);
	return(R_Pressed);
}

int      hgMiddleMouse()
{
	if (!hgGetMouse()) return(hgFAIL);
	return(C_Pressed);
}

int      hgLeftMouseReleased()
{
	if (!hgGetMouse()) return(hgFAIL);
	return(L_Released);
}

int      hgRightMouseReleased()
{
	if (!hgGetMouse()) return(hgFAIL);
	return(R_Released);
}

int      hgMiddleMouseReleased()
{
	if (!hgGetMouse()) return(hgFAIL);
	return(C_Released);
}

void     hgGetMousePos(int *x, int *y)
{
	*x = Mou_X;
	*y = Mou_Y;
}

void     hgMoveMouse(int x, int y)
{
	moveMouse(x, y);
}

void     hgSetMouseType(int type)
{
	mstype = type;
	switch (mstype) {
		case 0 :
			hgSetMouseCursor(DEFAULT);
			break;
		case 1 :
			hgSetMouseCursor(CROSS);
			break;
		case 2 :
			hgSetMouseCursor(QUESTION);
			break;
		case 3 :
			hgSetMouseCursor(NOT);
			break;
		case 4 :
			hgSetMouseCursor(TIMER);
			break;
		case 5 :
			hgSetMouseCursor(BUBBLE);
			break;
		case 6 :
			hgSetMouseCursor(ARROW2);
			break;
	}
}

int      hgGetMouseType()
{
	return(mstype);
}

void     hgSetMouseCursor(void (*p)())
{
	(*p)();
}

/*
void     arrow()
{
	GraphCursor  *p;

	char   s1[] = {
		255,  31, 255,  15, 255,   7, 255,   3, 255,   1, 255,   0, 127,   0,  63,   0,
		 31,   0,  63,   0, 255,   0, 255,   0, 127, 224, 127, 240, 127, 248, 127, 248
	};
	char   s2[] = {
		  0,   0,   0,  64,   0,  96,   0, 112,   0, 120,   0, 124,   0, 126,   0, 127,
		128, 127,   0, 124,   0,  76,   0,   6,   0,   6,   0,   3,   0,   3,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 0;
	p->spotY = 0;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}
*/

void     arrow2()
{
	GraphCursor  *p;

	char   s1[] = {
		255, 255, 255, 231, 255, 227, 255, 225, 255, 224, 127, 224,  63, 224,  31, 224,
		 15, 224,   7, 224,   7, 224,  31, 252,  31, 254,  15, 255,  15, 255, 255, 255
	};
	char   s2[] = {
		  0,   0,   0,   0,   0,   8,   0,  12,   0,  14,   0,  15, 128,  15, 192,  15,
		224,  15, 240,  15, 128,   1, 192,   0,  64,   0,  96,   0,   0,   0,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 8;
	p->spotY = 8;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}

void     bubble()
{
	GraphCursor  *p;

	char   s1[] = {
		255, 255, 255, 254, 127, 252,  63, 252,  31, 248,  15, 240,   7, 224,   7, 224,
		  3, 192,   3, 192,   3, 192,   7, 224,  15, 240,  31, 248,  63, 254, 255, 255
	};
	char   s2[] = {
		  0,   0,   0,   0,   0,   1, 128,   1, 192,   3, 224,   7, 176,  15, 208,  15,
		216,  31, 248,  31, 216,  31, 240,  15, 224,   7, 192,   1,   0,   0,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 8;
	p->spotY = 8;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}

void     cross()
{
	GraphCursor  *p;

	char   s1[] = {
		 63, 248,  63, 248,  63, 248,  63, 248,  63, 248,   1,   0,   1,   0,   1,   0,
		  1,   0,   1,   0,  63, 248,  63, 248,  63, 248,  63, 248,  63, 248, 255, 255
	};
	char   s2[] = {
		  0,   0, 128,   3, 128,   3, 128,   3, 128,   3, 128,   3, 252, 127, 252, 127,
		252, 127, 128,   3, 128,   3, 128,   3, 128,   3, 128,   3,   0,   0,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 8;
	p->spotY = 8;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}

void     not()
{
	GraphCursor  *p;

	char   s1[] = {
		255, 255,   1, 128,   1, 128,   1, 128,   1, 128,   1, 128,   1, 128,   1, 128,
		  1, 128,   1, 128,   1, 128,   1, 128,   1, 128,   1, 128,   1, 128, 255, 255
	};
	char   s2[] = {
		  0,   0,   0,   0, 248,  31, 244,  47, 236,  55, 220,  59, 188,  61, 124,  62,
		124,  62, 188,  61, 220,  59, 236,  55, 244,  47, 248,  31,   0,   0,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 8;
	p->spotY = 8;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}

void     question()
{
	GraphCursor  *p;

	char   s1[] = {
		255, 255,  31, 252,  15, 248,   7, 240, 199, 241, 199, 241,  15, 254,  31, 254,
		 63, 254,  63, 254, 255, 255,  63, 254,  63, 254,  63, 254, 255, 255, 255, 255
	};
	char   s2[] = {
		  0,   0, 224,   3,  16,   4, 232,  11,  40,  10,  40,  14, 208,   1,  32,   1,
		 64,   1, 192,   1,   0,   0, 192,   1,  64,   1, 192,   1,   0,   0,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 8;
	p->spotY=8;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}

void     timer()
{
	GraphCursor  *p;

	char   s1[] = {
		255, 255,   3, 128,   3, 128,   3, 128,   3, 128,   3, 128,   3, 128,   3, 128,
		  3, 128,   3, 128,   3, 128,   3, 128,   3, 128,   3, 128, 255, 255, 255, 255
	};
	char   s2[] = {
		  0,   0,   0,   0, 248,  62, 248,  63, 248,  62, 248,  62, 248,  62, 240,  30,
		120,  63, 184,  63, 216,  63, 248,  63, 248,  62,   0,   0,   0,   0,   0,   0
	};
	int    x, y;

	p = (GraphCursor *)malloc(sizeof(GraphCursor));

	p->spotX = 8;
	p->spotY = 8;
	memcpy(p->screenMask, s1, 32);
	memcpy(p->cursorMask, s2, 32);

	hgGetMousePos(&x, &y);
	hgHideMouse();
	setMouseCursor(p);
	hgMoveMouse(x, y);
	hgShowMouse();

	free(p);
}

int      get_mpos(int x, int y, int xw, int yw, int num)
{
	int   i;
	int   xx, yy;

	hgGetMousePos(&xx, &yy);

	for (i = 0;i < num;i++) {
		if ((xx > x && xx < (x + xw)) && (yy > y && yy < (y + yw)))
			return(i);
		y += yw;
	}
	return(-1);
}

int      get_xwpos(int x[], int y, int xw[], int yw, int num)
{
	int   i;
	int   xx, yy;

	hgGetMousePos(&xx, &yy);

	for (i = 0;i < num;i++)
		if ((xx > x[i] && xx < (x[i] + xw[i])) && (yy > y && yy < (y + yw)))
			return(i);
	return(-1);
}
