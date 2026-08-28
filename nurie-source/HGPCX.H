/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hgpcx.h -- PCX ÑÁ·©µA ”Ðe ÑA”á               |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __HGPCX_H
#define     __HGPCX_H

#ifdef      __cplusplus
extern      "C" {
#endif


#include    <stdio.h>

			/* PCX ÑÁ·©· ÑA”á Š¹¡ */
typedef  struct  pcxhdr {
	char  Manufacturer;		/* PCX ÑÁ·©·±·i Îa¯¡ : 0AH */
	char  Version;
	char  Encoding;
	char  Bitsperpixel;
	int   x1, y1, x2, y2;		/* PCX ·¡£¡»¡· ˆa¡, ­A¡ ¶áÃ¡ */
	int   HRes;			/* ÑÁ¡e· ˆa¡ Ð¬w•¡
					   ÐáÇiA¯a Äa—a· ‰w¶“e 720 */
	int   VRes;			/* ÑÁ¡e· ­A¡ Ð¬w•¡
					   ÐáÇiA¯a Äa—a· ‰w¶“e 348 */
	unsigned char Colormap[16][3];
	char  Reserved;
	char  NPlanes;			/* VGA Äa—a· ‰w¶“e 4ˆ· §¡Ëa ÏiA·¥
					   ÐáÇiA¯a Äa—a· ‰w¶“e 1ˆ· §¡Ëa ÏiA·¥ */
	unsigned BytesperLine;		/* PCX ·¡£¡»¡· ¤a·¡Ëa ”e¶á· ˆa¡ Ça‹¡ */
	int   PaletteInfo;
	char  Filler[58];
} PCXHDR;

			/* PCX §¡•Aµ¡ Èa·¡Ïa */
#define     PCX_HERCULES    0
#define     PCX_VGA16       1
#define     NO_PCX         -1

			/* function define */
#define     PCX_VGA16_FUNCTION      &hgPCXFileDisplayV
#define     PCX_HERCULES_FUNCTION   &hgPCXFileDisplayH
#define     PCX_MONO_FUNCTION       &hgPCXFileDisplayM


#ifdef      __cplusplus
}
#endif

#endif
