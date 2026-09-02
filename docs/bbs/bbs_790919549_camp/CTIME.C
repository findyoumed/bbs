/* 키입력 시간 검사 */

#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <time.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <termio.h>

#define TIME 300L

int isatty(fd)
int fd;
{
    struct termios term;
    return(ioctl(fd,TCGETA,&term) != -1);
}

main()
{
    int ps;
    char c, tty[25], *tmp, *getty, *ttyname();
    FILE *fp1;
    struct stat statbuf;
    struct termio tbuf;
    time_t current, i;
    umask(0111);
    for(ps = 0; ps <= 10; ps++) {
        if(isatty(ps)) {
            getty = ttyname(ps);
            break;
        }
    }
    tmp = &getty[5];
    sprintf(tty,"tmp/time.%s",tmp);
    fp1 = fopen(tty,"w");
    fputc('0',fp1);
    fclose(fp1);
    ps = fork();
    if(ps) execl("bin/start","start",tmp,(char*)0);
    else {
        nice(10);
        i = 0;
        while((fp1 = fopen(tty,"r")) == NULL);
        fclose(fp1);
        while(1) {
            if((fp1 = fopen(tty,"r")) == NULL) exit(0);
            c = fgetc(fp1);
            fclose(fp1);
            if(c == '1') {
                time(&i);
            }
            else if(c == '3') {
                exit(0);
            }
            else {
                sleep(60);
                fstat(0, &statbuf);
                time(&current);
                if(current - (statbuf.st_atime + i) >= TIME) {
                    ps = getppid();
                    printf("\r\n\007키입력이 없어서 자동으로 끊어집니다.\r\n");
                    sleep(1);
                    kill(ps, SIGHUP);
                    sleep(1);
                    exit(0);
                }
                i = 0;
            }
            sleep(10);
        }
    }
}

