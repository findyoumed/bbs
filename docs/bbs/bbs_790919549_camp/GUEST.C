/*  1993.05.04  */
/*    GUEST.C   */

#include <stdio.h>
#include <string.h>
#include <malloc.h>
#include <ctype.h>
#include <time.h>
#include <signal.h>
#include <sys/types.h>
#include <termio.h>
#include "bbs.h"


char tmp_buf[100];
struct idst pf, tmp_pf;
int host_end();
void logo();
struct termio systerm;
rawmode()
{
    struct termio tbuf;
    ioctl(0, TCGETA, &tbuf);
    tbuf.c_cc[4] = 1;
    tbuf.c_cc[5] = 0;
    tbuf.c_iflag = 0;
    tbuf.c_iflag |= IXON;
    tbuf.c_iflag |= IXANY;
    tbuf.c_oflag = 0;
    tbuf.c_oflag &= ~OPOST;
    tbuf.c_lflag &= ~(ICANON | ISIG | ECHO);
    tbuf.c_cflag &= ~PARENB;
    tbuf.c_cflag &= ~CSIZE;
    tbuf.c_cflag |= CS8;
    ioctl(0, TCSETAF, &tbuf);
    return;
}

main(argc,argv)
int argc;
char *argv[];
{
    int i, j, k, flag, a[14],count;
    char *buf,ti[14];
    FILE *fp1;
    signal(SIGQUIT, SIG_IGN);
    signal(SIGINT, SIG_IGN);
    signal(SIGTERM, SIG_IGN);
    signal(SIGHUP, (__sighandler_t)host_end);
    signal(SIGSEGV, (__sighandler_t)host_end);
    signal(SIGBUS, (__sighandler_t)host_end);
    ioctl(0, TCGETA, &systerm);
    rawmode();
    umask(0111);
    buf = tmp_buf;
    logo("guest.log");
    printf("\033[;H\033[2J");
    pf.circle = 0x00;
    pf.flag = 0xffffffff;
    flag = 0xffffffff;
    while(1) {
        count = 5;
        while(flag & 0x0001) {
            if(!count) host_end();
            --count;
            printf("\r\n희망하는 아이디를 쓰십시오.");
            printf("\r\n3~8자로 하십시오.");
            printf("\r\n\033[?85h\r아이디 : ");
            sfget_s(pf.id,8);
            if(strlen(pf.id) > 2) {
                if((fp1 = fopen("bin/id_pf","r")) != NULL) {
                    while(fread((char*)&tmp_pf,sizeof(struct idst),1,fp1)) {
                        if(!strcmp(tmp_pf.id,pf.id)) {
                            printf("\007\r\n'%s'는 다른사람이 신청하여 사용중인 아이디 입니다.",tmp_pf.id);
                            flag |= 0x00000001;
                            break;
                        }
                        else {
                            flag &= 0xfffffffe;
                        }
                    }
                    fclose(fp1);
                }
                else {
                    break;
                }
            }
        }
        while(flag & 0x0002) {
            pf.passwd[0] = '\0';
            while(strlen(pf.passwd) < 3) {
                printf("\r\n\033[?85l\r희망하는 비밀번호를 쓰십시오(3~8자).");
                printf("\r\n비밀번호 : ");
                sfget_s(pf.passwd,8);
            }
            flag &= 0xfffffffd;
            break;
        }
        while(flag & 0x0004) {
            pf.name[0] = '\0';
            printf("\r\n이름을 입력하여 주십시오.");
            while(strlen(pf.name) < 4) {
                printf("\r\n\033[?85h\r이름 : ");
                sfget_s(pf.name,8);
            }
            flag &= 0xfffffffb;
            break;
        }
        while(flag & 0x0008) {
            printf("\r\n\033[?85l\r남.여 구분(남자 : m / 여자 : f) >> ");
            pf.sex = getchar();
            pf.sex = tolower(pf.sex);
            if((pf.sex == 'm') || (pf.sex == 'f')) {
                printf("%c",pf.sex);
                flag &= 0xfffffff7;
                break;
            }
        }
        while(flag & 0x0010) {
            printf("\r\n생년월일을 입력하여 주십시오. 예) 67.05.28 ");
            printf("\r\n생년월일 : ");
            sfget_s(pf.birthday,8);
            pf.birthday[2] = '0';
            pf.birthday[5] = '0';
            for(i = 0; i < 8; i++) {
                if(!(isdigit(pf.birthday[i]))) {
                    printf("\r\n정확히 입력하여 주십시오.");
                    flag |= 0x0010;
                    break;
                }
                else {
                    flag &= 0xffffffef;
                }
            }
            if(!(flag & 0x0010)) {
                printf("\r\n\033[?85l\r양력입니까(Y/n)? ");
                sfget_s(buf,1);
                if(buf[0] == 'n' || buf[0] == 'N') {
                    pf.birthday[9] = '-';
                }
                else {
                    pf.birthday[9] = '+';
                }
                pf.birthday[2] = '.';
                pf.birthday[5] = '.';
                pf.birthday[8] = '(';
                pf.birthday[10] = ')';
                pf.birthday[11] = 0x00;
            }
        }
        while(flag & 0x0020) {
            pf.post[0] = '\0';
            while(!atoi(pf.post) || (strlen(pf.post) < 7)) {
                printf("\r\n우편번호(집) : ");
                sfget_s(pf.post,7);
            }
            flag &= 0xffffffdf;
            break;
        }
        while(flag & 0x0040) {
            printf("\r\n집주소를 입력하여 주십시오.");
            printf("\r\n\033[?85h\r집주소 : ");
            fget_s(pf.home_addr,79);
            if(pf.home_addr[0] == 0x00) {
                printf("\r\n정확히 입력하여 주십시오.");
                flag |= 0x0040;
            }
            else {
                flag &= 0xffffffbf;
            }
        }

        while(flag & 0x0080) {
            printf("\r\n집전화번호를 입력하여 주십시오. 예) 02-293-0597");
            printf("\r\n집전화 : ");
            sfget_s(pf.home_tel,14);
            j = strlen(pf.home_tel);
            for(i = 0; i < j; i++) {
                if(!isdigit(pf.home_tel[i])) {
                    if(pf.home_tel[i] != '-') {
                        flag |= 0x0080;
                        break;
                    }
                    else {
                        flag &= 0xffffff7f;
                   }
                }
            }
        }
        while(flag & 0x0100) {
            printf("\r\n직장명과 직책을 입력하여 주십시오(학생은 학교, 과, 학년를 기제).");
            printf("\r\n\033[?85h\r직  장 : ");
            fget_s(pf.office_name,79);
            flag &= 0xfffffeff;
            break;
        }
        while(flag & 0x0200) {
            printf("\r\n직장전화번호를 입력하여 주십시오. 예) 02-293-0597");
            printf("\r\n직장전화 : ");
            sfget_s(pf.office_tel,14);
            flag &= 0xfffffdff;
            break;
        }
        count = 5;
        while(flag & 0x0400) {
            if(!count) host_end();
            --count;
            printf("\r\n주민등록번호를 입력하여 주십시오. 예) 670528-1234567");
            printf("\r\n주민등록번호 : ");
            sfget_s(pf.id_no,14);
            pf.id_no[6] = '0';
            j = 1;
            for(i = 0; i < 14; i++) {
                if(isdigit(pf.id_no[i])) a[i] = pf.id_no[i] - 48;
                else {
                    printf("\r\n정확히 입력하여 주십시오.");
                    flag |= 0x0400;
                    j = 0;
                    break;
                }
            }
            if(j) {
    j = a[0]*2+a[1]*3+a[2]*4+a[3]*5+a[4]*6+a[5]*7+a[7]*8+a[8]*9+a[9]*2+a[10]*3+a[11]*4+a[12]*5;
                j = j % 11;
                k = 11 - j;
                if(k > 9) k = k % 10;
                j = pf.id_no[13] - 48;
                if(j != k) {
                    printf("\r\n번호가 틀렸습니다.");
                    flag |= 0x0400;
                }
                else {
                    pf.id_no[6] = '-';
                    if((fp1 = fopen("bin/id_pf","r")) != NULL) {
                        while(fread((char*)&tmp_pf,sizeof(struct idst),1,fp1)) {
                            if(!strcmp(tmp_pf.id_no,pf.id_no)) {
                                printf("\007\r\n동일한 번호가 사용중입니다.");
                                flag |= 0x0400;
                                break;
                            }
                            else {
                                flag &= 0xfffffbff;
                            }
                        }
                        fclose(fp1);
                    }
                    else {
                        flag &= 0xfffffbff;
                        break;
                    }
                }
            }
        }
        printf("\033[;H\033[2J신청 내역\r\n");
        printf("\r\n 1 아   이   디 : %s\r\n 2 비 밀  번 호 : %s",pf.id,pf.passwd);
        printf("\r\n 3 이        름 : %s\r\n 4 성        별 : %c",pf.name,pf.sex);
        printf("\r\n 5 생 년  월 일 : %s\r\n 6 우 편  번 호 : %s",pf.birthday,pf.post);
        printf("\r\n 7 집   주   소 : %s\r\n 8 집   전   화 : %s",pf.home_addr,pf.home_tel);
        printf("\r\n 9 직   장   명 : %s\r\n10 직 장  전 화 : %s",pf.office_name,pf.office_tel);
        printf("\r\n11 주민등록번호 : %s\r\n",pf.id_no);
        printf("\r\n\n\033[?85l\r고칠 사항이 있습니까 번호/n ? ");
        sfget_s(buf,2);
        if((buf[0] == 'n') || (buf[0] == 'N')) break;
        else {
            i = atoi(buf);
            switch(i) {
                case 1 : flag = 0x0001; break;
                case 2 : flag = 0x0002; break;
                case 3 : flag = 0x0004; break;
                case 4 : flag = 0x0008; break;
                case 5 : flag = 0x0010; break;
                case 6 : flag = 0x0020; break;
                case 7 : flag = 0x0040; break;
                case 8 : flag = 0x0080; break;
                case 9 : flag = 0x0100; break;
                case 10 : flag = 0x0200; break;
                case 11 : flag = 0x0400; break;
                default : flag = 0x0000;
            }
        }
    }
    time(&pf.inday);
    pf.logout = pf.inday;
    pf.level = 1;
    pf.logcount = 0;
    pf.totaltime = 0;
    logo("guest.end");
    fget_s(buf,1);
    fp1 = fopen("bin/id_pf.tmp","a");
    i = ftell(fp1);
    pf.num = i /sizeof(struct idst);
    fwrite((char*)&pf,sizeof(struct idst),1,fp1);
    fclose(fp1);
    if((fp1 = fopen("bin/campfire.cfg","r")) == NULL) {  /* 기준값 읽기 */
        printf("\r\nbin/campfire.cfg 에러");
        host_end();
    }
    fscanf(fp1,"%s%d%d%d%d%d%s%d",buf,&j,&j,&j,&j,&j,buf,&k);
    fclose(fp1);
    if(k & 0x04) { /* 3번 비트가 1이면 손님메뉴에서 메인메뉴들어감 */
        sprintf(buf,"%d",i);
        sprintf(ti,"%d",pf.num);
        ioctl(0, TCSETAF, &systerm);
        execl("bin/main","main",buf,argv[1],ti,"0",(char *)0);
    }
    host_end();
}

/* 로고화일 출력 */
void logo(ccode)
char *ccode;
{
    char *buf, ch;
    FILE *fp1;
    buf = tmp_buf;
    sprintf(buf,"logo/%s",ccode);
    if((fp1 = fopen(buf,"r")) != NULL) {
        printf("\033[;H\033[2J");
        while((ch = fgetc(fp1)) != EOF) {
            if(ch == '\n') {
                putchar('\r');
            }
            putchar(ch);
        }
        fclose(fp1);
        printf("\r\n엔터키를 치십시오.");
        fget_s(buf,1);
    }
}

/* 문자열 입력(문자열 포인터, 읽을 문자 겟수) */
fget_s(str,len)
char *str;
int len;
{
    int i = 0;
    char ch;
    while((ch = getchar()) != '\r') {
        if(ch == '\b') {
            if(i > 0) {
                putchar(ch); putchar(' '); putchar(ch);
                if(i > 0) i--;
            }
        }
        else if(ch == 0x1b) ;
        else if(i < len) {
            str[i++] = ch;
            putchar(ch);
        }
    }
    str[i] = 0x00;
}
/* 문자열 입력(문자열 포인터, 읽을 문자 겟수) */
sfget_s(str,len)
char *str;
int len;
{
    int i = 0;
    char ch;
    while((ch = getchar()) != '\r') {
        if(ch == '\b') {
            if(i > 0) {
                putchar(ch); putchar(' '); putchar(ch);
                if(i > 0) i--;
            }
        }
        else if((ch == ' ') | (ch == 0x1b));
        else if(i < len) {
            str[i++] = ch;
            putchar(ch);
        }
    }
    str[i] = 0x00;
}

int host_end()
{
    ioctl(0, TCSETAF, &systerm);
    exit(1);
}

