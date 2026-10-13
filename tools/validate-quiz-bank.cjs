'use strict';
const fs=require('fs'), path=require('path');
const dir=path.join(__dirname,'..','data','quiz'); let bad=0, total=0; const seen=new Set(); const pos=[0,0,0,0];
const MIN={A1:1800,A2:2200,B1:2400,B2:2000,C1:1600};
const fail=m=>{bad++; if(bad<40)console.error('✗',m);};
for(const L of Object.keys(MIN)){
  const f=path.join(dir,L+'.json'); if(!fs.existsSync(f)){fail('fichier manquant '+L);continue;}
  const d=JSON.parse(fs.readFileSync(f,'utf8')); if(d.level!==L)fail('niveau '+L);
  if(fs.statSync(f).size>900*1024)fail(L+' trop gros');
  if(d.q.length<MIN[L])fail(`${L}: ${d.q.length} < ${MIN[L]}`);
  d.q.forEach((r,i)=>{ total++;
    const [q,o,a,e,c,k,s]=r, id=L+'#'+i;
    if(typeof q!=='string'||q.length<8||q.length>260)fail(id+' question invalide');
    if(!Array.isArray(o)||o.length!==4)fail(id+' options');
    else{ if(new Set(o.map(x=>String(x).trim())).size!==4)fail(id+' options en double: '+q); if(o.some(x=>!String(x).trim()))fail(id+' option vide'); }
    if(!Number.isInteger(a)||a<0||a>3)fail(id+' index'); else pos[a]++;
    if(!e||e.length<8)fail(id+' explication'); if(!c)fail(id+' catégorie');
    if(!['cloze','vocab_enfr','vocab_fren','meaning','other'].includes(k))fail(id+' kind');
    if(k==='cloze'&&!/_{3}/.test(q)&&!/Collocation|collocates|Complete the collocation|___/.test(q))fail(id+' cloze sans blanc: '+q);
    const key=q.toLowerCase().replace(/\s+/g,' ').trim(); if(seen.has(key))fail(id+' doublon: '+q); seen.add(key);
    if(o&&o[a]&&/___/.test(q)&&/[A-Za-z]/.test(q)&&q.includes(o[a])&&false)fail(id);
  });
}
if(total<10000)fail('total < 10000: '+total);
const mx=Math.max(...pos), mn=Math.min(...pos); if(mx-mn>total*0.05)fail('positions déséquilibrées '+pos);
if(bad){console.error(`\n${bad} problème(s).`);process.exit(1);} console.log(`OK : ${total} questions valides · positions ${pos.join('/')}`);
