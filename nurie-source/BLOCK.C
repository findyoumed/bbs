/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : block.c  -- §iœâ ¡wœ÷ ¡¡—I                    |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <bios.h>
#include    <ctype.h>
#include    <string.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     NO           0
#define     YES          1
#define     NOT_ASK      2

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     object[30], option[30];	/* Àx‹¡/¤aŽ‹¡¯¡ ¬a¶w–A“e ¢…¸aµi‰Á µ³­e */
char     replace_str[30], key_str[30];	/* ¤aŽ‹¡¯¡ ”Ã¡–I ¢…¸aµi‰Á µÁ·©—a Äa—a */
char     replaceflag;			/* Àx‹¡/¤aŽ‹¡ µa¦ */

extern   char     *start_mem;
extern   char     *end_mem;
extern   char     *b_b_ptr;
extern   char     *b_k_ptr;
extern   char     *current;
extern   char     *line_start;

extern   unsigned max_line;
extern   unsigned cur_ptr;
extern   unsigned Basex, Basey;
extern   int      Curx, Cury;
extern   int      edx1, edy1;
extern   int      edx2, edy2;

extern   unsigned block_size;
extern   char     blockflag;

extern   char     savedflag;

extern   unsigned edScreenjob;

extern   int      errno;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      in_block(char *ptr);
void     block_decision(char **ptr);
void     block_copy();
void     line_after_block_move();
void     block_move();
void     block_delete();
void     block_disp_hide();

int      hgWinGetStr(char *title, char *str, int n);
void     finder(char mode);
void     find_string();
void     find_replace(unsigned repeat);
int      find(register char *ptr, int lexical, unsigned line);
int      change_line(int mem_size, int buf_size, char *buf_ptr);
int      compare(char *str, int n);

char    *pre_line(char *ptr, int n);


int      in_block(char *ptr)
{
	return(b_b_ptr <= ptr && ptr < b_k_ptr);
}

void     block_decision(char **ptr)
{
	unsigned  size;

	*ptr = current;
	blockflag = hgTRUE;

	size = block_size;
	block_size = (b_b_ptr >= b_k_ptr) ? 0 : (unsigned)(b_k_ptr - b_b_ptr);

	if (size != block_size) edScreenjob = 0x8000;
}

void     block_copy()
{
	if (!block_size) return;

	if (!(b_b_ptr < current && current < b_k_ptr) && insert(block_size, SPACE)) {
		max_line += blockline_num(b_b_ptr, b_k_ptr);
		movmem(b_b_ptr, current, block_size);
		b_b_ptr = current;
		b_k_ptr = b_b_ptr + block_size;

		savedflag = hgFALSE;
		saved_status();

		edScreenjob = 0x8000;
	}
}

void     line_after_block_move()
{
	char   *ptr;

	ptr = pre_line(line_start, Cury);
	if (ptr <= b_b_ptr) Cury -= line_num(b_b_ptr, b_k_ptr);
	else if (ptr <= b_k_ptr) {
		Basey -= line_num(b_b_ptr, ptr);
		Cury = line_num(b_k_ptr, current);
	}
	else Basey -= line_num(b_b_ptr, b_k_ptr);
}

void     block_move()
{
	char   temp[2001];
	char   *bptr, *mptr, *eptr;
	unsigned  count, len, size;

	if (in_block(current) || !block_size) return;

	if (b_k_ptr <= current) {
		bptr = b_b_ptr;
		mptr = b_k_ptr;
		eptr = current;
		line_after_block_move();
		b_b_ptr += (current - b_k_ptr);
	}
	else {
		bptr = current;
		mptr = b_b_ptr;
		eptr = b_k_ptr;
		b_b_ptr = current;
	}

	len = (size_t)(eptr - bptr);
	count = (size_t)(mptr - bptr);
	while (count > 0) {
		size = (count >= 2000) ? 2000 : count;
		count -= size;
		strncpy(temp, bptr, size);
		movmem(bptr + size, bptr, len - size);
		strncpy(eptr - size, temp, size);
	}

	b_k_ptr = b_b_ptr + block_size;
	line_start = pre_line(b_b_ptr, 0);
	horz_locate((size_t)(b_b_ptr - line_start));

	savedflag = hgFALSE;
	saved_status();

	edScreenjob = 0x8000;
}

void     block_delete()
{
	char   *temp;

	if (!block_size) return;

	if (in_block(current)) to_pointer(b_b_ptr);
	else if (b_k_ptr <= current) {
		line_after_block_move();
		current -= block_size;
	}

	temp = current;
	current = b_b_ptr;
	delete(block_size);
	current = temp;
	line_start = pre_line(current, 0);
	horz_locate((size_t)(current - line_start));

	savedflag = hgFALSE;
	saved_status();

	edScreenjob = 0x8000;
}

void     block_disp_hide()
{
	if (!block_size) return;

	blockflag = 1 - blockflag;

	edScreenjob = 0x8000;
}

int      hgWinGetStr(char *title, char *str, int n)
{
	int   key;

	hgSetSaveOn();
	hgSpecInModeOn();
	key = hgGetText(title, str, n, RED);
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();

	return(key);
}

void     finder(char mode)
{
	replaceflag = mode;

	if (hgWinGetStr("Àx“e ¢…¸aµi·e?", object, 20) == ESC) return;

	if (replaceflag)
		if (hgWinGetStr("¤aŽ‰ ¢…¸aµi·e?", replace_str, 20) == ESC) return;

	hgEngInModeOn();
	if (hgWinGetStr("Option ¬åÈ‚", option, 20) != ESC) {
		strupr(option);
		find_string();
	}
	hgEngInModeOff();
}

void     find_string()
{
	char   *op_num;
	unsigned  repeat = 0;

	if (*object == 0) return;

	op_num = option;
	do {
		if ('0' <= *op_num && *op_num <= '9')
			repeat = repeat * 10 + (*op_num - '0');
	} while (*op_num++);

	if (replaceflag) find_replace(repeat ? repeat : 1);
	else find(current, repeat ? repeat : 1, Basey + Cury);
}

void     find_replace(unsigned repeat)
{
	char   *text[] = {
		"¤aŽ‰Œa¶a? [Y/N]", ""
	};
	char   *ptr;
	int    key;
	int    i, size;
	int    view = hgTRUE;
	int    lexical = 1;
	unsigned  mem_size, buf_size;
	unsigned  not_back = 1, line;

	if (strchr(option, 'G')) {
		to_pointer(start_mem);
		edScreenChange();
	}
	if (strchr(option, 'N')) replaceflag = NOT_ASK;
	if (strchr(option, 'B')) not_back = 0;

	buf_size = strlen(replace_str);
	mem_size = strlen(object);
	ptr = current;
	line = Basey + Cury;

	while (repeat && find(ptr - not_back, lexical, line)) {
		repeat--;
		lexical = 0;
		switch (replaceflag) {
			case YES :
				if (edScreenjob) edScreenChange();
				size = (not_back) ? mem_size : 0;

				hgSetSaveOn();
				hgPrtBoxXy(edx1, edy2 + 1, edx1 + 140, edy2 + 21, text);
				hgEngInModeOn();
				do {
					key = toupper(edCursor());
				} while (key != 'Y' && key != 'N' && key != ESC);
				hgEngInModeOff();
				hgRestore();
				hgSetSaveOff();

				if (key == ESC) repeat = 0;
				if (key != 'Y') break;
			case NOT_ASK :
				if ((change_line(mem_size, buf_size, replace_str)))
					size = (not_back) ? buf_size : (1 - mem_size);
				else {
					MEM_error();
					repeat = 0;
				}

				if (view && edScreenjob) edScreenChange();
				if (replaceflag == NOT_ASK && kbhit())
					switch (inkey(WAIT)) {
						case ESC :
							repeat = 0;
							break;
						default :
							view = !view;
							edScreenjob = 0x8000;
							break;
					}
				break;
		}
		ptr = current + size;
		line = Basey + Cury;
		if (size < 0) {
			for (i = 0;i < (-size);i++)
				if (*(ptr + i) == LF)
					if (line > 0) line--;
		}
	}

	edScreenjob = 0x8000;

	if (errno) {
		while (kbhit()) bioskey(0);
		while (edScreenjob) {
			edScreenChange();
			if (kbhit()) bioskey(0);
		}
		errorf();
	}
}

int      find(register char *ptr, int lexical, unsigned line)
{
	static char  key;
	static int   count, len;
	static int   back, word;
	int    i, ret;
	int    found = 0;
	int    left, right;
	unsigned  temp_line = line;

	if (lexical) {			/* µ³­e· ¦…¬â */
		if (strchr(option, 'U')) {
			key = 0xDF;
			strupr(object);
		}
		else key = 0xFF;

		len = strlen(object);
		for (i = 0;i < len;i++)
			key_str[i] = (object[i] == '`') ? 0 : key;
		key = *key_str;
		count = lexical;
		back = (strchr(option, 'B')) ?  -1 : 1;
		word = (strchr(option, 'W')) ? hgTRUE : hgFALSE;
		if (replaceflag && strchr(option, 'G')) back = 1;
	}

	do {
		ret = hgFALSE;
		while ((ptr + back) >= start_mem && (ptr + back) < end_mem) {
			ptr += back;
			if (*ptr == RETURN) ptr += back;
			if (*ptr == LF) line += back;
			else if (!((*ptr - *object) & key) && compare(ptr, len)) {
				left = right = hgTRUE;
				if (word) {
					left = (*(ptr - 1) <= SPACE);
					right = (*(ptr + len) <= SPACE);
				}
				if (left && right) {
					ret = hgTRUE;
					found++;
					break;
				}
			}
		}
	} while ((found < count) && ret);

	ret = (found == count);
	if (ret) {
		if (line != temp_line) line_start = pre_line(ptr, 0);
		vert_locate(line, ptr);
		cur_ptr = (unsigned)(current - line_start);
	}
	else {
		errno = 37;
		if (replaceflag == NO) {
			while (kbhit()) bioskey(0);
			while (edScreenjob) {
				edScreenChange();
				if (kbhit()) bioskey(0);
			}
			errorf();
		}
	}

	return(ret);
}

int      change_line(int mem_size, int buf_size, char *buf_ptr)
{
	int   ret;

	ret = (buf_size < mem_size) ? delete((unsigned)(mem_size - buf_size))
				    : insert((unsigned)(buf_size - mem_size), SPACE);
	if (ret) {
		strncpy(current, buf_ptr, buf_size);
		savedflag = hgFALSE;
		saved_status();
	}

	return(ret);
}

int      compare(char *str, int n)
{
	char   *str2 = object;
	char   *key = key_str;
	int    i, ret = hgTRUE;

	i = 0;
	while (i++ < n)
		if ((*str++ - *str2++) & *key++) {	/* key for check wild card */
			ret = hgFALSE;
			break;
		}


	return(ret);
}
