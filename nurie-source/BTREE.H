/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : btree.h -- B+ TreeµA ”Ðe ÑA”á                |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __BTREE_H
#define     __BTREE_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     MAXINDEXLEN   20		/* ·¥•B¯a Ç¡(Key)· ÂA”‹©·¡ */
#define     MAXINDEXFILE  3		/* ÐeŒá¤åµA ¬a¶wÐi ® ·¶“e ÂA” ·¥•B¯aÑÁ·©· ˆ•® */
#define     NDSIZE        512		/* Ðaa· ‘¡—a· ‹©·¡ */

#define     KeyMax(trx)   Bheader[trx].keycount	/* Ðaa· ‘¡—aµA —i´áˆi KEY · ® */
#define     KeyLen(trx)   Bheader[trx].keylen	/* Ðaa· ‘¡—aµA —i´áˆi KEY · ÂA”‹©·¡ */
#define     HDSIZE        sizeof(BHEADER)	/* ÑA”á· Ça‹¡ */
#define     KeySize(trx)  (KeyLen(trx) + sizeof(long))
#define     ROOT(trx)     Bheader[trx].rootnode

			/* B+ Tree ÑA”á ÑÁ·© Š¹¡ */
typedef  struct  BtreeHeader {
	int   hdlen;			/* B+ Tree file header ‹©·¡ */
	int   nodelen;			/* B+ Tree file node ‹©·¡ */
	int   keylen;			/* Ðaa· ‘¡—aµA —i´áˆi Key· ÂA”‹©·¡ */
	int   maxkey;			/* Ðaa· ‘¡—aµA —i´áˆi Key· ® */
	int   dupflag;			/* ·¡ ·¥•B¯a ÑÁ·©·¡ º—¥¢–A“e KeyŸi Ðá¶wÐa“eˆa? */
	long  incount;			/* B+ Tree fileµA ·¶“e ·A¶wÐe Key· ® */
	long  delcount;			/* B+ Tree fileµA ·¶“e ¬b¹A–E Key· ® */
	long  rootnode;			/* root ‘¡—a· ¤åÑ¡ */
	long  delnode;			/* ¬b¹A–E ‘¡—a· ¤åÑ¡ */
	long  nextnode;			/* ”a·q¤åµA ¬a¶wÐi ‘¡—a· ¤åÑ¡, ¬b¹A–E ‘¡—aˆa ´ô·a¡e ·¡‘¡—aŸi ¬a¶w */
	long  leftmost;			/* Leaf ‘¡—aº— ˆa¸w ¸b·e Key ˆt·i ˆx“e ‘¡—a¤åÑ¡ */
	long  rightmost;		/* Leaf ‘¡—aº— ˆa¸w Çe Key ˆt·i ˆx“e ‘¡—a¤åÑ¡ */
} BHEADER;

			/* B+ Tree ‘¡—a Š¹¡ */
typedef  struct  BtreeNode {
	int   leaf;			/* Leaf ‘¡—a·¥ˆa? Leaf¯¡ 1, else 0 */
	int   count;			/* ·¡ ‘¡—aµA ·¶“e Key· ® */
	long  up;			/* ¦¡¡ ‘¡—a Í¡·¥Èá */
	long  down;			/* ¸a¯¢ ‘¡—a Í¡·¥Èá */
	long  left;			/* ¶E½¢ Ñw¹A ‘¡—a Í¡·¥Èá */
	long  right;			/* µ¡Ÿe½¢ Ñw¹A ‘¡—a Í¡·¥Èá */
	byte  rec[NDSIZE - sizeof(int) * 2 - sizeof(long) * 4];
					/* Key ¢…¸aµi */
} BNODE;


#ifdef      __cplusplus
}
#endif

#endif
