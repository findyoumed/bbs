/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hginit.h -- Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á           |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __HGINIT_H
#define     __HGINIT_H

#ifdef      __cplusplus
extern      "C" {
#endif


#ifndef     __LARGE__
#error      Nurie 1.5 only supports Large Model
#endif

#define     hgSUCCESS    1
#define     hgFAIL       0

#define     hgTRUE       1
#define     hgFALSE      0

			/* §¡•Aµ¡ Äa—a */
#define     hgHERCULES   0
#define     hgEGA        1
#define     hgVGA        2
#define     hgSVGA       3
#define     hgUNKNOWN    4

			/* §¡•Aµ¡ ¡¡—a */
#define     hgGRAPHICS   1
#define     hgTEXT       0

			/* ‹aœÏ¢ ¡¡—a */
#define     hgVGA640x480x16    0
#define     hgVGA800x600x16    1
#define     hgEGA640x350x16    2
#define     hgEGA640x200x16    3
#define     hgHERC720x348      4
#define     hgHERC640x400      5

			/* ÉB¯aËa ¡¡—a */
#define     hgColorText  3
#define     hgMonoText   7

			/* ·³b ¡¡—a */
#define     hgENGLISH    0
#define     hgHAN2       2
#define     hgHAN3       3

			/*  a¶¯a Äá¬á */
#define     DEFAULT      &default_arrow
#define     CROSS        &cross
#define     QUESTION     &question
#define     NOT          &not
#define     TIMER        &timer
#define     BUBBLE       &bubble
#define     ARROW2       &arrow2

			/* ¬‚Œiˆt */
#ifndef     __COLORS
#define     __COLORS

enum     COLORS {
	BLACK,
	BLUE,
	GREEN,
	CYAN,
	RED,
	MAGENTA,
	BROWN,
	LIGHTGRAY,
	DARKGRAY,
	LIGHTBLUE,
	LIGHTGREEN,
	LIGHTCYAN,
	LIGHTRED,
	LIGHTMAGENTA,
	YELLOW,
	WHITE
};

#endif

#define     ZERO         BLACK

			/* Ç¡ ·³b¯¡ */
#define     NOKEY        0
#define     WAIT         0
#define     NOWAIT       1


#ifdef      __cplusplus
}
#endif

#endif
