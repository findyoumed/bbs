/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hwindow.h -- Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á          |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __HWINDOW_H
#define     __HWINDOW_H

#ifdef      __cplusplus
extern      "C" {
#endif


#include    <string.h>
#include    "hgvir.h"

#define     MAXITEM  	  20
#define     MAXPOPUP	  15
#define     _MAXDIR 	  200
#define     MAXHELPLINE   100
#define     MAXSTYLE      20

#define     HORIZ         0
#define     VERT          1

#define     DRAW          1
#define     ERASE         0

#define     FILL          1
#define     NOFILL        0

#define     NOPUSH        1
#define     PUSH          0

			/* used by popup & pulldown */
#define     hgEnable      1
#define     hgDisable     0

			/* used by hgDrawBorder */
#define     INSIDE        dft_bstyle[0]
#define     INSIDE2       dft_bstyle[1]
#define     BOXNORMAL     dft_bstyle[2]
#define     BOXREVERSE    dft_bstyle[3]
#define     BLUEBOX       dft_bstyle[4]
#define     BARNORMAL     dft_bstyle[5]
#define     BARREVERSE    dft_bstyle[6]
#define     ERASER        dft_bstyle[7]

			/* used by WCOLOR */
#define     wcINSIDE      0
#define     wcINSIDE2     1
#define     wcBOXNORMAL   2
#define     wcBOXREVERSE  3
#define     wcBLUEBOX     4
#define     wcBARNORMAL   5
#define     wcBARREVERSE  6
#define     wcERASER      7

			/* used by hgSetDither */
#define     DITHER_GRAY     &dither_gray
#define     DITHER_PATTERN  &dither_pattern

#define     _PLANES       4

extern   int      dft_bstyle[MAXSTYLE][4];

			/* ¤b¯a ¯aÈa·© ˆ‚ÁA */
typedef  struct  bstyle {
	int   back;
	int   color1;
	int   color2;
	int   deep;
} BSTYLE;
			/* ¬‚Œi ˆ‚ÁA */
typedef  struct  wcolor {
	int   border;
	int   tfore;
	int   tback;
	int   back;
} WCOLOR;
			/* ¤b¯a ¬‚Œi ˆ‚ÁA */
typedef  struct  bcolor {
	int   border;
	int   back;
} BCOLOR;
			/* Ça‹¡ ˆ‚ÁA */
typedef  struct  width {
	int   xwidth;
	int   ywidth;
} WIDTH;
			/* ¤b¯a ˆ‚ÁA */
typedef  struct  hbox {
	char    *items[MAXITEM];
	WCOLOR  color;
	WIDTH   size;
	VIMAGE  *buff;
} HBOX;
			/* ¤a ˆ‚ÁA */
typedef  struct  hbar {
	BCOLOR  color;
	WIDTH   size;
	CIMAGE  *buff;
} HBAR;
			/* ¤áËe ˆ‚ÁA */
typedef  struct  hbutton {
	char    *item;
	WIDTH   size;
	WCOLOR  color;
} HBUTTON;
			/* ¶å•¡¶ ˆ‚ÁA */
typedef  struct  hwindow {
	char    *titl;
	WIDTH   size;
	WCOLOR  color;
} HWINDOW;
			/* ¯aÇa© ¤a ˆ‚ÁA */
typedef  struct  hscrlbar {
	WIDTH  size;
	int    total;
	int    screen;
	int    pos;
	char   direc;
} HSCRLBAR;
			/* ´a·¡Å¥ ˆ‚ÁA */
typedef  struct  hicon {
	WIDTH  size;
	char   *buff;
} HICON;
			/* •¡¶‘ i ¤b¯a ˆ‚ÁA */
typedef  struct  hhelp {
	char  *items[MAXHELPLINE];
	int   xchars;
	int   ylines;
} HHELP;
			/* ¬åÈ‚ ¤b¯a ˆ‚ÁA */
typedef  struct  hdirbox {
	char   *items[_MAXDIR];
	WIDTH  size;
	int    xnum;
	int    ynum;
} HDIRBOX;
			/* Ìs´ó ¡A“A ˆ‚ÁA */
typedef  struct  hpopup {
	char    *items[MAXITEM];
	WCOLOR  color;
	WIDTH   size;
	VIMAGE  *buff;
	int     start;
	int     code[MAXITEM];
} HPOPUP;
			/* Î‰”a¶… ¡A“A ˆ‚ÁA */
typedef  struct  hpulldown {
	char    *items[MAXITEM];
        int     xpos[MAXITEM];
	WIDTH   size;
	HPOPUP  *p[MAXPOPUP];
        int     code[MAXITEM];
        int     start;
} HPULLDOWN;


HBOX     *hgHBOX_Load(char *i[MAXITEM], WCOLOR c, WIDTH w);
HBAR     *hgHBAR_Load(BCOLOR c, WIDTH w);
HBUTTON  *hgHBUTTON_Load(char *i, WCOLOR c, WIDTH s);
HWINDOW  *hgHWINDOW_Load(char *t, WCOLOR c, WIDTH s);
HSCRLBAR *hgHSCRLBAR_Load(int total, int screen, char direc, WIDTH w);
HICON    *hgHICON_Load(char *name);
HICON    *hgHICON_Set(void (*iconset)(HICON *p));
HHELP    *hgHHELP_Load(char *i[], int xc, int yl);
HDIRBOX  *hgHDIRBOX_Load(char *i[], WIDTH w, int xnum, int ynum);
HPOPUP  *hgHPOPUP_Load(char *i[], WCOLOR c, WIDTH w);
HPULLDOWN *hgHPULLDOWN_Load(char *i[], int x[MAXITEM], WIDTH w, HPOPUP *pop[MAXPOPUP]);


#ifdef      __cplusplus
}
#endif

#endif
