/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : adrol.h -- ROL ÑÁ·©· Š¹¡µA ”Ðe ÑA”á        |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __ADROL_H
#define     __ADROL_H

#ifdef      __cplusplus
extern      "C" {
#endif


#pragma     pack(1)

			/* ©(ROL) ÑÁ·©· ÑA”á· Š¹¡ */
typedef  struct  rolheader {
	int     major, minor;		/* © ÑÁ·©· ÑA”á */
	char    filler1[40];
	int     ticks_in_beat;		/* ¸åµb •A·¡Èa */
	int     beats_in_measure;
	int     axis_y, axis_x;
	char    filler2;
	char    drum_mode;
	byte    filler3[90 + 38 + 15];	/* Àq‰¡ •A·¡Èa */
	float   basic_tempo;		/* ÉQÍ¡ •A·¡Èa */
} RolHeader;

			/* ROL descriptor */
typedef  struct {
	char      fname[40];
	char      outname[40];
	int       handle;
	int       outhandle;
	RolHeader hd;
} RolFile;

typedef  struct  tempoevent {
	int    time;
	float  tempo;
} TempoEvent;

typedef  struct  noteevent {
	int    note;
	int    length;
} NoteEvent;

typedef  struct  timbreevent {
	int    time;
	char   name[9];
	char   filler;
	int    index;
} TimbreEvent;

typedef  struct  volumeevent {
	int    time;
	float  volume;
} VolumeEvent;

typedef  struct  pitchevent {
	int    time;
	float  pitch;
} PitchEvent;

typedef  struct  timbredef {
	char   name[9];
	Timbre timbre;
} TimbreDef;

typedef  struct {
	NoteEvent    *note;
	VolumeEvent  *volume;
	TempoEvent   *tempo;
	TimbreEvent  *timbre;
	PitchEvent   *pitch;
	long   note_seek, vol_seek, tempo_seek, timbre_seek, pitch_seek;
	int    now_time, end_time;
	int    vol_count, tempo_count, timbre_count, pitch_count;
	int    note_ptr, vol_ptr, tempo_ptr, timbre_ptr, pitch_ptr;
} Event;

#pragma     pack()


#ifdef      __cplusplus
}
#endif

#endif
