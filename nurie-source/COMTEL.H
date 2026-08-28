/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : comtel.h -- ¸åÑÁˆé‹¡µA ”Ðe ÑA”á              |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __COMTEL_H
#define     __COMTEL_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     MAXTEL       100

			/* ·¡´¡‹¡ 5.3 ¸åÑÁ¤åÑ¡ •A·¡Èa Š¹¡ */
typedef  struct  telitem {
	char    name[21];		/* ·¡Ÿq 21 ¤a·¡Ëa */
	char    telnum[17];		/* ¸åÑÁ¤åÑ¡ 17 ¤a·¡Ëa */
	int     baud;			/* ¸å­· ­¢•¡ 2 ¤a·¡Ëa
					   0 :  1200, 1 :   2400
					   2 :  4800, 3 :   9600
					   4 : 19200, 5 :  38400
					   6 : 57600, 7 : 115200
					   8 :   110, 9 :    150
					  10 :   300, 11:    600 */
	char    parity;			/* ÌŸ¡Ë¡ §¡Ëa 1 ¤a·¡Ëa
					  'E' : ¼b®(Even)
					  'O' : Ñ©®(Odd)
					  'N' : ´ô·q(None) */
	int     data;			/* •A·¡Èa §¡Ëa 2 ¤a·¡Ëa : 7 ™¡“e 8 */
	int     stop;			/* ¸÷»¡ §¡Ëa 2 ¤a·¡Ëa : 0 ™¡“e 1 */
	int     han;			/* Ñ¡¯aËa Ðe‹i· ¹·ŸA 2 ¤a·¡Ëa
					   0 : ¬w¶w ¹¡ÐsÑw
					   1 : ¬q¬÷ ¹¡ÐsÑw
					   2 : ‹q¬÷ ¹¡ÐsÑw
					   3 : µ• KS ¹¡ÐsÑw
					   4 : •¡Œ§¡ ¹¡ÐsÑw
					   5 : 7 §¡Ëa µÅ¬÷Ñw
					   6 : KS5601 µÅ¬÷Ñw */
	char    hlp[56];		/* §¡‰¡ 56 ¤a·¡Ëa */
} TELITEM;
			/* ¸åÑÁˆé‹¡ ¤b¯a· ˆ‚ÁA */
typedef  struct  ctel {
	TELITEM *items[MAXTEL];
	WIDTH   size;
	int     ynum;
} CTEL;


#ifdef      __cplusplus
}
#endif

#endif
