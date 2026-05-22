{-# LANGUAGE OverloadedStrings #-}
import Database.PostgreSQL.Simple
main :: IO ()
main = do
    conn <- connect defaultConnectInfo { connectHost="127.0.0.1", connectPort=5408, connectUser="admin", connectPassword="admin123", connectDatabase="huntiandb" }
    putStrLn "[OK] Connected"
    _ <- execute_ conn "DROP TABLE IF EXISTS security_events"
    _ <- execute_ conn "CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)"
    putStrLn "[OK] Table created"
    xs <- query_ conn "SHOW TABLES" :: IO [Only String]
    mapM_ (putStrLn . ("  "++) . fromOnly) xs
    close conn; putStrLn "[DONE]"
