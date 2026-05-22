package main
import ("database/sql"; "fmt"; "log"; _ "github.com/lib/pq")
func main() {
	db, _ := sql.Open("postgres", "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")
	defer db.Close()
	db.Exec("DROP TABLE IF EXISTS security_events")
	db.Exec(`CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)`)
	fmt.Println("[OK] Table security_events created")
	rows, _ := db.Query("SHOW TABLES")
	defer rows.Close()
	for rows.Next() { var n string; rows.Scan(&n); fmt.Println(" ", n) }
	log.Println("[DONE]")
}
