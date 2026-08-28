/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : rolread.c  -- ROL ÑÁ·©· ·q´b ·ª‹¡ ¡¡—I       |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <io.h>
#include    <stdlib.h>
#include    <mem.h>

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
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

RolFile  rolfile;			/* ROL file descriptor */
Event    events[NR_VOICES];		/* 11ˆ ¥¡·¡¯a(Àé)¥i ·¡¥EËa */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      adReadRolHeader(RolFile *rol);
int      adLoadTempo(Event *event, int handle, long *offset);
int      adLoadNotes(int handle, Event *event, long *offset, int voice);
int      adLoadInstr(int handle, Event *event, long *offset);
int      adLoadVolume(int handle, Event *event, long *offset);
int      adLoadPitch(int handle, Event *event, long *offset);
int      adLoadFile(RolFile *rol);

void     adCloseBuffer();
int      adFillNoteBuffer(Event *event, int handle, int voice);
int      adFillTempoBuffer(Event *event, int handle);
int      adFillInstrBuffer(Event *event, int handle);
int      adFillVolumeBuffer(Event *event, int handle);
int      adFillPitchBuffer(Event *event, int handle);

void    *adGetNoteEvent(Event *event, int voice);
void     adUndoNoteEvent(Event *event);
void    *adGetTempoEvent(Event *event, int voice);
void     adUndoTempoEvent(Event *event);
void    *adGetInstrEvent(Event *event, int voice);
void     adUndoInstrEvent(Event *event);
void    *adGetVolumeEvent(Event *event, int voice);
void     adUndoVolumeEvent(Event *event);
void    *adGetPitchEvent(Event *event, int voice);
void     adUndoPitchEvent(Event *event);

void     adGetCurrentVolume(int voice, VolumeEvent *vEvent);

int      adVoiceEventSearch(int voice, int *soonest);
int      adNextEventSearch(int *voice);
int      adFindNextEvent(int *voice, void **buffer);
void     adUndoEvent(int evnt, int voice);


int      adReadRolHeader(RolFile *rol)
{
	int   size;

	size = read(rol->handle, (char *)&rol->hd, sizeof(RolHeader));
	if (size != sizeof(RolHeader)) return(hgFAIL);
	else return(hgSUCCESS);
}

int      adLoadTempo(Event *event, int handle, long *offset)
{
	Event  *eptr = &event[0];

	int    size;
	int    i;

	lseek(handle, *offset, SEEK_SET);
	size = read(handle, (char *)&eptr->tempo_count, sizeof(int));
	*offset += (long)sizeof(int);
	if (size != sizeof(int)) return(hgFAIL);

	eptr->tempo_seek = *offset;

	if (eptr->tempo_count > 0) {
		i = (eptr->tempo_count <= MAX_STOCK) ? eptr->tempo_count : MAX_STOCK;
		eptr->tempo = (TempoEvent *)malloc(i * sizeof(TempoEvent));

		if (!adFillTempoBuffer(eptr, handle)) return(hgFAIL);

		for (i = 1;i < NR_VOICES;i++) {
			event[i].tempo = eptr->tempo;
			event[i].tempo_count = 0;
			event[i].tempo_seek = eptr->tempo_seek;
			event[i].tempo_ptr = 0;
		}
		*offset += (long)(eptr->tempo_count * sizeof(TempoEvent));
	}
	else *offset += 6;

	lseek(handle, *offset, SEEK_SET);
	return(hgSUCCESS);
}

int      adLoadNotes(int handle, Event *event, long *offset, int voice)
{
	Event  event2;

	int   size;
	int   time;
	int   i;
	char  buffer[NOTE_STOCK * sizeof(NoteEvent)];

	size = read(handle, (char *)&event->end_time, sizeof(int));
	*offset += (long)sizeof(int);
	if (size != sizeof(int)) return(hgFAIL);

	event->now_time = 0;
	event->note_seek = *offset;
	event->note = (NoteEvent *)malloc(NOTE_STOCK * sizeof(NoteEvent));

	if (!adFillNoteBuffer(event, handle, voice)) return(hgFAIL);

	memcpy(&event2, event, sizeof(Event));
	event2.note = (NoteEvent *)buffer;
	memcpy(event2.note, event->note, NOTE_STOCK * sizeof(NoteEvent));

	time = 0;
	do {
		for (i = 0;time < event->end_time && i < NOTE_STOCK;i++)
			time += event2.note[i].length;
		*offset += (long)(i * sizeof(NoteEvent));

		if (time < event2.end_time)
			if (!adFillNoteBuffer(&event2, handle, voice)) return(hgFAIL);
	} while (time < event2.end_time);

	*offset += (long)FILLER_SIZE;

	lseek(handle, *offset, SEEK_SET);
	return(hgSUCCESS);
}

int      adLoadInstr(int handle, Event *event, long *offset)
{
	int   size;
	int   i;

	size = read(handle, (char *)&event->timbre_count, sizeof(int));
	*offset += (long)sizeof(int);
	if (size != sizeof(int)) return(hgFAIL);

	event->timbre_seek = *offset;

	i = (event->timbre_count <= MAX_STOCK) ? event->timbre_count : MAX_STOCK;
	event->timbre = (TimbreEvent *)malloc(i * sizeof(TimbreEvent));

	if (!adFillInstrBuffer(event, handle)) return(hgFAIL);

	*offset += (long)(FILLER_SIZE + event->timbre_count * sizeof(TimbreEvent));

	lseek(handle, *offset, SEEK_SET);
	return(hgSUCCESS);
}

int      adLoadVolume(int handle, Event *event, long *offset)
{
	int   size;
	int   i;

	size = read(handle, (char *)&event->vol_count, sizeof(int));
	*offset += (long)sizeof(int);
	if (size != sizeof(int)) return(hgFAIL);

	event->vol_seek = *offset;

	i = (event->vol_count <= MAX_STOCK) ? event->vol_count : MAX_STOCK;
	event->volume = (VolumeEvent *)malloc(i * sizeof(VolumeEvent));

	if (!adFillVolumeBuffer(event, handle)) return(hgFAIL);

	*offset += (long)(FILLER_SIZE + event->vol_count * sizeof(VolumeEvent));

	lseek(handle, *offset, SEEK_SET);
	return(hgSUCCESS);
}

int      adLoadPitch(int handle, Event *event, long *offset)
{
	int   size;
	int   i;

	size = read(handle, (char *)&event->pitch_count, sizeof(int));
	*offset += (long)sizeof(int);
	if (size != sizeof(int)) return(hgFAIL);

	event->pitch_seek = *offset;
	i = (event->pitch_count <= MAX_STOCK) ? event->pitch_count : MAX_STOCK;
	event->pitch = (PitchEvent *)malloc(i * sizeof(PitchEvent));

	if (!adFillPitchBuffer(event, handle)) return(hgFAIL);

	*offset += (long)(FILLER_SIZE + event->pitch_count * sizeof(PitchEvent));

	lseek(handle, *offset, SEEK_SET);
	return(hgSUCCESS);
}

int      adLoadFile(RolFile *rol)
{
	int   i;
	long  offset;

	memcpy(&rolfile, rol, sizeof(RolFile));

	if (!adReadRolHeader(rol)) return(hgFAIL);

	offset = (long)sizeof(RolHeader);

	if (!adLoadTempo(events, rol->handle, &offset)) return(hgFAIL);

	offset += (long)FILLER_SIZE;
	if (lseek(rol->handle, offset, SEEK_SET) == -1L) return(hgFAIL);

	for (i = 0;i < NR_VOICES;i++) {
		if (!adLoadNotes(rol->handle, &events[i], &offset, i)) return(hgFAIL);
		if (!adLoadInstr(rol->handle, &events[i], &offset)) return(hgFAIL);
		if (!adLoadVolume(rol->handle, &events[i], &offset)) return(hgFAIL);
		if (!adLoadPitch(rol->handle, &events[i], &offset)) return(hgFAIL);
	}
	return(hgSUCCESS);
}

void     adCloseBuffer()
{
	int   i;

	free(events[0].tempo);

	for (i = 0;i < NR_VOICES;i++) {
		free(events[i].note);
		free(events[i].timbre);
		free(events[i].volume);
		free(events[i].pitch);
	}
}

int      adFillNoteBuffer(Event *event, int handle, int voice)
{
	NoteEvent  *nptr = event->note;

	int   rdsize, size;

	voice &= 0xff;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	rdsize = NOTE_STOCK * sizeof(NoteEvent);

	lseek(handle, event->note_seek, SEEK_SET);
	size = read(handle, (char *)nptr, rdsize);
	if (size < 0) return(hgFAIL);

	event->note_seek += (long)rdsize;
	event->note_ptr = 0;
	return(hgSUCCESS);
}

int      adFillTempoBuffer(Event *event, int handle)
{
	int   rdsize, size;

	rdsize = (event->tempo_count <= MAX_STOCK) ? event->tempo_count : MAX_STOCK;
	rdsize *= sizeof(TempoEvent);

	lseek(handle, event->tempo_seek, SEEK_SET);
	size = read(handle, (char *)event->tempo, rdsize);
	if (size != rdsize) return(hgFAIL);

	event->tempo_seek += (long)rdsize;
	event->tempo_ptr = 0;
	return(hgSUCCESS);
}

int      adFillInstrBuffer(Event *event, int handle)
{
	int   rdsize, size;

	rdsize = (event->timbre_count <= MAX_STOCK) ? event->timbre_count : MAX_STOCK;
	rdsize *= sizeof(TimbreEvent);

	lseek(handle, event->timbre_seek, SEEK_SET);
	size = read(handle, (char *)event->timbre, rdsize);
	if (size != rdsize) return(hgFAIL);

	event->timbre_seek += (long)rdsize;
	event->timbre_ptr = 0;
	return(hgSUCCESS);
}

int      adFillVolumeBuffer(Event *event, int handle)
{
	int   rdsize, size;

	rdsize = (event->vol_count <= MAX_STOCK) ? event->vol_count : MAX_STOCK;
	rdsize *= sizeof(VolumeEvent);

	lseek(handle, event->vol_seek, SEEK_SET);
	size = read(handle, (char *)event->volume, rdsize);
	if (size != rdsize) return(hgFAIL);

	event->vol_seek += (long)rdsize;
	event->vol_ptr = 0;
	return(hgSUCCESS);
}

int      adFillPitchBuffer(Event *event, int handle)
{
	int   rdsize, size;

	rdsize = (event->pitch_count <= MAX_STOCK) ? event->pitch_count : MAX_STOCK;
	rdsize *= sizeof(PitchEvent);

	lseek(handle, event->pitch_seek, SEEK_SET);
	size = read(handle, (char *)event->pitch, rdsize);
	if (size != rdsize) return(hgFAIL);

	event->pitch_seek += (long)rdsize;
	event->pitch_ptr = 0;
	return(hgSUCCESS);
}

void    *adGetNoteEvent(Event *event, int voice)
{
	int   pos;

	if (event->note_ptr >= NOTE_STOCK)
		if (!adFillNoteBuffer(event, rolfile.handle, voice)) return(NULL);

	pos = event->note_ptr;
	event->note_ptr++;
	event->now_time += event->note[pos].length;
	return((char *)&event->note[pos]);
}

void     adUndoNoteEvent(Event *event)
{
	event->note_ptr--;
	event->now_time -= event->note[event->note_ptr].length;
}

void    *adGetTempoEvent(Event *event, int voice)
{
	int   pos;

	voice &= 0xff;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	if (event->tempo_ptr >= MAX_STOCK)
		if (!adFillTempoBuffer(event, rolfile.handle)) return(NULL);

	pos = event->tempo_ptr;
	event->tempo_ptr++;
	event->tempo_count--;
	return((char *)&event->tempo[pos]);
}

void     adUndoTempoEvent(Event *event)
{
	event->tempo_ptr--;
	event->tempo_count++;
}

void    *adGetInstrEvent(Event *event, int voice)
{
	int   pos;

	voice &= 0xff;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	if (event->timbre_ptr >= MAX_STOCK)
		if (!adFillInstrBuffer(event, rolfile.handle)) return(NULL);

	pos = event->timbre_ptr;
	event->timbre_ptr++;
	event->timbre_count--;
	return((char *)&event->timbre[pos]);
}

void     adUndoInstrEvent(Event *event)
{
	event->timbre_ptr--;
	event->timbre_count++;
}

void    *adGetVolumeEvent(Event *event, int voice)
{
	int   pos;

	voice &= 0xff;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	if (event->vol_ptr >= MAX_STOCK)
		if (!adFillVolumeBuffer(event, rolfile.handle)) return(NULL);

	pos = event->vol_ptr;
	event->vol_ptr++;
	event->vol_count--;
	return((char *)&event->volume[pos]);
}

void     adUndoVolumeEvent(Event *event)
{
	event->vol_ptr--;
	event->vol_count++;
}

void    *adGetPitchEvent(Event *event, int voice)
{
	int   pos;

	voice &= 0xff;			/* warning ¡A­A»¡Ÿi ´ô´‹¡ ¶áÐ */
	if (event->pitch_ptr >= MAX_STOCK)
		if (!adFillPitchBuffer(event, rolfile.handle)) return(NULL);

	pos = event->pitch_ptr;
	event->pitch_ptr++;
	event->pitch_count--;
	return((char *)&event->pitch[pos]);
}

void     adUndoPitchEvent(Event *event)
{
	event->pitch_ptr--;
	event->pitch_count++;
}

void     adGetCurrentVolume(int voice, VolumeEvent *vEvent)
{
	Event *eptr;

	eptr = &events[voice];
	memcpy(vEvent, &eptr->volume[eptr->vol_ptr], sizeof(VolumeEvent));
}

int      adVoiceEventSearch(int voice, int *soonest)
{
	Event  *eptr = &events[voice];

	int   i, evnt;
	int   times[NR_EVENTS];

	for (i = 0;i < NR_EVENTS;i++) times[i] = -1;

	times[EOF_EVENT] = -1;
	if (eptr->now_time < eptr->end_time)
		times[NOTE_EVENT] = eptr->now_time;
	if (eptr->tempo_count)
		times[TEMPO_EVENT] = eptr->tempo[eptr->tempo_ptr].time;
	if (eptr->timbre_count)
		times[INSTR_EVENT] = eptr->timbre[eptr->timbre_ptr].time;
	if (eptr->vol_count)
		times[VOL_EVENT] = eptr->volume[eptr->vol_ptr].time;
	if (eptr->pitch_count)
		times[PITCH_EVENT] = eptr->pitch[eptr->pitch_ptr].time;

	for (evnt = 0, i = 1;i < NR_EVENTS;i++)
		if (times[i] >= 0)
			if (times[evnt] < 0 || times[i] < times[evnt]) evnt = i;

	*soonest = times[evnt];
	return(evnt);
}

int      adNextEventSearch(int *voice)
{
	int   i, j;
	int   evnt[NR_VOICES];
	int   times[NR_VOICES];
	long  ptimes[NR_VOICES];

	for (i = 0;i < NR_VOICES;i++)
		evnt[i] = adVoiceEventSearch(i, &times[i]);

	for (j = 0, i = 1;i < NR_VOICES;i++)
		if (times[i] >= 0)
			if (times[j] < 0 || times[i] < times[j]) j = i;

	for (i = 0;i < NR_VOICES;i++)
		if (times[i] > times[j]) times[i] = -1;

	for (i = 0;i < NR_VOICES;i++) {
		if (times[i] < 0) ptimes[i] = -1L;
		else ptimes[i] = (times[i] + 1) * evnt[i];
	}

	for (*voice = 0, i = 1;i < NR_VOICES;i++)
		if (ptimes[i] >= 0)
			if (ptimes[*voice] < 0 || ptimes[i] < ptimes[*voice]) *voice = i;

	return(evnt[*voice]);
}

int      adFindNextEvent(int *voice, void **buffer)
{
	Event  *eptr;

	int    next_evnt;

	next_evnt = adNextEventSearch(voice);
	eptr = &events[*voice];

	switch (next_evnt) {
		case NOTE_EVENT :
			*buffer = adGetNoteEvent(eptr, *voice);
			break;
		case TEMPO_EVENT :
			*buffer = adGetTempoEvent(eptr, *voice);
			break;
		case INSTR_EVENT :
			*buffer = adGetInstrEvent(eptr, *voice);
			break;
		case VOL_EVENT :
			*buffer = adGetVolumeEvent(eptr, *voice);
			break;
		case PITCH_EVENT :
			*buffer = adGetPitchEvent(eptr, *voice);
			break;
		case EOF_EVENT :
			break;
	}
	return(next_evnt);
}

void     adUndoEvent(int evnt, int voice)
{
	Event  *eptr = &events[voice];

	switch (evnt) {
		case NOTE_EVENT :
			adUndoNoteEvent(eptr);
			break;
		case TEMPO_EVENT :
			adUndoTempoEvent(eptr);
			break;
		case INSTR_EVENT :
			adUndoInstrEvent(eptr);
			break;
		case VOL_EVENT :
			adUndoVolumeEvent(eptr);
			break;
		case PITCH_EVENT :
			adUndoPitchEvent(eptr);
			break;
		case EOF_EVENT :
			break;
	}
}
