/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : compact.c  -- ´sÂ‚ ÑÁ·© ¥¡‹¡ ¡¡—I             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <dir.h>
#include    <fcntl.h>
#include    <io.h>
#include    <stdlib.h>
#include    <string.h>
#include    <sys/stat.h>
#include    <time.h>

#include    "hghlib.h"			/* Ğe‹i ·³Â‰bµA ”Ğe ÑA”á */
#include    "hginit.h"			/* Ğe‹i Á¡‹¡ÑÁµA ”Ğe ÑA”á */
#include    "hwindow.h"			/* Ğe‹i ¶å•¡¶µA ”Ğe ÑA”á */
#include    "compact.h"			/* ´sÂ‚ ÑÁ·©· Š¹¡µA ”Ğe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

			/* ÑÁ·© ´sÂ‚ ‹¡¤ó(Compression Method) */
char    *LZHmethod[] = {
	{"-lh5-"},
	{"-lh1-"},
	{"-lh0-"},
	{"-lh2-"},
	{"-lh3-"},
	{"-lh4-"},
	{"-lzs-"},
	{"-lz4-"},
	{"-lz5-"}
};

char    *ZIPmethod[] = {
	{"Store"},
	{"Shrink"},
	{"Reduce-1"},
	{"Reduce-2"},
	{"Reduce-3"},
	{"Reduce-4"},
	{"Implode"},
	{"Unknown"},
	{"Deflate"}
};

char    *ARCmethod[] = {
	{"Store"},
	{"Pack"},
	{"Squeeze"},
	{"Crunch"},
	{"Crunch"},
	{"Crunch"},
	{"Crunch"},
	{"Squash"},
	{"Crush"},
	{"Distill"}
};

char    *ARJmethod[] = {
	{"Store"},
	{"Most"},
	{"Fast"},
	{"Faster"},
	{"Fastest"}
};

#define     MAXCMPLINE      100

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

ZIP_LOCAL    lhd;
ZIP_CENTRAL  chd;
ZIP_END      ehd;
LZH_HEADER   lzhhd;
LZH_INTERNAL lzhint;
ARC_HEADER   archd;
ARJ_HEADER   arjhd;
EXE_HEADER   exehdr;

dword    CRC32Table[256], crc32, orgtotal, cmptotal;
unsigned CRC16Table[256], crc16, fcount;
char     *cmp_buf, sfx;
char     *cmpitems[MAXCMPLINE];
int      cmp_max;

char     cmpfile[50];			/* ´sÂ‚ ÑÁ·© */
int      chandle;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     nreCompactView();		/* ´sÂ‚ÑÁ·© ¥¡‹¡ @I */

void     cmpMakeCRC32Table();
void     cmpMakeCRC16Table();
void     cmpUpdateCRC32(byte *s, int n);
void     cmpUpdateCRC16(byte *s, int n);
char    *cmpSearchDir(char *s, char c);

void     cmpEndList();

dword    cmpSearchZIPCentral();
void     cmpSearchZIPComment();
void     cmpZIPList();
char     cmpIsZIP();

char     cmpLZHOk(dword pos);
char     cmpCheckSum(void *h);
void     cmpFindExt(char *exthdr, int size);
void     cmpLZHList();
char     cmpIsLZH();

void     cmpARCList();
char     cmpIsARC();

void     cmpARJList();
char     cmpIsARJ();

int      cmpFindArchive(char archive);
void     toupperstr(char *str);


void     nreCompactView()
{
	int    i;
	int    flag;
	char   mfile[50] = { "*.*" };
	char   *ext;
	char   archive = UNKNOWN;

	flag = hgGetFileName(" ¥¡‰¡¸a Ğa“e ´sÂ‚ ÑÁ·© ·¡Ÿq·e? ", mfile);
	if (!flag) return;

	cmp_buf = (char *)malloc((size_t)4096);

	strcpy(cmpfile, mfile);
	toupperstr(cmpfile);

	sfx = hgFALSE;
	ext = strchr(cmpfile, '.');

			/* ´sÂ‚ ÑÁ·©· ¹·ŸAŸi 1Àa ˆñ¬a */
	if (!strcmp(ext, ".EXE")) sfx = hgTRUE;
	else if (!strcmp(ext, ".ZIP"))
		archive = ZIP;
	else if (!strcmp(ext, ".LZH") || !strcmp(ext, ".ICE") || !strcmp(ext, ".LZS"))
		archive = LZH;
	else if (!strcmp(ext, ".ARJ"))
		archive = ARJ;
	else if (!strcmp(ext, ".ARC"))
		archive = ARC;

	chandle = open(cmpfile, O_RDONLY | O_BINARY);
	if (chandle == -1) {
		hgSetSaveOn();
		hgDisplayMessage(" ´sÂ‚ ÑÁ·©·i µi ® ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();

		free(cmp_buf);
		return;
	}

	cmp_max = 0;
	fcount = 0;
	orgtotal = 0;
	cmptotal = 0;

	cmpMakeCRC16Table();
	cmpMakeCRC32Table();

			/* ´sÂ‚ ÑÁ·©· ¹·ŸAŸi 2Àa ˆñ¬a */
	flag = cmpFindArchive(archive);
	if (flag == UNKNOWN) {
		hgSetSaveOn();
		hgDisplayMessage(" ´sÂ‚ ÑÁ·©· ÑwÈŸi ´i ® ´ô¯s“¡”a. ", RED);
		delay(1000);
		hgRestore();
		hgSetSaveOff();

		free(cmp_buf);
		close(chandle);
		return;
	}

	cmpitems[cmp_max] = (char *)malloc((size_t)3);
	cmpitems[cmp_max][0] = 0;
	cmpitems[cmp_max][1] = 0;

	hgSetSaveOn();
	hgPrtHelpBoxXyM(cmpitems, 70, 20, cmpfile);
	hgRestore();
	hgSetSaveOff();

	for (i = 0;i <= cmp_max;i++)
		free(cmpitems[i]);

	free(cmp_buf);
	close(chandle);
}

void     cmpMakeCRC32Table()
{
	int    i, j;
	dword  r;

	for (i = 0;i < 256;i++) {
		r = i;
		for (j = 0;j < 8;j++) {
			if (r & 1) r = (r >> 1) ^ CRC32POLY;
			else r >>= 1;
		}
		CRC32Table[i] = r;
	}
}

void     cmpMakeCRC16Table()
{
	int   i, j, r;

	for (i = 0;i < 256;i++) {
		r = i;
		for (j = 0;j < 8;j++) {
			if (r & 1) r = (r >> 1) ^ CRC16POLY;
			else r >>= 1;
		}
		CRC16Table[i] = r;
	}
}

void     cmpUpdateCRC32(byte *s, int n)
{
	while (n--)
		crc32 = CRC32Table[(byte)crc32 ^ (byte)*s++] ^ ((crc32 >> 8) & 0x00ffffffL);
}

void     cmpUpdateCRC16(byte *s, int n)
{
	while (n--)
		crc16 = CRC16Table[(byte)crc16 ^ (byte)*s++] ^ ((crc16 >> 8) & 0x00ff);
}

char    *cmpSearchDir(char *s, char c)
{
	char    *ptr, *dir, path[50];
	static  char  prevdir[50];

	if ((ptr = strrchr(s, c)) != NULL) {
		*ptr++ = '\0';
		strcpy(path, s);
		while ((dir = strchr(path, c)) != NULL)
			*dir = '\\';
		if(strcmpi(path, prevdir)) {
			cmpitems[cmp_max] = (char *)malloc((size_t)70);
			sprintf(cmpitems[cmp_max++], "%s\0", path);
			strcpy(prevdir, path);
		}
		return(ptr);
	}
	return(s);
}

void     cmpEndList()
{
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		"ÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄ");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	if (fcount == 0)
		sprintf(cmpitems[cmp_max++], "%s\0",
			" ´sÂ‚–E ÑÁ·©·¡ Ğaa•¡ ´ôˆáa ·¡¬w·¡ ·¶¯s“¡”a. ");
	else sprintf(cmpitems[cmp_max++], "%4d ÑÁ·©   %8lu %8lu %2d%%\0",
		fcount, orgtotal, cmptotal,
		(orgtotal - cmptotal) * 100 / orgtotal);
}

dword    cmpSearchZIPCentral()
{
	dword   sig;

	for (;;) {
		read(chandle, &lhd, sizeof(lhd));
		lseek(chandle, lhd.fn_len + lhd.ext_len + lhd.cmp_size, SEEK_CUR);
		if (read(chandle, &sig, sizeof(sig)) != sizeof(sig) || sig != ZIP_LOCAL_SIG)
			break;
	}

	return(sig);
}

void     cmpZIPList()
{
	char   filename[50], comment[50], *file;
	dword  sig, rate;

	if ((sig = cmpSearchZIPCentral()) != ZIP_CENTRAL_SIG) return;

	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s is compressed by PKZIP %4.2f %s\0",
		cmpfile, (byte)chd.ver1/10.,
		sfx ? " /Self-eXtracted by ZIP2EXE" : "");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		" ÑÁ·© ·¡Ÿq    ´sÂ‚¸å   ´sÂ‚Ò ·I ´sÂ‚¤w¤ó   i¼a     ¯¡ˆe   CRC-32");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		"ÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄ");

	while (fcount < MAXCMPLINE - 7) {
		read(chandle, &chd, sizeof(chd));
		read(chandle, filename, chd.fn_len);
		lseek(chandle, chd.ext_len, SEEK_CUR);
		read(chandle, comment, chd.cmt_len);
		filename[chd.fn_len] = '\0';
		file = cmpSearchDir(filename, '/');
		rate = (chd.org_size - chd.cmp_size) * 100 / chd.org_size;
		orgtotal += chd.org_size;
		cmptotal += chd.cmp_size;
		fcount++;

		if (chd.cmt_len) {
			comment[chd.cmt_len] = '\0';
			cmpitems[cmp_max] = (char *)malloc((size_t)70);
			sprintf(cmpitems[cmp_max++], "%s\0", comment);
		}

		cmpitems[cmp_max] = (char *)malloc((size_t)70);
		sprintf(cmpitems[cmp_max++], "%-12s %7lu  %7lu %2d%% %-7s"
			" %02d-%02d-%02d %02d:%02d:%02d %08lX\0",
			file, chd.org_size, chd.cmp_size,
			(int)rate, ZIPmethod[chd.method],
			year(chd.stamp), month(chd.stamp), day(chd.stamp),
			hour(chd.stamp), minute(chd.stamp), sec(chd.stamp),
			chd.crc32);

		if (read(chandle, &sig, sizeof(sig)) != sizeof(sig) || sig != ZIP_CENTRAL_SIG)
			break;
	}

	cmpEndList();
}

char     cmpIsZIP()
{
	int    i;
	char   flag, *ptr;
	dword  sig, pos = 0x3000L;

	if (sfx) {
		if (read(chandle, &exehdr, sizeof(exehdr)) != sizeof(exehdr))
			return(hgFALSE);

		if ((exehdr.relsize == 0x0000
		   && exehdr.hdrsize == 0x0006 && exehdr.minalloc == 0x0cd1
		   && exehdr.initss == 0x0320 && exehdr.initsp == 0x0400
		   && exehdr.initcs == 0xfff0 && exehdr.initip == 0x0100
		   && exehdr.reloffset == 0x001e && exehdr.overlay == 0x0000
		   && exehdr.dummy0 == 0x0100)
		|| (exehdr.relsize == 0x000b
		   && exehdr.hdrsize == 0x0020 && exehdr.minalloc == 0x0ac1
		   && exehdr.initss == 0x0e0a && exehdr.initsp == 0x0600
		   && exehdr.sum == 0x699d
		   && exehdr.initcs == 0x0000 && exehdr.initip == 0x2474
		   && exehdr.reloffset == 0x001e && exehdr.overlay == 0x0000
		   && exehdr.dummy0 == 0x0001)) {

			/* ÑA”áˆa 3000H¦Èá ÑÁ·©· { ¬a·¡µA ·¶·q */
			flag = hgFALSE;
			while (!flag) {
				lseek(chandle, pos, SEEK_SET);
				if (read(chandle, cmp_buf, 4096) < 1)
					return(hgFALSE);

				ptr = cmp_buf;
				for (i = 0;i < 4092;i++, ptr++, pos++) {
					if (*ptr == 0x50 && *(ptr + 1) == 0x4b
					   && *(ptr + 2) == 0x03 && *(ptr + 3) == 0x04) {
						lseek(chandle, pos + 4, SEEK_SET);
						cmpZIPList();
						flag = hgTRUE;
						break;
					}
				}
			}
			return(flag);
		}
		else return(hgFALSE);
	}
	else {
		if (read(chandle, &sig, sizeof(sig)) == sizeof(sig)) {
			if (sig == ZIP_LOCAL_SIG) {
				cmpZIPList();
				return(hgTRUE);
			}
			else return(hgFALSE);
		}
		else return(hgFALSE);
	}
}

char     cmpLZHOk(dword pos)
{
	int    i;

	lseek(chandle, pos, SEEK_SET);
	if (read(chandle, &lzhhd, 21) == 21 && lzhhd.size != 0) {
		strncpy(lzhint.method, lzhhd.method, 5);
		lzhint.method[5] = '\0';
		for(i = 0;i < 9;i++) {
			if (!strcmp(lzhint.method, LZHmethod[i]))
				return(hgTRUE);
		}
	}
	return(hgFALSE);
}

char     cmpCheckSum(void *h)
{
	char   sum;
	char  *ptr, *ptr2;

	ptr = (char *)h + 2;
	ptr2 = ptr + *(char *)h;
	for (sum = 0;ptr < ptr2;ptr++)
		sum += *ptr;

	return(sum);
}

void     cmpFindExt(char *exthdr, int size)
{
	char  *ptr;

	ptr = exthdr + 1;
	switch (*exthdr) {
		case 0 :
			lzhint.headcrc = *(int *)ptr;
			lzhint.crcposn = ptr;
			if (size > 5) lzhint.info = *(ptr + 2);
			break;
		case 1 :
			lzhint.filename = ptr;
			lzhint.fnlen = size - 3;
			break;
		case 2 :
			lzhint.pathname = ptr;
			lzhint.pathlen = size - 3;
			break;
		case 0x40 :
			if (lzhint.dos == MSDOS)
				lzhint.attrib = *(int *)ptr;
			break;
	}
}

void     cmpLZHList()
{
	int    size;
	char   flag, *ptr, path[50];
	dword  pos, rate;
	struct tm  *t;

	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s is compressed by LHA(rc) %s\0", cmpfile,
		sfx ? " /Self-eXtracted" : "");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		" ÑÁ·© ·¡Ÿq    ´sÂ‚¸å   ´sÂ‚Ò ·I ´sÂ‚¤w¤ó   i¼a     ¯¡ˆe   CRC-16");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		"ÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄ");

	flag = hgTRUE;
	while (flag && fcount < MAXCMPLINE - 7) {
		if (read(chandle, &lzhhd, 21) != 21 || lzhhd.size == 0) break;
		strncpy(lzhint.method, lzhhd.method, 5);
		lzhint.method[5] = '\0';
		lzhint.crcposn = 0;
		lzhint.pathlen = 0;
		lzhint.packed = lzhint.skip = lzhhd.packed;
		lzhint.hdsize = (int)lzhhd.size + 2;
		switch (lzhhd.level) {
			case 0 :
			case 1 :
				if (lzhint.hdsize < 22) {
					flag = hgFALSE;
					break;
				}
				read(chandle, &lzhhd.fnlen, lzhint.hdsize - 21);
				lzhint.fnlen = lzhhd.fnlen;
				lzhint.filename = lzhint.pathname = &lzhhd.fname;
				if (cmpCheckSum(&lzhhd.size) != lzhhd.sum) {
					flag = hgFALSE;
					break;
				}

				if ((lzhint.hdsize - lzhhd.fnlen) >= 24)
					lzhint.filecrc = *(int *)(&lzhhd.fname + lzhint.fnlen);
				else lzhhd.level = -1;
				if ((lzhint.hdsize - lzhhd.fnlen) >= 25)
					lzhint.dos = *(&lzhhd.fname + lzhint.fnlen + 2);

				pos = lseek(chandle, 0, SEEK_CUR) + lzhint.skip;
				if (lzhhd.level <= 0) {
					lzhint.filename = strncpy(path, &lzhhd.fname, lzhint.fnlen);
					lzhint.filename[lzhint.fnlen] = '\0';
					lzhint.filename = cmpSearchDir(lzhint.filename, 0xff);
					break;
				}

				ptr = &lzhhd.size + lzhhd.size;
				while ((lzhint.extsize = *(int *)ptr) != 0) {
					read(chandle, ptr + 2, lzhint.extsize);
					cmpFindExt(ptr + 2, lzhint.extsize);
					ptr += lzhint.extsize;
				}

				size = ptr + 2 - &lzhhd.size;
				lzhint.packed -= size - lzhint.hdsize;
				lzhint.hdsize = size;
				break;
			case 2 :
				read(chandle, &lzhhd.fnlen, (lzhint.hdsize = lzhhd.size) - 21);
				lzhint.stamp = lzhhd.stamp + 5 * 60 * 60;
				t = localtime(&lzhint.stamp);
				lzhint.dos = lzhhd.dos;
				ptr = &lzhhd.dos + 1;
				while ((lzhint.extsize = *(int *)ptr) != 0) {
					cmpFindExt(ptr + 2, lzhint.extsize);
					ptr += lzhint.extsize;
				}

				lzhint.filecrc = *(int *)(&lzhhd.fnlen);
				pos = lseek(chandle, 0, SEEK_CUR) + lzhint.skip;
				if (lzhint.crcposn == NULL) flag = hgFALSE;
				break;
			default :
				flag = hgFALSE;
				break;
		}
		if (flag == hgFALSE) break;

		if (lzhint.crcposn) {
			*(int *)lzhint.crcposn = '\0';
			crc16 = 0;
			cmpUpdateCRC16(&lzhhd.size, lzhint.hdsize);
			if (crc16 != lzhint.headcrc) break;
		}

		if (lzhhd.level > 0) {
			lzhint.filename[lzhint.fnlen] = '\0';
			if (lzhint.pathlen) {
				lzhint.pathname[lzhint.pathlen] = '\0';
				cmpSearchDir(lzhint.pathname, 0xff);
			}
		}

		rate = (lzhhd.original - lzhint.packed) * 100 / lzhhd.original;
		orgtotal += lzhhd.original;
		cmptotal += lzhint.packed;
		fcount++;

		if (lzhhd.level == 2) {
			cmpitems[cmp_max] = (char *)malloc((size_t)70);
			sprintf(cmpitems[cmp_max++], "%-12s %7lu  %7lu %2d%% %-7s"
				" %02d-%02d-%02d %02d:%02d:%02d %04X\0",
				lzhint.filename, lzhhd.original, lzhint.packed,
				(int)rate, lzhint.method,
				t-> tm_year % 100, t-> tm_mon + 1, t-> tm_mday,
				t-> tm_hour,  t-> tm_min, t-> tm_sec,
				lzhint.filecrc);
		}
		else {
			if (lzhhd.level < 0) {
				cmpitems[cmp_max] = (char *)malloc((size_t)70);
				sprintf(cmpitems[cmp_max++], "%-12s %7lu  %7lu %2d%% %-7s"
					" %02d-%02d-%02d %02d:%02d:%02d *\0",
					lzhint.filename, lzhhd.original, lzhint.packed,
					(int)rate, lzhint.method,
					year(lzhhd.stamp), month(lzhhd.stamp), day(lzhhd.stamp),
					hour(lzhhd.stamp), minute(lzhhd.stamp), sec(lzhhd.stamp));
			}
			else {
				cmpitems[cmp_max] = (char *)malloc((size_t)70);
				sprintf(cmpitems[cmp_max++], "%-12s %7lu  %7lu %2d%% %-7s"
					" %02d-%02d-%02d %02d:%02d:%02d %04X\0",
					lzhint.filename, lzhhd.original, lzhint.packed,
					(int)rate, lzhint.method,
					year(lzhhd.stamp), month(lzhhd.stamp), day(lzhhd.stamp),
					hour(lzhhd.stamp), minute(lzhhd.stamp), sec(lzhhd.stamp),
					lzhint.filecrc);
			}
		}

		lseek(chandle, pos, SEEK_SET);
	}

	cmpEndList();
}

char     cmpIsLZH()
{
	int    i;
	char   flag, *ptr;
	dword  pos = 0x500L;

	if (sfx) {
		if (exehdr.relsize != 0x0000
		   || exehdr.hdrsize != 0x0002 || exehdr.minalloc != 0x1000
		   || exehdr.initss != 0xfff0 || exehdr.initsp != 0x0100
		   || exehdr.initcs != 0xfff0 || exehdr.initip != 0x0100
		   || exehdr.reloffset != 0x001c)
			return(hgFALSE);

			/* ÑA”áˆa 500H¦Èá ÑÁ·©· { ¬a·¡µA ·¶·q */
		flag = hgFALSE;
		while (!flag) {
			lseek(chandle, pos, SEEK_SET);
			if (read(chandle, cmp_buf, 4096) < 1) return(hgFALSE);

			ptr = cmp_buf;
			for (i = 0;i < 4091;i++, ptr++, pos++) {
				if (*ptr == '-' && *(ptr + 4) == '-') {
					if (cmpLZHOk(pos - 2)) {
						lseek(chandle, pos - 2, SEEK_SET);
						cmpLZHList();
						flag = hgTRUE;
						break;
					}
				}
			}
		}
		return(flag);
	}
	else {
		if (cmpLZHOk(pos = 0)) {
			lseek(chandle, pos, SEEK_SET);
			cmpLZHList();
			return(hgTRUE);
		}
		else return(hgFALSE);
	}
}

void     cmpARCList()
{
	dword   rate, stamp;

	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s is compressed by ARC/ARCA\0", cmpfile);
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		" ÑÁ·© ·¡Ÿq    ´sÂ‚¸å   ´sÂ‚Ò ·I ´sÂ‚¤w¤ó   i¼a     ¯¡ˆe   CRC-16");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		"ÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄ");

	while (fcount < MAXCMPLINE - 7) {
		if (archd.method == 0) break;
		if (archd.method < 2 || archd.method > 11) break;
		stamp = ((dword)archd.date << 16) + archd.time;
		rate = (archd.org_size - archd.cmp_size) * 100 / archd.org_size;
		orgtotal += archd.org_size;
		cmptotal += archd.cmp_size;
		fcount++;

		cmpitems[cmp_max] = (char *)malloc((size_t)70);
		sprintf(cmpitems[cmp_max++], "%-12s %7lu  %7lu %2d%% %-7s"
			" %02d-%02d-%02d %02d:%02d:%02d %04X\0",
			archd.name, archd.org_size, archd.cmp_size,
			(int)rate, ARCmethod[archd.method - 2],
			year(stamp), month(stamp), day(stamp),
			hour(stamp), minute(stamp), sec(stamp),
			archd.crc16);

		lseek(chandle, archd.cmp_size, SEEK_CUR);
		if (read(chandle, &archd, sizeof(archd)) != sizeof(archd) || archd.sig != ARC_SIG)
			break;
	}

	cmpEndList();
}

char     cmpIsARC()
{
	lseek(chandle, 0, SEEK_SET);
	if (read(chandle, &archd, sizeof(archd)) == sizeof(archd) && archd.sig == ARC_SIG) {
		cmpARCList();
		return(hgTRUE);
	}
	else return(hgFALSE);
}

void     cmpARJList()
{
	char    *file;
	dword   rate, crc;
	unsigned  size, extsize, sig;

	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s is compressed by ARJ %1d.%1d %s\0",
		cmpfile, arjhd.ver1, arjhd.ver2,
		sfx ? " /Self-eXtracted" : "");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		" ÑÁ·© ·¡Ÿq    ´sÂ‚¸å   ´sÂ‚Ò ·I ´sÂ‚¤w¤ó   i¼a     ¯¡ˆe   CRC-32");
	cmpitems[cmp_max] = (char *)malloc((size_t)70);
	sprintf(cmpitems[cmp_max++], "%s\0",
		"ÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄÔÄ");

	while (fcount < MAXCMPLINE - 7) {
		if (read(chandle, &sig, 2) != 2 || sig != ARJ_SIG) break;
		if (read(chandle, &size, 2) != 2 || size > MAX_SIZE) break;
		if (size == 0) break;
		read(chandle, &arjhd, size);
		read(chandle, &crc, sizeof(crc));
		crc32 = CRC_MASK;
		cmpUpdateCRC32((char *)&arjhd, size);
		if ((crc32 ^ CRC_MASK) != crc) break;

		file = cmpSearchDir((char *)(&arjhd.first_hdsize + arjhd.first_hdsize), '/');
		rate = (arjhd.org_size - arjhd.cmp_size) * 100 / arjhd.org_size;
		orgtotal += arjhd.org_size;
		cmptotal += arjhd.cmp_size;
		fcount++;

		cmpitems[cmp_max] = (char *)malloc((size_t)70);
		sprintf(cmpitems[cmp_max++], "%-12s %7lu  %7lu %2d%% %-7s"
			" %02d-%02d-%02d %02d:%02d:%02d %08lX\0",
			file, arjhd.org_size, arjhd.cmp_size,
			(int)rate, ARJmethod[arjhd.method],
			year(arjhd.stamp), month(arjhd.stamp), day(arjhd.stamp),
			hour(arjhd.stamp), minute(arjhd.stamp), sec(arjhd.stamp),
			arjhd.crc32);

		while (read(chandle, &extsize, 2) == 2 && extsize != 0)
			lseek(chandle, extsize + 4, SEEK_CUR);
		lseek(chandle, arjhd.cmp_size, SEEK_CUR);
	}

	cmpEndList();
}

char     cmpIsARJ()
{
	int    i;
	char   flag, *ptr;
	dword  pos = 0x1000L, crc;
	unsigned  size, extsize, sig;

	if (sfx) {
		if (!((exehdr.reloffset == 0x001c
		   && exehdr.dummy0 == 0x4a52 && exehdr.dummy1 == 0x5853)
		   || (exehdr.hdrsize == 0x0002 && exehdr.minalloc == 0x0e3a
		   && exehdr.initss == 0x0f95 && exehdr.initsp == 0x0080
		   && exehdr.initcs == 0x0000 && exehdr.initip == 0x0003
		   && exehdr.reloffset == 0x001c
		   && exehdr.dummy0 == 0x000e && exehdr.dummy1 == 0x017e)))
			return(hgFALSE);

			/* ÑA”áˆa 1000H¦Èá 25000H¬a·¡µA ·¶·q */
		flag = hgFALSE;
		while (!flag && pos < MAX_SFX) {
			lseek(chandle, pos, SEEK_SET);
			if (read(chandle, cmp_buf, 4096) < 1) return(hgFALSE);

			ptr = cmp_buf;
			for (i = 0;i < 4092;i++, ptr++, pos++) {
				if (*ptr == '`' && *(ptr + 1) == ' '
				 && (size = *(unsigned *)(ptr + 2)) <= MAX_SIZE) {
					lseek(chandle, pos + 4, SEEK_SET);
					read(chandle, &arjhd, size);
					read(chandle, &crc, sizeof(crc));
					crc32 = CRC_MASK;
					cmpUpdateCRC32((char *)&arjhd, size);
					if ((crc32 ^ CRC_MASK) == crc) {
						while (read(chandle, &extsize, 2) == 2 && extsize != 0)
							lseek(chandle, (dword)(extsize + 4), SEEK_CUR);
						cmpARJList();
						flag = hgTRUE;
						break;
					}
				}
			}
		}
		return(flag);
	}
	else {
		lseek(chandle, 0, SEEK_SET);
		if (read(chandle, &sig, sizeof(sig)) != sizeof(sig) || sig != ARJ_SIG)
			return(hgFALSE);
		if (read(chandle, &size, sizeof(size)) != sizeof(size) || size > MAX_SIZE)
			return(hgFALSE);
		read(chandle, &arjhd, size);
		read(chandle, &crc, sizeof(crc));
		crc32 = CRC_MASK;
		cmpUpdateCRC32((char *)&arjhd, size);
		if ((crc32 ^ CRC_MASK) == crc) {
			while (read(chandle, &extsize, 2) == 2 && extsize != 0)
				lseek(chandle, (dword)(extsize + 4), SEEK_CUR);
			cmpARJList();
			return(hgTRUE);
		}
		else return(hgFALSE);
	}
}

int      cmpFindArchive(char archive)
{
	if (archive) {
		switch (archive) {
			case ZIP :
				if (cmpIsZIP()) return(ZIP);
				else break;
			case LZH :
				if (cmpIsLZH()) return(LZH);
				else break;
			case ARJ :
				if (cmpIsARJ()) return(ARJ);
				else break;
			case ARC :
				if (cmpIsARC()) return(ARC);
				else break;
		}
	}

	if (cmpIsZIP()) return(ZIP);
	if (cmpIsLZH()) return(LZH);
	if (cmpIsARJ()) return(ARJ);
	if (cmpIsARC()) return(ARC);
	return(UNKNOWN);
}

void     toupperstr(char *str)
{
	char  *ptr;

	ptr = str;
	while (*ptr) {
		*ptr = toupper(*ptr);
		ptr++;
	}
}
