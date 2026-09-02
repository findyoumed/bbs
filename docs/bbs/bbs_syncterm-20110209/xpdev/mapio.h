#ifndef _MAPIO_H_
#define _MAPIO_H_

typedef struct _MAPIO {
	int	fd;
	int	flags;
	int	pos;
	int	perms;
	size_t	size;
	void *	mem;
	char *	path;
} MAPIO;

MAPIO *mapopen(const char *path, int flags, int perms, size_t size);
void *mapread(MAPIO *mh, int size, void **ptr);
int mapwrite(MAPIO *mh, size_t size, void *ptr);
int mapclose(MAPIO *mh);
off_t mapseek(MAPIO *mh, off_t offset, int whence);

#endif
