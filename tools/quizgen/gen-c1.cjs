'use strict';
const {rnd,pick,shuffle,sample,mk,cap}=require('./lib.cjs');
const {V,VP,PV}=require('./data-verbs.cjs');
const out=[]; const add=q=>{if(q)out.push(q);};
const lc=s=>s.charAt(0).toLowerCase()+s.slice(1);
// ===== Vocabulaire avancé B2/C1 (anglais = français) =====
const B=(lvl,str)=>str.trim().split(/\s*\n\s*/).filter(Boolean).map(l=>{const [w,fr]=l.split('=');return {w:w.trim(),fr:fr.trim(),lvl};});
const XV=[...B(4,`
ambition=ambition
constraint=contrainte
deadline=date limite
drawback=inconvénient majeur
enrol=s'inscrire
fundamental=fondamental
grant=subvention
incentive=incitation
insight=aperçu pénétrant
landscape=paysage
lecture=cours magistral
loan=prêt
mandatory=obligatoire
network=réseau
obstacle=obstacle
output=production
panel=comité d'experts
proposal=proposition
quote=citer
rate=taux
range=gamme
reform=réforme
refugee=réfugié
remote=éloigné
retail=commerce de détail
shift=changement
spectrum=éventail
supply=approvisionnement
survey=enquête
target=objectif
tax=impôt
trade=commerce
transition=transition
turnover=chiffre d'affaires
upgrade=moderniser
wage=salaire
yield=rendement
bribe=pot-de-vin
corruption=corruption
drought=sécheresse
famine=famine
flood=inondation
harvest=récolte
irrigation=irrigation
livestock=bétail
mining=exploitation minière
ore=minerai
renewable=renouvelable
solar=solaire
wildlife=faune
accountable=responsable (devant quelqu'un)
awkward=gênant
bleak=sombre
blunt=direct sans ménagement
coherent=cohérent
compulsory=obligatoire
consistent=constant
dense=dense
fragile=fragile
genuine=authentique
hazardous=dangereux
inadequate=insuffisant
intense=intense
massive=énorme
neutral=neutre
outstanding=remarquable
overall=global
prominent=éminent
random=aléatoire
reasonable=raisonnable
severe=grave
steady=régulier
sufficient=suffisant
tedious=fastidieux
tough=difficile
vague=vague
vivid=vif
abandon=abandonner
accelerate=accélérer
accumulate=accumuler
adjust=ajuster
affect=affecter
assist=aider
attach=attacher
boost=stimuler
calculate=calculer
cancel=annuler
combine=combiner
commit=s'engager
conclude=conclure
confirm=confirmer
construct=construire
convince=convaincre
cope=faire face
deliver=livrer
derive=dériver
distribute=distribuer
eliminate=éliminer
enable=permettre
enhance=améliorer
ensure=garantir
estimate=estimer
exceed=dépasser
expand=s'étendre
expose=exposer
extend=prolonger
facilitate=faciliter
focus=se concentrer
identify=identifier
illustrate=illustrer
impose=imposer
involve=impliquer
isolate=isoler
launch=lancer
modify=modifier
monitor=surveiller
negotiate=négocier
oppose=s'opposer à
perceive=percevoir
postpone=reporter
pursue=poursuivre
recover=se rétablir
regulate=réglementer
release=libérer
remove=retirer
resist=résister
restrict=restreindre
retain=conserver
retire=prendre sa retraite
select=sélectionner
settle=s'installer
transform=transformer
transmit=transmettre
`),...B(5,`
affluent=aisé
aggregate=ensemble
ambient=ambiant
analogy=analogie
anomaly=anomalie
arduous=ardu
articulate=s'exprimer clairement
autonomous=autonome
backlash=réaction hostile
benchmark=point de référence
bias=parti pris
catalyst=catalyseur
chronic=chronique
cohesion=cohésion
collaborate=collaborer
complacent=suffisant (satisfait de soi)
condemn=condamner
conducive=favorable
contemplate=envisager
contend=soutenir (une thèse)
contradict=contredire
convene=convoquer
credibility=crédibilité
curb=freiner
deteriorate=se détériorer
deviate=s'écarter
diminish=diminuer
discern=discerner
dismiss=rejeter
disrupt=perturber
diversify=diversifier
dwindle=décliner
elaborate=élaborer
eloquent=éloquent
embrace=adopter avec enthousiasme
enact=promulguer
enforce=faire appliquer
erode=éroder
exploit=exploiter
facet=facette
flourish=prospérer
fluctuate=fluctuer
forge=forger
formidable=redoutable
hamper=gêner
harness=exploiter (une ressource)
hinge=dépendre de
impair=altérer
impede=entraver
incentive=incitation
incorporate=incorporer
indispensable=indispensable
induce=provoquer
inflict=infliger
innate=inné
inundate=submerger
leverage=tirer parti de
mundane=banal
nurture=nourrir (développer)
oblige=obliger
oversight=supervision / oubli
partial=partiel
penalty=sanction
persist=persister
plausible=plausible
pledge=promettre solennellement
precede=précéder
precarious=précaire
prevalent=répandu
prone=enclin
proximity=proximité
rectify=rectifier
refrain=s'abstenir
reinforce=renforcer
relentless=implacable
render=rendre (rendre possible)
repercussion=répercussion
rigorous=rigoureux
robust=robuste
scarce=rare
shrewd=astucieux
slump=effondrement
sporadic=sporadique
stagnant=stagnant
stringent=strict
surge=hausse soudaine
susceptible=sensible (à)
tackle=s'attaquer à
thrive=prospérer
unprecedented=sans précédent
vindicate=justifier
warrant=justifier (exiger)
wary=méfiant
yield=céder
`)];
const k=fr=>/^(se |s’|s')/.test(fr)||(/(er|ir|re)$/.test(fr.split(' ')[0])&&!/ère$/.test(fr.split(' ')[0])&&!['mère','père','frère'].includes(fr.split(' ')[0]))?'v':'n';
XV.forEach(v=>v.k=k(v.fr));
const seen=new Set(); const XU=XV.filter(v=>!seen.has(v.w)&&seen.add(v.w));
const tok=s=>s.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ]+/).filter(x=>x.length>2);
const sh=(a,b)=>{const A=new Set(tok(a));return tok(b).some(x=>A.has(x));};
for(const v of XU){
  const pool=XU.filter(o=>o.k===v.k&&o.w!==v.w&&o.fr!==v.fr&&!sh(o.fr,v.fr));
  add(mk(v.lvl,`What does “${v.w}” mean in French?`,v.fr,shuffle(pool).slice(0,4).map(o=>o.fr),`« ${v.w} » se traduit par « ${v.fr} ».`,'Vocabulary','vocab_enfr',v.w));
  const p2=XU.filter(o=>o.k===v.k&&o.w!==v.w&&o.fr!==v.fr&&!sh(o.fr,v.fr)&&!sh(o.w,v.w));
  add(mk(v.lvl,`Which English word means “${v.fr}”?`,v.w,shuffle(p2).slice(0,4).map(o=>o.w),`« ${v.fr} » se dit « ${v.w} ».`,'Vocabulary','vocab_fren',v.w));
}
// ===== Définitions en anglais =====
const DEF=[[4,'a person who studies at university','undergraduate',['colleague','refugee','curator']],[4,'money that you owe to a bank','debt',['wage','tax','grant']],[4,'a long period without rain','drought',['flood','storm','famine']],[4,'to officially ask for a job','apply',['retire','bribe','release']],[4,'the money that a person earns regularly for work','salary',['tax','loan','budget']],[4,'a formal request for something in writing','application',['invitation','election','campaign']],[4,'to make something better','improve',['abandon','resist','postpone']],[4,'something that stops you from doing something','obstacle',['incentive','benefit','insight']],[4,'a plan to achieve something over a long time','strategy',['obstacle','bribe','famine']],[4,'to look carefully at something over a period of time','monitor',['launch','retain','distribute']],[4,'happening again and again','repeated',['neutral','random','vague']],[4,'a person who has had to leave their country because of danger','refugee',['colleague','tourist','audience']],[4,'an official count of the people in a country','census',['survey','election','budget']],[4,'the opposite of “increase”','decrease',['expand','boost','extend']],[4,'someone who works with you','colleague',['neighbour','stranger','guest']],[4,'to say that something is true without proof','claim',['reveal','deliver','estimate']],[4,'extremely important','crucial',['random','tedious','vague']],[5,'to make a problem less serious','alleviate',['exacerbate','hamper','dismiss']],[5,'to make a bad situation worse','exacerbate',['alleviate','nurture','embrace']],[5,'to weaken something gradually','undermine',['foster','enforce','enact']],[5,'to encourage something to develop','foster',['hinder','curb','impede']],[5,'to prevent something from happening easily','hinder',['facilitate','nurture','enable']],[5,'existing everywhere','ubiquitous',['rare','sporadic','partial']],[5,'lasting a very short time','ephemeral',['chronic','robust','stringent']],[5,'able to recover quickly from difficulty','resilient',['fragile','stagnant','arbitrary']],[5,'based on practical results rather than theory','pragmatic',['arbitrary','ambiguous','redundant']],[5,'not needed any more','obsolete',['inherent','tangible','feasible']],[5,'possible to do','feasible',['ephemeral','arbitrary','redundant']],[5,'real and able to be touched or measured','tangible',['ambiguous','arbitrary','subtle']],[5,'done with great attention to detail','meticulous',['sporadic','relentless','arbitrary']],[5,'a fixed limit that you must pass to reach a new level','threshold',['subsidy','stigma','paradigm']],[5,'a general agreement among a group','consensus',['dilemma','hierarchy','turmoil']],[5,'a difficult choice between two options','dilemma',['consensus','nuance','momentum']],[5,'money given by the government to help an industry','subsidy',['penalty','threshold','stigma']],[5,'to look at something very carefully','scrutinise',['streamline','perpetuate','mitigate']],[5,'to make a process simpler and more efficient','streamline',['perpetuate','jeopardise','undermine']],[5,'to put something at risk','jeopardise',['substantiate','advocate','foster']],[5,'to support an idea publicly','advocate',['undermine','hinder','scrutinise']],[5,'to suggest something indirectly','imply',['infer','enact','curb']],[5,'to reach a conclusion from evidence','infer',['imply','forge','refrain']],[5,'a small difference in meaning or tone','nuance',['paradigm','momentum','turmoil']],[5,'unfair opinion formed without enough knowledge','prejudice',['credibility','cohesion','nuance']],[5,'happening only occasionally and not regularly','sporadic',['chronic','relentless','stringent']],[5,'continuing without ever stopping or becoming less intense','relentless',['sporadic','precarious','plausible']],[5,'very strict','stringent',['partial','mundane','affluent']],[5,'not likely to last; uncertain and dangerous','precarious',['robust','tangible','vivid']],[5,'ordinary and not interesting','mundane',['eloquent','shrewd','formidable']],[5,'very powerful speaking that persuades people','eloquent',['mundane','complacent','arduous']],[5,'willing to accept things without worry; too satisfied','complacent',['shrewd','wary','eloquent']],[5,'careful because you do not trust something','wary',['susceptible','complacent','prone']],[5,'likely to suffer from something','prone',['wary','robust','innate']],[5,'strong and unlikely to fail','robust',['fragile','precarious','sporadic']]];
for(const [l,d,c,w] of DEF) add(mk(l,`Which word means: “${d}”?`,c,w,`Définition : « ${c} » = ${d}.`,'Vocabulary','meaning',c));
// ===== Clauses participiales =====
const PAR=[['___ the exam, she went home.','Having finished',['Finish','To finishing','Finished to'],'Participe passé parfait : Having + pp (action antérieure).'],['___ the news, he started to cry.','Hearing',['Heard to','To hear','Have heard'],'Participe présent : action simultanée.'],['___ in Bamako, she knows the city very well.','Having lived',['Living to','To live','Lived to'],'Having + pp pour une action antérieure à la principale.'],['___ tired, he went to bed early.','Feeling',['Felt to','To feel','Have felt'],'Participe présent pour la cause.'],['The book, ___ by a famous author, was a bestseller.','written',['writing','wrote','to write'],'Participe passé = sens passif (écrit par).'],['The students ___ in the hall are waiting.','sitting',['sat to','to sit','sit'],'Participe présent = proposition relative réduite.'],['___ the instructions carefully, you will avoid mistakes.','Following',['Followed to','To following','Follow'],'Participe présent en début de phrase.'],['Not ___ the answer, he stayed silent.','knowing',['know','knew','to know'],'Not + participe présent.'],['___ by the noise, the baby woke up.','Disturbed',['Disturbing','To disturb','Disturb'],'Participe passé (passif) : dérangé par.'],['___ his homework, he watched TV.','Having done',['Doing to','Done to','To have done'],'Having + pp : action terminée avant.']];
PAR.forEach(([q,c,w,e])=>add(mk(5,q,c,w,e,'Grammar','cloze',q.replace('___',c))));
// ===== No matter / whatever / however =====
const WH=[['___ you say, I will not change my mind.','Whatever',['However','Whoever','Wherever'],'Whatever = quoi que.'],['___ hard he tries, he cannot lift it.','However',['Whatever','Whoever','Whenever'],'However + adjectif = aussi … que.'],['___ wins the race will receive a medal.','Whoever',['Whatever','However','Whichever'],'Whoever = quiconque.'],['___ you go, you will find friendly people.','Wherever',['Whenever','Whoever','However'],'Wherever = où que.'],['Call me ___ you need help.','whenever',['wherever','whoever','however'],'Whenever = chaque fois que.'],['No matter ___ she studies, she never feels ready.','how much',['how many','whatever','however it'],'No matter how much + verbe.'],['___ of the two roads you choose, you will arrive at the village.','Whichever',['Whoever','However','Whatever of'],'Whichever = lequel que.'],['I will help you ___ happens.','whatever',['however','whoever','whichever'],'Whatever happens = quoi qu’il arrive.']];
WH.forEach(([q,c,w,e])=>add(mk(5,q,c,w,e,'Grammar','cloze',q.replace('___',c))));
// ===== Conditions : unless, provided, as long as, in case =====
const CN=[['I’ll lend you the book ___ you return it on Friday.','provided that',['unless','in case','although'],'provided that = à condition que.'],['Take an umbrella ___ it rains.','in case',['unless','provided','so that'],'in case = au cas où.'],['You can’t enter ___ you have a ticket.','unless',['provided','as long as','in case'],'unless = à moins que.'],['___ you work hard, you will succeed.','As long as',['Unless','In case','Whereas'],'as long as = tant que / pourvu que.'],['Study hard; ___ , you will fail.','otherwise',['therefore','moreover','however'],'otherwise = sinon.'],['Speak slowly ___ everyone understands you.','so that',['unless','although','in case of'],'so that = afin que.'],['She left early ___ she wouldn’t miss the train.','so that',['although','unless','whereas'],'so that + would/could = but.'],['I’ll go to the party, ___ I’m tired.','even though',['as long as','unless','in case'],'even though = même si (fait réel).'],['___ it was late, we kept working.','Even though',['Unless','Provided','As long as'],'Even though + fait réel.'],['He talks ___ he were the boss.','as if',['unless','so that','even if'],'as if = comme si.']];
CN.forEach(([q,c,w,e])=>add(mk(4,q,c,w,e,'Grammar','cloze',q.replace('___',c))));
// ===== Collocations adjectif + nom =====
const AC=[['___ rain','heavy',['strong','high','big']],['___ tea','strong',['heavy','high','big']],['a ___ decision','tough',['hard strong','high','large']],['___ traffic','heavy',['strong','high','big']],['a ___ chance','slim',['small thin','low','weak']],['___ competition','fierce',['strong big','high','hard']],['a ___ majority','vast',['strong','tall','heavy']],['___ evidence','compelling',['heavy','tall','wide']],['a ___ argument','convincing',['heavy','tall','wide']],['___ poverty','extreme',['tall','heavy','wide']],['a ___ economy','booming',['heavy','tall','narrow']],['___ awareness','raise',['lift','grow','up']],['a ___ opportunity','golden',['yellow','silver coin','shiny glass']],['___ sleep','deep',['tall','wide','high']],['a ___ speaker','fluent',['rapid','heavy','high']],['___ doubt','serious',['heavy','tall','wide']],['a ___ mistake','serious',['heavy','tall','wide']],['a ___ breeze','light',['small wind','low','weak']]].filter(x=>x[0]!=='___ awareness');
AC.forEach(([q,c,w],i)=>add(mk(5,`Choose the word that collocates naturally: “${q}”`,c,w,`Collocation naturelle : « ${q.replace('___',c)} ».`,'Vocabulary','cloze',q.replace('___',c))));
// ===== VP : “told X to”, “is said to have”, questions passives =====
const NAMES=['Amadou','Awa','Moussa','Fatoumata'];
for(const [vb,obj] of VP){ const v=V[vb];
  for(const N of sample(NAMES,2)){ add(mk(4,`The teacher told ${N} ___ ${obj}.`,`to ${v.base}`,[`${v.ing}`,`that ${v.base}`,`${v.base}`],`Discours rapporté d'un ordre : told + personne + to + base verbale.`,'Grammar','cloze',`The teacher told ${N} to ${v.base} ${obj}.`)); }
  add(mk(5,`People say that she ${v.past} ${obj} when she was young. → She is said ___ ${obj} when she was young.`,`to have ${v.pp}`,[`to ${v.base}`,`having ${v.pp}`,`that ${v.pp}`],`Passif avec verbe d'opinion : is said to have + participe passé (action antérieure).`,'Grammar','cloze',`She is said to have ${v.pp} ${obj} when she was young.`));
  add(mk(5,`It is believed that he ${v.s3} ${obj} every day. → He is believed ___ ${obj} every day.`,`to ${v.base}`,[`to have ${v.pp}`,`${v.ing}`,`that ${v.base}`],`Passif avec verbe d'opinion : is believed to + base (action présente).`,'Grammar','cloze',`He is believed to ${v.base} ${obj} every day.`));
}
for(const p of PV){ const v=p.v; add(mk(4,`___ ${p.o} ${v.pp} by ${p.a} yesterday?`,'Was',['Were','Did','Has'],`Question au passif : Was/Were + sujet + participe passé.`,'Grammar','cloze',`Was ${p.o} ${v.pp} by ${p.a} yesterday?`)); }
// ===== Inversions complexes (C1) =====
const SB=['he','she','we','they','Moussa','Fatoumata','my brother','our teacher','the students','my parents'];
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(SB,3)){
    add(mk(5,`Hardly ___ ${obj} when the phone rang. (subject: ${S})`,`had ${S} ${v.pp}`,[`${S} had ${v.pp}`,`did ${S} ${v.base}`,`has ${S} ${v.pp}`],`Hardly + had + sujet + participe passé … when : inversion obligatoire.`,'Grammar','cloze',`Hardly had ${S} ${v.pp} ${obj} when the phone rang.`));
    add(mk(5,`No sooner ___ ${obj} than the lights went out. (subject: ${S})`,`had ${S} ${v.pp}`,[`${S} had ${v.pp}`,`did ${S} ${v.base}`,`has ${S} ${v.pp}`],`No sooner + had + sujet + participe passé … than : inversion obligatoire.`,'Grammar','cloze',`No sooner had ${S} ${v.pp} ${obj} than the lights went out.`));
    add(mk(5,`Not only ___ ${obj}, but ${S} also helped the others. (subject: ${S})`,`did ${S} ${v.base}`,[`${S} did ${v.base}`,`${S} ${v.past}`,`did ${S} ${v.past}`],`Not only en début de phrase : inversion avec did + sujet + base verbale.`,'Grammar','cloze',`Not only did ${S} ${v.base} ${obj}, but ${S} also helped the others.`));
  }
}
module.exports=out;
