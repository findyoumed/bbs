/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : rolplay.c  -- ROL ÑÁ·©· ·q´b µeº ¡¡—I       |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <stdlib.h>
#include    <fcntl.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "adbank.h"			/* ¤—Ça ÑÁ·©· Š¹¡µA ”Ðe ÑA”á */

#define     NO_FLOAT_LIBRARY

#ifdef      NO_FLOAT_LIBRARY
#define     float        unsigned long
#endif

#include    "adrol.h"			/* ROL ÑÁ·©· Š¹¡µA ”Ðe ÑA”á */
#include    "adsound.h"			/* ¬a¶…—aµA ”Ðe ¬w® ¸÷· */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MID_C            60		/* ˆaµ¥”a 0 */

#define     ErrNoSDSpace     -1
#define     ErrFileNotFound  -2
#define     ErrReadFile      -3
#define     BankFileNotFound -6
#define     NoErr             0

#define     NOT_ALL_SENT      1
#define     ALL_SENT          0

#define     STILL_PLAYING     1
#define     DONE_PLAYING      0

#define     MELODIC_MODE      notPercusMode
#define     PERCUS_MODE       !notPercusMode

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

typedef  struct  ins_list {
	struct  ins_list  *next;
	char    name[10];
	Timbre  timbre;
} INS_LIST;

int      tickPerBeat;
char     notPercusMode;
int      basicTempo;
int      vol_adjust;
int      active = hgFALSE;
int      current_voice;

RolFile  rol;
INS_LIST *InsListPtr;

BankRec  bankrec;
BankPtr  bankptr = &bankrec;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

Timbre  *adLoadTimbre(char *ins_name);
void     adTurnOnDriver();
void     adTurnOffDriver();
int      adSetUpBank(char *bname, BankPtr bptr);
void     adInitCard();
void     adInitVariable();
void     adSetEnd();
long     float2int(unsigned long f);
int      adSetUpMelody(char *fname, char *bname);
int      adSendTempo(TempoEvent *tEvent);
int      adSendNote(int voice, NoteEvent *nEvent);
int      adSendInstrument(int voice, TimbreEvent *iEvent);
int      adSendVolume(int voice, VolumeEvent *vEvent);
int      adSendPitch(int voice, PitchEvent *pEvent);
void     adAdjustVolume();
int      adSendMelody();


Timbre  *adLoadTimbre(char *ins_name)
{
	INS_LIST  *insptr, *lastptr = NULL;

	int   ret;

	insptr = InsListPtr;
	while (insptr) {
		if (!strcmp(insptr->name, ins_name)) return(&insptr->timbre);
		lastptr = insptr;
		insptr = insptr->next;
	}

	insptr = (INS_LIST *)malloc(sizeof(INS_LIST));
	if (!insptr) return(NULL);

	ret = adReadTimbreDef(ins_name, &insptr->timbre, bankptr);
	if (ret != BANK_OK) return(NULL);

	if (lastptr) lastptr->next = insptr;
	else InsListPtr = insptr;
	insptr->next = NULL;
	strcpy(insptr->name, ins_name);

	return(&insptr->timbre);
}

void     adTurnOnDriver()
{
	adSetPlayState(1);
	active = hgTRUE;
}

void     adTurnOffDriver()
{
	int   i;

	adSetPlayState(0);
	for (i = 0;i < NR_VOICES;i++)
		adSetDirectNotesOff(i);
	active = hgFALSE;
}

int      adSetUpBank(char *bname, BankPtr bptr)
{
	char   fname[128];
	int    ret;

	strcpy(fname, bname);
	if (!(strchr(fname, '.'))) strcat(fname, ".bnk");

	ret = adOpenBank(fname, 0, bptr);
	return(ret);
}

void     adInitCard()
{
	adFlushQueue();
	adInitDriver();
	adSetWaveforms(1);
	adSetTranspose(0);
	adSetDrumMode(1);
}

void     adInitVariable()
{
	InsListPtr = NULL;
	current_voice = -1;
	vol_adjust = 128;
	active = hgFALSE;
}

void     adSetEnd()
{
	INS_LIST  *insptr = InsListPtr, *saveptr;

	while (insptr) {
		saveptr = insptr->next;
		free(insptr);
		insptr = saveptr;
	}

	adCloseBank(bankptr);
	adCloseBuffer();
	close(rol.handle);
}

#ifdef      NO_FLOAT_LIBRARY

long     float2int(unsigned long f)
{
	int   exp, n;
	long  bidon, mantissa;

	memcpy(&bidon, &f, sizeof(float));

	exp = (bidon >> 23) - 127;
	mantissa = (bidon & 0x7fffff) | 0x800000;

	n = (int)(mantissa >> (16 - exp));
	return(n);
}

#endif

int      adSetUpMelody(char *fname, char *bname)
{
	int   ret;

	adInitCard();
	adInitVariable();

	ret = adSetUpBank(bname, bankptr);
	if (ret < 0) return(BankFileNotFound);

	strcpy(rol.fname, fname);
	rol.handle = open(rol.fname, O_RDONLY | O_BINARY);
	if (rol.handle < 0) {
		adCloseBank(bankptr);
		return(ErrFileNotFound);
	}

	if (!adLoadFile(&rol)) return(ErrReadFile);

	tickPerBeat = rol.hd.ticks_in_beat;
	notPercusMode = rol.hd.drum_mode;
	basicTempo = (int)(float2int((unsigned long)rol.hd.basic_tempo) >> 7);

	adSetTicksPerBeat(tickPerBeat);
	adSetStartTime(0, tickPerBeat);
	adSetTempo((int)basicTempo, 0, tickPerBeat);

	ret = (MELODIC_MODE) ? 0 : 1;
	adSetDrumMode(ret);

	return(NoErr);
}

int      adSendTempo(TempoEvent *tEvent)
{
	int   tempo;

#ifdef      NO_FLOAT_LIBRARY
	long   n;

	n = float2int((unsigned long)tEvent->tempo);
	n *= basicTempo;
	tempo = (n >> 7);
#else
	tempo = basicTempo * tEvent->tempo;
#endif

	if (!adSetTempo(tempo, tEvent->time, tickPerBeat))
		return(ErrNoSDSpace);

	if (!tEvent->time && !active) {
		adTurnOnDriver();
		while (adGetPlayState());
		adTurnOffDriver();
		adSetStartTime(0, tickPerBeat);
	}
	return(NoErr);
}

int      adSendNote(int voice, NoteEvent *nEvent)
{
	display_pitch(voice, nEvent->note, MID_C * 2);

	if (nEvent->note == 0) {	/* ®ñÎa */
		if (!adPutNotesDelay(2, 0, tickPerBeat, nEvent->length, tickPerBeat))
			return(ErrNoSDSpace);
	}
	else {
		if (!adPutNotesDelay(nEvent->note - MID_C, nEvent->length, tickPerBeat,
			     nEvent->length, tickPerBeat))
			return(ErrNoSDSpace);
	}
	return(NoErr);
}

int      adSendInstrument(int voice, TimbreEvent *iEvent)
{
	Timbre  *timbre;

	display_timbre(voice, iEvent->name);

	timbre = adLoadTimbre(iEvent->name);
	if (!adSetTimbre(&timbre->op0, iEvent->time, tickPerBeat))
		return(ErrNoSDSpace);
	return(NoErr);
}

int      adSendVolume(int voice, VolumeEvent *vEvent)
{
	int   volume;

			/* 0(min) - 1(max)·i 0 - 100·a¡ ¬é¸÷ */
#ifdef      NO_FLOAT_LIBRARY
	volume = float2int((unsigned long)vEvent->volume);
	volume *= vol_adjust;
	volume /= 128;

	display_volume(voice, volume, 128);

	if (!adSetVolume(volume, 128, vEvent->time, tickPerBeat))
		return(ErrNoSDSpace);
	else return(NoErr);
#else
	volume = (int)(vEvent->volume * (float)100);
	volume *= vol_adjust;
	volume /= 100;

	display_volume(voice, volume, 100);

	if (!adSetVolume(volume, 100, vEvent->time, tickPerBeat))
		return(ErrNoSDSpace);
	else return(NoErr);
#endif
}

int      adSendPitch(int voice, PitchEvent *pEvent)
{
	int   pitch;

	voice &= 0xff;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */

			/* 0(min) - 2(max)·i -100 - 100·a¡ ¬é¸÷ */
#ifdef      NO_FLOAT_LIBRARY
	pitch = float2int((unsigned long)pEvent->pitch);
	pitch *= 100;
	pitch >>= 7;
	pitch -= 100;
#else
	pitch = (pEvent->pitch * 100) - 100;
#endif

	if (!adSetPitch(0, pitch, 100, pEvent->time, tickPerBeat))
		return(ErrNoSDSpace);
	else return(NoErr);
}

void     adAdjustVolume()
{
	VolumeEvent vEvent;

	int   volume;
	int   i;
	int   svoice;

	svoice = adGetActiveVoice();

	for (i = 0;i < NR_VOICES;i++) {

			/* 0(min) - 1(max)·i 0 - 100·a¡ ¬é¸÷ */
#ifdef      NO_FLOAT_LIBRARY
		adGetCurrentVolume(i, &vEvent);
		volume = float2int((unsigned long)vEvent.volume);
		volume *= vol_adjust;
		volume /= 128;

		display_volume(i, volume, 128);

		adSetActiveVoice(i);
		while (!adSetVolume(volume, 128, 0, tickPerBeat));
#else
		adGetCurrentVolume(i, &vEvent);
		volume = (int)(vEvent.volume * (float)100);
		volume *= vol_adjust;
		volume /= 100;

		display_volume(i, volume, 100);

		asSetActiveVoice(i);
		while (!adSetVolume(volume, 100, 0, tickPerBeat));
#endif
	}
	adSetActiveVoice(svoice);
}

int      adSendMelody()
{
	void  *buffer;
	int   evnt, voice, ret;

	evnt = adFindNextEvent(&voice, &buffer);
	ret = NoErr;

	if (PERCUS_MODE || voice <= 8) {
		if (voice != current_voice) {
			current_voice = voice;
			adSetActiveVoice(current_voice);
		}

		if (buffer) {
			switch (evnt) {
				case TEMPO_EVENT :
					ret = adSendTempo((TempoEvent *)buffer);
					break;
				case NOTE_EVENT :
					ret = adSendNote(voice, (NoteEvent *)buffer);
					break;
				case INSTR_EVENT :
					ret = adSendInstrument(voice, (TimbreEvent *)buffer);
					break;
				case VOL_EVENT :
					ret = adSendVolume(voice, (VolumeEvent *)buffer);
					break;
				case PITCH_EVENT :
					ret = adSendPitch(voice, (PitchEvent *)buffer);
					break;
				case EOF_EVENT :
					ret = NoErr;
					break;
			}
		}
	}

	if (ret != NoErr) adUndoEvent(evnt, voice);

	if (!active) adTurnOnDriver();

	if (evnt == EOF_EVENT) return(ALL_SENT);
	else return(NOT_ALL_SENT);
}

