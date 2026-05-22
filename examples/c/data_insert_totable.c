#include <stdio.h>
#include <string.h>
#include <libpq-fe.h>
int main(int argc, char **argv) {
    int rows = argc > 1 ? atoi(argv[1]) : 500;
    int batch = argc > 2 ? atoi(argv[2]) : 100;
    PGconn *c = PQconnectdb("host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb");
    if (PQstatus(c) != CONNECTION_OK) { fprintf(stderr, "连接失败\n"); return 1; }
    printf("[OK] Connected\n");
    for (int b = 0; b < rows; b += batch) {
        char sql[65536] = "INSERT INTO security_events VALUES ";
        int pos = strlen(sql), end = b+batch < rows ? b+batch : rows;
        for (int i = b; i < end; i++)
            pos += snprintf(sql+pos, sizeof(sql)-pos, "%s(%d,%lld,%d,%d,%d,%d,%d,%lld,%d,'OK','SEC_AUDIT_PAYLOAD_')", i>b?",":"", i, 1779200000000LL+i*1000, i%500, i*13, i%8+1, i%5+1, 200, 0x0A000001LL+(i%255), i>0?i-1:0);
        PGresult *r = PQexec(c, sql); PQclear(r);
    }
    printf("[OK] INSERT %d rows\n", rows);
    PGresult *r = PQexec(c, "SELECT COUNT(*) FROM security_events");
    printf("[OK] COUNT(*) = %s\n", PQgetvalue(r,0,0)); PQclear(r);
    PQfinish(c); printf("[DONE]\n"); return 0;
}
