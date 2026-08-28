nurie.exe: \
	video.obj putch.obj attr.obj hanout.obj \
	key.obj automata.obj hanin.obj \
	codeconv.obj \
	modem.obj \
	plot.obj line.obj boxfill.obj circle.obj clrscr.obj cursor.obj \
	image.obj scroll.obj \
	mouse.obj \
	window.obj quick.obj dirbox.obj filedir.obj helpbox.obj \
	popup.obj telbox.obj hanja.obj graph.obj icon.obj pcx.obj \
	virtual.obj btree.obj data.obj dbf.obj \
	adlib.obj bank.obj rolread.obj rolplay.obj music.obj \
	editor.obj block.obj nre_edit.obj \
	crtout.obj chat.obj gomenu.obj compact.obj nre_comm.obj \
	status.obj hwp.obj cal.obj nurie.obj

	tlink /c /n /x @nurie.aut

.c.obj:
	tcc -Ic:\la\tc\include -Lc:\la\tc\lib -ml -c -v- $*.c
