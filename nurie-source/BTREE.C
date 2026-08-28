/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : btree.c  -- B+ Tree ·¥•B¯a ‰ÅŸ¡ ¡¡—I          |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#include    <fcntl.h>
#include    <io.h>
#include    <string.h>
#include    <sys\stat.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */
#include    "btree.h"			/* B+ TreeµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Constants  &  Macro  Definition                             |
 |-------------------------------------------------------------------*/

#define     NEW_MODE     O_RDWR | O_BINARY | O_CREAT, S_IREAD | S_IWRITE
#define     OPEN_MODE    O_RDWR | O_BINARY

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

BHEADER   Bheader[MAXINDEXFILE];	/* header data of B+ Tree file */

int    Bhandle[MAXINDEXFILE];		/* B+ TreeÑÁ·©µA ¬a¶w–A“e ·¥•B¯a· Ð…—i ¤åÑ¡ */
long   CurNodeno[MAXINDEXFILE];		/* Ñe¸ Keyˆa ·¶“e ‘¡—a· ¤åÑ¡ */
int    CurKeyno[MAXINDEXFILE];		/* Ñe¸ ‘¡—aµA¬á· Keyˆa ·¶“e ¶áÃ¡ */
BNODE  Buf[MAXINDEXFILE];		/* Ñe¸ ‘¡—aŸi ‹¡´â¯¡Ç© ¤áÌá */

int    DefaultIndexFileNo;		/* ‹¡º… ·¥•B¯aÑÁ·©Ð…—i */

/*--------------------------------------------------------------------|
 |       Function  Prototypes  declaration                            |
 |--------------------------------------------------------------------*/

void     strip_blank(byte *str);

long     btseek(int handleno, long NodeRef);
long     btReadNode(int handleno, long NodeRef, BNODE *buff);
long     btWriteNode(int handleno, long NodeRef, BNODE *buff);

int      btIsLeaf(BNODE *node);
int      btIsValidHandle(int handleno);
void     btInitIndex();
void     btMemoryNode(int handleno, long node_no, int key_no, BNODE *node);

void     btSetDefaultIdxFile(int handleno);
int      btMakeIdxFile(char *fname, int keylen, int dupflag);
int      btOpenIdxFile(char *fname);
int      btCloseIdxFile(int handleno);
int      btDefaultCloseIdxFile();

byte    *CP(int handleno, int n, BNODE *node);
long    *NP(int handleno, int n, BNODE *node);

int      btIsOverflow(int handleno, BNODE *node);
int      btIsUnderflow(int handleno, BNODE *node);

long     btGetNode(int handleno, BNODE *node);
int      btFindPos(int handleno, byte *key, BNODE *node);
int      btFindNode(int handleno, BNODE *node, byte *key, long *node_no, int *key_no);
void     btInsNodeKey(int handleno, BNODE *node, int key_no, byte *key, long DataRef);
long     btDelNodeKey(int handleno, BNODE *node, int key_no);
void     btMoveNodeData(int handleno, BNODE *snode, int sn, BNODE *dnode, int dn, int n);
int      btFindDownNodePos(int handleno, long NodeRef, BNODE *node);
int      btUpdateKey(int handleno, BNODE *node, BNODE *upnode, int up_pos, long NodeRef);

int      btSplite(int handleno, long NodeRef, BNODE *node);
int      btMerge(int handleno, long BaseRef, BNODE *base);

int      btInsKey(int handleno, byte *key, long DataRef);
int      btDefaultInsKey(byte *key, long DataRef);
int      btDelKey(int handleno, byte *key, long DataRef);
int      btDefaultDelKey(byte *key, long DataRef);
long     btFindKey(int handleno, byte *key);
long     btDefaultFindKey(byte *key);
long     btSearchKey(int handleno, byte *key);
long     btDefaultSearchKey(byte *key);
long     btFirstKey(int handleno);
long     btDefaultFirstKey();
long     btLastKey(int handleno);
long     btDefaultLastKey();
long     btBeforeKey(int handleno);
long     btDefaultBeforeKey();
long     btNextKey(int handleno);
long     btDefaultNextKey();
long     btPartKey(int handleno, byte *key);
long     btDefaultPartKey(byte *key);
long     btBeforePartKey(int handleno, byte *key);
long     btDefaultBeforePartKey(byte *key);
long     btNextPartKey(int handleno, byte *key);
long     btDefaultNextPartKey(byte *key);
long     btCurrentRef(int handleno);
long     btDefaultCurrentRef();
byte     *btCurrentKey(int handleno);
byte     *btDefaultCurrentKey();
long     btRecordCount(int handleno);
long     btDefaultRecordCount();


void     strip_blank(byte *str)
{
	int    i = 0;
	byte   *ptr;

	ptr = str;
	while ((*str) && (i++ < MAXINDEXLEN)) {
		if ((*str == ' ') || (*str == '\t')) str++;
		else *ptr++ = *str++;
	}
	*ptr = 0;
}

long     btseek(int handleno, long NodeRef)
{
	long   pos;

	if (NodeRef <= 0) return(-1L);

	pos = (long)(NDSIZE * (NodeRef - 1) + HDSIZE);
	lseek(Bhandle[handleno], pos, SEEK_SET);
	return(NodeRef);
}

long     btReadNode(int handleno, long NodeRef, BNODE *buff)
{
	if (btseek(handleno, NodeRef) == -1L) return(-1L);

	read(Bhandle[handleno], (BNODE *)buff, NDSIZE);
	return(NodeRef);
}

long     btWriteNode(int handleno, long NodeRef, BNODE *buff)
{
	if (btseek(handleno, NodeRef) == -1L) return(-1L);

	write(Bhandle[handleno], (BNODE *)buff, NDSIZE);
	return(NodeRef);
}

int      btIsLeaf(BNODE *node)
{
	if (node->leaf) return(hgTRUE);
	else return(hgFALSE);
}

int      btIsValidHandle(int handleno)
{
	if (handleno >= MAXINDEXFILE || handleno < 0 || Bhandle[handleno] == 0)
		return(hgFALSE);
	else return(hgTRUE);
}

void     btInitIndex()
{
	int   i;

	for (i = 0;i < MAXINDEXFILE;i++) {
		Bhandle[i] = 0;
		CurKeyno[i] = 0;
		CurNodeno[i] = 0L;
		memset((byte *)&Buf[i], '\0', (size_t)NDSIZE);
		memset((byte *)&Bheader[i], '\0', (size_t)HDSIZE);
	}
	btSetDefaultIdxFile(0);
}

void     btMemoryNode(int handleno, long node_no, int key_no, BNODE *node)
{
	CurNodeno[handleno] = node_no;
	CurKeyno[handleno] = key_no;
	memmove((byte *)&Buf[handleno], (byte *)node, (size_t)NDSIZE);

	btSetDefaultIdxFile(handleno);
}

void     btSetDefaultIdxFile(int handleno)
{
	if (btIsValidHandle(handleno)) DefaultIndexFileNo = handleno;
}

int      btMakeIdxFile(char *fname, int keylen, int dupflag)
{
	BHEADER  hd;

	int   handle;

	if (keylen > MAXINDEXLEN) return(hgFAIL);

	memset((byte *)&hd, '\0', (size_t)HDSIZE);
	hd.hdlen = HDSIZE;
	hd.nodelen = NDSIZE;
	hd.keylen = keylen;
	hd.maxkey = (NDSIZE - sizeof(int) * 2 - sizeof(long) * 4) / (keylen + sizeof(long)) - 1;
	hd.dupflag = dupflag;
	hd.incount = 0L;
	hd.delcount = 0L;
	hd.rootnode = 0L;
	hd.delnode = 0L;
	hd.nextnode = 1L;
	hd.leftmost = 0L;
	hd.rightmost = 0L;

	unlink(fname);
	handle = open(fname, NEW_MODE);
	write(handle, (BHEADER *)&hd, HDSIZE);
	close(handle);

	return(hgSUCCESS);
}

int      btOpenIdxFile(char *fname)
{
	int   i;

	for (i = 0;i < MAXINDEXFILE;i++)
		if (Bhandle[i] == 0) break;
	if (i == MAXINDEXFILE) return(-1);

	if ((Bhandle[i] = open(fname, OPEN_MODE)) == -1) {
		Bhandle[i] = 0;
		return(-1);
	}

	lseek(Bhandle[i], 0L, SEEK_SET);
	read(Bhandle[i], (BHEADER *)&Bheader[i], HDSIZE);
	CurNodeno[i] = 0L;
	CurKeyno[i] = 0;
	memset((byte *)&Buf[i], '\0', (size_t)NDSIZE);
	btSetDefaultIdxFile(i);

	return(i);
}

int      btCloseIdxFile(int handleno)
{
	if (!btIsValidHandle(handleno)) return(hgFAIL);

	lseek(Bhandle[handleno], 0L, SEEK_SET);
	write(Bhandle[handleno], (BHEADER *)&Bheader[handleno], HDSIZE);
	close(Bhandle[handleno]);
	Bhandle[handleno] = 0;

	return(hgSUCCESS);
}

int      btDefaultCloseIdxFile()
{
	return(btCloseIdxFile(DefaultIndexFileNo));
}

byte    *CP(int handleno, int n, BNODE *node)
{
	return((byte *)(node->rec + (n - 1) * KeySize(handleno)));
}

long    *NP(int handleno, int n, BNODE *node)
{
	return((long *)(node->rec + KeyLen(handleno) + (n - 1) * KeySize(handleno)));
}

int      btIsOverflow(int handleno, BNODE *node)
{
	if (node->count > Bheader[handleno].maxkey) return(hgTRUE);
	else return(hgFALSE);
}

int      btIsUnderflow(int handleno, BNODE *node)
{
	if (node->count < Bheader[handleno].maxkey / 2) return(hgTRUE);
	else return(hgFALSE);
}

long     btGetNode(int handleno, BNODE *node)
{
	long   NodeRef;
	long   newsize;

	if (Bheader[handleno].delnode == 0L) {
		NodeRef = Bheader[handleno].nextnode++;
		newsize = (long)(HDSIZE + NodeRef * NDSIZE);
		if ((chsize(Bhandle[handleno], newsize)) == -1) return(-1L);
	}
	else {
		NodeRef = Bheader[handleno].delnode;
		if (btReadNode(handleno, NodeRef, node) == -1L) return(-1L);
		Bheader[handleno].delnode = node->right;
	}

	memset((byte *)node, '\0', (size_t)NDSIZE);
	node->leaf = hgTRUE;
	node->count = 0;
	node->up = 0L;
	node->down = 0L;
	node->left = 0L;
	node->right = 0L;

	return(NodeRef);
}

int      btFindPos(int handleno, byte *key, BNODE *node)
{
	int    pos;
	byte   *cp;

	for (pos = 1;pos <= node->count;pos++) {
		cp = CP(handleno, pos, node);
		if (strcmp(cp, key) >= 0) break;
	}

	return(pos);
}

int      btFindNode(int handleno, BNODE *node, byte *key, long *node_no, int *key_no)
{
	int    pos;
	byte   *cp;
	long   *np;

	if ((*node_no = btReadNode(handleno, ROOT(handleno), node)) == -1L) return(hgFAIL);

	while (!btIsLeaf(node)) {
		pos = btFindPos(handleno, key, node) - 1;
		if (pos == 0) {
			if ((*node_no = btReadNode(handleno, node->down, node)) == -1L) return(hgFAIL);
		}
		else {
			np = NP(handleno, pos, node);
			if ((*node_no = btReadNode(handleno, *np, node)) == -1L) return(hgFAIL);
		}
	}
	*key_no = btFindPos(handleno, key, node);

	return(hgSUCCESS);
}

void     btInsNodeKey(int handleno, BNODE *node, int key_no, byte *key, long DataRef)
{
	int    count;
	byte   *cp;
	long   *np;

	cp = CP(handleno, key_no, node);
	if (node->count >= key_no)  {
		count = (node->count - key_no + 1) * KeySize(handleno);
		memmove((byte *)(cp + KeySize(handleno)), (byte *)cp, (size_t)count);
	}
	memmove((byte *)cp, (byte *)key, (size_t)KeySize(handleno));

	np = NP(handleno, key_no, node);
	*np = DataRef;
	node->count++;
}

long     btDelNodeKey(int handleno, BNODE *node, int key_no)
{
	int    count;
	byte   *cp;
	long   *np, NodeRef;

	np = NP(handleno, key_no, node);
	NodeRef = *np;
	if (node->count > key_no)  {
		cp = CP(handleno, key_no, node);
		count = (node->count - key_no) * KeySize(handleno);
		memmove((byte *)cp, (byte *)(cp + KeySize(handleno)), (size_t)count);
	}
	node->count--;

	return(NodeRef);
}

void     btMoveNodeData(int handleno, BNODE *snode, int sn, BNODE *dnode, int dn, int n)
{
	int    count;
	byte   *scp, *dcp;

	scp = CP(handleno, sn, snode);
	dcp = CP(handleno, dn, dnode);
	if (dnode->count >= dn) {
		count = (dnode->count - dn + 1) * KeySize(handleno);
		memmove((byte *)(dcp + n * KeySize(handleno)), (byte *)dcp, (size_t)count);
	}

	count = n * KeySize(handleno);
	memmove((byte *)dcp, (byte *)scp, (size_t)count);
	snode->count -= n;
	dnode->count += n;
}

int      btFindDownNodePos(int handleno, long NodeRef, BNODE *node)
{
	int    pos;
	long   *np;

	if (node->down == NodeRef) pos = 0;
	else {
		for (pos = 1;pos <= node->count;pos++) {
			np = NP(handleno, pos, node);
			if (NodeRef == *np) break;
		}
	}

	if (pos > node->count) pos = -1;

	return(pos);
}

int      btUpdateKey(int handleno, BNODE *node, BNODE *upnode, int up_pos, long NodeRef)
{
	BNODE  base;

	byte   *scp, *dcp;
	long   *np;

	base = *node;
	while (!base.leaf) {
		np = NP(handleno, base.count, &base);
		if (btReadNode(handleno, *np, &base) == -1L) return(hgFAIL);
	}

	scp = CP(handleno, base.count, &base);
	dcp = CP(handleno, up_pos, upnode);
	np = NP(handleno, up_pos, upnode);
	memmove(dcp, scp, (size_t)KeyLen(handleno));
	*np = NodeRef;

	return(hgSUCCESS);
}

int      btSplite(int handleno, long NodeRef, BNODE *node)
{
	BNODE  up_node, node2, r_node, t_node;

	int    mid, i, n = 0;
	long   *np, KeyRef;
	long   upnode_no, node2_no, rnode_no, tnode_no, key_no;

	if ((node2_no = btGetNode(handleno, &node2)) == -1L) return(hgFAIL);

	node2.leaf = node->leaf;
	mid = node->count / 2;
	btMoveNodeData(handleno, node, node->count - mid + 1, &node2, 1, mid);

	if (node->right != 0L) {
		if ((rnode_no = btReadNode(handleno, node->right, &r_node)) == -1L) return(hgFAIL);
		r_node.left = node2_no;

		if (btWriteNode(handleno, rnode_no, &r_node) == -1L) return(hgFAIL);
	}
	node2.right = node->right;
	node->right = node2_no;
	node2.left = NodeRef;

			/* ¦…µi–A“e ‘¡—aˆa root‘¡—a·¡¡e
			   ¬¡¶… root‘¡—aŸi  e—e”a. */
	if (ROOT(handleno) == NodeRef) {
		if ((upnode_no = btGetNode(handleno, &up_node)) == -1L) return(hgFAIL);

		ROOT(handleno) = upnode_no;
		up_node.leaf = hgFALSE;
		up_node.count = 1;
		btUpdateKey(handleno, node, &up_node, 1, node2_no);
		up_node.down = NodeRef;
	}
	else {
		if ((upnode_no = btReadNode(handleno, node->up, &up_node)) == -1L) return(hgFAIL);
		if ((n = btFindDownNodePos(handleno, NodeRef, &up_node)) == -1) return(hgFAIL);

		btInsNodeKey(handleno, &up_node, n + 1, " ", 0L);
		btUpdateKey(handleno, node, &up_node, n + 1, node2_no);
	}

	node->up = upnode_no;
	node2.up = upnode_no;

			/* Ñe¸‘¡—a· ¸a¯¢‘¡—a—i·¡ ˆx‰¡·¶“e upÏ©—aŸi ˆ—¯¥ */
	if (!node->leaf) {
		KeyRef = btDelNodeKey(handleno, node, node->count);
		node2.down = KeyRef;

		if ((tnode_no = btReadNode(handleno, node2.down, &t_node)) == -1L) return(hgFAIL);
		t_node.up = node2_no;

		if (btWriteNode(handleno, tnode_no, &t_node) == -1L) return(hgFAIL);

		btUpdateKey(handleno, node, &up_node, n + 1, node2_no);
		for (i = 1;i <= node2.count;i++) {
			np = NP(handleno, i, &node2);

			if ((tnode_no = btReadNode(handleno, *np, &t_node)) == -1L) return(hgFAIL);
			t_node.up = node2_no;

			if (btWriteNode(handleno, tnode_no, &t_node) == -1L) return(hgFAIL);
		}
	}

	if (btWriteNode(handleno, upnode_no, &up_node) == -1L) return(hgFAIL);
	if (btWriteNode(handleno, node2_no, &node2) == -1L) return(hgFAIL);
	if (btWriteNode(handleno, NodeRef, node) == -1L) return(hgFAIL);

	if (btIsOverflow(handleno, &up_node)) {
		if (btSplite(handleno, upnode_no, &up_node) == hgFAIL) return(hgFAIL);
	}

	return(hgSUCCESS);
}

int      btMerge(int handleno, long BaseRef, BNODE *base)
{
	BNODE  up_node, node2, r_node, t_node;

	int    up_pos, flag = 1;
	int    i, n, updateflag = 1;
	byte   *cp;
	long   *np, KeyRef;
	long   upnode_no, node2_no, rnode_no, tnode_no;

	if (ROOT(handleno) == BaseRef) {
		if (base->count == 0) {
			ROOT(handleno) = 0L;
			base->right = Bheader[handleno].delnode;
			Bheader[handleno].delnode = BaseRef;
		}
		return(hgSUCCESS);
	}

	if (base->right != 0L) {
		if ((node2_no = btReadNode(handleno, base->right, &node2)) == -1L) return(hgFAIL);
		if (base->up != node2.up) flag = 0;
	}
	else flag = 0;

			/* Ðs¥wÐa“e ‘¡—a· µ¡Ÿe½¢ Ñw¹A‘¡—aˆa ´ôˆáa, µ¡Ÿe½¢ Ñw¹A‘¡—aµÁ
			   ¦¡¡‘¡—aˆa ˆ{»¡ ´g·a¡e Ðs¥wÐa“e ‘¡—a· ¶E½¢ ‘¡—aˆa ‹¡º… ‘¡—aˆa –E”a. */
	if (!flag) {
		if ((BaseRef = btReadNode(handleno, base->left, base)) == -1L) return(hgFAIL);
		if ((node2_no = btReadNode(handleno, base->right, &node2)) == -1L) return(hgFAIL);
	}

	if (base->up != node2.up) return(hgFAIL);
	if ((upnode_no = btReadNode(handleno, base->up, &up_node)) == -1L) return(hgFAIL);
	if ((up_pos = btFindDownNodePos(handleno, node2_no, &up_node)) == -1) return(hgFAIL);

	if (!base->leaf) {
		cp = CP(handleno, up_pos, &up_node);
		btInsNodeKey(handleno, base, base->count + 1, cp, node2.down);
	}

	if (btDelNodeKey(handleno, &up_node, up_pos) == hgFAIL) return(hgFAIL);

			/* µ¡Ÿe½¢‘¡—a· •A·¡ÈaŸi ¡¡– ¶E½¢· ‹¡º…‘¡—aˆa ÂÀi˜Œa»¡ µ«‹¥”a.
			   ·¡˜ µ¡Ÿe½¢‘¡—a· •A·¡Èaˆa ¡¡– ¶E½¢· ‹¡º…‘¡—a¡ µ«‰a ˆv·a¡e
			   µ¡Ÿe½¢‘¡—aŸi ¬b¹A¯¡Ç¡‰¡, ”a µ«‰aˆa»¡ ´g‰¡ q´a·¶“e •A·¡Èaˆa
			   ·¶·a¡e ”a¯¡ ‹¡º…‘¡—aµÁ ‹¡º…‘¡—a· µ¡Ÿe½¢‘¡—aˆeµA •A·¡ÈaŸi
			   1/2³¢ ¦…¤Ðe”a. */
	n = Bheader[handleno].maxkey - base->count;
	if (node2.count < n) n = node2.count;
	if (n > 0) btMoveNodeData(handleno, &node2, 1, base, base->count + 1, n);
	if (node2.count > 0) {

			/* ¶E½¢·a¡ µ«‰aˆa‰¡ ´a»¢•¡ q´v·a¡e ¶E½¢·a¡ ˆeˆõ—i·i ”a¯¡
			   ¡yˆ ˆa¹aµÁ¬á ¹Á¶· ˆ•®Ÿi ˆ{‰AÐe”a. */
		n = ((base->count + node2.count) / 2) - node2.count;
		btMoveNodeData(handleno, base, base->count - n + 1, &node2, 1, n);
		if (!base->leaf) {
			if ((KeyRef = btDelNodeKey(handleno, base, base->count)) == hgFAIL) return(hgFAIL);
			node2.down = KeyRef;
		}
			/*  e·© ‹¡º…‘¡—aˆa ¦¡¡‘¡—a· downµA µe‰i–E ‘¡—aœa¡e, ¦¡¡‘¡—a·
			    … ´|µA ¸aŸ¡ ÐaaŸi ÑÂ¥¡Ða‰¡, ‹¡º…‘¡—a·  … –áµA ·¶“e Keyˆt·i
			   ¦¡¡‘¡—a· Àõ¤å¼ Keyˆt·a¡ Ða¡e¬á, ‹a Refˆt·¡ µ¡Ÿe½¢ ‘¡—aŸi
			   ˆaŸ¡Ç¡•¡¢ ¹¡¸÷Ðe”a. */
		if (BaseRef == up_node.down) {
			btInsNodeKey(handleno, &up_node, 1, " ", node2_no);
			btUpdateKey(handleno, base, &up_node, 1, node2_no);
			updateflag = 0;
		}
	}
	else {
		base->right = node2.right;
		if (node2.right != 0L) {
			if ((rnode_no = btReadNode(handleno, node2.right, &r_node)) == -1L) return(hgFAIL);
			r_node.left = BaseRef;

			if (btWriteNode(handleno, rnode_no, &r_node) == -1L) return(hgFAIL);
		}
		node2.right = Bheader[handleno].delnode;
		Bheader[handleno].delnode = node2_no;
	}

			/* µ¡Ÿe½¢ ‘¡—aµA ´a»¢•¡ Keyˆa q´a·¶‰¡, ´|µA¬á ¦¡¡‘¡—a· Keyˆt·i
			   update¯¡Ç¡»¡ ´g´v·a¡e, ‹¡º…‘¡—aµA¬á ˆa¸w Çe ˆt·i ˆa»¡‰¡ ·¶“e
			   Keyˆt·i ¦¡¡‘¡—aµA ¬s·³Ða‰¡, ·¡ Key· Refˆt·i µ¡Ÿe½¢ ‘¡—aŸi
			   ˆaŸ¡Ç¡‰A Ðe”a. */
	if ((node2.count > 0) && (updateflag)) {
		btInsNodeKey(handleno, &up_node, up_pos, " ", node2_no);
		btUpdateKey(handleno, base, &up_node, up_pos, node2_no);
	}

	if (!base->leaf) {
		for (i = 1;i <= base->count;i++) {
			np = NP(handleno, i, base);

			if ((tnode_no = btReadNode(handleno, *np, &t_node)) == -1L) return(hgFAIL);
			t_node.up = BaseRef;

			if (btWriteNode(handleno, tnode_no, &t_node) == -1L) return(hgFAIL);
		}

		if (node2.count > 0) {
			if ((tnode_no = btReadNode(handleno, node2.down, &t_node)) == -1L) return(hgFAIL);
			t_node.up = node2_no;

			if (btWriteNode(handleno, tnode_no, &t_node) == -1L) return(hgFAIL);

			for (i = 1;i <= node2.count;i++) {
				np = NP(handleno, i, &node2);

				if ((tnode_no = btReadNode(handleno, *np, &t_node)) == -1L) return(hgFAIL);
				t_node.up = node2_no;

				if (btWriteNode(handleno, tnode_no, &t_node) == -1L) return(hgFAIL);
			}
		}
	}

	if ((ROOT(handleno) == upnode_no) && (up_node.count == 0) && (node2.count == 0)) {
		ROOT(handleno) = BaseRef;
		base->up = 0L;
		up_node.right = Bheader[handleno].delnode;
		Bheader[handleno].delnode = upnode_no;
	}

	if (btWriteNode(handleno, BaseRef, base) == -1L) return(hgFAIL);
	if (btWriteNode(handleno, node2_no, &node2) == -1L) return(hgFAIL);
	if (btWriteNode(handleno, upnode_no, &up_node) == -1L) return(hgFAIL);

	if ((ROOT(handleno) != BaseRef) && (btIsUnderflow(handleno, &up_node))) {
		if (btMerge(handleno, upnode_no, &up_node) == hgFAIL) return(hgFAIL);
	}

	return(hgSUCCESS);
}

int      btInsKey(int handleno, byte *key, long DataRef)
{
	BNODE  node;

	int    key_no;
	long   node_no;

	if (!btIsValidHandle(handleno)) return(hgFAIL);

	strip_blank(key);

	if (ROOT(handleno) == 0L) {
		if ((node_no = btGetNode(handleno, &node)) == -1L) return(hgFAIL);
		key_no = 1;
		ROOT(handleno) = node_no;
	}
	else {
		if (btFindNode(handleno, &node, key, &node_no, &key_no) == hgFAIL) return(hgFAIL);
	}

	btInsNodeKey(handleno, &node, key_no, key, DataRef);
	if (btWriteNode(handleno, node_no, &node) == -1L) return(hgFAIL);

	if (btIsOverflow(handleno, &node)) {
		if (btSplite(handleno, node_no, &node) == hgFAIL) return(hgFAIL);
	}
	Bheader[handleno].incount++;

	return(hgSUCCESS);
}

int      btDefaultInsKey(byte *key, long DataRef)
{
	return(btInsKey(DefaultIndexFileNo, key, DataRef));
}

int      btDelKey(int handleno, byte *key, long DataRef)
{
	BNODE  node;

	int    key_no;
	byte   *cp;
	long   *np, node_no;
	int    flag = hgFALSE;

	if (!btIsValidHandle(handleno)) return(hgFAIL);
	if (ROOT(handleno) == 0L) return(hgFAIL);

	strip_blank(key);

	if (btFindNode(handleno, &node, key, &node_no, &key_no) == hgFAIL) return(hgFAIL);
	if (key_no > node.count) return(hgFAIL);

	while (1) {
		cp = CP(handleno, key_no, &node);
		np = NP(handleno, key_no, &node);
		if (strcmp(cp, key) == 0) {
			if (*np == DataRef) {
				flag = hgTRUE;
				break;
			}
			else if (key_no < node.count) key_no++;
			else if (node.right == 0L) break;
			else {
				if ((node_no = btReadNode(handleno, node.right, &node)) == -1L) return(hgFAIL);
				key_no = 1;
			}
		}
		else break;
	}

	if (flag) btDelNodeKey(handleno, &node, key_no);
	else return(hgFAIL);

	if (btWriteNode(handleno, node_no, &node) == -1L) return(hgFAIL);

	if (btIsUnderflow(handleno, &node)) {
		if (btMerge(handleno, node_no, &node) == hgFAIL) return(hgFAIL);
	}
	Bheader[handleno].incount--;
	Bheader[handleno].delcount++;

	return(hgSUCCESS);
}

int      btDefaultDelKey(byte *key, long DataRef)
{
	return(btDelKey(DefaultIndexFileNo, key, DataRef));
}

long     btFindKey(int handleno, byte *key)
{
	BNODE  node;

	int    key_no;
	byte   *cp;
	long   *np, node_no;

	if (!btIsValidHandle(handleno)) return(-1L);
	if (ROOT(handleno) == 0L) return(-1L);

	strip_blank(key);

	if (btFindNode(handleno, &node, key, &node_no, &key_no) == hgFAIL) return(-1L);
	if (key_no > node.count) return(-1L);
	else {
		cp = CP(handleno, key_no, &node);
		np = NP(handleno, key_no, &node);
		if (strcmp(cp, key) == 0) {
			btMemoryNode(handleno, node_no, key_no, &node);

			return(*np);
		}
		else return(-1L);
	}
}

long     btDefaultFindKey(byte *key)
{
	return(btFindKey(DefaultIndexFileNo, key));
}

long     btSearchKey(int handleno, byte *key)
{
	BNODE  node;

	int    key_no;
	long   *np, node_no;

	if (!btIsValidHandle(handleno)) return(-1L);
	if (ROOT(handleno) == 0L) return(-1L);

	strip_blank(key);

	if (btFindNode(handleno, &node, key, &node_no, &key_no) == hgFAIL) return(-1L);
	if (key_no > node.count) return(-1L);

	btMemoryNode(handleno, node_no, key_no, &node);

	np = NP(handleno, key_no, &node);
	return(*np);
}

long     btDefaultSearchKey(byte *key)
{
	return(btSearchKey(DefaultIndexFileNo, key));
}

long     btFirstKey(int handleno)
{
	BNODE  node;

	long   *np, node_no;

	if (!btIsValidHandle(handleno)) return(-1L);

	if (ROOT(handleno) == 0L) return(-1L);
	if ((node_no = btReadNode(handleno, ROOT(handleno), &node)) == -1L) return(-1L);

	while (!btIsLeaf(&node)) {
		if ((node_no = btReadNode(handleno, node.down, &node)) == -1L) return(-1L);
	}

	if (node.count > 0) {
		btMemoryNode(handleno, node_no, 1, &node);

		np = NP(handleno, 1, &node);
		return(*np);
	}
	else return(-1L);
}

long     btDefaultFirstKey()
{
	return(btFirstKey(DefaultIndexFileNo));
}

long     btLastKey(int handleno)
{
	BNODE  node;

	long   *np, node_no;

	if (!btIsValidHandle(handleno)) return(-1L);

	if (ROOT(handleno) == 0L) return(-1L);
	if ((node_no = btReadNode(handleno, ROOT(handleno), &node)) == -1L) return(-1L);

	while (!btIsLeaf(&node)) {
		np = NP(handleno, node.count, &node);
		if ((node_no = btReadNode(handleno, *np, &node)) == -1L) return(-1L);
	}

	if (node.count > 0) {
		btMemoryNode(handleno, node_no, node.count, &node);

		np = NP(handleno, node.count, &node);
		return(*np);
	}
	else return(-1L);
}

long     btDefaultLastKey()
{
	return(btLastKey(DefaultIndexFileNo));
}

long     btBeforeKey(int handleno)
{
	BNODE  node;

	int    key_no;
	long   *np, node_no;

	if (!btIsValidHandle(handleno)) return(-1L);

	node_no = CurNodeno[handleno];
	key_no = CurKeyno[handleno];
	node = Buf[handleno];

	if (node_no <= 0L) return(-1L);
	if (key_no > 1) key_no--;
	else {
		if (node.left == 0L) return(-1L);
		if ((node_no = btReadNode(handleno, node.left, &node)) == -1L) return(-1L);
		key_no = node.count;
	}

	btMemoryNode(handleno, node_no, key_no, &node);

	np = NP(handleno, key_no, &node);
	return(*np);
}

long     btDefaultBeforeKey()
{
	return(btBeforeKey(DefaultIndexFileNo));
}


long     btNextKey(int handleno)
{
	BNODE  node;

	long   *np, node_no;
	int    key_no;

	if (!btIsValidHandle(handleno)) return(-1L);

	node_no = CurNodeno[handleno];
	key_no = CurKeyno[handleno];
	node = Buf[handleno];

	if (node_no <= 0L) return(-1L);
	if (key_no < node.count) key_no++;
	else {
		if (node.right == 0L) return(-1L);
		if ((node_no = btReadNode(handleno, node.right, &node)) == -1L) return(-1L);
		key_no = 1;
	}

	btMemoryNode(handleno, node_no, key_no, &node);

	np = NP(handleno, key_no, &node);
	return(*np);
}

long     btDefaultNextKey()
{
	return(btNextKey(DefaultIndexFileNo));
}

long     btPartKey(int handleno, byte *key)
{
	byte   *cp, *ptr;
	long   *np, node_no;

	strip_blank(key);

	node_no = btFirstKey(handleno);
	while (node_no != -1L) {
		cp = CP(handleno, CurKeyno[handleno], &Buf[handleno]);
		ptr = strstr(cp, key);
		if (ptr != NULL) {
			np = NP(handleno, CurKeyno[handleno], &Buf[handleno]);
			return(*np);
		}
		else node_no = btNextKey(handleno);
	}

	return(-1L);
}

long     btDefaultPartKey(byte *key)
{
	return(btPartKey(DefaultIndexFileNo, key));
}

long     btBeforePartKey(int handleno, byte *key)
{
	byte   *cp, *ptr;
	long   *np, node_no;

	strip_blank(key);

	node_no = btBeforeKey(handleno);
	while (node_no != -1L) {
		cp = CP(handleno, CurKeyno[handleno], &Buf[handleno]);
		ptr = strstr(cp, key);
		if (ptr != NULL) {
			np = NP(handleno, CurKeyno[handleno], &Buf[handleno]);
			return(*np);
		}
		else node_no = btBeforeKey(handleno);
	}

	return(-1L);
}

long     btDefaultBeforePartKey(byte *key)
{
	return(btBeforePartKey(DefaultIndexFileNo, key));
}

long     btNextPartKey(int handleno, byte *key)
{
	byte   *cp, *ptr;
	long   *np, node_no;

	strip_blank(key);

	node_no = btNextKey(handleno);
	while (node_no != -1L) {
		cp = CP(handleno, CurKeyno[handleno], &Buf[handleno]);
		ptr = strstr(cp, key);
		if (ptr != NULL) {
			np = NP(handleno, CurKeyno[handleno], &Buf[handleno]);
			return(*np);
		}
		else node_no = btNextKey(handleno);
	}

	return(-1L);
}

long     btDefaultNextPartKey(byte *key)
{
	return(btNextPartKey(DefaultIndexFileNo, key));
}

long     btCurrentRef(int handleno)
{
	long   *np;

	if (!btIsValidHandle(handleno)) return(-1L);

	np = NP(handleno, CurKeyno[handleno], &Buf[handleno]);
	return(*np);
}

long     btDefaultCurrentRef()
{
	return(btCurrentRef(DefaultIndexFileNo));
}

byte    *btCurrentKey(int handleno)
{
	byte   *cp;

	if (!btIsValidHandle(handleno)) return(NULL);

	cp = CP(handleno, CurKeyno[handleno], &Buf[handleno]);
	return((byte *)cp);
}

byte    *btDefaultCurrentKey()
{
	return(btCurrentKey(DefaultIndexFileNo));
}

long     btRecordCount(int handleno)
{
	if (!btIsValidHandle(handleno)) return(-1L);

	return(Bheader[handleno].incount);
}

long     btDefaultRecordCount()
{
	return(btRecordCount(DefaultIndexFileNo));
}
