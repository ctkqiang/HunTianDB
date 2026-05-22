package main
import ("database/sql"; "fmt"; _ "github.com/lib/pq")
func main() {
	db, _ := sql.Open("postgres", "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")
	defer db.Close()
	r, _ := db.Query("SHOW USERS"); defer r.Close()
	fmt.Println("── Current Users ──")
	for r.Next() { var u, role string; r.Scan(&u, &role); fmt.Printf("  %s (%s)\n", u, role) }
	db.Exec("INSERT INTO users (username, password, role) VALUES ('go_analyst', 'secure789', 'reader')")
	fmt.Println("[OK] INSERT INTO users: go_analyst (reader)")
	db.Exec("CREATE USER go_auditor 'audit456' writer")
	fmt.Println("[OK] CREATE USER: go_auditor (writer)")
	fmt.Println("[DONE]")
}
