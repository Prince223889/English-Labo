'use strict';
// PRNG déterministe
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(20261013);
const pick = a => a[Math.floor(rnd()*a.length)];
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const sample = (a,n)=>shuffle(a).slice(0,n);

// ---------- Conjugaison ----------
const DOUBLE = new Set('stop plan run sit swim get put begin shop hit cut win set let forget drop chat jog admit prefer refer occur regret commit submit wrap skip slip trip step tap clap hug hop rob stir drag travel dig bet shut'.split(' '));
const cons = c => /[bcdfghjklmnpqrstvwxz]/.test(c);
function s3(b){ if(/(s|x|z|ch|sh|o)$/.test(b)) return b+'es'; if(/[bcdfghjklmnpqrstvwxz]y$/.test(b)) return b.slice(0,-1)+'ies'; return b+'s'; }
function ing(b){ if(b==='be')return 'being'; if(/ie$/.test(b)) return b.slice(0,-2)+'ying'; if(DOUBLE.has(b)) return b+b[b.length-1]+'ing'; if(/e$/.test(b)&&!/(ee|ye|oe)$/.test(b)) return b.slice(0,-1)+'ing'; return b+'ing'; }
function reg(b){ if(/e$/.test(b)) return b+'d'; if(/[bcdfghjklmnpqrstvwxz]y$/.test(b)) return b.slice(0,-1)+'ied'; if(DOUBLE.has(b)) return b+b[b.length-1]+'ed'; return b+'ed'; }
// "base:past:pp:fr:lvl"  ('+' = régulier)
function parseVerbs(str){ return str.trim().split(/\n+/).map(l=>{ const [b,p,pp,fr,lv]=l.trim().split(':'); const past=p==='+'?reg(b):p, part=pp==='+'?reg(b):pp; return {base:b,past,pp:part,fr,lvl:+lv,s3:s3(b),ing:ing(b),irregular:past!==reg(b)||part!==reg(b)}; }); }

// ---------- Construction d'une question ----------
// lvl: 1..5 (A1..C1)
function mk(lvl,q,correct,wrongs,expl,cat,kind,say){
  const ws=[...new Set(wrongs.filter(w=>w&&w!==correct))];
  if(ws.length<3||!q||!correct) return null;
  const opts=shuffle([correct,...ws.slice(0,3)]);
  return {lvl,q,opts,a:opts.indexOf(correct),expl,cat,kind:kind||'other',say:say||''};
}
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
const vowelSound = w => /^(a|e|i|o|u)/i.test(w) && !/^(uni|use|eu|one|ubiq|uti)/i.test(w) || /^(hour|honest|honou?r|heir)/i.test(w);

module.exports={rnd,pick,shuffle,sample,parseVerbs,s3,ing,reg,mk,cap,vowelSound,DOUBLE};
