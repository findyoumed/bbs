/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : adbank.h -- ¤—Ça ÑÁ·©· Š¹¡µA ”Ðe ÑA”á      |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __ADBANK_H
#define     __ADBANK_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     DEFAULT_BANK     "standard"
#define     BANK_EXTENSION   "bnk"

#define     MAJ_VERSION       1
#define     MIN_VERSION       0

#define     BANK_SIG          "ADLIB-"
#define     BANK_SIG_LEN      6

#define     BANK_FILLER_SIZE  8

#define     BANK_OK           0
#define     BANK_NOT_FOUND   -1
#define     BAD_BANK_FILE    -2
#define     NOT_DEFINED      -3
#define     CREATE_ERROR     -4
#define     READ_WRITE_ERR   -5

#pragma     pack(1)

			/* ¤—Ça ÑÁ·©· ÑA”áµA ”Ðe Š¹¡ */
typedef  struct  bankheader {
	char   major;
	char   minor;
	char   sig[BANK_SIG_LEN];	/* signature 6 ¤a·¡Ëa : "ADLIB-" */
	int    ins_num;			/* ´b‹¡· ˆ•® */
	int    max_num;			/* ˆa»©® ·¶“e ÂA” ´b‹¡· ˆ•® */
	long   offsetList;		/* ´b‹¡ ·¡Ÿq Ÿ¡¯aËa· ÑÁ·© ¶áÃ¡ */
	long   offsetTimbre;		/* ´b‹¡ ·q¬‚ Ÿ¡¯aËa· ÑÁ·© ¶áÃ¡ */
	char   filler[BANK_FILLER_SIZE];/* ¡¡– 0 */
} BankHeader;

			/* Bank descriptor: */
typedef  struct {
	int        handle;
	BankHeader hd;
} BankRec, *BankPtr;

			/* ´b‹¡ ·¡Ÿq •A·¡Èa· Š¹¡ÁA */
typedef  struct  bankentry {
	int    index;			/* ´b‹¡ ¤åÑ¡ */
	char   active;			/* 0 if not used */
	char   name[9];			/* ´b‹¡ ·¡Ÿq */
} BankEntry;

			/* Operator Š¹¡ÁA */
typedef  struct  operator {
	int    ksl;
	int    freqMult;
	int    feedBack;
	int    attack;
	int    sustLevel;
	int    sustain;
	int    decay;
	int    release;
	int    output;
	int    am;
	int    vib;
	int    ksr;
	int    fm;
} Operator;

			/* ´b‹¡ ·q¬‚ •A·¡Èa· Š¹¡ÁA */
typedef  struct {
	char     mode;		/* 0 = ¡I¡—¡, 1 = Èa´b‹¡ */
	char     voice;		/* ¥¡·¡¯a ¤åÑ¡ */
	Operator op0;
	Operator op1;
	int      wave0;
	int      wave1;
} Timbre;

typedef  struct {
	char     mode;
	char     voice;
	char     param[13 * 2];
	char     wave0;
	char     wave1;
} PackedTimbre;

#pragma     pack()


#ifdef      __cplusplus
}
#endif

#endif

