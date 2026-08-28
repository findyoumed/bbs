/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : compact.h -- ´sÂ‚ ÑÁ·©· Š¹¡µA ”Ðe ÑA”á     |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __COMPACT_H
#define     __COMPACT_H

#ifdef      __cplusplus
extern      "C" {
#endif

typedef  unsigned long   dword;

#define     year(t)       ((unsigned)((t >> 25) & 0x7f) + 80)
#define     month(t)      ((unsigned)(t >> 21) & 0x0f)
#define     day(t)        ((unsigned)(t >> 16) & 0x1f)
#define     hour(t)       ((unsigned)(t >> 11) & 0x1f)
#define     minute(t)     ((unsigned)(t >> 5) & 0x3f)
#define     sec(t)        ((unsigned)((t & 0x1f) * 2))

#define     ZIP_LOCAL_SIG   0x04034b50L	/* ZIP Local File Header ID */
#define     ZIP_CENTRAL_SIG 0x02014b50L	/* ZIP Central Dir Entries ID */
#define     ZIP_END_SIG     0x06054b50L	/* ZIP End of Central Dir ID */
#define     ARC_SIG         0x1a	/* ARC Header ID */
#define     ARJ_SIG         0xea60	/* ARJ Main Header ID */
#define     CRC16POLY       0xa001
#define     CRC32POLY       0xedb88320L
#define     CRC_MASK        0xffffffffL

#define     MSDOS           0x4d

			/* ´sÂ‚ ÑÁ·©· ¹·ŸA */
#define     UNKNOWN         0
#define     ZIP             1
#define     LZH             2
#define     ARJ             3
#define     ARC             4

#define     MAX_SFX         25000L
#define     MAX_SIZE        2600

			/* ZIP Local File Header· Š¹¡ */
typedef  struct  zip_local {
	unsigned  ver;
	unsigned  flag;
	unsigned  method;
	dword     stamp;
	dword     crc32;
	dword     cmp_size;
	dword     org_size;
	unsigned  fn_len;
	unsigned  ext_len;
} ZIP_LOCAL;
			/* ZIP Central Directory Entries· Š¹¡ */
typedef  struct  zip_central {
	unsigned  ver1;
	unsigned  ver2;
	unsigned  flag;
	unsigned  method;
	dword     stamp;
	dword     crc32;
	dword     cmp_size;
	dword     org_size;
	unsigned  fn_len;
	unsigned  ext_len;
	unsigned  cmt_len;
	unsigned  start_disk_num;
	unsigned  int_attrib;
	dword     ext_attrib;
	dword     relative_offset;
} ZIP_CENTRAL;
			/* ZIP End of Central Directory· Š¹¡ */
typedef  struct  zip_end {
	unsigned  this_disk_num;
	unsigned  dir_start_disk_num;
	unsigned  total_dir_on_this_disk;
	unsigned  total_dir;
	dword     size_central;
	dword     central_start;
	unsigned  cmt_len;
} ZIP_END;

			/* LZH Header A¥I 1· Š¹¡ */
typedef  struct  lzh_hdr {
	byte      size;
	byte      sum;
	char      method[5];
	dword     packed;
	dword     original;
	time_t    stamp;
	byte      attr;
	byte      level;
	byte      fnlen;
	byte      fname;
	byte      dos;
	unsigned  extsize;
	char      temp[4070];
} LZH_HEADER;

typedef  struct  lzh_internal {
	unsigned  hdsize;
	time_t    stamp;
	unsigned  attrib;
	dword     skip;
	dword     packed;
	byte      info;
	byte      dos;
	char      method[6];
	unsigned  fnlen;
	unsigned  pathlen;
	char     *filename;
	char     *pathname;
	unsigned  headcrc;
	unsigned  filecrc;
	unsigned  extsize;
	char     *crcposn;
} LZH_INTERNAL;

			/* ARC Header· Š¹¡ */
typedef  struct  arc_hdr {
	byte      sig;
	byte      method;
	char      name[13];
	dword     cmp_size;
	unsigned  date;
	unsigned  time;
	unsigned  crc16;
	dword     org_size;
} ARC_HEADER;

			/* ARJ Local File Header· Š¹¡ */
typedef  struct  arj_hdr {
	byte      first_hdsize;
	byte      ver1;
	byte      ver2;
	byte      host_os;
	byte      flag;
	byte      method;
	byte      file_type;
	byte      reserved;
	dword     stamp;
	dword     cmp_size;
	dword     org_size;
	dword     crc32;
	unsigned  entry_posn;
	unsigned  file_mode;
	unsigned  host_data;
	byte      last[2570];
} ARJ_HEADER;

			/* EXE Header· Š¹¡ */
typedef  struct  exe_hdr {
	unsigned  id;
	unsigned  last;
	unsigned  size;
	unsigned  relsize;
	unsigned  hdrsize;
	unsigned  minalloc;
	unsigned  maxalloc;
	unsigned  initss;
	unsigned  initsp;
	unsigned  sum;
	unsigned  initip;
	unsigned  initcs;
	unsigned  reloffset;
	unsigned  overlay;
	unsigned  dummy0;
	unsigned  dummy1;
} EXE_HEADER;


#ifdef      __cplusplus
}
#endif

#endif

