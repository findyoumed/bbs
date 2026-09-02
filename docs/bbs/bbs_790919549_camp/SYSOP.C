/*    SYSOP.C   */

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

void id_select(),pf_change(),get_menu(),dis_pf(),id_sort();
void ttime(),file_sort(),dis_exp(),name_search(),list_sort();
void host_end(),chk_handcap(),send_mess(),menu_free();
void edit_line(),append_line(),sub_creat(),save_menu(),make_menu();

char tmp_buf[80], temp[80];
int CRT;
long int fos;
struct config *menu,*mtop,*nmenu,*mtmp;
struct idst pf;
struct fcfg cfg;
struct dis_list l_title;
struct dis_file f_title;
struct mail letter;
struct mail_dis mail_chk;
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
    int i, j, key;
    char *buf, tmp[10], ch;
    FILE *fp1;
    struct termio tbuf;
    buf = tmp_buf;
    CRT = 17;
    if(argc == 1) {
        printf("\r\n쉘에서 사용");
    }
    ioctl(0,TCGETA, &systerm);
    rawmode();
    umask(0111);
    if((fp1 = fopen("bin/campfire.cfg","r")) == NULL) {  /* 기준값 읽기 */
        printf("\r\nbin/campfire.cfg화일이 열리지 않습니다.");
        host_end();
    }
    fscanf(fp1,"%s%d%d%d%d%d%s",tmp,&i,&i,&i,&i,&i,tmp);
    fclose(fp1);
    printf("\033(2\033[?85l\033[;H\033[2J\r\n\n 비밀번호 : ");
    i = 0;
    while((ch = getchar()) != '\r') {
        if(ch == '\b') {
            if(i > 0) {
                putchar(ch); putchar(' '); putchar(ch);
                if(i > 0) i--;
            }
        }
        else if((ch == ' ') | (ch == 0x1b));
        else if(i < 8) {
            buf[i++] = ch;
            putchar('*');
        }
    }
    buf[i] = 0x00;
    if(strcmp(tmp,buf)) {
        printf("\r\n당신은 운영자가 아닙니다.");
        for(i = 0; i < 10; i++) {
            printf("\007");
        }
        host_end();
    }
    get_menu();
    key = 1;
    while(1) {
        if(key) {
            printf("\033(2\033[?85l\033[;H\033[2J\r\n**** 운영자 메뉴 ****");
            printf("\r\n\n1. 아이디 발급\r\n2. 아이디 정리(접속자 없을때 사용)\r\n3. 기록화일");
            printf("\r\n4. 회원정보 변경\r\n5. 명단 조회\r\n6. 게시물 정리(이용자 없을때 사용)");
            printf("\r\n7. 강제메세지 전송\r\n8. 편지함 정리(접속자 없을때 사용)\r\n9. 메뉴작성");
            printf("\r\nP. 상위메뉴\r\n\n선택 >> ");
        }
        else {
            i = strlen(buf);
            for(j = 0; j < i; j++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
            key = 1;
        }
        nfget_s(buf,1);
        buf[0] = tolower(buf[0]);
        if(buf[0] == '1') {
            id_select();
        }
        else if(buf[0] == '2') {
            id_sort();
        }
        else if(buf[0] == '3') {
            ttime();
        }
        else if(buf[0] == '4') {
            pf_change();
        }
        else if(buf[0] == '5') {
            pf_search();
        }
        else if(buf[0] == '6') {
            list_sort();
        }
        else if(buf[0] == '7') {
            send_mess();
        }
        else if(buf[0] == '8') {
            letter_sort();
        }
        else if(buf[0] == '9') {
            make_menu();
        }
        else if(buf[0] == 'p') {
            break;
        }
        else key = 0;
    }
    host_end();
}

void make_menu()
{
    int i, j = 0, key = 1;
    char ch, *buf;
    buf = tmp_buf;
    while(1) {
        if(key) {
            printf("\033[;H\033[2J \241\266  %s   \241\267   [%s]\r\n",mtop->list,mtop->ccode);
            nmenu = mtop->downp;
            j = 0;
            while(nmenu->neqp != NULL) {
                printf("\r\n  %2d %c %s [%-8s]",++j,nmenu->form,nmenu->list,nmenu->ccode);
                if(nmenu->form != 'M') {
                    printf(" %5d %5d : %x : %d",nmenu->w,nmenu->r,nmenu->del,nmenu->level);
                }
                if(nmenu->form == 'f' || nmenu->form == 'F') printf(" %s",nmenu->file);
                nmenu = nmenu->neqp;
            }
            printf("\r\n  %2d %c %s [%-8s]",++j,nmenu->form,nmenu->list,nmenu->ccode);
            if(nmenu->form != 'M') {
                printf(" %5d %5d : %x : %d",nmenu->w,nmenu->r,nmenu->del,nmenu->level            );
            }
            if(nmenu->form == 'f' || nmenu->form == 'F') printf(" %s",nmenu->file);
            printf("\r\n\n\033(2\033[?85l\r번호 상위[P] 수정[E] 추가[A] 삽입[I] 삭제[D] 저장[S] 종료[X] >> ");
        }
        else {
            i = strlen(buf);
            for(j = 0; j < i; j++) {
                putchar('\b'); putchar(' '); putchar('\b');
            }
        }
        key = 1;
        nfget_s(buf,10);
        i = atoi(buf);
        if(i) {
            nmenu = mtop->downp;
            for(j = 1; j < i; j++) {
                if(nmenu->neqp != NULL) nmenu = nmenu->neqp;
                else break;
            }
            if(nmenu->form == 'M') {
                mtop = nmenu;
            }
            else key = 0;
        }
        else if(buf[0] == 'p' || buf[0] == 'P') {
            mtop = mtop->upp;
        }
        else if(buf[0] == 'e' || buf[0] == 'E') {
            buf[0] = ' ';
            i = atoi(buf);
            if(i) {
                nmenu = mtop->downp;
                for(j = 1; j < i; j++) {
                    if(nmenu->neqp != NULL) {
                        nmenu = nmenu->neqp;
                    }
                    else {
                        break;
                    }
                }
            }
            else {
                nmenu = mtop;
            }
            printf("\r\n\n%<%s> [%s]",nmenu->list,nmenu->ccode);
            edit_line();
        }
        else if(buf[0] == 'a' || buf[0] == 'A') {
            nmenu = mtop->downp;
            while(nmenu->neqp != NULL) nmenu = nmenu->neqp;
            append_line();
        }
        else if(buf[0] == 'i' || buf[0] == 'I') {
            buf[0] = ' ';
            i = atoi(buf);
            if(i == 1) {
                if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
                    printf("\r\n메모리가 모자랍니다.");
                    exit(1);
                }
                mtmp->neqp = mtop->downp;
                mtmp->downp = NULL;
                mtop->downp = mtmp;
                mtmp->upp = mtop;
                nmenu = mtmp;
                edit_line();
            }
            else if(i) {
                nmenu = mtop->downp;
                for(j = 2; j < i; j++) {
                    if(nmenu->neqp != NULL) {
                        nmenu = nmenu->neqp;
                    }
                    else {
                        break;
                    }
                }
                if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
                    printf("\r\n메모리가 모자랍니다.");
                    exit(1);
                }
                mtmp->downp = NULL;
                mtmp->neqp = nmenu->neqp;
                mtmp->upp = nmenu->upp;
                nmenu->neqp = mtmp;
                nmenu = mtmp;
                edit_line();
            }
        }
        else if(buf[0] == 'd' || buf[0] == 'D') {  /* 메뉴 삭제 */
            buf[0] = ' ';
            i = atoi(buf);
            if(i == 1) {
                nmenu = mtop->downp;
                mtop->downp = nmenu->neqp;
                free(nmenu);
                if(mtop->downp == NULL) mtop = mtop->upp;
            }
            else if(i > 1) {
                nmenu = mtop->downp;
                for(j = 1; j < i; j++) {
                    if(nmenu->neqp != NULL) {
                        mtmp = nmenu;
                        nmenu = nmenu->neqp;
                    }
                    else {
                        break;
                    }
                }
                mtmp->neqp = nmenu->neqp;
                free(nmenu);
            }
        }
        else if(buf[0] == 's' || buf[0] == 'S') {
            save_menu();
        }
        else if(buf[0] == 'x' || buf[0] == 'X') break;
        else key = 0;
    }
}


/* 메뉴 읽기 */
void get_menu()
{
    int i, j;
    char ch[2];
    FILE *fp1;
    if((fp1 = fopen("bin/menu","r")) == NULL) {
        printf("\r\n메뉴화일이 열리지 않습니다.\r\n메뉴를 작성하시겠습니까(Y/n)?");
        nfget_s(ch,1);
        if(ch[0] == 'n' || ch[0] == 'N') {
            exit(1);
        }
        if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
            printf("\r\n메모리가 모자랍니다.");
            exit(1);
        }
        menu = mtop = nmenu = mtmp;
        mtmp->downp = mtmp->neqp = NULL;
        mtmp->upp = mtmp;
        nmenu->form = 'M';
        sprintf(nmenu->ccode,"top");
        printf("\r\n\033$)1\033[?85h초기메뉴명 : ");
        nfget_s(nmenu->list,30);
        sub_creat();
        make_menu();
    }
    else {
        if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
            printf("\r\n메모리가 모자랍니다.");
            exit(1);
        }
        menu = mtop = nmenu = mtmp;
        fread((char*)mtmp,sizeof(struct config),1,fp1);
        if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
            printf("\r\n메모리가 모자랍니다.");
            exit(1);
        }
        nmenu->neqp = NULL;
        nmenu->upp = nmenu;
        nmenu->downp = mtmp;
        while(fread((char*)mtmp,sizeof(struct config),1,fp1)) {
            if(nmenu->deep < mtmp->deep) {
                nmenu->downp = mtmp;
                mtmp->upp = nmenu;
                nmenu->neqp = NULL;
            }
            else if(nmenu->deep == mtmp->deep) {
                nmenu->downp = NULL;
                nmenu->neqp = mtmp;
                mtmp->upp = nmenu->upp;
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
                mtmp->neqp = NULL;
                mtmp->downp = NULL;
            }
            nmenu = mtmp;
            if((mtmp = (struct config *)malloc(sizeof(struct config))) == NULL) {
                printf("\r\n메모리가 모자랍니다.");
                exit(1);
            }

        }
        fclose(fp1);
        free(mtmp);
    }
}

void edit_line()
{
    char buf[35];
    printf("\r\n\033(2\033[?85l\r형태 : ");
    fget_s(buf,1);
    nmenu->form = buf[0];
    printf("\r\n\033(2\033[?85l\r가기코드 : ");
    sfget_s(buf,8);
    sprintf(nmenu->ccode,"%s",buf);
    printf("\r\n\033$)1\033[?85h\r메뉴명 : ");
    nfget_s(buf,30);
    sprintf(nmenu->list,"%s",buf);
    if((nmenu->form == 'M') && (nmenu->downp == NULL)) {
        sub_creat();
    }
    else {
        printf("\r\n쓰기레벨 : ");
        sfget_s(buf,8);
        nmenu->w = atoi(buf);
        printf("\r\n읽기레벨 : ");
        sfget_s(buf,8);
        nmenu->r = atoi(buf);
        if(nmenu->form == 'L' || nmenu->form == 'l' ||
          nmenu->form == 'V' || nmenu->form == 'v') {
            printf("\r\n레벨/게시물 : ");
            sfget_s(buf,2);
            nmenu->level = atoi(buf);
        }
        else if(nmenu->form == 'F' || nmenu->form == 'f') {
            printf("\r\n레벨/화일 : ");
            sfget_s(buf,8);
            nmenu->level = atoi(buf);
            if(nmenu->level == 0) {
                nmenu->level = 1000000;
            }
            printf("\r\n\033(2\033[?85l삭제권한 플래그 : ");
            sfget_s(buf,3);
            nmenu->del = atoi(buf);
        }
    }
}

void append_line()
{
    if((mtmp = (struct config *) malloc(sizeof(struct config))) == NULL) {
        printf("\r\n메모리가 모자랍니다.");
        exit(1);
    }
    nmenu->neqp = mtmp;
    mtmp->upp = nmenu->upp;
    nmenu = mtmp;
    nmenu->downp = nmenu->neqp = NULL;
    edit_line();
}

void sub_creat()
{
    if((mtmp = (struct config *) malloc(sizeof(struct config))) == NULL) {
        printf("\r\n메모리가 모자랍니다.");
        exit(1);
    }
    nmenu->downp = mtmp;
    mtmp->upp = nmenu;
    nmenu = mtmp;
    nmenu->downp = nmenu->neqp = NULL;
    edit_line();
}


void save_menu()
{
    int i = 0;
    FILE *fp1;
    while(nmenu != nmenu->upp) nmenu = nmenu->upp;
    mtop = nmenu;
    if((fp1 = fopen("bin/menu","w")) != NULL) {
        mtop->deep = 0;
        fwrite((char*)nmenu,sizeof(struct config),1,fp1);
        printf("\r\n%8s %s",nmenu->ccode,nmenu->list);
        nmenu = nmenu->downp;
        ++i;
        while(nmenu != mtop) {
            nmenu->deep = i;
            fwrite((char*)nmenu,sizeof(struct config),1,fp1);
            printf("\r\n%8s %s",nmenu->ccode,nmenu->list);
            if(nmenu->downp == NULL) {
                if(nmenu->neqp == NULL) {
                    while(1) {
                        nmenu = nmenu->upp;
                        --i;
                        if(nmenu->neqp != NULL || i == 0) break;
                    }
                    if(i) nmenu = nmenu->neqp;
                }
                else {
                    nmenu = nmenu->neqp;
                }
            }
            else {
                nmenu = nmenu->downp;
                ++i;
            }
        }
        fclose(fp1);
    }
    else printf("\r\n화일이 열리지 않습니다.");
}


void id_select()
{
    int i, j, count;
    char *buf;
    FILE *fp1, *fp2;
    struct tm *tp, *localtime();
    buf = tmp_buf;
    printf("\033[;H\033[2J");
    if((fp1 = fopen("bin/id_pf.tmp","r")) == NULL) {
        printf("\r\n가입자가 없습니다.");
    }
    else {
        if((fp2 = fopen("bin/id_pf","r+")) == NULL) {
            printf("\r\n처음 가입자");
            fp2 = fopen("bin/id_pf","a");
            count = 0;
        }
        else {
            if(fseek(fp2,-sizeof(struct idst),SEEK_END)) {
                printf("\r\n아이디 화일 포인터 변경 실폐");
                count = 0;
            }
            else {
                fread((char*)&pf,sizeof(struct idst),1,fp2);
                count = pf.num + 1;
            }
        }
        i = 1;
        while(fread((char*)&pf,sizeof(struct idst),1,fp1)) {
            time(&pf.inday);
            pf.num = count;
            pf.circle = 0;
            pf.logcount = 0;
            pf.totaltime = 0;
            pf.level = 10;
            time(&pf.lasttime);
            pf.lasttime = pf.lasttime + 3600 * 720;
            dis_pf();
            printf("\r\n\n\033(2\033[?85l\r가입을 받아주시겠습니까(y/N)? ");
            fget_s(buf,1);
            if(buf[0] == 'y' || buf[0] == 'Y') {
                fseek(fp2,0,SEEK_END);
                fwrite((char*)&pf,sizeof(struct idst),1,fp2);
                ++count;
            }
            else if(buf[0] == 'p') {
                i = 0;
                break;
            }
            else {
                printf("\r\n가입 취소");
            }
        }
        fclose(fp2);
        fclose(fp1);
        if(i) unlink("bin/id_pf.tmp");
    }
}


void pf_change()
{
    int i, j, k, l, m;
    char *buf;
    FILE *fp1;
    buf = tmp_buf;
    printf("\r\n찾는 아이디 : ");
    nfget_s(buf,8);
    if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
        printf("\r\nID 화일을 열수가 없습니다.");
        host_end();
    }
    i = 1;
    while(fread((char*)&pf,sizeof(struct idst),1,fp1)) {
        if(!strcmp(buf,pf.id)) {
            fos = ftell(fp1) - sizeof(struct idst);
            dis_pf();
            while(1) {
                printf("\r\n\033(2\033[?85l\r바꿀 내용이 있습니까? (번호/n) ");
                nfget_s(buf,2);
                if(buf[0] == '1' && buf[1] == '\0') {
                    printf("\r\n## 아   이   디 : ");
                    nfget_s(pf.id,8);
                }
                else if(buf[0] == '2' && buf[1] == '\0') {
                    printf("\r\n## 비 밀  번 호 : ");
                    nfget_s(pf.passwd,8);
                }
                else if(buf[0] == '3' && buf[1] == '\0') {
                    printf("\r\n\033$)1\033[?85h\r## 이        름 : ");
                    nfget_s(pf.name,8);
                }
                else if(buf[0] == '4' && buf[1] == '\0') {
                    printf("\r\n## 성        별 : ");
                    pf.sex = getchar();
                }
                else if(buf[0] == '5' && buf[1] == '\0') {
                    printf("\r\n## 생 년  월 일 : ");
                    nfget_s(pf.birthday,11);
                }
                else if(buf[0] == '7' && buf[1] == '\0') {
                    printf("\r\n## 마지막접속일 : ");
                    time(&pf.logout);
                }
                else if(buf[0] == '8' && buf[1] == '\0') {
                    printf("\r\n## 우 편  번 호 : ");
                    nfget_s(pf.post,8);
                }
                else if(buf[0] == '9' && buf[1] == '\0') {
                    printf("\r\n\033$)1\033[?85h\r## 집   주   소 : ");
                    fget_s(pf.home_addr,79);
                }
                else if(buf[0] == '1' && buf[1] == '0' && buf[2] == '\0') {
                    printf("\r\n## 집   전   화 : ");
                    nfget_s(pf.home_tel,14);
                }
                else if(buf[0] == '1' && buf[1] == '1' && buf[2] == '\0') {
                    printf("\r\n\033$)1\033[?85h\r## 직   장   명 : ");
                    fget_s(pf.office_name,79);
                }
                else if(buf[0] == '1' && buf[1] == '2' && buf[2] == '\0') {
                    printf("\r\n## 직장전화번호 : ");
                    nfget_s(pf.office_tel,14);
                }
                else if(buf[0] == '1' && buf[1] == '3' && buf[2] == '\0') {
                    printf("\r\n## 주민등록번호 : ");
                    nfget_s(pf.id_no,14);
                }
                else if(buf[0] == '1' && buf[1] == '4' && buf[2] == '\0') {
                    printf("\r\n## 등        급 : ");
                    nfget_s(buf,10);
                    pf.level = atoi(buf);
                }
                else if(buf[0] == '1' && buf[1] == '5' && buf[2] == '\0') {
                    printf("\r\n## 동   아   리 : ");
                    nfget_s(buf,10);
                    pf.circle = atoi(buf);
                }
                else if(buf[0] == '2' && buf[1] == '0' && buf[2] == '\0') {
                    printf("\r\n## 연 장  기 간 : ");
                    nfget_s(buf,3);
                    j = atoi(buf);
                    if(j) pf.lasttime = time(&pf.lasttime) + 3600 * 24 * j;
                }
                else if(buf[0] == 'n' || buf[0] == 'N') {
                    break;
                }
            }
            if(fseek(fp1,fos,SEEK_SET)) {
                printf("\r\n화일 포인터 변경 실폐");
                host_end();
            }
            if(fwrite((char*)&pf,sizeof(struct idst),1,fp1)) {
                printf("\r\nID수정되었습니다.");
            }
            else {
                printf("\r\nID수정 실폐 ");
            }
            dis_pf();
            i = 0;
            break;
        }
        else {
            i = 1;
        }
    }
    fclose(fp1);
    if(i) {
        printf("\r\n%해당회원이 없습니다.");
    }
    printf("\r\n[Enter]를 치십시요.");
    nfget_s(buf,1);
}


void dis_pf()    /* 회원 정보 조회 */
{
    char buf[2];
    struct tm *tp, *localtime();
    printf("\r\n*  0. 일 련  번 호 : %05d",pf.num);
    printf("\r\n   1. 아   이   디 : %s",pf.id);
    printf("\r\n*  2. 비 밀  번 호 : %s",pf.passwd);
    printf("\r\n   3. 성        명 : %s",pf.name);
    if(pf.flag & 0x0001) printf("\r\n   4.");
    else printf("\r\n*  4.");
    printf(" 성        별 : %c",pf.sex);
    if(pf.flag & 0x0002) printf("\r\n   5.");
    else printf("\r\n*  5.");
    printf(" 생 년  월 일 : %s",pf.birthday);
    tp = localtime(&pf.inday);
    if(pf.flag & 0x0004) printf("\r\n   6.");
    else printf("\r\n*  6.");
    printf(" 가 입  일 자 : %2d년 %02d월 %02d일",tp->tm_year,(tp->tm_mon)+1,tp->tm_mday);
    tp = localtime(&pf.logout);
    if(pf.flag & 0x0008) printf("\r\n   7.");
    else printf("\r\n*  7.");
    printf(" 마지막접속일 : 19%2d-%02d-%02d  %02d:%02d:%02d",
      tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
    if(pf.flag & 0x0010) printf("\r\n   8.");
    else printf("\r\n*  8.");
    printf(" 우 편  번 호 : %s",pf.post);
    if(pf.flag & 0x0020) printf("\r\n   9.");
    else printf("\r\n*  9.");
    printf(" 집   주   소 : %s",pf.home_addr);
    if(pf.flag & 0x0040) printf("\r\n  10.");
    else printf("\r\n* 10.");
    printf(" 집   전   화 : %s",pf.home_tel);
    if(pf.flag & 0x0080) printf("\r\n  11.");
    else printf("\r\n* 11.");
    printf(" 직   장   명 : %s",pf.office_name);
    if(pf.flag & 0x0100) printf("\r\n  12.");
    else printf("\r\n* 12.");
    printf(" 직장전화번호 : %s",pf.office_tel);
    if(pf.flag & 0x0200) printf("\r\n  13.");
    else printf("\r\n* 13.");
    printf(" 주민등록번호 : %s",pf.id_no);
    if(pf.flag & 0x0400) printf("\r\n  14.");
    else printf("\r\n* 14.");
    printf(" 등        급 : %d",pf.level);
    printf("\r\n  15. 동   아   리 : %x",pf.circle);
    printf("\r\n  16. 편 지  수 신 : ");
    if(pf.flag & 0x1000) printf("허용");
    else printf("금지");
    printf("\r\n* 17. 회원  플래그 : %x",pf.expflag);
    printf("\r\n* 18. 접 속  횟 수 : %d",pf.logcount);
    printf("\r\n* 19. 총 이용 시간 : %d",pf.totaltime);
    tp = localtime(&pf.lasttime);
    printf("\r\n* 20. 사 용  기 간 : 19%2d-%02d-%02d  %02d:%02d:%02d",
      tp->tm_year,tp->tm_mon+1,tp->tm_mday,tp->tm_hour,tp->tm_min,tp->tm_sec);
}

void list_sort()
{
    int i, j = 0;
    char ch, *buf, temp[50];
    buf = temp;
    while(1) {
        printf("\033[;H\033[2J \241\266  %s   \241\267   [%s]\r\n",mtop->list,mtop->ccode);
        nmenu = mtop->downp;
        j = 0;
        while(nmenu->neqp != NULL) {
            printf("\r\n  %2d %s",++j,nmenu->list);
            nmenu = nmenu->neqp;
        }
        printf("\r\n  %2d %s",++j,nmenu->list);
        printf("\n\n\r정리[번호] 상위[P] 종료[X] >> ");
        fget_s(buf,10);
        i = atoi(buf);
        if(i) {
            nmenu = mtop->downp;
            for(j = 1; j < i; j++) {
                if(nmenu->neqp != NULL) nmenu = nmenu->neqp;
                else break;
            }
            if(nmenu->form == 'M') {
                mtop = nmenu;
            }
            else if(nmenu->form == 'L' || nmenu->form == 'l' ||
              nmenu->form == 'V' || nmenu->form == 'v') {
                printf("\r\n%s",nmenu->list);
                menu_sort(nmenu->ccode);
            }
            else if(nmenu->form == 'F' || nmenu->form == 'f') {
                printf("\r\n%s",nmenu->list);
                file_sort(nmenu->ccode);
            }
        }
        else if(buf[0] == 'p' || buf[0] == 'P') {
            mtop = mtop->upp;
        }
        else if(buf[0] == 'x' || buf[0] == 'X') break;
    }
}

menu_sort(buf)
char *buf;
{
    int i, j;
    long int fos;
    char *tmp,test[40];
    FILE *fp1, *fp2, *fp3, *fp4;
    tmp = temp;
    sprintf(tmp,"menu/%s",buf);
    if((fp1 = fopen(tmp,"r")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    sprintf(tmp,"menu/%s.txt",buf);
    if((fp2 = fopen(tmp,"r")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    sprintf(tmp,"tmp/%s",buf);
    if((fp3 = fopen(tmp,"w")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    sprintf(tmp,"tmp/%s.txt",buf);
    if((fp4 = fopen(tmp,"w")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    j = 0;
    while(fread((char*)&l_title,sizeof(struct dis_list),1,fp1)) {
        if(l_title.look >= 0) {
            ++j;
            l_title.num = j;
            if(fseek(fp2,l_title.position,SEEK_SET)) {
                printf("\r\n화일 포인터 변경 실폐");
                return;
            }
            l_title.position = ftell(fp4);
            for(i = 0; i < l_title.size; i++) {
                fputc(fgetc(fp2),fp4);
            }
            if(!fwrite((char*)&l_title,sizeof(struct dis_list),1,fp3)) {
                printf("\r\n화일 쓰기 실폐");
                return;
            }
        }
    }
    fclose(fp4);
    fclose(fp3);
    fclose(fp2);
    fclose(fp1);
    sprintf(tmp,"tmp/%s",buf);
    sprintf(test,"menu/%s",buf);
    rename(tmp,test);
    sprintf(tmp,"tmp/%s.txt",buf);
    sprintf(test,"menu/%s.txt",buf);
    rename(tmp,test);
}

void file_sort(buf)
char *buf;
{
    int i, j;
    long int fos;
    char *tmp,test[40];
    FILE *fp1, *fp2, *fp3, *fp4;
    tmp = temp;
    sprintf(tmp,"menu/%s",buf);
    if((fp1 = fopen(tmp,"r")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    sprintf(tmp,"menu/%s.txt",buf);
    if((fp2 = fopen(tmp,"r")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    sprintf(tmp,"tmp/%s",buf);
    if((fp3 = fopen(tmp,"w")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    sprintf(tmp,"tmp/%s.txt",buf);
    if((fp4 = fopen(tmp,"w")) == NULL) {
        printf("\r\n%s open error",tmp);
        return;
    }
    j = 0;
    while(fread((char*)&f_title,sizeof(struct dis_file),1,fp1)) {
        if(f_title.down >= 0) {
            ++j;
            f_title.num = j;
            if(fseek(fp2,f_title.position,SEEK_SET)) {
                printf("\r\n화일 포인터 변경 실폐");
                return;
            }
            f_title.position = ftell(fp4);
            for(i = 0; i < f_title.size; i++) {
                fputc(fgetc(fp2),fp4);
            }
            if(!fwrite((char*)&f_title,sizeof(struct dis_file),1,fp3)) {
                printf("\r\n화일 쓰기 실폐");
                return;
            }
        }
        else {
            if(nmenu->file[0] == 0) sprintf(tmp,"%s/%s",buf,f_title.filename);
            else sprintf(tmp,"%s/%s",nmenu->file,f_title.filename);
            unlink(tmp);
        }
    }
    fclose(fp4);
    fclose(fp3);
    fclose(fp2);
    fclose(fp1);
    sprintf(tmp,"tmp/%s",buf);
    sprintf(test,"menu/%s",buf);
    rename(tmp,test);
    sprintf(tmp,"tmp/%s.txt",buf);
    sprintf(test,"menu/%s.txt",buf);
    rename(tmp,test);
}

void ttime()
{
    int i, j, T, num;
    char *buf, *tmp;
    FILE *fp1;
    struct lestfile lest;
    struct tm *tp, *localtime();
    buf = tmp_buf;
    tmp = temp;
    printf("\033[;H\033[2J날짜를 입력하세요(yymmdd)? ");
    nfget_s(buf,6);
    if(strlen(buf) != 0) {
        sprintf(tmp,"ttime/%s",buf);
        if((fp1 = fopen(tmp,"r")) != NULL) {
            fseek(fp1,0,SEEK_END);
            num = ftell(fp1)/sizeof(struct lestfile) - 1;
            j = CRT + 2;
            T = 1;
            while(T) {
                printf("\033[;H\033[2J  이  름  아이디    접속 시간 / 종료 시간  접속노드");
                printf("\r\n----------------------------------------------------");
                for(i = 0; i < j; i++) {
                    if(!fseek(fp1,num * sizeof(struct lestfile),SEEK_SET)) {
                        fread((char*)&lest,sizeof(struct lestfile),1,fp1);
                        --num;
                        tp = localtime(&lest.intime);
                        printf("\r\n%8s [%-8s] %02d시 %02d분",lest.name,lest.id,tp->tm_hour,tp->tm_min);
                        tp = localtime(&lest.outtime);
                        printf("   %02d시 %02d분    %s",tp->tm_hour,tp->tm_min,lest.tty);
                    }
                    else {
                        T = 0;
                        break;
                    }
                }
                if(T) {
                    printf("\n\n\r 계속[Enter] 연속[S] 중지[P]\r\n 선택 >> ");
                }
                else {
                    printf("\r\n\n[Enter]를 치십시요.");
                }
                nfget_s(buf,1);
                if(buf[0] == 's' || buf[0] == 'S') {
                    j = 30000;
                }
                else if(buf[0] == 'p' || buf[0] == 'P') {
                    break;
                }
            }
            fclose(fp1);
        }
        else {
            printf("\r\n해당화일이 열리지 않습니다.");
            nfget_s(buf,1);
        }
    }
}

void send_mess()
{
    int fout;
    char *buf, *tmp;
    struct nowwork mess;
    FILE *fp1;
    buf = tmp_buf;
    tmp = temp;
    printf("\r\n전송 메세지를 쓰십시요.\r\n");
    while(1) {
        fget_s(tmp,80);
        if(tmp[0] != '\0') {
            sprintf(buf,"\r\n%s\r\n",tmp);
            if((fp1 = fopen("tmp/campfire","r")) != NULL) {
                while(fread((char*)&mess,sizeof(struct nowwork),1,fp1)) {
                    sprintf(tmp,"/dev/%s",mess.tty);
                    fout = open(tmp,1);
                    write(fout,buf,strlen(buf));
                    close(fout);
                }
            }
            fclose(fp1);
        }
        else {
            break;
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
/* 문자열 입력(첫 공백없음, 문자열 포인터, 읽을 문자 겟수) */
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
/* 문자열 입력(공백문자 없음, 문자열 포인터, 읽을 문자 겟수) */
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
/* 문자열 입력(*출력, 문자열 포인터, 읽을 문자 겟수) */
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
        else if((ch == ' ') | (ch == 0x1b));
        else if(i < len) {
            str[i++] = ch;
            putchar('*');
        }
    }
    str[i] = 0x00;
}

struct tm *tim()
{
    time_t t;
    struct tm *tp, *localtime();
    time(&t);
    tp = localtime(&t);
    return (tp);
}

void host_end()
{
    menu_free();
    ioctl(0, TCSETAF, &systerm);
    exit(1);
}

pf_search()
{
    int i, j, flag, up, down;
    char *buf,*tmp;
    FILE *fp1, *fp2, *fp3;
    buf = tmp_buf;
    tmp = temp;
    printf("\r\n\n1. 아 이 디\r\n2. 이    름\r\n3. 레    벨\r\n4. 일련번호\r\n\n선택 >> ");
    nfget_s(buf,1);
    if(buf[0] == '1') {
        flag = 1;
        printf("\r\n아 이 디 : ");
        nfget_s(buf,8);
        i = strlen(buf);
    }
    else if(buf[0] == '2') {
        flag = 2;
        printf("\r\n\033$)1\033[?85h\r이    름 : ");
        nfget_s(buf,8);
        i = strlen(buf);
    }
    else if(buf[0] == '3') {
        flag = 3;
        printf("\r\n상위레벨 : ");
        nfget_s(buf,10);
        up = atoi(buf);
        printf("\r\n하위레벨 : ");
        nfget_s(buf,10);
        down = atoi(buf);
        if(down > up) {
            i = down;
            down = up;
            up = i;
        }
    }
    else if(buf[0] == '4') {
        flag = 4;
        printf("\r\n번    호 : ");
        nfget_s(buf,8);
        i = atoi(buf);
    }
    else {
        return;
    }
    if((fp1 = fopen("bin/id_pf","r+")) == NULL) {
        printf("\r\nID 화일을 열수가 없습니다.");
        host_end();
    }
    j = 0;
    while(fread((char*)&pf,sizeof(struct idst),1,fp1)) {
        if(flag == 1) {
            if(!strncmp(buf,pf.id,i)) {
                dis_pf();
                j = 1;
            }
        }
        else if(flag == 2) {
            if(!strncmp(buf,pf.name,i)) {
                dis_pf();
                j = 1;
            }
        }
        else if(flag == 3) {
            if(down <= pf.level && up >=pf.level) {
                dis_pf();
                j = 1;
            }
        }
        else if(flag == 4) {
            if(i == pf.num) {
                dis_pf();
                getchar();
                break;
            }
        }
        if(j) {
            j = 0;
            printf("\r\n\033(2\033[?85l\r계속[Enter] 중지 [P] : ");
            nfget_s(tmp,4);
            if(tmp[0] == 'p' || temp[0] == 'P') {
                break;
            }
        }
    }
    fclose(fp1);
}

letter_sort()   /* 편지함 정리 */
{
    int i, j, num, max;
    char *buf, tmp[40];
    time_t delti;
    FILE *fp1, *fp2, *fp3, *fp4;

    buf = tmp_buf;
    printf("\n\r몇일간의 편지를 보관하시겠습니까(Enter는 30일)? ");
    nfget_s(buf,2);
    i = atoi(buf);
    if(i <= 0) i = 30;
    fp1 = fopen("bin/id_pf","r");
    fseek(fp1,0L,SEEK_END);
    max = ftell(fp1) / sizeof(struct idst);
    fclose(fp1);
    time(&delti);
    delti = delti - (i*24*3600);
    for(num = 0; num <= max; num++) {
        sprintf(buf,"letter/%05d.mail",num);
        if((fp1 = fopen(buf,"r")) == NULL);
        else {
            sprintf(buf,"tmp/%05d.mail",num);
            fp2 = fopen(buf,"w");
            sprintf(buf,"letter/%05d.txt",num);
            fp3 = fopen(buf,"r");
            sprintf(buf,"tmp/%05d.txt",num);
            fp4 = fopen(buf,"w");
            i = 0;
            while(fread((char*)&letter,sizeof(struct mail),1,fp1)) {
                if((letter.T != 'd') && (letter.tf > delti)) {
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
            sprintf(buf,"tmp/%05d.mail",num);
            sprintf(tmp,"letter/%05d.mail",num);
            rename(buf,tmp);
            sprintf(buf,"tmp/%05d.txt",num);
            sprintf(tmp,"letter/%05d.txt",num);
            rename(buf,tmp);
        }
        sprintf(buf,"letter/%05d.chk",num);
        if((fp1 = fopen(buf,"r")) == NULL);
        else {
            sprintf(tmp,"tmp/%05d.chk",num);
            fp2 = fopen(tmp,"w");
            while(fread((char*)&mail_chk,sizeof(struct mail_dis),1,fp1)) {
                if(mail_chk.tf > delti) {
                    fwrite((char*)&mail_chk,sizeof(struct mail_dis),1,fp2);
                }
            }
            fclose(fp2);
            fclose(fp1);
            rename(tmp,buf);
        }
    }
}

void id_sort()
{
    int i;
    char *buf, olddata[40], newdata[40];
    FILE *fp1, *fp2;
    time_t delti;
    buf = tmp_buf;
    printf("\n\r몇일간의 접속자를 남기시겠습니까(Enter는 취소)? ");
    nfget_s(buf,3);
    i = atoi(buf);
    if(i > 0) {
        time(&delti);
        delti = delti - (i*24*3600);
        fp1 = fopen("bin/id_pf","r");
        fp2 = fopen("tmp/id_pf.new","w");
        while(fread((char*)&pf,sizeof(struct idst),1,fp1)) {
            if((pf.level >= 0) && (pf.logout >= delti)) {
                fwrite((char*)&pf,sizeof(struct idst),1,fp2);
            }
            else {
                sprintf(olddata,"letter/%05d.mail",pf.num);
                unlink(olddata);
                sprintf(olddata,"letter/%05d.txt",pf.num);
                unlink(olddata);
                sprintf(olddata,"letter/%05d.chk",pf.num);
                unlink(olddata);
            }
        }
        fclose(fp2);
        fclose(fp1);
        sprintf(olddata,"bin/id_pf");
        sprintf(newdata,"bin/id_pf.org");
        rename(olddata,newdata);
        sprintf(newdata,"tmp/id_pf.new");
        rename(newdata,olddata);
    }
}

void menu_free()
{
    nmenu = menu->downp;
    while(menu != nmenu) {
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

