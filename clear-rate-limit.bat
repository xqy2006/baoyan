@echo off
echo Clearing rate limit for IP 172.19.0.1...

REM Connect to Redis and clear rate limit keys
docker exec -it xmudemo-redis-1 redis-cli KEYS "rate_limit:172.19.0.1:*" | xargs docker exec -i xmudemo-redis-1 redis-cli DEL

echo Rate limit cleared successfully!
echo You can now try logging in again.
pause
