'use strict';
const {rnd,pick,shuffle,sample,mk,cap}=require('./lib.cjs');
const {VERBS,V}=require('./data-verbs.cjs');
const D=require('./data-vocab.cjs'), L=require('./data-lexis.cjs');
const out=[]; const add=q=>{if(q)out.push(q);};
const toks=s=>s.toLowerCase().replace(/\(.*?\)/g,'').split(/[^a-zàâçéèêëîïôûùüÿœ'’-]+/).filter(x=>x.length>2);
const shares=(a,b)=>{const A=new Set(toks(a));return toks(b).some(x=>A.has(x));};
// ---- Vocabulaire EN<->FR ----
const NOUNFR=new Set(['mère','père','frère','livre','sucre','âge','cadre','théâtre','arbre','autobus']);
const isVerbFR=fr=>/^(se |s’|s')/.test(fr)||(!NOUNFR.has(fr.split(' ')[0])&&/(er|ir|re|dre)(?!.*\b(un|une|de la)\b)/.test(fr.split(' ')[0].replace(/ère$/,'x'))&&/(er|ir|re)$/.test(fr.split(' ')[0].replace(/ère$/,'x')));
D.VOCAB.forEach(v=>{v.k=isVerbFR(v.fr)?'v':'n';});
const byLvl={}; D.VOCAB.forEach(v=>(byLvl[v.lvl]=byLvl[v.lvl]||[]).push(v));
const pool=l=>[...(byLvl[l]||[]),...(byLvl[l-1]||[]),...(byLvl[l+1]||[])];
for(const v of D.VOCAB){
  const dis=shuffle(pool(v.lvl).filter(o=>o.k===v.k&&o.w!==v.w&&o.fr!==v.fr&&!shares(o.fr,v.fr)));
  add(mk(v.lvl,`What does “${v.w}” mean in French?`,v.fr,dis.slice(0,4).map(o=>o.fr),`« ${v.w} » se traduit par « ${v.fr} ».`,'Vocabulary','vocab_enfr',v.w));
  const dis2=shuffle(pool(v.lvl).filter(o=>o.k===v.k&&o.w!==v.w&&o.fr!==v.fr&&!shares(o.fr,v.fr)&&!shares(o.w,v.w)));
  add(mk(v.lvl,`Which English word means “${v.fr}”?`,v.w,dis2.slice(0,4).map(o=>o.w),`« ${v.fr} » se dit « ${v.w} » en anglais.`,'Vocabulary','vocab_fren',v.w));
}
// ---- Synonymes / contraires ----
const SYNP=D.SYN.map(x=>x[1]), ANTP=D.ANT.map(x=>x[1]);
for(const [w,s,l] of D.SYN){
  const bad=shuffle(SYNP.filter(x=>x!==s&&x!==w));
  add(mk(l,`Choose the word closest in meaning to “${w}”.`,s,bad.slice(0,4),`« ${w} » et « ${s} » sont des synonymes.`,'Vocabulary','meaning',`${w}. ${s}.`));
  const bad2=shuffle(SYNP.concat(ANTP).filter(x=>x!==w&&x!==s));
  add(mk(l,`Which word is a synonym of “${s}”?`,w,bad2.slice(0,4),`« ${s} » et « ${w} » ont un sens proche.`,'Vocabulary','meaning',`${s}. ${w}.`));
}
for(const [w,a,l] of D.ANT){
  const bad=shuffle(ANTP.filter(x=>x!==a&&x!==w));
  add(mk(l,`What is the opposite of “${w}”?`,a,bad.slice(0,4),`Le contraire de « ${w} » est « ${a} ».`,'Vocabulary','meaning',`${w}. ${a}.`));
  add(mk(l,`Which word is the opposite of “${a}”?`,w,shuffle(ANTP.concat(SYNP).filter(x=>x!==w&&x!==a)).slice(0,4),`Le contraire de « ${a} » est « ${w} ».`,'Vocabulary','meaning',`${a}. ${w}.`));
}
// ---- Orthographe ----
for(const [c,a,b,d,l] of D.SPELL){ add(mk(l,'Which word is spelled correctly?',c,[a,b,d],`L'orthographe correcte est « ${c} ».`,'Spelling','other',c)); add(mk(l,`Choose the correct spelling: “${c.charAt(0)}…”`,c,[a,b,d],`Attention à l'orthographe : ${c}.`,'Spelling','other',c)); }
// ---- Formation de mots ----
for(const [q,c,w,l] of L.WF) add(mk(l,q,c,w,`Choisis la bonne catégorie de mot (nom, adjectif, adverbe, verbe) : ici « ${c} ».`,'Word forms','cloze',q.replace(/\s*\(.*?\)\s*$/,'').replace('___',c)));
// ---- Phrasal verbs ----
const PVM=L.PV.map(x=>x[1]);
for(const [pv,m,ex,l] of L.PV){
  add(mk(l,`What does the phrasal verb “${pv}” mean?`,m,shuffle(PVM.filter(x=>x!==m&&!shares(x,m))).slice(0,4),`« ${pv} » signifie « ${m} ».`,'Phrasal verbs','meaning',pv));
  const wr=shuffle(L.PV.filter(x=>x[0]!==pv&&!shares(x[1],m))).slice(0,4).map(x=>x[0]);
  add(mk(l,ex,pv,wr,`Phrasal verb : ${pv} = ${m}.`,'Phrasal verbs','cloze',ex.replace('___',pv)));
}
// ---- Collocations ----
const CV=['make','do','take','have','get','give','pay','keep','break','catch','tell','win','hold','meet','solve','run','spread','reach','draw','face','score','deliver','lodge'];
for(const [n,v,l] of L.COLL){
  const validAlt=new Set(L.COLL.filter(x=>x[0]===n).map(x=>x[1]));
  const common=['make','do','take','have','get','give','keep','break'].filter(x=>!validAlt.has(x));
  const wr=shuffle(common).slice(0,3);
  add(mk(l,`Complete the collocation: ___ ${n}`,v,wr,`Collocation : ${v} ${n}. En anglais, certains verbes vont ensemble par habitude.`,'Vocabulary','cloze',`${v} ${n}`));
}
// ---- Faux amis ----
for(const [en,ok,fa,o1,o2,l] of L.FF){
  add(mk(l,`What does the English word “${en}” really mean?`,ok,[fa,o1,o2],`Faux ami ! « ${en} » veut dire « ${ok} », pas « ${fa} ».`,'Vocabulary','vocab_enfr',en));
}
// ---- Idiomes ----
const IM=L.IDIOM.map(x=>x[1]);
for(const [e,m,l] of L.IDIOM){ add(mk(l,`What does “${e}” mean?`,m,shuffle(IM.filter(x=>x!==m)).slice(0,4),`« ${e} » : ${m}.`,'Idioms','meaning',e)); }
module.exports=out;
