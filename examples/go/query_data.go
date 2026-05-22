package main
import ("database/sql"; "fmt"; "time"; _ "github.com/lib/pq")
func main() {
	db, _ := sql.Open("postgres", "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")
	defer db.Close()
	tests := map[string]string{"COUNT(*)":"SELECT COUNT(*) FROM security_events","Point Lookup":"SELECT * FROM security_events WHERE id = 5000","Range Scan":"SELECT * FROM security_events WHERE id BETWEEN 100 AND 200","SUM":"SELECT SUM(status_code) FROM security_events","AVG":"SELECT AVG(status_code) FROM security_events","GROUP BY":"SELECT event_type, COUNT(*) FROM security_events GROUP BY event_type ORDER BY COUNT(*) DESC"}
	for label, sql := range tests {
		t0 := time.Now(); r, _ := db.Query(sql); n := 0
		for r.Next() { n++ }; r.Close()
		fmt.Printf("[OK] %s: %d rows (%.2fms)\n", label, n, float64(time.Since(t0).Microseconds())/1000)
	}
	fmt.Println("[DONE]")
}
