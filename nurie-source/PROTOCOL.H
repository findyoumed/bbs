/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : protocol.h -- Ðq® ¶¥Ñw· ¬å´å                |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __PROTOCOL_H
#define     __PROTOCOL_H

#ifdef      __cplusplus
extern      "C" {
#endif

			/* 1 st menu */
void     nreAboutComm(), nreHelpComm();
void     nreMusicPlay(), nreCalendar();
void     nreIdDBF(), nreGoMenu();
void     nreDosComm(), nreShellComm();
void     comEndRoutine();
			/* 2 nd menu */
void     nrePortNum(), nreSpeedBPS();
void     nreParityBit(), nreDataBit();
void     nreStopBit(), nrePhoneType();
void     nreInitType(), nreModemStatus();
			/* 3 rd menu */
void     nreHostHangul(), nreTerminal();
void     nreDelayTime(), nreDialDelay();
void     nreChainDial(), nreUpMethod();
void     nreDownMethod(), nreSaveCfg();
			/* 4 th menu */
void     nreFileUp(), nreFileDown();
void     edMainRoutine(), nreDownDir();
void     nreScreenCapture(), nreCaptureToggle();
void     nrePCXFileDisplay(), nreSeeHWP();
void     nreCompactView();
			/* 5 th menu */
void     comClearAll(), nreLineToggle();
void     nreDialing(), nreChatting();
void     nreMacro(), nreDebugToggle();
void     nreHangUp(), nreBreak();
			/* 6 th menu */
void     nreHanInTypeMain(), nreEngFontMain();
void     nreHanFontMain(), nreHanjaFileMain();
void     nreHanjaConv(), nreSelectMenuFile();
void     nreChangeCrtColor(), nreCursorMain();
void     nreMouseCursMain();
			/* 7 th menu */
void     nreToggleAnsi(), nreInitModem();
void     nreEchoToggle(), nre1vs1Comm();
void     nreTabChange(), nreSetInitCSI();
void     nreChatMan();
			/* 8 th menu */
void     nreSendCSI(), nreSendRI();
void     nreSendIND(), nreSendNEL();

			/* 1 st menu */
void     nreAboutEdit(), nreHelpEdit();
void     nreShellEdit(), edEndRoutine();
			/* 2 nd menu */
void     nreNewEdit(), nreLoadEdit();
void     nreReloadEdit(), nreWritetoEdit();
void     nreSaveEdit(), nreDirEdit();
void     nreChDirEdit();
			/* 3 rd menu */
void     nreHanInTypeMain(), nreEngFontMain();
void     nreHanFontMain(), nreHanjaFileMain();
void     nreChangeEdColor(), nreCursorMain();
void     nreMouseCursMain();


#ifdef      __cplusplus
}
#endif

#endif
