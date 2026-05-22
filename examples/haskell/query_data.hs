{-# LANGUAGE OverloadedStrings #-}
import Database.PostgreSQL.Simple
main :: IO ()
main = do
    conn <- connect defaultConnectInfo { connectHost="127.0.0.1", connectPort=5408, connectUser="admin", connectPassword="admin123", connectDatabase="huntiandb" }
    [Only cnt] <- query_ conn "SELECT COUNT(*) FROM security_events" :: IO [Only Int]
    putStrLn $ "[OK] COUNT(*) = " ++ show cnt
    xs <- query_ conn "SELECT event_type, COUNT(*) FROM security_events GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 5" :: IO [(Int, Int)]
    mapM_ (\(e,c) -> putStrLn $ "  type=" ++ show e ++ " count=" ++ show c) xs
    close conn; putStrLn "[DONE]"
