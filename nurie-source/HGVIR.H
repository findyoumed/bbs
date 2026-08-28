/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : hgvir.h -- ˆa¬w ‹¡´â ¸wÃ¡µA ”Ðe ÑA”á         |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __HGVIR_H
#define     __HGVIR_H

#ifdef      __cplusplus
extern      "C" {
#endif


typedef  unsigned  char   byte;

			/* ˆa¬w ‹¡´â ¸wÃ¡· ‹¡´â ¸w­¡µA ”Ðe Š¹¡ÁA */
typedef  struct  vmem {
	int   logichandle;		/* ‘¥Ÿ¡¸â·¥ Ð…—i */
	int   type;			/* ‹¡´â ¸w­¡ ¹·ŸA
					   Îaº… ¡A¡¡Ÿ¡, ÑÂ¸w ¡A¡¡Ÿ¡, Ða—a —¡¯aÇa */
} VMEM;
			/* ¢‰Ÿ¡¸â ÍA·¡»¡· Š¹¡ÁA */
typedef  struct  physic_page {
	unsigned   segment;		/* ¢‰Ÿ¡¸â ÍA·¡»¡· ¯¡¸b ­A‹a åËa */
	unsigned   pnum;		/* ÍA·¡»¡ ¤åÑ¡ */
} PHYSICAL_PAGE;

#define     MAXPAGES     12

			/* graphic vimage type */
typedef  struct  vimage {
	VMEM  *buff[MAXPAGES];
} VIMAGE;

typedef  struct  cimage {
	char  *buff[MAXPAGES];
} CIMAGE;

			/* ‹¡´â ¸w­¡· ¹·ŸA */
#define     CON          1
#define     EMM          2
#define     HARD         3

extern   byte      *vgbuff;		/* ÑÁ¡e ¸á¸w¶w ¸åµb ¤áÌá */

			/* prototype */
VMEM    *hgVMallocCON(unsigned size);
VMEM    *hgVMallocHARD(unsigned size);
VMEM    *hgVMallocEMM(unsigned size);
VMEM    *hgVMalloc(unsigned size);


#ifdef      __cplusplus
}
#endif

#endif
