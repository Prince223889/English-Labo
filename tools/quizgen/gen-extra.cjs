'use strict';
const {rnd,pick,shuffle,sample,mk,cap,s3}=require('./lib.cjs');
const {V,VP,PV}=require('./data-verbs.cjs');
const out=[]; const add=q=>{if(q)out.push(q);};
const lc=s=>s.charAt(0).toLowerCase()+s.slice(1);
// sujets avec pronom pour les tags
const SUB=[['He','he',1],['She','she',1],['My brother','he',1],['My mother','she',1],['Moussa','he',1],['Fatoumata','she',1],['The students','they',0],['My parents','they',0],['We','we',0],['They','they',0],['You','you',0],['Our neighbours','they',0]];
const SUB3=SUB.filter(x=>x[2]===1), SUBP=SUB.filter(x=>x[2]===0);
const MARK=['every day','on Sundays','after school','in the evening'], PAST=['yesterday','last week','last night','two days ago'];
// ---- Question tags (B1) ----
for(const [vb,obj] of VP){ const v=V[vb];
  for(const [S,pr,t] of sample(SUB,5)){
    const m=pick(MARK);
    const neg=t?'doesn’t':'don’t', wneg=t?'don’t':'doesn’t';
    add(mk(3,`${S} ${t?v.s3:v.base} ${obj} ${m}, ___ ${pr}?`.replace(' ___ ',', ___ ').replace(',, ',', '),`${neg} ${pr}`,[`${t?'does':'do'} ${pr}`,`${wneg} ${pr}`,`${t?'isn’t':'aren’t'} ${pr}`],`Question tag : phrase affirmative → tag négatif avec le même auxiliaire (do/does).`,'Grammar','cloze'));
  }
  for(const [S,pr,t] of sample(SUB,3)){
    const m=pick(PAST);
    add(mk(3,`${S} ${v.past} ${obj} ${m}, ___ ${pr}?`,`didn’t ${pr}`,[`did ${pr}`,`don’t ${pr}`,`wasn’t ${pr}`],`Question tag : passé simple affirmatif → didn’t + pronom.`,'Grammar','cloze'));
  }
  for(const [S,pr,t] of sample(SUB,2)){
    const m=pick(MARK);
    add(mk(3,`${S} ${t?"doesn’t":"don’t"} ${v.base} ${obj} ${m}, ___ ${pr}?`,`${t?'does':'do'} ${pr}`,[`${t?'doesn’t':'don’t'} ${pr}`,`${t?'do':'does'} ${pr}`,`${t?'is':'are'} ${pr}`],`Question tag : phrase négative → tag affirmatif.`,'Grammar','cloze'));
  }
}
// ---- Inversion avec adverbes négatifs (B2/C1) ----
const NAMEOK=/^(I|Moussa|Fatoumata|Awa)$/;
const SL=S=>NAMEOK.test(S)?S:lc(S);
const ADVP=['Rarely','Seldom','Never'];
for(const [vb,obj] of VP){ const v=V[vb];
  for(const [S,pr,t] of sample(SUB,3)){ const a=pick(ADVP), sl=SL(S), aux=t?'does':'do', bad=t?'do':'does';
    add(mk(5,`${a} ___ ${obj}. (subject: ${sl})`,`${aux} ${sl} ${v.base}`,[`${sl} ${t?v.s3:v.base}`,`${aux} ${sl} ${t?v.s3:v.past}`,`${sl} ${aux} ${v.base}`],`Après ${a.toLowerCase()} en début de phrase : inversion auxiliaire + sujet + base verbale.`,'Grammar','cloze',`${a} ${aux} ${sl} ${v.base} ${obj}.`));
  }
  for(const [S,pr,t] of sample(SUB,2)){ const sl=SL(S), h=t?'has':'have';
    add(mk(4,`Never ___ ${obj}. (subject: ${sl})`,`${h} ${sl} ${v.pp}`,[`${sl} ${h} ${v.pp}`,`${h} ${sl} ${v.past===v.pp?v.base:v.past}`,`did ${sl} ${v.pp}`],`Never en début de phrase avec un présent parfait : inversion have/has + sujet + participe passé.`,'Grammar','cloze',`Never ${h} ${sl} ${v.pp} ${obj}.`));
  }
}
// ---- Futur parfait (B2) ----
const FP=['next year','next month','2030','the end of the week','next June'];
for(const [vb,obj] of VP){ const v=V[vb];
  for(const [S] of sample(SUB,3)){ const m=pick(FP), sl=SL(S);
    add(mk(4,`By ${m}, ${sl} ___ ${obj}.`,`will have ${v.pp}`,[`will have ${v.base}`,`has ${v.pp}`,`would have ${v.pp}`],`Futur antérieur : will have + participe passé (action achevée avant un moment futur).`,'Tenses','cloze',`By ${m}, ${sl} will have ${v.pp} ${obj}.`));
  }
}
// ---- should have + participe passé (B2) ----
for(const [vb,obj] of VP){ const v=V[vb];
  for(const [S] of sample(SUB,2)){
    add(mk(4,`${S} ___ ${obj}, but it was too late.`,`should have ${v.pp}`,[`should ${v.pp}`,`should has ${v.pp}`,`should have ${v.base}`],`Regret ou reproche sur le passé : should have + participe passé.`,'Grammar','cloze',`${S} should have ${v.pp} ${obj}, but it was too late.`));
  }
}
// ---- Causatif have something done (B2) ----
for(const p of PV){ const v=p.v;
  for(const [S] of sample(SUB3,2)){ add(mk(4,`${S} had ${p.o} ___ yesterday.`,v.pp,[v.base,v.ing,v.past===v.pp?v.s3:v.past],`Causatif : have + objet + participe passé (faire faire quelque chose).`,'Grammar','cloze')); }
  add(mk(5,`The manager is going to have ${p.o} ___ next week.`,v.pp,[v.base,v.ing,v.s3],`Causatif : have + objet + participe passé.`,'Grammar','cloze'));
}
// ---- Passif avec modal parfait (C1) ----
for(const p of PV){ const v=p.v;
  for(const [mod,rule] of [['should have been','should have been + pp'],['could have been','could have been + pp'],['must have been','must have been + pp'],['might have been','might have been + pp']]){
    add(mk(5,`${cap(p.o)} ${mod} ___ by ${p.a}.`,v.pp,[v.base,v.ing,v.past===v.pp?v.s3:v.past],`Passif au modal parfait : ${rule}.`,'Grammar','cloze'));
  }
}
// ---- Pronoms relatifs (B1) ----
const PERS=['man','woman','teacher','student','engineer','doctor','girl','boy'];
for(const [vb,obj] of VP){ const v=V[vb];
  for(const n of sample(PERS,4)){ add(mk(3,`The ${n} ___ ${v.s3} ${obj} is my friend.`,'who',['which','whose','where'],`Pour une personne sujet, on utilise « who » (ou that).`,'Grammar','cloze',`The ${n} who ${v.s3} ${obj} is my friend.`)); }
}
// ---- Wish / if only (B2) ----
for(const [vb,obj] of VP){ const v=V[vb];
  add(mk(4,`I wish I ___ ${obj} yesterday.`,`had ${v.pp}`,[`${v.past}`,`have ${v.pp}`,`would ${v.base}`].filter(x=>x!==`had ${v.pp}`),`I wish + plus-que-parfait = regret sur le passé.`,'Grammar','cloze'));
}
// ---- Phrases rédigées : used to, so/such, too/enough, reported verbs (B1-C1) ----
const A=[
[3,'When I was a child, I ___ play football every day.','used to',['am used to','was used to','use to'],'used to + base = habitude passée.'],
[3,'She is not ___ to waking up early.','used',['use','using','used to'],'be used to + -ing = être habitué à.'],
[4,'It took me a long time to get ___ to the heat.','used',['use','using','usual'],'get used to + nom / -ing = s’habituer à.'],
[3,'The exam was ___ difficult that nobody finished.','so',['such','too','very much'],'so + adjectif + that.'],
[3,'It was ___ a difficult exam that nobody finished.','such',['so','too','very'],'such + a + adjectif + nom + that.'],
[3,'The box is ___ heavy for me to carry.','too',['enough','so','very much'],'too + adjectif + to = trop … pour.'],
[3,'He is not old ___ to drive.','enough',['too','so','such'],'adjectif + enough = assez … (après l’adjectif).'],
[4,'The teacher advised us ___ more.','to read',['reading','read','that we reading'],'advise + objet + to + base.'],
[4,'She admitted ___ the window.','breaking',['to break','break','to breaking'],'admit + -ing.'],
[4,'He denied ___ the money.','taking',['to take','take','to taking'],'deny + -ing.'],
[4,'They warned us ___ the river.','not to cross',['do not cross','to not crossing','not crossing'],'warn + objet + (not) to + base.'],
[4,'She promised ___ me the next day.','to call',['calling','call','that calling'],'promise + to + base.'],
[4,'He accused her ___ lying.','of',['for','about','to'],'accuse somebody of + -ing.'],
[4,'We apologised ___ being late.','for',['of','to','about'],'apologise for + -ing.'],
[4,'I look forward ___ you.','to seeing',['to see','seeing','to saw'],'look forward to + -ing (to est une préposition).'],
[3,'She asked me ___ I wanted tea or coffee.','whether',['that','what if','why'],'whether … or = si … ou.'],
[3,'The teacher is ___ than all the others.','more patient',['patienter','most patient','patient more'],'Comparatif des adjectifs longs : more + adjectif.'],
[3,'He works as ___ as he can.','hard',['hardly','harder','hardest'],'as + adjectif/adverbe + as : forme de base.'],
[3,'She is not as tall ___ her sister.','as',['than','that','like'],'not as … as.'],
[3,'The more you practise, ___ you speak.','the better',['better','best','the best'],'The + comparatif … the + comparatif.'],
[4,'Hardly had she arrived ___ the phone rang.','when',['than','that','while'],'Hardly … when.'],
[4,'No sooner had he left ___ it started to rain.','than',['when','that','as'],'No sooner … than.'],
[4,'I’d rather you ___ here tonight.','stayed',['stay','staying','to stay'],'would rather + sujet + passé simple.'],
[3,'Neither Ali ___ Mariam was late.','nor',['or','and','but'],'neither … nor.'],
[3,'Either you leave now ___ you stay until the end.','or',['nor','and','but'],'either … or.'],
[3,'Not only did he win, ___ he also broke the record.','but',['and','so','while'],'not only … but also.'],
[3,'___ the rain, we played football.','Despite',['Although','Because','Whereas'],'Despite + nom = malgré.'],
[3,'___ it was raining, we played football.','Although',['Despite','Because of','In spite'],'Although + sujet + verbe.'],
[3,'He is rich, ___ his brother is poor.','whereas',['despite','because','unless'],'whereas = alors que (contraste).'],
[3,'You will fail ___ you study harder.','unless',['if','when','because'],'unless = à moins que / sauf si.'],
[4,'___ you need help, call me.','Should',['Would','Could','Might'],'Should you need = If you need.'],
[4,'I suggest you ___ a doctor.','see',['seeing','to see','saw'],'suggest (that) you + base ; ou suggest + -ing.'],
[3,'There ___ a lot of people at the market yesterday.','were',['was','is','are'],'There were + pluriel (passé).'],
[2,'There ___ some water in the bottle.','is',['are','be','am'],'There is + indénombrable.'],
[2,'There ___ three chairs in the room.','are',['is','be','am'],'There are + pluriel.'],
[2,'This is ___ than that one.','better',['more good','gooder','best'],'good – better – best.'],
[2,'I have ___ been to Paris.','never',['ever not','not never','no ever'],'never = jamais (avec le présent parfait).'],
[2,'Have you ___ visited Timbuktu?','ever',['never','yet','already no'],'ever dans les questions au présent parfait.'],
[3,'I have lived here ___ 2015.','since',['for','from','during'],'since + point de départ.'],
[3,'I have lived here ___ ten years.','for',['since','from','during'],'for + durée.'],
[3,'She has ___ finished her homework.','just',['yet','since','ago'],'just = à l’instant (présent parfait).'],
[3,'Have you finished ___ ?','yet',['already','just','ago'],'yet dans les questions / négations.'],
[3,'He left two hours ___ .','ago',['before','since','for'],'ago + passé simple.'],
[3,'While I ___ TV, the phone rang.','was watching',['watched','am watching','have watched'],'while + passé continu.'],
[3,'I ___ him yesterday at the market.','saw',['have seen','see','was see'],'yesterday → passé simple.'],
[4,'By the time we arrived, the film ___ .','had started',['has started','started','was start'],'Plus-que-parfait pour l’action antérieure.'],
[4,'If I ___ you, I would apologise.','were',['am','was being','be'],'If I were you = à ta place.'],
[4,'This is the best film I ___ seen.','have ever',['had ever','am ever','did ever'],'superlatif + present perfect with ever.'],
[4,'She is ___ intelligent student in the class.','the most',['more','most','the more'],'the most + adjectif long.'],
[5,'Little did he realise that the plan ___ fail.','would',['will','is','was'],'Futur dans le passé : would.'],
[5,'Not only ___ the exam, she also won a prize.','did she pass',['she passed','she did pass','passed she'],'Not only + inversion.'],
[5,'The report, ___ was published last week, caused debate.','which',['who','whose','where'],'Proposition relative non déterminative : which.'],
[5,'The scientist, ___ research I admire, is visiting us.','whose',['who','which','that'],'whose + nom = dont (possession).'],
[5,'It is high time the government ___ action.','took',['takes','take','will take'],'It’s high time + passé simple.'],
[5,'I would have gone if I ___ known.','had',['have','would have','did'],'Type 3 : if + had + participe.']
];
A.forEach(([l,q,c,w,e])=>add(mk(l,q,c,w,e,'Grammar','cloze',q.replace('___',c))));
module.exports=out;
