#include <stdio.h>
#include <libpq-fe.h>
int main() {
    PGconn *c = PQconnectdb("host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb");
    if (PQstatus(c) != CONNECTION_OK) { fprintf(stderr, "连接失败\n"); return 1; }
    printf("[OK] Connected\n");
    PQexec(c, "DROP TABLE IF EXISTS security_events");
    PGresult *r = PQexec(c, "CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)");
    if (PQresultStatus(r) == PGRES_COMMAND_OK) printf("[OK] Table created\n"); else printf("[FAIL] %s\n", PQerrorMessage(c));
    PQclear(r);
    r = PQexec(c, "SHOW TABLES");
    for (int i = 0; i < PQntuples(r); i++) printf("  %s\n", PQgetvalue(r,i,0));
    PQclear(r); PQfinish(c); printf("[DONE]\n"); return 0;
}
