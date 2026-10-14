#!/usr/bin/env bash
# Teste la génération des tournois et le moteur de duel sur un PostgreSQL local jetable (sans Supabase).
# Usage : bash supabase/tests/run.sh   (nécessite postgresql-16 ; démarre un cluster temporaire)
set -euo pipefail
D=$(mktemp -d); chown postgres "$D"; B=/usr/lib/postgresql/16/bin; R=$(cd "$(dirname "$0")/.." && pwd)
su postgres -c "$B/initdb -D $D/data -A trust >/dev/null && $B/pg_ctl -D $D/data -o '-p 5545 -k $D' -l $D/log start >/dev/null"; sleep 2
P="psql -h $D -p 5545 -U postgres -v ON_ERROR_STOP=0 -q"
$P -c "create database t"; $P -d t -f "$R/tests/stub_auth.sql"
awk '/^-- DUELS EN TEMPS RÉEL/{f=1} f' "$R/schema.sql" | $P -d t -v ON_ERROR_STOP=1
$P -d t -f "$R/tests/duel_tournament.test.sql" || true
su postgres -c "$B/pg_ctl -D $D/data stop >/dev/null"
