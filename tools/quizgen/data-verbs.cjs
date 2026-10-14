'use strict';
const {parseVerbs}=require('./lib.cjs');
// base:passé:participe:français:niveau(1-5)
const VERBS=parseVerbs(`
play:+:+:jouer:1
study:+:+:étudier:1
walk:+:+:marcher:1
work:+:+:travailler:1
cook:+:+:cuisiner:1
clean:+:+:nettoyer:1
wash:+:+:laver:1
open:+:+:ouvrir:1
close:+:+:fermer:1
call:+:+:appeler:1
help:+:+:aider:1
watch:+:+:regarder:1
listen:+:+:écouter:1
visit:+:+:visiter:1
learn:+:+:apprendre:1
teach:taught:taught:enseigner:1
speak:spoke:spoken:parler:1
read:read:read:lire:1
write:wrote:written:écrire:1
eat:ate:eaten:manger:1
drink:drank:drunk:boire:1
buy:bought:bought:acheter:1
sell:sold:sold:vendre:1
make:made:made:fabriquer:1
take:took:taken:prendre:1
bring:brought:brought:apporter:1
carry:+:+:porter:2
build:built:built:construire:2
draw:drew:drawn:dessiner:2
paint:+:+:peindre:2
sing:sang:sung:chanter:1
dance:+:+:danser:1
live:+:+:habiter:1
stay:+:+:rester:1
wait:+:+:attendre:2
ask:+:+:demander:1
answer:+:+:répondre:2
find:found:found:trouver:1
lose:lost:lost:perdre:2
forget:forgot:forgotten:oublier:2
remember:+:+:se souvenir:2
choose:chose:chosen:choisir:2
win:won:won:gagner:2
meet:met:met:rencontrer:1
send:sent:sent:envoyer:2
give:gave:given:donner:1
tell:told:told:dire:2
leave:left:left:partir:2
begin:began:begun:commencer:2
break:broke:broken:casser:2
catch:caught:caught:attraper:2
wear:wore:worn:porter:2
sit:sat:sat:s'asseoir:1
sleep:slept:slept:dormir:1
think:thought:thought:penser:2
understand:understood:understood:comprendre:2
pay:paid:paid:payer:2
spend:spent:spent:dépenser:2
keep:kept:kept:garder:2
go:went:gone:aller:1
come:came:come:venir:1
see:saw:seen:voir:1
do:did:done:faire:1
have:had:had:avoir:1
get:got:got:obtenir:1
know:knew:known:savoir:1
run:ran:run:courir:1
swim:swam:swum:nager:1
ride:rode:ridden:conduire (vélo):2
drive:drove:driven:conduire:2
fly:flew:flown:voler:2
grow:grew:grown:grandir:2
throw:threw:thrown:jeter:2
fall:fell:fallen:tomber:2
feel:felt:felt:ressentir:2
hear:heard:heard:entendre:1
hold:held:held:tenir:2
lead:led:led:diriger:3
cut:cut:cut:couper:2
put:put:put:mettre:1
let:let:let:laisser:2
hit:hit:hit:frapper:2
rise:rose:risen:se lever (soleil):3
shake:shook:shaken:secouer:3
steal:stole:stolen:voler (dérober):3
hide:hid:hidden:cacher:3
bite:bit:bitten:mordre:3
blow:blew:blown:souffler:3
burn:burnt:burnt:brûler:3
deal:dealt:dealt:traiter:4
forgive:forgave:forgiven:pardonner:3
freeze:froze:frozen:geler:3
hang:hung:hung:accrocher:3
hurt:hurt:hurt:blesser:2
lay:laid:laid:poser:4
lend:lent:lent:prêter:3
light:lit:lit:allumer:3
mean:meant:meant:signifier:2
ring:rang:rung:sonner:3
seek:sought:sought:chercher:4
shine:shone:shone:briller:3
shut:shut:shut:fermer:3
sink:sank:sunk:couler:3
slide:slid:slid:glisser:4
speed:sped:sped:accélérer:4
spread:spread:spread:répandre:3
stand:stood:stood:se tenir debout:2
stick:stuck:stuck:coller:3
strike:struck:struck:frapper:4
swear:swore:sworn:jurer:4
sweep:swept:swept:balayer:4
tear:tore:torn:déchirer:3
wake:woke:woken:se réveiller:2
weave:wove:woven:tisser:4
bend:bent:bent:plier:4
bet:bet:bet:parier:4
bind:bound:bound:lier:5
breed:bred:bred:élever:5
broadcast:broadcast:broadcast:diffuser:4
cost:cost:cost:coûter:3
creep:crept:crept:ramper:5
dig:dug:dug:creuser:3
feed:fed:fed:nourrir:3
fight:fought:fought:se battre:3
flee:fled:fled:fuir:4
learn:learnt:learnt:apprendre:3
overcome:overcame:overcome:surmonter:4
undergo:underwent:undergone:subir:5
withdraw:withdrew:withdrawn:retirer:4
arrive:+:+:arriver:1
change:+:+:changer:1
decide:+:+:décider:2
enjoy:+:+:apprécier:1
finish:+:+:finir:1
happen:+:+:arriver (événement):2
invite:+:+:inviter:2
join:+:+:rejoindre:2
like:+:+:aimer:1
love:+:+:adorer:1
need:+:+:avoir besoin de:1
organise:+:+:organiser:2
practise:+:+:s'entraîner:2
prepare:+:+:préparer:2
travel:+:+:voyager:1
try:+:+:essayer:1
use:+:+:utiliser:1
want:+:+:vouloir:1
wash:+:+:laver:1
work:+:+:travailler:1
`.split('\n').filter((l,i,a)=>l&&a.findIndex(x=>x.split(':')[0]===l.split(':')[0])===i).join('\n'));
const V={}; VERBS.forEach(v=>V[v.base]=v);
// Groupes verbe + complément (sans possessif, valables à tous les temps et pour tous les sujets)
const VP=[
['play','football'],['play','the guitar'],['play','chess'],['study','English'],['study','science'],['study','mathematics'],
['read','a book'],['read','the newspaper'],['read','a story'],['write','a letter'],['write','an email'],['write','a poem'],
['watch','television'],['watch','a film'],['watch','the match'],['listen','to music'],['listen','to the radio'],
['eat','rice'],['eat','fruit'],['eat','bread'],['drink','water'],['drink','tea'],['drink','milk'],
['cook','dinner'],['cook','fish'],['clean','the room'],['clean','the kitchen'],['wash','the car'],['wash','the dishes'],
['buy','bread'],['buy','vegetables'],['buy','a phone'],['sell','fruit'],['sell','vegetables'],
['open','the window'],['open','the door'],['close','the door'],['walk','to school'],['run','in the park'],['swim','in the river'],
['drive','a taxi'],['drive','a truck'],['ride','a bike'],['visit','the museum'],['call','a friend'],['help','the teacher'],
['teach','English'],['learn','French'],['speak','English'],['know','the answer'],['make','a cake'],['take','photos'],
['bring','the books'],['carry','water'],['build','a house'],['draw','a map'],['paint','the wall'],['sing','a song'],
['dance','at parties'],['work','in a hospital'],['live','in Bamako'],['stay','at home'],['wait','for the bus'],
['ask','a question'],['answer','the phone'],['find','the keys'],['lose','the keys'],['forget','the password'],
['remember','the date'],['choose','a book'],['win','the game'],['meet','the director'],['send','a message'],
['give','a gift'],['tell','a story'],['leave','the house'],['begin','the lesson'],['break','the window'],
['catch','the bus'],['wear','a uniform'],['sit','on the chair'],['sleep','early'],['think','about the problem'],
['understand','the lesson'],['pay','the bill'],['spend','money'],['keep','a diary'],['fly','a kite'],['grow','vegetables'],
['hold','a meeting'],['feed','the chickens'],['dig','a well'],['organise','a party'],['prepare','the lesson'],['practise','English'],
['invite','a friend'],['change','the plan'],['use','a computer'],['try','a new recipe']
].filter(([v])=>V[v]);
// Verbes transitifs pour le passif : [verbe, objet singulier, agent]
const PV=[
['write','the letter','Amadou'],['break','the window','the boy'],['build','the bridge','the workers'],['paint','the wall','Awa'],['clean','the classroom','the students'],
['open','the door','the guard'],['close','the shop','the owner'],['wash','the car','Moussa'],['cook','the meal','Fatoumata'],['eat','the cake','the children'],
['steal','the phone','a thief'],['find','the keys','the teacher'],['lose','the ticket','Ibrahim'],['send','the message','the director'],['sell','the house','the family'],
['draw','the map','the pupils'],['teach','the lesson','Mr Keita'],['win','the match','our team'],['take','the photo','my uncle'],['read','the report','the engineer'],
['make','the cake','my mother'],['drive','the bus','Seydou'],['bring','the books','the librarian'],['choose','the winner','the judges'],['forget','the appointment','the doctor'],
['organise','the party','the class'],['prepare','the experiment','the scientists'],['repair','the machine','the technician'],['discover','the mine','the geologists'],['invite','the guests','the mayor'],
['publish','the article','the newspaper'],['collect','the data','the researchers'],['destroy','the old bridge','the flood'],['grow','the rice','the farmers'],['carry','the bags','the porter'],
['hide','the money','the thief'],['bake','the bread','the baker'],['design','the building','an architect'],['sign','the contract','the manager'],['check','the results','the teacher']
].map(([v,o,a])=>({v:V[v]||(()=>{const {parseVerbs}=require('./lib.cjs');return null;})(),o,a,vn:v})).filter(x=>x.v);
module.exports={VERBS,V,VP,PV};
