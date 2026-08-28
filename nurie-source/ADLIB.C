/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : adlib.c  -- ´—aŸ³ Äa—a ¹A´á ¡¡—I             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <dos.h>
#include    <mem.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     SOUND_DRIVER_INT   0x65	/* ¬a¶…—a —aœa·¡¤á ·¥ÈáœóËa ¤åÑ¡ */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

static   char     adlib[] = { "SOUND-DRIVER-AD-LIB" };

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      adGetSoundVersion();
int      adSoundCall(int fn_num, int stack);
int      adIsSoundInstalled();


int      adGetSoundVersion()
{
	char   far  * far *int_ptr;
	char   far  *sig_ptr;
	char   str[30];
	int    i;
	int    version = 0;

	int_ptr = (char (far * far *))404;	/* ¬a¶…—a —aœa·¡¤á ·¥ÈáœóËa * 4 */
	sig_ptr = *int_ptr;
	sig_ptr -= (sizeof(adlib) + 4);

	for (i = 0;i < strlen(adlib) + 2;i++) str[i] = sig_ptr[i];

	if (!memcmp(adlib, &str[2], strlen(adlib)))
		memcpy(&version, str, sizeof(int));

	return(version);
}

int      adSoundCall(int fn_num, int stack)
{
	union   REGS  r;
	struct  SREGS s;

	int    ret;
	char   far  *c = (char *)&stack;

	r.x.si = fn_num;
	r.x.bx = FP_OFF(c);
	s.es = FP_SEG(c);

	ret = int86x(SOUND_DRIVER_INT, &r, &r, &s);
	return(ret);
}

int      adIsSoundInstalled()
{
	if (!adGetSoundVersion()) return(hgFALSE);
	else return(hgTRUE);
}
