#include <sys/mman.h>
#include <sys/types.h>
#include <sys/uio.h>

#include <fcntl.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "mapio.h"

static char	zeros[1024];

/* TODO: Win32 use MapViewOfFile() */
static int extend_map(MAPIO *mh, size_t newsize)
{
	int	oldpos=mh->pos;
	int	i;

	if(mh->mem)
		if(munmap(mh->mem, mh->size)==-1)
			return(-1);

	mh->size = newsize;

	mh->pos=lseek(mh->fd, 0, SEEK_END);
	while(mh->pos < mh->size) {
		i=write(mh->fd, zeros, mh->size-mh->pos > sizeof(zeros) ? sizeof(zeros) : mh->size-mh->pos);
		if(i < 0)
			return -1;
		mh->pos += i;
	}
	mh->pos=oldpos;

	/* TODO: Base prot on flags */
	mh->mem=mmap(0, mh->size, PROT_READ|PROT_WRITE, MAP_SHARED, mh->fd, 0);
	if(mh->mem == MAP_FAILED)
		return -1;

	return 0;
}

MAPIO *mapopen(const char *path, int flags, int perms, size_t size)
{
	MAPIO	*ret=(MAPIO *)malloc(sizeof(MAPIO));

	if(ret==NULL)
		goto error;
	memset(ret, 0, sizeof(*ret));

	/* This test must be AFTER the memset() */
	if(path==NULL)
		goto error;

	if((ret->path = strdup(path))==NULL)
		goto error;

	ret->flags=flags;
	ret->perms=perms;
	ret->size=size;

	ret->fd=open(path, flags, perms);
	if(ret->fd==-1)
		goto error;

	if(extend_map(ret, size)==-1)
		goto error;

	return(ret);

error:
	if(ret) {
		if(ret->fd != -1)
			close(ret->fd);
		if(ret->path)
			free(ret->path);
		free(ret);
	}
	return(NULL);
}

void *mapread(MAPIO *mh, int size, void **ptr)
{
	if(mh->pos + size <= mh->size)
		*ptr=((char *)mh->mem)+mh->pos;
	else
		*ptr=NULL;
	return(*ptr);
}

/*
 * NOTICE: A mapwrite() call *may* invalidate pointers previously returned by mapread()
 * This means you *can't* use the ptr returned by mapread() as the ptr in mapwrite()
 */
int mapwrite(MAPIO *mh, size_t size, void *ptr)
{
	/* Check that the write is inside of the region */
	if(mh->pos + size >= mh->size)
		if(extend_map(mh, mh->pos+size)==-1)
			return -1;

	memcpy(((char *)mh->mem) + mh->pos, ptr, size);
	return(size);
}

/*
 * NOTICE: A mapclose() call *will* invalidate all pointers previously returned by
 * mapread().
 */
int mapclose(MAPIO *mh)
{
	if(mh==NULL)
		return(-1);

	if(munmap(mh->mem, mh->size)==-1)
		return(-1);

	if(close(mh->fd)==-1)
		return(-1);

	if(mh->path)
		free(mh->path);
	free(mh);

	return(0);
}

/*
 * NOTICE: A mapseek() call *may* invalidate pointers previously returned by mapread()
 * This means you *can't* use the ptr returned by mapread() as the ptr in mapwrite()
 */
off_t mapseek(MAPIO *mh, off_t offset, int whence)
{
	off_t	ret;

	ret=lseek(mh->fd, offset, whence);
	if(ret==-1)
		return(-1);
	if(ret  > mh->size)
		if(extend_map(mh, offset)==-1)
			return -1;

	mh->pos=ret;
	return ret;
}
