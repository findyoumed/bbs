/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : filedir.c  -- ÑÁ·© ¡¢¢ ¤b¯a ¡¡—I             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <alloc.h>
#include    <dir.h>
#include    <dos.h>
#include    <io.h>

#include    "key.h"			/* ‹¡“wÇ¡µA ”Ðe ¬w® ¸÷· */
#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "hwindow.h"			/* Ðe‹i ¶å•¡¶µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char    *direc[_MAXDIR];		/* ÑÁ·© ¡¢¢ ¤b¯a Ðw¡¢ */
int      dirpos;			/* ÑÁ·© ¡¢¢ ¤b¯a ¤a ¶áÃ¡ */

char     file[50];
char     rett[50];

extern   char     saveflag;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      hgFindFirstDir(char *mask, char attr, char *s);
int      hgFindNextDir(char attr, char *s);

void     directory(int x, int y, char mask[20], char *rtn);
void     add(char *s);

int      hgFileDirBoxXy(int x, int y, char *fname, char *ret);
int      hgFileDirBoxXyM(char *fname, char *ret);

int      hgGetFileName(char *title, char *fname);


int      hgFindFirstDir(char *mask, char attr, char *s)
{
	char   far  *p;
	int    i = 0;

		asm  push ds

		asm  lds  si, mask
		asm  mov  dx, si

		asm  mov  ah, 04eh
		asm  mov  cl, attr
		asm  xor  ch, ch
		asm  int  21h

		asm  pop  ds

		asm  jc   error

	p = getdta();
	p += 30;

	while (*p) s[i++] = *p++;
	s[i] = 0;
	return(hgSUCCESS);

error:	return(hgFAIL);
}

int      hgFindNextDir(char attr, char *s)
{
	char   far  *p;
	int    i = 0;

	do {
		asm  mov  ah, 04fh
		asm  int  21h
		asm  jc   error

		p = getdta();
	} while (!(p[21] & attr));

	p += 30;
	while (*p) s[i++] = *p++;
	s[i] = 0;
	return(hgSUCCESS);

error:	return(hgFAIL);
}

void     directory(int x, int y, char mask[20], char *rtn)
{
	struct  ffblk  FFblk;		/* for findfirst */

	char   file2[50];
	char   oldpath[50];
	char   temp[50], temp2[50];
	char   ret[50];
	char   drive[MAXDRIVE], dir[MAXDIR], name[MAXFILE], ext[MAXEXT];
	int    i, flag;
	int    len;

	int    sdisk;
	int    disk_nu;
	char   disk_table[27], disk_temp[10];

	sdisk = getdisk();

	for (disk_nu = 0;disk_nu < 26;disk_nu++) {
		setdisk(disk_nu);
		if (disk_nu == getdisk()) disk_table[disk_nu] = 'A' + disk_nu;
		else disk_table[disk_nu] = '0';
	}
	while (disk_table[disk_nu--] == '0');
	disk_nu++;

	flag = fnsplit(file, drive, dir, name, ext);
	if (flag & DRIVE) {
		i = toupper(drive[0]) - 'A';
		setdisk(i);
	}
	else setdisk(sdisk);

	if (flag & DIRECTORY) {
		dir[strlen(dir) - 1] = 0;
		if (dir[0] == 0) chdir("\\");
		else chdir(dir);
	}

	while (1) {
		flag = getcurdir(0, oldpath);
		if (flag == -1) {
			setdisk(sdisk);
			getcurdir(0, oldpath);
		}

		flag = fnsplit(file, drive, dir, name, ext);
		strcpy(file2, drive);
		strcat(file2, dir);
		strcat(file2, name);
		strcat(file2, ext);

		if ((flag & WILDCARDS) == 0) {
			strcpy(rtn, file2);
			dirpos = -1;
			return;
		}

		flag = hgFindFirstDir("*.*", FA_DIREC, file2);
		dirpos = 0;
		while (flag) {
			if ((strstr(file2, ".") == NULL) || (strstr(file2, "..") != NULL)) {
				len = strlen(file2) + 4;
				direc[dirpos] = (char *)malloc((size_t)len);
				strcpy(direc[dirpos], "<");
				strcat(direc[dirpos], file2);
				strcat(direc[dirpos++], ">");
			}
			flag = hgFindNextDir(FA_DIREC, file2);
		}

		for (i = 0;i < disk_nu;i++) {
			if (disk_table[i] != '0') {
				direc[dirpos] = (char *)malloc((size_t)7);
				sprintf(disk_temp, "[ %c: ]", disk_table[i]);
				strcpy(direc[dirpos++], disk_temp);
			}
		}

		flag = findfirst(mask, &FFblk, FA_ARCH);
		while (!flag) {
			strcpy(file2, FFblk.ff_name);
			len = strlen(file2) + 4;
			direc[dirpos] = (char *)malloc((size_t)len);
			strcpy(direc[dirpos++], file2);
			flag = findnext(&FFblk);
			if (dirpos >= (_MAXDIR - 5)) break;
		}
		direc[dirpos] = (char *)malloc((size_t)3);
		strcpy(direc[dirpos], "");

		sprintf(file2, "%c:", getdisk() + 'A');
		strcat(file2, "\\");
		strcat(file2, oldpath);
		if (strlen(oldpath) != 0) strcat(file2, "\\");
		strcat(file2, mask);
		strcpy(rett, file2);

		hgSelectDirBoxXy(x, y, direc, file2, ret);
		hgSetSaveOff();

		for (i = 0;i <= dirpos;i++)
			free(direc[i]);

		if (!strcmp(ret, "")) {
			strcpy(rtn, "\\");
			strcpy(temp, "\\");
			if (strcmp(oldpath, ""))
				strcat(temp, oldpath);
			setdisk(sdisk);
			chdir(temp);
			return;
		}

		if (ret[0] == '<') {
			strcpy(file2, &ret[1]);
			file2[strlen(file2) - 1] = 0;
			chdir(file2);
		}
		else if (ret[0] == '[') {
			i = ret[2] - 'A';
			setdisk(i);

		}
		else {
			sprintf(file2, "%c:", getdisk() + 'A');
			if (strlen(oldpath) != 0) {
				strcpy(temp2, "\\");
				strcat(temp2, oldpath);
				strcpy(oldpath, temp2);
				strcat(file2, oldpath);
			}
			strcat(file2, "\\");
			strcat(file2, ret);
			strcpy(temp2, "\\");
			if (strcmp(oldpath, ""))
				strcat(temp, oldpath);
			setdisk(sdisk);
			chdir(temp);
			strcpy(rtn, file2);
			strcpy(rett, rtn);
			return;
		}
	}
}

void     add(char *s)
{
	char   temp[50];

	strcpy(temp, "\\");
	strcat(temp, s);
	strcpy(s, temp);
}

int      hgFileDirBoxXy(int x, int y, char *fname, char *ret)
{
	char    file2[50];
	char    mask[20];
	char    oldpath[50];
	char    far  *oldDTA;
	char    drive[MAXDRIVE], dir[MAXDIR], name[MAXFILE], ext[MAXEXT];
	char    ssave;
	int     flag;

	ssave = saveflag;

	strcpy(file, fname);
	strcpy(file2, fname);
	getcurdir(0, oldpath);
	oldDTA = getdta();

	flag = fnsplit(file, drive, dir, name, ext);
	if ((flag & DRIVE) == 0 && (flag & WILDCARDS)) {	/* "*.*" */
		flag = fnsplit(rett, drive, dir, name, ext);
		if (flag & DIRECTORY) {
			fnsplit(rett, drive, dir, name, ext);
			strcpy(file, drive);
			strcat(file, dir);
			fnsplit(file2, drive, dir, name, ext);
			strcat(file, name);
			strcat(file, ext);
			sprintf(mask, "%s%s", name, ext);
		}
		else {
			fnsplit(file, drive, dir, name, ext);
			strcpy(mask, name);
			strcat(mask, ext);
		}
	}
	else if ((flag & DRIVE) && (flag & WILDCARDS))		/* "c:*.*" */
		sprintf(mask, "%s%s", name, ext);
	else if ((flag & DRIVE) && (flag & FILENAME) == 0
	&& (flag & WILDCARDS) == 0 && (flag & EXTENSION) == 0) {/* "c:" */
		if ((char *)dir[strlen(dir) - 1] == "\\") strcat(file, "*.*");
		else strcat(file, "\\*.*");
		fnsplit(file, drive, dir, name, ext);
		sprintf(mask, "%s%s", name, ext);
	}
	else sprintf(mask, "%s%s", name, ext);			/* "c:\spescial.spe" */

	directory(x, y, mask, ret);

	setdta(oldDTA);
	add(oldpath);
	chdir(oldpath);

	if (ssave) hgSetSaveOn();
	else hgSetSaveOff();

	if (dirpos == -1) return(-1);
	else return(1);
}

int      hgFileDirBoxXyM(char *fname, char *ret)
{
	int   x = (hgGetx2r() + hgGetx1r()) / 2 - 478 / 2;
	int   y = (hgGety2r() + hgGety1r()) / 2 - 194 / 2;
	int   flag;

	flag = hgFileDirBoxXy(x, y, fname, ret);
	return(flag);
}

int      hgGetFileName(char *title, char *fname)
{
	char   file2[50];
	int    flag;

	strcpy(file2, fname);

	hgSetSaveOn();
	hgSpecInModeOn();
	hgEngInModeOn();
	flag = hgGetText(title, file2, 45, BLUE);
	hgSpecInModeOff();
	hgEngInModeOff();
	hgRestore();

	if (flag == ESC) {
		hgSetSaveOff();
		return(hgFAIL);
	}

	flag = hgFileDirBoxXyM(file2, fname);
	if (flag != -1) hgRestore();
	hgSetSaveOff();

	if (!strcmp(fname, "\\")) {
		strcpy(fname, file2);
		return(hgFAIL);
	}
	return(hgSUCCESS);
}
