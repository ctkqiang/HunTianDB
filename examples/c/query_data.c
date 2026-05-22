#include <stdio.h>
#include <libpq-fe.h>
void run(PGconn *c, char *label, char *sql) {
    PGresult *r = PQexec(c, sql);
    printf("[OK] %s: %d rows\n", label, PQntuples(r));
    for (int i = 0; i < PQntuples(r) && i < 3; i++) { printf("  "); for (int j = 0; j < PQnfields(r); j++) printf("%s ", PQgetvalue(r,i,j)); printf("\n"); }
    PQclear(r);
}
int main() {
    PGconn *c = PQconnectdb("host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb");
    if (PQstatus(c) != CONNECTION_OK) { fprintf(stderr, "连接失败\n"); return 1; }
    run(c, "COUNT(*)", "SELECT COUNT(*) FROM security_events");
    run(c, "SUM", "SELECT SUM(status_code) FROM security_events");
    run(c, "AVG", "SELECT AVG(status_code) FROM security_events");
    run(c, "GROUP BY", "SELECT event_type, COUNT(*) FROM security_events GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 5");
    PQfinish(c); printf("[DONE]\n"); return 0;
}
