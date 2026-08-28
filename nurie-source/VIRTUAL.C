/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : virtual.c  -- ˆa¬w ‹¡´â ¸wÃ¡ ¡¡—I             |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <dir.h>
#include    <dos.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     MAX_LOGICHANDLE  500

#define     MAX_CON_BUFF     50
#define     MAX_EMM_HANDLE   255
#define     MAX_HARD_BUFF    100

#define     EMM_DRIVER_INT   0x67	/* ÑÂ¸w ¡A¡¡Ÿ¡ ‰ÅŸ¡¸a —aœa·¡¤á ·¥ÈáœóËa ¤åÑ¡ */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     logic[MAX_LOGICHANDLE] = { 0,  };

byte    *vgbuff;			/* ÑÁ¡e ¸á¸w¶w ¸åµb ¤áÌá */
unsigned vgseg, vgoff;			/* ¸åµb ¤áÌá ­A‹a åËa, µ¡Ïa­U */

char     conflag;			/* Îaº… ¡A¡¡Ÿ¡ ¬a¶w µa¦ */
char     emmflag;			/* ÑÂ¸w ¡A¡¡Ÿ¡ ¬a¶w µa¦ */
char     hardflag;			/* Ða—a —¡¯aÇa ¬a¶w µa¦ */

char     vfmode = hgFALSE;

unsigned long consize = 0L;
unsigned long hardsize = 0L;

			/* ˆa¬w ‹¡´â ¸wÃ¡µA¬á· Îaº… ¡A¡¡Ÿ¡ Š¹¡ */
struct  con {
	int  logichandle;		/* ‘¥Ÿ¡¸â·¥ Ð…—i */
	unsigned  segment;		/* ­A‹a åËa */
	unsigned  offset;		/* µ¡Ïa­U */
	unsigned  size;			/* Ði”w–E Ça‹¡ */
} con_table[MAX_CON_BUFF] = { { 0, 0, 0, 0 }, };
byte    *conbuff[MAX_CON_BUFF];
int      conpos = 0;

			/* ˆa¬w ‹¡´â ¸wÃ¡µA¬á· ÑÂ¸w ¡A¡¡Ÿ¡ Š¹¡ */
struct  emm {
	int  logichandle;		/* ‘¥Ÿ¡¸â·¥ Ð…—i */
	int  logicalpage;		/* Ði”w–E ‘¥Ÿ¡¸â ÍA·¡»¡ ® */
	unsigned  emmhandle;		/* Ði”w–E Ð…—i */
} emm_table[MAX_EMM_HANDLE] = { { 0, 0, 0 }, };
unsigned ftbuff;			/* expanded segment */
int      emmpos = 0;

			/* ˆa¬w ‹¡´â ¸wÃ¡µA¬á· Ða—a —¡¯aÇa Š¹¡ */
struct  hard {
	int  logichandle;		/* ‘¥Ÿ¡¸â·¥ Ð…—i */
	unsigned  size;			/* Ði”w–E Ça‹¡ */
} hard_table[MAX_HARD_BUFF] = { { 0, 0 },  };
char     hardfile[MAX_HARD_BUFF][12];	/* ¯aµÁÏ· ÑÁ·© ¤µi */
char     swapdir[50] = { 0,  };		/* ¯aµÁÏ· ¡¢¢ */
int      hardpos = 0;

union    REGS     reg;
struct   SREGS    segr;

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgVMEMInit(unsigned size);
void     hgVMEMEnd();

int      findlogichandle();
void     deletelogichandle(int logichandle);

int      findcontable(int logichandle);
VMEM    *hgVMallocCON(unsigned size);
void     hgVFreeCON(VMEM **p);
void     hgVSetBuffCON(VMEM *p);
void     hgVSaveBuffCON(VMEM *p);
unsigned long   hgVGetFreeCON();

char     hgEMM_IsInstalled();
char     hgEMM_IsEnoughPages(int pages);
int      hgEMM_GetFreePages();
int      hgEMM_GetTotalPages();
char     hgEMM_AllocatePages(int pages, unsigned *emm_handle);
char     hgEMM_MapPages(unsigned handle, int ppage, int lpage);
char     hgEMM_GetAddress(char **pf_ptr);
unsigned hgEMM_GetSeg();
char     hgEMM_FreeHandle(unsigned emm_handle);
char     hgEMM_GetVersion(char *str);
int      hgEMM_GetHandleCount();
int      hgEMM_GetHandlePages(unsigned handle);
int      hgEMM_GetPhysicalNumber();
int      hgEMM_GetPhysicalTable(PHYSICAL_PAGE *p);
int      findemmhandle(int logichandle);
void     mappingpages(VMEM *p, int logic);
VMEM    *hgVMallocEMM(unsigned size);
void     hgVFreeEMM(VMEM **p);
void     hgVSetBuffEMM(VMEM *p);
void     hgVSaveBuffEMM(VMEM *p);

int      findhardtable(int logichandle);
VMEM    *hgVMallocHARD(unsigned size);
void     hgVFreeHARD(VMEM **p);
void     hgVSetBuffHARD(VMEM *p);
void     hgVSaveBuffHARD(VMEM *p);
unsigned long   hgVGetFreeHARD();
void     hgSetSwapDir(char *direc);

VMEM    *hgVMalloc(unsigned size);
void     hgVFree(VMEM **p);
void     hgVSetBuff(VMEM *p);
void     hgVSaveBuff(VMEM *p);

void     hgSetCONOn();
void     hgSetCONOff();
void     hgSetEMMOn();
void     hgSetEMMOff();
void     hgSetHARDOn();
void     hgSetHARDOff();
void     hgSetCONLimit(unsigned long limit);
void     hgForceCON();
void     hgAutoCON();


void     hgVMEMInit(unsigned size)
{
	if (size < 1 || size > 64) size = 64;
	if (size != 64) size = (unsigned)(size * 1024);
	else size = 0xffff;

	vgbuff = (byte *)malloc((size_t)size);
	vgseg = FP_SEG(vgbuff);
	vgoff = FP_OFF(vgbuff);

	hardflag = getdisk() - 1;
	if (hardflag > 0) hardsize = hgVGetFreeHARD();

	emmflag = hgEMM_IsInstalled();
	if (emmflag) {
		ftbuff = hgEMM_GetSeg();
		consize = (unsigned long)128 * 1024L;
	}

	conflag = hgTRUE;
	consize = (unsigned long)256 * 1024L;
	if (consize > hgVGetFreeCON()) consize = hgVGetFreeCON();
}

void     hgVMEMEnd()
{
	free(vgbuff);
}

int      findlogichandle()
{
	int   pos;

	for (pos = 0;pos < MAX_LOGICHANDLE;pos++)
		if (logic[pos] == 0) break;
	if (pos == MAX_LOGICHANDLE) return(0);

	logic[pos] = 1;

	return(pos + 1);		/* ‘¥Ÿ¡¸â·¥ Ð…—i·e 1¦Èá ¤åÑ¡ ¦µa */
}

void     deletelogichandle(int logichandle)
{
	logic[logichandle - 1] = 0;
}

int      findcontable(int logichandle)
{
	int   pos;

	for (pos = 0;pos < MAX_CON_BUFF;pos++)
		if (con_table[pos].logichandle == logichandle) return(pos);
	return(-1);
}

VMEM    *hgVMallocCON(unsigned size)
{
	VMEM  *p;

	int   pos, pos2;
	unsigned  seg, off;

	if (!conflag)  return(NULL);

	pos = findlogichandle();
	if (pos == 0) return(NULL);

	if (!vfmode)
		if (consize < (unsigned long)size) {
			deletelogichandle(pos);
			return(NULL);
		}

	consize -= (unsigned long)size;

	p = (VMEM *)malloc(sizeof(VMEM));
	p->type = CON;
	p->logichandle = pos;

	for (pos2 = 0;pos2 < MAX_CON_BUFF;pos2++)
		if (con_table[pos2].logichandle == 0) break;

	if (pos2 == MAX_CON_BUFF) {
		free(p);
		deletelogichandle(pos);
		consize += (unsigned long)size;
		return(NULL);
	}

	conpos = pos2;
	conbuff[conpos] = (byte *)malloc((size_t)size);
	if (conbuff[conpos] == NULL) {
		free(p);
		deletelogichandle(pos);
		consize += (unsigned long)size;
		return(NULL);
	}

	seg = FP_SEG(conbuff[conpos]);
	off = FP_OFF(conbuff[conpos]);

	con_table[conpos].logichandle = pos;
	con_table[conpos].segment = (unsigned)seg;
	con_table[conpos].offset = (unsigned)off;
	con_table[conpos].size = (unsigned)size;

	return(p);
}

void     hgVFreeCON(VMEM **p)
{
	int   pos;

	pos = findcontable((*p)->logichandle);
	if (pos == -1) return;

	deletelogichandle(con_table[pos].logichandle);
	con_table[pos].logichandle = 0;
	free(conbuff[pos]);
	free(*p);

	consize += (unsigned long)con_table[pos].size;
}

void     hgVSetBuffCON(VMEM *p)
{
	int   pos;

	pos = findcontable(p->logichandle);
	if (pos == -1) return;

	movedata(con_table[pos].segment, con_table[pos].offset, vgseg, vgoff, con_table[pos].size);
}

void     hgVSaveBuffCON(VMEM *p)
{
	int   pos;

	pos = findcontable(p->logichandle);
	if (pos == -1) return;

	movedata(vgseg, vgoff, con_table[pos].segment, con_table[pos].offset, con_table[pos].size);
}

unsigned long   hgVGetFreeCON()
{
	return((unsigned long)coreleft());
}

char     hgEMM_IsInstalled()
{
	char   *device = "EMMXXXX0";
	char   far  *int67name;
	char   temp[8];
	int    i;

	reg.h.ah = 0x35;
	reg.h.al = 0x67;

	intdosx(&reg, &reg, &segr);

	int67name = MK_FP(segr.es, 0x0a);

	for (i = 0;i < 8;i++)
		temp[i] = int67name[i];

	if (!memcmp(device, temp, 8)) return(hgSUCCESS);
	else return(hgFAIL);
}

char     hgEMM_IsEnoughPages(int pages)
{
	reg.h.ah = 0x42;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0 && pages <= reg.x.bx) return(hgSUCCESS);
	else return(hgFAIL);
}

int      hgEMM_GetFreePages()
{
	reg.h.ah = 0x42;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return(reg.x.bx);
	else return(0);
}

int      hgEMM_GetTotalPages()
{
	reg.h.ah = 0x42;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return(reg.x.dx);
	else return(0);
}

char     hgEMM_AllocatePages(int pages, unsigned *emm_handle)
{
	reg.h.ah = 0x43;
	reg.x.bx = pages;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) {
		*emm_handle = reg.x.dx;
		return(hgSUCCESS);
	}
	else return(hgFAIL);
}

char     hgEMM_MapPages(unsigned handle, int ppage, int lpage)
{
	reg.h.ah = 0x44;
	reg.h.al = ppage;
	reg.x.bx = lpage;
	reg.x.dx = handle;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return(hgSUCCESS);
	else return(hgFAIL);
}

char     hgEMM_GetAddress(char **pf_ptr)
{
	reg.h.ah = 0x41;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) {
		*pf_ptr = MK_FP(reg.x.bx, 0);
		return(hgSUCCESS);
	}
	else return(hgFAIL);
}

unsigned hgEMM_GetSeg()
{
	reg.h.ah = 0x41;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return((unsigned)reg.x.bx);
	else return(0);
}

char     hgEMM_FreeHandle(unsigned emm_handle)
{
	reg.h.ah = 0x45;
	reg.x.dx = emm_handle;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return(hgSUCCESS);
	else return(hgFAIL);
}

char     hgEMM_GetVersion(char *str)
{
	reg.h.ah = 0x46;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) {
		sprintf(str, "%d.%d\0", (reg.h.al & 0xf0) >> 4, reg.h.al & 0x0f);
		return(hgSUCCESS);
	}
	else return(hgFAIL);
}

int      hgEMM_GetHandleCount()
{
	reg.h.ah = 0x4b;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return(reg.x.bx);
	else return(0);
}

int      hgEMM_GetHandlePages(unsigned handle)
{
	reg.h.ah = 0x4c;
	reg.x.dx = handle;

	int86(EMM_DRIVER_INT, &reg, &reg);

	if (reg.h.ah == 0) return(reg.x.bx);
	else return(0);
}

int      hgEMM_GetPhysicalNumber()
{
	reg.x.ax = 0x5801;

	int86x(EMM_DRIVER_INT, &reg, &reg, &segr);

	if (reg.h.ah == 0) return(reg.x.cx);
	else return(0);
}

int      hgEMM_GetPhysicalTable(PHYSICAL_PAGE *p)
{
	reg.x.ax = 0x5800;
	segr.es = FP_SEG(p);
	reg.x.di = FP_OFF(p);

	int86x(EMM_DRIVER_INT, &reg, &reg, &segr);

	if (reg.h.ah == 0) return(reg.x.cx);
	else return(0);
}

int      findemmhandle(int logichandle)
{
	int   pos;

	for (pos = 0;pos < MAX_EMM_HANDLE;pos++)
		if (emm_table[pos].logichandle == logichandle) return(pos);
	return(-1);
}

void     mappingpages(VMEM *p, int logic)
{
	int   pos;

	pos = findemmhandle(p->logichandle);
	if (pos == -1) return;

	hgEMM_MapPages(emm_table[pos].emmhandle, 0, logic);
}

VMEM    *hgVMallocEMM(unsigned size)
{
	VMEM  *p;

	int   pos, pos2;
	unsigned  pages;
	unsigned  emmhandle;

	if (!emmflag) return(NULL);

	pos = findlogichandle();
	if (pos == 0) return(NULL);

	pages = (size / 16 / 1024) + 1;
	if (!hgEMM_IsEnoughPages(pages)) {
		deletelogichandle(pos);
		return(NULL);
	}

	p = (VMEM *)malloc(sizeof(VMEM));
	p->type = EMM;
	p->logichandle = pos;

	for (pos2 = 0;pos2 < MAX_EMM_HANDLE;pos2++)
		if (emm_table[pos2].logichandle == 0) break;

	if (pos2 == MAX_EMM_HANDLE) {
		free(p);
		deletelogichandle(pos);
		return(NULL);
	}

	if (!hgEMM_AllocatePages(pages, &emmhandle)) {
		free(p);
		deletelogichandle(pos);
		return(NULL);
	}

	emmpos = pos2;
	emm_table[emmpos].logichandle = pos;
	emm_table[emmpos].logicalpage = pages - 1;
	emm_table[emmpos].emmhandle = emmhandle;

	return(p);
}

void     hgVFreeEMM(VMEM **p)
{
	int   pos;

	pos = findemmhandle((*p)->logichandle);
	if (pos == -1) return;

	deletelogichandle((*p)->logichandle);
	emm_table[pos].logichandle = 0;
	hgEMM_FreeHandle(emm_table[pos].emmhandle);

	free(*p);
}

void     hgVSetBuffEMM(VMEM *p)
{
	int   pos, i;
	unsigned  offset = vgoff;

	pos = findemmhandle(p->logichandle);
	if (pos == -1) return;

	for (i = 0;i <= emm_table[pos].logicalpage;i++) {
		mappingpages(p, i);
		movedata(ftbuff, 0, vgseg, offset, 0x4000);
		offset += 0x4000;
	}
}

void     hgVSaveBuffEMM(VMEM *p)
{
	int   pos, i;
	unsigned  offset = vgoff;

	pos = findemmhandle(p->logichandle);
	if (pos == -1) return;

	for (i = 0;i <= emm_table[pos].logicalpage;i++) {
		mappingpages(p, i);
		movedata(vgseg, offset, ftbuff, 0, 0x4000);
		offset += 0x4000;
	}
}

int      findhardtable(int logichandle)
{
	int   pos;

	for (pos = 0;pos < MAX_HARD_BUFF;pos++)
		if (hard_table[pos].logichandle == logichandle) return(pos);
	return(-1);
}

VMEM    *hgVMallocHARD(unsigned size)
{
	VMEM  *p;

	char   temp[30];
	int    pos, pos2;

	if (hardflag < 1) return(NULL);

	pos = findlogichandle();
	if (pos == 0) return(NULL);

	if (hardsize < (unsigned long)size) {
		deletelogichandle(pos);
		return(NULL);
	}

	hardsize -= (unsigned long)size;

	p = (VMEM *)malloc(sizeof(VMEM));
	p->type = HARD;
	p->logichandle = pos;

	for (pos2 = 0;pos2 < MAX_HARD_BUFF;pos2++)
		if (hard_table[pos2].logichandle == 0) break;

	if (pos2 == MAX_HARD_BUFF) {
		free(p);
		deletelogichandle(pos);
		hardsize += (unsigned long)size;
		return(NULL);
	}

	hardpos = pos2;
	sprintf(hardfile[hardpos], "$%d.$$$", hardpos);
	hard_table[hardpos].logichandle = pos;
	hard_table[hardpos].size = (unsigned)size;

	return(p);
}

void     hgVFreeHARD(VMEM **p)
{
	char   temp[50];
	int    pos;

	pos = findhardtable((*p)->logichandle);
	if (pos == -1) return;

	deletelogichandle((*p)->logichandle);
	hard_table[pos].logichandle = 0;

	if (!swapdir[0]) strcpy(temp, hardfile[pos]);
	else {
		strcpy(temp, swapdir);
		strcat(temp, hardfile[pos]);
	}

	unlink(temp);
	hardsize += (unsigned long)hard_table[pos].size;

	free(*p);
}

void     hgVSetBuffHARD(VMEM *p)
{
	FILE  *fpt;

	char   temp[50];
	int    pos;

	pos = findhardtable(p->logichandle);
	if (pos == -1) return;

	if (!swapdir[0]) strcpy(temp, hardfile[pos]);
	else {
		strcpy(temp, swapdir);
		strcat(temp, hardfile[pos]);
	}

	fpt = fopen(temp, "rb");
	fread(vgbuff, hard_table[pos].size, 1, fpt);
	fclose(fpt);
}

void     hgVSaveBuffHARD(VMEM *p)
{
	FILE  *fpt;

	char   temp[50];
	int    pos;

	pos = findhardtable(p->logichandle);
	if (pos == -1) return;

	if (!swapdir[0]) strcpy(temp, hardfile[pos]);
	else {
		strcpy(temp, swapdir);
		strcat(temp, hardfile[pos]);
	}

	fpt = fopen(temp, "wb");
	fwrite(vgbuff, hard_table[pos].size, 1, fpt);
	fclose(fpt);
}

unsigned long   hgVGetFreeHARD()
{
	struct   dfree  dsk;

	unsigned long  size;

	getdfree(hardflag + 2, &dsk);
	size = (unsigned long)dsk.df_avail * dsk.df_sclus * dsk.df_bsec;

	return(size);
}

void     hgSetSwapDir(char *direc)
{
	FILE  *fpt;

	char  temp[50];
	char  drive[MAXDRIVE], dir[MAXDIR], name[MAXFILE], ext[MAXEXT];

	strcpy(temp, direc);
	strcat(temp, "$$$.$$$");

	fpt = fopen(temp, "wb");
	if (fpt == NULL) return;

	fclose(fpt);
	unlink(temp);
	strcpy(swapdir, direc);
	fnsplit(direc, drive, dir, name, ext);

	if (strcmp(drive, "")) {
		hardflag = toupper(drive[0]) - 'B';
		hardsize = hgVGetFreeHARD();
	}
}

VMEM    *hgVMalloc(unsigned size)
{
	VMEM  *p;

	p = hgVMallocCON(size);
	if (p != NULL) return(p);
	p = hgVMallocEMM(size);
	if (p != NULL) return(p);
	p = hgVMallocHARD(size);
	if (p != NULL) return(p);
	return(NULL);
}

void     hgVFree(VMEM **p)
{
	switch ((*p)->type) {
		case CON :
			hgVFreeCON(p);
			break;
		case EMM :
			hgVFreeEMM(p);
			break;
		case HARD :
			hgVFreeHARD(p);
			break;
	}
}

void     hgVSetBuff(VMEM *p)
{
	switch (p->type) {
		case CON :
			hgVSetBuffCON(p);
			break;
		case EMM :
			hgVSetBuffEMM(p);
			break;
		case HARD :
			hgVSetBuffHARD(p);
			break;
	}
}

void     hgVSaveBuff(VMEM *p)
{
	switch (p->type) {
		case CON :
			hgVSaveBuffCON(p);
			break;
		case EMM :
			hgVSaveBuffEMM(p);
			break;
		case HARD :
			hgVSaveBuffHARD(p);
			break;
	}
}

void     hgSetCONOn()
{
	conflag = hgTRUE;
}

void     hgSetCONOff()
{
	conflag = hgFALSE;
}

void     hgSetEMMOn()
{
	emmflag = hgTRUE;
}

void     hgSetEMMOff()
{
	emmflag = hgFALSE;
}

void     hgSetHARDOn()
{
	hardflag = hgTRUE;
}

void     hgSetHARDOff()
{
	hardflag = hgFALSE;
}

void     hgSetCONLimit(unsigned long limit)
{
	consize = (unsigned long)limit;
}

void     hgForceCON()
{
	vfmode = hgTRUE;
}

void     hgAutoCON()
{
	vfmode = hgFALSE;
}
