const SEM_LABELS=['Year 1 · Sem 1','Year 1 · Sem 2','Year 2 · Sem 1','Year 2 · Sem 2','Year 3 · Sem 1','Year 3 · Sem 2','Year 4 · Sem 1','Year 4 · Sem 2'];

const STORAGE_KEY='attendance-ledger-data', SETTINGS_KEY='attendance-ledger-settings';

const DEFAULT_SETTINGS={threshold:75,paper:'#f4e698',ink:'#20302B',safe:'#2F6B4F',danger:'#A73E33',brass:'#A9822C',font:'classic'};

let data={},settings={...DEFAULT_SETTINGS},currentYear=1,currentSem=1,dashOpen=false,saveTimer=null;

const semKey=n=>'sem_'+n, semIndex=(year,sem)=>(year-1)*2+sem, emptySem=()=>({subjects:[]}), uid=()=> 'id'+Math.random().toString(36).slice(2,9);

function escapeHtml(value){const node=document.createElement('div');
node.textContent=value||'';
return node.innerHTML}
function normalize(){for(let i=1;
i<=8;
i++){if(!data[semKey(i)])data[semKey(i)]=emptySem();
data[semKey(i)].subjects.forEach(subject=>{if(!Array.isArray(subject.history))subject.history=[]})}}
function applySettings(){const root=document.documentElement;
root.style.setProperty('--paper',settings.paper);
root.style.setProperty('--ink',settings.ink);
root.style.setProperty('--stamp-green',settings.safe);
root.style.setProperty('--brick',settings.danger);
root.style.setProperty('--brass',settings.brass);
document.body.dataset.font=settings.font}

function loadData(){try{const saved=localStorage.getItem(STORAGE_KEY),savedSettings=localStorage.getItem(SETTINGS_KEY);
if(saved)data=JSON.parse(saved);
if(savedSettings)settings={...DEFAULT_SETTINGS,...JSON.parse(savedSettings)}}catch(error){console.error('Load failed',error)}normalize();
applySettings();
render()}

function queueSave(){clearTimeout(saveTimer);
saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch(error){console.error('Save failed',error)}},300)}

function calcPct(subject){return !subject.held||subject.held<=0?null:subject.attended/subject.held*100}

function marginInfo(subject){const held=subject.held||0,attended=subject.attended||0;
if(held<=0)return{text:'— add held classes',safe:true};
const pct=attended/held*100;
if(pct>=settings.threshold){const skip=Math.floor(attended/(settings.threshold/100)-held);
return{text:skip>0?`✓ can skip ${skip} more`:'✓ at the line',safe:true}}const needed=Math.ceil(((settings.threshold/100)*held-attended)/(1-settings.threshold/100));
return{text:`⚠ attend next ${needed} straight`,safe:false}}

function semOverall(semester){let held=0,attended=0;
semester.subjects.forEach(subject=>{held+=subject.held||0;
attended+=subject.attended||0});
return held<=0?null:attended/held*100}

function overallAll(){let held=0,attended=0;
for(let i=1;
i<=8;
i++)data[semKey(i)].subjects.forEach(subject=>{held+=subject.held||0;
attended+=subject.attended||0});
return held<=0?null:attended/held*100}

function recordAttendance(subject,status){subject.held=(subject.held||0)+1;
if(status==='present')subject.attended=(subject.attended||0)+1;
subject.history.unshift({date:new Date().toISOString().slice(0,10),status});
queueSave();
render()}

function render(){renderYearTabs();
renderSemPanel();
renderHeader();
if(dashOpen)renderDashboard()}

function renderHeader(){const overall=overallAll(),element=document.getElementById('headerOverall');
element.textContent=overall===null?'—':overall.toFixed(1)+'%';
element.style.color=overall===null?'var(--ink-soft)':overall>=settings.threshold?'var(--stamp-green)':'var(--brick)'}
function renderYearTabs(){const element=document.getElementById('yearTabs');
element.innerHTML='';
for(let year=1;
year<=4;
year++){const tab=document.createElement('div');
tab.className='year-tab'+(year===currentYear?' active':'');
tab.textContent='Year '+year;
tab.onclick=()=>{currentYear=year;
currentSem=1;
render()};
element.appendChild(tab)}}

function renderSemPanel(){const panel=document.getElementById('semPanel'),index=semIndex(currentYear,currentSem),semester=data[semKey(index)],overall=semOverall(semester);
panel.innerHTML='';
const tabs=document.createElement('div');
tabs.className='sems';
[1,2].forEach(number=>{const tab=document.createElement('div');
tab.className='sem-tab'+(number===currentSem?' active':'');
tab.textContent='Semester '+number;
tab.onclick=()=>{currentSem=number;
render()};
tabs.appendChild(tab)});
panel.appendChild(tabs);
const header=document.createElement('div');
header.className='sem-header';
const name=document.createElement('div');
name.className='sem-name';
name.textContent=SEM_LABELS[index-1];
header.appendChild(name);
const stamp=document.createElement('div');
stamp.className=overall===null?'stamp empty':overall>=settings.threshold?'stamp':'stamp risk';
stamp.textContent=overall===null?'No entries':(overall>=settings.threshold?'Safe · ':'Risk · ')+overall.toFixed(1)+'%';
header.appendChild(stamp);
panel.appendChild(header);
if(!semester.subjects.length){const empty=document.createElement('div');
empty.className='empty-note';
empty.textContent='No subjects added for this semester yet. Add your first subject below.';
panel.appendChild(empty)}else{const table=document.createElement('table');
table.innerHTML='<thead><tr><th>Subject</th><th>Held</th><th>Attended</th><th>%</th><th>Margin</th><th></th></tr></thead>';
const body=document.createElement('tbody');
semester.subjects.forEach(subject=>{const row=document.createElement('tr');
row.innerHTML=rowMarkup(subject);
const [nameInput,heldInput,attendedInput]=row.querySelectorAll('input');
nameInput.oninput=event=>{subject.name=event.target.value;
queueSave()};
heldInput.oninput=event=>{subject.held=Math.max(0,parseInt(event.target.value)||0);
syncAttended(subject);
queueSave();
updateRow(row,subject);
renderHeader()};
attendedInput.oninput=event=>{subject.attended=Math.max(0,parseInt(event.target.value)||0);
syncAttended(subject);
queueSave();
updateRow(row,subject);
renderHeader()};
row.querySelector('.present-btn').onclick=()=>recordAttendance(subject,'present');
row.querySelector('.absent-btn').onclick=()=>recordAttendance(subject,'absent');
row.querySelector('.del-btn').onclick=()=>{semester.subjects=semester.subjects.filter(item=>item.id!==subject.id);
queueSave();
render()};
body.appendChild(row)});
table.appendChild(body);
panel.appendChild(table)}const addRow=document.createElement('div');
addRow.className='add-row';
const addButton=document.createElement('button');
addButton.className='add-btn';
addButton.textContent='+ Add subject';
addButton.onclick=()=>{semester.subjects.push({id:uid(),name:'',held:0,attended:0,history:[]});
queueSave();
render();
setTimeout(()=>document.querySelector('.subj-input:last-of-type')?.focus(),0)};
addRow.appendChild(addButton);
panel.appendChild(addRow)}

function rowMarkup(subject){const pct=calcPct(subject),info=marginInfo(subject),safe=pct!==null&&pct>=settings.threshold;
return `<td><input class="subj-input" value="${escapeHtml(subject.name)}" placeholder="Subject name"></td><td><input class="num-input" type="number" min="0" value="${subject.held??''}" placeholder="0"></td><td><input class="num-input" type="number" min="0" value="${subject.attended??''}" placeholder="0"></td><td class="pct-cell ${pct===null?'':safe?'safe':'risk'}">${pct===null?'—':pct.toFixed(1)+'%'}</td><td><div class="margin-note ${info.safe?'safe':'risk'}">${info.text}</div><div class="quick-actions"><button class="present-btn">Present</button><button class="absent-btn">Absent</button></div><div class="gauge"><div class="gauge-mark" style="left:${settings.threshold}%"></div><div class="gauge-fill" style="width:${pct===null?0:Math.min(pct,100)}%;
background:${pct===null?'var(--paper-line)':safe?'var(--stamp-green)':'var(--brick)'}"></div></div></td><td><button class="del-btn" title="Remove subject">✕</button></td>`}

function syncAttended(subject){if(subject.attended>subject.held)subject.attended=subject.held}

function updateRow(row,subject){const pct=calcPct(subject),info=marginInfo(subject),safe=pct!==null&&pct>=settings.threshold;
const cell=row.querySelector('.pct-cell'),fill=row.querySelector('.gauge-fill');
cell.textContent=pct===null?'—':pct.toFixed(1)+'%';
cell.className='pct-cell '+(pct===null?'':safe?'safe':'risk');
row.querySelector('.margin-note').textContent=info.text;
row.querySelector('.margin-note').className='margin-note '+(info.safe?'safe':'risk');
fill.style.width=(pct===null?0:Math.min(pct,100))+'%';
fill.style.background=pct===null?'var(--paper-line)':safe?'var(--stamp-green)':'var(--brick)';
row.querySelector('.gauge-mark').style.left=settings.threshold+'%'}

function forecast(subjects){if(!subjects.length)return '<div class="notice">Add classes to see your attendance forecast.</div>';
return `<div class="tool-card"><h3>Forecast for ${escapeHtml(SEM_LABELS[semIndex(currentYear,currentSem)-1])}</h3>${subjects.map(subject=>{const pct=calcPct(subject),info=marginInfo(subject);
return `<div class="stat-line"><span>${escapeHtml(subject.name||'Unnamed subject')}</span><strong>${pct===null?'Add held classes':info.text}</strong></div>`}).join('')}</div>`}

function renderDashboard(){const panel=document.getElementById('passbook'),overall=overallAll(),semester=data[semKey(semIndex(currentYear,currentSem))],subjects=semester.subjects.filter(subject=>subject.name||subject.held),history=subjects.flatMap(subject=>(subject.history||[]).map(item=>({...item,name:subject.name||'Unnamed subject'}))).sort((a,b)=>b.date.localeCompare(a.date));
panel.hidden=false;
panel.innerHTML=`<h2>4-Year Passbook</h2><div class="pb-sub">Overall attendance: ${overall===null?'—':overall.toFixed(1)+'%'}</div><div class="dashboard-tools"><div class="tool-card"><h3>Semester pulse</h3><div class="stat-line"><span>Subjects tracked</span><strong>${subjects.length}</strong></div><div class="stat-line"><span>Below ${settings.threshold}%</span><strong>${subjects.filter(subject=>calcPct(subject)!==null&&calcPct(subject)<settings.threshold).length}</strong></div><div class="stat-line"><span>Classes logged</span><strong>${subjects.reduce((sum,subject)=>sum+(subject.held||0),0)}</strong></div></div><div class="tool-card"><h3>Personalize</h3><label>Safety threshold</label><input id="thresholdInput" type="number" min="1" max="100" value="${settings.threshold}"><label>Page colour</label><input id="paperColor" type="color" value="${settings.paper}"><label>Ink colour</label><input id="inkColor" type="color" value="${settings.ink}"><label>Safe colour</label><input id="safeColor" type="color" value="${settings.safe}"><label>Risk colour</label><input id="dangerColor" type="color" value="${settings.danger}"><label>Notebook mood</label><select id="fontChoice"><option value="classic">Classic ledger</option><option value="soft">Soft rounded</option><option value="mono">Focused mono</option></select></div><div class="tool-card"><h3>Backup desk</h3><p>Keep a copy of your tracker or move it to another browser.</p><div class="tool-actions"><button class="add-btn" id="exportBtn">Export backup</button><button class="add-btn ghost" id="importBtn">Import backup</button><button class="add-btn ghost" id="printBtn">Print report</button><button class="add-btn ghost" id="resetBtn">Reset data</button></div><input id="importFile" type="file" accept="application/json" hidden></div><div class="tool-card"><h3>Recent activity</h3><div class="history-list">${history.length?history.slice(0,12).map(item=>`<div class="history-item ${item.status}"><span>${escapeHtml(item.name)}</span><span>${item.status==='present'?'Present':'Absent'} · ${item.date}</span></div>`).join(''):'<span class="pb-sub">No daily entries yet.</span>'}</div></div></div>${forecast(subjects)}<div class="tiles">${Array.from({length:8},(_,i)=>{const value=semOverall(data[semKey(i+1)]),className=value===null?'dim':value>=settings.threshold?'safe':'risk';
return `<div class="tile"><div class="t-name">${SEM_LABELS[i]}</div><div class="t-pct ${className}">${value===null?'—':value.toFixed(1)+'%'}</div><div class="t-bar"><div class="t-bar-fill" style="width:${value===null?0:Math.min(value,100)}%;
background:${value===null?'var(--paper-line)':value>=settings.threshold?'var(--stamp-green)':'var(--brick)'}"></div></div></div>`}).join('')}</div>`;
bindDashboardTools()}

function bindDashboardTools(){const controls={thresholdInput:'threshold',paperColor:'paper',inkColor:'ink',safeColor:'safe',dangerColor:'danger',fontChoice:'font'};
Object.entries(controls).forEach(([id,key])=>{const element=document.getElementById(id);
element.value=settings[key];
element.oninput=()=>{settings[key]=key==='threshold'?Math.min(100,Math.max(1,parseInt(element.value)||75)):element.value;
applySettings();
queueSave();
render()}});
document.getElementById('exportBtn').onclick=exportBackup;
document.getElementById('importBtn').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').onchange=importBackup;
document.getElementById('printBtn').onclick=()=>window.print();
document.getElementById('resetBtn').onclick=()=>{if(confirm('Reset every semester and remove saved attendance?')){data={};
normalize();
settings={...DEFAULT_SETTINGS};
applySettings();
queueSave();
render()}}}

function exportBackup(){const link=document.createElement('a');
link.href=URL.createObjectURL(new Blob([JSON.stringify({data,settings},null,2)],{type:'application/json'}));
link.download='attendance-ledger-backup.json';
link.click();
URL.revokeObjectURL(link.href)}

function importBackup(event){const file=event.target.files[0];
if(!file)return;
const reader=new FileReader();
reader.onload=()=>{try{const parsed=JSON.parse(reader.result);
data=parsed.data||parsed;
settings={...DEFAULT_SETTINGS,...(parsed.settings||{})};
normalize();
applySettings();
queueSave();
render()}catch(error){alert('That backup file could not be read.')}};
reader.readAsText(file)}

document.getElementById('dashBtn').onclick=()=>{dashOpen=!dashOpen;
document.getElementById('passbook').hidden=!dashOpen;
document.getElementById('dashBtn').textContent=dashOpen?'Hide 4-year dashboard ▴':'View 4-year dashboard ▾';
if(dashOpen)renderDashboard()};
loadData();
