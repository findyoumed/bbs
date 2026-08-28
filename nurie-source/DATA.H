/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : data.h -- •A·¡Èa ÑÁ·©µA ”Ðe ÑA”á             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __DATA_H
#define     __DATA_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     MAXDATAFILE  2		/* ÐeŒá¤åµA ¬a¶wÐi ® ·¶“e ÂA” •A·¡ÈaÑÁ·©· ˆ•® */

#define     DHDSIZE      sizeof(HEADER)	/* ÑA”á· Ça‹¡ */
#define     ID_SIZE      sizeof(IDREC)

#define     NEW_MODE     O_RDWR | O_BINARY | O_CREAT, S_IREAD | S_IWRITE
#define     OPEN_MODE    O_RDWR | O_BINARY

			/* •A·¡Èa ÑÁ·©· ÑA”á· Š¹¡ */
typedef  struct  header_data {
	long  del_rec;			/* ¬b¹A–E AÅ¡—a ¤åÑ¡ */
	long  next_rec;			/* ”a·q¤åµA ¬a¶wÐi AÅ¡—a ¤åÑ¡ */
	int   data_size;		/* AÅ¡—a· ‹©·¡ */
} HEADER;

typedef  struct  id_record {
	long   next;
	byte   name[20];
	byte   id[10];
	byte   address[40];
	byte   tel[15];
	byte   job[15];
	byte   hobby[20];
	byte   pcname[10];
	byte   school[20];
	byte   rel[10];
	byte   etc[40];
} IDREC;


#ifdef      __cplusplus
}
#endif

#endif

