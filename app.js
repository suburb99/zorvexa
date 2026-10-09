const $=s=>document.querySelector(s);
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
const S={projects:LS.get('zx_projects',[]),cur:LS.get('zx_cur',null),key:LS.get('zx_key',''),model:LS.get('zx_model',''),theme:LS.get('zx_theme','light'),file:null,cm:LS.get('zx_cm',[]),all:LS.get('zx_all',false),ci:LS.get('zx_ci',''),af:LS.get('zx_af',true),plan:LS.get('zx_plan',true)};
let busy=false,EDIT=null,LOGS=[],PEND=[],IMG=false,VIS=new Set(),PM='build',AC=null,FREE=[],ALL=[],ERRS=[],LT=0,FT=0,AUTO=false,LASTERR='';
const SYS=`You are Zorvexa, an expert front-end engineer who turns plain-English requests into working web apps.
Reply format: one or two plain sentences saying what you built or changed, then every file you created or changed, complete, each inside <file name="index.html">...</file>. No markdown code fences. Nothing after the files.
Rules:
- Default to ONE self-contained index.html with inline CSS and JS. Add other files only if asked.
- Write complete, working code. Never leave placeholders, TODOs, or "rest of code here".
- Mobile-first and responsive. Modern, polished design: clear type scale, generous spacing, consistent radius, strong contrast, tap targets of 44px or more.
- The app runs in a sandboxed iframe, so localStorage can throw. Wrap storage in try/catch with an in-memory fallback. No external network calls except scripts from cdnjs.cloudflare.com.
- When editing, keep everything the user did not ask to change, and return each changed file in full.
- If the user attaches an image, treat it as the design reference and match its layout, colors, text, and structure closely.
- If the request is vague, make a sensible choice and say what you chose in your sentence.`;
const DSYS=`You are Zorvexa, a sharp, friendly senior engineer and product partner. In this mode you talk: answer questions, explain how things work, compare options, and help the user shape their idea. Lead with the answer, keep it concise and concrete, and use short lists or a small code snippet only when they help. Ask at most one clarifying question. Never write full files or use <file> tags. If the user attaches an image, look at it and use it in your answer. When the idea is clear, tell the user they can say "build it".`;
const ERRJS='<script>(function(){function P(o){try{parent.postMessage(o,"*")}catch(e){}}function s(m){P({zx:1,msg:String(m).slice(0,300)})}addEventListener("error",function(e){s(e.message)});addEventListener("unhandledrejection",function(e){s("Unhandled promise: "+(e.reason&&e.reason.message||e.reason))});["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){P({zx:2,lvl:k,msg:[].map.call(arguments,function(a){try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)}}).join(" ").slice(0,500)});o.apply(console,arguments)}})})()<\/script>';
const IDEAS=['A tip calculator with a split-bill option','A habit tracker with streaks','A pomodoro timer with a dark mode'];

function slim(ms){return ms.map(({imgs,pre,...m})=>m)}
function save(){const pack=()=>S.projects.map(p=>({...p,msgs:slim(p.msgs)}));let ok=LS.set('zx_projects',pack());for(let k=0;!ok&&k<80;k++){const q=S.projects.filter(p=>p.vers&&p.vers.length).sort((a,b)=>b.vers.length-a.vers.length)[0];if(!q)break;q.vers.shift();ok=LS.set('zx_projects',pack())}if(!ok)toast('Storage is full. Export and delete old projects.');LS.set('zx_cur',S.cur)}
function proj(){return S.projects.find(p=>p.id===S.cur)}
function newProj(n){const p={id:Date.now().toString(36),name:n||'Untitled',msgs:[],files:{}};S.projects.push(p);save();return p}
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3500)}
function setTheme(t){S.theme=t;document.documentElement.dataset.theme=t;LS.set('zx_theme',t)}
function tab(t){const w=matchMedia('(min-width:1000px)').matches;if(w&&t==='chat')t=S.right||'prev';if(t!=='chat')S.right=t;document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id===t));document.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t))}

function row(p,cls){const b=document.createElement('div');b.className=cls+(p.id===S.cur?' on':'');b.innerHTML='<span></span><i data-a="r" title="Rename">✎</i><i data-a="e" title="Export">↓</i><i data-a="d" title="Delete">×</i>';b.firstChild.textContent=p.name;b.onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(a==='d')return delProj(p.id);if(a==='e')return exportProj(p.id);if(a==='r')return askName('rename',p.id);openProj(p.id)};return b}
function renderProjects(){
  const l=$('#plist'),h=$('#hlist');l.innerHTML='';h.innerHTML='';
  S.projects.slice().reverse().forEach(p=>{l.appendChild(row(p,'pi'));h.appendChild(row(p,'pi hc'))});
  if(!S.projects.length)h.innerHTML='<p>No projects yet. Tap New project to start.</p>';
  $('#ptitle').textContent=proj()?proj().name:'Projects';
}
function renderChat(){
  const l=$('#log');l.innerHTML='';const p=proj();if(!p)return;
  if(!p.msgs.length){
    l.innerHTML='<div class="empty"><div class="mark">Z</div><h2>What should we build?</h2><p>Describe an app. Zorvexa writes it, runs it, and shows you the code.</p><div class="ideas"></div></div>';
    IDEAS.forEach(t=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{$('#inp').value=t;$('#inp').focus()};l.querySelector('.ideas').appendChild(b)});
  }
  p.msgs.forEach((m,i)=>{act(addMsg(m.role==='user'?'u':'a',m.content,m.err,m.fl,m.md,m.imgs,m.ni),m,i,p)});
  l.scrollTop=l.scrollHeight;
}
function paint(b,note,files){if(b.dataset.a)b.innerHTML=md(note);else b.textContent=note;(files||[]).forEach(n=>{const c=document.createElement('span');c.className='chip';c.textContent=n;b.appendChild(c)})}
function addMsg(cls,text,err,fl,md,im,ni){const r=document.createElement('div');r.className='r '+cls;if(cls==='a')r.innerHTML='<div class="av">Z</div>';const d=document.createElement('div');d.className='m'+(err?' err':'');if(md)d.dataset.md=md;if(cls==='a')d.dataset.a=1;paint(d,text,fl);if(im&&im.length){const w=document.createElement('div');w.className='mi';im.forEach(u=>{const g=document.createElement('img');g.src=u;g.alt='';w.appendChild(g)});d.prepend(w)}else if(ni){const c=document.createElement('div');c.className='chip';c.textContent=ni+(ni>1?' images':' image')+' attached';d.prepend(c)}r.appendChild(d);$('#log').appendChild(r);$('#log').scrollTop=1e9;return d}
function renderFiles(){
  const p=proj()||{files:{}},names=Object.keys(p.files),f=$('#files');f.innerHTML='';
  if(!names.includes(S.file))S.file=names[0]||null;
  names.forEach(n=>{const b=document.createElement('button');b.textContent=n;b.className=n===S.file?'on':'';b.onclick=()=>{S.file=n;renderFiles()};f.appendChild(b)});
  $('#code').value=S.file?p.files[S.file]:'';
}
function build(files){
  let h=files['index.html']||files[Object.keys(files).find(n=>n.endsWith('.html'))];
  if(!h)return '';
  h=/<head[^>]*>/i.test(h)?h.replace(/<head[^>]*>/i,m=>m+ERRJS):ERRJS+h;
  h=h.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/g,(m,f)=>files[f]!=null?'<style>'+files[f]+'</style>':m);
  h=h.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/g,(m,a,f)=>files[f]!=null?'<script>'+files[f]+'<\/script>':m);
  return h;
}
function preview(){ERRS=[];LOGS=[];renderLogs();LT=Date.now();$('#errb').classList.remove('on');$('#frame').srcdoc=build((proj()||{files:{}}).files)||'<body style="font-family:sans-serif;padding:24px;color:#666">Nothing to preview yet. Build something first.</body>'}
function parse(t){
  t=t.replace(/<think>[\s\S]*?(<\/think>|$)/g,'');
  if(PM!=='build')return{files:{},note:t.trim()};
  const files={};
  const clean=c=>c.replace(/^\s*```[a-z]*\n/,'').replace(/\n?```\s*$/,'').replace(/\n$/,'');
  let note=t.replace(/<file name="([^"]+)">\n?([\s\S]*?)(?:<\/file>|$)/g,(m,n,c)=>{files[n.trim()]=clean(c);return ''}).replace(/<f[^>]*$/,'').trim();
  if(!Object.keys(files).length){const m=t.match(/```(?:html)?\n([\s\S]*?)(?:```|$)/);if(m&&/<(html|body|div|script)/i.test(m[1])){files['index.html']=m[1].replace(/\n$/,'');note=t.replace(m[0],'').trim()}}
  return{files,note};
}
function md(t){
  const e=x=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return e(t).replace(/```[a-z]*\n([\s\S]*?)(```|$)/g,'<pre><code>$1</code></pre>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/^#{1,4}[ \t]+(.+)$/gm,'<b>$1</b>').replace(/^[ \t]*[-*][ \t]+/gm,'• ');
}

const STRONG=/claude|gpt-5|gpt-4\.1|gpt-oss-120|\bo3\b|\bo4\b|gemini|deepseek|qwen3|qwen-3|qwq|kimi|glm|minimax|grok|llama-4|llama-3\.3-70|mistral-(large|medium)|devstral|codestral|nemotron|command-a|hermes-4|step|ernie|hunyuan/i;
const WEAK=/nano|tiny|micro|small|lite|embed|guard|moderat|audio|tts|image|search|haiku|mini|distill/i;
function strong(m,min){const z=(m.id+' '+m.name).match(/(\d+(?:\.\d+)?)\s?b\b/i);return STRONG.test(m.id)&&!WEAK.test(m.id+' '+m.name)&&!(z&&Number(z[1])<30)&&(m.context_length||0)>=min}
function buildSelect(){
  const sel=$('#model');
  VIS=new Set(ALL.filter(m=>m.architecture&&Array.isArray(m.architecture.input_modalities)&&m.architecture.input_modalities.includes('image')).map(m=>m.id));const isF=m=>m.pricing&&Number(m.pricing.prompt)===0&&Number(m.pricing.completion)===0;
  const nm=m=>m.name.replace(/\s*\(free\)/i,'');
  const ok=ALL.filter(m=>!m.architecture||!m.architecture.output_modalities||m.architecture.output_modalities.includes('text'));
  let free=ok.filter(isF).sort((a,b)=>(b.context_length||0)-(a.context_length||0));
  let paid=ok.filter(m=>!isF(m)&&m.pricing&&Number(m.pricing.prompt)>0);
  if(S.all)paid.sort((a,b)=>a.name.localeCompare(b.name));
  else{const f2=free.filter(m=>strong(m,32000));free=(f2.length?f2:free).slice(0,12);paid=paid.filter(m=>strong(m,100000)&&m.created*1000>Date.now()-540*864e5).sort((a,b)=>b.created-a.created).slice(0,24)}
  FREE=free.map(m=>m.id);
  sel.innerHTML='';
  const grp=(l,a,f)=>{if(!a.length)return;const g=document.createElement('optgroup');g.label=l;a.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=f(m);g.appendChild(o)});sel.appendChild(g)};
  grp('Free',free,m=>nm(m)+(VIS.has(m.id)?' · vision':''));
  grp('Paid (needs OpenRouter credit)',paid,m=>nm(m)+' · $'+(Number(m.pricing.prompt)*1e6).toFixed(2)+'/M in'+(VIS.has(m.id)?' · vision':''));
  grp('My models',S.cm.map(id=>({id})),m=>m.id);
  const all=[...FREE,...paid.map(m=>m.id),...S.cm];
  if(!all.includes(S.model)){S.model=all[0]||'';LS.set('zx_model',S.model)}
  sel.value=S.model;
}
async function loadModels(){
  try{const r=await fetch('https://openrouter.ai/api/v1/models');ALL=(await r.json()).data||[];if(!ALL.length)throw 0;buildSelect()}
  catch(e){$('#model').innerHTML='<option value="">Could not load models. Check your connection.</option>'}
}
async function call(messages,mode){
  const hd={'Authorization':'Bearer '+S.key,'Content-Type':'application/json','X-Title':'Zorvexa'};
  if(location.protocol.startsWith('http'))hd['HTTP-Referer']=location.origin;
  const ids=[S.model];
  if(FREE.includes(S.model))FREE.forEach(i=>{if(i!==S.model&&ids.length<3&&(!IMG||VIS.has(i)))ids.push(i)});
  let st=0,msg='';
  for(const id of ids){
    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:hd,signal:AC.signal,body:JSON.stringify({model:id,messages,stream:true,temperature:mode==='build'?0.3:0.7})});
    if(res.ok){if(id!==S.model)toast('Busy, switched to '+id.split('/').pop().replace(':free',''));return res}
    st=res.status;msg='';try{msg=(await res.json()).error.message}catch(e){}
    if(![404,408,429,500,502,503].includes(st))break;
  }
  if(st===401)throw new Error('OpenRouter rejected your key. Open Settings and paste it again.');
  if(st===429)throw new Error('Rate limited. '+(FREE.includes(S.model)?'Wait a minute or pick a paid model.':'Wait a moment and try again.'));
  if(st===402)throw new Error('This model needs credit on your OpenRouter account. Pick a free model or add credit.');
  throw new Error(msg||'Request failed ('+st+'). Try another model.');
}
function openSet(){$('#key').value=S.key;$('#ci').value=S.ci;$('#all').checked=S.all;$('#af').checked=S.af;$('#plan').checked=S.plan;renderCm();$('#dlg').showModal()}
function renderCm(){const l=$('#cml');l.innerHTML='';S.cm.forEach(id=>{const c=document.createElement('span');c.className='chip';c.textContent=id+'  ×';c.style.cursor='pointer';c.onclick=()=>{S.cm=S.cm.filter(x=>x!==id);LS.set('zx_cm',S.cm);renderCm();buildSelect()};l.appendChild(c)})}

async function send(forced){
  const inp=$('#inp');let text=inp.value.trim();if(!text&&PEND.length)text='Recreate what is in this image.';
  if(!text||busy)return;
  if(!S.key){openSet();return toast('Add your OpenRouter key first')}
  if(!S.model)return toast('No model selected yet');
  const p=proj();
  if(!p)return;
  if(!AUTO)FT=0;AUTO=false;if(EDIT!=null){cut(p,EDIT);EDIT=null}const imgs=PEND.slice();
  if(imgs.length&&VIS.size&&!VIS.has(S.model)&&!S.cm.includes(S.model)){const o=[...$('#model').options].find(o=>VIS.has(o.value));if(!o)return toast('No vision model available. Turn on Show every model in Settings.');S.model=o.value;LS.set('zx_model',S.model);$('#model').value=S.model;toast('Switched to a vision model to read your image')}
  IMG=imgs.length>0;
  p.msgs.push({role:'user',content:text,imgs:imgs.length?imgs:undefined,ni:imgs.length||undefined});PEND=[];renderPend();inp.value='';inp.style.height='44px';
  renderProjects();renderChat();
  let mode=forced||(S.mode==='auto'?detect(text,p):S.mode);if(mode==='build'&&!forced&&S.plan&&isBig(text,p))mode='plan';PM=mode;const md=mode==='build'?'Build mode':mode==='plan'?'Plan':'Discussion';const dumpAll=Object.entries(p.files).map(([n,c])=>'<file name="'+n+'">\n'+c+'\n</file>').join('\n');
  const pre=JSON.stringify(p.files);if(mode==='build')snap(p,'Manual edits');const dump=mode==='build'?dumpAll:dumpAll.slice(0,12000);const messages=[{role:'system',content:(mode==='build'?SYS:mode==='plan'?PSYS:DSYS)+(S.ci?'\n\nUser preferences (follow these): '+S.ci:'')+(p.mem?'\n\nProject memory (always follow): '+p.mem:'')},...p.msgs.slice(0,-1).filter(m=>!m.err).slice(-8).map(m=>({role:m.role,content:cont(m.content,m.imgs)})),{role:'user',content:cont(text+(dump?'\n\nCurrent files:\n'+dump:''),imgs)}];
  busy=true;$('#send').classList.add('stop');AC=new AbortController();
  const bub=addMsg('a','',false,null,md);bub.innerHTML='<span class="dots"><i></i><i></i><i></i></span>';let full='';
  try{
    const res=await call(messages,mode);
    const rd=res.body.getReader(),dec=new TextDecoder();let buf='',last=0;
    while(true){
      const{done,value}=await rd.read();if(done)break;
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop();
      for(const ln of lines){
        if(!ln.startsWith('data: '))continue;const d=ln.slice(6).trim();if(d==='[DONE]')continue;
        let j;try{j=JSON.parse(d)}catch(e){continue}
        if(j.error)throw new Error(j.error.message||'The model returned an error. Try another one.');
        const c=j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content;if(c)full+=c;
      }
      if(Date.now()-last>250){last=Date.now();const{files,note}=parse(full);if(note||Object.keys(files).length)paint(bub,note,Object.keys(files));if(Object.keys(files).length){Object.assign(p.files,files);renderFiles()}}
    }
    const{files,note}=parse(full);
    if(!Object.keys(files).length&&!note)throw new Error('The model sent nothing back. Try again or pick another model.');
    Object.assign(p.files,files);
    const reply=note||(Object.keys(files).length?'Done. Your app is ready.':'');
    const fl=Object.keys(files);p.msgs.push({role:'assistant',content:reply,fl,md,pre});paint(bub,reply,fl);if((mode==='discuss'||mode==='plan')&&reply){const gb=document.createElement('button');gb.className='chip go';gb.textContent=mode==='plan'?'Build it':'Build this';gb.onclick=()=>{gb.remove();$('#inp').value=mode==='plan'?'Build it. Follow the plan above exactly.':'Build what we just discussed.';send('build')};bub.appendChild(document.createElement('br'));bub.appendChild(gb)}
    if(Object.keys(files).length)snap(p,text);
    save();renderFiles();preview();
    document.querySelectorAll('.rg').forEach(x=>x.remove());act(bub,p.msgs[p.msgs.length-1],p.msgs.length-1,p);if(Object.keys(files).length)tab('prev');
  }catch(e){
    bub.remove();p.msgs.push({role:'assistant',content:e.name==='AbortError'?'Stopped.':(e.message||'Something went wrong.'),err:e.name!=='AbortError',pre});save();renderChat();
  }
  busy=false;$('#send').classList.remove('stop');
}

$('#send').onclick=()=>busy?(AC&&AC.abort()):send();
$('#inp').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&matchMedia('(min-width:1000px)').matches){e.preventDefault();send()}});
$('#inp').addEventListener('input',e=>{e.target.style.height='44px';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'});
$('#theme').onclick=()=>setTheme(S.theme==='dark'?'light':'dark');
$('#setb').onclick=openSet;
$('#addm').onclick=()=>{const v=$('#mid').value.trim();if(!/^[\w.\-]+\/[\w.\-:]+$/.test(v))return toast('Use the format provider/model-name');if(!S.cm.includes(v)){S.cm.push(v);LS.set('zx_cm',S.cm)}S.model=v;LS.set('zx_model',v);$('#mid').value='';renderCm();buildSelect();toast('Added')};
$('#cancel').onclick=()=>$('#dlg').close();
$('#save').onclick=()=>{S.key=$('#key').value.trim();S.ci=$('#ci').value.trim();S.all=$('#all').checked;S.af=$('#af').checked;LS.set('zx_af',S.af);S.plan=$('#plan').checked;LS.set('zx_plan',S.plan);LS.set('zx_key',S.key);LS.set('zx_ci',S.ci);LS.set('zx_all',S.all);buildSelect();$('#dlg').close();toast('Saved')};
$('#clr').onclick=()=>{S.key='';LS.set('zx_key','');$('#key').value='';$('#dlg').close();toast('Key removed')};
$('#model').onchange=e=>{S.model=e.target.value;LS.set('zx_model',S.model)};

$('#newp').onclick=()=>askName('new');$('#newp2').onclick=()=>askName('new');
function delProj(id){if(!confirm('Delete this project?'))return;S.projects=S.projects.filter(p=>p.id!==id);if(S.cur===id){S.cur=null;document.body.classList.add('home')}save();S.file=null;renderProjects();renderChat();renderFiles();preview()}
$('#menu').onclick=()=>document.body.classList.add('nav');$('#scrim').onclick=()=>document.body.classList.remove('nav');
$('#devb').onclick=()=>$('#stage').classList.toggle('phone');
document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab(b.dataset.t);if(b.dataset.t==='prev')preview()});
let ct;$('#code').addEventListener('input',e=>{const p=proj();if(!S.file)return;p.files[S.file]=e.target.value;save();clearTimeout(ct);ct=setTimeout(preview,600);$('#st').textContent='Saved'});
$('#run').onclick=preview;
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#code').value);toast('Copied')}catch(e){toast('Copy failed. Select the text instead.')}};
$('#dl').onclick=()=>{if(!S.file)return toast('Nothing to download yet');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('#code').value],{type:'text/plain'}));a.download=S.file;a.click()};

const PH={auto:'Ask a question or describe what to build',discuss:'Talk through your idea',build:'Describe what to build'};
function setMode(m){S.mode=m;LS.set('zx_mode',m);document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));$('#inp').placeholder=PH[m]}
document.querySelectorAll('#modes button').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
function detect(t,p){
  const s=t.trim().toLowerCase();
  const v='make|build|create|add|change|fix|update|remove|delete|redesign|rewrite|implement|generate|turn|set|replace|rename|move|style|improve|refactor|swap|resize|center';
  if(new RegExp('^(please )?(can|could|would|will) you (please )?('+v+')\\b').test(s))return 'build';
  if(/^(let'?s|lets) (build|make|create|try|start)\b/.test(s)||/^(build it|do it|go ahead|ship it)\b/.test(s))return 'build';
  if(new RegExp('^(please )?('+v+')\\b').test(s))return 'build';
  const has=Object.keys(p.files).length>0;
  if(/^(i want|i need|i would like|i'd like|i'm building|i am building|i'm making)\b/.test(s))return has&&/\?\s*$/.test(s)?'discuss':'build';
  if(/\?\s*$/.test(s)||/^(what|why|how|when|where|who|which|should|is|are|do|does|did|explain|tell me|help me (understand|decide|think)|any (ideas|tips)|ideas|thoughts|compare|difference|pros|walk me)\b/.test(s))return 'discuss';
  return has||s.split(/\s+/).length>=6?'build':'discuss';
}
let NM=null;
function askName(mode,id){NM={mode,id};const c=id&&S.projects.find(p=>p.id===id);$('#nt').textContent=mode==='new'?'Name your project':'Rename project';$('#nin').value=c?c.name:'';document.body.classList.remove('nav');$('#ndlg').showModal();setTimeout(()=>$('#nin').focus(),50)}
function okName(){const v=$('#nin').value.trim().slice(0,60);if(!v)return toast('Give it a name');if(NM.mode==='new')openProj(newProj(v).id);else{const p=S.projects.find(x=>x.id===NM.id);if(p){p.name=v;save()}}$('#ndlg').close();renderProjects()}
function openProj(id){S.cur=id;save();S.file=null;document.body.classList.remove('home','nav');renderProjects();renderChat();renderFiles();preview();tab('chat')}
function goHome(){S.cur=null;document.body.classList.remove('nav');document.body.classList.add('home');renderProjects()}
$('#ncreate').onclick=okName;$('#ncancel').onclick=()=>$('#ndlg').close();
$('#nin').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();okName()}});
$('#ptitle').onclick=()=>{if(S.cur)askName('rename',S.cur)};
document.querySelector('.logo').onclick=goHome;
function dlJSON(n,o){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
function exportProj(id){const p=S.projects.find(x=>x.id===id);if(p)dlJSON((p.name.replace(/[^\w\-]+/g,'-')||'project')+'.zorvexa.json',{zorvexa:1,name:p.name,msgs:slim(p.msgs),files:p.files,mem:p.mem})}
function cleanProj(o){return{id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:String(o.name||'Imported').slice(0,60),mem:String(o.mem||'').slice(0,2000),msgs:(Array.isArray(o.msgs)?o.msgs:[]).filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string').map(m=>({role:m.role,content:m.content,md:typeof m.md==='string'?m.md:undefined,ni:Number.isInteger(m.ni)?m.ni:undefined,fl:Array.isArray(m.fl)?m.fl.map(String):undefined})),files:Object.fromEntries(Object.entries(o.files).filter(([k,v])=>typeof v==='string'))}}
$('#expall').onclick=()=>{if(!S.projects.length)return toast('Nothing to export yet');dlJSON('zorvexa-backup.json',{zorvexa:1,projects:S.projects.map(p=>({name:p.name,msgs:slim(p.msgs),files:p.files,mem:p.mem}))})};
$('#impb').onclick=()=>$('#imp').click();
$('#imp').onchange=async e=>{let n=0;for(const f of e.target.files){try{const j=JSON.parse(await f.text());for(const o of (j.projects||[j])){if(!o||typeof o.files!=='object'||!o.files)continue;S.projects.push(cleanProj(o));n++}}catch(x){}}e.target.value='';save();renderProjects();toast(n?'Imported '+n+(n>1?' projects':' project'):'That file is not a Zorvexa project')};
function showErr(m){LASTERR=m;$('#errt').textContent=m;$('#errb').classList.add('on')}
function fixErr(m,auto){tab('chat');$('#inp').value='Fix this error in the app: '+m;AUTO=!!auto;send('build')}
$('#fixb').onclick=()=>fixErr(LASTERR);
$('#errx').onclick=()=>$('#errb').classList.remove('on');
addEventListener('message',e=>{const d=e.data;if(d&&d.zx===2&&e.source===$('#frame').contentWindow){logAdd(d.lvl,d.msg);return}if(!d||d.zx!==1||e.source!==$('#frame').contentWindow||d.msg==='Script error.'||ERRS.includes(d.msg))return;ERRS.push(d.msg);logAdd('error',d.msg);showErr(d.msg);if(S.af&&Date.now()-LT<2500&&!busy&&FT<2){FT++;fixErr(d.msg,true)}});
function cont(t,im){return im&&im.length?[{type:'text',text:t},...im.map(u=>({type:'image_url',image_url:{url:u}}))]:t}
function shrink(f){return new Promise((res,rej)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{const k=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.82))};im.onerror=()=>{URL.revokeObjectURL(u);rej()};im.src=u})}
async function addImgs(files){for(const f of files){if(!f.type.startsWith('image/'))continue;if(PEND.length>=3){toast('Up to 3 images per message');break}try{PEND.push(await shrink(f))}catch(e){toast('Could not read that image')}}renderPend()}
function renderPend(){const t=$('#thumbs');t.innerHTML='';PEND.forEach((u,i)=>{const d=document.createElement('div');d.className='th';d.innerHTML='<img alt=""><button aria-label="Remove image">×</button>';d.firstChild.src=u;d.lastChild.onclick=()=>{PEND.splice(i,1);renderPend()};t.appendChild(d)});t.style.display=PEND.length?'flex':'none'}
$('#attb').onclick=()=>$('#fil').click();
$('#fil').onchange=e=>{addImgs([...e.target.files]);e.target.value=''};
$('#inp').addEventListener('paste',e=>{const f=[...((e.clipboardData&&e.clipboardData.items)||[])].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(f.length){e.preventDefault();addImgs(f)}});
const PSYS=`You are Zorvexa. The user made a big request, so write a short build plan before any code. Give a one-line summary, then 4 to 7 bullets covering the main features and screens, then one line on the look and feel. State any assumptions. Keep it under 130 words. Do not write code or use <file> tags. Finish with: Say "build it" or tell me what to change.`;
function isBig(t,p){if(Object.keys(p.files).length&&t.length<300)return false;return t.length>160||(t.match(/,|\band\b|\bwith\b/gi)||[]).length>=5||/\b(full|complete|entire|whole|platform|dashboard|marketplace|e-?commerce|social network|multi-?page|login system|authentication)\b/i.test(t)}
function cut(p,i){const r=p.msgs.slice(i).find(m=>m.pre);if(r)p.files=JSON.parse(r.pre);p.msgs=p.msgs.slice(0,i);S.file=null;renderFiles();preview()}
function regen(i){const p=proj();if(busy||!p)return;const u=p.msgs[i-1];if(!u||u.role!=='user')return;const md=p.msgs[i].md;PEND=u.imgs?u.imgs.slice():[];renderPend();cut(p,i-1);$('#inp').value=u.content;send(md==='Build mode'?'build':md==='Discussion'?'discuss':undefined)}
function editMsg(i){const p=proj();if(busy||!p)return;const u=p.msgs[i];EDIT=i;PEND=u.imgs?u.imgs.slice():[];renderPend();$('#inp').value=u.content;$('#inp').focus();toast('Edit your message, then send')}
function act(d,m,i,p){const w=document.createElement('div');w.className='ac';const b=(t,f,c)=>{const x=document.createElement('button');x.textContent=t;x.className=c||'';x.onclick=f;w.appendChild(x)};if(m.role==='user')b('Edit',()=>editMsg(i));else if(i===p.msgs.length-1)b('Regenerate',()=>regen(i),'rg');if(w.firstChild)d.appendChild(w)}
function logAdd(l,m){LOGS.push({l,m});if(LOGS.length>200)LOGS.shift();renderLogs()}
function renderLogs(){const c=$('#clog');c.innerHTML='';LOGS.forEach(x=>{const d=document.createElement('div');d.className='cl '+x.l;d.textContent=(x.l==='log'||x.l==='info'?'':x.l+': ')+x.m;c.appendChild(d)});c.scrollTop=1e9;const n=LOGS.filter(x=>x.l==='error'||x.l==='warn').length;$('#conb').textContent='Console'+(n?' ('+n+')':'')}
$('#conb').onclick=()=>{const o=$('#cons').classList.toggle('on');document.body.classList.toggle('con',o)};
$('#cclr').onclick=()=>{LOGS=[];renderLogs()};
$('#csend').onclick=()=>{if(!LOGS.length)return toast('Nothing logged yet');if(busy)return;const t=LOGS.slice(-15).map(x=>x.l+': '+x.m).join('\n');$('#cons').classList.remove('on');document.body.classList.remove('con');tab('chat');$('#inp').value='Here is the console output from the running app. Fix any problems you find:\n'+t;send('build')};
$('#memb').onclick=()=>{const p=proj();if(!p)return;$('#mem').value=p.mem||'';$('#mdlg').showModal()};
$('#mcancel').onclick=()=>$('#mdlg').close();
$('#msave').onclick=()=>{const p=proj();if(p){p.mem=$('#mem').value.trim();save();toast(p.mem?'Memory saved':'Memory cleared')}$('#mdlg').close()};
function ago(t){const m=Math.round((Date.now()-t)/6e4);if(m<1)return 'just now';if(m<60)return m+' min ago';const h=Math.round(m/60);return h<24?h+' h ago':new Date(t).toLocaleDateString()}
let VSEL=null;
function snap(p,label){if(!Object.keys(p.files).length)return;const l=p.vers&&p.vers[p.vers.length-1];if(l&&JSON.stringify(l.files)===JSON.stringify(p.files))return;(p.vers=p.vers||[]).push({t:Date.now(),l:String(label).slice(0,70),files:{...p.files}});if(p.vers.length>12)p.vers.shift()}
function openVers(){const p=proj();if(!p)return;VSEL=(p.vers||[]).slice(-1)[0]||null;$('#vframe').srcdoc=VSEL?build(VSEL.files):'';renderVers();$('#vdlg').showModal()}
function renderVers(){const p=proj(),l=$('#vlist');l.innerHTML='';const vs=(p.vers||[]).slice().reverse(),cur=JSON.stringify(p.files);$('#vrest').disabled=!VSEL;
  if(!vs.length){l.innerHTML='<p>No versions yet. They appear after your first build.</p>';return}
  vs.forEach(v=>{const r=document.createElement('div');r.className='vr'+(v===VSEL?' on':'');const e=document.createElement('em');e.textContent=v.l+(JSON.stringify(v.files)===cur?' · current':'');const t=document.createElement('span');t.textContent=ago(v.t);r.append(e,t);r.onclick=()=>{VSEL=v;$('#vframe').srcdoc=build(v.files)||'';renderVers()};l.appendChild(r)})}
$('#verb').onclick=openVers;
$('#vclose').onclick=()=>$('#vdlg').close();
$('#vrest').onclick=()=>{const p=proj();if(!p||!VSEL)return;snap(p,'Before restore');p.files={...VSEL.files};S.file=null;save();renderFiles();preview();$('#vdlg').close();toast('Version restored')};
let DEF=null;
const IOS=/iphone|ipad|ipod/i.test(navigator.userAgent),STAND=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();DEF=e;if(!STAND)$('#inst').style.display=''});
addEventListener('appinstalled',()=>{$('#inst').style.display='none'});
if(IOS&&!STAND)$('#inst').style.display='';
$('#inst').onclick=async()=>{if(DEF){DEF.prompt();try{await DEF.userChoice}catch(e){}DEF=null;$('#inst').style.display='none'}else toast('Tap the Share button, then Add to Home Screen')};
setTheme(S.theme);
S.cur=null;document.body.classList.add('home');
renderProjects();renderChat();renderFiles();preview();loadModels();tab('chat');setMode(LS.get('zx_mode','auto'));

if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
