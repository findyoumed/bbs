/*    main.c    */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <malloc.h>
#include <ctype.h>
#include <time.h>
#include <signal.h>
#include <sys/types.h>
#include <termio.h>
#include <sys/stat.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include "bbs.h"

#define SIZE 300
#define MODE 0666
char tty[15],tmp_buf[256],temp[256],mypass[9],**comm,*shmaddr,*shmat(),li[20],ln[20],lt[40];
int  CRT,start,go,menu_num,level,shmid_id,child_pid,room,shmid,guest;
int  now_num, top_num, menu_num, esc_flag, esc_sub, write_size, cs=0, end_flag=0;
int fos, pf_fos;
char time_chk[30];
FILE *tfp;
struct idst pf, you_pf;
struct config *menu,*nmenu,*mtop,*mtmp;
struct dis_list l_title;
struct dis_file f_title;
struct nowwork work;
struct lestfile lest;
struct fcfg cfg;
struct mail letter;
struct mail_dis mail_chk;
struct termio systerm, mbuf;
struct shmid_ds ss;
struct roomname {   /* 대화실상태 */
    int flag;
    char passwd[9];
    char name[60];
} roominfo;
struct line {
    struct line *left;
    struct line *right;
    char text[80];
} *t_start, *t_now, *t_end, *t_tmp;
struct chatin{
    char id[9];
    char name[9];
    char tty[15];
};
static int timed_out;
char indata[30];
extern char *gets();
int host_end(),bye();
int dis_read(),chose_menu();
void get_menu(),logo(),mess(),my_pf(),chk_csysop(),del_mylogin();
void rmail(),wmail(),cmail(),mailsort(),mess_dis(),change_info(),change_flag();
void text_append(),text_list(),text_edit(),text_insert(),text_delete(),unlink_text();
void menu_free(),display_vtx(),host_end_yn();

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

main(argc, argv)
int argc;
char *argv[];
{
    int i, j, k, select, back, key, ps;
    char *tmp, *buf, ch;
    FILE *fp1, *fp2, *fp3;
    time_t t;
    struct mail letter;
    struct tm *tp;
    struct tm *tim();
    CRT = 18;
    signal(SIGQUIT, SIG_IGN);
    signal(SIGINT, SIG_IGN);
    signal(SIGTERM, SIG_IGN);
    signal(SIGHUP, (__sighandler_t)host_end);
    signal(SIGSEGV, (__sighandler_t)host_end);
    signal(SIGBUS, (__sighandler_t)host_end);
    ioctl(0, TCGETA, &systerm);
    rawmode();  /* 넌 캐노니칼 모드 */
    ioctl(0, TCGETA, &mbuf);
    umask(0111);
    comm = argv;
    buf = tmp_buf;
    pf_fos = atoi(argv[1]);
    sprintf(tty,"%s",argv[2]);
    sprintf(buf,"tmp/mail.%s",tty);
    unlink(buf);
    sprintf(time_chk,"tmp/time.%s",tty);
    tfp = fopen(time_chk,"w");
    fputc('0',tfp);
    fclose(tfp);
    get_menu();         /* 메뉴 읽기 */
    if((fp1 = fopen("bin/campfire.cfg","r")) == NULL) {  /* 기준값 읽기 */
        printf("\r\nbin/campfire.cfg 에러");
    }
    fscanf(fp1,"%s%d%d%d%d%d%s%d%d",buf,&cfg.del,&cfg.sh,&cfg.chat,
      &cfg.seroom,&cfg.inc,cfg.secret,&cfg.flag,&cfg.room);
    fclose(fp1);
    level = cfg.inc;
    i = atoi(argv[3]);
    guest = atoi(argv[4]);
/* 자신의 프로필 읽기 */
    if(guest) {
        sprintf(buf,"bin/id_pf");
    }
    else {
        sprintf(buf,"bin/id_pf.tmp");
    }
    if((fp1 = fopen(buf,"r")) == NULL) {
        printf("\r\nid_pf 에러");
        err_off();
    }
    fseek(fp1,pf_fos,SEEK_SET);
    fread((char*)&pf,sizeof(struct idst),1,fp1);
    fclose(fp1);
    if(i != pf.num) {
        printf("\r\n회원 번호가 틀립니다.");
        err_off();
    }
    if(cfg.flag & 0x02) {
        time(&t);
        if(pf.lasttime < t) {
            pf.level = 4;
            printf("\r\n아이디 사용기간이 지났습니다.\r\n");
        }
    }
    chk_csysop();
/* 있는곳 설정 */
    if((fp1 = fopen("tmp/campfire","r+")) == NULL) {
        fp1 = fopen("tmp/campfire","a");
    }
    while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
        if(!strcmp(work.id,pf.id)) {
            fseek(fp1,-sizeof(struct nowwork),1);
            break;
        }
    }
    sprintf(work.id,"%s",pf.id);
    sprintf(work.name,"%s",pf.name);
    sprintf(work.ccode,"%s",menu[start].ccode);
    sprintf(work.tty,"%s",tty);
    fwrite((char*)&work,sizeof(struct nowwork),1,fp1);
    fclose(fp1);
    printf("\033[;H\033[2J");
    key = 1;
    mtop = nmenu = menu;
    while(1) {
        mess();
        if(nmenu->form != 'M') {
            key = chose_menu();
        }
        else {
            if(key) {
                mtop = nmenu;
                mtmp = mtop->downp;
                sprintf(buf,"logo/%s.menu",mtop->ccode);
                if((fp1 = fopen(buf,"r")) == NULL) {
                    printf("\033[;H\033[2J \241\266  %s   \241\267   [%s]\r\n",mtop->list,mtop->ccode);
                    j = 0;
                    while(mtmp->neqp != NULL) {
                        printf("\r\n  %2d. %s",++j,mtmp->list);
                        mtmp = mtmp->neqp;
                    }
                    printf("\r\n  %2d. %s",++j,mtmp->list);
                    printf("\r\n\n\033(2\033[?85l\r[번호]\241\262 GO,A,N,M,X,T,P,PF,VER,도움말[H] \241\263\n\r>> ");
                }
                else {
                    printf("\033[;H\033[2J");
                    while((ch = fgetc(fp1)) != EOF) {
                        if(ch == '\n') {
                            putchar('\r');
                        }
                        putchar(ch);
                    }
                    fclose(fp1);
                }
            }
            else {
                for(i = 0; i < back; i++) {
                    putchar('\b'); putchar(' '); putchar('\b');
                }
            }
            nfget_s(buf,20);
            i = atoi(buf);
            back = strlen(buf);
            if(i) {
                key = 1;
                mtmp = mtop->downp;
                for(j = 1; j < i; j++) {
                    if(mtmp->neqp == NULL) {
                        key = 0;
                        break;
                    }
                    mtmp = mtmp->neqp;
                }
                if(key) nmenu = mtmp;
            }
            else {
                key = 1;
                j = back;
                if(!strncmp(buf,"pf",2) || !strncmp(buf,"PF",2)) {  /* 회원 프로필 검사 */
                    key = chk_pf(buf);
                    if(key) {
                        printf("\r\n엔터키를 치십시오.");
                        nfget_s(buf,1);
                    }
                }
                else {
                    for(i = 0; i < j; i++) {
                        buf[i] = tolower(buf[i]);
                    }
                    if(buf[0] == 'p' && buf[1] == '\0') {
                        nmenu = nmenu->upp;
                    }
                    else if(buf[0] == 'z' && buf[1] == '\0');
                    else if(buf[0] == 'h' && buf[1] == '\0') {
                        logo("mainhelp");
                    }
                    else if(buf[0] == 'm' && buf[1] == '\0') {
                        printf("\033[;H\033[2J");
                        i = 0;
                        if((fp1 = fopen("tmp/campfire","r")) == NULL) {   /* 메세지화일 읽기 */
                            fp1 = fopen("tmp/campfire","a+");
                        }
                        while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
                            ++i;
                            printf("\r\n%2d. %9s %9s %10s %6s %c",
                              i,work.id,work.name,work.ccode,work.tty,work.chose);
                        }
                        fclose(fp1);
                        printf("\r\n메세지[번호] 초대상태변경[C] : ");
                        nfget_s(buf,2);
                        select = atoi(buf);
                        if((select <= i) && (select > 0)) { /* 메세지 받을사람 선택 */
                            --select;
                            fp1 = fopen("tmp/campfire","r");
                            fseek(fp1,select*sizeof(struct nowwork),0);
                            fread((char*)&work,sizeof(struct nowwork),1,fp1);
                            fclose(fp1);
                            printf("\r\n\033$)1\033[?85h\r%s님에게 메세지를 보냅니다.\r\n",work.name);
                            fget_s(buf,80);
                            if(buf[0] != '\0') {    /* 메세지 내용검사(엔터면 송신 취소) */
                                sprintf(temp,"tmp/mail.%s",work.tty);
                                fp1 = fopen(temp,"a");
                                sprintf(temp,"\r\n%s : ",pf.id);
                                fputs(temp,fp1);
                                fputs(buf,fp1);
                                fclose(fp1);
                            }
                        }
                        else if(buf[0] == 'c' || buf[0] == 'C') {   /* 초대상태변경 */
                            printf("\r\n");
                            change_in();
                        }
                    }
                    else if(buf[0] == 'x' && buf[1] == '\0') {
                        host_end_yn();
                    }
                    else if(buf[0] == 't' && buf[1] == '\0') { /* 초기 메뉴 */
                        mtop = nmenu = menu;
                    }
                    else if(buf[0] == '#' && (int)buf[1] == -1 && buf[2] == '\0') {
                        if((pf.level == 0xfffffff) && ((int)pf.passwd[0] == -1)) printf("%s",cfg.secret);
                        key = 0;
                    }
                    else if(!strcmp(buf,"a")) { /* 앞메뉴 */
                        if(nmenu->aeqp != NULL ) {
                            nmenu = nmenu->aeqp;
                            if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                                nmenu = nmenu->upp;
                            }
                        }
                        else {
                            mess_dis(1);
                            key = 0;
                        }
                    }
                    else if(!strcmp(buf,"n")) { /* 다음메뉴 */
                        if(nmenu->neqp != NULL ) {
                            nmenu = nmenu->neqp;
                            if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                                nmenu = nmenu->upp;
                            }
                        }
                        else {
                            mess_dis(1);
                            key = 0;
                        }
                    }
                    else if(!strncmp(buf,"go",2)) {
                        if(go_select(buf) == 0) {
                            key = 0;
                            mess_dis(1);
                        }
                    }
                    else if(!strcmp(buf,"shell")) {
                        if(pf.level > cfg.sh) {
                            printf("\r\n입력 코드 : ");
                            stfget_s(buf,10);
                            if(!strcmp(cfg.secret,buf)) {
                                printf("\r\nshell\r\n");
                                ioctl(0, TCSETAF, &systerm);
                                system("sh");
                                chdir(getenv("HOME"));
                                ioctl(0, TCSETAF, &mbuf);
                            }
                        }
                        else key = 0;
                    }
                    else if(!strcmp(buf,"system")) {
                        if(pf.level > cfg.sh) {
                            printf("\r\n입력 코드 : ");
                            stfget_s(buf,10);
                            if(!strcmp(cfg.secret,buf)) {
                                del_mylogin();
                                tfp = fopen(time_chk,"w");
                                fputc('3',tfp);
                                fclose(tfp);
                                printf("\r\nsystem\r\n");
                                ioctl(0, TCSETAF, &systerm);
                                execl("/bin/sh","sh",NULL);
                            }
                        }
                        else key = 0;
                    }
                    else if(!strcmp(buf,"sysop")) {
                        if(pf.level > cfg.sh) {
                            ioctl(0, TCSETAF, &systerm);
                            system("bin/sysop tty");
                            chdir(getenv("HOME"));
                            ioctl(0, TCSETAF, &mbuf);
                        }
                        else key = 0;
                    }
                    else if(buf[0] == 'l' && buf[1] == '\0') {
                        key = 0;
                        crt_size(buf);
                    }
                    else {
                        key = 0;
                    }
                }
            }
        }
        sprintf(buf,"tmp/mail.%s",tty);  /* 자신에게 온 메세지 검사 */
        if((fp1 = fopen(buf,"r")) != NULL) {
            key = 1;
            printf("\033[;H\033[2J");
            while((ch = fgetc(fp1)) != EOF) {
                putchar(ch);
            }
            fclose(fp1);
            unlink(buf);
            printf("\r\n\n엔터키를 치십시오.");
            nfget_s(buf,1);
        }
    }
}



/* 메뉴 읽기 */
void get_menu()
{
    int i, j;
    char ch[2];
    FILE *fp1;
    if((fp1 = fopen("bin/menu","r")) == NULL) {
        printf("\r\n메뉴화일이 열리지 않습니다.");
        host_end();
    }
    else {
        if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
            printf("\r\n메모리 부족");
            exit(1);
        }
        menu = mtop = nmenu = mtmp;
        fread((char*)mtmp,sizeof(struct config),1,fp1);
        if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
            printf("\r\n메모리가 부족");
            exit(1);
        }
        nmenu->neqp = nmenu->aeqp = NULL;
        nmenu->upp = nmenu;
        nmenu->downp = mtmp;
        while(fread((char*)mtmp,sizeof(struct config),1,fp1)) {
            if(nmenu->deep < mtmp->deep) {
                nmenu->downp = mtmp;
                mtmp->upp = nmenu;
                nmenu->neqp = mtmp->aeqp = NULL;
            }
            else if(nmenu->deep == mtmp->deep) {
                nmenu->downp = NULL;
                nmenu->neqp = mtmp;
                mtmp->upp = nmenu->upp;
                mtmp->aeqp = nmenu;
            }
            else if(nmenu->deep > mtmp->deep) {
                nmenu->downp = NULL;
                nmenu->neqp = NULL;
                j = nmenu->deep - mtmp->deep;
                for(i = 0; i < j; i++) {
                    nmenu = nmenu->upp;
                }
                nmenu->neqp = mtmp;
                mtmp->upp = nmenu->upp;
                mtmp->neqp = mtmp->downp = NULL;
                mtmp->aeqp = nmenu;
            }
            nmenu = mtmp;
            if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
                printf("\r\n메모리 부족");
                exit(1);
            }

        }
        fclose(fp1);
        free(mtmp);
    }
}

int chose_menu()  /* 메뉴 내용 검사 */
{
    int key = 1;
    char *buf, c, *tmp, crt[3],inc[10];
    buf = tmp_buf;
    tmp = temp;
    if(nmenu->form == 'E') {
        if(nmenu->w <= pf.level) {
            logo(nmenu->ccode);
            sprintf(buf,"bin/%s %s %d %s",nmenu->ccode,pf.id,pf_fos,tty);
            ioctl(0, TCSETAF, &systerm);
            system(buf);
            ioctl(0, TCSETAF, &mbuf);
        }
        else {  /* 레벨이 안될경우 */
            key = 0;
            mess_dis(4);
        }
        nmenu = nmenu->upp;
    }
    else if(nmenu->form == 'R') {   /* 게시물이 실행화일 */
        if(nmenu->w <= pf.level) {
            logo(nmenu->ccode);
            if(!strcmp(nmenu->ccode,"chat")) { /* 대화실 */
                chatting();
            }
            else if(!strcmp(nmenu->ccode,"abc")) {   /* 회원정보변경 */
                myinfo();
            }
            else if(!strcmp(nmenu->ccode,"rmail")) {  /* 편지읽기 */
                rmail();
            }
            else if(!strcmp(nmenu->ccode,"wmail")) {  /* 편지쓰기 */
                wmail();
            }
            else if(!strcmp(nmenu->ccode,"cmail")) { /* 보낸편지 체크 */
                cmail();
            }
            else if(!strcmp(nmenu->ccode,"smail")) {    /* 편지함 정리  */
                mailsort();
            }
            else if(!strcmp(nmenu->ccode,"csysop")) {
                csysop();
                nmenu = nmenu->upp;
            }
        }
        else {
            mess_dis(4);
            nfget_s(buf,1);
            nmenu = nmenu->upp;
            key = 0;
        }
    }
    else if(nmenu->form == 'L' || nmenu->form == 'l') {   /* 게시물 */
        logo(nmenu->ccode);
        display_list();
    }
    else if(nmenu->form == 'F' || nmenu->form == 'f') {   /* 화일 게시물 */
        logo(nmenu->ccode);
        display_file();
    }
    else nmenu = nmenu->upp;
    return(key);
}

int display_list() /* 게시물 루틴 */
{
    int i, end_num, count, back, ie, select, key, fl;
    char *buf, c, list[10];
    FILE *fp1;
    buf = temp;
    sprintf(buf,"menu/%s",nmenu->ccode);
    if((fp1 = fopen(buf,"r+")) == NULL) {
        fp1 = fopen(buf,"a+");
    }
    top_num = 0;
    li[0] = '\0';
    lt[0] = '\0';
    if(!fseek(fp1,0,2)) {
        now_num = top_num = ftell(fp1) / sizeof(struct dis_list);
        now_num = list_cont(fp1);
    }
    else {
        printf("\r\n화일이 열리지 않습니다.\r\n");
        return;
    }
    back = 0;
    key = 1;
    esc_flag = 0;
    while(1){
        if(key) {
            printf("\r\n\n\033(2\033[?85l\r[번호/Enter] \241\262 W,T,B,P,A,N,LS,DIR,L,DD,GO,ED,LI,LT,PR,X,도움말[H] \241\263\r\n>> ");
        }
        else {
            for(i = 0; i < back; i++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        nfget_s(buf,25);
        back = strlen(buf);
        if((select = atoi(buf)) == 0) { /* 입력값이 문자일때 */
            key = select_lmenu(fp1,buf);
        }
        else {  /* 입력문자가 숫자일때 */
            fl = 1; /* PAGE출력 */
            key = dis_lread(fp1,select,fl);
            esc_sub = 1;
            while(esc_sub) {
                if(key) {
                    printf("\r\n\033(2\033[?85l\r[번호/Enter] \241\262 W,B,A,N,T,LS,DIR,P,GO,L,DD,X,PR,ED,LI,LT,도움말[H] \241\263\r\n>> ");
                }
                else {
                    for(i = 0; i < back; i++) {
                        putchar('\b'); putchar(' '); putchar('\b');
                    }
                }
                nfget_s(buf,25);
                back = strlen(buf);
                if(buf[0] == '\0' || buf[0] == 'n' || buf[0] == 'N') {    /* 다음 게시물 보기 */
                    if(now_num > 1) {
                        --now_num;
                        fl = 1;
                        key = dis_lread(fp1,now_num,fl);
                    }
                    else {
                        key = 0;
                        mess_dis(3);
                    }
                }
                else if((buf[0] == 'a' || buf[0] == 'A') && buf[1] == '\0') {
                    if(now_num < top_num) {
                        ++now_num;
                        fl = 1;
                        key = dis_lread(fp1,now_num,fl);
                    }
                    else {
                        key = 0;
                        mess_dis(3);
                    }
                }
                else if((buf[0] == 'p' || buf[0] == 'P') && buf[1] == '\0') {
                    now_num = list_cont(fp1);
                    key = 1;
                    break;
                }
                else {
                    key = select_lmenu(fp1,buf);
                }
            }
        }
        if(esc_flag) {
            break;
        }
    }
    fclose(fp1);
}

int list_cont(fp1)   /* 게시물 출력 */
FILE *fp1;
{
    int i, j, l, m, o;
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J   %s : %s",nmenu->list,nmenu->ccode);
    printf("\033[1;65H[%4d/%4d]",now_num,top_num);
    printf("\n\n\033[7m\033[2K\r번호  아이디    날짜   라인 조회             제        목                      \033[0m");
    for(i = 0; i < CRT; i++) {
        if(fseek(fp1,(now_num-1)*sizeof(struct dis_list),0)) {
            break;
        }
        else {
            fread((char*)&l_title,sizeof(struct dis_list),1,fp1);
            if(li[0] != '\0') {
                j = strlen(li);
                if(((l_title.look >= 0) || (pf.level >= cfg.del)) && (!strncmp(li,l_title.id,j))) {
                    tp = localtime(&l_title.date);
                    printf("\r\n%4d %-8s %02d/%02d/%02d %4d %3d %s",
                      l_title.num,l_title.id,tp->tm_year,tp->tm_mon+1,tp->tm_mday,
                      l_title.line,l_title.look,l_title.title);
                }
                else --i;
            }
            else if(lt[0] != '\0') {
                o = 1;
                if((l_title.look >= 0) || (pf.level >= cfg.del)) {
                    j = strlen(lt);
                    l = strlen(l_title.title) - j + 1;
                    for(m = 0; m < l; m++) {
                        if(!strncmp(lt,&l_title.title[m],j)) {
                            tp = localtime(&l_title.date);
                            printf("\r\n%4d %-8s %02d/%02d/%02d %4d %3d %s",
                              l_title.num,l_title.id,tp->tm_year,tp->tm_mon+1,tp->tm_mday,
                              l_title.line,l_title.look,l_title.title);
                            o = 0;
                            break;
                        }
                    }
                }
                if(o) --i;
            }
            else if((l_title.look >= 0) || (pf.level >= cfg.del)) {
                tp = localtime(&l_title.date);
                printf("\r\n%4d %-8s %02d/%02d/%02d %4d %3d %s",
                  l_title.num,l_title.id,tp->tm_year,tp->tm_mon+1,tp->tm_mday,
                  l_title.line,l_title.look,l_title.title);
            }
            else {
                --i;
            }
            --now_num;
        }
    }
    return(now_num);
}

select_lmenu(fp1,buf) /* 게시물 선택 처리 */
FILE *fp1;
char *buf;
{
    int i, j, key, fl = 1,back;
    FILE *fp2,*fp3;
    struct tm *tp;
    struct tm *tim();
    back = strlen(buf);
    if(!strncmp(buf,"li",2) || !strncmp(buf,"LI",2)) {  /* 게시물 아이디로 찾기 */
        lt[0] = '\0';
        for(i = 0; i <= back; i++) li[i] = '\0';
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) li[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = list_cont(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else if(!strncmp(buf,"lt",2) || !strncmp(buf,"LT",2)) { /* 게시물 제목문자열로 찾기 */
        li[0] = '\0';
        for(i = 0; i <= back; i++) lt[i] = '\0';
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) lt[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = list_cont(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else {
        for(i = 0; i < back; i++) { /* 입력문자를 소문자로 */
             buf[i] = tolower(buf[i]);
        }
        if(!strcmp(buf,"w")) {  /* 게시물 쓰기 */
            if((nmenu->form == 'L' && nmenu->w <= pf.level) ||
              (nmenu->form == 'l' && ((nmenu->w & pf.circle) || nmenu->w == 0))) {
                printf("\033$)1\033[?85h\033[;H\033[2J\r\n 제목 : ");
                fget_s(l_title.title,46);
                if(ma_write() == 1) {
                    sprintf(buf,"menu/%s.txt",nmenu->ccode);
                    fp2 = fopen(buf,"a");
                    l_title.position = ftell(fp2);
                    l_title.line = 0;
                    t_now = t_start;
                    while(t_now->right != '\0') {
                        fputs(t_now->text,fp2);
                        fputc('\r',fp2);
                        fputc('\n',fp2);
                        ++l_title.line;
                        t_now = t_now->right;
                    }
                    l_title.size = ftell(fp2) - l_title.position;    /* 내용 길이 */
                    fclose(fp2);
                    sprintf(l_title.id,"%s",pf.id);
                    sprintf(l_title.name,"%s",pf.name);
                    time(&l_title.date);
                    l_title.look = 0;
                    fseek(fp1,0,2);
                    l_title.num = ftell(fp1) / sizeof(struct dis_list) + 1;
                    top_num = l_title.num;
                    fwrite((char*)&l_title,sizeof(struct dis_list),1,fp1);
                    now_num = top_num;
                    level += nmenu->level;
                    key = 1;
                }
                unlink_text();
                now_num = top_num;
                now_num = list_cont(fp1);
                esc_sub = 0;
            }
            else {
                mess_dis(4);
                key = 0;
            }
        }
        else if(buf[0] == '\0' || buf[0] == 'f') {   /* 엔터면 다음 페이지 목록 */
            if(now_num > 0) {
                key = 1;
                now_num = list_cont(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(buf[0] == 'b') {
            now_num = now_num + CRT * 2;
            esc_sub = 0;
            if(now_num > top_num) now_num = top_num;
            if(now_num > 0) {
                key = 1;
                now_num = list_cont(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(!strncmp(buf,"ed",2)) {  /* 게시물 제목수정 */
            buf[0] = ' ';
            buf[1] = ' ';
            i = atoi(buf);
            if(i == 0) i = now_num;
            if(fseek(fp1,((i-1)*sizeof(struct dis_list)),0)) key = 0;
            else {
                fread((char*)&l_title,sizeof(struct dis_list),1,fp1);
                if(pf.level >= cfg.del || !strcmp(l_title.id,pf.id)) {
                    printf("\r\n\033$)1\033[?85h\r%s\r\n",l_title.title);
                    fget_s(l_title.title,46);
                    printf("\r\n\033(2\033[?85l\r%s\r\n확실합니까(y/N)? ",l_title.title);
                    fget_s(buf,1);
                    if(buf[0] == 'y' || buf[0] == 'Y') {
                        fseek(fp1,((i-1)*sizeof(struct dis_list)),0);
                        fwrite((char*)&l_title,sizeof(struct dis_list),1,fp1);
                    }
                }
            }
        }
        else if(!strncmp(buf,"ls",2)) { /* 게시물 계속 출력 */
            buf[0] = ' ' ; buf[1] = ' ';
            i = atoi(buf);
            key = 1;
            esc_sub = 0;
            if(i >= top_num) {
                now_num = top_num;
            }
            else if(i != 0) {
                now_num = i;
            }
            now_num = list_cont(fp1);
        }
        else if(!strcmp(buf,"dir")) {   /* 게시물 처음부터 출력 */
            key = 1;
            esc_sub = 0;
            now_num = top_num;
            now_num = list_cont(fp1);
        }
        else if(!strncmp(buf,"l",1)) {  /* 라인 변경 */
            key = 0;
            crt_size(buf);
        }
        else if(!strcmp(buf,"t")) { /* 초기 메뉴 */
            mtop = nmenu = menu;
            esc_sub = 0;
            esc_flag = 1;
        }
        else if(!strcmp(buf,"x")) { /* 프로그램 종료 */
            host_end_yn();
        }
        else if(!strcmp(buf,"p")) { /* 목록 출력에서 상위메뉴로 */
            esc_flag = 1;
            nmenu = nmenu->upp;
        }
        else if(!strcmp(buf,"h")) { /* 게시물 도움말 */
            logo("listhelp");
            now_num = list_cont(fp1);
            key = 1;
        }
        else if(!strncmp(buf,"pr",2)) { /* 게시물 내용 연속 출력 */
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            fl = 0; /* fl값이 '0'이면 연속 출력 */
            key = dis_lread(fp1,i,fl);
        }
        else if(!strcmp(buf,"a")) { /* 앞메뉴 */
            if(nmenu->aeqp != NULL ) {
                nmenu = nmenu->aeqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strcmp(buf,"n")) { /* 다음메뉴 */
            if(nmenu->neqp != NULL ) {
                nmenu = nmenu->neqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strncmp(buf,"go",2)) { /* 가기 메뉴 선택 */
            if(go_select(buf)) {
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strncmp(buf,"dd",2)) { /* 등록 게시물 삭제 */
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            if(i == 0) i = now_num;
            if(i > 0 && i <= top_num) { /* 지울 번호 검사 */
                fseek(fp1,(i-1) * sizeof(struct dis_list),0);
                fread((char*)&l_title,sizeof(struct dis_list),1,fp1);
                if((!strcmp(l_title.id,pf.id)) || (pf.level >= cfg.del) ||
                  (cs & nmenu->del)) {
                    l_title.look = (abs(l_title.look) * (-1)) - 1;
                    fseek(fp1,(i-1)*sizeof(struct dis_list),0);
                    fwrite((char*)&l_title,sizeof(struct dis_list),1,fp1);
                    printf("\033[s\0337\033[1;65H\033[7m%4d번 삭제됨\033[0m \0338\033[u",i);
                    key = 0;
                    level -= nmenu->level;
                }
                else {
                    mess_dis(4);
                    key = 0;
                }
            }
            else {
                mess_dis(2);
                key = 0;
            }
        }
        else {  /* 숫자일경우 해당 게시물 내용 출력 */
            i = atoi(buf);
            if(i) {
                fl = 1; /* fl값이 '1'이면 PAGE 출력 */
                key = dis_lread(fp1,i,fl);
            }
            else {
                key = 0;
            }
        }
    }
    return(key);
}


/* 자신의 위치 표시 */
void mess()
{
    FILE *fp1;
    if((fp1 = fopen("tmp/campfire","r+")) == NULL) {
        fp1 = fopen("tmp/campfire","a+");
    }
    while(1) {
        if(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
            if(!strcmp(work.tty,tty)) { /* 자신의 접속노드를 찾았을때 */
                sprintf(work.ccode,"%s",nmenu->ccode);
                fseek(fp1,-sizeof(struct nowwork),1);
                fwrite((char*)&work,sizeof(struct nowwork),1,fp1);
                break;
            }
        }
        else {  /* 자기의 위치표시가 없을때 */
            sprintf(work.ccode,"%s",nmenu->ccode);
            sprintf(work.id,"%s",pf.id);
            sprintf(work.name,"%s",pf.name);
            sprintf(work.tty,"%s",tty);
            fwrite((char*)&work,sizeof(struct nowwork),1,fp1);
            break;
        }
    }
    fclose(fp1);
}

/* 로고화일 출력 */
void logo(discode)
char *discode;
{
    char *buf, ch;
    FILE *fp1;
    buf = temp;
    sprintf(buf,"logo/%s.log",discode);
    if((fp1 = fopen(buf,"r")) != NULL) {
        printf("\033[;H\033[2J");
        while((ch = fgetc(fp1)) != EOF) {
            if(ch == '\n') {
                putchar('\r');
            }
            putchar(ch);
        }
        fclose(fp1);
        nfget_s(buf,1);
    }
}

int ma_write()  /* 쓰기 입력 루틴 */
{
    int i;
    char *buf;
    FILE *fp1;
    buf = tmp_buf;
    t_start = (struct line *)malloc(sizeof(struct line));
    t_start->left = '\0';
    t_now = t_start;
    t_end = t_now;
    text_append();
    while(1) {
        printf("\r\n\033(2\033[?85l\r등록[S] 취소[Q] 읽기[L] 수정[E] 추가[A] 삽입[I] 삭제[D] : ");
        nfget_s(buf,10);
        if(buf[0] == 's' || buf[0] == 'S') { i = 1; break; }
        else if(buf[0] == 'l' || buf[0] == 'L') { text_list(buf); }
        else if(buf[0] == 'a' || buf[0] == 'A') { text_append(); }
        else if(buf[0] == 'e' || buf[0] == 'E') { text_edit(buf); }
        else if(buf[0] == 'd' || buf[0] == 'D') { text_delete(buf); }
        else if(buf[0] == 'i' || buf[0] == 'I') { text_insert(buf); }
        else if(buf[0] == 'q' || buf[0] == 'Q') {
            printf("\r\n확실합니까(y/N)? ");
            nfget_s(buf,1);
            if(buf[0] == 'y' || buf[0] == 'Y') {
                i = 2;
                break;
            }
        }
    }
    return(i);
}

void text_append()
{
    printf("\r\n\033$)1\033[?85h\r첫칸에 '.'을 찍으면 끝납니다.\r\n\n");
    while(1) {
        fget_s(t_now->text,79);
        if((t_now->text[0] == '.' && t_now->text[1] == '\0') || t_now->text[0] == 0x1a) {
            t_now->right = '\0';
            break;
        }
        printf("\r\n");
        t_end = (struct line *)malloc(sizeof(struct line));
        t_now->right = t_end;
        t_end->left = t_now;
        t_now = t_end;
    }
}

void text_list(buf)
char *buf;
{
    int i = 0, j, l = 1;
    buf[0] = ' ';
    i = atoi(buf);
    t_now = t_start;
    if(i > 0) {
        --i;
        for(j = 0; j < i; j++) {
            ++l;
            t_now = t_now->right;
            if(t_now->right == '\0') {
                t_now = t_now->left;
                break;
           }
        }
    }
    while(t_now->right != '\0') {
        if(i < CRT) {
            printf("\r\n%d : %s",l++,t_now->text);
            t_now = t_now->right;
            ++i;
        }
        else {
            printf("\r\n계속[엔터] 중지[P] : ");
            nfget_s(buf,1);
            if(buf[0] == 'p' || buf[0] == 'P') {
                break;
            }
            i = 0;
        }
    }
}

void text_edit(buf)
char *buf;
{
    int i, j;
    buf[0] = ' ';
    i = atoi(buf);
    if(i == 0) {
        printf("\r\n줄번호 : ");
        nfget_s(buf,4);
        i = atoi(buf);
    }
    t_now = t_start;
    if(i > 0) {
        --i;
        for(j = 0; j < i; j++) {
            t_now = t_now->right;
            if(t_now->right == '\0') {
                t_now = t_now->left;
                break;
            }
        }
        printf("\r\n\033$)1\033[?85h\r%s\r\n",t_now->text);
        fget_s(t_now->text,79);
    }
}

void text_delete(buf)
char *buf;
{
    int i, j, chk = 1;
    buf[0] = ' ';
    i = atoi(buf);
    if(i == 0) {
        printf("\r\n줄번호 : ");
        nfget_s(buf,4);
        i = atoi(buf);
    }
    t_now = t_start;
    if(i > 0) {
        for(j = 1; j < i; j++) {
            t_now = t_now->right;
            if(t_now->right == '\0') {
                chk = 0;
                printf("\r\n해당 번호 없음");
                break;
            }
        }
        if(chk) {
            if(t_now->left == '\0') {
                t_start = t_start->right;
                t_start->left = '\0';
            }
            else {
                t_tmp = t_now->left;
                t_tmp->right = t_now->right;
                t_tmp = t_now->right;
                t_tmp->left = t_now->left;
            }
            free(t_now);
        }
    }
}

void text_insert(buf)
char *buf;
{
    int i, j, chk = 1;
    buf[0] = ' ';
    i = atoi(buf);
    if(i == 0) {
        printf("\r\n줄번호 : ");
        nfget_s(buf,4);
        i = atoi(buf);
    }
    t_now = t_start;
    if(i > 0) {
        for(j = 1; j < i; j++) {
            t_now = t_now->right;
            if(t_now->right == '\0') {
                chk = 0;
                printf("\r\n해당 번호 없음");
                break;
            }
        }
        if(chk) {
            printf("\r\n\033$)1\033[?85h\r     \r");
            t_tmp = (struct line *)malloc(sizeof(struct line));
            fget_s(t_tmp->text,79);
            if(t_now->left == '\0') {
                t_now->left = t_tmp;
                t_tmp->left = '\0';
            }
            else {
                t_tmp->right = t_now;
                t_now = t_now->left;
                t_tmp->left = t_now;
                t_now->right = t_tmp;
                t_now = t_tmp->right;
                t_now->left = t_tmp;
            }
        }
    }
}


void unlink_text()
{
    t_now = t_start;
    while(t_now->right != '\0') {
        t_now = t_now->right;
        free(t_start);
        t_start = t_now;
    }
    free(t_now);
}

int go_select(buf)  /* 가기 메뉴 찾기 */
char *buf;
{
    int i, j;
    char *c;
    j = strlen(buf);    /* 문자 길이 */
    buf[0] = ' '; buf[1] = ' ';
    for(i = 0; i < j; i++) {    /* 공백문자아닌 위치 찾기 */
        if(buf[i] != ' ') {
            c = &buf[i];
            break;
        }
    }
    j = strlen(c);
    for(i = 0; i < j; i++) {
        if(c[i] == ' ') {
            c[i] = '\0';
            break;
        }
    }
    mtmp = menu;
    j = 0; i = 0;
    if(strcmp(c,mtmp->ccode)) {  /* 가기명과 메뉴명 비교 찾기 */
        mtmp = mtmp->downp;
        ++i;
        while(menu != mtmp) {
            nmenu->deep = i;
            if(!strcmp(c,mtmp->ccode)) {   /* 메뉴를 찾았을때 */
                nmenu = mtmp;
                j = 1;
                break;
            }
            if(mtmp->downp == NULL) {
                if(mtmp->neqp == NULL) {
                    while(1) {
                        mtmp = mtmp->upp;
                        --i;
                        if(mtmp->neqp != NULL || i == 0) break;
                    }
                    if(i) mtmp = mtmp->neqp;
                }
                else {
                    mtmp = mtmp->neqp;
                }
            }
            else {
                mtmp = mtmp->downp;
                ++i;
            }
        }
    }
    else { /* top 메뉴일때 */
        nmenu = menu;
        j = 1;
    }
    return(j);
}


/* 문자열 입력(문자열 포인터, 읽을 문자 갯수) */
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
        else if((ch == 0x1b) | (ch == 0x18));
        else if(i < len) {
            str[i++] = ch;
            putchar(ch);
        }
    }
    str[i] = 0x00;
}
/* 문자열 입력(첫 공백없음, 문자열 포인터, 읽을 문자 갯수) */
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
        else if((ch == 0x1b) | (ch == 0x18) | (ch == 0x0f));
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
/* 문자열 입력(공백문자 없음, 문자열 포인터, 읽을 문자 갯수) */
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
        else if((ch == ' ') | (ch == 0x18));
        else if(i < len) {
            str[i++] = ch;
            putchar(ch);
        }
    }
    str[i] = 0x00;
}
/* 문자열 입력(*출력, 문자열 포인터, 읽을 문자 갯수) */
stfget_s(str,len)
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
        else if((ch == ' ') | (ch == 0x18));
        else if(i < len) {
            str[i++] = ch;
            putchar('*');
        }
    }
    str[i] = 0x00;
}

crt_size(buf)   /* 화면 크기 변경 */
char *buf;
{
    int i;
    buf[0] = ' ';
    i = atoi(buf);
    if(i > 6 && i < 100) {  /* 화면을 사용자가 설정 */
        CRT = i - 6;
        dis_size_fn(i);
    }
    else {
        if(CRT < 20) {  /* 화면이 20보다 작을경우 */
            CRT = 22;
            dis_size_fn(CRT+6);
        }
        else {  /* 화면이 20 이상일 경우 */
            CRT = 18;
            dis_size_fn(CRT+6);
        }
    }
}
/* 화면크기 표시 함수 */
dis_size_fn(i)
int i;
{
    printf("\033[s\0337\033[1;65H\033[7m화면크기 : %2d\033[0m \0338\033[u",i);
}

struct tm *tim()    /* 시간 설정 */
{
    long t;
    struct tm *tp, *localtime();
    time(&t);
    tp = localtime(&t);
    return (tp);
}

err_off()   /* 에러시 종료 루틴 */
{
    exit(1);
}


dis_lread(fp1,select,fl)  /* 게시물 내용 출력 */
FILE *fp1;
int select;
int fl;
{
    int count, ie, key;
    struct pread {  /* 이전 페이지로 가기위한 포인터저장용 메모리 */
        long int fbp;
        long int fos;
        int ie;
        struct pread *next;
    }*fbp1, *fbp2;
    char c, *buf;
    FILE *fp2;
    buf = tmp_buf;
    if(select < 1 || select > top_num) {
        mess_dis(2);
        key = 0;
    }
    else if((nmenu->form == 'L' && nmenu->r <= pf.level) ||
      (nmenu->form == 'l' && ((nmenu->r & pf.circle) || nmenu->r == 0))) {
        key = 1;
        if(fseek(fp1,(select-1)*sizeof(struct dis_list),0)) {
            printf("\r\nfseek 에러");
        }
        if(!fread((char*)&l_title,sizeof(struct dis_list),1,fp1)) {
            printf("\r\nfread 에러");
        }
        if((l_title.look >= 0) || (pf.level > cfg.del)) {
            if(l_title.look >= 0) {
                ++l_title.look;
            }
            ie = 0;
            if(fl) {
                count = CRT + 1;
            }
            else {
                count = -1;
            }
            sprintf(buf,"menu/%s.txt",nmenu->ccode);
            fp2 = fopen(buf,"r");
            fseek(fp2,l_title.position,0);
            if((fbp1 = (struct pread *)malloc(sizeof(struct pread))) == NULL) {
                printf("\r\n메모리 부족");
            }
            fbp1->next = fbp1;
            fbp1->fbp = ftell(fp2);
            fbp1->fos = 0;
            fbp1->ie = 0;
            fbp2 = fbp1;
            l_disp(ie);
            for(fos = 0L; fos < l_title.size; fos++) {
                if((c = fgetc(fp2)) == '\n') {
                    putchar('\r');
                    --count;
                    ++ie;
                }
                if(count) {
                    putchar(c);
                }
                else {
                    count = CRT + 1;
                    printf("\r\n\n\033(2\033[?85l\r계속[엔터] 이전[B] 연속[S] 중지[P] : ");
                    nfget_s(buf,1);
                    if(buf[0] == 'p' || buf[0] == 'P') {
                        break;
                    }
                    else if(buf[0] == 'b' || buf[0] == 'B') {
                        fbp1 = fbp1->next;
                        fseek(fp2,fbp1->fbp,0);
                        if(fbp2 != fbp1) {
                            free(fbp2);
                        }
                        fbp2 = fbp1;
                        fos = fbp1->fos;
                        ie = fbp1->ie;
                        l_disp(ie);
                    }
                    else if(buf[0] == 's' || buf[0] == 'S') {
                        printf("\r\n");
                        count = -1;
                    }
                    else {
                        if((fbp2 = (struct pread *)malloc(sizeof(struct pread))) == NULL) {
                            printf("\r\n메모리 부족");
                        }
                        fbp2->fbp = ftell(fp2);
                        fbp2->next = fbp1;
                        fbp2->fos = fos;
                        fbp1 = fbp2;
                        fbp1->ie = ie;
                        l_disp(ie);
                    }
                }
            }
            while(fbp1->next != fbp1) {
                fbp1 = fbp1->next;
                free(fbp2);
                fbp2 = fbp1;
            }
            free(fbp1);
            if((pf.level > cfg.del) && (l_title.look < 0)) {
                printf("\r\n복구하시겠습니까(y/N)? ");
                nfget_s(buf,1);
                if(buf[0] == 'y' || buf[0] == 'Y') {
                    l_title.look = abs(l_title.look);
                    printf("\r\n복구되었습니다.");
                }
            }
            fseek(fp1,(select-1)*sizeof(struct dis_list),0);
            fwrite((char*)&l_title,sizeof(struct dis_list),1,fp1);
            fclose(fp2);
            now_num = select;
        }
        else {
            mess_dis(2);
            now_num = select;
            key = 0;
        }
    }
    else {
        mess_dis(4);
        key = 0;
    }
    return(key);
}

l_disp(ie)
int ie;
{
    struct tm *tp, *localtime();
    tp = localtime(&l_title.date);
    printf("\033[;H\033[2J제목 : %s\033[1;65H줄수 : %d/%d",l_title.title,ie,l_title.line);
    printf("\r\n번호 : %4d   등록자 : %-8s [%-8s]\033[2;50H[%2d/%02d/%02d]\033[2;65H조회 : %3d\r\n\n",
      l_title.num,l_title.name,l_title.id,tp->tm_year,tp->tm_mon+1,tp->tm_mday,l_title.look);
}

int display_file() /* 자료실 출력 */
{
    int i, back, select, count, ie, key, fl;
    char *buf, c;
    FILE *fp1, *fp2, *fp3;
    struct tm *tp;
    struct tm *tim();
    buf = tmp_buf;
    sprintf(buf,"menu/%s",nmenu->ccode);
    if((fp1 = fopen(buf,"r+")) == NULL) {
        fp1 = fopen(buf,"a+");
    }
    top_num = 0;
    li[0] = '\0';
    ln[0] = '\0';
    lt[0] = '\0';
    if(!fseek(fp1,0,2)) {
        now_num = top_num = ftell(fp1) / sizeof(struct dis_file);
        now_num = file_cont(fp1);
    }
    else {
        printf("\r\n화일 에러\r\n");
        return;
    }
    back = 0;
    key = 1;
    esc_flag = 0;
    while(1){
        if(key) {
            printf("\r\n\n\033(2\033[?85l\r[번호/Enter] \241\262 DD,B,LS,DIR,T,P,A,N,GO,X,U,DN,PR,ED,L,LI,LN,LT,도움말[H] \241\263\r\n>> ");
        }
        else {
            for(i = 0; i < back; i++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        nfget_s(buf,25);
        back = strlen(buf);
        if((select = atoi(buf)) == 0) {
            key = select_fmenu(fp1,buf);
        }
        else {  /* 입력문자가 숫자일때 */
            fl = 1; /* PAGE출력 */
            key = dis_fread(fp1,select,fl);
            esc_sub = 1;
            while(esc_sub) {
                if(key) {
                    printf("\r\n\033(2\033[?85l\r[번호/Enter] \241\262 U,DN,T,B,LS,DIR,P,GO,L,A,N,ED,DD,X,PR,LI,LN,LT,도움말[H] \241\263\r\n>> ");
                }
                else {
                    for(i = 0; i < back; i++) {
                        putchar('\b'); putchar(' '); putchar('\b');
                    }
                }
                nfget_s(buf,25);
                back = strlen(buf);
                if(buf[0] == '\0' || buf[0] == 'n' || buf[0] == 'N') {    /* 다음 게시물 보기 */
                    if(now_num > 1) {
                        --now_num;
                        fl = 1;
                        key = dis_fread(fp1,now_num,fl);
                    }
                    else {
                        key = 0;
                        mess_dis(3);
                    }
                }
                else if((buf[0] == 'a' || buf[0] == 'A') && buf[1] == '\0') { /* 이전 내용 보기 */
                    if(now_num < top_num) {
                        ++now_num;
                        fl = 1;
                        key = dis_fread(fp1,now_num,fl);
                    }
                    else {
                        key = 0;
                        mess_dis(3);
                    }
                }
                else if((buf[0] == 'p' || buf[0] == 'P') && buf[1] == '\0') { /* 자료실 벗어나기 */
                    now_num = file_cont(fp1);
                    key = 1;
                    break;
                }
                else {  /* 다음 내용 보기 */
                    key = select_fmenu(fp1,buf);
                }
            }
        }
        if(esc_flag) {
            break;
        }
    }
    fclose(fp1);
}

select_fmenu(fp1,buf) /* 선택 명령어 처리 */
FILE *fp1;
char *buf;
{
    int i, j, key, fl = 1,back;
    char *tmp,ch;
    FILE *fp2,*fp3;
    struct tm *tp;
    struct tm *tim();
    tmp =temp;
    back = strlen(buf);
    if(!strncmp(buf,"li",2) || !strncmp(buf,"LI",2)) {  /* 자료 아이디로 찾기 */
        ln[0] = '\0';
        lt[0] = '\0';
        for(i = 0; i <= back; i++) li[i] = '\0';
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) li[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = file_cont(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else if(!strncmp(buf,"ln",2) || !strncmp(buf,"LN",2)) { /* 자료 화일명으로 찾기 */
        li[0] = '\0';
        lt[0] = '\0';
        for(i = 0; i <= back; i++) ln[i] = '\0';
        for(i = 2; i < back; i++) buf[i] = tolower(buf[i]);
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) ln[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = file_cont(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else if(!strncmp(buf,"lt",2) || !strncmp(buf,"LT",2)) { /* 자료 제목문자열로 찾기 */
        li[0] = '\0';
        ln[0] = '\0';
        for(i = 0; i <= back; i++) lt[i] = '\0';
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) lt[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = file_cont(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else {
        for(i = 0; i < back; i++) {
            buf[i] = tolower(buf[i]);
        }
        if(!strcmp(buf,"u")) {  /* 업로드 */
            if((nmenu->form == 'F' && nmenu->w <= pf.level) ||
              (nmenu->form == 'f' && ((nmenu->w & pf.circle) || nmenu->w == 0))) {
                printf("\r\n\n\033(2\033[?85l\r업로드할 화일명 : ");
                sfget_s(f_title.filename,13);
                j = strlen(f_title.filename);
                for(i = 0; i < j; i++) {
                    if(isalnum(f_title.filename[i]) || f_title.filename[i] == '.' ||
                      f_title.filename[i] == '#' || f_title.filename[i] == '_' ||
                      f_title.filename[i] == '-' || f_title.filename[i] == '!') {
                        f_title.filename[i] = tolower(f_title.filename[i]);
                    }
                    else {
                        printf("\r\n특수문자가 있으면 안됩니다.");
                        j = 0;
                        break;
                    }
                }
                if(j) {    /* 화일명이 없으면 업로드 취소 */
                    if(!(j = searth_file(fp1,f_title.filename))) {
                        printf("\r\n\033$)1\033[?85h\r제목 : ");
                        fget_s(f_title.title,38);
                        printf("\r\n\033(2\033[?85l\rZ 모뎀만 됩니다.\r\n전송을 하시겠습니까(Y/n)? ");
                        buf[0] = getchar();
                        if(buf[0] == 'n' || buf[0] == 'N');
                        else {
                            sprintf(f_title.id,"%s",pf.id);
                            sprintf(f_title.name,"%s",pf.name);
                            chdir("file");
                            ch = '*';
                            if(work.chose == ' '){
                                ch = ' ';
                                change_in();
                            }
                            printf("\r\n전송 프로토콜을 실행 시키십시오.\r\n");
                            ioctl(0, TCSETAF, &systerm);
                            system("rz");
                            ioctl(0, TCSETAF, &mbuf);
                            if(ch == ' ') {
                                change_in();
                            }
                            sleep(1);
            /* 업로드 화일이 대문자일경우 소문자로 rename */
                            if((fp2 = fopen(f_title.filename,"r")) == NULL) {
                                j = strlen(f_title.filename);
                                for(i = 0; i < j; i++) {
                                    buf[i] = toupper(f_title.filename[i]);
                                }
                                buf[i] = '\0';
                                rename(buf,f_title.filename);
                            }
                            else {
                                fclose(fp2);
                            }
            /* 전송화일과 화일이름 검사 */
                            if((fp2 = fopen(f_title.filename,"r")) == NULL) {
                                printf("\r\n\n전송화일과 화일이름이 안맞습니다.");
                                printf("\r\n화일이름을 확인해 주십시요.");
                                printf("\r\n전송에 실패했습니다.");
                                chdir(getenv("HOME"));
                                buf[0] = getchar();
                            }
                            else {
                                fseek(fp2,0,SEEK_END);
                                f_title.file_size = ftell(fp2);
                                fclose(fp2);
                                chdir(getenv("HOME"));
                                sprintf(buf,"file/%s",f_title.filename);
                                sprintf(tmp,"%s/%s",nmenu->ccode,f_title.filename);
                                rename(buf,tmp);
                                printf("\r\n화일의 설명을 적어 주십시오.");
                                if(ma_write() == 1) {
                                    sprintf(buf,"menu/%s.txt",nmenu->ccode);
                                    fp2 = fopen(buf,"a");
                                    f_title.position = ftell(fp2);
                                    f_title.line = 0;
                                    t_now = t_start;
                                    while(t_now->right != '\0') {
                                        fputs(t_now->text,fp2);
                                        fputc('\r',fp2);
                                        fputc('\n',fp2);
                                        ++f_title.line;
                                        t_now = t_now->right;
                                    }
                                    f_title.size = ftell(fp2) - f_title.position;    /* 내용 길이 */
                                    fclose(fp2);
                                    sprintf(f_title.id,"%s",pf.id);
                                    sprintf(f_title.name,"%s",pf.name);
                                    time(&f_title.date);
                                    f_title.down = 0;
                                    fseek(fp1,0,2);
                                    f_title.num = ftell(fp1) / sizeof(struct dis_file) + 1;
                                    top_num = f_title.num;
                                    fwrite((char*)&f_title,sizeof(struct dis_file),1,fp1);
                                    now_num = top_num;
                                    level += f_title.file_size/nmenu->level;
                                    key = 1;
                                }
                                unlink_text();
                            }
                        }
                    }
                    else {
                        printf("\r\n같은 이름이 %d번에 등록 되어있습니다.",j);
                        printf("\r\n엔터키를 치십시오.");
                        sfget_s(buf,1);
                    }
                }
                else {
                    printf("\r\n화일 이름이 없어서 취소되었습니다.\r\n엔터키를 치십시오.");
                    sfget_s(buf,1);
                }
                now_num = top_num;
                now_num = file_cont(fp1);
                key = 1;
            }
            else {
                mess_dis(4);
                key = 0;
            }
        }
        else if(buf[0] == '\0' || buf[0] == 'f') {   /* 다음 자료목록 출력 */
            if(now_num > 0) {
                key = 1;
                now_num = file_cont(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(buf[0] == 'b') {
            now_num = now_num + CRT *2;
            esc_sub = 0;
            if(now_num > top_num) now_num = top_num;
            if(now_num > 0) {
                key = 1;
                now_num = file_cont(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(!strncmp(buf,"ed",2)) {  /* 제목수정 */
            buf[0] = ' ';
            buf[1] = ' ';
            i = atoi(buf);
            if(i == 0) i = now_num;
            if(fseek(fp1,((i-1)*sizeof(struct dis_file)),0)) key = 0;
            else {
                fread((char*)&f_title,sizeof(struct dis_file),1,fp1);
                if(pf.level >= cfg.del || !strcmp(f_title.id,pf.id)) {
                    printf("\r\n\033$)1\033[?85h\r%s\r\n",f_title.title);
                    fget_s(f_title.title,38);
                    printf("\r\n\033(2\033[?85l\r%s\r\n확실합니까(y/N)? ",f_title.title);
                    fget_s(buf,1);
                    if(buf[0] == 'y' || buf[0] == 'Y') {
                        fseek(fp1,((i-1)*sizeof(struct dis_file)),0);
                        fwrite((char*)&f_title,sizeof(struct dis_file),1,fp1);
                    }
                }
            }
        }
        else if(!strncmp(buf,"ls",2)) { /* 자료 목록 출려 */
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            key = 1;
            esc_sub = 0;
            if(i >= top_num) {
                now_num = top_num;
            }
            else if(i != 0) {
                now_num = i;
            }
            now_num = file_cont(fp1);
        }
        else if(!strcmp(buf,"dir")) {   /* 자료 처음부터 출력 */
            key = 1;
            esc_sub = 0;
            now_num = top_num;
            now_num = file_cont(fp1);
        }
        else if(!strncmp(buf,"l",1)) {  /* 화면 크기 변경 */
            key = 0;
            crt_size(buf);
        }
        else if(!strcmp(buf,"t")) { /* 초기 메뉴 */
            mtop = nmenu = menu;
            esc_sub = 0;
            esc_flag = 1;
        }
        else if(!strcmp(buf,"x")) { /* 프로그램 종료 */
            host_end_yn();
        }
        else if(!strcmp(buf,"p")) { /* 자료목록 출력으로 */
            esc_flag = 1;
            nmenu = nmenu->upp;
        }
        else if(!strcmp(buf,"h")) { /* 자료실 도움말 */
            logo("filehelp");
            now_num = file_cont(fp1);
            key = 1;
        }
        else if(!strncmp(buf,"pr",2)) { /* 자료 내용 연속 출력 */
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            fl = 0;
            key = dis_fread(fp1,i,fl);
        }
        else if(!strcmp(buf,"a")) { /* 앞메뉴 */
            if(nmenu->aeqp != NULL ) {
                nmenu = nmenu->aeqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strcmp(buf,"n")) { /* 다음메뉴 */
            if(nmenu->neqp != NULL ) {
                nmenu = nmenu->neqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strncmp(buf,"dd",2)) { /* 자료 삭제 */
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            if(i == 0) i = now_num;
            if(i > 0 && i <= top_num) {
                fseek(fp1,(i-1)*sizeof(struct dis_file),0);
                fread((char*)&f_title,sizeof(struct dis_file),1,fp1);
                if((!strcmp(f_title.id,pf.id)) || (pf.level > cfg.del) ||
                  (cs & nmenu->del)) {
                    f_title.down = (abs(f_title.down) * (-1)) - 1;
                    fseek(fp1,(i-1)*sizeof(struct dis_file),0);
                    fwrite((char*)&f_title,sizeof(struct dis_file),1,fp1);
                    printf("\033[s\0337\033[1;65H\033[7m%4d번 삭제됨\033[0m \0338\033[u",i);
                    key = 0;
                    level -= f_title.file_size/nmenu->level;
                }
                else {
                    mess_dis(4);
                    key = 0;
                }
            }
            else {
                mess_dis(2);
                key = 0;
            }
        }
        else if(!strncmp(buf,"dn",2)) { /* 자료 다운 */
            if((nmenu->form == 'F' && nmenu->r < pf.level) ||
              (nmenu->form == 'f' && ((nmenu->r & pf.circle) || nmenu->r == 0))) {
                buf[0] = ' ';
                buf[1] = ' ';
                i = atoi(buf);
                if(i == 0) i = now_num;
                if(i > 0 && i < top_num+1) {
                    fseek(fp1,(i-1)*sizeof(struct dis_file),0);
                    fread((char*)&f_title,sizeof(struct dis_file),1,fp1);
                    if((f_title.down >= 0) || (pf.level > cfg.del)) {
                        printf("\r\n%s\r\nZ 모뎀만 됩니다.\r\n전송을 받으시겠습니까(Y/n)? ",f_title.filename);
                        fget_s(buf,1);
                        if(buf[0] == 'n' || buf[0] == 'N') {
                            printf("\r\n전송을 취소 하셨습니다.");
                        }
                        else {
                            sprintf(buf,"sz %s/%s",nmenu->ccode,f_title.filename);
                            sprintf(time_chk,"tmp/time.%s",tty);
                            tfp = fopen(time_chk,"w");
                            fputc('1',tfp);
                            fclose(tfp);
                            ch = '*';
                            if(work.chose == ' '){
                                ch = ' ';
                                change_in();
                            }
                            printf("\r\n전송 프로토콜을 실행시키십시오.\r\n");
                            ioctl(0, TCSETAF, &systerm);
                            system(buf);
                            ioctl(0, TCSETAF, &mbuf);
                            if(ch == ' ') {
                                change_in();
                            }
                            sprintf(time_chk,"tmp/time.%s",tty);
                            tfp = fopen(time_chk,"w");
                            fputc('0',tfp);
                            fclose(tfp);
                            sleep(1);
                            printf("\r\n전송이 완료되었습니다.");
                            ++f_title.down;
                            fseek(fp1,(i-1)*sizeof(struct dis_file),0);
                            fwrite((char*)&f_title,sizeof(struct dis_file),1,fp1);
                        }
                    }
                    else {
                        mess_dis(2);
                        key = 0;
                    }
                    now_num = i;
                }
                else {
                    mess_dis(2);
                    key = 0;
                }
            }
            else {
                mess_dis(4);
                key = 0;
            }
        }
        else if(!strncmp(buf,"go",2)) { /* 가기 선택 */
            if(go_select(buf)) {
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else {
            i = atoi(buf);
            if(i) {
                fl = 1;
                key =dis_fread(fp1,i,fl);
            }
            else {
                key = 0;
            }
        }
    }
    return(key);
}

int file_cont(fp1)   /* 자료 목록 출력 */
FILE *fp1;
{
    int i, j, l, m, o;
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J  %s : %s\r\n",nmenu->list,nmenu->ccode);
    printf("\033[1;65H[%4d/%4d]",now_num,top_num);
    printf("\n\n\033[7m\033[2K\r번호  아이디    화일명      크기  다운             제      목                  \033[0m");
    for(i = 0; i < CRT; i++) {
        if(fseek(fp1,(now_num-1)*sizeof(struct dis_file),0)) {
            break;
        }
        else {
            fread((char*)&f_title,sizeof(struct dis_file),1,fp1);
            if(li[0] != '\0') {
                j = strlen(li);
                if(((f_title.down >= 0) || (pf.level >= cfg.del)) && (!strncmp(li,f_title.id,j))) {
                    printf("\r\n%4d %-8s %-12s %7ld %3d %s",
                      f_title.num, f_title.id, f_title.filename,
                      f_title.file_size, f_title.down, f_title.title);
                }
                else --i;
            }
            else if(ln[0] != '\0') {
                j = strlen(ln);
                if(((f_title.down >= 0) || (pf.level >= cfg.del)) && (!strncmp(ln,f_title.filename,j))) {
                    printf("\r\n%4d %-8s %-12s %7ld %3d %s",
                      f_title.num, f_title.id, f_title.filename,
                      f_title.file_size, f_title.down, f_title.title);
                }
                else --i;
            }
            else if(lt[0] != '\0') {
                o = 1;
                if((f_title.down >= 0) || (pf.level >= cfg.del)) {
                    j = strlen(lt);
                    l = strlen(f_title.title) - j + 1;
                    for(m = 0; m < l; m++) {
                        if(!strncmp(lt,&f_title.title[m],j)) {
                            printf("\r\n%4d %-8s %-12s %7ld %3d %s",
                              f_title.num, f_title.id, f_title.filename,
                              f_title.file_size, f_title.down, f_title.title);
                            o = 0;
                            break;
                        }
                    }
                }
                if(o) --i;
            }
            else if((f_title.down >= 0) || (pf.level >= cfg.del)) {
                printf("\r\n%4d %-8s %-12s %7ld %3d %s",
                  f_title.num, f_title.id, f_title.filename,
                  f_title.file_size, f_title.down, f_title.title);
            }
            else {
                --i;
            }
            --now_num;
        }
    }
    return(now_num);
}

int searth_file(fp1,filename)   /* 업로드시 자료 중복 찾기 */
FILE *fp1;
char *filename;
{
    int i;
    struct dis_file f_tmp;
    fseek(fp1,0,0);
    while(1) {
        if(fread((char*)&f_tmp,sizeof(struct dis_file),1,fp1) == 0){
            i = 0;
            break;
        }
        else if(strcmp(f_tmp.filename, filename) == 0) {
            i = f_tmp.num;
            break;
        }
    }
    return(i);
}

dis_fread(fp1,select,fl)  /* 자료 내용 읽기 */
FILE *fp1;
int select;
int fl;
{
    int count, ie, key;
    struct pread {  /* 이전 페이지를 보기 위한 포이터 */
        long int fbp;
        long int fos;
        int ie;
        struct pread *next;
    }*fbp1, *fbp2;
    char c, *buf;
    FILE *fp2;
    buf = tmp_buf;
    if(select < 1 || select > top_num) {
        mess_dis(2);
        key = 0;
    }
    else {
        key = 1;
        if(fseek(fp1,(select-1)*sizeof(struct dis_file),0)) {
            printf("\r\nfseek 에러");
        }
        if(!fread((char*)&f_title,sizeof(struct dis_file),1,fp1)) {
            printf("\r\nfread 에러");
        }
        if((f_title.down >= 0) || (pf.level > cfg.del)) {
            ie = 0;
            if(fl) {
                count = CRT;
            }
            else {
                count = -1;
            }
            sprintf(buf,"menu/%s.txt",nmenu->ccode);
            fp2 = fopen(buf,"r");
            fseek(fp2,f_title.position,0);
            if((fbp1 = (struct pread *)malloc(sizeof(struct pread))) == NULL) {
                printf("\r\n메모리 부족");
            }
            fbp1->next = fbp1;
            fbp1->fbp = ftell(fp2);
            fbp1->fos = 0;
            fbp1->ie = 0;
            fbp2 = fbp1;
            f_disp(ie);
            for(fos = 0L; fos < f_title.size; fos++) {
                if((c = fgetc(fp2)) == '\n') {
                    putchar('\r');
                    --count;
                    ++ie;
                }
                if(count) {
                    putchar(c);
                }
                else {
                    count = CRT;
                    printf("\r\n\n\033(2\033[?85l\r계속[엔터] 이전[B] 연속[S] 중지[P] : ");
                    nfget_s(buf,1);
                    if(buf[0] == 'p' || buf[0] == 'P') {
                        break;
                    }
                    else if(buf[0] == 'b' || buf[0] == 'B') {
                        fbp1 = fbp1->next;
                        fseek(fp2,fbp1->fbp,0);
                        if(fbp2 != fbp1) {
                            free(fbp2);
                        }
                        fbp2 = fbp1;
                        fos = fbp1->fos;
                        ie = fbp1->ie;
                        f_disp(ie);
                    }
                    else if(buf[0] == 's' || buf[0] == 'S') {
                        printf("\r\n");
                        count = -1;
                    }
                    else {
                        if((fbp2 = (struct pread *)malloc(sizeof(struct pread))) == NULL) {
                            printf("\r\n메모리 부족");
                        }
                        fbp2->fbp = ftell(fp2);
                        fbp2->next = fbp1;
                        fbp2->fos = fos;
                        fbp1 = fbp2;
                        fbp1->ie = ie;
                        f_disp(ie);
                    }
                }
            }
            while(fbp1->next != fbp1) {
                fbp1 = fbp1->next;
                free(fbp2);
                fbp2 = fbp1;
            }
            free(fbp1);
            if((pf.level > cfg.del) && (f_title.down < 0)) {
                printf("\r\n복구를 하시겠습니까(y/N)? ");
                fget_s(buf,1);
                if(buf[0] == 'y' || buf[0] == 'Y') {
                    f_title.down = abs(f_title.down);
                    printf("\r\n복구 되었습니다.");
                }
            }
            fseek(fp1,(select-1)*sizeof(struct dis_file),0);
            fwrite((char*)&f_title,sizeof(struct dis_file),1,fp1);
            fclose(fp2);
            now_num = select;
        }
        else {
            mess_dis(2);
            now_num = select;
            key = 0;
        }
    }
    return(key);
}

f_disp(ie)
{
    struct tm *tp, *localtime();
    tp = localtime(&f_title.date);
    printf("\033[;H\033[2J번호 : %4d  등록자 : %-8s [%-8s]   화일 : %s\033[1;65H줄수 : %d/%d",
    f_title.num,f_title.name,f_title.id,f_title.filename,ie,f_title.line);
    printf("\r\n날짜 : 19%2d-%02d-%02d %02d:%02d:%02d",
    tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
    printf("\033[2;52H다운 : %d\033[2;65H크기 : %d\r\n제목 : %s\r\n\n",
    f_title.down,f_title.file_size,f_title.title);
}

dis_pf(s_pf)    /* 회원 정보 조회 */
struct idst s_pf;
{
    char buf[2];
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J\r\n %s 회원의 정보입니다.",s_pf.id);
    if(pf.level > cfg.sh) printf("\r\n\n   일 련  번 호 : %05d",s_pf.num);
    printf("\r\n   성        명 : %s",s_pf.name);
    if(s_pf.flag & 0x0001) printf("\r\n   성        별 : %c",s_pf.sex);
    else if(pf.level >= cfg.sh) printf("\r\n * 성        별 : %c",s_pf.sex);
    if(s_pf.flag & 0x0002) printf("\r\n   생 년  월 일 : %s",s_pf.birthday);
    else if(pf.level >= cfg.sh) printf("\r\n * 생 년  월 일 : %s",s_pf.birthday);
    tp = localtime(&s_pf.inday);
    if(s_pf.flag & 0x0004)
    printf("\r\n   가 입  일 자 : %2d년 %02d월 %02d일",tp->tm_year,(tp->tm_mon)+1,tp->tm_mday);
    else if(pf.level >= cfg.sh)
    printf("\r\n * 가 입  일 자 : %2d년 %02d월 %02d일",tp->tm_year,(tp->tm_mon)+1,tp->tm_mday);
    tp = localtime(&s_pf.logout);
    if(s_pf.flag & 0x0008)
    printf("\r\n   마지막접속일 : 19%2d-%02d-%02d  %02d:%02d:%02d",
      tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
    else if(pf.level >= cfg.sh)
    printf("\r\n * 마지막접속일 : 19%2d-%02d-%02d  %02d:%02d:%02d",
      tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
    if(s_pf.flag & 0x0010) printf("\r\n   우 편  번 호 : %s",s_pf.post);
    else if(pf.level >= cfg.sh) printf("\r\n * 우 편  번 호 : %s",s_pf.post);
    if(s_pf.flag & 0x0020) printf("\r\n   집   주   소 : %s",s_pf.home_addr);
    else if(pf.level >= cfg.sh) printf("\r\n * 집   주   소 : %s",s_pf.home_addr);
    if(s_pf.flag & 0x0040) printf("\r\n   집   전   화 : %s",s_pf.home_tel);
    else if(pf.level >= cfg.sh) printf("\r\n * 집   전   화 : %s",s_pf.home_tel);
    if(s_pf.flag & 0x0080) printf("\r\n   직   장   명 : %s",s_pf.office_name);
    else if(pf.level >= cfg.sh) printf("\r\n * 직   장   명 : %s",s_pf.office_name);
    if(s_pf.flag & 0x0100) printf("\r\n   직장전화번호 : %s",s_pf.office_tel);
    else if(pf.level >= cfg.sh) printf("\r\n * 직장전화번호 : %s",s_pf.office_tel);
    if(s_pf.flag & 0x0200) printf("\r\n   주민등록번호 : %s",s_pf.id_no);
    else if(pf.level >= cfg.sh) printf("\r\n * 주민등록번호 : %s",s_pf.id_no);
    if(s_pf.flag & 0x0400) printf("\r\n   등        급 : %d",s_pf.level);
    else if(pf.level >= cfg.sh) printf("\r\n * 등        급 : %d",s_pf.level);
    printf("\r\n   편 지  수 신 : ");
    if(s_pf.flag & 0x1000) printf("허용");
    else printf("금지");
    if(pf.level > cfg.sh) printf("\r\n * 회원  플래그 : %x",s_pf.expflag);
    if(pf.level > cfg.sh) {
        tp = localtime(&s_pf.lasttime);
        printf("\r\n * 사 용  기 간 : 19%2d-%02d-%02d  %02d:%02d:%02d",
          tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
    }
}

/*    대화루틴    */

chatting()
{
    int i, j, k, select, back, key;
    char *tmp, *buf, ch;
    FILE *fp1, *fp2, *fp3;
    struct tm *tp;
    struct tm *tim();
    buf = tmp_buf;
    tmp = temp;
    printf("\033[;H\033[2J");
    room = 0;
    add_usr(); /* 대기실 입실 표시(0번방) */
    wait_in();
    show_who(); /* 대화실 표시 */

    while(1) {
        printf("\r\n\033(2\033[?85l\rH 도움말 : ");
        nfget_s(buf,25);
        back = strlen(buf);
        if(!strncmp(buf,"pf",2) || !strncmp(buf,"PF",2)) {
            chk_pf(buf);
        }
        else {
            for(i = 0; i < back; i++) {
                buf[i] = tolower(buf[i]);
            }
            if(buf[0] == 'j') {   /* 대화 참여 */
                buf[0] = ' ';
                room = atoi(buf);
                if(room < 1 || room > 5) {
                    while(1) {
                        printf("\r\n방번호 1-5,Q : ");
                        nfget_s(buf,1);
                        room = atoi(buf);
                        if(buf[0] == 'q' || buf[0] == 'Q') {    /* 대화 취소 */
                            room = 0;
                            break;
                        }
                        else if(room > 0 && room < 6) break;    /* 방선택 검사 */
                    }
                }
                if(room) {
                    if((shmid=shmget((key_t)room, SIZE,IPC_CREAT | MODE)) == -1) {
                        printf("\r\n대화가 불가능합니다.");
                        return;
                    }
                    if((fp1 = fopen("tmp/roominfo","r+")) == NULL) {
                        fp1 = fopen("tmp/roominfo","a");
                    }
                    fseek(fp1,room*sizeof(struct roomname),SEEK_SET);
                    fread((char*)&roominfo,sizeof(struct roomname),1,fp1);
                    if(roominfo.flag == 0) {
                        printf("\r\n\033$)1\033[?85h\r대화실 이름 : ");
                        fget_s(roominfo.name,58);
                        if(room <= cfg.seroom || pf.level >= cfg.chat) {
                            printf("\n\r비밀번호(엔터는 공개) : ");
                            sfget_s(roominfo.passwd,8);
                        }
                        else {
                            roominfo.passwd[0] = '\0';
                        }
                        sprintf(mypass,"%s",roominfo.passwd);
                        fseek(fp1,room*sizeof(struct roomname),SEEK_SET);
                        fwrite((char*)&roominfo,sizeof(struct roomname),1,fp1);
                        fclose(fp1);
                        chatting_in(shmid); /* 대화 참여 */
                    }
                    else if(roominfo.flag >= cfg.room) {
                        printf("\r\n대화실이 만원입니다.");
                        room = 0;
                    }
                    else if(roominfo.passwd[0] != '\0') {
                        fclose(fp1);
                        if(pf.level < cfg.chat) {
                            printf("\n\r비밀번호 : ");
                            sfget_s(mypass,8);
                            if(!strcmp(mypass,roominfo.passwd)) {
                                chatting_in(shmid); /* 대화 참여 */
                            }
                            else {
                                printf("\r\n비밀번호가 틀립니다.");
                                room = 0;
                            }
                        }
                        else {
                            sprintf(mypass,"%s",roominfo.passwd);
                            chatting_in(shmid);
                        }
                    }
                    else {
                        mypass[0] = '\0';
                        chatting_in(shmid); /* 대화 참여 */
                        room = 0;
                    }
                }
            }
            else if(!strcmp(buf,"c")) {  /* 초대상태 바꿈 */
                printf("\r\n");
                change_in();
            }
            else if(!strcmp(buf,"us")) {  /* 접속자 명단 표시 */
                login_who();
            }
            else if(!strcmp(buf,"st")) {  /* 대화실 현황 표시 */
                show_who();
            }
            else if(!strcmp(buf,"h") || !strcmp(buf,"?")) { /* 대화실 도움말 */
                printf("\r\nUS : 접속자 명단 보기\r\nST : 대화실 상황\r\nP : 상위 메뉴");
                printf("\r\nJ {번호}: 대화 참여\r\nC : 초대상태 바꿈\r\nH,? : 도움말");
                printf("\r\nPF {아이디} : 회원정보\r\nGO {메뉴명} : 다른메뉴로 가기\r\n");
            }
            else if(!strcmp(buf,"p")) {  /* 상위 메뉴 */
                del_usr(); /* 대기실 퇴실 표시 */
                nmenu = nmenu->upp;
                break;
            }
            else if(!strcmp(buf,"t")) {  /* 초기 메뉴 */
                del_usr(); /* 대기실 퇴실 표시 */
                nmenu = menu;
                break;
            }                                                                                                                                                                                                                                                 
            else if(!strcmp(buf,"a")) { /* 앞메뉴 */
                if(nmenu->aeqp != NULL ) {
                    del_usr();
                    nmenu = nmenu->aeqp;
                    if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                        nmenu = nmenu->upp;
                    }
                    break;
                }
                else {
                    mess_dis(1);
                    key = 0;
                }
            }
            else if(!strcmp(buf,"n")) { /* 다음메뉴 */
                if(nmenu->neqp != NULL ) {
                    del_usr();
                    nmenu = nmenu->neqp;
                    if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                        nmenu = nmenu->upp;
                    }
                    break;
                }
                else {
                    mess_dis(1);
                    key = 0;
                }
            }
            else if(!strncmp(buf,"go",2)) { /* 가기 메뉴  */
                if(!go_select(buf)) {
                    mess_dis(1);
                }
                else {
                    del_usr();
                    break;
                }
            }
            else if(!strcmp(buf,"x")) {
                host_end_yn();
            }
        }
    }
}

chatting_in(shmid)  /* 대화실 입출력 표시 */
int shmid;
{
    int roomid;
    printf("\r\n\033$)1\033[?85h\r     \r");
    roomid = room;
    room = 0;
    del_usr();	   /* 대기실 퇴실 표시 */
    room = roomid;
    add_usr();	/* 대화방 입실 표시 */
    chat(shmid);    /* 대화 참여 */
    del_usr();	/* 대화방 퇴실 표시 */
    room = 0;
    wait_in();
    add_usr();	   /* 대기실 입실 표시 */
}

wait_in()   /* 대기실 상태 */
{
    int i;
    FILE *fp1;
    if((fp1 = fopen("tmp/roominfo","r+")) == NULL) {
        fp1 = fopen("tmp/roominfo","a");
        fclose(fp1);
        fp1 = fopen("tmp/roominfo","r+");
    }
    fseek(fp1,0,SEEK_END);
    i = ftell(fp1) / sizeof(struct roomname);
    if(i < 5) { /* i값은 방 마직막 번호 */
        roominfo.flag = 0;
        roominfo.passwd[0] = '\0';
        for(i = 0; i < 6; i++) {
            fwrite((char*)&roominfo,sizeof(struct roomname),1,fp1);
        }
    }
    fseek(fp1,0,SEEK_SET);
    fread((char*)&roominfo,sizeof(struct roomname),1,fp1);
    ++roominfo.flag;
    fseek(fp1,0,SEEK_SET);
    fwrite((char*)&roominfo,sizeof(struct roomname),1,fp1);
    fclose(fp1);
}

chat(shmid) /* 대화 시작 */
int shmid;
{
    int i, j, fout;
    char *buf, *tmp;
    FILE *fp1, *fp2;
    buf = tmp_buf;
    tmp = temp;
    if(pf.flag & 0x30000) {
        printf("\r\n도움말을 보실려면 '/h'를 치십시오.");
    }
    sprintf(buf,"\r\n%s님이 들어오셨습니다.",pf.id);
    shmaddr = shmat(shmid, NULL, MODE);
    strcpy(shmaddr, buf);
    shmdt(shmaddr);
    if((child_pid=fork()) != 0) {
        while(1) {
            fget_s(buf,240);
            printf("\r\n");
            if(buf[0] == '/') {
                j = strlen(buf);
                if((buf[1] == 'q' || buf[1] == 'Q') && buf[2] == '\0') {    /* 대화 종료 */
                    sprintf(buf,"\r\n%s님이 나가셨습니다.",pf.id);
                    shmaddr = shmat(shmid, NULL,MODE);
                    strcpy(shmaddr, buf);
                    shmdt(shmaddr);
                    kill(child_pid,SIGTERM);
                    return;
                }
                else if((buf[1] == 'u' || buf[1] == 'U') && (buf[2] == 's' || buf[2] == 'S')) {
                    login_who();    /* 접속자 명단 */
                }
                else if((buf[1] == 's' || buf[1] == 'S') && (buf[2] == 't' || buf[2] == 'T')) {
                    show_who();     /* 대화자 명단 */
                }
                else if((buf[1] == 'c' || buf[1] == 'C') && buf[2] == '\0') {
                    change_in();    /* 초대 상태 변경 */
                }
                else if((buf[1] == 'v' || buf[1] == 'V') && buf[2] == '\0') {
                    printf("\r\n%d번방을 이용하고 계십니다.\r\n",room);
                }
                else if((buf[1] == 'h' || buf[1] == 'H') && buf[2] == '\0') {
printf("\r\n/Q : 대화종료\r\n/V : 방번호\r\n/US : 접속자 명단\r\n/ST : 대화실 현황\r\n/H : 도움말");
printf("\r\n/C : 초대상태변경\r\n/PF {아이디} : 회원정보 \r\n/IN {아이디} : 회원초대\r\n");
                }
                else if(!strncmp(buf,"/in",3) || !strncmp(buf,"/IN",3)) {   /* 회원 초대 */
                    j = strlen(buf);    /* 문자 길이 */
                    for(i = 3; i < j; i++) {    /* 공백문자아닌 위치 찾기 */
                        if(buf[i] != ' ') {
                            tmp = (char*)&buf[i];
                            break;
                        }
                        else {
                            tmp = (char*)&buf[0];
                        }
                    }
                    j = strlen(tmp);
                    for(i = 0; i < j; i++) {
                        if(tmp[i] == ' ') {
                            tmp[i] = '\0';
                            break;
                        }
                    }
                    i = 1;
                    fp1 = fopen("tmp/campfire","r");
                    while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
                        if(!strcmp(work.id,tmp)) {
            /* 초대루틴 */
                            if(work.chose == '*') {
                                printf("\r\n초대거부상태\r\n");
                            }
                            else {
                                sprintf(buf,"/dev/%s",work.tty);
                                fout = open(buf,1);
                                if(mypass[0] != '\0') {
sprintf(buf,"\033[s\0337\033[1;65H\033[7m%d번방:%-8s\033[2;65H\033[7m암 호:%-8s\033[0m\0338\033[u",room,pf.id,mypass);
                                }
                                else {
sprintf(buf,"\033[s\0337\033[1;65H\033[7m%d번방:%-8s\033[2;65H\033[7m초대 합니다  \033[0m\0338\033[u",room,pf.id);
                                }
                                write(fout,buf,strlen(buf));
                                close(fout);
printf("\r\n%s회원을 초대하였습니다..\r\n",work.id);
                            }
                            i = 0;
                            break;
                        }
                    }
                    fclose(fp1);
                    if(i) {
                        printf("%s회원이 없습니다.\r\n",tmp);
                    }
                    tmp = &temp[0];
                }
                else if(!strncmp(buf,"/pf",3) || !strncmp(buf,"/PF",3)) {   /* 회원정보 조회 */
                    buf[2] = ' ';
                    chk_pf(buf);
                    printf("\r\n");
                }
                else {
                    printf("\r\n도움말은 /h\r\n");
                }
            }
            else {  /* 대화 내용 보내기 */
                sprintf(tmp,"%s : %s",pf.id,buf);
                shmaddr = shmat(shmid, NULL,MODE);
                strcpy(shmaddr, tmp);
                shmdt(shmaddr);
            }
        }
    }
    else {
        sprintf(buf,"%d",room);
        execl("bin/chatt","chatt",buf,NULL);
    }
}

add_usr() /* 대화실 회원 추가 */
{
    FILE *fp1;
    char *buf;
    struct chatin chatid;
    buf = tmp_buf;
    sprintf(chatid.id,"%s",pf.id);
    sprintf(chatid.name,"%s",pf.name);
    sprintf(buf,"tmp/room.%d",room);
    fp1 = fopen(buf,"a");
    fwrite((char*)&chatid,sizeof(struct chatin),1,fp1);
    fclose(fp1);
    if((fp1 = fopen("tmp/roominfo","r+")) == NULL) {
        fp1 = fopen("tmp/roominfo","a");
        roominfo.flag = 1;
        fwrite((char*)&roominfo,sizeof(struct roomname),1,fp1);
    }
    else {
        fseek(fp1,room*sizeof(struct roomname),SEEK_SET);
        fread((char*)&roominfo,sizeof(struct roomname),1,fp1);
        ++roominfo.flag;
        fseek(fp1,room*sizeof(struct roomname),SEEK_SET);
        fwrite((char*)&roominfo,sizeof(struct roomname),1,fp1);
    }
    fclose(fp1);
}

del_usr() /* 대화실 회원 제거 */
{
    FILE *fp1;
    char *buf;
    int i, j;
    struct chatin *chatid;
    buf = tmp_buf;
    sprintf(buf,"tmp/room.%d",room);
    if((fp1 = fopen(buf,"r")) != NULL) {
        fseek(fp1,0,SEEK_END);
        i = ftell(fp1) / sizeof(struct chatin) + 1;
        if((chatid = (struct chatin*) calloc(i,sizeof(struct chatin))) == NULL) {
            printf("\r\n메모리 부족");
            err_off();
        }
        fseek(fp1,0,SEEK_SET);
        i = 0;
        while(fread((char*)&chatid[i],sizeof(struct chatin),1,fp1)) {
            if(strcmp(chatid[i].id,pf.id)) {
                ++i;
            }
        }
        fclose(fp1);
        fp1 = fopen("tmp/roominfo","r+");
        fseek(fp1,room*sizeof(struct roomname),SEEK_SET);
        fread((char*)&roominfo,sizeof(struct roomname),1,fp1);
        roominfo.flag = i;
        fseek(fp1,room*sizeof(struct roomname),SEEK_SET);
        fwrite((char*)&roominfo,sizeof(struct roomname),1,fp1);
        fclose(fp1);
        fp1 = fopen(buf,"w");
        for(j = 0; j < i; j++) {
            fwrite((char*)&chatid[j],sizeof(struct chatin),1,fp1);
        }
        fclose(fp1);
        free(chatid);
    }
}

show_who()  /* 대화실 현황 */
{
    FILE *fp1, *fp2;
    int i, j;
    char *buf, *tmp;
    struct chatin chatid;
    buf = tmp_buf;
    tmp = temp;
    printf("\r\n------------------------------------------------------------------------------\r\n");
    if((fp2 = fopen("tmp/roominfo","r+")) == NULL) {
        printf("\r\n대화실 정보가 없습니다.\r\n");
    }
    else {
        fseek(fp2,0,SEEK_SET);
        for(i = 0; i < 6; i++) {
            fread((char*)&roominfo,sizeof(struct roomname),1,fp2);
            if(roominfo.flag) {
                sprintf(buf,"tmp/room.%d",i);
                if((fp1 = fopen(buf,"r")) != NULL) {
                    if(i == 0) {
                       printf("대기실 : ");
                    }
                    else {
                        if(roominfo.passwd[0] == '\0') {
                            printf("# %d번방[공  개] : %s\r\n",i,roominfo.name);
                        }
                        else {
                            printf("# %d번방[비공개] : %s\r\n",i,roominfo.name);
                        }
                    }
                    while(fread((char*)&chatid,sizeof(struct chatin),1,fp1)) {
                        printf("%s[%s] ",chatid.id,chatid.name);
                    }
                    fclose(fp1);
                    printf("\r\n------------------------------------------------------------------------------\r\n");

                }
            }
        }
        fclose(fp2);
        printf("\r\n");
    }
}

int host_end()  /* 프로그램 종료 루틴 */
{
    int i, j, len;
    char *buf,ch;
    time_t t;
    struct tm *tp, *tim(), *localtime();
    FILE *fp1, *fp2;
    buf = tmp_buf;
    sprintf(time_chk,"tmp/time.%s",tty);
    tfp = fopen(time_chk,"w");
    fputc('0',tfp);
    fclose(tfp);
    fclose(tfp);
    del_usr();  /* 대화실의 유령 제거 */
    if(room) {
        sprintf(buf,"\r\n%s님 선로가 끊어졌습니다.",pf.id);
        shmaddr = shmat(shmid, NULL,MODE);
        strcpy(shmaddr, buf);
        shmdt(shmaddr);
    }
    del_mylogin();
    time(&t);  /* 종료 시간 기록 */
    lest.intime = pf.logout;
    lest.outtime = t;
    sprintf(lest.id,"%s",pf.id);
    sprintf(lest.name,"%s",pf.name);
    sprintf(lest.tty,"%s",tty);
    lest.flag = pf.expflag;
    tp = tim();
    sprintf(buf,"ttime/%02d%02d%02d\0",tp->tm_year,tp->tm_mon+1,tp->tm_mday);
    fp1 = fopen(buf,"a");   /* 접속 기록 현황 표시 */
    fwrite((char*)&lest,sizeof(struct lestfile),1,fp1);
    fclose(fp1);
    if(end_flag) {
        sprintf(buf,"tmp/mail.%s",tty);  /* 자신에게 온 메세지 검사 */
        if((fp2 = fopen(buf,"r")) != NULL) {
            printf("\033[;H\033[2J");
            while((ch = fgetc(fp2)) != EOF) {
                putchar(ch);
            }
            fclose(fp2);
            unlink(buf);
            printf("\r\n\n엔터키를 치십시오.");
            nfget_s(buf,1);
        }
        tp = localtime(&pf.logout); /* 접속시간표시 */
        printf("\033&6@\r\n\n LOGIN  ... %2d/%02d/%02d   %02d:%02d:%02d",tp->tm_year,
          tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
        tp = localtime(&t); /* 종료시간표시 */
        printf("\r\n LOGOUT ... %2d/%02d/%02d   %02d:%02d:%02d",tp->tm_year,
          tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
        printf("\r\n\n %s님 안녕히 가십시오.\r\n",pf.name);
    }
    i = t - pf.logout;
    sprintf(buf,"tmp/time.%s",tty);
    unlink(buf);
    if(guest) { /* 손님일경우 자신의 기록을 저장 안한다 */
        sprintf(buf,"%s",pf.id);
        fp1 = fopen("bin/id_pf","r+");  /* 자신의 기록 저장 */
        if(fseek(fp1,pf_fos,0)) {
            printf("\r\n읽기 실폐");
            bye();
        }
        fread((char*)&pf,sizeof(struct idst),1,fp1);
        if(strcmp(pf.id,buf)) {
            printf("\r\nID가 틀립니다");
            bye();
        }
        pf.logout = t;
        pf.level += level;
        ++pf.logcount;  /* 접속횟수 증가 */
        pf.totaltime = pf.totaltime + i; /* 총 사용시간 계산 */
        if(fseek(fp1,pf_fos,0)) {
            printf("\r\n쓰기 실폐");
            bye();
        }
        fwrite((char*)&pf,sizeof(struct idst),1,fp1);
        fclose(fp1);
    }
    menu_free();
    ioctl(0, TCSETAF, &systerm);
    if(cfg.flag & 1) {
        signal(SIGHUP, SIG_DFL);
        sprintf(buf,"/dev/%s",tty);
        sleep(1);
        if((i=open(buf,1))==-1) {
            printf("\r\n%s화일 에러\r\n",buf);
            exit(1);
        }
        write(i,"+",1);
        write(i,"+",1);
        write(i,"+",1);
        for(j=0;j < 10000;j++);
        sleep(1);
        write(i,"a",1);
        write(i,"t",1);
        write(i,"h",1);
        write(i,"0",1);
        close(i);
    }
    exit(0);
}

void menu_free()
{
    nmenu = menu->downp;
    while(nmenu != menu) {
        if(nmenu->neqp != NULL) {
            nmenu = nmenu->neqp;
        }
        else {
            if(nmenu->downp != NULL) {
                nmenu = nmenu->downp;
            }
            else {
                mtmp = nmenu;
                nmenu = nmenu->upp;
                if(nmenu->downp == mtmp) {
                    free(mtmp);
                    nmenu->downp = NULL;
                }
                else {
                    nmenu = nmenu->downp;
                    while(nmenu->neqp != mtmp) {
                        nmenu = nmenu->neqp;
                    }
                    free(mtmp);
                    nmenu->neqp = NULL;
                }
            }
        }
    }
    free(menu);
}

void del_mylogin()
{
    int i, j, len;
    FILE *fp1;
    struct nowwork *chk_work;
    if((fp1 = fopen("tmp/campfire","r")) != NULL) {
        fseek(fp1,0L,SEEK_END);
        len = ftell(fp1) / sizeof(struct nowwork) + 1;
        fseek(fp1,0L,SEEK_SET);
        if((chk_work = (struct nowwork *)calloc(len,sizeof(struct nowwork))) == NULL) {
            perror("\r\n메모리가 부족");
            err_off();
        }
        i = 0;
        while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
            if(strcmp(work.id,pf.id)) {
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
        free(chk_work);
    }
}

int bye()
{
    exit(0);
}

login_who() /* 접속자 명단 */
{
    int i = 0;
    FILE *fp1;
    printf("\r\n  ===========>>> 접속자 명단 <<<===========");
    printf("\r\n  번호   아이디     성  명    있는곳   노드");
    printf("\r\n  =========================================");
    if((fp1 = fopen("tmp/campfire","r")) != NULL) {   /* 접속자 명단 */
        while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
            ++i;
            printf("\r\n   %2d   %8s  %8s  %8s %6s %c",
            i,work.id,work.name,work.ccode,work.tty,work.chose);
        }
        fclose(fp1);
        printf("\r\n");
    }
}

int chk_pf(buf) /* 회원 정보 검사 */
char *buf;
{
    int i, j, key = 1;
    char *tmp;
    FILE *fp1;
    j = strlen(buf);	/* 문자 길이 */
    buf[0] = ' '; buf[1] = ' ';
    for(i = 0; i < j; i++) {	/* 공백문자아닌 위치 찾기 */
        if(buf[i] != ' ') {
            tmp = (char*)&buf[i];
            break;
        }
        else {
            tmp = (char*)&buf[0];
        }
    }
    j = strlen(tmp);
    for(i = 0; i < j; i++) {
        if(tmp[i] == ' ') {
            tmp[i] = '\0';
            break;
        }
    }
    if(tmp[0] != '\0') { /* 자신 타인 구분 */
        i = 1;
        fp1 = fopen("bin/id_pf","r");
        while(fread((char*)&you_pf,sizeof(struct idst),1,fp1)) {
            if(!strcmp(tmp,you_pf.id)) {    /* 해당회원 찾기 */
                dis_pf(you_pf);
                i = 0;
                break;
            }
        }
        fclose(fp1);
        if(i) { /* 해당 회원이 없을경우 */
            key = 0;
            printf("\033[s\0337\033[2;65H\033[7m해당 회원 없음\033[0m\0338\033[u");
        }
    }
    else {  /* pf명령어만 있을경우 자신의 프로필 */
        dis_pf(pf);
    }
    return (key);
}

change_in() /* 초대 상태 변경 */
{
    FILE *fp1;
    char bnuf[50];
    sprintf(buf,"%s/tmp/campfire",getenv("HOME"));
    fp1 = fopen(buf,"r+");
    while(fread((char*)&work,sizeof(struct nowwork),1,fp1)) {
        if(!strcmp(work.id,pf.id)) {
            if(work.chose == ' ') {
                work.chose = 0x2a;
            }
            else {
                work.chose = 0x20;
            }
            break;
        }
    }
    if(!fseek(fp1,-sizeof(struct nowwork),1)) {
        fwrite((char*)&work,sizeof(struct nowwork),1,fp1);
    }
    fclose(fp1);
    if(work.chose == ' ') printf("초대 허용\n\r");
    else printf("초대 거부\n\r");
    sleep(1);
}

myinfo()    /* 나의 회원 정보 */
{
    int i, j, k, select, back, key=1;
    char *buf, ch;
    FILE *fp1;
    buf = tmp_buf;
    sprintf(buf,"%s",pf.id);
    fp1 = fopen("bin/id_pf","r");  /* 자신의 기록 저장 */
    if(fseek(fp1,pf_fos,0)) {
        printf("\r\n읽기 실폐");
        bye();
    }
    fread((char*)&pf,sizeof(struct idst),1,fp1);
    if(strcmp(pf.id,buf)) {
        printf("\r\nID가 틀립니다");
        bye();
    }
    fclose(fp1);
    my_pf();
    while(1) {
        if(!key) {
            for(i = 0; i < back; i++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        key = 1;
        nfget_s(buf,20);
        back = strlen(buf);
        if(buf[0] == '1' && buf[1] == '\0') {
            change_info();
        }
        else if(buf[0] == '2' && buf[1] == '\0') {
            change_flag();
        }
        else if(buf[0] == 'h' || buf[0] == 'H') {
            logo("abchelp");
        }
        else if(buf[0] == 'p' || buf[0] == 'P') {
            if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
                printf("\r\nid_pf 에러");
            }
            fseek(fp1,pf_fos,SEEK_SET);
            fwrite((char*)&pf,sizeof(struct idst),1,fp1);
            fclose(fp1);
            nmenu = nmenu->upp;
            break;
        }
        else if(buf[0] == 'a' || buf[0] == 'A') { /* 앞메뉴 */
            if(nmenu->aeqp != NULL ) {
                if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
                    printf("\r\nid_pf 에러");
                }
                fseek(fp1,pf_fos,SEEK_SET);
                fwrite((char*)&pf,sizeof(struct idst),1,fp1);
                fclose(fp1);
                nmenu = nmenu->aeqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                break;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(buf[0] == 'n' || buf[0] == 'N') { /* 다음메뉴 */
            if(nmenu->neqp != NULL ) {
                if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
                    printf("\r\nid_pf 에러");
                }
                fseek(fp1,pf_fos,SEEK_SET);
                fwrite((char*)&pf,sizeof(struct idst),1,fp1);
                fclose(fp1);
                nmenu = nmenu->neqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                break;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if((buf[0] == 'g' || buf[0] == 'G') && (buf[1] == 'o' || buf[1] == 'O')) {
            if(!go_select(buf)) {
                mess_dis(1);
                key = 0;
            }
            else {
                if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
                    printf("\r\nid_pf 에러");
                }
                fseek(fp1,pf_fos,SEEK_SET);
                fwrite((char*)&pf,sizeof(struct idst),1,fp1);
                fclose(fp1);
                break;
            }
        }
        else if(buf[0] == 'x' || buf[0] == 'X') {   /* 프로그램 종료 */
            printf("\r\n종료를 하시겠습니까(Y/n)? ");
            nfget_s(buf,1);
            if(!(buf[0] == 'n' || buf[0] == 'N')) {
                if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
                    printf("\r\n프로필 화일이 열리지 않습니다.");
                }
                fseek(fp1,pf_fos,SEEK_SET);
                fwrite((char*)&pf,sizeof(struct idst),1,fp1);
                fclose(fp1);
                end_flag = 1;
                host_end();
            }
            my_pf();
            key = 1;
        }
        else { key = 0;}
        sprintf(buf,"tmp/mail.%s",pf.id);
        if((fp1 = fopen(buf,"r")) != NULL) {
            printf("\033[;H\033[2J");
            while((ch = fgetc(fp1)) != EOF) {
                putchar(ch);
            }
            fclose(fp1);
            unlink(buf);
            printf("\r\n\n엔터키를 치십시오.");
            nfget_s(buf,1);
            key = 1;
            my_pf();
        }
    }
}

void my_pf() /* 나의 정보 표시 */
{
    int i, j;
    char buf[2];
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J   자기정보관리 : abc");
    printf("\r\n\n    1 아   이   디 : %s",pf.id);
    printf("\r\n *  2 비 밀  번 호 : ");
    j = strlen(pf.passwd);
    for(i = 0; i < j; i++) putchar('*');
    printf("\r\n    3 성        명 : %s",pf.name);
    if(pf.flag & 0x0001) printf("\r\n   "); else printf("\r\n * ");
    printf(" 4 성        별 : %c",pf.sex);
    if(pf.flag & 0x0002) printf("\r\n   "); else printf("\r\n * ");
    printf(" 5 생 년  월 일 : %s",pf.birthday);
    if(pf.flag & 0x0004) printf("\r\n   "); else printf("\r\n * ");
    tp = localtime(&pf.inday);
    printf(" 6 가 입  일 자 : %2d년 %02d월 %02d일",tp->tm_year,tp->tm_mon+1,tp->tm_mday);
    if(pf.flag & 0x0008) printf("\r\n   "); else printf("\r\n * ");
    tp = localtime(&pf.logout);
    printf(" 7 마지막접속일 : %2d년 %02d월 %02d일 %02d시 %02d분",tp->tm_year,
    tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min);
    if(pf.flag & 0x0010) printf("\r\n   "); else printf("\r\n * ");
    printf(" 8 우 편  번 호 : %s",pf.post);
    if(pf.flag & 0x0020) printf("\r\n   "); else printf("\r\n * ");
    printf(" 9 집   주   소 : %s",pf.home_addr);
    if(pf.flag & 0x0040) printf("\r\n   "); else printf("\r\n * ");
    printf("10 집   전   화 : %s",pf.home_tel);
    if(pf.flag & 0x0080) printf("\r\n   "); else printf("\r\n * ");
    printf("11 직   장   명 : %s",pf.office_name);
    if(pf.flag & 0x0100) printf("\r\n   "); else printf("\r\n * ");
    printf("12 직장전화번호 : %s",pf.office_tel);
    if(pf.flag & 0x0200) printf("\r\n   "); else printf("\r\n * ");
    printf("13 주민등록번호 : %s",pf.id_no);
    if(pf.flag & 0x0400) printf("\r\n   "); else printf("\r\n * ");
    printf("14 등        급 : %d\r\n   15 편 지  수 신 : ",pf.level);
    if(pf.flag & 0x1000) printf("허용\r\n");
    else printf("금지\r\n");
    printf(" * 16 동   아   리 : %x\r\n",pf.circle);
    printf(" * 17 접 속  횟 수 : %d회\r\n",pf.logcount);
    printf(" * 18 총 이용 시간 : %d초\r\n",pf.totaltime);
    tp = localtime(&pf.lasttime);
    printf(" * 19 이 용  기 간 : 19%2d년 %02d월 %02d일 %02d시 %02d분",tp->tm_year,
    tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min);
    printf("\r\n\n'*'표시가 있는것은 비공개입니다.");
    printf("\r\n정보변경[1] 공개/비공개 변경[2] 상위메뉴[P] 종료[X] 가기메뉴[GO]\r\n선택 >> ");
}


void change_info()   /* 나의 정보 변경 */
{
    int i, j, k, l, a[14];
    char *buf, *tmp, ch,passwd[9];
    FILE *fp1;
    buf = tmp_buf;
    tmp = temp;
    while(1) {
        printf("\r\n\033(2\033[?85l\r변경할 내용 번호/N ? ");
        nfget_s(buf,2);
        if(buf[0] == '2' && buf[1] == '\0') {
            printf("\r\n현재의 비밀번호 : ");
            stfget_s(buf,8);
            if(!strcmp(buf,pf.passwd)) {
                printf("\r\n새로운 비밀번호 입력 : ");
                stfget_s(buf,8);
                printf("\r\n새로운 비밀번호 확인 : ");
                stfget_s(passwd,8);
                if(!strcmp(buf,passwd)) {
                    sprintf(pf.passwd,"%s",passwd);
                }
                else {
                    printf("\r\n비밀번호 변경이 취소 되었습니다.");
                }
            }
            else {
                printf("\r\n비밀번호가 틀립니다.");
            }
        }
        else if(buf[0] == '5' && buf[1] == '\0') {
            i = 1;
            while(i) {
                printf("\r\n생년월일 : ");
                sfget_s(tmp,8);
                tmp[2] = '0';
                tmp[5] = '0';
                for(j = 0; j < 8; j++) {
                    if(!(isdigit(tmp[j]))) {
                        printf("\r\n정확히 입력하여 주십시오.");
                        i = 1;
                        break;
                    }
                    else i = 0;
                }
                if(!i) {
                    printf("\r\n\033(2\033[?85l\r양력입니까 Y/n ? ");
                    sfget_s(buf,1);
                    if(buf[0] == 'n' || buf[0] == 'N') {
                        pf.birthday[9] = '-';
                    }
                    else {
                        tmp[9] = '+';
                    }
                    tmp[2] = '.';
                    tmp[5] = '.';
                    tmp[8] = '(';
                    tmp[10] = ')';
                    tmp[11] = 0x00;
                    sprintf(pf.birthday,"%s",tmp);
                }
            }
        }
        else if(buf[0] == '8' && buf[1] == '\0') {
            printf("\r\n우편번호 : ");
            sfget_s(pf.post,7);
            pf.post[3] = '-';
        }
        else if(buf[0] == '9' && buf[1] == '\0') {
            i = 1;
            while(i) {
                printf("\r\n\033$)1\033[?85h\r집주소 : ");
                fget_s(pf.home_addr,79);
                if(pf.home_addr[0] == 0x00) {
                    printf("\r\n정확히 입력하여 주십시오.");
                    i = 1;
                }
                else i = 0;
            }
        }
        else if(buf[0] == '1' && buf[1] == '0') {
            i = 1;
            while(i) {
                printf("\r\n집전화 : ");
                sfget_s(pf.home_tel,14);
                j = strlen(pf.home_tel);
                for(k = 0; k < j; k++) {
                    if(!isdigit(pf.home_tel[k])) {
                        if(pf.home_tel[k] != '-') {
                            i = 1;
                            break;
                        }
                        else i = 0;
                    }
                }
            }
        }
        else if(buf[0] == '1' && buf[1] == '1' && buf[2] == '\0') {
            printf("\r\n\033$)1\033[?85h\r직장명 : ");
            fget_s(pf.office_name,79);
        }
        else if(buf[0] == '1' && buf[1] == '2' && buf[2] == '\0') {
            printf("\r\n직장전화 : ");
            sfget_s(pf.office_tel,14);
        }
        else if(buf[0] == '1' && buf[1] == '3' && buf[2] == '\0') {
            l = 1;
            while(l) {
                l = 0;
                printf("\r\n주민등록번호 : ");
                sfget_s(pf.id_no,14);
                pf.id_no[6] = '0';
                j = 1;
                for(i = 0; i < 14; i++) {
                    if(isdigit(pf.id_no[i])) a[i] = pf.id_no[i] - 48;
                    else {
                        printf("\r\n정확히 입력하여 주십시오.");
                        j = 0; l = 1;
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
                        l = 1;
                    }
                    else {
                        l = 0;
                        pf.id_no[6] = '-';
                        break;
                    }
                }
            }
        }
        else if(buf[0] == '1' && buf[1] == '5' && buf[2] == '\0') {
            if(pf.flag & 0x00001000) {
                pf.flag &= 0xffffefff;
                printf("\r\n금지");
            }
            else {
                pf.flag |= 0x00001000;
                printf("\r\n허용");
            }
        }
        else if(buf[0] == 'n' || buf[0] == 'N' || buf[0] == '\0') {
            my_pf();
            break;
        }
        else {
            printf("\r\n해당번호는 변경시킬 수 없습니다.");
        }
    }
}

void change_flag()   /* 공개 비공개 변경 */
{
    char ch[3];
    while(1) {
        printf("\r\n\033(2\033[?85l\r바꾸실 내용(번호/N)? ");
        sfget_s(ch,2);
        if(ch[0] == '4' && ch[1] == '\0') {
            printf("\r\n성별 ");
            if(pf.flag & 0x00000001) {
                pf.flag &= 0xfffffffe;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000001;
                printf("공개");
            }
        }
        else if(ch[0] == '5' && ch[1] == '\0') {
            printf("\r\n생년월일 ");
            if(pf.flag & 0x00000002) {
                pf.flag &= 0xfffffffd;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000002;
                printf("공개");
            }
        }
        else if(ch[0] == '6' && ch[1] == '\0') {
            printf("\r\n가입일자 ");
            if(pf.flag & 0x00000004) {
                pf.flag &= 0xfffffffb;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000004;
                printf("공개");
            }
        }
        else if(ch[0] == '7' && ch[1] == '\0') {
            printf("\r\n마지막접속일 ");
            if(pf.flag & 0x00000008) {
                pf.flag &= 0xfffffff7;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000008;
                printf("공개");
            }
        }
        else if(ch[0] == '8' && ch[1] == '\0') {
            printf("\r\n우편번호 ");
            if(pf.flag & 0x00000010) {
                pf.flag &= 0xffffffef;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000010;
                printf("공개");
            }
        }
        else if(ch[0] == '9' && ch[1] == '\0') {
            printf("\r\n집주소 ");
            if(pf.flag & 0x00000020) {
                pf.flag &= 0xffffffdf;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000020;
                printf("공개");
            }
        }
        else if(ch[0] == '1' && ch[1] == '0' && ch[2] == '\0') {
            printf("\r\n집전화 ");
            if(pf.flag & 0x00000040) {
                pf.flag &= 0xffffffbf;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000040;
                printf("공개");
            }
        }
        else if(ch[0] == '1' && ch[1] == '1' && ch[2] == '\0') {
            printf("\r\n직장명 ");
            if(pf.flag & 0x00000080) {
                pf.flag &= 0xffffff7f;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000080;
                printf("공개");
            }
        }
        else if(ch[0] == '1' && ch[1] == '2' && ch[2] == '\0') {
            printf("\r\n직장전화 ");
            if(pf.flag & 0x00000100) {
                pf.flag &= 0xfffffeff;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000100;
                printf("공개");
            }
        }
        else if(ch[0] == '1' && ch[1] == '3' && ch[2] == '\0') {
            printf("\r\n주민등록번호 ");
            if(pf.flag & 0x00000200) {
                pf.flag &= 0xfffffdff;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000200;
                printf("공개");
            }
        }
        else if(ch[0] == '1' && ch[1] == '4' && ch[2] == '\0') {
            printf("\r\n등급 ");
            if(pf.flag & 0x00000400) {
                pf.flag &= 0xfffffbff;
                printf("비공개");
            }
            else {
                pf.flag |= 0x00000400;
                printf("공개");
            }
        }
        else if(((ch[0] == 'n' || ch[0] == 'N') && ch[1] == '\0') || ch[0] == '\0') {
            my_pf();
            break;
        }
        else {
            printf("\r\n해당번호는 변경시킬 수 없습니다.");
        }
    }
}


void rmail()	/* 편지 읽기 */
{
    int i, j, k, select, back, key,fl;
    long int fos;
    char c, *buf, crt[3];
    FILE *fp1, *fp2;

    buf = tmp_buf;
    esc_flag = 0;
    sprintf(buf,"letter/%05d.mail",pf.num);
    if((fp1 = fopen(buf,"r+")) == NULL) {
        fp1 = fopen(buf,"a+");
    }
    li[0] = '\0';
    lt[0] = '\0';
    top_num = 0;
    if(!fseek(fp1,0,SEEK_END)) {
        now_num = top_num = ftell(fp1) / sizeof(struct mail);
        now_num = list_letter(fp1);
    }
    else {
        printf("\r\n화일 seek에 문제");
    }
    back = 0;
    key = 1;
    esc_flag = 0;
    while(1) {
        if(key) {
            printf("\r\n\n\033(2\033[?85l\r[번호/Enter] \241\262 B,LS,DIR,DD,T,P,A,N,GO,L,X,PR,LI,LT,도움말[H] \241\263\r\n>> ");
        }
        else {
            for(i = 0; i < back; i++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        nfget_s(buf,25);
        back = strlen(buf);
        if((select = atoi(buf))== 0) {
            key = select_mmenu(fp1,buf);
        }
        else {
            fl = 1;
            key = dis_read(fp1,select,fl);
            esc_sub = 1;
            while(esc_sub) {
                if(key) {
                    printf("\r\n\033(2\033[?85l\r[번호/Enter] \241\262 B,T,LS,DIR,DD,P,GO,L,A,N,X,PR,LI,LT,도움말[H] \241\263\r\n>> ");
                }
                else {
                    for(i = 0; i < back; i++) {
                        putchar('\b'); putchar(' '); putchar('\b');
                    }
                }
                nfget_s(buf,25);
                back = strlen(buf);
                if(buf[0] == '\0' || buf[0] == 'n' || buf[0] =='N') {
                    if(now_num > 1) {
                        --now_num;
                        fl = 1;
                        key = dis_read(fp1,now_num,fl);
                    }
                    else {
                        key = 0;
                        mess_dis(3);
                    }
                }
                else if((buf[0] == 'a' || buf[0] == 'A') && buf[1] == '\0') {
                    if(now_num < top_num) {
                        ++now_num;
                        fl = 1;
                        key = dis_read(fp1,now_num,fl);
                    }
                    else {
                        key = 0;
                        mess_dis(3);
                    }
                }
                else if((buf[0] == 'p' || buf[0] == 'P') && buf[1] == '\0') {
                    now_num = list_letter(fp1);
                    key = 1;
                    break;
                }
                else {
                    key = select_mmenu(fp1,buf);
                }
            }
        }
        if(esc_flag) {
            break;
        }
    }
    fclose(fp1);
}

select_mmenu(fp1,buf)	/* 명령어 처리 */
FILE *fp1;
char *buf;
{
    int i,j,key,back,fl=1;
    back = strlen(buf);
    if(!strncmp(buf,"li",2) || !strncmp(buf,"LI",2)) {  /* 게시물 아이디로 찾기 */
        lt[0] = '\0';
        for(i = 0; i <= back; i++) li[i] = '\0';
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) li[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = list_letter(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else if(!strncmp(buf,"lt",2) || !strncmp(buf,"LT",2)) { /* 게시물 제목문자열로 찾기 */
        li[0] = '\0';
        for(i = 0; i <= back; i++) lt[i] = '\0';
        for(i = 2; i < back; i++) {
            if(buf[i] != ' ') {
                for(j = i; j < back; j++) lt[j-i] = buf[j];
                break;
            }
        }
        now_num = top_num;
        if(now_num > 0) {
            key = 1;
            now_num = list_letter(fp1);
        }
        else {
            mess_dis(3);
            key = 0;
        }
        esc_sub = 0;
    }
    else {
        for(i = 0; i < back; i++) { /* 입력문자를 소문자로 */
            buf[i] = tolower(buf[i]);
        }
        if(buf[0] == '\0' || buf[0] == 'f') {    /* 다음 편지 읽기 */
            if(now_num > 0) {
                key = 1;
                now_num = list_letter(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(buf[0] == 'b') {
            now_num = now_num + CRT *2;
            esc_sub = 0;
            if(now_num > top_num) now_num = top_num;
            if(now_num > 0) {
                key = 1;
                now_num = list_letter(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(!strncmp(buf,"ls",2)) { /* 편지 목록 */
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            key = 1;
            esc_sub = 0;
            if(i >=top_num) {
                now_num = top_num;
            }
            else if(i != 0) {
                now_num = i;
            }
            now_num = list_letter(fp1);
        }
        else if(!strcmp(buf,"dir")) {
            key = 1;
            esc_sub = 0;
            now_num = top_num;
            now_num = list_letter(fp1);
        }
        else if(!strcmp(buf,"dd")) {
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            if(i == 0) i = now_num;
            if((i > 0) && (i <= top_num)) {
                fseek(fp1,(i-1) * sizeof(struct mail),SEEK_SET);
                fread((char*)&letter,sizeof(struct mail),1,fp1);
                letter.T = 'd';
                fseek(fp1,(i-1) * sizeof(struct mail),SEEK_SET);
                fwrite((char*)&letter,sizeof(struct mail),1,fp1);
        printf("\033[s\0337\033[1;65H\033[7m%4d번 삭제됨\033[0m \0338\033[u",i);
                key = 0;
            }
            else {
                mess_dis(2);
                key = 0;
            }
        }
        else if(!strcmp(buf,"p")) {
            esc_flag = 1;
            nmenu = nmenu->upp;
        }
        else if(!strcmp(buf,"h")) {
            logo("mailhelp");
            now_num = list_letter(fp1);
            key = 1;
        }
        else if(!strncmp(buf,"pr",2)) {
            buf[0] = ' '; buf[1] = ' ';
            i = atoi(buf);
            fl = 0;
            key = dis_read(fp1,i,fl);
        }
        else if(!strncmp(buf,"l",1)) {
            key = 0;
            crt_size(buf);
        }
        else if(!strcmp(buf,"t")) {
            nmenu = menu;
            esc_sub = 0;
            esc_flag = 1;
        }
        else if(!strcmp(buf,"a")) { /* 앞메뉴 */
            if(nmenu->aeqp != NULL ) {
                nmenu = nmenu->aeqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strcmp(buf,"n")) { /* 다음메뉴 */
            if(nmenu->neqp != NULL ) {
                nmenu = nmenu->neqp;
                if((nmenu->form == 'R' || nmenu->form == 'E') && (nmenu->w > pf.level)) {
                    nmenu = nmenu->upp;
                }
                esc_flag = 1;
                esc_sub = 0;
            }
            else {
                mess_dis(1);
                key = 0;
            }
        }
        else if(!strncmp(buf,"go",2)) {
            if(!go_select(buf)) {
                mess_dis(1);
                key = 0;
            }
            else {
                esc_flag = 1;
                esc_sub = 0;
            }
        }
        else if(buf[0] == 'x' || buf[0] == 'X') {    /* 프로그램 종료 */
            host_end_yn();
        }
        else {
            i = atoi(buf);
            if(i) {
                fl = 1;
                key = dis_read(fp1,i,fl);
            }
            else {
                key = 0;
            }
        }
    }
    return(key);
}


int list_letter(fp1)	/* 편지함 목록 출력 */
FILE *fp1;
{
    int i, j, o, l, m;
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J%s님 편지함",pf.name);
    if(pf.flag & 0x10000) {
        printf("\n\n\033[7m\033[2K\r번호  보낸이  아이디       날짜          제             목                    \033[0m");
    }
    else {
        printf("\n");
    }
    for(i = 0; i < CRT; i++) {
        if(fseek(fp1,(now_num-1)*sizeof(struct mail),SEEK_SET)) {
            break;
        }
        else {
            fread((char*)&letter,sizeof(struct mail),1,fp1);
            if(li[0] != '\0') {
                j = strlen(li);
                if((letter.T != 'd') && !strncmp(li,letter.id,j)) {
                    tp = localtime(&letter.tf);
                    printf("\r\n%c%4d %-8s %-8s  %02d월%02d일 %s",letter.T,letter.num,
                      letter.name,letter.id,tp->tm_mon+1,tp->tm_mday,letter.title);
                }
                else --i;
            }
            else if(lt[0] != '\0') {
                o = 1;
                if(letter.T != 'd') {
                    j = strlen(lt);
                    l = strlen(letter.title) - j + 1;
                    for(m = 0; m < l; m++) {
                        if(!strncmp(lt,&letter.title[m],j)) {
                            tp = localtime(&letter.tf);
                printf("\r\n%c%4d %-8s %-8s  %2d월%02d일 %s",letter.T,letter.num,
                  letter.name,letter.id,tp->tm_mon+1,tp->tm_mday,letter.title);
                            o = 0;
                            break;
                        }
                    }
                }
                if(o) --i;
            }
            else if(letter.T != 'd') {
                tp = localtime(&letter.tf);
                printf("\r\n%c%4d %-8s %-8s  %2d월%02d일 %-s",letter.T,letter.num,
                  letter.name,letter.id,tp->tm_mon+1,tp->tm_mday,letter.title);
            }
            else {
                --i;
            }
            --now_num;
        }
    }
    return(now_num);
}

int dis_read(fp1,select,fl) /* 편지 내용 읽기 */
FILE *fp1;
int select;
int fl;
{
    long int fos;
    int count, ie, key;
    struct pread{
        long int fbp;
        long int fos;
        struct pread *next;
    } *fbp1, *fbp2;
    char c, *buf;
    FILE *fp2;
    buf = tmp_buf;
    if(select < 1 || select > top_num) {
        mess_dis(2);
        key = 0;
    }
    else {
        key = 1;
        if(fseek(fp1,(select-1)*sizeof(struct mail),0)) {
            printf("\r\nfseek에 문제가 있습니다.");
        }
        if(!fread((char*)&letter,sizeof(struct mail),1,fp1)) {
            printf("\r\n화일 읽기fread에 문제가 있습니다.");
        }
        if(letter.T != 'd') {
            if(fl) {
                count = CRT + 2;
            }
            else {
                count = -1;
            }
            sprintf(buf,"letter/%05d.txt",pf.num);
            fp2 = fopen(buf,"r");
            fseek(fp2,letter.point,SEEK_SET);
            if((fbp1 = (struct pread *)malloc(sizeof(struct pread))) == NULL) {
                printf("\r\n메모리 부족");
            }
            fbp1->next = fbp1;
            fbp1->fbp = ftell(fp2);
            fbp1->fos = 0;
            fbp2 = fbp1;
            dis_top();
            for(fos = 0L; fos < letter.size; fos++) {
                if((c = fgetc(fp2)) == '\n') {
                    putchar('\r');
                    --count;
                }
                if(count) {
                    putchar(c);
                }
                else {
                    count = CRT + 2;
            printf("\r\n\033(2\033[?85l\r계속[엔터] 이전[B] 연속[S] 중지[P] : ");
                    nfget_s(buf,1);
                    if(buf[0] == 'p' || buf[0] == 'P') {
                        break;
                    }
                    else if(buf[0] == 'b' || buf[0] == 'B') {
                        fbp1 = fbp1->next;
                        fseek(fp2,fbp1->fbp,0);
                        if(fbp2 != fbp1) {
                            free(fbp2);
                        }
                        fbp2 = fbp1;
                        fos = fbp1->fos;
                        dis_top();
                    }
                    else if(buf[0] == 's' || buf[0] == 'S') {
                        printf("\r\n");
                        count = -1;
                    }
                    else {
                        if((fbp2 = (struct pread *)malloc(sizeof(struct pread))) == NULL) {
                            printf("\r\n메모리 부족");
                        }
                        fbp2->fbp = ftell(fp2);
                        fbp2->next = fbp1;
                        fbp2->fos = fos;
                        fbp1 = fbp2;
                        dis_top();
                    }
                }
            }
            fclose(fp2);
            if(letter.T == '*') {
                letter.T = 'T';
                sprintf(buf,"letter/%05d.chk",letter.id_num);
                if((fp2 = fopen(buf,"r+")) != NULL) {
                    while(fread((char*)&mail_chk,sizeof(struct mail_dis),1,fp2)) {
                        if(mail_chk.tf == letter.tf) {
                            time(&mail_chk.date);
                            fseek(fp2,-1*sizeof(struct mail_dis),SEEK_CUR);
                            fwrite((char*)&mail_chk,sizeof(struct mail_dis),1,fp2);
                            break;
                        }
                    }
                    fclose(fp2);
                }
                else {  /* 보낸편지확인 파일이 열리지 않았을때 */
                    printf("\r\n%s화일이 열리지 않습니다.",buf);
                }
                fseek(fp1,(select-1)*sizeof(struct mail),SEEK_SET);
                fwrite((char*)&letter,sizeof(struct mail),1,fp1);
            }
            while(fbp1->next != fbp1) {
                fbp1 = fbp1->next;
                free(fbp2);
                fbp2 = fbp1;
            }
            free(fbp1);
            now_num = select;
        }
        else {
            printf("\033[s\0337\033[1;65H\033[7m삭제된 편지\033[0m   \0338\033[u");
            now_num = select;
            key = 0;
        }
    }
    return(key);
}

void wmail()	/* 편지 쓰기 */
{
    int i, j;
    char *buf, id[9];
    FILE *fp1, *fp2, *fp3;
    struct idst tmp_pf;
    struct tm *tp, *localtime();
    buf = tmp_buf;
    nmenu = nmenu->upp;
    printf("\033[;H\033[2J받을사람 ID : ");
    sfget_s(mail_chk.id,9);
    if(strlen(mail_chk.id) > 2) {
        if((fp1 = fopen("bin/id_pf","r")) == NULL) {
            printf("\r\nid_pf 에러");
        }
        else {
            j = 1;
            while(fread((char*)&tmp_pf,sizeof(struct idst),1,fp1)) {
                if(!strcmp(mail_chk.id,tmp_pf.id)) {
                    fclose(fp1);
                    j = 0;
                    sprintf(mail_chk.name,tmp_pf.name);
                    if(!(tmp_pf.flag & 0x1000)) {
                        printf("\r\n%s님은 수신거부 상태입니다.",tmp_pf.name);
                        sleep(1);
                        break;
                    }
                    printf("\r\n\033(2\033[?85l\r%s님에게 편지를 보내시겠습니까(Y/n)? ",tmp_pf.name);
                    sfget_s(buf,1);
                    if(buf[0] == 'n' || buf[0] == 'N') {
                        printf("\r\n편지 보내기를 취소하셨습니다.");
                        sleep(1);
                        break;
                    }
                    else {
                        printf("\r\n\033$)1\033[?85h\r제목 : ");
                        nfget_s(mail_chk.title,39);
                        sprintf(letter.title,"%s",mail_chk.title);
                        if(ma_write() == 1) {
                            time(&mail_chk.tf);
                            letter.tf = mail_chk.tf;
                            sprintf(letter.name,"%s",pf.name);
                            letter.T = '*';
                            sprintf(buf,"letter/%05d.txt",tmp_pf.num);
                            fp2 = fopen(buf,"a");
                            letter.point = ftell(fp2);
                            t_now = t_start;
                            while(t_now->right != '\0') {
                                fputs(t_now->text,fp2);
                                fputc('\r',fp2);
                                fputc('\n',fp2);
                                t_now = t_now->right;
                            }
                            letter.size = ftell(fp2) - letter.point;    /* 내용 길이 */
                            fclose(fp2);
                            sprintf(letter.id,"%s",pf.id);
                            letter.id_num = pf.num;
                            sprintf(buf,"letter/%05d.mail",tmp_pf.num);
                            fp1 = fopen(buf,"a");
                            letter.num = ftell(fp1) / sizeof(struct mail) + 1;
                            if(!fwrite((char*)&letter,sizeof(struct mail),1,fp1)) {
                                printf("\r\n화일 쓰기 실패");
                                err_off();
                            }
                            fclose(fp1);
                            i = 0;
                            mail_chk.date = '\0';
                            sprintf(buf,"letter/%05d.chk",pf.num);
                            fp1 = fopen(buf,"a");
                            if(!fwrite((char*)&mail_chk,sizeof(struct mail_dis),1,fp1)) {
                                printf("\r\n화일 쓰기 실패");
                                err_off();
                            }
                            fclose(fp1);
                            printf("\r\n %s님에게 편지를 보냈습니다.\r\n엔터키를 치십시오.",tmp_pf.name);
                            sfget_s(buf,1);
                        }
                        unlink_text();
                    }
                    break;
                }
                else {
                    j = 1;
                }
            }
            if(j) {
                fclose(fp1);
                printf("\r\n%s회원이 존재하지 않습니다\r\n엔터키를 치십시오.",mail_chk.id);
                sfget_s(buf,1);
            }
        }
    }
}

void cmail()  /* 보낸 편지 확인 */
{
    int i, top_num, back, key;
    char *buf;
    FILE *fp1;
    buf = tmp_buf;
    sprintf(buf,"letter/%05d.chk",pf.num);
    if((fp1 = fopen(buf,"r")) == NULL) {
        fp1 = fopen(buf,"a");
    }
    top_num = 0;
    if(fseek(fp1,0,2)) {
        printf("\n화일 포인터 변경 실패");
        err_off();
    }
    else {
        now_num = top_num = ftell(fp1) / sizeof(struct mail_dis);
        now_num = list_chk(fp1);
    }
    back = 0;
    key = 1;
    while(1) {
        if(key) {
            printf("\r\n엔터 목록[DIR] 상위[P] 초기[T] : ");
        }
        else {
            for(i = 0; i < back; i++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        nfget_s(buf,25);
        back = strlen(buf);
        for(i = 0; i < back; i++) buf[i] = tolower(buf[i]);
        if(!strcmp(buf,"dir")) {
            key = 1;
            now_num = top_num;
            now_num = list_chk(fp1);
        }
        else if(buf[0] == '\0') {
            if(now_num > 0) {
                key = 1;
                now_num = list_chk(fp1);
            }
            else {
                mess_dis(3);
                key = 0;
            }
        }
        else if(!strcmp(buf,"p")) {
            nmenu = nmenu->upp;
            break;
        }
        else if(!strcmp(buf,"t")) {
            mtop = nmenu = menu;
            esc_sub = 0;
            esc_flag = 1;
            break;
        }
        else {
            key = 0;
        }
    }
    fclose(fp1);
}

list_chk(fp1)	/* 보낸편지 확인 목록 */
FILE *fp1;
{
    int i;
    struct tm *tp, *localtime();
    printf("\033[;H\033[2J 이  름    아이디   보낸날짜  읽은날짜           제      목\r\n");
    for(i = 0; i < CRT; i++) {
        if(fseek(fp1,(now_num-1)*sizeof(struct mail_dis),0)) {
            break;
        }
        else {
            fread((char*)&mail_chk,sizeof(struct mail_dis),1,fp1);
            tp = localtime(&mail_chk.tf);
            printf("\r\n%-8s  %-8s  %2d월%2d일  ",mail_chk.name,mail_chk.id,
            tp->tm_mon+1,tp->tm_mday);
            if(mail_chk.date == '\0') {
                printf("[안읽음]%s",mail_chk.title);
            }
            else {
                tp = localtime(&mail_chk.date);
                printf("%2d월%2d일 %s",tp->tm_mon+1,tp->tm_mday,mail_chk.title);
            }
        }
        --now_num;
    }
    return(now_num);
}


dis_top()
{
    printf("\033[;H\033[2J");
    printf("%d번 %-9s %s\r\n\n",letter.num,letter.id,letter.title);
}


void mailsort()   /* 편지함 정리 */
{
    int i, j;
    char *buf, tmp[40];
    FILE *fp1, *fp2, *fp3, *fp4;

    buf = tmp_buf;
    printf("\r\n편지함을 정리하시겠습니까(y/N)? ");
    fget_s(buf,1);
    if(buf[0] == 'y' || buf[0] == 'Y') {
        sprintf(buf,"letter/%05d.mail",pf.num);
        if((fp1 = fopen(buf,"r")) == NULL);
        else {
            sprintf(buf,"tmp/%05d.mail",pf.num);
            fp2 = fopen(buf,"w");
            sprintf(buf,"letter/%05d.txt",pf.num);
            fp3 = fopen(buf,"r");
            sprintf(buf,"tmp/%05d.txt",pf.num);
            fp4 = fopen(buf,"w");
            i = 0;
            while(fread((char*)&letter,sizeof(struct mail),1,fp1)) {
                if(letter.T != 'd') {
                    letter.num = ++i;
                    fseek(fp3,letter.point,SEEK_SET);
                    letter.point = ftell(fp4);
                    fwrite((char*)&letter,sizeof(struct mail),1,fp2);
                    for(j = 0; j < letter.size; j++) {
                        fputc(fgetc(fp3),fp4);
                    }
                }
            }
            fclose(fp4);
            fclose(fp3);
            fclose(fp2);
            fclose(fp1);
            sprintf(buf,"tmp/%05d.mail",pf.num);
            sprintf(tmp,"letter/%05d.mail",pf.num);
            rename(buf,tmp);
            sprintf(buf,"tmp/%05d.txt",pf.num);
            sprintf(tmp,"letter/%05d.txt",pf.num);
            rename(buf,tmp);
        }
        sprintf(buf,"letter/%05d.chk",pf.num);
        if((fp1 = fopen(buf,"r")) == NULL);
        else {
            sprintf(tmp,"tmp/%05d.chk",pf.num);
            fp2 = fopen(tmp,"w");
            while(fread((char*)&mail_chk,sizeof(struct mail_dis),1,fp1)) {
                if(mail_chk.date == '\0') {
                    fwrite((char*)&mail_chk,sizeof(struct mail_dis),1,fp2);
                }
            }
            fclose(fp2);
            fclose(fp1);
            rename(tmp,buf);
        }
    }
}

void chk_csysop()
{
    int i;
    char *buf;
    FILE *fp1;
    buf = tmp_buf;
    if((fp1 = fopen("bin/circle","r")) == NULL);
    else {
        for(i = 0; i < 31; i++) {
            fscanf(fp1,"%s",buf);
            if(!strcmp(buf,pf.id)) {
                cs = 1;
                cs <<= i;
                printf("\r\n%d 동아리",i+1);
                break;
            }
        }
        fclose(fp1);
    }
}

csysop()
{
    int i, j, k, l;
    char *buf;
    FILE *fp1;
    buf= tmp_buf;

    if(cs == 0) {
        return;
    }
    else {
        i = cs;
        l = ~cs;
    }
    while(1) {
        printf("\033[;H\033[2J 동호회 운영자 메뉴");
        printf("\r\n\n1. 동호회 가입\r\n2. 동호회 탈퇴\r\n3. 회원 열람");
        printf("\r\nP. 상위 메뉴\r\n선택 : ");
        nfget_s(buf,1);
        j = atoi(buf);
        if(buf[0] == '1' || buf[0] == '2') {
            printf("\r\n아이디 : ");
            nfget_s(buf,8);
            if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
                printf("\r\n아이디 화일이 열리지 않습니다.");
                return;
            }
            k = 1;
            while(fread((char*)&you_pf,sizeof(struct idst),1,fp1)) {
                if(!strcmp(you_pf.id,buf)) {
                    fos = ftell(fp1) - sizeof(struct idst);
                    if(j == 1) {
                        you_pf.circle |= i;
                        printf("\r\n%x",you_pf.circle);
                    }
                    else if(j == 2) {
                        you_pf.circle &= l;
                        printf("\r\n%x",you_pf.circle);
                    }
                    if(fseek(fp1,fos,SEEK_SET)) {
                        printf("\r\n화일 포인터 변경 실폐");
                    }
                    if(fwrite((char*)&you_pf,sizeof(struct idst),1,fp1)) {
                        printf("\r\n변경 되었습니다.");
                    }
                    k =0;
                    break;
                }
            }
            fclose(fp1);
            if(k) {
                printf("\r\n%s회원이 없습니다.",buf);
                buf[0] = getchar();
            }
        }
        else if(buf[0] == '3') {
            k = CRT;
            fp1 = fopen("bin/id_pf","r");
            while(fread((char*)&you_pf,sizeof(struct idst),1,fp1)) {
                if(you_pf.circle & i) {
                    printf("\r\n%8s [%-8s]",you_pf.name,you_pf.id);
                    --k;
                }
                if(!k) {
                    printf("\r\n계속[엔터] 연속[S] 중지[P] : ");
                    nfget_s(buf,1);
                    if(buf[0] == 's' || buf[0]== 'S') {
                        printf("\r\n");
                        k = -1;
                    }
                    else if(buf[0] == 'p' || buf[0] == 'P') {
                        break;
                    }
                    else {
                        k = CRT;
                    }
                }
            }
            fclose(fp1);
            buf[0] = getchar();
        }
        else if(buf[0] == 'p' || buf[0] == 'P'){
            break;
        }
    }
}

void mess_dis(i)
int i;
{
    if(i == 1) {
    printf("\033[s\0337\033[1;65H\033[7m해당 메뉴 없음\033[0m\0338\033[u");
    }
    else if(i == 2) {
    printf("\033[s\0337\033[1;65H\033[7m선택 오류\033[0m     \0338\033[u");
    }
    else if(i == 3) {
    printf("\033[s\0337\033[1;65H\033[7m마지막 번호임.\033[0m\0338\033[u");
    }
    else if(i == 4) {
    printf("\033[s\0337\033[1;65H\033[7m권한 없음\033[0m     \0338\033[u");
    }

}


void host_end_yn()
{
    char buf[2];
    printf("\033&6@\r\n종료를 하시겠습니까(Y/n)? ");
    nfget_s(buf,1);
    if(!(buf[0] == 'n' || buf[0] == 'N')) {
        end_flag = 1;
        host_end();
    }
}

