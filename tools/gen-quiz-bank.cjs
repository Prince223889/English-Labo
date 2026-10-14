'use strict';
// Génère data/quiz/{A1..C1}.json — déterministe. Lancer : node tools/gen-quiz-bank.cjs
const fs=require('fs'), path=require('path');
const {rnd}=require('./quizgen/lib.cjs');
const parts=[require('./quizgen/gen-grammar.cjs'),require('./quizgen/gen-more.cjs').out,require('./quizgen/gen-lexis.cjs'),require('./quizgen/gen-comm.cjs'),require('./quizgen/gen-extra.cjs')];
let extra=[]; try{ extra=require('./quizgen/gen-c1.cjs'); }catch(e){ if(e.code!=='MODULE_NOT_FOUND')throw e; }
const seen=new Set(), all=[];
for(const q of [...parts.flat(),...extra]){ if(!q)continue; const k=q.q.toLowerCase().replace(/\s+/g,' ').trim(); if(seen.has(k))continue; seen.add(k); all.push(q); }
const L=['A1','A2','B1','B2','C1'], outDir=path.join(__dirname,'..','data','quiz'); fs.mkdirSync(outDir,{recursive:true});
// mélange déterministe puis équilibrage des positions de réponse
function shuffleDet(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const index={total:0,levels:{},categories:{}};
L.forEach((name,i)=>{
  const qs=shuffleDet(all.filter(q=>q.lvl===i+1));
  // équilibrage : répartition cyclique des positions de la bonne réponse
  qs.forEach((q,n)=>{ const target=n%4; if(q.a!==target){ const o=q.opts.slice(); const c=o[q.a]; o.splice(q.a,1); o.splice(target,0,c); q.opts=o; q.a=target; } });
  const rows=qs.map(q=>[q.q,q.opts,q.a,q.expl,q.cat,q.kind,q.say||'']);
  fs.writeFileSync(path.join(outDir,name+'.json'),JSON.stringify({level:name,v:1,q:rows}));
  index.levels[name]=rows.length; index.total+=rows.length;
  rows.forEach(r=>{index.categories[r[4]]=(index.categories[r[4]]||0)+1;});
});
fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify(index,null,1));
console.log('Banque générée :',index.total,'questions',JSON.stringify(index.levels));
console.log(JSON.stringify(index.categories));
