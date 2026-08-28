/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : editor.c  -- ¢…¬á Íe»³‹¡ ¡¡—I                 |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <ctype.h>
#include    <mem.h>
#include    <string.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MAXCHAR     65000

#define     MAXEDITKEY  28		/* ÂA” ‹¡“wÇ¡· ˆ•® */

#define     NO           0
#define     YES          1
#define     NOT_ASK      2

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char    *edBuff;			/* Íe»³¶w ¡A¡¡Ÿ¡ */
char    *start_mem;			/* Íe»³¶w ¡A¡¡Ÿ¡· ¯¡¸b‰Á { */
char    *end_mem;
char    *b_b_ptr;			/* §iœâ· ¯¡¸b‰Á { */
char    *b_k_ptr;
char    *current;			/* Íe»³¶w ¡A¡¡Ÿ¡µA¬á· Ñe¸ ¶áÃ¡ */
char    *line_start;			/* Ñe¸ Íe»³º—·¥ º‰· ¯¡¸b ¶áÃ¡ */
char    *last_pos;

char     line_buff[161];

char     edMode = hgFALSE;		/* ¢…¬á Íe»³‹¡ µa¦ */
char     indentflag = hgTRUE;		/* Indentation µa¦ */
extern   char     ins_flag;		/* ¬s·³ ¡¡—a */
extern   char     mode;

char     blockflag;			/* §iœâ· ÑÁ¡e Â‰b µa¦ */
unsigned block_size;			/* §iœâ· Ça‹¡ */

unsigned max_line;			/* Íe»³–A“e ÑÁ·©· ÑÁ¡e¬w ÂA” º‰ ® */
unsigned cur_ptr;
unsigned Basex, Basey;			/* ÑÁ¡e¬w·  … ¶E½¢, ¶õ½¢· ¸é” ¹ÁÎa */
int      Curx, Cury;			/* ÑÁ¡eµA¬á· Äá¬á· ¬w” ¹ÁÎa */
int      edx1, edy1, edx2, edy2;
int      edrow;				/* Ðe ÑÁ¡e· Â‰b º‰ ® */
int      edcol;				/* Ðeº‰· Â‰b ¢…¸a® */
char     edTF, edTB;

char     savedflag = hgTRUE;		/* ¸á¸w µa¦(¸á¸w•ö·q) */

extern   char     work_file[];

unsigned edScreenjob = 0x8000;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      edSetInit();
void     edInitVariable();
void     edSetEnd();

void     edbs_process(), eddel_process();
void     edhome_process(), edend_process();
void     edleft_process(), edright_process();
void     edwordlt_process(), edwordrt_process();
void     edup_process(), eddown_process();
void     edpgup_process(), edpgdn_process();
void     edctrlup_process(), edctrldn_process();
void     edctrlhome_process(), edctrlend_process();
void     edctrly_process(), edctrlt_process();
void     edctrlk_process(), edctrlq_process();
void     edctrll_process();
void     edctrlb_process();
void     edreturn_process();
void     edindent_toggle();
void     edins_process(), edhan2eng_process();
void     edgtype_process(), edgraphin_process();
void     edhanjain_process();
void     edeng_process(int key);
void     edhan_process(int key);
int      edKeyProcess(int key);

void     up_down(int n);
void     to_pointer(char *ptr);
void     vert_locate(unsigned line_no, char *ptr);
void     horz_locate(unsigned pos);

int      delete(int n);
int      insert(int n, char ch);

int      is_han(char *ptr);
int      is_eol(char *ptr);
int      is_eof(char *ptr);
int      in_word(char *ptr);

void     ins_return();
void     restore_line();
unsigned line_len(char *ptr);
unsigned line_num(char *src, char *dest);
size_t   blockline_num(char *src, char *dest);
unsigned pre_char(unsigned pos, unsigned *newpos);
char    *pre_line(char *ptr, int n);
char    *next_line(char *ptr, int n);

void     edScreenChange();
void     ednew_char();
void     edput_space();
void     edupdate_line(int n);
void     ednew_downline(int n);
char    *ednew_line(int x, int y, char *str);
void     ednew_page();

void     edSetForeColor(char color);
void     edSetBackColor(char color);
char     edGetForeColor();
char     edGetBackColor();
int      edCursor();
void     edClearScreen();

extern   void     ins_status();


int      edKeys[MAXEDITKEY] = {
	BS, DEL, HOME, END, LEFT, RIGHT, CTRL_LEFT, CTRL_RIGHT, UP, DOWN,
	PgUp, PgDn, CTRL_PgUp, CTRL_PgDn, CTRL_HOME, CTRL_END,
	CTRL_Y, CTRL_T, CTRL_K, CTRL_Q, CTRL_L, CTRL_B,
        RETURN, INS, SHIFT_SPC,	F3, F4, F9
};

void   (*edKeyfunc[MAXEDITKEY])() = {
	edbs_process, eddel_process, edhome_process, edend_process,
	edleft_process, edright_process, edwordlt_process, edwordrt_process,
	edup_process, eddown_process, edpgup_process, edpgdn_process,
	edctrlup_process, edctrldn_process, edctrlhome_process, edctrlend_process,
	edctrly_process, edctrlt_process, edctrlk_process, edctrlq_process,
	edctrll_process, edctrlb_process, edreturn_process, edins_process,
	edhan2eng_process, edgtype_process, edgraphin_process, edhanjain_process
};


int      edSetInit()
{
	edBuff = malloc(0xffff);
	if (edBuff == NULL) {
		MEM_error();
		return(hgFAIL);
	}

	edInitVariable();
	edMode = hgTRUE;

	edx1 = hgGetx1r() + (7 - (hgGetx1r() + 7) % 8);
	edy1 = hgGety1r() + (15 - (hgGety1r() + 15) % 16);
	edx2 = hgGetx2r() - (hgGetx2r() + 1) % 8;
	edy2 = hgGety2r() - (hgGety2r() + 1) % 16;
	edcol = ((edx2 - edx1) >> 3) + 1;
	edrow = ((edy2 - edy1) >> 4) + 1;

	hgSetInsInternal(&ins_status);
	return(hgSUCCESS);
}

void     edInitVariable()
{
	strcpy(work_file, "NONAME.NRE");

	current = line_start = last_pos = edBuff;
	b_b_ptr = b_k_ptr = start_mem = end_mem = edBuff;
	*start_mem = *line_buff = 0;
	max_line = cur_ptr = Basey = Basex = 0;
	Curx = Cury = block_size = 0;

	savedflag = blockflag = hgTRUE;

	init_code();
}

void     edSetEnd()
{
	edMode = hgFALSE;

	hgResetInsInternal();
	if (edBuff != NULL) free(edBuff);
}

void     edbs_process()
{
	int   tch;

	tch = back_process();

	if (tch == BS) {		/* µw¢…, µÅ¬÷–E Ðe‹i ¬b¹A¯¡ */
		if (current != start_mem) {
			edleft_process();
					/* Äá¬áˆa ¶õº‰· {·a¡ ˆi ˜ */
			if (edScreenjob) edScreenChange();
			if (ins_flag) eddel_process();
		}
		else beep();
	}
	else if (tch == DEL) eddel_process();
	else {				/* Ðe‹i· ·q­¡ ¬b¹A¯¡ */
		tch = temp_combine();
		*current = (tch >> 8);
		*(current + 1) = tch;
		edScreenjob |= 0x2000;	/* Ðe ¢…¸a ®¸÷ */
	}
}

void     eddel_process()
{
	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
		if (edScreenjob) edScreenChange();
	}

	if (is_eol(current)) {		/* Ñe¸ º‰·i Äá¬á ·¡Ò ¬¡ Â‰b
					   Äá¬á 2¤å¼ ´aœµA¬á ¯aÇa©´ó
					    … £»º‰·i Â‰b */
		if (delete(2)) edScreenjob |= 0x1140;
	}
	else {
		if (is_han(current)) delete(2);
		else delete(1);
	}
}

void     edhome_process()
{
	if (!is_complete()) init_code();

	cur_ptr = 0;
	horz_locate(0);
}

void     edend_process()
{
	if (!is_complete()) init_code();

	cur_ptr = line_len(line_start);
	horz_locate(cur_ptr);
}

void      edleft_process()
{
	unsigned  tpos, newpos;

	if (start_mem < current) {
		if (!is_complete()) init_code();

		if (current == line_start) to_pointer(current - 2);
		else {
			tpos = pre_char(Basex + Curx, &newpos);
			cur_ptr = Basex + Curx - tpos;
			horz_locate(cur_ptr);
		}
	}
}

void     edright_process()
{
	if (!is_eof(current)) {
		if (!is_complete()) {
			init_code();
			if (current < end_mem) {
				cur_ptr = Basex + Curx + 2;
				horz_locate(cur_ptr);
			}
		}
		else {
			if (is_eol(current)) to_pointer(current + 2);
			else {
				if (is_han(current)) {
					if (current < end_mem) {
						cur_ptr = Basex + Curx + 2;
						horz_locate(cur_ptr);
					}
				}
				else {
					cur_ptr = Basex + Curx + 1;
					horz_locate(cur_ptr);
				}
			}
		}
	}
}

void     edwordlt_process()
{
	char   *ptr = current;

	if (!is_complete()) init_code();

	while (start_mem < ptr && !in_word(ptr - 1)) --ptr;
	while (start_mem < ptr && in_word(ptr - 1)) --ptr;
	to_pointer(ptr);
}

void     edwordrt_process()
{
	char   *ptr = current;

	if (!is_complete()) init_code();

	while (!is_eof(ptr) && in_word(ptr)) ++ptr;
	while (!is_eof(ptr) && !in_word(ptr)) ++ptr;
	to_pointer(ptr);
}

void     edup_process()
{
	if (!is_complete()) init_code();

	up_down(-1);
}

void     eddown_process()
{
	if (!is_complete()) init_code();

	up_down(1);
}

void     edpgup_process()
{
	if (!is_complete()) init_code();

	up_down(1 - edrow);
}

void     edpgdn_process()
{
	if (!is_complete()) init_code();

	up_down(edrow - 1);
}

void     edctrlup_process()
{
	if (!is_complete()) init_code();

	to_pointer(start_mem);
}

void     edctrldn_process()
{
	if (!is_complete()) init_code();

	to_pointer(end_mem);
}

void     edctrlhome_process()
{
	if (!is_complete()) init_code();

	up_down(-Cury);
}

void     edctrlend_process()
{
	if (!is_complete()) init_code();

	up_down(edrow - Cury - 2);
}

void     edctrly_process()
{
	if (!is_complete()) init_code();

	cur_ptr = 0;
	horz_locate(0);
	if (edScreenjob) edScreenChange();

	if (Basey + Cury == max_line) delete(line_len(current));
					/* Äá¬á 1¤å¼ ´aœµA¬á ¯aÇa©´ó
					     … £»º‰·i Â‰b */
	else  if (delete(line_len(current) + 2)) edScreenjob |= 0x0120;
}

void     edctrlt_process()
{
	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
		if (edScreenjob) edScreenChange();
	}

	if (Basey + Cury == max_line) delete(line_len(current));
					/* Ñe¸ º‰·i Äá¬á ·¡Ò ¬¡ Â‰b
					    Äá¬á 2¤å¼ ´aœµA¬á ¯aÇa©´ó
					     … £»º‰·i Â‰b */
	else if (delete(line_len(current) + 2)) edScreenjob |= 0x1140;
}

void     edctrlk_process()
{
	char   *text[] = {
		"   ^K   ", ""
	};
	char   kcmd;

	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	hgSetSaveOn();
	hgPrtBoxXy(edx1, edy1, edx1 + 80, edy1 + 20, text);
	hgEngInModeOn();
	kcmd = (inkey(WAIT) & 0x1f) + '@';
	hgEngInModeOff();
	hgRestore();
	hgSetSaveOff();

	switch (kcmd) {
		case 'B' :
			block_decision(&b_b_ptr);
			break;
		case 'K' :
			block_decision(&b_k_ptr);
			break;
		case 'R' :
			block_read();
			break;
		case 'W' :
			block_write();
			break;
		case 'H' :
			block_disp_hide();
			break;
		case 'Y' :
			block_delete();
			break;
		case 'V' :
			block_move();
			break;
		case 'C' :
			block_copy();
			break;
		default :
			break;
	}
}

void     edctrlq_process()
{
	char   *text[] = {
		"   ^Q   ", ""
	};
	char   qcmd;

	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	hgSetSaveOn();
	hgPrtBoxXy(edx1, edy1, edx1 + 80, edy1 + 20, text);
	hgEngInModeOn();
	qcmd = (inkey(WAIT) & 0x1f) + '@';
	hgEngInModeOff();
	hgRestore();
	hgSetSaveOff();

	switch (qcmd) {
		case 'I' :
			edindent_toggle();
			break;
		case 'B' :
			to_pointer(b_b_ptr);
			break;
		case 'K' :
			to_pointer(b_k_ptr);
			break;
		case 'F' :
			finder(NO);
			break;
		case 'A' :
			finder(YES);
			break;
		case 'Y' :
			if (edScreenjob) edScreenChange();
			delete(line_len(current));
			break;
		default :
			break;
	}
}

void     edctrll_process()
{
	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	find_string();
}

void     edctrlb_process()
{
	char   *text[] = {
		"   ^B   ", ""
	};
	int    bcmd;

	hgSetSaveOn();
	hgPrtBoxXy(edx1, edy1, edx1 + 80, edy1 + 20, text);
	bcmd = inkey(WAIT);
	hgRestore();
	hgSetSaveOff();

	switch (bcmd) {
		case ESC :
			edeng_process(ESC);
			break;
		default :
			break;
	}
}

void     edreturn_process()
{
	if (ins_flag) {
		if (!is_complete()) {
			init_code();
			if (current < end_mem) {
				cur_ptr = Basex + Curx + 2;
				horz_locate(cur_ptr);
			}
			if (edScreenjob) edScreenChange();
		}

		ins_return();
	}
	else {
		if (!is_complete()) init_code();

		up_down(1);
		cur_ptr = 0;
		horz_locate(0);
	}
}

void     edindent_toggle()
{
	indentflag = !indentflag;

	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	indent_status();
}

void     edins_process()
{
	ins_flag = !ins_flag;

	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	ins_internal();
}

void     edhan2eng_process()
{
	mode = 1 - mode;

	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	toggle_sound();
	han2eng_internal();
}

void     edgtype_process()
{
	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
	}

	hgGraphCharType();
}

void     edgraphin_process()
{
	int   ch;

	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
		if (edScreenjob) edScreenChange();
	}

	if (!hgGraphCharIn(&ch)) return;

	if (ins_flag || is_eol(current)) {
		if (!insert(2, SPACE)) return;
	}
	if (end_mem > current) {
		if (savedflag) {
			savedflag = hgFALSE;
			saved_status();
		}

		if (isascii(*current) && is_han(current + 1))
			*(current + 2) = SPACE;
		*current = (ch >> 8);
		*(current + 1) = ch;
		edScreenjob |= 0x1000;	/* Ñe¸ º‰·i Äá¬á ·¡Ò ¬¡ Â‰b */
		edScreenChange();

		cur_ptr = Basex + Curx + 2;
		horz_locate(cur_ptr);
	}
}

void     edhanjain_process()
{
	int   ch;

	if (!is_complete()) init_code();

	if (isascii(*current)) return;

	ch = (*current << 8) + (byte)*(current + 1);
	hgHanjaIn(&ch);

	if (savedflag) {
		savedflag = hgFALSE;
		saved_status();
	}

	*current = (ch >> 8);
	*(current + 1) = ch;
	edScreenjob |= 0x2000;		/* Ðe ¢…¸a ®¸÷ */
	edScreenChange();

	cur_ptr = Basex + Curx + 2;
	horz_locate(cur_ptr);
}

void     edeng_process(int key)
{
	if (!is_complete()) {
		init_code();
		if (current < end_mem) {
			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
		}
		if (edScreenjob) edScreenChange();
	}

	if (ins_flag || is_eol(current)) {
		if (!insert(1, SPACE)) return;
	}

	if (end_mem >= current) {
		if (savedflag) {
			savedflag = hgFALSE;
			saved_status();
		}

		if (is_han(current)) *(current + 1) = SPACE;
		*current = (char)key;
		edScreenjob |= 0x1000;	/* Ñe¸ º‰·i Äá¬á ·¡Ò ¬¡ Â‰b */
		edScreenChange();

		cur_ptr = Basex + Curx + 1;
		horz_locate(cur_ptr);
	}
}

void     edhan_process(int key)
{
	int   ch, tch;

	if (savedflag) {
		savedflag = hgFALSE;
		saved_status();
	}

	if (ins_flag && is_complete())
		if (!insert(2, SPACE)) return;

	ch = key;
	tch = hgCombine(&ch);

	if (ins_flag) {
		if (tch) {
			*current = (tch >> 8);
			*(current + 1) = tch;
			edScreenjob |= 0x1000;
			edScreenChange();

			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
			if (edScreenjob) edScreenChange();

			if (insert(2, SPACE)) {
				*current = (ch >> 8);
				*(current + 1) = ch;
				edScreenjob |= 0x1000;
			}
		}
		else {
			*current = (ch >> 8);
			*(current + 1) = ch;
			edScreenjob |= 0x1000;
		}
	}
	else {
		if (is_eol(current) && !insert(2, SPACE)) return;
		if (tch) {
			*current = (tch >> 8);
			*(current + 1) = tch;
			edScreenjob |= 0x1000;
			edScreenChange();

			cur_ptr = Basex + Curx + 2;
			horz_locate(cur_ptr);
			if (edScreenjob) edScreenChange();

			if (isascii(*current) && is_han(current + 1))
				*(current + 2) = SPACE;
			if (is_eol(current) && !insert(2, SPACE)) return;
			if (is_eol(current + 1)) insert(1, SPACE);
			*current = (ch >> 8);
			*(current + 1) = ch;
			edScreenjob |= 0x1000;
		}
		else {
			if (isascii(*current) && is_han(current + 1))
				*(current + 2) = SPACE;
			if (is_eol(current + 1)) insert(1, SPACE);
			*current = (ch >> 8);
			*(current + 1) = ch;
			edScreenjob |= 0x1000;
		}
	}
}

int      edKeyProcess(int key)
{
	int   i;
	int   ret_flag = _NORMAL_KEYCODE;

	for (i = 0;i < MAXEDITKEY;i++)
		if (edKeys[i] == key) {
			(*edKeyfunc[i])();
			ret_flag = _SPECIAL_KEYCODE;
			break;
		}
	return(ret_flag);
}

void     up_down(int n)
{
	char   *ptr;
	unsigned  line_no, len;

	if (n <= 0) {			/* Up, PgUp —w */
		line_no = (-n > Basey + Cury) ? 0 : Basey + Cury + n;
		line_start = pre_line(line_start, -n);
	}
	else {				/* Down, PgDn —w */
		line_no = Basey + Cury;
		if (n > max_line - line_no) n = max_line - line_no;
		line_no += n;
		line_start = next_line(line_start, n);
	}

	len = line_len(line_start);
	ptr = line_start + ((cur_ptr > len) ? len : cur_ptr);
	vert_locate(line_no, ptr);
}

void     to_pointer(char *ptr)
{
	unsigned  line_no;

	line_no = Basey + Cury;
	if (ptr <= current) {
		if ((unsigned)(ptr - start_mem) < (unsigned)(current - ptr))
			line_no = line_num(start_mem, ptr);
		else line_no -= line_num(ptr, current);
	}
	else {
		if ((unsigned)(ptr - current) < (unsigned)(end_mem - ptr))
			line_no += line_num(current, ptr);
		else line_no = max_line - line_num(ptr, end_mem);
	}

	line_start = pre_line(ptr, 0);
	cur_ptr = (unsigned)(ptr - line_start);
	vert_locate(line_no, ptr);
}

void     vert_locate(unsigned line_no, char *ptr)
{
	unsigned  tpos, prepos, newpos;

	if (line_no < Basey || Basey + edrow - 2 < line_no) {
					/* 1º‰ ¶á¡¯¡( … ¶áµA¬á Up Ç¡ ·³b¯¡)
					   ¸å ÑÁ¡e·i 1º‰³¢ ¯aÇa©”a¶…
					   Ñe¸ º‰·i ¬¡ Â‰b */
		if (Cury == 0 && line_no + 1 == Basey)
			edScreenjob |= 0x0401;
					/* 1º‰ ´aœ¡¯¡( … £»µA¬á Down Ç¡ ·³b¯¡)
					   ¸å ÑÁ¡e·i 1º‰³¢ ¯aÇa©´ó
					    … £»º‰·i Â‰b */
		else if (Cury == edrow - 2 && Basey + edrow - 1 == line_no) {
			if (edScreenjob) edScreenjob = (edScreenjob & 0x8000) ? 0x8000 : 0x0480;
			else edScreenjob = 0x0110;
		}
					/* PgUp, PgDn —w· Ç¡ ·³b¯¡
					   Ðe ÑÁ¡e·i ¬¡ Â‰b */
		else edScreenjob = 0x8000;
		if (line_no < Cury && line_no < Basey) Cury = line_no;
		Basey = line_no - Cury;
	}
	else Cury = line_no - Basey;

	tpos = (unsigned)(ptr - line_start);
	prepos = pre_char(tpos, &newpos);
	if (tpos == newpos) horz_locate(tpos);
	else horz_locate(newpos - prepos);
}

void     horz_locate(unsigned pos)
{
	if (pos < Basex || Basex + edcol - 2 < pos) {
		Curx = (pos < Basex) ? 0 : (edcol - 2);
		Basex = pos - Curx;
		if (Basex) {
			pre_char(Basex, &Basex);
			Curx = pos - Basex;
		}
					/* Ñe¸· ÑÁ¡e¤c·¡¡e ¸å ÑÁ¡e·i Â‰b */
		edScreenjob = 0x8000;
	}
	else Curx = pos - Basex;

	last_pos = current;
	current = line_start + pos;
	rowcol_status();
}

int      delete(int n)
{
	char   *ptr;
	unsigned  line_no = 0;

	if (end_mem == current || n == 0) return(hgFAIL);

	ptr = current + n;
	if ((line_no = blockline_num(current, ptr)) != 0) max_line -= line_no;
					/* º‰ ”e¶á¡ ¬b¹Aˆa ´a“¥ ‰w¶
					   Ñe¸ º‰ e Äá¬á ·¡Ò ¬¡ Â‰b */
	else edScreenjob |= 0x1000;
	movmem(ptr, current, (size_t)(end_mem - ptr + 1));
	end_mem -= n;

	if (savedflag) {
		savedflag = hgFALSE;
		saved_status();
	}

	if (last_pos > current)
		last_pos = (last_pos > ptr) ? last_pos - n : current;
	if (block_size) {
		if (current <= b_b_ptr && b_k_ptr <= ptr)
			b_b_ptr = b_k_ptr = current;
		else {
			if (ptr <= b_b_ptr) {
				b_b_ptr -= n;
				b_k_ptr -= n;
			}
			else if (current <= b_b_ptr) {
				b_b_ptr = current;
				b_k_ptr -= n;
			}
			else if (ptr <= b_k_ptr)  b_k_ptr -= n;
			else if (current <= b_k_ptr) b_k_ptr = current;
		}
		block_size = (unsigned)(b_k_ptr - b_b_ptr);
	}
	return(hgSUCCESS);
}

int      insert(int n, char ch)
{
	if ((MAXCHAR - (unsigned)(end_mem - start_mem)) < n) {
		MEM_error();
		return(hgFAIL);
	}

	movmem(current, current + n, (size_t)(end_mem - current + 1));
	if ((*current = ch) == RETURN) {
		*(current + 1) = LF;
		++max_line;
	}
	end_mem += n;

	if (savedflag) {
		savedflag = hgFALSE;
		saved_status();
	}

	if (last_pos > current) last_pos += n;
	if (block_size) {
		if (b_b_ptr > current) b_b_ptr += n;
		if (b_k_ptr > current) b_k_ptr += n;
		block_size = (unsigned)(b_k_ptr - b_b_ptr);
	}
	return(hgSUCCESS);
}

int      is_han(char *ptr)
{
	return((*ptr & 0x80) && (*(ptr + 1) & 0xe0) ? 1 : 0);
}

int      is_eol(char *ptr)
{
	return((*ptr == RETURN && *(ptr + 1) == LF) || is_eof(ptr));
}

int      is_eof(char *ptr)
{
	return((*ptr == 0x1a) || (*ptr == 0) || (ptr == end_mem));
}

int      in_word(char *ptr)
{
	return(strchr(" \r\n<>,:.()[]^'*+-/$[", *ptr) == NULL);
}

void     ins_return()
{
	size_t   n = 0;

	if (indentflag) {
		n = strspn(line_start, " ");
		if (n >= Basex + Curx) n = Basex;
	}
	if (insert(n + 2, RETURN)) {
					/* Äá¬á ¶õº‰·i ´ó•A·¡Ëa
					   Äá¬á· º‰µA¬á ¯aÇa©”a¶…
					   Ñe¸· º‰·i ¬¡ Â‰b */
		memset(current + 2, SPACE, n);
		edScreenjob |= 0x4402;
		to_pointer(current + n + 2);
	}
}

void     restore_line()
{
	char   *ptr = line_buff;
	unsigned  buf_size = 0;

	horz_locate(0);
	while (buf_size < 160 && *ptr && !is_eol(ptr)) {
		++buf_size;
		++ptr;
	}
	change_line(line_len(current), buf_size, line_buff);
}

unsigned line_num(char *src, char *dest)
{
	unsigned  line_no = 0;

	while (dest > src)
		if (*src++ == RETURN && *src == LF) ++line_no;
	return(line_no);
}

size_t   blockline_num(char *src, char *dest)
{
	if ((unsigned)(dest - src) < (unsigned)(end_mem - (dest - src)))
		return(line_num(src, dest));
	else return(max_line - line_num(start_mem, src) - line_num(dest, end_mem));
}

unsigned line_len(char *ptr)
{
	unsigned  len = 0;

	while (!is_eof(ptr) && !(*(ptr++) == RETURN || *ptr == LF))
		++len;
	return(len);
}

unsigned pre_char(unsigned pos, unsigned *newpos)
{
	char   *ptr;
	int    ret;
	unsigned  i;

	ptr = line_start;
	for (i = 0;i < pos;) {
		if (is_han(ptr)) {
			ptr += 2;
			i += 2;
			ret = 2;
		}
		else {
			ptr++;
			i++;
			ret = 1;
		}
	}
	*newpos = i;
	return(ret);
}

char    *pre_line(char *ptr, int n)
{
	int   line_no = 0;

	while (line_no <= n && ptr > start_mem)
		if (*(--ptr) == LF && *(ptr - 1) == RETURN) {
			--ptr;
			++line_no;
		}
	return((line_no <= n) ? start_mem : ptr + 2);
}

char    *next_line(char *ptr, int n)
{
	int   line_no = 0;

	while (line_no < n && ptr < end_mem)
		if (*(ptr++) == RETURN && *ptr == LF) {
			++ptr;
			++line_no;
		}
	return(ptr);
}

void     edScreenChange()
{
	hgHideMouse();
					/* Ðe ÑÁ¡e·i ¬¡ Â‰b
					    §iœâ ¡ww, ¹Á¶ ¯aÇa©, PgUp, PgDn—w */
	if (edScreenjob & 0x8000) ednew_page();
	else {				/* Äá¬á ¶õº‰·i ´ó•A·¡Ëa
					    RETURN Ç¡ ·³b¯¡ */
		if (edScreenjob & 0x4000) edupdate_line(1);

		switch (edScreenjob & 0xff) {
			case 0x80 :	/* Ñe¸ º‰·i ´ó•A·¡Ëa & ¯aÇa©´ó
					     … £»º‰µA¬á RETURN Ç¡ ·³b¯¡ */
				edupdate_line(0);
				hgScrUp(edx1, edy1, edx2, edy2 - 16, 16, edTB);
				break;
			case 0x40 :	/* Äá¬á 2¤å¼ ´aœµA¬á ¯aÇa©´ó
					    EOL ¬b¹A¯¡ */
				if (edy1 + ((Cury + 2) << 4) >= edy2) break;
				hgScrUp(edx1, edy1 + ((Cury + 1) << 4), edx2, edy2, 16, edTB);
				break;
			case 0x20 :	/* Äá¬á 1¤å¼ ´aœµA¬á ¯aÇa©´ó
					    CTRL_Y Ç¡ ·³b¯¡ */
				hgScrUp(edx1, edy1 + (Cury << 4), edx2, edy2, 16, edTB);
				break;
			case 0x10 :	/* ¸å ÑÁ¡e·i 1º‰³¢ ¯aÇa©´ó
					    ´aœ ÑÁ¬iÎa ·³b¯¡ */
				hgScrUp(edx1, edy1, edx2, edy2, 16, edTB);
				break;
			case 0x02 :	/* Äá¬á· º‰µA¬á 1º‰³¢ ¯aÇa©”a¶…
					    ¶õº‰µA¬á RETURN Ç¡ ·³b¯¡ */
				hgScrDown(edx1, edy1 + (Cury << 4), edx2, edy2, 16, edTB);
				break;
			case 0x01 :	/* ¸å ÑÁ¡e·i 1º‰³¢ ¯aÇa©”a¶…
					    ¶á ÑÁ¬iÎa ·³b¯¡ */
				hgScrDown(edx1, edy1, edx2, edy2, 16, edTB);
				break;
			default :
				break;
		}
					/* Ðe ¢…¸a ®¸÷¯¡ */
		if (edScreenjob & 0x2000) ednew_char();
					/* Ñe¸ º‰·i Äá¬á ·¡Ò ¬¡ Â‰b */
		if (edScreenjob & 0x1000) ednew_line(Curx, Cury, line_start);
					/* Ñe¸ º‰·i ¬¡ Â‰b */
		if (edScreenjob & 0x0400) ednew_line(0, Cury, line_start);
					/* ´aœº‰·i ¬¡ Â‰b */
		if (edScreenjob & 0x0200) ednew_downline(1);
					/*  … £»º‰·i ¬¡ Â‰b */
		if (edScreenjob & 0x0100) ednew_downline(edrow - Cury - 1);
		edScreenjob = 0;
	}

	hgShowMouse();
}

void     ednew_char()
{
	char   temp[3];

	if (is_han(current)) {
		temp[0] = *current;
		temp[1] = *(current + 1);
		temp[2] = 0;
	}
	else {
		temp[0] = *current;
		temp[1] = 0;
	}

	if (blockflag && in_block(current))
		hgFBTextXy(edx1 + (Curx << 3), edy1 + (Cury << 4), temp, edTB, edTF);
	else hgFBTextXy(edx1 + (Curx << 3), edy1 + (Cury << 4), temp, edTF, edTB);
}

void     edupdate_line(int n)
{
	char   temp[3];
	int    tx;

	tx = line_len(pre_line(line_start, 1)) - Basex;
	if (tx >= edcol) return;

	hgBoxFill(edx1 + (tx << 3), edy1 + ((Cury - n) << 4), edx2, edy1 + 15 + ((Cury - n) << 4), edTB);
	temp[0] = RETURN;
	temp[1] = 0;

	if (blockflag && in_block(line_start + Basex + tx))
		hgFBTextXy(edx1 + (tx << 3), edy1 + ((Cury - n) << 4), temp, edTB, edTF);
	else hgFBTextXy(edx1 + (tx << 3), edy1 + ((Cury - n) << 4), temp, edTF, edTB);
}

void     ednew_downline(int n)
{
	if (Basey + Cury + n <= max_line)
		ednew_line(0, Cury + n, next_line(line_start, n));
	else hgBoxFill(edx1, edy1 + ((Cury + n) << 4), edx2, edy1 + 15 + ((Cury + n) << 4), edTB);
}

char    *ednew_line(int x, int y, char *str)
{
	char   *ptr;
	char   temp[3];
	int    tx;
	int    n, pos = 0, limit;

	tx = x;
	n = (int)(line_len(str));
	ptr = str + Basex + x;
					/* Ðeº‰· ¢…¸a ®Ÿi ‰¬eÐaµa Ðe ¢…¸a³¢
					    Â‰bÐa‰¡ q“e ÑÁ¡e·i Œu·¡ »¡¶‘ */
	limit = ((Basex + edcol - 1) > n) ? (n - Basex) : (edcol - 1);
	while ((pos + x) < limit) {
		if (is_han(ptr)) {
			temp[0] = *ptr;
			temp[1] = *(ptr + 1);
			temp[2] = 0;

			if (blockflag && in_block(ptr))
				hgFBTextXy(edx1 + (tx << 3), edy1 + (y << 4), temp, edTB, edTF);
			else hgFBTextXy(edx1 + (tx << 3), edy1 + (y << 4), temp, edTF, edTB);

			ptr += 2;
			tx += 2;
			pos += 2;
		}
		else {
			if (*ptr == TAB) temp[0] = 7;
			else temp[0] = *ptr;
			temp[1] = 0;

			if (blockflag && in_block(ptr))
				hgFBTextXy(edx1 + (tx << 3), edy1 + (y << 4), temp, edTB, edTF);
			else hgFBTextXy(edx1 + (tx << 3), edy1 + (y << 4), temp, edTF, edTB);

			ptr++;
			tx++;
			pos++;
		}
	}

	hgBoxFill(edx1 + (tx << 3), edy1 + (y << 4), edx2, edy1 + 15 + (y << 4), edTB);
	if ((n >= Basex) && (n < Basex + edcol - 1)) {
		temp[0] = RETURN;
		temp[1] = 0;

		if (blockflag && in_block(ptr))
			hgFBTextXy(edx1 + (tx << 3), edy1 + (y << 4), temp, edTB, edTF);
		else hgFBTextXy(edx1 + (tx << 3), edy1 + (y << 4), temp, edTF, edTB);
	}
	str += (n + 2);			/* ”a·q º‰· ¯¡¸b ¶áÃ¡¡ */
	return(str);
}

void     ednew_page()
{
	char   *ptr;
	int    i;
	int    line_no;

	edScreenjob = 0x8000;
	ednew_line(0, Cury, line_start);/* Ñe¸ Íe»³Ða‰¡ ·¶“e º‰·i ¬¡ Â‰b */

	if (Basey + edrow - 2 < max_line) line_no = edrow - 1;
	else {				/* Ðe ÑÁ¡e¦…· º‰ ®Ÿi ‰¬eÐaµa Ðeº‰³¢
					   Â‰bÐa‰¡ q“e ÑÁ¡e·i Œu·¡ »¡¶‘ */
		line_no = max_line - Basey;
		hgBoxFill(edx1, edy1 + ((line_no + 1) << 4), edx2, edy2, edTB);
	}
	ptr = pre_line(line_start, Cury);	/* ÑÁ¡e· ¯¡¸b ¶áÃ¡· º‰¡ */

	for (i = 0;i <= line_no;i++) {
		if (kbhit()) return;
		ptr = ednew_line(0, i, ptr);
	}
	edScreenjob = 0;
}

void     edSetForeColor(char color)
{
	edTF = color;
}

void     edSetBackColor(char color)
{
	edTB = color;
}

char     edGetForeColor()
{
	return(edTF);
}

char     edGetBackColor()
{
	return(edTB);
}

int      edCursor()
{
	int   key;

	key = hgCursor(edx1 + (Curx << 3), edy1 + (Cury << 4), is_han(current));
	return(key);
}

void     edClearScreen()
{
	hgHideMouse();
	hgBoxFill(edx1, edy1, edx2, edy2, edTB);
	hgShowMouse();
}

