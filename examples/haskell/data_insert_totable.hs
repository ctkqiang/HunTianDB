{-# LANGUAGE OverloadedStrings #-}
import Database.PostgreSQL.Simple
import System.Environment (getArgs)
main :: IO ()
main = do
    args <- getArgs
    let rows = if null args then 500 else read (head args) :: Int
        batch = 100
    conn <- connect defaultConnectInfo { connectHost="127.0.0.1", connectPort=5408, connectUser="admin", connectPassword="admin123", connectDatabase="huntiandb" }
    mapM_ (\b -> do
        let vals = init $ concat [ "(" ++ show i ++ "," ++ show (1779200000000 + i*1000) ++ "," ++ show (i `mod` 500) ++ "," ++ show (i*13) ++ "," ++ show (i `mod` 8+1) ++ "," ++ show (i `mod` 5+1) ++ ",200," ++ show (0x0A000001 + (i `mod` 255)) ++ "," ++ show (i-1) ++ ",'OK','SEC_AUDIT_')," | i <- [b..min (b+batch-1) (rows-1)] ]
        _ <- execute_ conn ("INSERT INTO security_events VALUES " ++ vals)
        return ()
        ) [0, batch..rows-1]
    putStrLn $ "[OK] INSERT " ++ show rows ++ " rows"
    close conn; putStrLn "[DONE]"
