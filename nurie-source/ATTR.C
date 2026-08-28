/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : attr.c  -- ¢…¸a ­¢¬÷ ¡¡—I                     |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#pragma     inline

#include    <dos.h>
#include    <mem.h>

#include    "hghlib.h"			/* Ðe‹i ·³Â‰bµA ”Ðe ÑA”á */
#include    "hginit.h"			/* Ðe‹i Á¡‹¡ÑÁµA ”Ðe ÑA”á */

/*-------------------------------------------------------------------|
 |       Local  Variables  Declaration                               |
 |-------------------------------------------------------------------*/

char     hgEAttr = NORMAL;		/* µw¢… ­¢¬÷ˆt */
char     hgHAttr = NORMAL;		/* Ðe‹i ­¢¬÷ˆt */
char     hgExtAttr = NORMAL;		/* ¶A¦ ‹i© ­¢¬÷ˆt */

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgDoAttr(char *dest, int bytes, int n);
void     hgEnableAttr(void (*func)(char *dest, int bytes), int n);

void     hgSetEAttr(char attr);
void     hgResetEAttr(char attr);
char     hgGetEAttr();
void     hgSetHAttr(char attr);
void     hgResetHAttr(char attr);
char     hgGetHAttr();
void     hgSetExtAttr(char attr);
void     hgResetExtAttr(char attr);
char     hgGetExtAttr();

void     attr_null(char *dest, int bytes);
void     reverse_image(char *dest, int bytes);
void     dim_image(char *dest, int bytes);
void     shadow_image(char *dest, int bytes);
void     three_image(char *dest, int bytes);
void     outline_image(char *dest, int bytes);
void     bold_image(char *dest, int bytes);
void     under_image(char *dest, int bytes);

			/* function pointer */
void   (*afunc[7])(char *dest, int bytes) = {
	attr_null, attr_null, attr_null, attr_null,
	attr_null, attr_null, attr_null
};


void     hgDoAttr(char *dest, int bytes, int n)
{
	(*afunc[n])(dest, bytes);
}

void     hgEnableAttr(void (*func)(char *dest, int bytes), int n)
{
	afunc[n] = func;
}

void     hgSetEAttr(char attr)
{
	if (attr == NORMAL) hgEAttr = NORMAL;
	else hgEAttr |= attr;
}

void     hgResetEAttr(char attr)
{
	hgEAttr &= (!attr);
}

char     hgGetEAttr()
{
	return(hgEAttr);
}

void     hgSetHAttr(char attr)
{
	if (attr == NORMAL) hgHAttr = NORMAL;
	else hgHAttr |= attr;
}

void     hgResetHAttr(char attr)
{
	hgHAttr &= (!attr);
}

char     hgGetHAttr()
{
	return(hgHAttr);
}

void     hgSetExtAttr(char attr)
{
	if (attr == NORMAL) hgExtAttr = NORMAL;
	else hgExtAttr |= attr;
}

void     hgResetExtAttr(char attr)
{
	hgExtAttr &= (!attr);
}

char     hgGetExtAttr()
{
	return(hgExtAttr);
}

void     attr_null(char *dest, int bytes)
{
	bytes &= dest[0];		/* warning ¡A­A»¡ ´ô´‹¡ ¶áÐ */
}

void     reverse_image(char *dest, int bytes)
{
		asm  les  bx, dest
		asm  mov  cx, bytes
		asm  shr  cx, 1

rloop:		asm  not  WORD PTR es:[bx]
		asm  inc  bx
		asm  inc  bx
		asm  loop rloop
}

void     dim_image(char *dest, int bytes)
{
		asm  les  bx, dest
		asm  mov  si, bytes
		asm  cmp  si, 32
		asm  jz   dloop2

dloop1:		asm  and  WORD PTR es:[bx + si - 2], 0aa55h
		asm  dec  si
		asm  dec  si
		asm  jne  dloop1
	return;

dloop2:		asm  and  WORD PTR es:[bx + si - 2], 0aaaah
		asm  dec  si
		asm  dec  si
		asm  and  WORD PTR es:[bx + si - 2], 05555h
		asm  dec  si
		asm  dec  si
		asm  jne  dloop2
	return;
}

void     shadow_image(char *dest, int bytes)
{
		asm  les  bx, dest
		asm  mov  si, bytes
		asm  cmp  si, 32
		asm  jz   sloop2

sloop1:		asm  or   WORD PTR es:[bx + si - 2], 0aa55h
		asm  dec  si
		asm  dec  si
		asm  jne  sloop1
	return;

sloop2:		asm  or   WORD PTR es:[bx + si - 2], 0aaaah
		asm  dec  si
		asm  dec  si
		asm  or   WORD PTR es:[bx + si - 2], 05555h
		asm  dec  si
		asm  dec  si
		asm  jne  sloop2
	return;
}

void     three_image(char *dest, int bytes)
{
	char   temp1[32];
	char   temp2[32];

	memcpy(temp1, dest, bytes);
	memcpy(temp2, dest, bytes);

		asm  push ds

	_DS = FP_SEG(temp1);
	_ES = FP_SEG(temp2);
	_BX = FP_OFF(temp1);
	_DI = FP_OFF(temp2);

	if (bytes == 16) {
		asm  mov  cx, 15

tloop1:		asm  mov  ah, es:[di]
		asm  or   ds:[bx + 1], ah
		asm  shr  ah, 1
		asm  or   ds:[bx], ah
		asm  shl  ah, 1
		asm  xor  ds:[bx], ah
		asm  inc  bx
		asm  inc  di
		asm  loop tloop1
	}
	else {
		asm  mov  cx, 16

tloop2:		asm  mov  ax, es:[di]
		asm  or   ds:[bx + 2], ax
		asm  shr  ax, 1
		asm  or   ds:[bx], ax
		asm  shl  ax, 1
		asm  xor  ds:[bx], ax
		asm  inc  bx
		asm  inc  bx
		asm  inc  di
		asm  inc  di
		asm  loop tloop2
	}

	memcpy(dest, temp1, bytes);

		asm  pop  ds
}

void     outline_image(char *dest, int bytes)
{
	char   temp1[32];
	char   temp2[32];

	memcpy(temp1, dest, bytes);
	memcpy(temp2, dest, bytes);

		asm  push ds

	_DS = FP_SEG(temp1);
	_ES = FP_SEG(temp2);
	_BX = FP_OFF(temp1);
	_DI = FP_OFF(temp2);

		asm  push bx
		asm  push di
		asm  mov  cx, bytes
		asm  shr  cx, 1

oloop:		asm  mov  ax, es:[di]
		asm  shr  ax, 1
		asm  or   ds:[bx], ax
		asm  shl  ax, 1
		asm  shl  ax, 1
		asm  or   ds:[bx], ax
		asm  inc  bx
		asm  inc  bx
		asm  inc  di
		asm  inc  di
		asm  loop oloop

		asm  pop  di
		asm  pop  bx

		asm  mov  cx, 15

	if (bytes == 16) {

oloop1:		asm  mov  ah, es:[di]
		asm  or   ds:[bx + 1], ah
		asm  mov  ah, es:[di + 1]
		asm  or   ds:[bx], ah
		asm  mov  ah, es:[di]
		asm  xor  ds:[bx], ah
		asm  inc  bx
		asm  inc  di
		asm  loop oloop1
	}
	else {

oloop2:		asm  mov  ax, es:[di]
		asm  or   ds:[bx + 2], ax
		asm  mov  ax, es:[di + 2]
		asm  or   ds:[bx], ax
		asm  mov  ax, es:[di]
		asm  xor  ds:[bx], ax
		asm  inc  bx
		asm  inc  bx
		asm  inc  di
		asm  inc  di
		asm  loop oloop2
	}

	memcpy(dest, temp1, bytes);

		asm  pop  ds
}

void     bold_image(char *dest, int bytes)
{
		asm  mov  si, bytes
		asm  les  bx, dest

bloop:		asm  mov  ax, es:[bx + si - 2]
		asm  shr  ax, 1
		asm  or   es:[bx + si - 2], ax
		asm  dec  si
		asm  dec  si
		asm  jne  bloop
}

void     under_image(char *dest, int bytes)
{
		asm  mov  si, bytes
		asm  les  bx, dest
		asm  mov  BYTE PTR es:[bx + si - 1], 0xff;
		asm  cmp  si, 32
		asm  jne  unext
		asm  mov  BYTE PTR es:[bx + si - 2], 0xff;
unext:
	return;
}

