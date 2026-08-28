/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hghlib.h  -- Ðe‹i ·³Â‰bµA ”Ðe ÑA”á          |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

			/* header define */
#ifndef     __HGHLIB_H
#define     __HGHLIB_H

#ifdef      __cplusplus
extern      "C" {
#endif


#include    <stdio.h>
#include    "hgvir.h"

			/* extern font type */
#define     MAXFONTQUEUE 500
#define     MAXUSERCHAR  10

			/* cursor blinking */
#define     NOBLINK      0
#define     DEFAULTBLINK 7

			/* font format */
#define     HAN_8x4x4    0
#define     HAN_6x2x1    1
#define     HAN_10x4x4   2
#define     HAN_2x1x2    3
#define     ENG_256      0
#define     SPECIAL_CODE 212

			/* 9 english font define ... */
#define     BIG_ENG      "big.fnt", ENG_256
#define     ITALIC_ENG   "italic.fnt", ENG_256
#define     SMALL_ENG    "small.fnt", ENG_256
#define     PILGI_ENG    "pilgi.fnt", ENG_256
#define     INBOLD_ENG   "inbold.fnt", ENG_256
#define     BOLD_ENG     "bold.fnt", ENG_256
#define     EART_ENG     "eart.fnt", ENG_256
#define     AD24_ENG     "ad24.fnt", ENG_256
#define     ROMAN_ENG    "roman.fnt", ENG_256

			/* 11 hangul font define ... */
#define     GODIK1_HAN   "hanchg2.fnt", HAN_8x4x4
#define     GODIK2_HAN   "hanchg4.fnt", HAN_8x4x4
#define     HANIYG_HAN   "haniyg.fnt", HAN_8x4x4
#define     HANSOFT_HAN  "hansoft.fnt", HAN_8x4x4
#define     HWP_HAN      "hanhwp.fnt", HAN_10x4x4
#define     MYUNGJO_HAN  "han_m.fnt", HAN_8x4x4
#define     PILGI_HAN    "pilhan.fnt", HAN_6x2x1
#define     PPALAE_HAN   "ppalae.fnt", HAN_2x1x2
#define     HANSON_HAN   "hanson.fnt", HAN_8x4x4
#define     HANPIL_HAN   "hanpil.fnt", HAN_8x4x4
#define     HANBOOT_HAN  "hanboot.fnt", HAN_8x4x4

			/* 1 special character */
#define     SPECIAL_FNT  "special.fnt", SPECIAL_CODE

			/* attribute */
#define     NORMAL       0x01
#define     REVERSE      0x02
#define     DIM          0x04
#define     SHADOW       0x08
#define     THREED       0x10
#define     OUTLINE      0x20
#define     UNDER        0x40
#define     BOLD         0x80

			/* attribute enable function */
#define     fNORMAL      &attr_null, 0
#define     fREVERSE     &reverse_image, 0
#define     fDIM         &dim_image, 1
#define     fSHADOW      &shadow_image, 2
#define     fTHREED      &three_image, 3
#define     fOUTLINE     &outline_image, 4
#define     fBOLD        &bold_image, 5
#define     fUNDER       &under_image, 6

			/* ¢…¸a Â‰b ¤w¯¢ */
#define     UPDOWN       0
#define     UPHALF       1
#define     DOWNHALF     2

			/* hangul code type */
#define     SANGYONG     1		/* ¬w¶w ¹¡ÐsÑw(¬q¥¡, ÇA“¢¯a, IBM, °w¶w, Ñe”) */
#define     SAMSUNG      2		/* ¬q¬÷ ¹¡ÐsÑw */
#define     GOLDSTAR     3		/* ‹q¬÷ ¹¡ÐsÑw(KS5601 C 5601-1982 ¹¡ÐsÑw) */
#define     DKBJOHAP     4		/* •¡Œ§¡ II ¹¡ÐsÑw */
#define     KSJOHAP      5		/* KS5601 ¹¡ÐsÑw(KS5601 C 5601-1987 ¦­¢¬á) */
#define     SEWOON       6		/* 7§¡Ëa µÅ¬÷Ñw(À÷‰Àå Ðe‹i Äa—a) */
#define     KS5601       7		/* KS5601 µÅ¬÷Ñw(KS5601 C 5601-1987 µÅ¬÷Ñw) */

		    /* for hangul input routine */
#define    _NORMAL_KEYCODE  -1
#define    _SPECIAL_KEYCODE  0
#define    _EXIT_KEYCODE     1

typedef  struct  extfont {
	FILE  *fpt;
	char  *p[MAXFONTQUEUE];
	int   n[MAXFONTQUEUE];
	int   qh, qt;			/* queue header, queue tail */
	int   xsize, ysize;
	int   qsize;
	int   fnum;			/* font number */
	char  *buff;
} ExtFont;

			/* hangul type & english type */
typedef struct htype {
	int   firs;
	int   mids;
	int   lass;
} HTYPE;

typedef struct etype {
	int   engs;
} ETYPE;

			/* hangul byte & code form */
typedef struct {
	unsigned   lasc : 5;
	unsigned   midc : 5;
	unsigned   firc : 5;
	unsigned   dummy: 1;
} hcode;

typedef struct {
	byte   schar;
	byte   fchar;
} hchar;


#ifdef      __cplusplus
}
#endif

#include    "extern.h"

#endif
