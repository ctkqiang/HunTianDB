#include <stdio.h>
#include <libpq-fe.h>
int main() {
    PGconn *c = PQconnectdb("host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb");
    if (PQstatus(c) != CONNECTION_OK) { fprintf(stderr, "连接失败\n"); return 1; }
    PGresult *r = PQexec(c, "SHOW USERS");
    printf("── Current Users ──\n");
    for (int i = 0; i < PQntuples(r); i++) printf("  %s (%s)\n", PQgetvalue(r,i,0), PQgetvalue(r,i,1));
    PQclear(r);
    PQexec(c, "INSERT INTO users (username, role) VALUES ('c_analyst', 'reader')");
    printf("[OK] INSERT INTO users: c_analyst (reader)\n");
    PQfinish(c); printf("[DONE]\n"); return 0;
}
