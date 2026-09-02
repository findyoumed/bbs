#define   SVER "1.0 beta1.5"
#define   IVER  0x1B15
#define	 SUB       1  //  ¬á§a  ¡A“A
#define	 BBS       2  //  ‰A  ¯¡  Ìe
#define	 PDS       3  //  ¸a  ža  ¯©
#define	 OMAIL     4  //  ‰·ˆ  Íe»¡
#define	 RMAIL	  5  //  Íe»¡  ³a‹¡
#define	 WMAIL     6  //  Íe»¡  ·ª‹¡
#define	 MBOX		  7  //  Íe»¡¥¡‰ÅÐq
#define	 CHAT		  8  //  ”  ÑÁ  ¯©
#define	 JOIN		  9  //  ˆa·³  ¡A“A
#define	 VUSER	  10 //  ÒA¶¥  ˆñ¬‚
#define   EDITSELF  11
#define	 TBANK	  12 //  ¯¡ˆe  ·eÐ—
#define	 MSIG		  13 //  •·Ñ¡ÒA‰ÅŸ¡
#define	 NOTICE	  14 //  ‰·»¡  ¬aÐw
#define   SCRIPT    15 //
#define   CDROMPDS  16
#define   RDNPDS    17
#define   SMAIL     18
#define   MSEE      19
#define   WAIT      101  //  ¸ó­¢ ”‹¡
#define   INPUTID   102  //  ´a·¡—¡ ·³b
#define   CUT       103
// constant definition.
// these constants are used both in setup and mighty.
#define   CANCEL    -1     // this is for CFileSelector object.
#define   NOERR      0
#define   ERR      -10  //  error
struct menu_t
{
	 int X;
	 int color;
	 int head;
	 int grade;
	 int close;
	 int type;
	 int level;
	 int point;
	 int run;
	 int readlevel;
	 int writelevel;
	 int lowbirth;
	 int highbirth;
	 char index[7];
	 char title[21];
	 char go[9];
	 char ansifile[9];
	 char sysid[9];
	 char pass[9];
	 char bSecret;
	 unsigned f2,f3,f4,f5,f6: 1;
};
