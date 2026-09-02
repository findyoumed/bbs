/*   start.c    */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <malloc.h>
#include <ctype.h>
#include <time.h>
#include <signal.h>
#include <sys/types.h>
#include <termio.h>
#include "bbs.h"

int CRT = 18, fos;
char tty[15],tmp_buf[80],temp[80];
time_t buftime;
struct idst pf;
struct dis_list l_title;
struct nowwork work,*chk_work;
struct config menu;
struct termio systerm;
void id_in(), logo(), get_menu();
int host_end();

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
char **argv;
{
    int i, j, k, skip, quit1, select;
    char *tmp, *buf, ch, my_num[10], menucode[10];
    FILE *fp1, *fp2, *fp3;
    struct mail letter; /* 편지함 */
    struct fcfg cfg;    /* 초기값 */
    time(&buftime);
    sprintf(tty,"%s",argv[1]);
    signal(SIGQUIT, SIG_IGN);
    signal(SIGINT, SIG_IGN);
    signal(SIGTERM, SIG_IGN);
    signal(SIGHUP, (__sighandler_t)host_end);
    signal(SIGSEGV, (__sighandler_t)host_end);
    signal(SIGBUS, (__sighandler_t)host_end);
    ioctl(0,TCGETA, &systerm);
    rawmode();
    umask(0111);
    if(argc != 2) {
        printf("\r\n시간 에러\r\n");
        host_end();
    }
    buf = tmp_buf;
    sprintf(buf,"tmp/mail.%s",tty);
    unlink(buf);
    for(i = 0; i < 10; i++) {       /* 접속 로고 출력(최대10개) */
        sprintf(buf,"start%d",i);
        logo(buf);
    }
    if((fp1 = fopen("bin/campfire.cfg","r")) == NULL) {  /* 기준설정치 읽기 */
        printf("\r\ncampfire.cfg화일이 열리지 않습니다.");
        host_end();
    }
    fscanf(fp1,"%s",menucode);
    fclose(fp1);
    get_menu(menucode);       /* 메뉴화일 읽기 */
    display_list();        /* 공지 사항 출력 */
    printf("\033[;H\033[2J");
    id_in();                        /* 아이디 검사 */
    check_letter();                 /* 편지함(새로도착한편지) 검사 */
    printf("\r\n\n 엔터키를 치십시오. ");
    sfget_s(buf,1);
    sprintf(buf,"%ld",fos);
    sprintf(my_num,"%d",pf.num);
    ioctl(0, TCSETAF, &systerm);
    if(!strcmp(pf.id,"sysop")) {
        execl("bin/main.sys","main.sys",buf,tty,my_num,"1",(char *)0);
    }
    execl("bin/main","main",buf,tty,my_num,"1",(char *)0);  /* 메인실행(번호,노드) */
    perror("execl failed");
    exit(1);
}
/* 공지사항 출력 */
int display_list()
{
    int i, now_num, count, back, ie, select, top_num, key;
    char *buf, c;
    FILE *fp1, *fp2, *fp3;
    buf = tmp_buf;
    sprintf(buf,"menu/%s",menu.ccode);
    if((fp1 = fopen(buf,"r+")) == NULL) {
        fp1 = fopen(buf,"a+");
    }
    top_num = 0;
    if(!fseek(fp1,0,2)) {
        top_num = ftell(fp1) / sizeof(struct dis_list);
        now_num = list_cont(fp1, top_num);
    }
    else {
        printf("\r\n화일이 열리지 않습니다.\r\n");
        return;
    }
    back = 0;   /* 입력된 키의 갯수 */
    key = 1;    /* 입력된 키의 정당성 */
    while(1){
        if(key) {   /* 화면이 다시 구성될때 */
            printf("\r\n\n\033(2\033[?85l\r선택/번호 [Enter,LS,DIR,Q] >> ");
        }
        else {  /* 부정당한 명령이 들어왔을때 입력문 삭제 */
            for(i = 0; i < back; i++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        nfget_s(buf,25);
        back = strlen(buf); /* 눌려진 키의 갯수 */
        for(i = 0; i < back; i++) { /* 입력키를 전부 소문자로 바꿈 */
            buf[i] = tolower(buf[i]);
        }
        if((select = atoi(buf)) == 0) { /* 입력된 키의값이 숫자인지 검색 */
            if(buf[0] == '\0') {    /* 그냥 앤터를 쳤을때 */
                if(now_num > 0) {   /* 표시 해야될 내용이 있을때 */
                    key = 1;
                    now_num = list_cont(fp1, now_num);
                }
                else {  /* 표시 해야될 내용이 없을때 */
                    printf("\033[s\0337\033[1;65H\007\033[7m마지막 라인임. \033[0m \0338\033[u");
                    key = 0;
                }
            }
            else if(!strcmp(buf,"dir")) {   /* 게시물을 처음부터 보여줌 */
                key = 1;
                now_num = top_num;
                now_num = list_cont(fp1, now_num);
            }
            else if(!strncmp(buf,"ls",2)) { /* 게시물 계속 출력 */
                buf[0] = ' ' ; buf[1] = ' ';
                i = atoi(buf);
                key = 1;
                if(i >= top_num) {
                    now_num = top_num;
                }
                else if(i != 0) {
                    now_num = i;
                }
                now_num = list_cont(fp1, now_num);
            }
            else if(!strcmp(buf,"q") || !strcmp(buf,"x")) { /* 현재상태 벗어나기 */
                break;
            }
            else {
                key = 0;
            }
        }
        else {
            if(select < 1 || select > top_num) {    /* 입력이 숫자일경우 */
                printf("\033[s\0337\033[1;65H\007\033[7m해당 번호 없음\0338\033[u");
                key = 0;
            }
            else {
                key = 1;
                if(fseek(fp1,(select-1)*sizeof(struct dis_list),0)) {
                    printf("\r\nfseek에 문제가 있습니다.");
                }
                if(!fread((char*)&l_title,sizeof(struct dis_list),1,fp1)) {
                    printf("\r\n화일 읽기fread에 문제가 있습니다.");
                }
                if(l_title.look >= 0) { /* 삭제 되지 않은 게시물 */
                    ++l_title.look;
                    ie = 0;
                    count = CRT + 2;
                    sprintf(buf,"menu/%s.txt",menu.ccode);
                    fp2 = fopen(buf,"r");
                    fseek(fp2,l_title.position,0);
                    title_dis(ie);  /* 윗줄의 설명 출력 */
                    for(fos = 0L; fos < l_title.size; fos++) {
                        if((c = fgetc(fp2)) == '\n') {
                      /*      putchar('\r'); */
                            --count;
                            ++ie;
                        }
                        if(count) {
                            putchar(c);
                        }
                        else {
                            count = CRT + 2;
                            printf("\r\n\033(2\033[?85l다음[Enter] 연속[S] 중지[P] > ");
                            nfget_s(buf,1);
                            if(buf[0] == 'p' || buf[0] == 'P') {
                                break;
                            }
                            else if(buf[0] == 's' || buf[0] == 'S') {
                                count = -1;
                            }
                            else {
                                title_dis(ie);  /* 윗줄의 설명 출력 */
                            }
                        }
                    }
                    fseek(fp1,(select-1)*sizeof(struct dis_list),0);
                    fwrite((char*)&l_title,sizeof(struct dis_list),1,fp1);
                    fclose(fp2);
                    now_num = select;
                }
                else {
                    printf("\033[s\0337\033[1;64H\007\033[7m삭제 번호\033[0m     \0338\033[u");
                    key = 0;
                }
            }
        }
    }
    fclose(fp1);
}

int list_cont(fp1, now_num)
FILE *fp1;
int now_num;
{
    int i;
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J\r\n  %s : %s\r\n\n",menu.list,menu.ccode);
    printf("\033[7m\033[2K\r번호  아이디    날짜   라인 조회             제        목                      \033[0m");
    for(i = 0; i < CRT; i++) {
        if(fseek(fp1,(now_num-1)*sizeof(struct dis_list),0)) {
            break;
        }
        else {
            fread((char*)&l_title,sizeof(struct dis_list),1,fp1);
            if(l_title.look >= 0) {
                tp = localtime(&l_title.date);
                printf("\r\n%4d %-8s %2d/%02d/%02d %4d %3d %s",
                    l_title.num,l_title.id,tp->tm_year,tp->tm_mon+1,tp->tm_mday,
                    l_title.line, l_title.look, l_title.title);
            }
            else {
                --i;
            }
            --now_num;
        }
    }
    return(now_num);
}

title_dis(ie)
int ie;
{
printf("\033[;H\033[2J제목 : %s\r\n번호 : %4d   등록자 : %-9s %-9s               조회수 : %3d\r\n\n",
  l_title.title,l_title.num,l_title.name,l_title.id,l_title.look);
}
/* 로고화일 출력 */
void logo(ccode)
char *ccode;
{
    char *buf, ch;
    FILE *fp1;
    buf = temp;
    sprintf(buf,"logo/%s.log",ccode);
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
        nfget_s(buf,1);
    }
}

void id_in()
{
    int logfail, i, j, len;
    char id[9], passwd[9], ch, *buf, *tmp;
    struct tm *tp, *localtime();
    FILE *fp1, *fp2;
    buf = tmp_buf;
    tmp = temp;
    printf("\033[;H\033[2J");
    logfail = 0;
    if((fp1 = fopen("tmp/campfire","r")) != NULL) {
        fseek(fp1,0L,SEEK_END);
        len = ftell(fp1) / sizeof(struct nowwork) + 1;
        fseek(fp1,0L,SEEK_SET);
        if((chk_work = (struct nowwork *)calloc(len,sizeof(struct nowwork))) == NULL) {   /* 메모리 확보 */
            perror("\r\n메모리가 부족");
            host_end();
        }
        i = 0;
        while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
            if(strcmp(work.tty,tty)) {  /* 유령노드 제거 */
                chk_work[i].chose = work.chose;
                sprintf(chk_work[i].id,"%s",work.id);
                sprintf(chk_work[i].name,"%s",work.name);
                sprintf(chk_work[i].ccode,"%s",work.ccode);
                sprintf(chk_work[i].tty,"%s",work.tty);
                ++i;
            }
        }
        fclose(fp1);
        fp1 = fopen("tmp/campfire","w");
        for(j = 0; j < i; j++) {
            fwrite((char*)&chk_work[j],sizeof(struct nowwork),1,fp1);
        }
        fclose(fp1);
        free(chk_work); /* 확보 메모리 해제 */
    }
    while(1) {
        printf("\r\n\033$)1\033[?85h\r  처음 오시는 분은 '손님'을 치십시오.");
        printf("\r\n  회 원  아 이 디 : ");
        sfget_s(id,8);
        if((!strcmp(id,"손님")) || (!strcmp(id,"guest")) || (!strcmp(id,"GUEST"))) {  /* 손님으로 들어올 경우 가입프로그램 작동 */
            ioctl(0, TCSETAF, &systerm);
            execl("bin/guest","guest",tty,(char*)0);
            perror("\r\n가입프로그램이 동작하지를 않습니다.\r\n");
            host_end();
        }
        else {
            if(strlen(id) > 2) {
                i = 1;
                if((fp1 = fopen("tmp/campfire","r")) != NULL) {
                    while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
                        if(!strcmp(id,work.id)) {   /* 사용중인 아이디 검사 */
                            printf("\r\n이미 사용중인 아이디입니다.");
                            ++logfail;
                            i = 0;
                            break;
                        }
                    }
                    fclose(fp1);
                }
                if(i) {
                    if((fp1 = fopen("bin/id_pf","r")) == NULL) {
                        printf("\r\n아이디 검색화일이 열리지 않습니다.\r\n");
                        host_end();
                    }
                    i = 1;
                    while(fread((char*)&pf,sizeof(struct idst),1,fp1)) {
                        if(!strcmp(id,pf.id)) { /* 아이디 검사 */
                            i = 0;
                            fos = ftell(fp1) - sizeof(struct idst);
                            break;
                        }
                    }
                    fclose(fp1);
                    if(i) {
                        printf("\r\n해당회원이 존재하지 않습니다.");
                        ++logfail;
                    }
                    else {  /* 비밀번호 입력 */
                        i = 0;
                        len = 9;
                        printf("\r\n\033(2\033[?85l\r  비  밀   번  호 : ");
                        while((ch = getchar()) != '\r') {
                            if(ch == '\b'){
                                if(i > 0) {
                                    putchar(ch); putchar(' '); putchar(ch);
                                    if(i > 0) i--;
                                }
                            }
                            else if((ch == ' ') || (ch == 0x1b) || (ch == '\t'));
                            else if(i < len) {
                                passwd[i++] = ch;
                                putchar('*');
                            }
                        }
                        passwd[i] = 0x00;
                        if(strcmp(pf.passwd,passwd)) {  /* 비밀번호 검사 */
                            printf("\r\n비밀번호가 틀립니다.");
                            ++logfail;
                        }
                        else if(pf.level < 0) { /* 사용자레벨이 음수일때 */
                            printf("\r\n죄송합니다만 운영자와 상의하십시오.\r\n");
                            sleep(1);
                            host_end();
                        }
                        else {  /* 정상 아이디 입력시 */
                            printf("\r\n\n %s님 반갑습니다.",pf.name);
                            tp = localtime(&pf.logout);
                            printf("\r\n\n 전회 LOGOUT : 19%02d/%02d/%02d  %02d:%02d:%02d",
                              tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
                            sprintf(work.id,"%s",pf.id);    /* 작업내용 기록 */
                            pf.logout = buftime;
                            tp = localtime(&pf.logout);
                            printf("\r\n 금회 LOGIN  : 19%02d/%02d/%02d  %02d:%02d:%02d",
                              tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
                            sprintf(buf,"%02d.%02d(+)",tp->tm_mon+1,tp->tm_mday);
                            tmp = &pf.birthday[3];
                            if(!strcmp(tmp,buf)) {  /* 양력 생일 검사 */
                                logo("birthday");   /* 생일시에 보내는 로고 */
                            }
                            sprintf(work.name,"%s",pf.name);
                            sprintf(work.ccode,"top");
                            sprintf(work.tty,"%s",tty);
                            work.chose = ' ';
                            fp1 = fopen("tmp/campfire","a");
                            fwrite((char*)&work,sizeof(struct nowwork),1,fp1);
                            fclose(fp1);
                            if((fp1 = fopen("bin/id_pf","r+")) == NULL) {   /* 접속시간 기록(사용자의 logout이용) */
                                printf("\r\n프로필 화일이 열리지 않습니다.");
                                host_end();
                            }
                            fseek(fp1,fos,SEEK_SET);
                            fwrite((char*)&pf,sizeof(struct idst),1,fp1);
                            fclose(fp1);
                            break;
                        }
                    }
                }
            }
            else ++logfail;
            if(logfail > 4) {   /* 아이디 입력 4번 실페시 접속 끊음 */
                printf("\r\n회원아이디와 비밀번호를 확인해 주십시오.\r\n");
                host_end();
            }
        }
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
nfget_s(str,len)
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
        if((ch == ' ') & (i == 1)) {
            putchar('\b');
            --i;
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

/* 메뉴 읽기 */
void get_menu(menucode)
char *menucode;
{
    int i = 1, j;
    char ch[2];
    FILE *fp1;
    if((fp1 = fopen("bin/menu","r")) == NULL) {
        printf("\r\n메뉴화일이 열리지 않습니다.");
        exit(1);
    }
    else {
        while(fread((char*)&menu,sizeof(struct config),1,fp1)) {
            if(!strcmp(menu.ccode,menucode)) {
                i = 0;
                break;
            }
        }
        fclose(fp1);
        if(i) {
            printf("\r\n%s에 해당하는 게시물이 없습니다.",menucode);
            exit(1);
        }
    }
}


/* 편지함에 도착된 편지 검사 */
check_letter()
{
    int i;
    char *buf;
    FILE *fp1;
    struct mail e_mail;
    buf = tmp_buf;
    sprintf(buf,"letter/%05d.mail",pf.num);
    i = 0;
    if((fp1 = fopen(buf,"r")) != NULL) {
        while(fread((char*)&e_mail,sizeof(struct mail),1,fp1)) {
            if(e_mail.T == '*') {
                ++i;
            }
        }
        fclose(fp1);
    }
    if(i) {
        printf("\007\r\n 편지가 %d통 도착했습니다.\r\n",i);
    }
}

int host_end()
{
    ioctl(0, TCSETAF, &systerm);
    exit(1);
}

