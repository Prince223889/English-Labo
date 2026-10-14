'use strict';
const {rnd,pick,shuffle,sample,mk,cap,s3,vowelSound}=require('./lib.cjs');
const {V,VERBS,VP,PV}=require('./data-verbs.cjs');
const out=[];
const add=q=>{if(q)out.push(q);};

const S3=['He','She','My brother','Our teacher','The engineer','Awa','Moussa','My mother','The student','The doctor','Fatoumata','Our neighbour','My cousin','The driver'];
const SP=['They','We','You','My parents','The students','Awa and Moussa','My friends','The engineers','Our teachers','The children'];
const ALLS=[...S3,...SP,'I','I','I'];
const is3=s=>S3.includes(s);
const beOf=s=>s==='I'?'am':is3(s)?'is':'are';
const haveOf=s=>is3(s)?'has':'have';
const doOf=s=>is3(s)?'does':'do';
const MARK_PS=['every day','every morning','on Mondays','at the weekend','after school','in the evening','twice a week','every Saturday'];
const MARK_PAST=['yesterday','last night','last week','two days ago','last Sunday','in 2019','last month','yesterday morning'];
const MARK_FUT=['tomorrow','next week','next Monday','next month','tomorrow morning','on Saturday'];
const lc=s=>s.charAt(0).toLowerCase()+s.slice(1);
const subjIn=(s,mid)=>mid&&!/^(I|Awa|Moussa|Fatoumata)\b/.test(s)?lc(s):s;

// ============ 1. Présent simple (A1) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS,6)){
    const correct=is3(S)?v.s3:v.base, other=is3(S)?v.base:v.s3, m=pick(MARK_PS);
    add(mk(1,`${S} ___ ${obj} ${m}.`,correct,[other,v.ing,v.past],`Au présent simple, on ajoute -s/-es à la 3e personne du singulier (he/she/it) ; les autres personnes gardent la base verbale.`,'Grammar','cloze',`${S} ${correct} ${obj} ${m}.`));
  }
  for(const S of sample(ALLS,3)){
    const m=pick(MARK_PS), dn=is3(S)?"doesn't":"don't";
    add(mk(1,`${S} ___ ${v.base} ${obj} ${m}.`,dn,[is3(S)?"don't":"doesn't",is3(S)?"isn't":"aren't",is3(S)?"hasn't":"haven't"],`Négation au présent simple : do not / does not + base verbale (does pour he/she/it).`,'Grammar','cloze',`${S} ${dn} ${v.base} ${obj} ${m}.`));
  }
  for(const S of sample(ALLS,3)){
    const m=pick(MARK_PS), aux=cap(doOf(S));
    add(mk(1,`___ ${lc(S)==='i'?'I':subjIn(S,true)} ${v.base} ${obj} ${m}?`,aux,[is3(S)?'Do':'Does',is3(S)?'Is':'Are',is3(S)?'Has':'Have'],`Question au présent simple : Do/Does + sujet + base verbale (Does pour he/she/it).`,'Grammar','cloze',`${aux} ${subjIn(S,true)} ${v.base} ${obj} ${m}?`));
  }
}
// ============ 2. Verbe être (A1) ============
const COMP=['in the classroom','at home','a student','tired','happy','from Mali','in Bamako','busy today','ready','at the market','a teacher','late for class','in the library','very kind','hungry'];
for(const S of ALLS.filter((x,i,a)=>a.indexOf(x)===i))for(const c of COMP){
  const b=beOf(S); add(mk(1,`${S} ___ ${c}.`,b,['am','is','are','be'].filter(x=>x!==b).concat(['be']),`Verbe être : I am, he/she/it is, you/we/they are.`,'Grammar','cloze',`${S} ${b} ${c}.`));
}
// ============ 3. Présent continu (A2) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS,5)){
    const b=beOf(S), correct=`${b} ${v.ing}`, bo=['am','is','are'].filter(x=>x!==b);
    add(mk(2,`Look! ${S} ___ ${obj} now.`,correct,[`${bo[0]} ${v.ing}`,`${bo[1]} ${v.ing}`,is3(S)?v.s3:v.base,`${b} ${v.base}`],`Action en cours : présent continu = am/is/are + verbe en -ing.`,'Tenses','cloze',`Look! ${S} ${correct} ${obj} now.`));
  }
}
// ============ 4. Passé simple (A2) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS,5)){
    const m=pick(MARK_PAST); const wr=[v.base,v.s3,v.ing]; if(v.pp!==v.past)wr.push(v.pp); wr.push(`${haveOf(S)} ${v.pp}`);
    add(mk(2,`${S} ___ ${obj} ${m}.`,v.past,wr,`Une action terminée dans le passé (${m}) se met au passé simple${v.irregular?` ; ${v.base} est irrégulier : ${v.base} – ${v.past} – ${v.pp}`:` (base + -ed)`}.`,'Tenses','cloze',`${S} ${v.past} ${obj} ${m}.`));
  }
}
// ============ 5. Futur : will / going to (A2) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS,3)){
    const m=pick(MARK_FUT);
    add(mk(2,`${cap(m)}, ${lc(subjIn(S,true))==='i'?'I':subjIn(S,true)} ___ ${obj}.`,`will ${v.base}`,[`will ${v.past}`,`will ${v.ing}`,`will to ${v.base}`],`Futur avec will : will + base verbale (jamais de -s, de -ed ni de to).`,'Tenses','cloze',`${cap(m)}, ${subjIn(S,true)} will ${v.base} ${obj}.`));
  }
  for(const S of sample(ALLS,3)){
    const b=beOf(S), bo=['am','is','are'].filter(x=>x!==b), m=pick(MARK_FUT);
    add(mk(2,`${cap(m)}, ${subjIn(S,true)==='i'?'I':subjIn(S,true)} ___ ${obj}.`,`${b} going to ${v.base}`,[`${bo[0]} going to ${v.base}`,`${b} going ${v.base}`,`will going to ${v.base}`],`Projet / intention : am/is/are + going to + base verbale.`,'Tenses','cloze',`${cap(m)}, ${subjIn(S,true)} ${b} going to ${v.base} ${obj}.`));
  }
}
// ============ 6. Présent parfait (B1) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS,4)){
    const aux=haveOf(S), oa=aux==='has'?'have':'has';
    const wr=[`${oa} ${v.pp}`, v.pp!==v.past?`${aux} ${v.past}`:`${aux} ${v.base}`, `${aux} ${v.ing}`];
    add(mk(3,`${S} ___ ${obj} three times this month.`,`${aux} ${v.pp}`,wr,`Présent parfait = have/has + participe passé (has pour he/she/it)${v.pp!==v.past?` ; participe passé de ${v.base} : ${v.pp}`:''}.`,'Tenses','cloze',`${S} ${aux} ${v.pp} ${obj} three times this month.`));
  }
}
// ============ 7. Passé continu (B1) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS.filter(x=>x!=='You'),3)){
    const b=is3(S)||S==='I'?'was':'were', ob=b==='was'?'were':'was';
    add(mk(3,`${S} ___ ${obj} when the power went out.`,`${b} ${v.ing}`,[`${ob} ${v.ing}`,v.past,`${b} ${v.base}`],`Action en cours interrompue : passé continu = was/were + -ing, et passé simple pour l'interruption.`,'Tenses','cloze',`${S} ${b} ${v.ing} ${obj} when the power went out.`));
  }
}
// ============ 8. Plus-que-parfait (B2) ============
for(const [vb,obj] of VP){ const v=V[vb];
  for(const S of sample(ALLS,3)){
    const wr=[`${haveOf(S)} ${v.pp}`,`had ${v.ing}`,`had ${v.base}`]; if(v.pp!==v.past)wr.push(`had ${v.past}`);
    add(mk(4,`${S} ___ ${obj} before the teacher arrived.`,`had ${v.pp}`,wr,`Une action antérieure à une autre action passée : plus-que-parfait = had + participe passé.`,'Tenses','cloze',`${S} had ${v.pp} ${obj} before the teacher arrived.`));
  }
}
// ============ 9. Passif (B1/B2) ============
const isPl=o=>/s$/.test(o)&&!/(ss|us|is)$/.test(o);
const PLAUX={'is':'are','was':'were','has been':'have been','is being':'are being'};
const AUX=[['is','Present simple passive : is/are + participe passé.',3],['was','Passé simple passif : was/were + participe passé.',3],['has been','Présent parfait passif : has/have been + participe passé.',4],['will be','Futur passif : will be + participe passé.',3],['must be','Modal passif : modal + be + participe passé.',4],['can be','Modal passif : can + be + participe passé.',3],['is being','Présent continu passif : is/are being + participe passé.',4],['had been','Plus-que-parfait passif : had been + participe passé.',5]];
for(const p of PV){ for(const [aux0,rule,lv] of AUX){
  const aux=isPl(p.o)?(PLAUX[aux0]||aux0):aux0; const v=p.v, wr=[v.base,v.ing]; if(v.past!==v.pp)wr.push(v.past); else wr.push(v.s3);
  add(mk(lv,`${cap(p.o)} ${aux} ___ by ${p.a}.`,v.pp,wr,`${rule} Ici : ${v.base} → ${v.pp}.`,'Grammar','cloze',`${cap(p.o)} ${aux} ${v.pp} by ${p.a}.`));
}}
// transformation actif → passif
const TENS=[['past','was',s=>`${'ACT'}`,3],['present','is',null,3],['perfect','has been',null,4],['future','will be',null,3]];
for(const p of PV){ const v=p.v;
  const A_=cap(p.a);const act={past:`${A_} ${v.past} ${p.o}.`,present:`${A_} ${v.s3} ${p.o}.`,perfect:`${A_} has ${v.pp} ${p.o}.`,future:`${A_} will ${v.base} ${p.o}.`};
  const pas={past:`${cap(p.o)} was ${v.pp} by ${p.a}.`,present:`${cap(p.o)} is ${v.pp} by ${p.a}.`,perfect:`${cap(p.o)} has been ${v.pp} by ${p.a}.`,future:`${cap(p.o)} will be ${v.pp} by ${p.a}.`};
  if(/^(the workers|the students|the children|the farmers|the pupils|the researchers|the judges|the geologists|the scientists|our team)$/i.test('x'))continue;
  if(/^(the workers|the students|the children|the farmers|the pupils|the researchers|the judges|the geologists|the scientists)$/i.test(p.a)||isPl(p.o))continue; // accord du verbe
  for(const k of Object.keys(act)){
    const others=Object.keys(pas).filter(x=>x!==k).map(x=>pas[x]);
    add(mk(k==='perfect'?4:3,`Choose the correct passive form: “${act[k]}”`,pas[k],others,`Le temps du verbe actif se conserve : on met l'auxiliaire be au même temps + participe passé.`,'Grammar','other',pas[k]));
  }
}
// ============ 10. Gérondif / infinitif (B1) ============
const GI={ger:['enjoy','finish','avoid','suggest','practise','keep','imagine','consider','miss'],inf:['want','decide','hope','plan','promise','learn','need','agree','refuse','manage','offer','expect']};
const GV=['play football','speak English','read novels','write emails','cook dinner','travel abroad','help others','study science','use computers','swim in the river','learn French','sing in the choir'];
const gerBase={enjoy:['enjoys','enjoy'],finish:['finishes','finish'],avoid:['avoids','avoid'],mind:['minds','mind'],suggest:['suggests','suggest'],practise:['practises','practise'],keep:['keeps','keep'],stop:['stops','stop'],imagine:['imagines','imagine'],consider:['considers','consider'],miss:['misses','miss']};
const mkIng=w=>{const [vb,...r]=w.split(' ');const vv=V[vb];return `${vv?vv.ing:vb+'ing'} ${r.join(' ')}`.trim();};
const mkInf=w=>`to ${w}`;
const pastOf=w=>{const [vb,...r]=w.split(' ');const vv=V[vb];return `${vv?vv.past:vb+'ed'} ${r.join(' ')}`.trim();};
for(const g of GI.ger) for(const w of sample(GV,10)){ const S=pick(S3), form=gerBase[g][0], correct=mkIng(w);
  add(mk(3,`${S} ${form} ___.`,correct,[mkInf(w),w,pastOf(w)],`Après ${g}, on utilise la forme en -ing (gérondif).`,'Grammar','cloze',`${S} ${form} ${correct}.`));
}
for(const g of GI.inf) for(const w of sample(GV,10)){ const S=pick(S3), form=s3(g), correct=mkInf(w);
  add(mk(3,`${S} ${form} ___.`,correct,[mkIng(w),w,pastOf(w)],`Après ${g}, on utilise to + base verbale (infinitif).`,'Grammar','cloze',`${S} ${form} ${correct}.`));
}
// ============ 11. Articles a/an (A1) ============
const NOUNS=`apple egg orange umbrella hour honest|man university European uniform unit one-eyed|cat engineer artist actor architect elephant ice-cream island idea animal answer office old|man hospital teacher doctor student book pen table chair school house car bus bike phone computer lesson question story letter ticket window door teacher|boy girl|woman lamp mine laboratory generator battery engine hour exam essay email interview umbrella MP3|player`.split(/\s+/);
const NOUNL=['apple','egg','orange','umbrella','hour','honest man','university','European country','uniform','unit','cat','engineer','artist','actor','architect','elephant','ice cream','island','idea','animal','answer','office','old man','hospital','teacher','doctor','student','book','pen','table','chair','school','house','car','bus','bike','phone','computer','lesson','question','story','letter','ticket','window','door','boy','girl','lamp','mine','laboratory','generator','battery','engine','exam','essay','email','interview','umbrella','useful tool','one-hour lesson','honest answer','university student','MBA student','x-ray','unusual idea','hotel','hour','orange car','engineer from Mali','interesting book'];
for(const n of [...new Set(NOUNL)]){
  const w=n.split(' ')[0]; let an=vowelSound(w); if(/^(x-ray|MBA)/.test(n))an=true; if(/^(one-hour|hotel|European|university|uniform|unit|useful)/.test(n))an=false; if(/^(hour|honest)/.test(w))an=true;
  const art=an?'an':'a';
  for(const f of [`It is ___ ${n}.`,`This is ___ ${n}.`,`There is ___ ${n} here.`,`I saw ___ ${n} there.`,`Is this ___ ${n}?`]){
    add(mk(1,'Complete with the correct indefinite article: '+f,art,[an?'a':'an','some','many'].filter(x=>x!==art).concat(['two']),`On met « an » devant un SON de voyelle et « a » devant un son de consonne (ici : ${n.split(' ')[0]}).`,'Grammar','cloze',f.replace('___',art)));
  }
}
module.exports=out;
