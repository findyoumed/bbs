/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : adsound.h -- ¬a¶…—aµA ”Ðe ¬w® ¸÷·          |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __ADSOUND_H
#define     __ADSOUND_H

#ifdef      __cplusplus
extern      "C" {
#endif


#define     NR_VOICES    11		/* ¥¡·¡¯a(Àé) ˆ•® */

#define     FILLER_SIZE  15

#define     MAX_STOCK    12
#define     NOTE_STOCK   64

#define     MAX_INSTR    35

			/* ¬aˆå· ¹·ŸA : ¶¬å ®…¶á®… */
#define     EOF_EVENT    0
#define     INSTR_EVENT  1
#define     VOL_EVENT    2
#define     PITCH_EVENT  3
#define     TEMPO_EVENT  4
#define     NOTE_EVENT   5
#define     NR_EVENTS    6

extern   int      adSoundCall(int, ...);

#define     adInitDriver()                 adSoundCall(0)
#define     adDisableDriver()              adSoundCall(1)
#define     adSetStartTime(a, b)           adSoundCall(2, a, b)
#define     adSetPlayState(a)              adSoundCall(3, a)
#define     adGetPlayState()               adSoundCall(4)
#define     adFlushQueue()                 adSoundCall(5)
#define     adSetDrumMode(a)               adSoundCall(6, a)
#define     adGetDrumMode()                adSoundCall(7)
#define     adSetVolume(a, b, c, d)        adSoundCall(8, a, b, c, d)
#define     adSetTempo(a, b, c)            adSoundCall(9, a, b, c)
#define     adSetTranspose(a)              adSoundCall(10, a)
#define     adGetTranspose()               adSoundCall(11)
#define     adSetActiveVoice(a)            adSoundCall(12, a)
#define     adGetActiveVoice()             adSoundCall(13)
#define     adPutNotesDelay(a, b, c, d, e) adSoundCall(14, a, b, c, d, e)
#define     adPutNotes(a, b, c)            adSoundCall(15, a, b, c)
#define     adSetTimbre(a, b, c)           adSoundCall(16, (Timbre far *)a, b, c)
#define     adSetPitch(a, b, c, d, e)      adSoundCall(17, a, b, c, d, e)
#define     adSetTicksPerBeat(a)           adSoundCall(18, a)
#define     adSetDirectNotesOn(a, b)       adSoundCall(19, a, b)
#define     adSetDirectNotesOff(a)         adSoundCall(20, a)
#define     adSetDirectTimbre(a)           adSoundCall(21, (Timbre far *)a)
#define     adSetWaveforms(a)              adSoundCall(23, a)


#ifdef      __cplusplus
}
#endif

#endif
