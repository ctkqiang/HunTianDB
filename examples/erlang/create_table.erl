%% erlang/create_table.erl — 混天DB Erlang 示例
%% 运行: erlc create_table.erl && erl -noshell -s create_table main -s init stop
-module(create_table).
-export([main/0]).
main() ->
    {ok, C} = epgsql:connect("127.0.0.1", "admin", "admin123", [{port, 5408}, {database, "huntiandb"}]),
    io:format("[OK] Connected~n"),
    % your code here
    epgsql:close(C),
    io:format("[DONE]~n").
