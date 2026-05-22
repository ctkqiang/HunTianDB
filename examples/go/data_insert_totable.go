// go/data_insert_totable.go — 批量插入数据
// 运行: go run data_insert_totable.go [行数] [批次]

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"
	_ "github.com/lib/pq"
)

func main() {
	rows := 1000
	batch := 500
	if len(os.Args) > 1 { rows, _ = strconv.Atoi(os.Args[1]) }
	if len(os.Args) > 2 { batch, _ = strconv.Atoi(os.Args[2]) }

	db, _ := sql.Open("postgres", "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")
	defer db.Close()

	db.Exec(`CREATE TABLE IF NOT EXISTS security_events (
		id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL,
		user_id INT, session_id BIGINT, event_type SMALLINT,
		zone SMALLINT, status_code SMALLINT, ip_address INT,
		parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)`)

	payload := "SEC_AUDIT_"
	for i := 0; i < 20; i++ { payload += payload }
	start := time.Now()

	for b := 0; b < rows; b += batch {
		vals := ""
		end := b + batch
		if end > rows { end = rows }
		for i := b; i < end; i++ {
			if vals != "" { vals += "," }
			vals += fmt.Sprintf("(%d,%d,%d,%d,%d,%d,%d,%d,%d,'OK','%s')",
				i, 1779200000000+int64(i)*1000, i%500, i*13, i%8+1, i%5+1, 200, 0x0A000001+(i%255), i-1, payload)
		}
		db.Exec("INSERT INTO security_events VALUES " + vals)
	}
	elapsed := time.Since(start)
	rate := float64(rows) / elapsed.Seconds()
	fmt.Printf("[OK] %d rows in %.2fs (%.0f r/s)\n", rows, elapsed.Seconds(), rate)

	var count int
	db.QueryRow("SELECT COUNT(*) FROM security_events").Scan(&count)
	fmt.Printf("[OK] COUNT(*) = %d\n", count)
	log.Println("[DONE]")
}
