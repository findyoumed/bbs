#include <stdio.h>

double ratio(double max, double val)
{
	return((max/val)*100);
}

int scale_4to8(int s)
{
	return(s<<4|s);
}

int scale_6to8(int s)
{
	return((s<<2)|(s>>4));
}

int scale_8to4(int s)
{
	return(s>>4);
}

int scale_8to6(int s)
{
	return(s>>2);
}

int scale_8to16(int s)
{
	return(s<<8|s);
}

int scale_16to8(int s)
{
	return(s>>8);
}

int main(int argc, char **argv)
{
	int i;

	for(i=0; i<16; i++) {
		printf("%d -> %d -> %d (%0.2f:%0.2f)\n",i, scale_4to8(i), scale_8to4(scale_4to8(i)), ratio(i,15), ratio(scale_4to8(i), 255));
	}

	puts("");
	puts("");

	for(i=0; i<64; i++) {
		printf("%d -> %d -> %d (%0.2f:%0.2f)\n",i, scale_6to8(i), scale_8to6(scale_6to8(i)), ratio(i,63), ratio(scale_6to8(i), 255));
	}
}
