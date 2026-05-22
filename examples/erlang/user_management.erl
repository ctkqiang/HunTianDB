%% erlang/user_management.erl — 混天DB Erlang 示例
%% 运行: erlc user_management.erl && erl -noshell -s user_management main -s init stop
-module(user_management).
-export([main/0]).
main() ->
    {ok, C} = epgsql:connect("127.0.0.1", "admin", "admin123", [{port, 5408}, {database, "huntiandb"}]),
    io:format("[OK] Connected~n"),
    % your code here
    epgsql:close(C),
    io:format("[DONE]~n").
