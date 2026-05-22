// go/main.go — 混天DB Go 使用示例
//
// 依赖: go get github.com/lib/pq
// 运行: go run main.go

package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	connStr := "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	fmt.Println("[OK] 已连接混天DB")

	// 创建表
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS go_events (
			id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL,
			event_type SMALLINT, status_code SMALLINT, payload TEXT
		)
	`)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("[OK] 表 go_events 已创建")

	// 批量插入
	rows := 500
	start := time.Now()
	for b := 0; b < rows; b += 100 {
		vals := ""
		for i := b; i < b+100 && i < rows; i++ {
			if vals != "" {
				vals += ","
			}
			vals += fmt.Sprintf("(%d,%d,%d,%d,'go_payload_%d')",
				i, 1779200000000+int64(i)*1000, i%8+1, 200, i)
		}
		_, err = db.Exec("INSERT INTO go_events VALUES " + vals)
		if err != nil {
			log.Fatal(err)
		}
	}
	fmt.Printf("[OK] INSERT %d rows: %v\n", rows, time.Since(start))

	// 查询
	var count int
	db.QueryRow("SELECT COUNT(*) FROM go_events").Scan(&count)
	fmt.Printf("[OK] COUNT(*) = %d\n", count)

	aggRows, _ := db.Query("SELECT event_type, COUNT(*) as cnt FROM go_events GROUP BY event_type ORDER BY cnt DESC")
	defer aggRows.Close()
	fmt.Println("GROUP BY 结果:")
	for aggRows.Next() {
		var etype, cnt int
		aggRows.Scan(&etype, &cnt)
		fmt.Printf("  type=%d count=%d\n", etype, cnt)
	}

	fmt.Println("\n[DONE]")
}
