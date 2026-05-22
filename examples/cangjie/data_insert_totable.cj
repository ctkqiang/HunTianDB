// cangjie/data_insert_totable.cj — 混天DB 仓颉语言示例
// 运行: cj run data_insert_totable.cj
import std.io.*
import std.process.*

func exec(sql: String): String {
    let r = Process.run("psql", ["-h", "127.0.0.1", "-p", "5408", "-U", "admin", "-d", "huntiandb", "-c", sql],
        env: ["PGPASSWORD": "admin123"])
    return r.stdout
}

func main() {
    println("[OK] Connected to HunTianDB")
    // your code here
    println("[DONE]")
}
