%% erlang/data_insert_totable.erl — 混天DB Erlang 示例
%% 运行: erlc data_insert_totable.erl && erl -noshell -s data_insert_totable main -s init stop
-module(data_insert_totable).
-export([main/0]).
main() ->
    {ok, C} = epgsql:connect("127.0.0.1", "admin", "admin123", [{port, 5408}, {database, "huntiandb"}]),
    io:format("[OK] Connected~n"),
    % your code here
    epgsql:close(C),
    io:format("[DONE]~n").
