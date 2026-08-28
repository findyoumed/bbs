/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : data.c  -- •A·¡Èa ÑÁ·©· ‰ÅŸ¡ ¡¡—I            |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <alloc.h>
#include    <fcntl.h>
#include    <io.h>
#include    <string.h>
#include    <sys\stat.h>
#include    <errno.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "data.h"			/* •A·¡Èa ÑÁ·©µA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

HEADER       Dheader[MAXDATAFILE];	/* header data of data file */

int          Dhandle[MAXDATAFILE];	/* •A·¡ÈaÑÁ·©µA ¬a¶w–A“e Ð…—i ¤åÑ¡ */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  declaration                           |
 |-------------------------------------------------------------------*/

long     btmovepos(int handleno, long DataRef);
long     btReadData(int handleno, long DataRef, byte *buff);
long     btWriteData(int handleno, long DataRef, byte *buff);
long     btAppendData(int handleno, byte *buff);

void     btInitData();
int      btIsValidDataHandle(int handleno);
void     btGetDataHeader(int handleno, HEADER *hd);
void     btSetDataHeader(int handleno, HEADER *hd);

int      btMakeDataFile(char *fname, int rec_size);
int      btOpenDataFile(char *fname, int rec_size, int keylen);
int      btCloseDataFile(int handleno);

long     btGetLastRecordNo(int handleno);


long     btmovepos(int handleno, long DataRef)
{
	long   pos;

	if (DataRef <= 0) return(-1L);

	pos = (long)(Dheader[handleno].data_size * (DataRef - 1) + DHDSIZE);
	lseek(Dhandle[handleno], pos, SEEK_SET);
	return(DataRef);
}

long     btReadData(int handleno, long DataRef, byte *buff)
{
	if (btmovepos(handleno, DataRef) == -1L) return(-1L);

	read(Dhandle[handleno], (byte *)buff, Dheader[handleno].data_size);
	return(DataRef);
}

long     btWriteData(int handleno, long DataRef, byte *buff)
{
	if (btmovepos(handleno, DataRef) == -1L) return(-1L);

	write(Dhandle[handleno], (byte *)buff, Dheader[handleno].data_size);
	return(DataRef);
}

long     btAppendData(int handleno, byte *buff)
{
	byte   *temp;
	long   DataRef;
	long   newsize;

	if (Dheader[handleno].del_rec == 0L) {
		DataRef = Dheader[handleno].next_rec++;
		newsize = DHDSIZE + DataRef * Dheader[handleno].data_size;
		if ((chsize(Dhandle[handleno], newsize)) == -1) {
			Dheader[handleno].next_rec--;
			return(-1L);
		}
	}
	else {
		DataRef = Dheader[handleno].del_rec;
		temp = (byte *)malloc((size_t)Dheader[handleno].data_size);
		if (btReadData(handleno, DataRef, temp) == -1L) {
			free(temp);
			return(-1L);
		}
		Dheader[handleno].del_rec = (long)*temp;
		free(temp);
	}

	if (btWriteData(handleno, DataRef, buff) == -1L) return(-1L);

	return(DataRef);
}

void     btInitData()
{
	int   i;

	for (i = 0;i < MAXDATAFILE;i++) {
		Dhandle[i] = 0;
		memset((byte *)&Dheader[i], '\0', (size_t)DHDSIZE);
	}
}

int      btIsValidDataHandle(int handleno)
{
	if (handleno >= MAXDATAFILE || handleno < 0 || Dhandle[handleno] == 0)
		return(hgFALSE);
	else return(hgTRUE);
}

void     btGetDataHeader(int handleno, HEADER *hd)
{
	*hd = Dheader[handleno];
}

void     btSetDataHeader(int handleno, HEADER *hd)
{
	Dheader[handleno] = *hd;
}

int      btMakeDataFile(char *fname, int rec_size)
{
	HEADER  hd;

	int   handle;

	memset((byte *)&hd, '\0', (size_t)DHDSIZE);
	hd.del_rec = 0L;
	hd.next_rec = 1L;
	hd.data_size = rec_size;

	handle = open(fname, NEW_MODE);
	write(handle, (HEADER *)&hd, DHDSIZE);
	close(handle);

	return(hgSUCCESS);
}

int      btOpenDataFile(char *fname, int rec_size, int keylen)
{
	int    i;
	char   dtafile[13];
	char   idxfile[13];

	for (i = 0;i < MAXDATAFILE;i++)
		if (Dhandle[i] == 0) break;
	if (i == MAXDATAFILE) return(-1);

	strcpy(dtafile, fname);
	strcpy(idxfile, fname);
	strcat(dtafile, ".dat");
	strcat(idxfile, ".ndx");

	if ((Dhandle[i] = open(dtafile, OPEN_MODE)) == -1) {
		switch (errno) {
			case ENOENT :
				btMakeDataFile(dtafile, rec_size);
				if (keylen != 0) btMakeIdxFile(idxfile, keylen, hgTRUE);
				if ((Dhandle[i] = open(dtafile, OPEN_MODE)) == -1) {
					Dhandle[i] = 0;
					return(-1);
				}
				break;
			case EMFILE :
			case EACCES :
				Dhandle[i] = 0;
				return(-1);
		}
	}

	lseek(Dhandle[i], 0L, SEEK_SET);
	read(Dhandle[i], (HEADER *)&Dheader[i], DHDSIZE);

	return(i);
}

int      btCloseDataFile(int handleno)
{
	if (!btIsValidDataHandle(handleno)) return(hgFAIL);

	lseek(Dhandle[handleno], 0L, SEEK_SET);
	write(Dhandle[handleno], (HEADER *)&Dheader[handleno], DHDSIZE);
	close(Dhandle[handleno]);
	Dhandle[handleno] = 0;

	return(hgSUCCESS);
}

long     btGetLastRecordNo(int handleno)
{
	return(Dheader[handleno].next_rec - 1);
}
