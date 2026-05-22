%% erlang/query_data.erl — 混天DB Erlang 示例
%% 运行: erlc query_data.erl && erl -noshell -s query_data main -s init stop
-module(query_data).
-export([main/0]).
main() ->
    {ok, C} = epgsql:connect("127.0.0.1", "admin", "admin123", [{port, 5408}, {database, "huntiandb"}]),
    io:format("[OK] Connected~n"),
    % your code here
    epgsql:close(C),
    io:format("[DONE]~n").
