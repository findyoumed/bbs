/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : nre_edit.c  -- ¢…¬á Íe»³‹¡ ¡A·¥ žË¥          |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <ctype.h>
#include    <dir.h>
#include    <fcntl.h>
#include    <io.h>
#include    <process.h>
#include    <stdlib.h>
#include    <sys\stat.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     INIT_LOAD    1
#define     BLOCK_LOAD   2

#define     LMAXCHAR     (long)(65000)

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char    *edbuff;			/* ÑÁ¡e ¸á¸w¶w ¤áÌá */

extern   char     *start_mem;
extern   char     *end_mem;
extern   char     *b_b_ptr;
extern   char     *b_k_ptr;
extern   char     *current;
extern   char     *line_start;

extern   char     savedflag;

extern   char     edTF, edTB;

char     work_file[50] = { "NONAME.NRE" };/* Ñe¸ Íe»³º—·¥ ÑÁ·© ·¡Ÿq */
char     write_file[50] = { "*.NRE" };	/* ¬ ·¡Ÿq·a¡ ¯¡ ÑÁ·© ·¡Ÿq */
char     open_file[50] = { "*.NRE" };	/* ˆa¹aµ¡‹¡ ¯¡ ÑÁ·© ·¡Ÿq */
char     block_file[50] = { "*.NRE" };	/* §iœâ ÑÁ·© ·¡Ÿq */

extern   char     line_buff[161];
extern   unsigned max_line;

extern   char     blockflag;
extern   unsigned block_size;

extern   unsigned edScreenjob;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreAboutEdit();		/* ’Ÿ¡µAœe..  @H */
void     nreHelpEdit();			/* ¬a¶w¬é¡w¬á  F1 */
void     nreShellEdit();		/* a—i·¡  @J */

void     nreNewEdit();			/* ¬ ‹i  @N */
void     nreLoadEdit();			/* ˆa¹aµ¡‹¡  @O */
void     nreReloadEdit();		/* ”a¯¡ ¦Ÿa‹¡  @F3 */
void     nreSaveEdit();			/* ¸á¸wÐa‹¡  @S */
void     nreWritetoEdit();		/* ¬ ·¡Ÿq·a¡  @W */
void     nreDirEdit();			/* ¡¢¢ ¥¡‹¡  @D */
void     nreChDirEdit();		/* ¡¢¢ ¤aŽ‹¡  @C */

void     nreChangeEdColor();		/* ¬‚Œi ¤aŽ‘ @E */

int      edVerify();

int      isexist(char *fname);
void     block_read();
void     block_write();
size_t   load_file(char *fname, char mode);
int      save_file(char *start, char *finish, char *fname);
int      ctrl_z_delete(unsigned size);

void     MEM_error();

extern   char    *split_name(char *fname);


void     nreAboutEdit()
{
	char   *text[] = {
		"  ’Ÿ¡µA œe ¸aÁA Ðe‹i·i ¸wÐe ¢…¬á ",
		" ¸b¬÷‹¡·³“¡”a. EGA, VGA, HerculesµA ",
		" ‰Å‰´ô·¡ •·¸b–A‰¡ mouse•¡ »¡¶¥Ða¡a ",
		" ‹¡¹¥· ¢…¬á Íe»³‹¡· ·A¶wÐe ‹¡“w·i ",
		" Í¡ÐqÐa‰¡ ·¶¯s“¡”a.                 ",
		" Ða“i­¡· Vada(¤a”a)µÁ Ðe ¶»¥³¡·  ",
		" Ðe‹i œa·¡§aœáŸ¡µA •¡¶‘·i ¤h´v·q·i  ",
		" ·¡ ¸aŸ¡µA¬á ˆq¬a —aŸ³“¡”a.         ",
		" ¥¡”a ÐqA ’Ÿ¡“e £¡œŸi ¶áÐ... ", ""
	};

	mouse_window("’Ÿ¡µAœe..", text);
}

void     nreHelpEdit()
{
	char   *items[] = {
		"’Ÿ¡µA ­¡ˆ ", "Íe»³‹¡ ‹i®A ", "’Ÿ¡µAœe..  ", "¬a¶w¬é¡w¬á  ",
		"a—i·¡      ", "¬  ‹i      ", "ˆa¹aµ¡‹¡    ", "”a¯¡ ¦Ÿa‹¡ ",
		"¬ ·¡Ÿq·a¡ ", "¸á¸wÐa‹¡    ", "¡¢¢ ¥¡‹¡   ", "¡¢¢ ¤aŽ‹¡ ",
		"Ðe‹i ¹·ŸA   ", "µw¢… ‹i©   ", "Ðe‹i ‹i©   ", "Ðe¸a ·¡Ÿq   ",
		"¬‚Œi ¤aŽ‘   ", "Äá¬á ¡¡´·   ", " a¶¯a Äá¬á ", ""
	};

	hgSetSaveOn();
	hgSelectDirHelpBoxXyM(items, "•¡¶‘ i Àx´a¥¡‹¡", "nurie.hhf", "nurie.hix");
	hgRestore();
	hgSetSaveOff();
}

void     nreShellEdit()
{
	char   *cspc;

	hgSetMouseEnd();
	hgSetMode(hgTEXT);

	printf("Type 'exit' to return to NURIE v1.5\n");
	printf("%s%ld%s\n", " Available memory :   ", coreleft(), " bytes ");
	cspc = getenv("COMSPEC");
	if (spawnlp(P_WAIT, cspc, cspc, NULL) == -1) errorsound();

	hgAutoSetDisplay();
	hgSetMode(hgGRAPHICS);
	hgSetMouseInit();
	hgSetRealWindow(hgGetx1r(), hgGety1r(), hgGetx2r(), hgGety2r() - 30);
	edDisplayStatus(hgGetx1r(), hgGety2r() + 1, hgGetx2r(), hgGety2r() + 20);

	edScreenjob = 0x8000;
}

void     nreNewEdit()
{
	int   flag;

	flag = edVerify();
	if (flag == -1) return;

	edInitVariable();
	strcpy(work_file, "NONAME.NRE");

	rowcol_status();
	saved_status();
	workfile_status();

	edScreenjob = 0x8000;
}

void     nreLoadEdit()
{
	int   flag;

	flag = hgGetFileName(" ·ª´á —i·© ÑÁ·© ·¡Ÿq·e? ", open_file);
	if (!flag) return;

	flag = edVerify();
	if (flag == -1) return;

	if (load_file(open_file, INIT_LOAD)) {
		strcpy(work_file, open_file);

		rowcol_status();
		saved_status();
		workfile_status();

		edScreenjob = 0x8000;
	}
}

void     nreReloadEdit()
{
	int   flag;

	flag = edVerify();
	if (flag == -1) return;

	if (*work_file) {
		if (load_file(work_file, INIT_LOAD)) {
			rowcol_status();
			saved_status();
			workfile_status();

			edScreenjob = 0x8000;
		}
	}
}

void     nreSaveEdit()
{
	int   flag;

	if (start_mem != end_mem) {
		if (!(*work_file)) {
			flag = hgGetFileName(" ¸á¸wÐi ÑÁ·© ·¡Ÿq·e ? ", work_file);
			if (!flag) return;

			workfile_status();
		}

		if (save_file(start_mem, end_mem, work_file)) {
			savedflag = hgTRUE;
			saved_status();
		}
		return;
	}
}

void     nreWritetoEdit()
{
	int   flag;

	flag = hgGetFileName(" ¸á¸wÐi ÑÁ·© ·¡Ÿq·e? ", write_file);
	if (!flag) return;

	if (save_file(start_mem, end_mem, write_file)) {
		strcpy(work_file, write_file);

		savedflag = hgTRUE;
		saved_status();
		workfile_status();
	}
}

void     nreDirEdit()
{
	char   file[50] = { "*.*" };

	hgGetFileName(" ÑÁ·© ·¡Ÿq·i ·³bÐa­A¶a. ", file);
}

void     nreChDirEdit()
{
	char   path[80];
	char   drive[3], dir[66], name[13], ext[4];
	int    key;

	sprintf(drive, "%c:", getdisk() + 'A');
	getcurdir(0, dir);
	sprintf(path, "%s\\%s", drive, dir);

	hgSetSaveOn();
	hgSpecInModeOn();
	hgEngInModeOn();
	key = hgGetText(" ¬¡¶… Drivea Path“e? ", path, 70, CYAN);
	hgEngInModeOff();
	hgSpecInModeOff();
	hgRestore();
	hgSetSaveOff();

	if (key == ESC) return;

	strupr(path);
	fnsplit(path, drive, dir, name, ext);
	if ((*drive) != NULL) setdisk(drive[0] - 'A');
	if (chdir(path) != 0) errorf();

	return;
}

void     nreChangeEdColor()
{
	char   csave;
	char   *text[] = {
		"  ˆñ¸÷¬‚  ",
		"  Ìaœe¬‚  ",
		"  Á¡¢¬‚  ",
		"  Ða“i¬‚  ",
		"  ¨iˆw¬‚  ",
		"  ºÑ×¬‚  ",
		"  ˆi  ¬‚  ",
		" ¤j·eÒA¬‚ ",
		"  ÒA  ¬‚  ",
		" ¤j·eÌaœw ",
		"  µe–¬‚  ",
		" ¤j·eÐa“i ",
		" ¤j·e¨iˆw ",
		" ¤j·eºÑ× ",
		"  ‘¡œe¬‚  ",
		"  Ó…  ¬‚  ", ""
	};
	int    ret;

	if (hgIsHerc()) {
		csave = edTF;
		edTF = edTB;
		edTB = csave;
	}
	else {
		hgSetSaveOn();
		hgDisplayMessage(" ‹i¸a¬‚ ¬åÈ‚ ", BLUE);
		delay(500);
		hgRestore();
		ret = hgSelectXyM(text, edTF);
		hgSetSaveOff();

		if (ret != -1) edTF = ret;

		hgSetSaveOn();
		hgDisplayMessage(" ¤‰w¬‚ ¬åÈ‚ ", BLUE);
		delay(500);
		hgRestore();
		ret = hgSelectXyM(text, edTB);
		hgSetSaveOff();

		if (ret != -1) edTB = ret;
	}

	edScreenjob = 0x8000;
}

int      edVerify()
{
	char   *butt[2];
	char   *buti[] = { "   µ   ", " ´a“¡¶a ", "" };
	int    flag = 0;

	if (!savedflag && start_mem != end_mem) {
		butt[0] = (char *)malloc((size_t)40);
		butt[1] = (char *)malloc((size_t)3);

		sprintf(butt[0], "  %s Ÿi ¸á¸wÐiŒa¶a ?  ", split_name(work_file));
		strcpy(butt[1], "");

		hgSetSaveOn();
		flag = hgPrtButtonBarXyM(butt, buti);
		hgRestore();
		hgSetSaveOff();

		if (flag == 0)
			if (save_file(start_mem, end_mem, work_file)) {
				savedflag = hgTRUE;
				saved_status();
			}

		free(butt[0]);
		free(butt[1]);
	}

	return(flag);
}

int      isexist(char *fname)
{
	return(!access(fname, 0));
}

void     block_read()
{
	char   *ptr = b_b_ptr;
	int    flag;
	unsigned  size = block_size;

	flag = hgGetFileName(" ·ª´á —i·© ÑÁ·© ·¡Ÿq·e? ", block_file);
	if (!flag) return;

	b_b_ptr = current;
	block_size = load_file(block_file, BLOCK_LOAD);
	if (block_size) {
		b_k_ptr = current + block_size;
		blockflag = hgTRUE;

		savedflag = hgFALSE;
		saved_status();

		edScreenjob = 0x8000;
	}
	else {
		b_b_ptr = ptr;
		block_size = size;
	}
}

void     block_write()
{
	int   flag;

	if (b_k_ptr <= b_b_ptr) return;

	flag = hgGetFileName(" ¸á¸wÐi ÑÁ·© ·¡Ÿq·e? ", block_file);
	if (!flag) return;

	save_file(b_b_ptr, b_k_ptr, block_file);
}

size_t   load_file(char *fname, char mode)
{
	int    handle;
	int    key;
	long   fsize;
	unsigned  size = 0;

	errno = 0;

	if ((handle = _open(fname, O_BINARY | O_RDONLY)) != -1) {
		fsize = filelength(handle);
		switch (mode) {
			case INIT_LOAD :
				if (fsize > LMAXCHAR) {
					hgSetSaveOn();
					hgDisplayMessage(" ¤áÌáˆa ¡¡¸aœs“¡”a. ¸aŸiŒa¶a? (Y/N) ", GREEN);
					hgEngInModeOn();
					key = toupper(inkey(WAIT));
					hgEngInModeOff();
					hgRestore();
					hgSetSaveOff();

					if (key == 'Y') fsize = LMAXCHAR;
					else fsize = -1L;
				}

				edInitVariable();
				break;
			case BLOCK_LOAD :
				if (fsize > (LMAXCHAR - (long)(end_mem - start_mem))) {
					MEM_error();
					fsize = -1L;
				}
				break;
		}

		if (fsize != -1L) {
			size = (size_t)(fsize);
			movmem(current, current + size, (size_t)(end_mem - current) + 1);
			if (_read(handle, current, size) == -1)
				movmem(current + size, current, (size_t)(end_mem - current) + 1);
			else {
				size = ctrl_z_delete(size);
				max_line += line_num(current, current + size);
				end_mem += size;
				strncpy(line_buff, line_start, 160);
			}
		}
		_close(handle);
	}
	else errno = 38;		/* file not found */

	if (errno) errorf();

	return(size);
}

int      save_file(char *start, char *finish, char *fname)
{
	char  bkname[50];
	char  *fptr = fname, *bptr = bkname;
	int   handle;
	int   key;
	int   ret = hgFALSE;

	while (*fptr && *fptr != '.') *bptr++ = *fptr++;
	*bptr = 0;
	strcat(bkname, ".BAK");
	strupr(fname);
	strupr(bkname);

	if (isexist(fname)) {
		if (isexist(bkname)) {
			if (strcmp(fname, bkname) == 0) {
				hgSetSaveOn();
				hgDisplayMessage(" ¤‚´ó ÑÁ·©µA ¸á¸wÐiŒa¶a? (Y/N) ", GREEN);
				hgEngInModeOn();
				key = toupper(inkey(WAIT));
				hgEngInModeOff();
				hgRestore();
				hgSetSaveOff();

				if (key != 'Y') return(hgFAIL);
			}
			unlink(bkname);
		}
		rename(fname, bkname);
	}

	errno = 0;

	if ((handle = creat(fname, S_IREAD | S_IWRITE)) != -1) {
		if (_write(handle, start, (unsigned)(finish - start)) != -1)
			ret = hgTRUE;
		else errorf();
		_close(handle);
	}

	if (errno) errorf();

	return(ret);
}

int      ctrl_z_delete(unsigned size)
{
	if ((*(current + size - 1)) == 0x1a) {
		movmem(current + size, current + size - 1, (size_t)(end_mem - current + 1));
		size--;
	}

	return(size);
}

void     MEM_error()
{
	errorsound();

	hgSetSaveOn();
	hgDisplayMessage(" Íe»³ ¡A¡¡Ÿ¡ˆa ¦¹¢Ðs“¡”a. ", RED);
	delay(2000);
	hgRestore();
	hgSetSaveOff();
}
