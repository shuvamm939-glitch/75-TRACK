const SEM_LABELS = [
  "Y1 · S1","Y1 · S2","Y2 · S1","Y2 · S2","Y3 · S1","Y3 · S2","Y4 · S1","Y4 · S2"
];
const STORAGE_KEY = "attendance-ledger-data";
const SEGMENTS = 20; // LED meter resolution

let data = {};
let currentYear = 1;
let currentSem = 1;
let dashOpen = false;
let saveTimer = null;

function semKey(n){ return "sem_" + n; }
function semIndexFromYearSem(year, semInYear){ return (year-1)*2 + semInYear; }
function emptySem(){ return { subjects: [] }; }
function uid(){ return 'id' + Math.random().toString(36).slice(2,9); }

async function loadData(){
  try{
    const res = await window.storage.get(STORAGE_KEY, false);
    if(res && res.value) data = JSON.parse(res.value);
  }catch(e){ /* first run, no data yet */ }
  for(let i=1;i<=8;i++){ if(!data[semKey(i)]) data[semKey(i)] = emptySem(); }
  render();
}

function queueSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try{ await window.storage.set(STORAGE_KEY, JSON.stringify(data), false); }
    catch(e){ console.error("Save failed", e); }
  }, 300);
}

function calcPct(subj){
  if(!subj.held || subj.held <= 0) return null;
  return (subj.attended / subj.held) * 100;
}

function marginInfo(subj){
  const held = subj.held || 0, att = subj.attended || 0;
  if(held <= 0) return { text: "add held classes", safe:true };
  const pct = (att/held)*100;
  if(pct >= 75){
    const canSkip = Math.floor(att/0.75 - held);
    return { text: canSkip > 0 ? `can skip ${canSkip} more` : "at the line", safe:true };
  }
  const needed = Math.ceil((0.75*held - att) / 0.25);
  return { text: `attend next ${needed} straight`, safe:false };
}

function semOverall(sem){
  let held=0, att=0;
  sem.subjects.forEach(s=>{ held += (s.held||0); att += (s.attended||0); });
  if(held<=0) return null;
  return (att/held)*100;
}

function overallAll(){
  let held=0, att=0;
  for(let i=1;i<=8;i++) data[semKey(i)].subjects.forEach(s=>{ held += (s.held||0); att += (s.attended||0); });
  if(held<=0) return null;
  return (att/held)*100;
}

function syncAttended(subj){ if(subj.attended > subj.held) subj.attended = subj.held; }

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function buildMeter(pct){
  const lit = pct===null ? 0 : Math.round((Math.min(pct,100)/100) * SEGMENTS);
  const thresholdSeg = Math.round(0.75 * SEGMENTS) - 1;
  const isSafe = pct !== null && pct >= 75;
  let html = '<div class="meter">';
  for(let i=0;i<SEGMENTS;i++){
    let cls = 'seg';
    if(i < lit) cls += isSafe ? ' on-safe' : ' on-danger';
    if(i === thresholdSeg) cls += ' threshold';
    html += `<div class="${cls}"></div>`;
  }
  html += '</div>';
  return html;
}

function render(){
  renderHeader();
  renderYearNodes();
  renderSemPanel();
  if(dashOpen) renderDashboard();
}

function renderHeader(){
  const o = overallAll();
  const el = document.getElementById('headerOverall');
  el.textContent = o===null ? "— %" : o.toFixed(1) + "%";
  el.className = 'val ' + (o===null ? 'dim' : (o>=75 ? 'safe' : 'danger'));
}

function renderYearNodes(){
  const el = document.getElementById('yearNodes');
  el.innerHTML = "";
  for(let y=1;y<=4;y++){
    const node = document.createElement('div');
    node.className = 'node' + (y===currentYear ? ' active' : '');
    node.innerHTML = `<span class="dot"></span><span class="lbl">Year ${y}</span>`;
    node.onclick = () => { currentYear = y; currentSem = 1; render(); };
    el.appendChild(node);
  }
}

function renderSemPanel(){
  const panel = document.getElementById('semPanel');
  const idx = semIndexFromYearSem(currentYear, currentSem);
  const sem = data[semKey(idx)];
  const overall = semOverall(sem);

  panel.innerHTML = `
    <span class="corner tl"></span><span class="corner tr"></span>
    <span class="corner bl"></span><span class="corner br"></span>
  `;

  const semsRow = document.createElement('div');
  semsRow.className = 'sems';
  [1,2].forEach(s=>{
    const t = document.createElement('div');
    t.className = 'sem-tab' + (s===currentSem ? ' active':'');
    t.textContent = 'Semester ' + s;
    t.onclick = () => { currentSem = s; render(); };
    semsRow.appendChild(t);
  });
  panel.appendChild(semsRow);

  const headRow = document.createElement('div');
  headRow.className = 'sem-header';
  const nameEl = document.createElement('div');
  nameEl.className = 'sem-name';
  nameEl.textContent = `YEAR ${currentYear} — SEMESTER ${currentSem}`;
  headRow.appendChild(nameEl);

  const tag = document.createElement('div');
  if(overall === null){ tag.className = 'led-tag empty'; tag.textContent = 'NO DATA'; }
  else if(overall >= 75){ tag.className = 'led-tag safe'; tag.textContent = 'SAFE · ' + overall.toFixed(1) + '%'; }
  else { tag.className = 'led-tag danger'; tag.textContent = 'RISK · ' + overall.toFixed(1) + '%'; }
  headRow.appendChild(tag);
  panel.appendChild(headRow);

  if(sem.subjects.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = 'NO SUBJECTS LOGGED — add your first subject below to start tracking.';
    panel.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr>
      <th>Subject</th><th>Held</th><th>Att.</th><th>%</th><th>Attendance meter</th><th></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    sem.subjects.forEach(subj=>{
      const tr = document.createElement('tr');
      const pct = calcPct(subj);
      const mi = marginInfo(subj);
      const pctClass = pct===null ? 'dim' : (pct>=75 ? 'safe':'danger');

      tr.innerHTML = `
        <td><input class="subj-input" value="${escapeHtml(subj.name)}" placeholder="Subject name" /></td>
        <td><input class="num-input" type="number" min="0" value="${subj.held ?? ''}" placeholder="0" /></td>
        <td><input class="num-input" type="number" min="0" value="${subj.attended ?? ''}" placeholder="0" /></td>
        <td class="pct-cell ${pctClass}">${pct===null ? '—' : pct.toFixed(1)+'%'}</td>
        <td class="meter-cell">
          ${buildMeter(pct)}
          <div class="margin-note ${mi.safe ? 'safe':'danger'}">${mi.text}</div>
        </td>
        <td><button class="del-btn" title="Remove subject">✕</button></td>
      `;

      const [nameIn, heldIn, attIn] = tr.querySelectorAll('input');
      nameIn.oninput = e => { subj.name = e.target.value; queueSave(); };
      heldIn.oninput = e => { subj.held = e.target.value===''? 0 : Math.max(0, parseInt(e.target.value)||0); syncAttended(subj); queueSave(); render(); };
      attIn.oninput = e => { subj.attended = e.target.value===''? 0 : Math.max(0, parseInt(e.target.value)||0); syncAttended(subj); queueSave(); render(); };
      tr.querySelector('.del-btn').onclick = () => {
        sem.subjects = sem.subjects.filter(s=>s.id!==subj.id);
        queueSave(); render();
      };
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    panel.appendChild(table);
  }

  const addRow = document.createElement('div');
  addRow.className = 'add-row';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.textContent = '+ ADD SUBJECT';
  addBtn.onclick = () => {
    sem.subjects.push({ id: uid(), name:'', held:0, attended:0 });
    queueSave(); render();
    setTimeout(()=>{ const inputs = document.querySelectorAll('.subj-input'); if(inputs.length) inputs[inputs.length-1].focus(); }, 0);
  };
  addRow.appendChild(addBtn);
  panel.appendChild(addRow);
}

function renderDashboard(){
  const pb = document.getElementById('passbook');
  const overall = overallAll();
  let html = `<h2>4-YEAR OVERVIEW</h2>
    <div class="pb-sub">Overall attendance across all logged subjects: ${overall===null ? '—' : overall.toFixed(1)+'%'}</div>
    <div class="tiles">`;
  for(let i=1;i<=8;i++){
    const sem = data[semKey(i)];
    const o = semOverall(sem);
    const cls = o===null ? 'dim' : (o>=75 ? 'safe':'danger');
    html += `<div class="tile">
      <div class="t-name">${SEM_LABELS[i-1]}</div>
      <div class="t-pct ${cls}">${o===null ? '—' : o.toFixed(1)+'%'}</div>
      ${buildMeter(o)}
    </div>`;
  }
  html += `</div>`;
  pb.innerHTML = html;
}

document.getElementById('dashBtn').onclick = () => {
  dashOpen = !dashOpen;
  document.getElementById('passbook').style.display = dashOpen ? 'block':'none';
  document.getElementById('dashBtn').textContent = dashOpen ? 'HIDE OVERVIEW ▴' : 'VIEW 4-YEAR OVERVIEW ▾';
  if(dashOpen) renderDashboard();
};

loadData();
