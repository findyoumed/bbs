/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : extern.h  -- Ðq® ¶¥Ñw· ¬å´å ÑA”á            |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

#ifndef     __EXTERN_H
#define     __EXTERN_H

#ifdef      __cplusplus
extern      "C" {
#endif

			/* clear screen */
extern   void     vga_cls();
extern   void     hgc_cls();

			/* for output */
extern   void     vga_pute(int x, int y, char *font, char color);
extern   void     vga_puth(int x, int y, char *font, char color);
extern   void     vga_putmn(int x, int y, char *font, int m, int n, char color);

extern   void     hgc_pute(int x, int y, char *font, char color);
extern   void     hgc_puth(int x, int y, char *font, char color);
extern   void     hgc_putmn(int x, int y, char *font, int m, int n, char color);

			/* for cursor */
extern   void     vga_cure(int x, int y);
extern   void     vga_curh(int x, int y);

extern   void     hgc_cure(int x, int y);
extern   void     hgc_curh(int x, int y);

			/* for plot, line */
extern   void     vga_plot(int x, int y, char color);
extern   char     vga_getplot(int x, int y);

extern   void     hgc_plot(int x, int y, char color);
extern   char     hgc_getplot(int x, int y);

extern   void     vga_lineg(int x1, int y1, int x2, int y2, char color);
extern   void     hgc_lineg(int x1, int y1, int x2, int y2, char color);

			/* for fast line */
extern   void     vga_hline(int x1, int x2, int y, char color);
extern   void     vga_vline(int x, int y1, int y2, char color);

extern   void     hgc_hline(int x1, int x2, int y, char color);
extern   void     hgc_vline(int x, int y1, int y2, char color);

			/* for boxfill */
extern   void     vga_boxfill(int x1, int y1, int x2, int y2, char color);
extern   void     hgc_boxfill(int x1, int y1, int x2, int y2, char color);

			/* for scroll */
extern   void     vga_scrup(int x1, int y1, int x2, int y2, int lines, char color);
extern   void     vga_scrdown(int x1, int y1, int x2, int y2, int lines, char color);
extern   void     vga_scrleft(int x1, int y1, int x2, int y2, int rows, char color);
extern   void     vga_scrright(int x1, int y1, int x2, int y2, int rows, char color);

extern   void     hgc_scrup(int x1, int y1, int x2, int y2, int lines, char color);
extern   void     hgc_scrdown(int x1, int y1, int x2, int y2, int lines, char color);
extern   void     hgc_scrleft(int x1, int y1, int x2, int y2, int rows, char color);
extern   void     hgc_scrright(int x1, int y1, int x2, int y2, int rows, char color);

			/* for image */
extern   void     vga_getimage(int x1, int y1, int x2, int y2, char *buff);
extern   void     vga_putimage(int x1, int y1, int x2, int y2, char *buff);

extern   void     hgc_getimage(int x1, int y1, int x2, int y2, char *buff);
extern   void     hgc_putimage(int x1, int y1, int x2, int y2, char *buff);

extern   void     vga_getimage4(int x1, int y1, int x2, int y2, CIMAGE **p);
extern   void     vga_putimage4(int x1, int y1, int x2, int y2, CIMAGE *p);

extern   void     hgc_getimage4(int x1, int y1, int x2, int y2, CIMAGE **p);
extern   void     hgc_putimage4(int x1, int y1, int x2, int y2, CIMAGE *p);

			/* extern virtual image function */
extern   void     vga_getimagevirtual(int x1, int y1, int x2, int y2, VIMAGE **p);
extern   void     vga_putimagevirtual(int x1, int y1, int x2, int y2, VIMAGE *p);

extern   void     hgc_getimagevirtual(int x1, int y1, int x2, int y2, VIMAGE **p);
extern   void     hgc_putimagevirtual(int x1, int y1, int x2, int y2, VIMAGE *p);

			/* for image size(user may not call this.) */
extern   unsigned vga_imgsize(int x1, int y1, int x2, int y2);
extern   unsigned hgc_imgsize(int x1, int y1, int x2, int y2);

extern   unsigned vga_imgsize4(int x1, int y1, int x2, int y2);
extern   unsigned hgc_imgsize4(int x1, int y1, int x2, int y2);

			/* mouse init */
extern   void     hgSetHMouseInit();
extern   void     hgSetVMouseInit();

			/* attribute extern function prototype */
extern   void     attr_null(char *dest, int bytes);
extern   void     reverse_image(char *dest, int bytes);
extern   void     dim_image(char *dest, int bytes);
extern   void     shadow_image(char *dest, int bytes);
extern   void     three_image(char *dest, int bytes);
extern   void     outline_image(char *dest, int bytes);
extern   void     under_image(char *dest, int bytes);
extern   void     bold_image(char *dest, int bytes);

			/* mouse cursor external define */
extern   void     cross();
extern   void     default_arrow();
extern   void     question();
extern   void     not();
extern   void     timer();
extern   void     bubble();
extern   void     arrow2();
extern   void     arrow();

			/* for PCX file display */
extern   void     hgc_pcxdisplay(int x, int y, char *fname);
extern   void     mono_pcxdisplay(int x, int y, char *fname);
extern   void     vga_pcxdisplay(int x, int y, char *fname);

#ifdef      __cplusplus
}
#endif

#endif
