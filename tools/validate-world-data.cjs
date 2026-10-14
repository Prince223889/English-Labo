'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const ctx={window:{}}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','world-data.js'),'utf8'),ctx);
const W=ctx.window.EA_WORLD; let bad=0; const fail=m=>{bad++;console.error('✗',m);};
const mcq=(o,id)=>{ if(!Array.isArray(o.options)||o.options.length!==4||new Set(o.options).size!==4)fail(id+' options'); if(!Number.isInteger(o.answer)||o.answer<0||o.answer>3)fail(id+' answer'); if(!o.explanation)fail(id+' explication'); };
const ids=new Set(); const uniq=(id)=>{if(ids.has(id))fail('id en double '+id);ids.add(id);};
if(W.cases.length<8)fail('enquêtes < 8');
for(const c of W.cases){ uniq(c.id); if(c.suspects.length!==4)fail(c.id+' suspects'); if(!c.suspects.some(s=>s.id===c.culprit))fail(c.id+' culprit'); if(c.clues.length<5)fail(c.id+' indices'); c.clues.forEach(cl=>{ if(!cl.q)fail(c.id+' q'); else mcq({options:cl.q.options,answer:cl.q.answer,explanation:cl.q.explanation},c.id+'/'+cl.id); }); if(!c.deduction||c.deduction.length<3)fail(c.id+' deduction'); }
if(W.traps.length<60)fail('pièges < 60'); W.traps.forEach(t=>{uniq(t.id);mcq(t,t.id);});
if(W.riddles.length<35)fail('énigmes < 35'); W.riddles.forEach(t=>{uniq(t.id);mcq(t,t.id);});
if(W.speaking.length<40)fail('défis oraux < 40'); W.speaking.forEach(s=>{uniq(s.id); if(s.keywords.length<5||!s.prompt)fail(s.id);});
if(W.events.length<25)fail('événements < 25'); W.events.forEach(e=>{uniq(e.id); if(!['bonus','malus','powerup','swap','teleport'].includes(e.kind))fail(e.id);});
if(W.passages.length<10)fail('lectures < 10'); W.passages.forEach(p=>{uniq(p.id); if(p.qs.length!==3)fail(p.id); p.qs.forEach((q,i)=>mcq({options:q.options,answer:q.answer,explanation:q.explanation},p.id+'/'+i));});
if(bad){console.error(bad+' problème(s)');process.exit(1);} console.log(`OK : ${W.cases.length} enquêtes, ${W.traps.length} pièges, ${W.riddles.length} énigmes, ${W.speaking.length} défis oraux, ${W.events.length} événements, ${W.passages.length} lectures`);
