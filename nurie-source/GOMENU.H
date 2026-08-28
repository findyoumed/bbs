/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : gomenu.h -- ˆa‹¡ ¡A“AµA ”Ðe ÑA”á             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __GOMENU_H
#define     __GOMENU_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     GOCMD_LEN    10		/* ˆa‹¡ ¡ww´á· »¡¸÷ ˆa“w ‹©·¡ "go" */
#define     MNUTHEME_LEN 40		/* ¡A“A· ¸åÁA ·¡Ÿq· ¢…¸a® */
#define     NAME_LEN     40		/* Ðw¡¢ ·¡Ÿq· ÂA” ¢…¸a® */
#define     GO_LEN       40		/* ˆa‹¡ Ð—¬å»¡ ·¡Ÿq· ÂA” ¢…¸a® */
#define     HEADER_LINE  10		/* ÑA”á º‰® */
#define     BUFFER_MAX   80		/* ·ª´á—i·© º‰”w ¤áÌá· Ça‹¡ */

			/* ˆa‹¡ ¡A“A Ðw¡¢µA ”Ðe Š¹¡ */
typedef  struct  mnuitem {
	int   depth;			/* Ðw¡¢· A¥I */
	char  name[NAME_LEN + 1];	/* Ðw¡¢· ·¡Ÿq */
	char  go_target[GO_LEN + 1];	/* ˆa‹¡ Ð—¬å»¡ ·¡Ÿq */
} MNUITEM;


#ifdef      __cplusplus
}
#endif

#endif

