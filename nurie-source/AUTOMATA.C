/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : automata.c  -- Ðe‹i ·³b µ¡É¡ aÈa ¡¡—I        |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MID_OFF     100		/* º—¬÷ Å¡—aˆt· offset */
#define     LAST_OFF    200		/* ¹·¬÷ Å¡—aˆt· offset */

#define     NO_CODE     0

#define     EMPTY       1		/* Á¡¬÷, ¹·¬÷· Á¡‹¡ Å¡—aˆt */
#define     EMPTY2      2		/* ¹·¬÷· Á¡‹¡ Å¡—aˆt */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

int      firstbuf, midbuf, lastbuf;	/* Á¡¬÷, º—¬÷, ¹·¬÷ Å¡—a */
int      stream = 0;			/* µÅ¬÷–E Ðe ¢…¸a */
char     streamflag = hgFALSE;		/* Ðe ¢…¸a µÅ¬÷ µa¦ */

byte    *Cho_to_Jong;
byte    *BokCho;
byte    *BokJung;
byte    *BokJong;

/* –¤é¯¢ ·³b ´i‰¡Ÿ¡»qµA ¬a¶w–A“e Àq¹¡Îa  */
		    /* ¸aÌe·i É·Ðaµa ·³b–E ¸a·q·e ¡¡– Á¡¬÷ Å¡—aµA Ð”wÐa“e
			  ˆõ·¡”a. ¹·¬÷·¡ ·³b–I ¬wÑ×·i Ñe¸ ·³b–E Ðe‹i Å¡—a¡
			  Ìe”eÐa‰¡ ¹·¬÷·¡ ·³b–I ¬wÑ×µA¬á ·¡¶wÐa“e Àq¹¡ ¤µi·¡”a.
			  Á¡¬÷ Å¡—aµA Ð”wÐa“e ¹·¬÷·¡ ´ô“e ‰w¶“e À¶‘ Å¡—aµÁ
			  ¹·¬÷·a¡ ³a·© ® ´ô“e '˜A, ¨A, ¼A'‰Á ˆ{·e Á¡¬÷ •¢¶w ¸a·q·¡”a. */
		    /* Á¡¬÷· ˆt·i ´è“e ˆõ·e º—¬÷‰Á ¹·¬÷·¡ ´ô“e ‰w¶œa¡e ¸aÌeµA¬á
			  ·³b–E Å¡—aŸi ‹a”¡ ¬a¶wÐ•¡ –E”a. Ða»¡ e Ñe¸ ¹·¬÷·¡
			  ¥¢¸a·q·© ‰w¶ ”a·qµA µ¡“e ·q­¡µA ˜aœa ¹·¬÷·i ¦…Ÿ¡Ðaµa
			  ´| ·q¸é· ¹·¬÷·a¡ ¬a¶wÐi ·q­¡µÁ ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶wÐi
			  ·q­¡Ÿi ‰i¸÷Ðaµa´¡ Ðe”a. */
byte     Cho_to_JongTable[16][2] = {
	{ 2,  2}, { 3,  3}, { 4,  5}, { 5,  8}, { 7,  9}, { 8, 17},
	{ 9, 19}, {11, 21}, {12, 22}, {13, 23}, {14, 24}, {16, 25},
	{17, 26}, {18, 27}, {19, 28}, {20, 29}
};
		    /* ·³b–E ¡¡·q·a¡ º—¬÷ Å¡—aŸi ¬—¬÷Ða“e ”e‰µA¬á ¬a¶w–A“e
			  Àq¹¡ ¤µi·e º—¬÷·¡ ¥¢¡¡·q·¡ ´a“¥ ‰w¶“e ¸aÌeµA¬á ·³b–A´á
			  ¸aÌe Àq¹¡ ¤µi·i É·Ðaµa ´è·e Ðe‹i Å¡—aŸi ‹a”¡ º—¬÷·
			  Å¡—a(¨‹¡ 100)¡ ¬a¶wÐa»¡ e µe·¡´á ¡¡·q·¡ ·³b–A´ö·i ‰w¶“e
			  ‹¡¹¥· º—¬÷ Å¡—aµÁ ¬¡ ·³b–E ¡¡·q·¡ Ðs¶w–A´á ¥¢¡¡·q·i
			  ¬—¬÷Ði ® ·¶“eˆa· µa¦Ÿi ‰i¸÷Ðe”a. */
byte     BokJungTable[7][3] = {
	{ 13,   3,  14 },		/* …¡ + „a = …Á */
	{ 13,   4,  15 },		/* …¡ + „ = …á */
	{ 13,  29,  18 },		/* …¡ + ‡¡ = †A */
	{ 20,   7,  21 },		/* † + „á = †¡ */
	{ 20,  10,  22 },		/* † + …A = †Á */
	{ 20,  29,  23 },		/* † + ‡¡ = †á */
	{ 27,  29,  28 }		/* ‡a + ‡¡ = ‡ */
};
		    /* ¹·¬÷·¡ ¥¢¸a·q·i ·¡ž“e ‰w¶Ÿi ‰¡aÐaµa ¹·¬÷ •¢¶w ¥¢¸a·q·i
			  ¬—¬÷Ða‹¡ ¶áÐe Àq¹¡ ¤µi·¡”a. */
byte     BokJongTable2[11][3] = {
	{  2,  11,   4 },		/* ˆA +  ¬A = „D */
	{  5,  14,   6 },		/* A +  ¸A = „F */
	{  5,  20,   7 },		/* A +  ÐA = „G */
	{  9,   2,  10 },		/* œA +  ˆA = „J */
	{  9,   8,  11 },		/* œA +   A = „K */
	{  9,   9,  12 },		/* œA +  ¤A = „L */
	{  9,  11,  13 },		/* œA +  ¬A = „M */
	{  9,  18,  14 },		/* œA +  ÈA = „N */
	{  9,  19,  15 },		/* œA +  ÌA = „O */
	{  9,  20,  16 },		/* œA +  ÐA = „P */
	{ 19,  11,  20 }		/* ¤A +  ¬A = „T */
};

/* ­A¤é¯¢ ·³b ´i‰¡Ÿ¡»qµA ¬a¶w–A“e Àq¹¡Îa  */
		    /* –¤é¯¢‰Á“e ”iŸ¡ ­A¤é¯¢µA¬á“e Á¡¬÷µA Ð”wÐa“e ¥¢¸a·q
			  »b 'ŒA, ˜A, ¨A, ¼A'µA Ð”wÐa“e ¸aÌe·¡ ´ô”a. Á¡¬÷·¡ ·³b–A´á
			  ·¶‰¡ º—¬÷·¡ ·³b–A´á´¡ Ði ¬wÑ×µA¬á ™¡ ”a¯¡ Á¡¬÷·¡ ·³b
			  –E”a¡e ‹¡¹¥· Á¡¬÷‰Á ¬¡ ·³b–E Á¡¬÷·¡ Ðs¶w–A´á Á¡¬÷ ¥¢¸a·q
			  ·i ¬—¬÷Ði ® ·¶“eˆa· µa¦Ÿi ‰i¸÷Ðe”a.
			  ·¡ ‹¡“w·i –¤é¯¢µA¬á•¡ ¹A‰·Ðe”a. ex)HWP */
byte     BokChoTable[5][3] = {
	{  2,   2,   3 },		/* ˆA + ˆA = ŒA */
	{  5,   5,   6 },		/* ”A + ”A = ˜A */
	{  9,   9,  10 },		/* ¤A + ¤A = ¨A */
	{ 11,  11,  12 },		/* ¬A + ¬A = °A */
	{ 14,  14,  15 }		/* ¸A + ¸A = ¼A */
};
		    /* º—¬÷ ¥¢¡¡·q·i ¶áÐe Àq¹¡ ¤µi·e –¤é¯¢‰Á ˆ{”a. */

		    /* ¹·¬÷·¡ ¥¢¸a·q·i ·¡ž“e ‰w¶Ÿi ‰¡aÐaµa ¹·¬÷ •¢¶w ¥¢¸a·q·i
			  ¬—¬÷Ða‹¡ ¶áÐe Àq¹¡ ¤µi·¡”a.
			  ¹·¬÷ ¥¢¸a·qº— ¸aÌeµA¬á »¢¸ó ´è·i ® ·¶“e 6ˆŸi ¹A¶AÐe
			  a á»¡“e ¹·¬÷· Ðs¶w·a¡ ´è´á»¥”a.  ‹aœáa »¢¸ó ´è·i ®
			  ·¶“e 6ˆ· ¹·¬÷ Å¡—a•¡ Ðs¶wµA ·Ð¬á•¡ ³i ® ·¶‰A Ða“e
			  ˆõ·¡ ¤aœq»¢Ða£a¡ –¤é¯¢· ¹·¬÷ ¥¢¸a·q Àq¹¡ ¤µi‰Á §¡¯uÐe
			  µbÐi·i Ðe”a. ·¡ ˜ ­A¤é¯¢· ‰w¶ º—¬÷ Å¡—aŸi »¢¸ó Àq¹¡Ði
			  ® ·¶·a£a¡ ¤µi· ˆt·¡ ´¢ˆe ”iœa»¡‰A –E”a. */
byte     BokJongTable3[11][3] = {
	{  2,  21,   4 },		/* ˆA +  ¬A = „D */
	{  5,  24,   6 },		/* A +  ¸A = „F */
	{  5,  29,   7 },		/* A +  ÐA = „G */
	{  9,   2,  10 },		/* œA +  ˆA = „J */
	{  9,  17,  11 },		/* œA +   A = „K */
	{  9,  18,  12 },		/* œA +  ¤A = „L */
	{  9,  20,  13 },		/* œA +  ¬A = „M */
	{  9,  27,  14 },		/* œA +  ÈA = „N */
	{  9,  28,  15 },		/* œA +  ÌA = „O */
	{  9,  29,  16 },		/* œA +  ÐA = „P */
	{ 19,  21,  20 }		/* ¤A +  ¬A = „T */
};

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgSetInInit();
void     hg2bulInit();
void     hg3bulInit();

int      hgCombine(int *ch);

void     init_code();
int      is_complete();
void     buf2stream();
int      temp_combine();
int      last_by_first(int ch);
int      first_by_last(int ch);
int      bokcho_find(int ch);
int      bokjung_find(int ch);
int      bokjung_del();
int      bokjong_find(int ch);
int      bokjong_del();

int      combine2(int *ch);
void     jaeum_process(int ch);
void     moeum_process(int ch);
int      back_process();

int      combine3(int *ch);
void     chosung_process(int ch);
void     jungsung_process(int ch);
void     jongsung_process(int ch);

			/* function pointer */
int    (*comb)(int *ch);


void     hgSetInInit()
{
	Cho_to_Jong = &Cho_to_JongTable[0][0];
	BokCho = &BokChoTable[0][0];
	BokJung = &BokJungTable[0][0];
	if (hgGetInMethod() == hgHAN2) hg2bulInit();
	else hg3bulInit();
}

void     hg2bulInit()
{
	BokJong = &BokJongTable2[0][0];
	comb = &combine2;
}

void     hg3bulInit()
{
	BokJong = &BokJongTable3[0][0];
	comb = &combine3;
}

int      hgCombine(int *ch)
{
	int   ret;

	ret = (*comb)(ch);
	return(ret);
}

void     init_code()
{
	firstbuf = lastbuf = EMPTY;	/* À¶‘ Å¡—a */
	midbuf = EMPTY2;
}

int      is_complete()
{
	if (firstbuf + midbuf + lastbuf != 4) return(hgFALSE);
	return(hgTRUE);
}

void     buf2stream()
{
	stream = 0x8000;
	stream |= firstbuf << 10;
	stream |= midbuf << 5;
	stream |= lastbuf;
	streamflag = hgTRUE;

	init_code();
}

int      temp_combine()
{
	int   temp;

	temp = 0x8000;
	temp |= firstbuf << 10;
	temp |= midbuf << 5;
	temp |= lastbuf;
	return(temp);
}

int      last_by_first(int ch)
{
	int   i;

	for (i = 0;i < 16;i++)
		if (*(Cho_to_Jong + i * 2) == ch)
			return(*(Cho_to_Jong + i * 2 + 1));

	return(NO_CODE);
}

int      first_by_last(int ch)
{
	int   i;

	for (i = 0;i < 16;i++)
		if (*(Cho_to_Jong + i * 2 + 1) == ch)
			return(*(Cho_to_Jong + i * 2));

	return(NO_CODE);
}

int      bokcho_find(int ch)
{
	int   i;

	for (i = 0;i < 5;i++)
		if (*(BokCho + i * 3) == firstbuf && *(BokCho + i * 3 + 1) == ch)
			return(*(BokCho + i * 3 + 2));

	return(NO_CODE);
}

int      bokjung_find(int ch)
{
	int   i;

	for (i = 0;i < 7;i++)
		if (*(BokJung + i * 3) == midbuf && *(BokJung + i * 3 + 1) == ch)
			return(*(BokJung + i * 3 + 2));

	return(NO_CODE);
}

int      bokjung_del()
{
	int   i;

	for (i = 0;i < 7;i++)
		if (*(BokJung + i * 3 + 2) == midbuf) {
			midbuf = *(BokJung + i * 3);
			return(*(BokJung + i * 3 + 1));
		}

	return(NO_CODE);
}

int      bokjong_find(int ch)
{
	int   i;

	for (i = 0;i < 11;i++)
		if (*(BokJong + i * 3) == lastbuf && *(BokJong + i * 3 + 1) == ch)
			return(*(BokJong + i * 3 + 2));

	return(NO_CODE);
}

int      bokjong_del()
{
	int   i;

	for (i = 0;i < 11;i++)
		if (*(BokJong + i * 3 + 2) == lastbuf) {
			lastbuf = *(BokJong + i * 3);
			return(*(BokJong + i * 3 + 1));
		}

	return(NO_CODE);
}


/*  –¤é¯¢ ·³b ´i‰¡Ÿ¡»q  */

int      combine2(int *ch)
{
	if (*ch > MID_OFF) moeum_process(*ch);
	else jaeum_process(*ch);

	*ch = temp_combine();

	if (streamflag) {		/* Ðe ¢…¸a µÅ¬÷¯¡ */
		streamflag = hgFALSE;
		return(stream);
	}
	return(0);
}

void     jaeum_process(int ch)
{
	int   temp;

					/* º—¬÷·¡ ´ô·i ‰w¶ */
					/* Á¡¬÷, º—¬÷·¡ ´ô·i ‰w¶
					    ·³b–E Ç¡µA Ð”wÐa“e ¸a·q· Å¡—aŸi
					    Á¡¬÷·a¡ ¬a¶w */
	if (firstbuf == EMPTY && midbuf == EMPTY2) firstbuf = ch;
					/* Á¡¬÷·¡ ·¶‰¡ º—¬÷·¡ ´ô·i ‰w¶
					    ‹¡¹¥· Á¡¬÷‰Á ¬¡ ·³b–E Á¡¬÷·¡
					    Ðs¶w–A´á Á¡¬÷ ¥¢¸a·q·i ¬—¬÷Ði ®
					    ·¶·a¡e ¤µi Àq¹¡ Ò Á¡¬÷·a¡ ¬a¶w
					    ´a“¡¡e ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
	else if (firstbuf != EMPTY && midbuf == EMPTY2) {
		if ((temp = bokcho_find(ch)) != NO_CODE) firstbuf = temp;
		else {
			buf2stream();
			firstbuf = ch;
		}
	}
					/* º—¬÷·¡ ·¶·i ‰w¶ */
	else if (midbuf != EMPTY2) {
					/* º—¬÷·¡ ·¶‰¡ ¹·¬÷·¡ ´ô·i ‰w¶
					    Àq¹¡ ¤µi·i É·Ð ´è·e Ðe‹i Å¡—aŸi
					    ¹·¬÷·a¡ ¬a¶w
					    ·³b–E ¸a·q·¡ Á¡¬÷ •¢¶w·¥ '˜A, ¨A, ¼A'
					    ·¡¡e ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
		if (lastbuf == EMPTY) {
			if ((temp = last_by_first(ch)) != NO_CODE) lastbuf = temp;
			else {
				buf2stream();
				firstbuf = ch;
			}
		}
					/* º—¬÷·¡ ·¶‰¡ ¹·¬÷·¡ ·¶·i ‰w¶
					    ‹¡¹¥· ¹·¬÷‰Á ¬¡ ·³b–E ¹·¬÷·¡
					    Ðs¶w–A´á ¹·¬÷ ¥¢¸a·q·i ¬—¬÷Ði ®
					    ·¶·a¡e ¤µi Àq¹¡ Ò ¬—¬÷
					    ´a“¡¡e ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
		else if ((temp = bokjong_find(ch)) != NO_CODE) lastbuf = temp;
		else {
			buf2stream();
			firstbuf = ch;
		}
	}
}

void     moeum_process(int ch)
{
	int   temp;

	ch -= MID_OFF;
					/* ¹·¬÷·¡ ·¶·i ‰w¶
					    ¹·¬÷· ¬wÈµA ˜aœa ”a·q ¢…¸a·
					    Á¡¬÷ ÀáŸ¡Ÿi ¶áÐ ¹·¬÷ ¦…Ÿ¡ Àq¹¡
					    ¤µi·i É·Ð ´è·e Å¡—aŸi µ§¡ Å¡—a
					    µA ¸á¸w
					    Àq¹¡ ¤µi·i É·Ð ´è·e ˆt·¡ ¥¢¸a·q·¡¡e
					    – ·q­¡Ÿi ¦…Ÿ¡Ðaµa ´|· ·q­¡“e ´|
					    ¢…¸a· ¹·¬÷·a¡ –á· ·q­¡“e ”a·q
					    ¢…¸a· Á¡¬÷·a¡ ¬a¶w
					    ´a“¡¡e µ§¡ Å¡—aŸi ”a·q ¢…¸a·
					    Á¡¬÷·a¡ ¬a¶w */
	if (lastbuf != EMPTY) {
		if ((temp = bokjong_del()) != NO_CODE) {
			buf2stream();
			firstbuf = temp;
			midbuf = ch;
		}
		else {
			temp = first_by_last(lastbuf);
			lastbuf = EMPTY;
			buf2stream();
			firstbuf = temp;
			midbuf = ch;
		}
	}
					/* º—¬÷, ¹·¬÷·¡ ´ô·i ‰w¶
					    ·³b–E Ç¡µA Ð”wÐa“e ¡¡·q Å¡—aŸi
					    º—¬÷·a¡ ¬a¶w */
	else if (midbuf == EMPTY2) midbuf = ch;
					/* º—¬÷·¡ ·¶·i ‰w¶
					    ‹¡¹¥· º—¬÷‰Á ¬¡ ·³b–E ¹·¬÷·¡
					    Ðs¶w–A´á º—¬÷ ¥¢¡¡·q·i ¬—¬÷Ði ®
					    ·¶·a¡e ¤µi Àq¹¡ Ò ¬—¬÷
					    ´a“¡¡e ”a·q ¢…¸a· º—¬÷·a¡ ¬a¶w */
	else {
		if ((temp = bokjung_find(ch)) != NO_CODE) midbuf = temp;
		else {
			buf2stream();
			midbuf = ch;
		}
	}
}

int      back_process()
{
	if (is_complete()) return(BS);	/* µw¢…, µÅ¬÷–E Ðe‹i Ðe ·q¸é· ¬b¹A */

	else {				/* Ðe‹i· ·q­¡ ¬b¹A */
		if (lastbuf != EMPTY) {	/* ¹·¬÷ ¬b¹A ÀáŸ¡ */
			if (bokjong_del() == NO_CODE) lastbuf = EMPTY;
		}
					/* º—¬÷ ¬b¹A ÀáŸ¡ */
		else if (midbuf != EMPTY2) {
			if (bokjung_del() == NO_CODE) midbuf = EMPTY2;
		}
					/* Á¡¬÷ ¬b¹A ÀáŸ¡ */
		else if (firstbuf != EMPTY) firstbuf = EMPTY;

		if (is_complete()) return(DEL);
		return(0);
	}
}


/*  ­A¤é¯¢ ·³b ´i‰¡Ÿ¡»q  */

int      combine3(int *ch)
{
	if (*ch < MID_OFF) chosung_process(*ch);
	else if (*ch > MID_OFF && *ch < LAST_OFF) jungsung_process(*ch);
	else if (*ch > LAST_OFF) jongsung_process(*ch);

	*ch = temp_combine();

	if (streamflag) {		/* Ðe ¢…¸a µÅ¬÷¯¡ */
		streamflag = hgFALSE;
		return(stream);
	}
	return(0);
}

void     chosung_process(int ch)
{
	int   temp;

	if (firstbuf == EMPTY && midbuf == EMPTY2) {
					/* Á¡¬÷, º—¬÷, ¹·¬÷·¡ ´ô·i ‰w¶
					    ·³b–E Ç¡µA Ð”wÐa“e ¸a·q· Å¡—aŸi
					    Á¡¬÷·a¡ ¬a¶w */
		if (lastbuf == EMPTY) firstbuf = ch;
					/* Á¡¬÷, º—¬÷·¡ ´ô‰¡ ¹·¬÷·¡ ·¶·i ‰w¶
					    ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
		else {
			buf2stream();
			firstbuf = ch;
		}
	}
					/* º—¬÷·¡a ¹·¬÷·¡ ·¶·i ‰w¶
					    ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
	else if (midbuf != EMPTY2 || lastbuf != EMPTY) {
		buf2stream();
		firstbuf = ch;
	}
					/* Á¡¬÷·¡ ·¶‰¡ º—¬÷, ¹·¬÷·¡ ´ô·i ‰w¶
					    ‹¡¹¥· Á¡¬÷‰Á ¬¡ ·³b–E Á¡¬÷·¡
					    Ðs¶w–A´á Á¡¬÷ ¥¢¸a·q·i ¬—¬÷Ði ®
					    ·¶·a¡e ¤µi Àq¹¡ Ò Á¡¬÷·a¡ ¬a¶w
					    ´a“¡¡e ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
	else if (firstbuf != EMPTY) {
		if ((temp = bokcho_find(ch)) != NO_CODE) firstbuf = temp;
		else {
			buf2stream();
			firstbuf = ch;
		}
	}
}

void     jungsung_process(int ch)
{
	int   temp;

	ch -= MID_OFF;
					/* ¹·¬÷·¡ ·¶·i ‰w¶
					    ”a·q ¢…¸a· º—¬÷·a¡ ¬a¶w */
	if (lastbuf != EMPTY) {
		buf2stream();
		midbuf = ch;
	}
					/* º—¬÷, ¹·¬÷·¡ ´ô·i ‰w¶
					    ·³b–E Ç¡µA Ð”wÐa“e Å¡—aŸi
					    º—¬÷·a¡ ¬a¶w */
	else if (midbuf == EMPTY2) midbuf = ch;
					/* º—¬÷·¡ ·¶‰¡ ¹·¬÷·¡ ´ô·i ‰w¶
					    ‹¡¹¥· º—¬÷‰Á ¬¡ ·³b–E º—¬÷·¡
					    Ðs¶w–A´á º—¬÷ ¥¢¡¡·q·i ¬—¬÷Ði ®
					    ·¶·a¡e ¤µi Àq¹¡ Ò ¬—¬÷
					    ´a“¡¡e ”a·q ¢…¸a· º—¬÷·a¡ ¬a¶w */
	else {
		if ((temp = bokjung_find(ch)) != NO_CODE) midbuf = temp;
		else {
			buf2stream();
			midbuf = ch;
		}
	}
}

void     jongsung_process(int ch)
{
	int   temp, medi;

	ch -= LAST_OFF;
					/* Á¡¬÷·¡ ·¶‰¡ º—¬÷·¡ ´ô·i ‰w¶
					    ·³b–E Ç¡µA Ð”wÐa“e Å¡—aŸi
					    ”a·q ¢…¸a· ¹·¬÷·a¡ ¬a¶w */
	if (midbuf == EMPTY2 && firstbuf != EMPTY) {
		buf2stream();
		lastbuf = ch;
	}
					/* ¹·¬÷·¡ ´ô·i ‰w¶
					    ·³b–E Ç¡µA Ð”wÐa“e Å¡—aŸi ¹·¬÷·a¡
					    ¬a¶w */
	else if (lastbuf == EMPTY) lastbuf = ch;
					/* ¹·¬÷·¡ ·¶·i ‰w¶
					    ‹¡¹¥· ¹·¬÷‰Á ¬¡ ·³b–E ¹·¬÷·¡
					    Ðs¶w–A´á ¹·¬÷ ¥¢¸a·q·i ¬—¬÷Ði ®
					    ·¶·a¡e ¤µi Àq¹¡ Ò ¬—¬÷
					    ´a“¡¡e ”a·q ¢…¸a· Á¡¬÷·a¡ ¬a¶w */
	else {
		medi = ch;
		ch = first_by_last(ch);
		if ((temp = bokjong_find(ch)) != NO_CODE) lastbuf = temp;
		else {
			ch = medi;
			buf2stream();
			lastbuf = ch;
		}
	}
}
