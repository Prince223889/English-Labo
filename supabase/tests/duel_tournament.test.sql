set request.sub='00000000-0000-0000-0000-000000000001';
\set QUIET on
-- Round robin 5 équipes : 5 manches, 10 matchs réels + 5 exempts
select public.create_tournament('RR5','roundrobin',array['A','B','C','D','E']) as id \gset rr5_
select count(*) filter (where not is_bye) as real_matches, count(*) filter (where is_bye) as byes, count(distinct round) as rounds from tournament_matches where tournament_id=:'rr5_id';
-- chaque paire se rencontre exactement une fois
select count(*) as pairs, count(distinct (least(team_a,team_b),greatest(team_a,team_b))) as uniq from tournament_matches where tournament_id=:'rr5_id' and not is_bye;
-- RR 6 équipes
select public.create_tournament('RR6','roundrobin',array['A','B','C','D','E','F']) as id \gset rr6_
select count(*) as m6, count(distinct round) as r6, count(distinct (least(team_a,team_b),greatest(team_a,team_b))) as uniq6 from tournament_matches where tournament_id=:'rr6_id';
-- KO 6 équipes : bracket 8, 2 byes
select public.create_tournament('KO6','knockout',array['A','B','C','D','E','F']) as id \gset ko6_
select round, count(*) as matches, count(*) filter (where is_bye) as byes, count(*) filter (where winner is not null) as decided from tournament_matches where tournament_id=:'ko6_id' group by round order by round;
select round, slot, team_a, team_b from tournament_matches where tournament_id=:'ko6_id' and round=2 order by slot;
-- Jouer le KO jusqu'au bout
do $$ declare t uuid := (select id from tournaments where name='KO6'); m record; i int:=0; begin
  loop
    select * into m from tournament_matches where tournament_id=t and not is_bye and winner is null and team_a is not null and team_b is not null order by round, slot limit 1;
    exit when not found;
    perform report_match(m.id, 10+i, 3); i:=i+1;
  end loop; end $$;
select status from tournaments where name='KO6';
select round, slot, team_a, team_b, winner from tournament_matches where tournament_id=(select id from tournaments where name='KO6') and round=3;
-- KO 2 équipes et 32 équipes
select public.create_tournament('KO2','knockout',array['X','Y']) ;
select public.create_tournament('KO32','knockout',(select array_agg('T'||g) from generate_series(1,32) g)) as id \gset ko32_
select count(*) as total32, count(distinct round) as rounds32 from tournament_matches where tournament_id=:'ko32_id';
-- erreurs attendues
select public.create_tournament('bad','knockout',array['A','A']);
\set QUIET on
set request.sub='00000000-0000-0000-0000-000000000001';
select create_duel('ABCD','[{"q":"Q1 ___","o":["a","b","c","d"],"a":2},{"q":"Q2 ___","o":["a","b","c","d"],"a":0},{"q":"Q3 ___","o":["a","b","c","d"],"a":1}]'::jsonb, 5000);
set request.sub='00000000-0000-0000-0000-000000000002'; select join_duel('abcd');
set request.sub='00000000-0000-0000-0000-000000000003'; select join_duel('ABCD');
-- un joueur ne peut ni lancer ni lire directement les clés
select start_duel('ABCD');
set request.sub='00000000-0000-0000-0000-000000000001'; select start_duel('ABCD');
set request.sub='00000000-0000-0000-0000-000000000002';
select (duel_state('ABCD')->'answer') as answer_before_reply, duel_state('ABCD')->'question' as q;
select submit_duel_answer('ABCD',0,2) as moussa_ok;
select submit_duel_answer('ABCD',0,2);
set request.sub='00000000-0000-0000-0000-000000000003'; select submit_duel_answer('ABCD',0,1) as rokia_wrong;
set request.sub='00000000-0000-0000-0000-000000000001'; select submit_duel_answer('ABCD',0,2) as awa; 
select advance_duel('ABCD');
select duel_state('ABCD')->'cur' as cur, duel_state('ABCD')->'players' as players;
set request.sub='00000000-0000-0000-0000-000000000002'; select submit_duel_answer('ABCD',0,0);
-- accès direct aux tables refusé
set role authenticated; select * from duel_keys;
