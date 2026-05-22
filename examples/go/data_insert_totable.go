package main
import ("database/sql"; "fmt"; "log"; "os"; "strconv"; "time"; _ "github.com/lib/pq")
func main() {
	rows, _ := strconv.Atoi(os.Args[1]); batch, _ := strconv.Atoi(os.Args[2])
	if rows == 0 { rows = 1000 }; if batch == 0 { batch = 500 }
	db, _ := sql.Open("postgres", "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")
	defer db.Close()
	db.Exec(`CREATE TABLE IF NOT EXISTS security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)`)
	payload := "SEC_AUDIT_"; for i := 0; i < 20; i++ { payload += payload }
	t0 := time.Now()
	for b := 0; b < rows; b += batch {
		vals := ""; end := b + batch; if end > rows { end = rows }
		for i := b; i < end; i++ {
			if vals != "" { vals += "," }
			vals += fmt.Sprintf("(%d,%d,%d,%d,%d,%d,%d,%d,%d,'OK','%s')", i, 1779200000000+int64(i)*1000, i%500, i*13, i%8+1, i%5+1, 200, 0x0A000001+(i%255), i-1, payload)
		}
		db.Exec("INSERT INTO security_events VALUES " + vals)
	}
	elapsed := time.Since(t0).Seconds()
	fmt.Printf("[OK] %d rows in %.2fs (%.0f r/s)\n", rows, elapsed, float64(rows)/elapsed)
	var cnt int; db.QueryRow("SELECT COUNT(*) FROM security_events").Scan(&cnt)
	fmt.Printf("[OK] COUNT(*) = %d\n", cnt)
	log.Println("[DONE]")
}
