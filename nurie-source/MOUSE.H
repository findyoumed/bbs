/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : mouse.h --  a¶¯aµA ”Ðe ÑA”á                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __MOUSE_H
#define     __MOUSE_H

#ifndef     __DOS_H
#include    <dos.h>
#endif

#ifndef     __TIME_H
#include    <time.h>
#endif

#ifndef     __ALLOC_H
#include    <alloc.h>
#endif


typedef  unsigned char   BYTE;
typedef  unsigned int    WORD;
typedef  unsigned long   DWORD;
typedef  int             BOOL;

typedef  void far (*EVENT_HAND_FUNC)(int x, int y, int event, int button);

typedef  struct {			/*  a¶¯a Èa·¡Ïa */
	int     major;
	int     minor;
	int     type;
	char   *typeName;
	int     IRQ;
} MouseType;

typedef  struct {
	WORD    screenMask[16];
	WORD    cursorMask[16];
	WORD    spotX;
	WORD    spotY;
} GraphCursor;

#define     TRUE        1
#define     FALSE       0

#define     MOU_HGC640  1		/*  a¶¯a· ¹·ŸA */
#define     MOU_HGC720  2
#define     MOU_EGAVGA  3

#define     L_BUTTON    0x00
#define     R_BUTTON    0x01
#define     C_BUTTON    0x02

#define     L_ACTIVE    0x01		/* ¤áËe ¬wÈ· ˆt */
#define     R_ACTIVE    0x02
#define     C_ACTIVE    0x04

#define     M_MOVE      0x01		/* ·¡¥EËa  a¯aÇa */
#define     L_PRESS     0x02
#define     L_RELEA     0x04
#define     R_PRESS     0x08
#define     R_RELEA     0x10
#define     C_PRESS     0x20
#define     C_RELEA     0x40
#define     ALL_NORM_EVENT  0x7F

#define     SHFT_PRESS  0x20		/* ¥¡¹¡ ·¡¥EËa  a¯aÇa */
#define     CTRL_PRESS  0x40
#define     ALT_PRESS   0x80
#define     ALL_ALT_EVENT   0xFF


extern   int   Mou_X;			/*  a¶¯a Äá¬á ¹ÁÎa */
extern   int   Mou_Y;

extern   int   ButStatus;		/* ¤áËe ¬wÈ - Bit1: Left, Bit2: Right —w */
extern   int   ButNumber;		/*  a¶¯a —aœa·¡¤áˆa ¬a¶wÐa“e ¤áËe ® */

extern   GraphCursor  ARROW;

#ifdef      __cplusplus
extern      "C" {
#endif


BOOL     initMouse(int cardtype);
void     closeMouse();
BOOL     resetMouse();
void     showMouse();
void     hideMouse();
void     moveMouse(int newX, int newY);
void     saveMouse();
void     restoreMouse();
WORD     buttonStatus();
BOOL     isPressed(int Button);
BOOL     isReleased(int Button);
void     setMouseRange(int minX, int minY, int maxX, int maxY);
void     setMouseCursor(GraphCursor *newCursor);
void     setMousePage(int videoPage);
int      getMousePage();
MouseType *getMouseType();
BOOL     isDoubleClick();
void     setDoubleClick(int rate_1_4);
BOOL     isDraging();

			/* event handler function */
void     setEventHandler(EVENT_HAND_FUNC, WORD eventMask);
BOOL     setAltEvHandler(EVENT_HAND_FUNC, WORD eventMask);
void     resetEvHandler();
void     resetAltHandler();


#ifdef      __cplusplus
}
#endif

#endif
