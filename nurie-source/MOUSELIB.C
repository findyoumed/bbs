/*-------------------------------------------------------------------|
 |                                                                   |
 |       filename    : mouselib.c  --  a¶¯a œa·¡§aœáŸ¡              |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <dos.h>

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MOU_HGC640   1              /* For "initMouse" */
#define     MOU_HGC720   2
#define     MOU_EGAVGA   3

#define     L_BUTTON     0x00           /* argments of "isPressed, isReleased" */
#define     R_BUTTON     0x01
#define     C_BUTTON     0x02

#define     L_ACTIVE     0x0001         /* Values of 'ButStatus' variable */
#define     R_ACTIVE     0x0002
#define     C_ACTIVE     0x0004

#define     M_MOVE       0x01           /* Event masks */
#define     L_PRESS      0x02
#define     L_RELEASE    0x04
#define     R_PRESS      0x08
#define     R_RELEASE    0x10
#define     C_PRESS      0x20
#define     C_RELEASE    0x40
#define     ALL_NORM_EVENT  0x7F

#define     SHFT_PRESS   0x20           /* Alternate event mask */
#define     CTRL_PRESS   0x40
#define     ALT_PRESS    0x80
#define     ALL_ALT_EVENT   0xFF

#define     VIDEO_SEG    0xB000

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

typedef  struct {
	char   screenMask[32];
	char   cursorMask[32];
	int    spotX;
	int    spotY;
} GraphCursor;

GraphCursor *cur;

typedef struct {
	int    buttonState;
	int    curX;
	int    curY;
	int    horMic;
	int    verMic;
} MouseInfo;

MouseInfo msInfo;

char     oldImage[32];
char     cursorImage[32];

int      mstype;
int      oldx, oldy, msX, msY;
int      xsrange, xerange, ysrange, yerange;
char     cursorOn = 0;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      msSetInit(int type);
void     msSetClose();
void     cursorinit();
void     msShowCursor();
void     msHideCursor();
void     msGetCursorState(int *button_state, int *x, int *y);
void     msMoveCursor(int x, int y);
int      msGetCursorX();
int      msGetCursorY();
int      msGetButtonState();
int      msLeftPressed();
int      msRightPressed();
int      msMiddlePressed();
int      msLeftReleased();
int      msRightReleased();
int      msMiddleReleased();
void     msGetPressed(int button, int *button_state, int *press_num, int *x, int *y);
void     msGetRelease(int button, int *button_state, int *release_num, int *x, int *y);
void     msSetHRange(int sx, int ex);
void     msSetVRange(int sy, int ey);
void     msSetGraphCursor(GraphCursor *c);
void     msSetTextCursor(int cur_type, int smask, int cmask);
void     msGetRelative(int *x, int *y);
void     msSetEventHandler(int call_mask, void far (*FPhandler)());
void     msSetRatio(int x_ratio, int y_ratio);
void     msSetConseal(int sx, int sy, int ex, int ey);
void     msGetBufSize(int *bufsize);
void     msSaveState(char far *FPbuf);
void     msRestoreState(char far *FPbuf);

void     msGetImageHGC(int x, int y, char *image);
void     msPutImageHGC(int x, int y, char *image);

void     far  msEventHandler();


int      msSetInit(int type)
{
	unsigned char far *FPMDriver;
	union REGS reg;

	FPMDriver = (unsigned char far *)getvect(0x33);
	if (FPMDriver == 0 || *FPMDriver == 0xcf) return(0);
	else {
		reg.x.ax = 0;
		int86(0x33, &reg, &reg);
		if (reg.x.ax) {
			switch (type) {
				case MOU_HGC640 :
					mstype = MOU_HGC640;
					msX = oldx = 320;
					msY = oldy = 200;
					xsrange = 0;
					xerange = 639;
					ysrange = 0;
					yerange = 399;
					msSetHRange(xsrange, xerange);
					msSetVRange(ysrange, yerange);
					break;
				case MOU_HGC720 :
					mstype = MOU_HGC720;
					msX = oldx = 360;
					msY = oldy = 174;
					xsrange = 0;
					xerange = 719;
					ysrange = 0;
					yerange = 347;
					msSetHRange(xsrange, xerange);
					msSetVRange(ysrange, yerange);
					break;
				case MOU_EGAVGA :
					mstype = MOU_EGAVGA;
					break;
			}
			cursorinit();
			msSetEventHandler(ALL_NORM_EVENT, msEventHandler);
			return(1);
		}
		return(0);
	}
}

void     msSetClose()
{
	union REGS reg;

	reg.x.ax = 0;
	int86(0x33, &reg, &reg);
}

void     cursorinit()
{
	char     screenMask[32] = {
		0x1f, 0xff, 0x0f, 0xff, 0x07, 0xff, 0x03, 0xff, 0x01, 0xff, 0x00, 0xff, 0x00, 0x7f, 0x00, 0x3f,
		0x00, 0x1f, 0x00, 0x3f, 0x00, 0xff, 0x00, 0xff, 0xe0, 0x7f, 0xf0, 0x7f, 0xf8, 0x7f, 0xf8, 0x7f
	};
	char     cursorMask[32] = {
		0x00, 0x00, 0x40, 0x00, 0x60, 0x00, 0x70, 0x00, 0x78, 0x00, 0x7c, 0x00, 0x7e, 0x00, 0x7f, 0x00,
		0x7f, 0x80, 0x7c, 0x00, 0x4c, 0x00, 0x06, 0x00, 0x06, 0x00, 0x03, 0x00, 0x03, 0x00, 0x00, 0x00
	};

	memcpy(cur->screenMask, screenMask, 32);
	memcpy(cur->cursorMask, cursorMask, 32);
	cur->spotX = 0;
	cur->spotY = 0;
}

void     msShowCursor()
{
	int   i;
	union REGS reg;

	switch (mstype) {
		case MOU_HGC640 :
		case MOU_HGC720 :
			cursorOn = 1;
			oldx = msX;
			oldy = msY;
			msGetImageHGC(oldx, oldy, oldImage);
			for (i = 0;i < 32;i++)
				cursorImage[i] = oldImage[i] & cur->screenMask[i]
						^ cur->cursorMask[i];
			msPutImageHGC(oldx, oldy, cursorImage);
			break;
		case MOU_EGAVGA :
			reg.x.ax = 1;
			int86(0x33, &reg, &reg);
			break;
	}
}

void     msHideCursor()
{
	union REGS reg;

	switch (mstype) {
		case MOU_HGC640 :
		case MOU_HGC720 :
			cursorOn = 0;
			msPutImageHGC(oldx, oldy, oldImage);
			break;
		case MOU_EGAVGA :
			reg.x.ax = 2;
			int86(0x33, &reg, &reg);
			break;
	}
}

void     msGetCursorState(int *button_state, int *x, int *y)
{
	union REGS reg;

	reg.x.ax = 3;
	int86(0x33, &reg, &reg);
	*button_state = reg.x.bx;
	*x = reg.x.cx;
	*y = reg.x.dx;
}

void     msMoveCursor(int x, int y)
{
	union REGS reg;

	reg.x.ax = 4;
	reg.x.cx = x;
	reg.x.dx = y;
	int86(0x33, &reg, &reg);
}

int      msGetCursorX()
{
	return(msInfo.curX);
}

int      msGetCursorY()
{
	return(msInfo.curY);
}

int      msGetButtonState()
{
	return(msInfo.buttonState);
}

int      msLeftPressed()
{
	return(msInfo.buttonState & L_ACTIVE);
}

int      msRightPressed()
{
	return(msInfo.buttonState & R_ACTIVE);
}

int      msMiddlePressed()
{
	return(msInfo.buttonState & C_ACTIVE);
}

int      msLeftReleased()
{
	return(!(msInfo.buttonState & L_ACTIVE));
}

int      msRightReleased()
{
	return(!(msInfo.buttonState & R_ACTIVE));
}

int      msMiddleReleased()
{
	return(!(msInfo.buttonState & C_ACTIVE));
}

void     msGetPressed(int button, int *button_state, int *press_num, int *x, int *y)
{
	union REGS reg;

	reg.x.ax = 5;
	reg.x.bx = button;
	int86(0x33, &reg, &reg);
	*button_state = reg.x.ax;
	*press_num = reg.x.bx;
	*x = reg.x.cx;
	*y = reg.x.dx;
}

void     msGetReleased(int button, int *button_state, int *release_num, int *x, int *y)
{
	union REGS reg;

	reg.x.ax = 6;
	reg.x.bx = button;
	int86(0x33, &reg, &reg);
	*button_state = reg.x.ax;
	*release_num = reg.x.bx;
	*x = reg.x.cx;
	*y = reg.x.dx;
}

void     msSetHRange(int sx, int ex)
{
	union REGS reg;

	reg.x.ax = 7;
	reg.x.cx = sx;
	reg.x.dx = ex;
	int86(0x33, &reg, &reg);
}

void     msSetVRange(int sy, int ey)
{
	union REGS reg;

	reg.x.ax = 8;
	reg.x.cx = sy;
	reg.x.dx = ey;
	int86(0x33, &reg, &reg);
}

void     msSetGraphCursor(GraphCursor *c)
{
	union  REGS  reg;
	struct SREGS sreg;

	switch (mstype) {
		case MOU_HGC640 :
		case MOU_HGC720 :
			memcpy(cur->screenMask, c->screenMask, 32);
			memcpy(cur->cursorMask, c->cursorMask, 32);
			cur->spotX = c->spotX;
			cur->spotY = c->spotY;
			break;
		case MOU_EGAVGA :
			reg.x.ax = 9;
			reg.x.bx = c->spotX;
			reg.x.cx = c->spotY;
			reg.x.dx = FP_OFF(c->screenMask);
			sreg.es = FP_SEG(c->screenMask);
			int86x(0x33, &reg, &reg, &sreg);
			break;
	}
}

void     msSetTextCursor(int cur_type, int smask, int cmask)
{
	union REGS reg;

	reg.x.ax = 10;
	reg.x.bx = cur_type;
	reg.x.cx = smask;
	reg.x.dx = cmask;
	int86(0x33, &reg, &reg);
}

void     msGetRelative(int *x, int *y)
{
	union REGS reg;

	reg.x.ax = 11;
	int86(0x33, &reg, &reg);
	*x = reg.x.cx;
	*y = reg.x.dx;
}

void     msSetEventHandler(int call_mask, void far (*FPhandler)())
{
	union  REGS  reg;
	struct SREGS sreg;

	reg.x.ax = 12;
	reg.x.cx = call_mask;
	reg.x.dx = FP_OFF(FPhandler);
	sreg.es = FP_SEG(FPhandler);
	int86x(0x33, &reg, &reg, &sreg);
}

void     msSetRatio(int x_ratio, int y_ratio)
{
	union REGS reg;

	reg.x.ax = 15;
	reg.x.cx = x_ratio;
	reg.x.dx = y_ratio;
	int86(0x33, &reg, &reg);
}

void     msSetConseal(int sx, int sy, int ex, int ey)
{
	union REGS reg;

	reg.x.ax = 16;
	reg.x.cx = sx;
	reg.x.dx = sy;
	reg.x.si = ex;
	reg.x.di = ey;
	int86(0x33, &reg, &reg);
}

void     msGetBufSize(int *bufsize)
{
	union REGS reg;

	reg.x.ax = 21;
	int86(0x33, &reg, &reg);
	*bufsize = reg.x.bx;
}

void     msSaveState(char far *FPbuf)
{
	union  REGS  reg;
	struct SREGS sreg;

	reg.x.ax = 22;
	reg.x.dx = FP_OFF(FPbuf);
	sreg.es = FP_SEG(FPbuf);
	int86x(0x33, &reg, &reg, &sreg);
}

void     msRestoreState(char far *FPbuf)
{
	union  REGS  reg;
	struct SREGS sreg;

	reg.x.ax = 23;
	reg.x.dx = FP_OFF(FPbuf);
	sreg.es = FP_SEG(FPbuf);
	int86x(0x33, &reg, &reg, &sreg);
}

void     msGetImageHGC(int x, int y, char *image)
{
	int      i, yy, xx;
	unsigned addr, bitpos, bitperline;
	unsigned char data, temp;

	xx = x - cur->spotX;
	yy = y - cur->spotY;
	if (mstype == MOU_HGC640) bitperline = 0x50;
	else if (mstype == MOU_HGC720) bitperline = 0x5a;
	addr = (yy & 0x03) * 0x2000 + (yy >> 2) * bitperline + (xx >> 3);
	bitpos = xx & 0x07;
	for (i = 0;i < 16;i++, yy++) {
		if (yy > yerange || yy < ysrange) continue;
		data = peekb(VIDEO_SEG, addr) << bitpos;
		temp = (unsigned char)peekb(VIDEO_SEG, ++addr);
		data |= (temp) >> (8 - bitpos);
		image[i * 2] = data;
		data = peekb(VIDEO_SEG, addr) << bitpos;
		temp = (unsigned char)peekb(VIDEO_SEG, ++addr);
		data |= (temp) >> (8 - bitpos);
		image[i * 2 + 1] = data;
		addr += 0x1ffe;
		if (addr >= 0x8000) addr -= 0x7fb0;
	}
}

void     msPutImageHGC(int x, int y, char *image)
{
	int      i, yy, xx;
	unsigned addr, bitpos, bitperline;
	unsigned char data;

	xx = x - cur->spotX;
	yy = y - cur->spotY;
	if (mstype == MOU_HGC640) bitperline = 0x50;
	else if (mstype == MOU_HGC720) bitperline = 0x5a;
	addr = (yy & 0x03) * 0x2000 + (yy >> 2) * bitperline + (xx >> 3);
	bitpos = xx & 0x07;
	for (i = 0;i < 16;i++, yy++) {
		if (yy > yerange || yy < ysrange) continue;
		if (xx >= xsrange && xx <= xerange) {
			data = peekb(VIDEO_SEG, addr) & (0xff << (8 - bitpos));
			data |= (image[i * 2] >> bitpos);
			pokeb(VIDEO_SEG, addr, data);
		}
		xx += 8 - bitpos;
		addr++;
		if (xx >= xsrange && xx <= xerange) {
			data = image[i * 2] << (8 - bitpos);
			data |= image[i * 2 + 1] >> bitpos;
			pokeb(VIDEO_SEG, addr, data);
		}
		xx += 8;
		addr++;
		if (xx >= xsrange && xx <= xerange) {
			data = peekb(VIDEO_SEG, addr) & (0xff >> bitpos);
			data |= image[i * 2 + 1] << (8 - bitpos);
			pokeb(VIDEO_SEG, addr, data);
		}
		addr += 0x1ffe;
		if (addr >= 0x8000) addr -= 0x7fb0;
	}
}

void     far   msEventHandler()
{
		asm  push ds
		asm  push ax
		asm  mov  ax, DGROUP
		asm  mov  ds, ax

	msInfo.buttonState = _BX;
	msX = msInfo.curX = _CX;
	msY = msInfo.curY = _DX;
	msInfo.horMic = _SI;
	msInfo.verMic = _DI;

	if (mstype != MOU_EGAVGA) {
		if (cursorOn && (msX != oldx || msY != oldy)) {
			msHideCursor();
			msShowCursor();
		}
	}

		asm  pop  ax
		asm  pop  ds
}
