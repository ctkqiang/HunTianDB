{-# LANGUAGE OverloadedStrings #-}
import Database.PostgreSQL.Simple
main :: IO ()
main = do
    conn <- connect defaultConnectInfo { connectHost="127.0.0.1", connectPort=5408, connectUser="admin", connectPassword="admin123", connectDatabase="huntiandb" }
    xs <- query_ conn "SHOW USERS" :: IO [(String, String)]
    putStrLn "── Current Users ──"
    mapM_ (\(u,r) -> putStrLn $ "  " ++ u ++ " (" ++ r ++ ")") xs
    _ <- execute_ conn "INSERT INTO users (username, role) VALUES ('hs_analyst', 'reader')"
    putStrLn "[OK] INSERT INTO users: hs_analyst (reader)"
    close conn; putStrLn "[DONE]"
