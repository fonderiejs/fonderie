#!/bin/bash
# Disposable per-sequence Postgres cluster (daemonized via pg_ctl).
# usage: cluster.sh start <dataDir> <port>   -> prints DATABASE_URL
#        cluster.sh stop  <dataDir>
set -eu
BIN="$(cd "$(dirname "$0")" && pwd)/node_modules/@embedded-postgres/darwin-x64/native/bin"
CMD=$1; DATADIR=$2
case "$CMD" in
  start)
    PORT=$3
    if [ ! -f "$DATADIR/PG_VERSION" ]; then
      "$BIN/initdb" -D "$DATADIR" -U postgres --auth=trust -E UTF8 --locale=en_US.UTF-8 >/dev/null
    fi
    "$BIN/pg_ctl" -D "$DATADIR" -l "$DATADIR/server.log" \
      -o "-p $PORT -k '' -c listen_addresses=localhost" start >/dev/null
    # create the app database if missing (SQL over the postgres maintenance DB)
    node -e "
      const {Client}=require('$(cd "$(dirname "$0")/../../.." && pwd)/node_modules/pg');
      const c=new Client({host:'localhost',port:$PORT,user:'postgres',database:'postgres'});
      c.connect()
        .then(()=>c.query('CREATE DATABASE acme'))
        .catch(e=>{ if(e.code!=='42P04'){console.error(e.message);process.exit(1)} })
        .then(()=>c.end());
    "
    echo "postgres://postgres:postgres@localhost:$PORT/acme"
    ;;
  stop)
    "$BIN/pg_ctl" -D "$DATADIR" stop -m fast >/dev/null
    ;;
  *)
    echo "usage: cluster.sh <start|stop> <dataDir> [port]" >&2; exit 2;;
esac
