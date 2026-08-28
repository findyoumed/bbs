/*-------------------------------------------------------------------|
 |                                                                   |
 |       É·¯¥ µA¢‰A·¡Èá Nurie 1.5                                   |
 |       filename    : circle.c  -- ¶¥ ‹aŸ¡‹¡ ¡¡—I                   |
 |       ¹A¸b·©¯¡    : 92/10/31(É¡)                                  |
 |       ¹A¸b¸a      : ·¡ »¢Àw (ID:jikchang)                         |
 |                                                                   |
 |-------------------------------------------------------------------*/

/*-------------------------------------------------------------------|
 |       Function  Prototypes  Declaration                           |
 |-------------------------------------------------------------------*/

void     hgCircle(int xx, int yy, int radius, char color);
void     hgEllipse(int xx, int yy, int a0, int b0, char color);
void     symmetry8(int xx, int yy, int x, int y, char color);
void     symmetry4(int xx, int yy, int x, int y, char color);


void     hgCircle(int xx, int yy, int radius, char color)
{
	int   x = 0;
	int   y = radius;
	int   d = 3 - y * 2;

	while (x < y) {
		hgPlotXy(xx + x, yy + y, color);
		symmetry8(xx, yy, x, y, color);

		if (d < 0) d += (x * 4 + 6);
		else {
			d += ((x - y) * 4 + 10);
			y--;
		}
		x++;
	}
	if (x == y) hgPlotXy(xx + x, yy + y, color);
}

void     symmetry8(int xx, int yy, int x, int y, char color)
{
	hgPlotXy(xx - x, yy + y, color);
	hgPlotXy(xx + x, yy - y, color);
	hgPlotXy(xx - x, yy - y, color);
	hgPlotXy(xx - y, yy + x, color);
	hgPlotXy(xx + y, yy - x, color);
	hgPlotXy(xx - y, yy - x, color);
	hgPlotXy(xx + y, yy + x, color);
}

void     hgEllipse(int xx, int yy, int a0, int b0, char color)
{
	int    x = 0;
	int    y = b0;

	long   a = a0;
	long   b = b0;
	long   a2 = a * a;
	long   a22 = 2 * a2;
	long   b2 = b * b;
	long   b22 = 2 * b2;

	long   d;
	long   dx, dy;

	d = b2 - a2 * b + a2 / 4L;
	dx = 0L;
	dy = a22 * b;

	while (dx < dy) {
		symmetry4(xx, yy, x, y, color);

		if (d > 0) {
			y--;
			dy -= a22;
			d -= dy;
		}
		x++;
		dx += b22;
		d += b2 + dx;
	}
	d += (3 * (a2 - b2) / 2L - (dx + dy)) / 2L;

	while (y >= 0) {
		symmetry4(xx, yy, x, y, color);

		if (d < 0) {
			x++;
			dx += b22;
			d += dx;
		}
		y--;
		dy -= a22;
		d += a2 - dy;
	}
}

void     symmetry4(int xx, int yy, int x, int y, char color)
{
	hgPlotXy(xx - x, yy + y, color);
	hgPlotXy(xx + x, yy - y, color);
	hgPlotXy(xx - x, yy - y, color);
	hgPlotXy(xx + x, yy + y, color);
}
