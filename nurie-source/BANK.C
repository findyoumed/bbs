/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : bank.c  -- ¤—Ça ÑÁ·© ¡¡—I                     |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <dos.h>
#include    <fcntl.h>
#include    <string.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "adbank.h"			/* ¤—Ça ÑÁ·©· Š¹¡µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     EXPAND_NR    32		/* 32ˆ³¢· ´b‹¡® »wˆa */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

int      adOpenBank(char *fname, int wflag, BankPtr bkp);
int      adCreateBank(char *fname, BankPtr bkp);
int      adHeaderUpdate(BankPtr bkp);
int      adCloseBank(BankPtr bkp);

int      adReadTimbreName(int index, char *ins_name, BankPtr bkp);
int      adReadTimbreDef(char *ins_name, Timbre *timbre, BankPtr bkp);
int      adWriteTimbre(char *ins_name, Timbre *timbre, BankPtr bkp);
int      adDeleteTimbre(char *ins_name, BankPtr bkp);
void     adSeekNthEntry(int index, BankPtr bkp);
int      adGetNthEntry(int index, BankEntry *entry, BankPtr bkp);
void     adSeekNthTimbre(int index, BankPtr bkp);
int      adEntrySearch(char *ins_name, int *index, BankPtr bkp);
int      adExpandFile(int ins_num, BankPtr bkp);
int      adInsertEntry(char *ins_name, BankPtr bkp);
int      adDeleteEntry(char *ins_name, BankPtr bkp);


int      adOpenBank(char *fname, int wflag, BankPtr bkp)
{
	int   handle;
	int   access;

	access = wflag ? O_RDWR : O_RDONLY;
	handle = open(fname, access + O_BINARY);
	if (handle == -1) return(BANK_NOT_FOUND);

	read(handle, (char *)&bkp->hd, sizeof(BankHeader));
	if ((strncmp(bkp->hd.sig, BANK_SIG, BANK_SIG_LEN))) {
		close(handle);
		return(BAD_BANK_FILE);
	}
	bkp->handle = handle;
	return(BANK_OK);
}

#ifdef      BANK_WRITE_ACCESS

int      adCreateBank(char *fname, BankPtr bkp)
{
	BankHeader  *hd;

	int   handle;
	int   ret;

	handle = open(fname, O_BINARY | O_RDWR | O_CREAT | O_EXCL);
	if (handle == -1) return(CREATE_ERROR);

	bkp->handle = handle;
	hd = &bkp->hd;
	hd->major = MAJ_VERSION;
	hd->minor = MIN_VERSION;
	memmove(hd->sig, BANK_SIG, BANK_SIG_LEN);
	hd->ins_num = 0;
	hd->max_num = 0;
	hd->offsetList = sizeof(BankHeader);
	hd->offsetTimbre = sizeof(BankHeader);
	memset(hd->filler, 0, BANK_FILLER_SIZE);

	ret = adHeaderUpdate(bkp);
	if (ret != BANK_OK) unlink(fname);
	return(ret);
}

#endif

#ifdef      BANK_WRITE_ACCESS

int      adHeaderUpdate(BankPtr bkp)
{
	int   size;

	lseek(bkp->handle, 0L, SEEK_SET);
	size = write(bkp->handle, (char *)&bkp->hd, sizeof(BankHeader));
	return((size == sizeof(BankHeader) ? BANK_OK : READ_WRITE_ERR));
}

#endif

int      adCloseBank(BankPtr bkp)
{
	int   ret;

	ret = close(bkp->handle);
	bkp->handle = -1;
	return(ret);
}

#ifdef      BANK_WRITE_ACCESS

int      adReadTimbreName(int index, char *ins_name, BankPtr bkp)
{
	BankEntry  entry;

	if (!adGetNthEntry(index, &entry, bkp))	return(NOT_DEFINED);

	strcpy(ins_name, entry.name);
	return(BANK_OK);
}

#endif

int      adReadTimbreDef(char *ins_name, Timbre *timbre, BankPtr bkp)
{
	BankEntry  entry;
	PackedTimbre  ptimbre;

	int   i, index;
	int   *ptr;

	if (!adEntrySearch(ins_name, &index, bkp)) return(NOT_DEFINED);

	adSeekNthTimbre(index, bkp);
	read(bkp->handle, (char *)&ptimbre, sizeof(PackedTimbre));

	timbre->mode = ptimbre.mode;
	timbre->voice = ptimbre.voice;
	for (i = 0, ptr = (int *)&timbre->op0;i < 13 * 2;i++)
		*ptr++ = ptimbre.param[i];
	timbre->wave0 = ptimbre.wave0;
	timbre->wave1 = ptimbre.wave1;
	return(BANK_OK);
}

#ifdef      BANK_WRITE_ACCESS

int      adWriteTimbre(char *ins_name, Timbre *timbre, BankPtr bkp)
{
	BankEntry  entry;
	PackedTimbre  ptimbre;

	int   i, index;
	int   size;
	int   ret;
	int   *ptr;

	ptimbre.mode = timbre->mode;
	ptimbre.voice = timbre->voice;
	for (i = 0, ptr = (int *)&timbre->op0;i < 13 * 2;i++)
		ptimbre.param[i] = *ptr++;
	ptimbre.wave0 = timbre->wave0;
	ptimbre.wave1 = timbre->wave1;

	if (!adEntrySearch(ins_name, &index, bkp)) {
		index = adInsertEntry(ins_name, bkp);
		bkp->hd.ins_num++;
	}

	adSeekNthTimbre(index, bkp);
	size = write(bkp->handle, (char *)&ptimbre, sizeof(PackedTimbre));
	if (size != sizeof(PackedTimbre)) return(READ_WRITE_ERR);

	ret = adHeaderUpdate(bkp);
	return(ret);
}

#endif

#ifdef      BANK_WRITE_ACCESS

int      adDeleteTimbre(char *ins_name, BankPtr bkp)
{
	return((adDeleteEntry(ins_name, bkp) ? BANK_OK : NOT_DEFINED));
}

#endif

void     adSeekNthEntry(int index, BankPtr bkp)
{
	long   offset;

	offset = bkp->hd.offsetList + index * sizeof(BankEntry);
	lseek(bkp->handle, offset, SEEK_SET);
}

int      adGetNthEntry(int index, BankEntry *entry, BankPtr bkp)
{
	if (index >= bkp->hd.max_num) return(hgFAIL);

	adSeekNthEntry(index, bkp);
	read(bkp->handle, (char *)entry, sizeof(BankEntry));
	if (!entry->active) return(hgFAIL);
	else return(hgSUCCESS);
}

void     adSeekNthTimbre(int index, BankPtr bkp)
{
	long   offset;

	offset = bkp->hd.offsetTimbre + index * sizeof(PackedTimbre);
	lseek(bkp->handle, offset, SEEK_SET);
}

int      adEntrySearch(char *ins_name, int *index, BankPtr bkp)
{
	BankEntry  entry;

	int   top, bottom, mid;
	int   diff;

	top = 0;
	bottom = bkp->hd.ins_num - 1;
	mid = (top + bottom) >> 1;

	do {
		adGetNthEntry(mid, &entry, bkp);
		diff = strcmpi(ins_name, entry.name);
		if (diff) {
			if (diff < 0) bottom = mid - 1;
			else top = mid + 1;
			mid = (bottom + top) >> 1;
		}
	} while (diff && top <= bottom);

	if (diff) return(hgFAIL);

	*index = entry.index;
	return(hgSUCCESS);
}

#ifdef      BANK_WRITE_ACCESS

int      adExpandFile(int ins_num, BankPtr bkp)
{
	BankEntry  entry;
	PackedTimbre  ptimbre;

	long   offset;
	long   newsize;
	int    size;
	int    i, index;
	int    ret;

	size = ins_num * sizeof(BankEntry);

	offset = bkp->hd.offsetTimbre + bkp->hd.max_num * sizeof(PackedTimbre);
	newsize = offset + size + ins_num * sizeof(PackedTimbre);
	if ((chsize(bkp->handle, newsize)) == -1) return(READ_WRITE_ERR);

	for (i = bkp->hd.max_num;i > 0;i--) {
		offset -= sizeof(PackedTimbre);
		lseek(bkp->handle, offset, SEEK_SET);
		read(bkp->handle, (char *)&ptimbre, sizeof(PackedTimbre));
		lseek(bkp->handle, offset + size, SEEK_SET);
		write(bkp->handle, (char *)&ptimbre, sizeof(PackedTimbre));
	}

	index = bkp->hd.max_num;
	adSeekNthEntry(index, bkp);

	entry.active = hgFALSE;
	memset(entry.name, 0, 9);
	for (i = ins_num;i > 0;i--) {
		entry.index = index;
		write(bkp->handle, (char *)&entry, sizeof(BankEntry));
		index++;
	}

	bkp->hd.offsetTimbre += size;
	bkp->hd.max_num += ins_num;

	ret = adHeaderUpdate(bkp);
	return(ret);
}

#endif

#ifdef      BANK_WRITE_ACCESS

int      adInsertEntry(char *ins_name, BankPtr bkp)
{
	BankEntry  entry;

	int   n;
	int   index;
	int   diff;

	if (bkp->hd.ins_num == bkp->hd.max_num) adExpandFile(EXPAND_NR, bkp);

	index = bkp->hd.ins_num - 1;
	adGetNthEntry(index + 1, &entry, bkp);
	n = entry.index;

	do {
		if (index != -1) {
			adGetNthEntry(index, &entry, bkp);
			diff = strcmpi(ins_name, entry.name);
		}
		else {
			adSeekNthEntry(0, bkp);
			diff = 1;
		}

		if (diff > 0) {
			memset(entry.name, 0, 9);
			strcpy(entry.name, ins_name);
			entry.index = n;
			entry.active = hgTRUE;
		}

		index--;
		write(bkp->handle, (char *)&entry, sizeof(BankEntry));
	} while (diff <= 0);

	return(n);
}

int      adDeleteEntry(char *ins_name, BankPtr bkp)
{
	BankEntry  entry, entry2;

	int   i, j;
	int   index;

	index = bkp->hd.ins_num;
	for (i = 0;i < index;i++) {
		adGetNthEntry(i, &entry, bkp);
		if (!(strcmpi(entry.name, ins_name))) break;
	}

	if (i < index) {
		for (j = i + 1;j < index;j++) {
			adGetNthEntry(j, &entry2, bkp);
			adSeekNthEntry(j - 1, bkp);
			write(bkp->handle, (char *)&entry2, sizeof(BankEntry));
		}

		adSeekNthEntry(index - 1, bkp);
		entry.active = hgFALSE;
		entry.name[0] = '-';
		write(bkp->handle, (char *)&entry, sizeof(BankEntry));

		bkp->hd.ins_num--;

		adHeaderUpdate(bkp);
		return(hgSUCCESS);
	}
	return(hgFAIL);
}

#endif
