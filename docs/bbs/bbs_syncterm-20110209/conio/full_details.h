#ifndef _FULL_DETAILS_H_
#define _FULL_DETAILS_H_

#include <utypes.h>	// UChar32

struct full_details {
	UChar32		codepoint;	// Unicode codepoint (Uses ICS)
	uint32_t	flags;		// Character flags (See below)
	uint32_t	fg;			// Forground colour 32-bit with alpha (RRGGBBAA)
	uint32_t	bg;			// Background colour 24-bit (RRGGBB)
	uint32_t	font;		// Source font (if fonts are mappable, UINT32_MAX otherwise)
};

// Flags:
#define CONIO_FDFLAG_BOLD					(1<<0)
#define CONIO_FDFLAG_FAINT					(1<<1)
#define CONIO_FDFLAG_ITALIC					(1<<2)
#define CONIO_FDFLAG_SINGLE_UNDERLINE		(1<<3)
#define CONIO_FDFLAG_SLOW_BLINK				(1<<4)
#define CONIO_FDFLAG_FAST_BLINK				(1<<5)
#define CONIO_FDFLAG_NEGATIVE				(1<<6)
#define CONIO_FDFLAG_CONCEALED				(1<<7)
#define CONIO_FDFLAG_CROSSED_OUT			(1<<8)
#define CONIO_FDFLAG_DOUBLE_UNDERLINE		(1<<9)
#define CONIO_FDFLAG_FRAMED					(1<<10)
#define CONIO_FDFLAG_ENCIRCLED				(1<<11)
#define CONIO_FDFLAG_OVERLINED				(1<<12)
#define CONIO_FDFLAG_RIGHT_SIDELINE			(1<<13)
#define CONIO_FDFLAG_DOUBLE_RIGHT_SIDELINE	(1<<14)
#define CONIO_FDFLAG_LEFT_SIDELINE			(1<<15)
#define CONIO_FDFLAG_DOUBLE_LEFT_SIDELINE	(1<<16)
#define CONIO_FDFLAG_STRESS					(1<<17)

#endif
