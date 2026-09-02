#include "headers.h"
#define TOPS  5
#define MENUS 12


//-------------------------------------------------------------------------//
//                       READ  THIS  RIGHT NOW !!                          //
//-------------------------------------------------------------------------//
//   MIGHTY HOST SOURCE       WRITTEN BY KIM KANG MO     (C)REFINED SOFT   //
//                                                                         //
//   MIGHTY IS A SHAREWARE PROGRAM. I DISTRIBUTE THIS SOURCE ONLY TO KOREA //
//   UNIVERSITY COMPUTER SCIENCE. THIS HOST IS COMMERCIAL PROGRAM, SO COM- //
//   PILE AND SELLING THIS PROGRAM IS ILLEGAL. AND DISTRIBUTING THIS SOUR- //
//   CE TO ANOTHER PERSON IS ALSO ILLEGAL,EVEN HE IS KOREA UNIV, COMPUTER  //
//   SCIENCE STUDENT. ANYONE WHO IS KOREA UNIV.'CS STUDENT AND WHO TELLS ME//
//   "GIVE ME YOUR HOST SOURCE" CAN HAVE THIS SOURCE.                      //
//                                                                         //
//   ANYONE WHO GIVES THIS SOURCE TO OTHERS,                               //
//   ANYONE WHO SELLS TRANSFORMED PROGRAM BY COMPILING THIS SOURCE,        //
//   ANYONE WHO SELLS THIS SOURCE,                                         //
//   ANYONE WHO USES THIS PROGRAM AND THIS SOURCE FOR COMMECIAL PURPOSE    //
//                                                                         //
//   WILL BE PERISHED BY COPY RIGHT LAW.      1995.11.1 KIM KANGMO	       //
//                                                                         //
//-------------------------------------------------------------------------//
int tscrx, tscry;
void tF()
{}
void MightyIs()
{
	 CLogoWin LogoWin(21, 11, 60, 20, 0, 15, " a·¡Ë¡  Ñ¡¯aËa");
	 LogoWin.Run();
}
void halt()
{
	 char bEndProgram=0;
	 char *text[3] =
		 {  " a·¡Ë¡ ¬a¶w·i",
				"‹a e –¯¡‰V¯s“¡Œa?",
				""};
	 char *but[3] =
		 {  "´a“¡µ¡",
				"‘A",
				""};
	 if (ButtonBox(180, 200, text, but, bEndProgram) != ERR)
			SCR.pop();
	 if (bEndProgram==1) halt("Program ended successfully.");
}

void getWaitInit()
{
	 if ( BoxGetData(apx2ax(50),apy2ay(96), WaitInit, "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") != ERR )
			SCR.pop();
}

void getLocalInit()
{
	 if ( BoxGetData(apx2ax(50),apy2ay(112), LocalInit, "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") != ERR )
			SCR.pop();
}

void DoWaitInit()
{
	 int ret;
	 char *text[2] =
		 { "¡¡•Q·i Á¡‹¡ÑÁ Ðs“¡”a",
			 ""};
	 if ( SioDCD(port) )
	 {
			ErrMsg("µ¥œa·¥ ¬wÈµA¬á“e ³i® ´ô¯s“¡”a");
			return;
	 }
	 ret = StdMsg(180, 130, text);
	 SioHayes(port, WaitInit);
	 delay(800);
	 if (ret != ERR) SCR.pop();
}
void HangUp()
{
	 int ret;
	 char *text[2] =
		 { "¸åÑÁŸi g¯s“¡”a",
			 ""};

	 if (SioDCD(port))
	 {
			ret = StdMsg(180, 130, text);
			if (SioHangUp(port)) wputsxy(STATWIN, 8, 1, "¸ó­¢”‹¡º—");
			if (ret != ERR) SCR.pop();
			bSysopHangUp = 1;
	 }
	 else ErrMsg("µ¥œa·¥ ¬wÈˆa ´a“³“¡”a.");
}
void getexistSysop()
{
	 char *text[2] =
		 {  "·A¸á ¸ó­¢¯¡ ¯¡¬s ·A¢",
				""};
	 char *but[3] =
		 {  "´ô·q",
				"·¶·q",
				""};
	 if ( ButtonBox(190, 84, text, but, existSysop) !=ERR)
			SCR.pop();
	 STAT_display();
}
void getbUsePartT()
{
	 char *text[2] =
		 {  "ÌaËaÈa·± ¬a¶wµa¦",
				""};
	 char *but[3] =
		 {  "´eÐe”a",
				"Ðe”a",
				""};
	 if (ButtonBox(190, 84, text, but, bUsePartT) !=ERR)
			SCR.pop();
	 STAT_display();
}
void getbSound()
{
	 char *text[2] =
		 {  "¯aÏ¡Äá ­¡Ÿ¡",
				""};
	 char *but[3] =
		 {  "q",
				"Åq",
				""};
	 if (ButtonBox(190, 100, text, but, bSound) !=ERR)
			SCR.pop();
	 STAT_display();
}

void getbTBank()
{
	 char *text[2] =
		 {  "¯¡ˆe·eÐ—",
				""};
	 char *but[3] =
		 {  "”hÓ±",
				"µiŸ±",
				""};
	 if (ButtonBox(190, 120, text, but, bTBank) !=ERR) SCR.pop();
	 STAT_display();
}

void InviteChat()
{
	  if (SioDCD(port))
	  {
				ReadDataFile(154);
				if ( AnswerIs('Y','N',true) )
				{
					 ungetxch(CR);
					 if ( appMenuObject( Type2I(CHAT) ) != ERR ) runOBJ->ExitLoop = 1;
				}
	  }
	  else
	  {
				char *text[6] =
					{
						"Ñe¸“e ¬a¶w¸aˆa ¸ó­¢Ðe",
						"¬wÈˆa ´a“¡‹¡ ˜¢…µA",
						"ÀË·µA Á¡À÷ Ði ®",
						"´ô¯s“¡”a.",
						""};

				int ret = StdMsg(230,170, text);
				getch();
				if (ret != ERR) SCR.pop();
	  }
}
void TemporarySysop()
{
	 if (aliveUSER)
	 {
		  if (bTempSysopOn == 0)
		  {
				bTempSysopOn = 1;
				RealGrade = USER.stU.OK;
				USER.stU.OK = SYSOP;
				ErrMsg("Ñe¸ ¬a¶w¸aŸi ·±¯¡ ¶…µw¸a¡ »¡¸÷Ðaµv¯s“¡”a");
		  }
		  else if (bTempSysopOn == 1)
		  {
				bTempSysopOn = 0;
				USER.stU.OK = RealGrade;
				ErrMsg("Ñe¸ ¬a¶w¸aŸi ¶¥œ ÒA¶¥—w‹s·a¡ ¤aŽ´á ‘½´v¯s“¡”a");
		  }
	 }
	 else
	 {
				char *text[6] =
					{
						"Ñe¸“e ¬a¶w¸aˆa ¸ó­¢Ðe",
						"¬wÈˆa ´a“¡‹¡ ˜¢…µA",
						"·±¯¡ ¶…µw¸a»¡¸÷·i Ði ®",
						"´ô¯s“¡”a.",
						""};

				int ret = StdMsg(230,170, text);
				getch();
				if (ret != ERR) SCR.pop();

	 }
}

char *UserSetTitle[5]= { "¸ñ  ®   ¥e  ‰w",
								 "A  ¥I   ¥e  ‰w",
								 "q·e ¯¡ˆe  ¥e‰w",
								 "”a¶…Ðá¶wœ· ¥e‰w",
								 "" };
void ChangeUserStatus(int barno, char *title, int& data)
{
	 char tData[5];

	 int ret = SCR.push(tscrx+132,tscry+LS*barno,tscrx+132+(2+strlen(title))*CS+10,tscry+LS*(2+barno)+5);

	 box3d(tscrx+132, tscry+LS*barno,tscrx+132+(2+strlen(title))*CS+10,tscry+LS*barno+LS*2+5,7,15,8);
	 rCOLOR.push();
	 hsetcolor(1); hsetbkcolor(7);
	 hprintfpxy(tscrx+132+CS+5, tscry+LS*barno+5, "%s",title);
	 hgotopxy(tscrx+132+CS+5, tscry+5+LS*(1+barno));
	 memset(tData,0,5);
	 hsetcolor(0);  hsetbkcolor(10);
	 hprintfpxy(tscrx+132+CS+5, tscry+5+LS*(1+barno), "%-4i", data);
	 hgetln(tData, 4);
	 rCOLOR.pop();
	 if ( strcmp(tData, "") ) data = atoi(tData);

	 if (ret != ERR) SCR.pop();
}
void ChangePoint()
{
	 ChangeUserStatus(0, "¸ñ®", USER.stU.Point);
	 USER.SetLevel();
}
void ChangeLevel()
{
	 ChangeUserStatus(1, "A¥I", USER.stU.Level);
}
void ChangeTime()
{
	 ChangeUserStatus(2, "q·e¯¡ˆe", USER.stU.LeftTime);
}
void ChangeDnableSize()
{
	 ChangeUserStatus(3, "”a¶…ˆa“wœ·(KB)", USER.stU.DnableSize);
}
void (*UserSetFunc[5])(void) =
	  { ChangePoint, ChangeLevel, ChangeTime, ChangeDnableSize, NULL };
void UserSet()
{
	 int ret;
	 if (aliveUSER)
	 {
			tscrx=361; tscry=155;
			ret = PopupBox(tscrx, tscry, 15, 10, 7, 1, UserSetTitle, UserSetFunc);
			if ( ret != ERR ) SCR.pop();
	 }
	 else
	 {
			char *text[6] =
				{
					"Ñe¸“e ¬a¶w¸aˆa ¸ó­¢Ðe",
					"¬wÈˆa ´a“¡‹¡ ˜¢…µA",
					"¬a¶w¸a ¸÷¥¡Ÿi ¤aŽ‰ ®",
					"´ô¯s“¡”a.",
					""};

			ret = StdMsg(230,170, text);
			getch();
			if (ret != ERR) SCR.pop();
	 }
}
void ChatModeOn()
{
		int x, y, maxy, nscroll;
		x = hwherex();
		y = hwherey();
		maxy = hgetmaxay();
		nscroll=CBOXLINES+2-(maxy-y);
		for (int i=1; i<=nscroll; i++) hscroll();
		int bkcol, col;
		col = hgetcolor();
		bkcol = hgetbkcolor();
		hsetbkcolor(1);
		hsetcolor(14);
		hputsxy(1,hgetmaxay()-(CBOXLINES+1)," ”ÑÁ ¤b¯a  [ ‹aŸ±¢…¸a @G ]                                                     ");
		wclrscr(CHATWIN);
		hsetcolor(col);
		hsetbkcolor(bkcol);
		hwindow(1, 1, 80, hgetmaxay()-(CBOXLINES+2));
		hgotoxy(x, y-nscroll);
		bChatMode = 1;
}
void ChatModeOff()
{
		int x,y;
		x= hwherex();
		y= hwherey();
		hwindow(1, hgetmaxay()-(CBOXLINES+1), 80, hgetmaxay()-1);
		hclrscr();
		hwindow(1, 1, 80, hgetmaxay()-1);
		hgotoxy(x,y);
		bChatMode = 0;
}

void ChatBox()
{
	  if (bWaiting)
	  {
				char *text[6] =
					{
						"¸ó­¢ ”‹¡¬wÈµA¬á“e",
						"¬a¶wÐi ® ´ô¯s“¡”a.",
						""};

				int ret = StdMsg(230,170, text);
				getch();
				if (ret != ERR) SCR.pop();
	  } else if (bFrameExist) //when frame window is active.
	  {

				char *text[6] =
					{
						"¬¡¶…  ¶å•¡¶ˆa  ÑÁ¡eµA",
						"·¶·a¡e ¬a¶wÐi ® ´ô¯s“¡”a.",
						""};

				int ret = StdMsg(230,170, text);
				getch();
				if (ret != ERR) SCR.pop();
	  }
	  else
	  {
		  if (bChatMode) ChatModeOff();
		  else ChatModeOn();
	  }
}
void SysopMenu()
{
	  CSMWin SMWin(2, 3, 79, 28, 0, 15, "¶…µw¸a ¡A“A");
	  SMWin.Run();
}
void LocalConnect()
{
	 if (bLocal == 1)
	 {
			ErrMsg("Ñe¸ ¡Äé ¸ó­¢ º—·³“¡”a");
			return;
	 }
	 bWaiting=0;
	 bLocal=1;
	 SioHayes(port,LocalInit);
	 SioDelay(9);
	 SioRxFlush(port);
	 SioTxFlush(port);
}
void RunProg(char* prog)
{
	 int ret;
	 ret = SCR.push(ax2apx(1),ay2apy(1),ax2apx(80)+CS-1,ay2apy(29)+LS-1);

	 hrestorecrtmode();
	 system(prog);
	 hsetgraphmode();

	 if (ret ==NOERR) SCR.pop();

	 STAT_display();
}

void DoDosShell()
{
	 if ( !bWaiting && !bLocal ) ReadDataFile(40);
	 RunProg("command.com");
}
void RunCommProg()
{
	 if ( !bWaiting && !bLocal ) ReadDataFile(189);
	 RunProg(EmulPro);
}
void RunEditProg()
{
	 if ( !bWaiting && !bLocal ) ReadDataFile(190);
	 RunProg(EditPro);
}
void SendFile()
{
	 if (bWaiting)
	 {
				char *text[4] =
					{
						"¸ó­¢ ”‹¡ ¬wÈµA¬á“e",
						"¡A¡¡Ÿ¡ Íe»¡Ÿi ¥¡‰®",
						"´ô¯s“¡”a.",
						""};

				int ret = StdMsg(230,170, text);
				getch();
				if (ret != ERR) SCR.pop();

	 }
	 else
	 {
			 char path[200], FileName[13], ch;
			 long size,NowReading=0;
			 CFileSelector *FSEL=new CFileSelector(160,100,7,1,5);//uses PathBuffer
			 int ret = FSEL->SelectFile(path,FileName, size);
			 delete FSEL;
			 if (ret!=CANCEL)
			 {
				  FILE* fRead= fopen(strcat2(path, FileName),"rb");
				  ungetxch(CR);
				  if (bChatMode) hlastcurwindow();
				  while( ++NowReading <= size )
				  {
						 ch = fgetc(fRead);
						 c_hputch( ch );
						 if (ch=='\n') c_hputch('\r');
				  }
				  fclose(fRead);
				  if (bChatMode) htempcurwindow(CHATWIN);
			 }
	 }
}
void (*func[TOPS][MENUS])() =
		 {
				{MightyIs, DoDosShell, tF, halt},
				{getWaitInit, getLocalInit, DoWaitInit, tF, HangUp},
				{getexistSysop, getbUsePartT, getbSound, getbTBank, tF, InviteChat, TemporarySysop, UserSet, tF, LocalConnect},
				{ChatBox, SysopMenu},
				{tF, tF, tF, SendFile, tF, RunCommProg, RunEditProg},
		 };

char *PD_MENU[TOPS][MENUS] = {
						 {
							 " a·¡Ë¡œe...",
							 "•¡   ¯a  ®É  @D",
							 "SEPERATER",
							 "¹·       ža  @X"
						 },

						 {
							 "¸ó­¢ ”‹¡º— Á¡‹¡ÑÁ ¡ww  @I",
							 "¡Äé ¸ó­¢¯¡ Á¡‹¡ÑÁ ¡ww  ^I",
							 "¡¡•Q    Á¡‹¡ÑÁ   ¯¡Ç¡‹¡  @M",
							 "SEPERATER",
							 "¸å     ÑÁ     g     ‹¡  F6"
						 },

						 {
							 "¶…µw¸a  ·¶·q/ ´ô·q  F2",
							 "ÌaËaÈa·±  ¬a¶wµa¦  F3",
							 "¯aÏ¡Äá ­¡Ÿ¡  q/Åq  F4",
							 "¯¡ˆe·eÐ— µiŸ±/”hÓ±  F5",
							 "SEPERATER",
							 "À    Ë·   Á¡   À÷  F9",
							 "·±  ¯¡  ¶…  µw  ¸a  ^S",
							 "·A    ¸á   ¹¡   ¸÷  ^U",
							 "SEPERATER",
							 "¡    Äé   ¸ó   ­¢  @L"
						 },
						 {
							 "”   ÑÁ  ¬w  ¸a  @C",
							 "¶… µw ¸a  ¡A “A  @S",
						 },

						 {
							 "¤a·¡œá¯a   ˆñ¬a  @V",
							 "ÐÇ·¸aža   ˆñ¬a  @H",
							 "SEPERATER",
							 "¡A¡¡Ÿ¡    Íe»¡   @K",
							 "SEPERATER",
							 "É·¯¥ µA£IA·¡Èá  F7",
							 "¶A¦     µA—¡Èá  F8",
						 }
					 };
int ST[TOPS+1][MENUS+1] = {
					 { 1, 2,-1, 2, 0 },            // ST number
					 { 1, 1, 1,-1, 2, 0 },         // -1 : SEPERATOR
					 { 1, 1, 1, 1,-1, 2, 1, 1, -1, 2, 0 },      // 1 : run and do not exit PD
					 { 2, 1, 0 },
					 { 1, 1,-1, 2,-1, 1, 1, 0 },					// 2 : run and exit PD
					 { 0 }
				 };

char *TOP[TOPS] = {
							" a·¡Ë¡",
							"¡¡  •Q",
							"¶…µw I",
							"¶…µwII",
							"¥¡á¯a",
				 };


_PD::_PD(int x1, int y1, int _GAB, int _tL, int _tSL, int _tBK, int _tSBK, int _mL, int _mBL, int _mSL, int _mBK1, int _mBK2, int _mSBK, int _UL, int _DR)
{
	 int i,j,sum=0;
	 _scrX = x1;     _scrY = y1;
	 px = py = 0;
	 tL = _tL;  tSL = _tSL;  tBK = _tBK;   tSBK = _tSBK;
	 mL = _mL;  mSL = _mSL;  mBL = _mBL;
	 mBK1 = _mBK1;  mBK2 = _mBK2;   mSBK = _mSBK;
	 UL = _UL;  DR = _DR;
	 tx1 = ax2apx(_scrX+1)-7;
	 ty1 = ay2apy(_scrY)-7;
	 tx2 = ax2apx(81-_scrX)+7;
	 ty2 = ay2apy(_scrY+1)+7;

	 for (i=0; ST[i][0] != 0; i++)
	 {
		if (i > 9) break;
		sizeMENU[i]=0;
		for (j=0; ST[i][j] != 0; j++)
		{
			if ( (sizeMENU[i] < strlen( PD_MENU[i][j] )) && strcmp(PD_MENU[i][j],"SEPERATER") )
			 sizeMENU[i] = strlen( PD_MENU[i][j] );
			noMENU[i]=j;
		}
		pby[i]=0;
		sum+= lenTOP[i] = strlen( TOP[i] );
		noTOP=i;
	 }
	 if ( _GAB == 0 )
			 GAB = ( ( 80- (_scrX-1)*2 ) -  sum ) / ( noTOP + 2 );
	 else  GAB = _GAB;
	 TOP_X[0] = _scrX + GAB;
	 for (i=1; i<=noTOP; i++)  TOP_X[i] = TOP_X[i-1] + lenTOP[i-1] + GAB;
/*
	 ----    MY   THINKING   WAS   LIKE   THIS  ------
	 TOP_X[0] = _scrX + GAB;
	 TOP_X[1] = TOP_X[0] + lenTOP[0] + GAB;
	 .....
	 .....
	 TOP_X[noTOP] = TOP_X[noTOP-1] + lenTOP[noTOP-1] + GAB;
*/
	 for (i=0; i<=noTOP; i++)
	 {
		 if ( TOP_X[i] < 3 ) MENU_X[i] = 3;
		 else MENU_X[i] = TOP_X[i];
	 }
}
void _PD::topBar()
{
	 int i;
	 rCOLOR.push();
	 htempwindow(1,1,80,30);
	 if ( SCR.push(tx1, ty1, tx2, ty2) != NOERR ) bBarBK=ERR;
	 box3d( tx1, ty1, tx2, ty2, tBK, UL, DR );
	 hsetcolor(tL);
	 hsetbkcolor(tBK);
	 for (i=0; i<=noTOP; i++)
	 {
			 box3d(  ax2apx( TOP_X[i] )-3,  ay2apy(_scrY)-3,
							 ax2apx( TOP_X[i]+strlen( TOP[i]) )+3,  ay2apy(_scrY+1)+3,
							tBK, UL, DR );
			 hputsxy((TOP_X[i]), _scrY, TOP[i]);
	 }
	 rCOLOR.pop();
	 hlastwindow();
}
void _PD::menuBar(int mode)
{
	 if (mode == 0)
	 {
		setfillstyle(1,mBK2);
		hsetbkcolor(mBK2);
		hsetcolor(mL);
	 }
	 if (mode == 1)
	 {

		setfillstyle(1,mSBK);
		hsetbkcolor(mSBK);
		hsetcolor(mSL);
	 }
		bar( mx1+1,ay2apy(_scrY+2+py),mx2-1,ay2apy(_scrY+3+py)-1);
		hputsxy(MENU_X[px],_scrY +2 +py,PD_MENU[px][py]);
		//hprintfxy(50,29,"%d,%d",mx1,ay2apy(_scrY+3+py));
}

void _PD::TopButton(int mode)
{
	 if (mode == 0)
	 {
			 box3d(  ax2apx( TOP_X[px] )-3,  ay2apy(_scrY)-3,
							 ax2apx( TOP_X[px]+strlen( TOP[px]) )+3,  ay2apy(_scrY+1)+3,
							 tBK, UL, DR );
			 hsetcolor( tL );
			 hsetbkcolor(tBK);
			 hputsxy(TOP_X[px],_scrY,TOP[px]);
	 }
	 if (mode == 1)
	 {
			 box3d(  ax2apx( TOP_X[px] )-3,  ay2apy(_scrY)-3,
							 ax2apx( TOP_X[px]+strlen( TOP[px]) )+3,  ay2apy(_scrY+1)+3,
							 tSBK, DR, UL );
			 hsetcolor(tSL);
			 hsetbkcolor(tSBK);
			 hputsxy(TOP_X[px], _scrY, TOP[px]);
	 }
}
int _PD::menuBoard()
{
	 int bMBsaved;
	 char ch;
	 int j, retcode=0;
	 mx1 = ax2apx(MENU_X[px]) - 7;
	 my1 = ay2apy(_scrY+2)-3;
	 mx2 = ax2apx(MENU_X[px] + sizeMENU[px] ) + 7;
	 my2 = ay2apy(_scrY + 3 + noMENU[px]) + 3;

	 bMBsaved = SCR.push(mx1-8, ty1, mx2+8, my2+4);
	 TopButton(1);

	 box3d(mx1-8, my1-4, mx2+8, my2+4, mBK1, UL, DR);
	 box3d(mx1, my1, mx2, my2, mBK2, UL, DR);
	 hsetbkcolor(mBK2);

	 for (j=0; j<=noMENU[px]; j++)
	 {
		 if ( !strcmp( PD_MENU[px][j], "SEPERATER" ) )
		 {
			setcolor(DR);
			line(mx1+1,ay2apy(_scrY+2+j)+3,mx2-1,ay2apy(_scrY+2+j)+3);
			setfillstyle(1,mBK1);
			bar(mx1,ay2apy(_scrY+2+j)+4,mx2,ay2apy(_scrY+2+j)+11);
			setcolor(UL);
			line(mx1+1,ay2apy(_scrY+2+j)+12,mx2-1,ay2apy(_scrY+2+j)+12);
		 }
		 else
		 {
			 if ( ST[px][j] == -1 ) hsetcolor(mBL);
			 else hsetcolor(mL);
			 hputsxy(MENU_X[px],_scrY +2 +j, PD_MENU[px][j]);
		 }
	 }
	 py = pby[px];

	 menuBar(1);
	 while ( !retcode )
	 {
		 if (kbhit())
		 {
			 ch = getch();
			 if (ch == 0)
			 {
					ch = getch();
					switch (ch)
					{
						 case _UPARR :
									menuBar(0);
									if ( py == 0 ) py=noMENU[px];
									else
									{
										 if ( (ST[px][py-1]==-1) ) py-=2;
										 else py--;
									}
									menuBar(1);
									break;
						 case _DNARR :
									menuBar(0);
									if ( py == noMENU[px] ) py=0;
									else
									{
										 if ( (ST[px][py+1]==-1) ) py+=2;
										 else py++;
									}
									menuBar(1);
									break;
						 case _LTARR :
									retcode = 1;
									break;
						 case _RTARR :
									retcode = 2;
									break;
						 default :
									ungetch(ch);
									process_ctrlkey(0);
					}
			 }
			 if (ch==13)
			 {
						if ( ST[px][py]==2 ) retcode=3;
						else (*func[px][py])();
			 }
			 if (ch==27) retcode = -1;
		 }
		 else time_process();
	 }
	 if (bMBsaved == NOERR) SCR.pop();

	 pby[px]=py;
	 TopButton(0);

	 return retcode;
}

int _PD::move_topBar()
{
	char ch;
	int exitloop=0;
	TopButton(1);

	while ( !exitloop )
	{
		if (kbhit())
		{
			 ch = getch();
			 if ( ch==0 )
			 {
					ch = getch();
					switch(ch)
					{
					 case	_RTARR :
							TopButton(0);
							if ( px == noTOP ) px = 0;
							else px++;
							TopButton(1);
							break;
					 case	_LTARR :
							TopButton(0);
							if ( px == 0 ) px = noTOP;
							else px--;
							TopButton(1);
							break;
					 case	_DNARR :
							exitloop=1;
							break;
					 default :
							ungetch(ch);
							process_ctrlkey(0);
					}
			 }
			 if ( ch==13 ) return 0;
			 if ( ch==27 ) return -1;
		}
		else time_process();
	}
}

void _PD::run()
{
	 int ret,exitpd=0;
	 bPDrun=1;  // external value --> determines to print message or not
	 rCOLOR.push();
	 topBar();
	 htempwindow(1,1,SCRWIDTH, SCRHEIGHT);
	 while ( !exitpd )
	 {
		 ret=menuBoard();
		 switch (ret)
		 {
			case 1 :       //  <---
								 if ( px == 0 ) px = noTOP;
								 else px--;
								 break;
			case 2 :       //  --->
								 if ( px == noTOP ) px = 0;
								 else px++;
								 break;
			case 3 :        exitpd =1;
								 break;
			case -1 :
					 if (move_topBar()== -1) exitpd = 1;

		 }
	 }
	 if (bBarBK!=ERR) SCR.pop();
	 rCOLOR.pop();
	 hlastwindow();

	 if (ret==3 && ST[px][py]==2) (*func[px][py])();

	 bPDrun=0;
}
_SCR::_SCR()
{
	 top = -1;
}
_SCR::~_SCR()
{
	 while (top >= 0) delete pXmsImg[top--];
}

_SCR::push(int x1, int y1, int x2, int y2)
{

	 if (++top==20) return SS_ERR;
	 htempwindow(1,1,80,30);

	 pXmsImg[top] = new CXmsImage();
	 pXmsImg[top]->get(x1,y1,x2,y2);

	 hlastwindow();
	 return NOERR;
}
int _SCR::pop()
{
	 if (top==-1) return SS_ERR;
	 htempwindow(1,1,80,30);

	 pXmsImg[top]->put();
	 delete pXmsImg[top];

	 top--;
	 hlastwindow();
	 return NOERR;
}

CXmsImage::CXmsImage()
{
   settile(20,20);
	bSuccess = 0;
}
CXmsImage::~CXmsImage()
{
	if ( hndXmsImg )
	  if (XMMfree( hndXmsImg )!=0) ErrMsg("ERROR : XMS free failed");
}
void CXmsImage::settile(int _sizeX, int _sizeY)
{
   TileXSize = _sizeX;
   TileYSize = _sizeY;
   xdoff = himagesize(1,1,_sizeX,_sizeY);
}

void CXmsImage::get(int x1, int y1, int x2, int y2)
{
   unsigned char far* pTile;
   unsigned long TileSize;
	int tX, tY, tX1, tX2, tY1, tY2;

	x = x1;
   y = y1;


	nTileX = (x2 - x1 + 1) / TileXSize;
   nTileY = (y2 - y1 + 1) / TileYSize;

   LastTileXSize = (x2 - x1 + 1) % TileXSize;
   LastTileYSize = (y2 - y1 + 1) % TileYSize;

   ydoff = nTileX*xdoff;

   if (LastTileXSize == 0) LastTileXSize = TileXSize;
   else
   {
	   ++nTileX;
	   ydoff += himagesize(1,1,LastTileXSize-1,TileYSize);
   }
	if (LastTileYSize == 0) LastTileYSize = TileYSize;
   else ++nTileY;

   if (XMMcoreleft() < ydoff*nTileY)
	{
	   ErrMsg("ERROR : Can't allocate XMS");
		return;
   }
   hndXmsImg = XMMalloc( ydoff*nTileY );

   for (tY=1; tY<= nTileY; tY++)
	 for (tX=1; tX<= nTileX; tX++)
	 {

		 tX1 = x1+(tX-1)*TileXSize;
		 tY1 = y1+(tY-1)*TileYSize;

		 if (tX == nTileX) tX2 = x1+(tX-1)*TileXSize+LastTileXSize-1;
		 else tX2 = x1+tX*TileXSize-1;

		 if (tY == nTileY) tY2 = y1+(tY-1)*TileYSize+LastTileYSize-1;
		 else tY2 = y1+tY*TileYSize-1;

		 TileSize = himagesize(tX1, tY1, tX2, tY2);
		 pTile = (char*) malloc(TileSize);
		 if (pTile == NULL)
		 {
			 ErrMsg("Not enough memory");
			 return;
		 }


		 hgetimage(tX1, tY1, tX2, tY2, pTile);

		 XMMcopyto(TileSize,
				   pTile,
				   hndXmsImg,(tY -1) * ydoff + (tX-1) * xdoff );
		 hputimage(tX1, tY1,pTile);
		 free(pTile);


	 }
	bSuccess = 1;
}

void CXmsImage::put()
{
   unsigned char far* pTile;
   unsigned long TileSize;
   int tX, tY, tX1, tX2, tY1, tY2;

   if ( !bSuccess ) return;


   for (tY=1; tY<= nTileY; tY++)
	 for (tX=1; tX<= nTileX; tX++)
	 {

		 tX1 = x+(tX-1)*TileXSize;
		 tY1 = y+(tY-1)*TileYSize;

		 if (tX == nTileX) tX2 = x+(tX-1)*TileXSize+LastTileXSize-1;
		 else tX2 = x+tX*TileXSize-1;

		 if (tY == nTileY) tY2 = y+(tY-1)*TileYSize+LastTileYSize-1;
		 else tY2 = y+tY*TileYSize-1;

		 TileSize = himagesize(tX1, tY1, tX2, tY2);

		 pTile = (char*) malloc(TileSize);
		 if (pTile == NULL) return;


		 XMMcopyfrom( TileSize,
					  hndXmsImg, (tY -1) * ydoff + (tX-1) * xdoff,
					  pTile  );

		 hputimage(tX1, tY1, pTile);

		 free(pTile);
	 }
}


_rCOLOR::_rCOLOR()
{
	 top = -1;
}

_rCOLOR::push()
{
	 if (++top==10) return ERR;
	 COLORS[top].hc = hgetcolor();
	 COLORS[top].hbkc = hgetbkcolor();
	 COLORS[top].c = getcolor();
	 COLORS[top].bkc = getbkcolor();
	 COLORS[top].x=hwherex();
	 COLORS[top].y=hwherey();
}
_rCOLOR::pop()
{
	 if (top==-1) return ERR;
	 hsetcolor(COLORS[top].hc);
	 hsetbkcolor(COLORS[top].hbkc);
	 setcolor(COLORS[top].c);
	 setbkcolor(COLORS[top].bkc);
	 hgotoxy(COLORS[top].x, COLORS[top].y);
	 top--;
}








