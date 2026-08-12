// Agenda Comunicaciones · voz Android robusta 1.1.3
const SCRIPT_URL = String(window.AGENDA_PRENSA_CONFIG?.scriptUrl || '').trim();

let allEvents = [];
let currentTab = 'hoy';
let currentView = 'agenda';
document.body.dataset.view = currentView;
let calendarDate = new Date();
let selectedCalDate = null;
let activeDropdown = null;
let editingEvent = null;
let pendingDeleteEvent = null;
let refreshTimer = null;
let lastSuccessfulLoadAt = 0;
let calendarMotion = '';
let calendarSwipeLockUntil = 0;

const CATEGORIES = [
  { id:'jurisdiccional', label:'Jurisdiccional', icon:'⚖️', keywords:['jurisdiccional','topls','jgc','ijo','sentencia','formalización','formalizacion'] },
  { id:'audiovisual', label:'Audiovisual', icon:'🎥', keywords:['audiovisual','short','video','cuña','cuna'] },
  { id:'boletines', label:'Boletines', icon:'📰', keywords:['boletín','boletin'] },
  { id:'efemerides', label:'Efemérides', icon:'✦', keywords:['aniversario','día de','dia de'] },
];

const FIXED_TABS = [
  { id:'hoy', label:'Hoy', icon:'📅' },
  { id:'manana', label:'Mañana', icon:'⏭' },
  { id:'semana', label:'Semana', icon:'📆' },
];

const SPECIAL_KEYWORDS = [
  'permiso','permisos','vacación','vacacion','vacaciones','feriado legal',
  'curso','cursos','capacitación','capacitacion','diplomado','academia judicial'
];

const STATUS_OPTIONS = [
  {s:'Confirmada', color:'#78bba3', dot:'#4f9c83', icon:'✓'},
  {s:'Por Confirmar', color:'#b3a4d4', dot:'#8876b7', icon:'?'},
  {s:'Boletín', color:'#7fb1d2', dot:'#4f87ad', icon:'B'},
  {s:'Redes Sociales', color:'#c997c4', dot:'#a2649c', icon:'R'},
  {s:'Pendiente', color:'#d1aa70', dot:'#b98135', icon:'⏳'},
  {s:'Cancelada', color:'#d99a9f', dot:'#b75d65', icon:'✕'},
  {s:'Sin estado', color:'#aab4c2', dot:'#78879b', icon:'•'},
];

function escapeHTML(value='') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function parseCSV(text) {
  const rows=[];
  let row=[], cell='', quoted=false;
  const source=String(text||'').replace(/^\uFEFF/, '');
  for (let i=0;i<source.length;i++) {
    const char=source[i];
    if (char==='"') {
      if (quoted && source[i+1]==='"') { cell+='"'; i++; }
      else quoted=!quoted;
    } else if (char===',' && !quoted) {
      row.push(cell.trim()); cell='';
    } else if ((char==='\n' || char==='\r') && !quoted) {
      if (char==='\r' && source[i+1]==='\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row=[]; cell='';
    } else cell+=char;
  }
  if (cell!=='' || row.length) { row.push(cell.trim()); rows.push(row); }
  while (rows.length && rows[rows.length-1].every(value=>value==='')) rows.pop();
  if (!rows.length) return [];
  const headers=rows[0].map(h=>h.trim().toUpperCase());
  return rows.slice(1).map((cols,idx)=>{
    const obj={_row:idx+2};
    headers.forEach((header,i)=>obj[header]=(cols[i]||'').trim());
    obj.FECHA=normalizeDateKey(obj.FECHA);
    obj.HORA=normalizeTimeValue(obj.HORA);
    obj.TIPO=normalizeType(obj.TIPO);
    obj.ESTADO=normalizeStatus(obj.ESTADO);
    return obj;
  }).filter(e=>e.FECHA&&e.DETALLE);
}

function normalizeDateKey(value) {
  if (!value) return '';
  const raw=String(value).trim();
  let day,month,year;
  const iso=raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
  const local=raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\D|$)/);
  if (iso) [,year,month,day]=iso;
  else if (local) [,day,month,year]=local;
  else return '';
  day=Number(day); month=Number(month); year=Number(year);
  const date=new Date(year,month-1,day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear()!==year ||
    date.getMonth()!==month-1 ||
    date.getDate()!==day
  ) return '';
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
}

function parseDate(value) {
  const canonical=normalizeDateKey(value);
  if (!canonical) return null;
  const [day,month,year]=canonical.split('/').map(Number);
  return new Date(year,month-1,day);
}

function normalizeTimeValue(value) {
  if (!value) return '';
  const match=String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hour=Number(match[1]);
  const minute=Number(match[2]);
  if (hour<0||hour>23||minute<0||minute>59) return '';
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function dateToInput(str) {
  const date=parseDate(str);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function inputToDate(value) {
  const [y,m,d]=String(value).split('-');
  return y&&m&&d?`${d}/${m}/${y}`:'';
}

function dayNameFromInput(value) {
  const [y,m,d]=String(value).split('-').map(Number);
  const name=new Date(y,m-1,d).toLocaleDateString('es-CL',{weekday:'long'});
  return name.charAt(0).toUpperCase()+name.slice(1);
}

function sameDay(a,b) {
  return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}

function normalizeType(value) {
  const raw=String(value||'').trim();
  const lower=raw.toLowerCase();
  if(lower.includes('jurisd')) return 'Jurisdiccional';
  if(lower.includes('audiovis')) return 'Audiovisual';
  if(lower.includes('turno')) return 'Turno';
  if(lower.includes('efem')) return 'Efeméride';
  if(lower.includes('ausenc')) return 'Ausencias';
  if(lower.includes('actividad')) return 'Actividad';
  return raw || 'Actividad';
}

function normalizeStatus(value) {
  const raw=String(value||'').trim();
  const lower=raw.toLowerCase();
  if(lower==='por confirmar' || lower==='por confirmar.') return 'Por Confirmar';
  if(lower==='boletín' || lower==='boletin') return 'Boletín';
  if(lower==='redes sociales' || lower==='redes') return 'Redes Sociales';
  if(lower==='pendiente') return 'Pendiente';
  if(lower==='cancelada' || lower==='cancelado') return 'Cancelada';
  if(!raw || lower==='sin estado') return 'Sin estado';
  return raw || 'Sin estado';
}


const TEAM_MEMBERS = Object.freeze({
  MM:'Margarett Molina',
  PH:'Paxelia Huerta'
});

function expandTeamCodes(value=''){
  return String(value||'')
    .replace(/\bMM\b/g,TEAM_MEMBERS.MM)
    .replace(/\bPH\b/g,TEAM_MEMBERS.PH);
}

function communicationMembersInText(value=''){
  const raw=String(value||'');
  const members=[];
  if(/\bMM\b/.test(raw)) members.push({code:'MM',name:TEAM_MEMBERS.MM});
  if(/\bPH\b/.test(raw)) members.push({code:'PH',name:TEAM_MEMBERS.PH});
  return members;
}

function typeIconSvg(type){
  const common='class="type-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  if(type==='Actividad') return `<svg ${common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m8.5 15 2 2 5-5"/></svg>`;
  if(type==='Jurisdiccional') return `<svg ${common}><path d="M12 3v18M5 7h14M8 21h8"/><path d="m7 7-3 6h6L7 7Zm10 0-3 6h6l-3-6Z"/></svg>`;
  if(type==='Audiovisual') return `<svg ${common}><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3Z"/><path d="m8.5 10 4 2.5-4 2.5Z"/></svg>`;
  if(type==='Turno') return `<svg ${common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/><path d="M18.2 5.8 20 4M5.8 5.8 4 4"/></svg>`;
  if(type==='Efeméride') return `<svg ${common}><path d="m12 3 2.4 4.8 5.3.8-3.8 3.7.9 5.2-4.8-2.5-4.8 2.5.9-5.2-3.8-3.7 5.3-.8L12 3Z"/></svg>`;
  if(type==='Ausencias') return `<svg ${common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-3.8 2.7-5.8 5.5-5.8 2.2 0 4.1 1.2 5 3.4M17 10h5"/></svg>`;
  return `<svg ${common}><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>`;
}

function eventKey(event) {
  return `${event._row||''}|${normalizeDateKey(event.FECHA)}|${normalizeTimeValue(event.HORA)}|${event.DETALLE||''}`;
}

function getStatus(event) { return normalizeStatus(event.ESTADO); }

function isSpecialActivity(event) {
  return normalizeType(event.TIPO)==='Ausencias';
}

function formatTime(value) {
  return normalizeTimeValue(value);
}

function timeToMin(value) {
  const normalized=normalizeTimeValue(value);
  if (!normalized) return null;
  const [hour,minute]=normalized.split(':').map(Number);
  return hour*60+minute;
}

function compareEventsChronologically(a,b) {
  const aMinutes=timeToMin(a.HORA);
  const bMinutes=timeToMin(b.HORA);
  if (aMinutes===null&&bMinutes!==null) return 1;
  if (aMinutes!==null&&bMinutes===null) return -1;
  if (aMinutes!==null&&bMinutes!==null&&aMinutes!==bMinutes) return aMinutes-bMinutes;
  const rowDifference=(Number(a._row)||Number.MAX_SAFE_INTEGER)-(Number(b._row)||Number.MAX_SAFE_INTEGER);
  if (rowDifference) return rowDifference;
  return String(a.DETALLE||'').localeCompare(String(b.DETALLE||''),'es',{sensitivity:'base'});
}


/* --------------------------------------------------------------------------
   Feriados nacionales de Chile
   - El año 2026 usa el calendario oficial publicado por Gobierno de Chile.
   - Los años futuros o feriados extraordinarios se leen desde FERIADOS_CHILE.
   - No se generan fechas futuras mediante una fuente comercial o no oficial.
   -------------------------------------------------------------------------- */

const OFFICIAL_CHILE_HOLIDAYS={
  2026:[
    ['01/01/2026','Año Nuevo',true],
    ['03/04/2026','Viernes Santo',false],
    ['04/04/2026','Sábado Santo',false],
    ['01/05/2026','Día del Trabajo',true],
    ['21/05/2026','Día de las Glorias Navales',false],
    ['21/06/2026','Día Nacional de los Pueblos Indígenas',false],
    ['29/06/2026','San Pedro y San Pablo',false],
    ['16/07/2026','Día de la Virgen del Carmen',false],
    ['15/08/2026','Asunción de la Virgen',false],
    ['18/09/2026','Independencia Nacional',true],
    ['19/09/2026','Día de las Glorias del Ejército',true],
    ['12/10/2026','Encuentro de Dos Mundos',false],
    ['31/10/2026','Día Nacional de las Iglesias Evangélicas',false],
    ['01/11/2026','Día de Todos los Santos',false],
    ['08/12/2026','Inmaculada Concepción',false],
    ['25/12/2026','Navidad',true]
  ]
};

const chileHolidayYears=new Map();
let officialHolidaySheetSyncStarted=false;

function normalizedHolidayName(name=''){
  return String(name||'').trim()||'Feriado nacional';
}

function setHolidayYear(year,items,{replace=false}={}){
  const existing=replace?new Map():(chileHolidayYears.get(year)||new Map());
  items.forEach(item=>{
    const canonical=normalizeDateKey(item.date);
    if(!canonical) return;
    const incoming={
      date:canonical,
      name:normalizedHolidayName(item.name),
      type:item.type||'Feriado nacional',
      scope:item.scope||'Nacional',
      national:item.national!==false,
      irrenunciable:Boolean(item.irrenunciable),
      source:item.source||'Calendario oficial',
      _row:Number(item._row)||0,
      protected:Boolean(item.protected)
    };
    const current=existing.get(canonical);
    if(current?.protected&&!incoming.protected) return;
    existing.set(canonical,incoming);
  });
  chileHolidayYears.set(year,existing);
}

function seedOfficialChileHolidayYear(year){
  if(chileHolidayYears.has(year)) return;
  const rows=OFFICIAL_CHILE_HOLIDAYS[year]||[];
  setHolidayYear(year,rows.map(([date,name,irrenunciable])=>({
    date,
    name,
    irrenunciable,
    type:'Feriado nacional',
    national:true,
    source:'Gobierno de Chile · calendario oficial 2026',
    scope:'Nacional',
    protected:true
  })),{replace:true});
}

function mergeOfficialHolidaySheetRows(rows){
  if(!Array.isArray(rows)) return;
  const grouped=new Map();
  rows.forEach(item=>{
    if(!item||item.activo===false) return;
    const date=normalizeDateKey(item.fecha||item.date);
    if(!date) return;
    const year=parseDate(date)?.getFullYear();
    if(!year) return;
    if(!grouped.has(year)) grouped.set(year,[]);
    grouped.get(year).push({
      date,
      name:item.nombre||item.name,
      type:item.tipo||'Feriado nacional',
      scope:item.alcance||'Nacional',
      national:String(item.tipo||'').toLowerCase().includes('nacional'),
      source:item.fuente||'FERIADOS_CHILE',
      _row:Number(item.fila||item._row)||0,
      protected:Boolean(item.protegido)
    });
  });
  grouped.forEach((items,year)=>{
    seedOfficialChileHolidayYear(year);
    setHolidayYear(year,items);
  });
}

async function syncOfficialChileHolidaysFromSheet(){
  if(officialHolidaySheetSyncStarted) return;
  officialHolidaySheetSyncStarted=true;
  try{
    const payload=await sendScriptAction('feriados');
    mergeOfficialHolidaySheetRows(payload?.feriados);
    if(lastSuccessfulLoadAt){
      updateHeaderStats();
      render();
    }
  }catch{
    // La aplicación continúa con la lista oficial 2026 incorporada.
  }
}

function ensureChileHolidayYear(year){
  seedOfficialChileHolidayYear(year);
}

function getChileHoliday(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime())) return null;
  const year=date.getFullYear();
  seedOfficialChileHolidayYear(year);
  return chileHolidayYears.get(year)?.get(formatDateKey(date))||null;
}

function renderHolidayDetailCard(holiday,eventCount=0){
  if(!holiday) return '';
  const activityNote=eventCount
    ? `${eventCount} ${eventCount===1?'actividad excepcional registrada':'actividades excepcionales registradas'}`
    : 'Sin actividades agendadas';
  const manage=holiday.protected
    ? `<span class="holiday-protected-note">Oficial protegido</span>`
    : `<div class="holiday-manage-actions">
        <button type="button" class="holiday-manage-btn edit-holiday" data-holiday-date="${escapeHTML(holiday.date)}">Editar</button>
        <button type="button" class="holiday-manage-btn delete-holiday" data-holiday-date="${escapeHTML(holiday.date)}">Eliminar</button>
      </div>`;
  return `<section class="holiday-detail-card" aria-label="${escapeHTML(holiday.type)}: ${escapeHTML(holiday.name)}">
    <div class="holiday-detail-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m8.5 15 2 2 5-5"/></svg>
    </div>
    <div class="holiday-detail-copy">
      <span>${escapeHTML(holiday.type)}</span>
      <strong>${escapeHTML(holiday.name)}</strong>
      <small>${escapeHTML(holiday.scope||'Nacional')} · ${activityNote}</small>
    </div>
    <span class="holiday-national-badge">${escapeHTML((holiday.scope||'Nacional').replace('Región de ','').slice(0,18))}</span>
    ${manage}
  </section>`;
}

function todayAtMidnight(){
  const date=new Date(); date.setHours(0,0,0,0); return date;
}

function minutesNow(){
  const now=new Date(); return now.getHours()*60+now.getMinutes();
}

function activeEventsForDate(date){
  return allEvents
    .filter(event=>sameDay(parseDate(event.FECHA),date)&&getStatus(event)!=='Cancelada')
    .slice().sort(compareEventsChronologically);
}

function nextTimedEventForToday(){
  const nowMinutes=minutesNow();
  return activeEventsForDate(todayAtMidnight())
    .find(event=>{
      const value=timeToMin(event.HORA);
      return value!==null&&value>=nowMinutes;
    })||null;
}

function eventTemporalMeta(event){
  const eventDate=parseDate(event.FECHA);
  if(!eventDate||!sameDay(eventDate,todayAtMidnight())||getStatus(event)==='Cancelada') return {state:'',label:'',minutes:null};
  const value=timeToMin(event.HORA);
  if(value===null) return {state:'',label:'',minutes:null};
  const now=minutesNow();
  const next=nextTimedEventForToday();
  if(next&&eventKey(next)===eventKey(event)){
    const difference=Math.max(0,value-now);
    return {state:'next',label:difference===0?'Ahora':difference<60?`En ${difference} min`:`En ${Math.floor(difference/60)} h ${difference%60?`${difference%60} min`:''}`.trim(),minutes:difference};
  }
  if(value<now) return {state:'past',label:'Finalizada',minutes:value-now};
  return {state:'future',label:'',minutes:value-now};
}

function sameTimeConflicts(events){
  const counts=new Map();
  events.forEach(event=>{
    const time=normalizeTimeValue(event.HORA);
    if(time) counts.set(time,(counts.get(time)||0)+1);
  });
  return [...counts.entries()].filter(([,count])=>count>1).map(([time,count])=>({time,count}));
}

function haptic(pattern=18){
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(_){ }
}

function typeMeta(value) {
  const type=normalizeType(value);
  if(type==='Actividad') return {className:'tipo-actividad',badge:'b-tipo-actividad',icon:typeIconSvg(type),label:'Actividad'};
  if(type==='Jurisdiccional') return {className:'tipo-jurisdiccional',badge:'b-tipo-jurisdiccional',icon:typeIconSvg(type),label:'Jurisdiccional'};
  if(type==='Audiovisual') return {className:'tipo-audiovisual',badge:'b-tipo-audiovisual',icon:typeIconSvg(type),label:'Audiovisual'};
  if(type==='Turno') return {className:'tipo-turno',badge:'b-tipo-turno',icon:typeIconSvg(type),label:'Turno'};
  if(type==='Efeméride') return {className:'tipo-efemeride',badge:'b-tipo-efemeride',icon:typeIconSvg(type),label:'Efeméride'};
  if(type==='Ausencias') return {className:'tipo-ausencias',badge:'b-tipo-ausencias',icon:typeIconSvg(type),label:'Ausencias'};
  return {className:'tipo-otro',badge:'b-tipo-otro',icon:typeIconSvg('Otro'),label:type||'Otro'};
}

function statusEmoji(status) {
  return status==='Confirmada'?'✓':status==='Por Confirmar'?'?':status==='Boletín'?'B':status==='Redes Sociales'?'R':status==='Pendiente'?'⏳':status==='Cancelada'?'✕':'•';
}

function statusPillClass(status) {
  if(status==='Por Confirmar') return 's-por-confirmar';
  if(status==='Boletín') return 's-boletin';
  if(status==='Redes Sociales') return 's-redes';
  if(status==='Pendiente') return 's-pendiente';
  if(status==='Cancelada') return 's-cancelada';
  if(status==='Sin estado') return 's-sin-estado';
  return 's-confirmada';
}

function filterEvents(tab) {
  const today=new Date(); today.setHours(0,0,0,0);
  const tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
  let events=[...allEvents];
  if (tab==='hoy') events=events.filter(e=>sameDay(parseDate(e.FECHA),today));
  else if (tab==='manana') events=events.filter(e=>sameDay(parseDate(e.FECHA),tomorrow));
  else if (tab==='semana') {
    const dow=today.getDay();
    const monday=new Date(today); monday.setDate(today.getDate()+(dow===0?-6:1-dow));
    const sunday=new Date(monday); sunday.setDate(monday.getDate()+6); sunday.setHours(23,59,59,999);
    events=events.filter(e=>{const date=parseDate(e.FECHA);return date&&date>=today&&date<=sunday;});
  } else if (tab==='mes') {
    events=events.filter(e=>{const date=parseDate(e.FECHA);return date&&date>=today&&date.getMonth()===today.getMonth()&&date.getFullYear()===today.getFullYear();});
  } else {
    const category=CATEGORIES.find(c=>c.id===tab);
    if (category) events=events.filter(e=>{const date=parseDate(e.FECHA);return date&&date>=today&&category.keywords.some(k=>(e.DETALLE||'').toLowerCase().includes(k));});
  }
  return events;
}

function getActiveCats() {
  return CATEGORIES.filter(category=>allEvents.some(event=>category.keywords.some(k=>(event.DETALLE||'').toLowerCase().includes(k))));
}

function buildTabs() {
  const tabs=[...FIXED_TABS];
  const row=document.getElementById('tabsRow');
  row.innerHTML=tabs.map(tab=>{
    const count=filterEvents(tab.id).length;
    return `<button class="tab ${tab.id===currentTab?'active':''}" data-tab="${tab.id}" type="button">${tab.icon} ${tab.label} <span class="tab-count">${count}</span></button>`;
  }).join('');
  row.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
    currentTab=tab.dataset.tab; setView('agenda'); buildTabs(); render();
  }));
}

function updateHeaderStats() {
  const today=new Date(); today.setHours(0,0,0,0);
  const holiday=getChileHoliday(today);
  const todayEvents=allEvents.filter(event=>sameDay(parseDate(event.FECHA),today));
  const confirmed=todayEvents.filter(event=>getStatus(event)==='Confirmada').length;
  const boletin=todayEvents.filter(event=>getStatus(event)==='Boletín').length;
  const redes=todayEvents.filter(event=>getStatus(event)==='Redes Sociales').length;
  const toConfirm=todayEvents.filter(event=>getStatus(event)==='Por Confirmar').length;
  const pending=todayEvents.filter(event=>getStatus(event)==='Pendiente').length;
  const absent=todayEvents.filter(event=>isSpecialActivity(event)).length;
  document.getElementById('headerStats').innerHTML=`
    <div class="stat-chip primary"><span class="dot" style="background:#4f9c83"></span>${todayEvents.length} hoy</div>
    ${holiday?`<div class="stat-chip holiday"><span class="dot"></span>${escapeHTML(holiday.name)}</div>`:''}
    ${confirmed?`<div class="stat-chip"><span class="dot" style="background:#4f9c83"></span>${confirmed} confirmada${confirmed===1?'':'s'}</div>`:''}
    ${toConfirm?`<div class="stat-chip"><span class="dot" style="background:#7d72a7"></span>${toConfirm} por confirmar</div>`:''}
    ${boletin?`<div class="stat-chip"><span class="dot" style="background:#4f87ad"></span>${boletin} ${boletin===1?'boletín':'boletines'}</div>`:''}
    ${redes?`<div class="stat-chip"><span class="dot" style="background:#a2649c"></span>${redes} redes</div>`:''}
    ${pending?`<div class="stat-chip"><span class="dot" style="background:#b98135"></span>${pending} pendiente${pending===1?'':'s'}</div>`:''}
    ${absent?`<div class="stat-chip"><span class="dot" style="background:#7186a8"></span>${absent} ausencia${absent===1?'':'s'}</div>`:''}`;
  updateExecutiveBrief(today,todayEvents);
}

function updateExecutiveBrief(today,todayEvents) {
  const holiday=getChileHoliday(today);
  const hour=new Date().getHours();
  const greeting=hour<12?'Buenos días':hour<20?'Buenas tardes':'Buenas noches';
  const active=todayEvents.filter(event=>getStatus(event)!=='Cancelada').slice().sort(compareEventsChronologically);
  const timed=active.filter(event=>timeToMin(event.HORA)!==null);
  const absences=active.filter(event=>isSpecialActivity(event));
  const next=nextTimedEventForToday();
  const conflicts=sameTimeConflicts(active);
  const pending=active.filter(event=>['Por Confirmar','Pendiente'].includes(getStatus(event))).length;
  const kicker=today.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});

  document.getElementById('briefKicker').textContent=kicker.charAt(0).toUpperCase()+kicker.slice(1);
  document.getElementById('briefTitle').textContent=`${greeting}, Equipo Comunicaciones.`;

  let subtitle='No hay actividades registradas para hoy.';
  if(holiday){
    const count=`${active.length} ${active.length===1?'actividad':'actividades'}`;
    if(next) subtitle=`Hoy es ${holiday.name}. Tiene ${count}; la próxima comienza a las ${formatTime(next.HORA)}.`;
    else if(active.length) subtitle=`Hoy es ${holiday.name}. Tiene ${count} registrada${active.length===1?'':'s'}.`;
    else subtitle=`Hoy es feriado nacional: ${holiday.name}. No hay actividades agendadas.`;
  }else if(active.length===absences.length&&absences.length){
    subtitle='La jornada está registrada como ausencia del Equipo Comunicaciones.';
  }else if(active.length){
    const count=`${active.length} ${active.length===1?'actividad':'actividades'}`;
    if(next){
      subtitle=`Hoy tiene ${count}. La próxima actividad comienza a las ${formatTime(next.HORA)}.`;
    }else if(timed.length){
      subtitle=`Hoy tuvo ${count}. Las actividades con hora programada ya finalizaron.`;
    }else{
      subtitle=`Hoy tiene ${count}, sin hora definida.`;
    }
  }
  document.getElementById('briefSubtitle').textContent=subtitle;

  const signals=[];
  const nextStatus=next?getStatus(next):'';
  const nextNeedsReview=['Por Confirmar','Pendiente'].includes(nextStatus);
  const nextWorkflowStatus=next&&['Boletín','Redes Sociales'].includes(nextStatus);
  const additionalPending=Math.max(0,pending-(nextNeedsReview?1:0));
  const mixedAbsences=absences.length>0&&absences.length<active.length;

  if(holiday) signals.push(`<span class="brief-signal holiday"><strong>Feriado nacional</strong><span>${escapeHTML(holiday.name)}</span></span>`);
  if(next){
    const temporal=eventTemporalMeta(next);
    const statusTag=(nextNeedsReview||nextWorkflowStatus)
      ? `<span class="brief-next-status ${nextStatus==='Pendiente'?'is-pending':nextStatus==='Por Confirmar'?'is-confirm':nextStatus==='Boletín'?'is-bulletin':'is-social'}">${escapeHTML(nextStatus)}</span>`
      : '';
    signals.push(`<button class="brief-signal next" type="button" data-brief-action="next"><span class="signal-dot"></span><span class="brief-signal-copy"><span class="brief-next-heading"><strong>Próxima actividad</strong>${statusTag}</span><span class="brief-signal-detail"><b>${formatTime(next.HORA)}</b><span>${escapeHTML(expandTeamCodes(next.DETALLE))}</span></span></span><em>${temporal.label}</em></button>`);
  }
  if(conflicts.length) signals.push(`<span class="brief-signal warning"><strong>Atención</strong><span>${conflicts.length===1?'Coincidencia horaria':'Coincidencias horarias'}</span></span>`);
  if(additionalPending) signals.push(`<span class="brief-signal pending"><strong>${additionalPending}</strong><span>${additionalPending===1?'actividad adicional por revisar':'actividades adicionales por revisar'}</span></span>`);
  if(mixedAbsences) signals.push(`<span class="brief-signal absence"><strong>${absences.length}</strong><span>${absences.length===1?'ausencia registrada':'ausencias registradas'}</span></span>`);
  document.getElementById('briefSignals').innerHTML=signals.join('');
}

function renderCard(event) {
  const status=getStatus(event);
  const itemType=typeMeta(event.TIPO);
  const special=isSpecialActivity(event);
  const temporal=eventTemporalMeta(event);
  const key=escapeHTML(eventKey(event));
  const displayDetail=expandTeamCodes(event.DETALLE);
  const members=communicationMembersInText(event.DETALLE);
  const memberBadges=members.map(member=>`<span class="badge b-team-member"><span class="team-initial">${member.code}</span>${escapeHTML(member.name)}</span>`).join('');
  const temporalBadge=temporal.state==='next'
    ? `<span class="temporal-badge next"><span class="temporal-dot"></span><strong>Próxima</strong><em>${escapeHTML(temporal.label)}</em></span>`
    : temporal.state==='past'?`<span class="temporal-badge past">Finalizada</span>`:'';
  const banner=special
    ? `<div class="mode-banner mode-special"><span>AUSENCIA · EQUIPO COMUNICACIONES</span>${temporalBadge}</div>`
    : `<div class="mode-banner mode-${itemType.className}"><span class="mode-copy"><span class="mode-icon">${itemType.icon}</span> ${itemType.label}</span>${temporalBadge}</div>`;
  return `
    <article class="event-card ${itemType.className} ${special?'special':''} ${status==='Cancelada'?'cancelada':''} ${temporal.state?`temporal-${temporal.state}`:''}" data-key="${key}" data-row="${event._row||''}">
      ${banner}
      <div class="card-top">
        <div class="time-bubble ${event.HORA?'':'no-time'}"><div class="t-hour">${event.HORA?escapeHTML(formatTime(event.HORA)):'S/H'}</div></div>
        <div class="card-body">
          <div class="card-title">${escapeHTML(displayDetail)}</div>
          <div class="card-badges">
            <span class="badge ${itemType.badge}">${itemType.icon} ${escapeHTML(normalizeType(event.TIPO))}</span>
            ${memberBadges}${event.LUGAR?`<span class="badge b-lugar">🏛 ${escapeHTML(expandTeamCodes(event.LUGAR))}</span>`:''}
          </div>
        </div>
      </div>
      <div class="status-row">
        <button class="status-pill ${statusPillClass(status)}" data-key="${key}" type="button" aria-label="Cambiar estado de ${escapeHTML(displayDetail)}">
          ${statusEmoji(status)} ${escapeHTML(status)} <span class="chevron">▾</span>
        </button>
        <div class="event-actions">
          <button class="card-action edit" data-key="${key}" type="button" title="Editar actividad" aria-label="Editar ${escapeHTML(displayDetail)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
          </button>
          <button class="card-action delete" data-key="${key}" type="button" title="Eliminar actividad" aria-label="Eliminar ${escapeHTML(displayDetail)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderGroups(events) {
  if (!events.length) return `<div class="empty"><div class="icon">📭</div><p>No hay actividades<br>para este período</p></div>`;
  const grouped={};
  events.forEach(event=>{
    const key=normalizeDateKey(event.FECHA);
    if(!key) return;
    if(!grouped[key]) grouped[key]=[];
    grouped[key].push(event);
  });
  return Object.keys(grouped).sort((a,b)=>parseDate(a)-parseDate(b)).map(key=>{
    const date=parseDate(key);
    const sorted=grouped[key].slice().sort(compareEventsChronologically);
    const dayName=date?date.toLocaleDateString('es-CL',{weekday:'long'}):'';
    const dayNum=date?date.getDate():'';
    const month=date?date.toLocaleDateString('es-CL',{month:'short'}):'';
    return `<section class="date-group">
      <div class="date-header">
        <div class="date-circle"><div class="day-num">${dayNum}</div><div class="day-mon">${month}</div></div>
        <div class="date-info"><div class="day-name">${dayName}</div><div class="day-count">${sorted.length} ${sorted.length===1?'actividad':'actividades'}</div></div>
        <div class="date-divider"></div>
      </div>
      ${sorted.map(renderCard).join('')}
    </section>`;
  }).join('');
}

function formatDateKey(date){
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

function isCalendarAbsenceEvent(event){
  const status=getStatus(event);
  return status==='Ausente'||(status!=='Cancelada'&&isSpecialActivity(event));
}

function dayStatusSegments(dayEvents,{isHoliday=false}={}){
  const segments=[];
  const add=(name,label)=>{if(!segments.some(item=>item.name===name))segments.push({name,label});};
  const absenceEvents=dayEvents.filter(isCalendarAbsenceEvent);
  const taskEvents=dayEvents.filter(event=>!isCalendarAbsenceEvent(event));
  if(absenceEvents.length&&taskEvents.length&&!isHoliday) add('absence','Ausencias');
  if(taskEvents.some(event=>normalizeType(event.TIPO)==='Jurisdiccional')) add('press-jurisdiccional','Jurisdiccional');
  if(taskEvents.some(event=>normalizeType(event.TIPO)==='Actividad')) add('press-actividad','Actividad');
  if(taskEvents.some(event=>normalizeType(event.TIPO)==='Audiovisual')) add('press-audiovisual','Audiovisual');
  if(taskEvents.some(event=>normalizeType(event.TIPO)==='Turno')) add('press-turno','Turno');
  if(taskEvents.some(event=>normalizeType(event.TIPO)==='Efeméride')) add('press-efemeride','Efeméride');
  return segments.slice(0,4);
}

function selectedDayEvents(){
  if(!selectedCalDate) return [];
  const key=formatDateKey(selectedCalDate);
  return allEvents.filter(event=>normalizeDateKey(event.FECHA)===key).slice().sort(compareEventsChronologically);
}

function moveSelectedDay(delta){
  const base=selectedCalDate?new Date(selectedCalDate):new Date();
  base.setDate(base.getDate()+delta);
  base.setHours(0,0,0,0);
  selectedCalDate=base;
  calendarDate=new Date(base.getFullYear(),base.getMonth(),1);
  render();
}

function moveCalendarMonth(delta){
  calendarMotion=delta>0?'next':'prev';
  const nextMonth=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+delta,1);
  calendarDate=nextMonth;
  selectedCalDate=new Date(nextMonth);
  render();
}

function renderSelectedDayPanel(){
  const selected=selectedCalDate||new Date();
  const events=selectedDayEvents();
  const holiday=getChileHoliday(selected);
  const label=selected.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
  const isToday=sameDay(selected,new Date());
  const summary=holiday
    ? `${holiday.type} · ${events.length?`${events.length} ${events.length===1?'actividad registrada':'actividades registradas'}`:'Sin actividades agendadas'}`
    : events.length
      ? `${events.length} ${events.length===1?'actividad registrada':'actividades registradas'}`
      : 'Sin actividades registradas';
  const activeEvents=events.filter(event=>getStatus(event)!=='Cancelada');
  const first=activeEvents.find(event=>event.HORA);
  const next=isToday?nextTimedEventForToday():null;
  return `<aside class="day-panel" id="dayPanel" aria-label="Detalle del día seleccionado">
    <div class="day-panel-handle" aria-hidden="true"></div>
    <div class="day-panel-head">
      <button class="day-step" id="dayPrev" type="button" aria-label="Día anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="day-panel-copy">
        <span class="day-panel-eyebrow">${holiday?`${isToday?'Hoy · ':''}${escapeHTML(holiday.type)}`:isToday?'Hoy':'Día seleccionado'}</span>
        <h3>${label.charAt(0).toUpperCase()+label.slice(1)}</h3>
        <p>${summary}${next?` · Próxima a las ${formatTime(next.HORA)}`:first?` · Primera a las ${formatTime(first.HORA)}`:''}</p>
      </div>
      <button class="day-step" id="dayNext" type="button" aria-label="Día siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg></button>
    </div>
    ${renderHolidayDetailCard(holiday,events.length)}
    <div class="day-panel-events">
      ${events.length?events.map(renderCard).join(''):`<div class="calendar-empty-day ${holiday?'holiday-empty-day':''}"><div class="empty-orbit">${holiday?'✦':'✓'}</div><strong>${holiday?'Sin actividades agendadas':'Jornada disponible'}</strong><span>${holiday?`La jornada corresponde a ${escapeHTML(holiday.name)}.`:'No hay actividades registradas para este día.'}</span><button type="button" id="emptyAddButton">${holiday?'Agregar actividad excepcional':'Agregar actividad'}</button></div>`}
    </div>
    <div class="swipe-hint">Deslice horizontalmente para cambiar de día</div>
  </aside>`;
}

function renderCalendar() {
  const year=calendarDate.getFullYear(), month=calendarDate.getMonth();
  ensureChileHolidayYear(year);
  const today=new Date(); today.setHours(0,0,0,0);
  if(!selectedCalDate){
    selectedCalDate=(today.getMonth()===month&&today.getFullYear()===year)?new Date(today):new Date(year,month,1);
  }
  const monthName=calendarDate.toLocaleDateString('es-CL',{month:'long',year:'numeric'});
  const firstDay=new Date(year,month,1);
  let startDow=firstDay.getDay(); if(startDow===0) startDow=7;
  const lastDay=new Date(year,month+1,0);
  const monthEvents=allEvents.filter(event=>{
    const date=parseDate(event.FECHA);
    return date&&date.getMonth()===month&&date.getFullYear()===year;
  });
  const eventsByDate=new Map();
  allEvents.forEach(event=>{
    const key=normalizeDateKey(event.FECHA);
    if(!key) return;
    if(!eventsByDate.has(key)) eventsByDate.set(key,[]);
    eventsByDate.get(key).push(event);
  });
  const cells=[];
  for(let i=1;i<startDow;i++) cells.push({date:new Date(year,month,1-(startDow-i)),current:false});
  for(let day=1;day<=lastDay.getDate();day++) cells.push({date:new Date(year,month,day),current:true});
  // Seis semanas fijas: todos los meses conservan exactamente la misma altura.
  // Cinco filas no bastan para meses que comienzan al final de la semana y tienen 31 días.
  while(cells.length<42){
    const last=cells[cells.length-1].date;
    cells.push({date:new Date(last.getFullYear(),last.getMonth(),last.getDate()+1),current:false});
  }
  const cellsHTML=cells.map(cell=>{
    const key=formatDateKey(cell.date);
    const dayEvents=(eventsByDate.get(key)||[]).slice().sort(compareEventsChronologically);
    const holiday=getChileHoliday(cell.date);
    const segments=dayStatusSegments(dayEvents,{isHoliday:Boolean(holiday)});
    const hasAbsence=dayEvents.some(isCalendarAbsenceEvent);
    const isToday=sameDay(cell.date,today);
    const isSelected=selectedCalDate&&sameDay(cell.date,selectedCalDate);
    const line=segments.length?`<span class="activity-line" aria-hidden="true">${segments.map(segment=>`<i class="${segment.name}"></i>`).join('')}</span>`:'';
    const holidayLabel=holiday?`<span class="cal-holiday-label" aria-hidden="true">Feriado</span>`:'';
    const labels=[holiday?`${holiday.type}: ${holiday.name}`:'',hasAbsence&&!holiday?'Ausencia':'',...segments.map(segment=>segment.label)].filter(Boolean).join(', ');
    return `<button class="cal-cell ${!cell.current?'other-month':''} ${isToday?'today':''} ${isSelected?'selected':''} ${hasAbsence?'has-absence':''} ${holiday?'has-national-holiday':''}" data-date="${key}" type="button" aria-label="${key}${labels?`, ${labels}`:''}${dayEvents.length?`, ${dayEvents.length} actividades`:''}" aria-pressed="${Boolean(isSelected)}"><span class="cal-day-number">${cell.date.getDate()}</span>${holidayLabel}${line}</button>`;
  }).join('');
  const selectedPanel=renderSelectedDayPanel();
  return `<section class="calendar-workspace ${calendarMotion?`calendar-motion-${calendarMotion}`:''}">
    <div class="calendar-card">
      <div class="cal-header">
        <div class="cal-heading">
          <span class="cal-eyebrow">Agenda mensual</span>
          <h2 class="cal-title">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</h2>
          <span class="cal-subtitle">${monthEvents.length} ${monthEvents.length===1?'actividad':'actividades'} este mes</span>
        </div>
        <div class="cal-controls">
          <button class="cal-today-btn" id="calToday" type="button">Hoy</button>
          <div class="cal-nav-group">
            <button class="cal-nav" id="calPrev" type="button" aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg></button>
            <button class="cal-nav" id="calNext" type="button" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </div>
      <div class="cal-days-header">${['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(day=>`<span>${day}</span>`).join('')}</div>
      <div class="cal-grid" id="calGrid">${cellsHTML}</div>
      <div class="calendar-legend">
        <span><i class="legend-ring"></i>Hoy</span>
        <span><i class="legend-selected"></i>Seleccionado</span>
        <span><i class="legend-line confirmed"></i>Confirmada</span>
        <span><i class="legend-line confirm"></i>Por confirmar</span>
        <span><i class="legend-holiday-cell"></i>Feriado nacional</span>
        <span><i class="legend-absence-cell"></i>Ausencia</span>
      </div>
    </div>
    ${selectedPanel}
  </section>`;
}

function bindCalendarInteractions(){
  document.getElementById('calPrev')?.addEventListener('click',()=>moveCalendarMonth(-1));
  document.getElementById('calNext')?.addEventListener('click',()=>moveCalendarMonth(1));
  document.getElementById('calToday')?.addEventListener('click',()=>{
    const today=new Date(); today.setHours(0,0,0,0);
    selectedCalDate=today;
    calendarDate=new Date(today.getFullYear(),today.getMonth(),1);
    render();
  });

  const grid=document.getElementById('calGrid');
  if(grid){
    const gesture={startX:0,startY:0,lastX:0,lastY:0,horizontal:false};
    grid.addEventListener('touchstart',event=>{
      const touch=event.changedTouches[0];
      gesture.startX=touch?.clientX||0;
      gesture.startY=touch?.clientY||0;
      gesture.lastX=gesture.startX;
      gesture.lastY=gesture.startY;
      gesture.horizontal=false;
    },{passive:true});

    grid.addEventListener('touchmove',event=>{
      const touch=event.changedTouches[0];
      gesture.lastX=touch?.clientX||gesture.lastX;
      gesture.lastY=touch?.clientY||gesture.lastY;
      const dx=gesture.lastX-gesture.startX;
      const dy=gesture.lastY-gesture.startY;
      if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.12){
        gesture.horizontal=true;
        event.preventDefault();
      }
    },{passive:false});

    grid.addEventListener('touchend',event=>{
      const touch=event.changedTouches[0];
      const endX=touch?.clientX??gesture.lastX;
      const endY=touch?.clientY??gesture.lastY;
      const dx=endX-gesture.startX;
      const dy=endY-gesture.startY;
      const isSwipe=gesture.horizontal&&Math.abs(dx)>54&&Math.abs(dx)>Math.abs(dy)*1.12;
      if(isSwipe){
        event.preventDefault();
        calendarSwipeLockUntil=Date.now()+760;
        moveCalendarMonth(dx<0?1:-1);
      }
      gesture.horizontal=false;
    },{passive:false});

    grid.addEventListener('touchcancel',()=>{
      gesture.horizontal=false;
      calendarSwipeLockUntil=Date.now()+180;
    },{passive:true});

    grid.addEventListener('click',event=>{
      if(Date.now()<calendarSwipeLockUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const cell=event.target.closest('.cal-cell');
      if(!cell?.dataset.date) return;
      const [d,m,y]=cell.dataset.date.split('/').map(Number);
      selectedCalDate=new Date(y,m-1,d);
      calendarDate=new Date(y,m-1,1);
      render();
    });
  }

  document.getElementById('dayPrev')?.addEventListener('click',()=>moveSelectedDay(-1));
  document.getElementById('dayNext')?.addEventListener('click',()=>moveSelectedDay(1));
  document.getElementById('emptyAddButton')?.addEventListener('click',()=>{
    openActivityModal('add');
    if(selectedCalDate) document.getElementById('fFecha').value=dateToInput(formatDateKey(selectedCalDate));
  });

  const panel=document.getElementById('dayPanel');
  if(panel){
    let startX=0,startY=0;
    panel.addEventListener('touchstart',event=>{
      startX=event.changedTouches[0]?.clientX||0;
      startY=event.changedTouches[0]?.clientY||0;
    },{passive:true});
    panel.addEventListener('touchend',event=>{
      const endX=event.changedTouches[0]?.clientX||0;
      const endY=event.changedTouches[0]?.clientY||0;
      const dx=endX-startX,dy=endY-startY;
      if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.25) moveSelectedDay(dx<0?1:-1);
    },{passive:true});
  }
}

function bindBriefActions(){
  document.querySelector('[data-brief-action="next"]')?.addEventListener('click',()=>{
    const next=nextTimedEventForToday();
    if(!next) return;
    selectedCalDate=todayAtMidnight();
    calendarDate=new Date(selectedCalDate.getFullYear(),selectedCalDate.getMonth(),1);
    setView('calendario');
    render();
    window.setTimeout(()=>document.querySelector('.day-panel-events .event-card.temporal-next')?.scrollIntoView({behavior:'smooth',block:'center'}),120);
  });
}

function render() {
  const content=document.getElementById('content');
  const timestamp=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  let html=`<div class="updated-bar"><span class="live-dot"></span>Sincronizado a las ${timestamp}</div>`;
  if(currentView==='calendario') html+=renderCalendar();
  else if(currentView==='mes') html+=renderGroups(filterEvents('mes'));
  else html+=renderGroups(filterEvents(currentTab));
  content.innerHTML=html;
  bindCardActions();
  if(currentView==='calendario') {
    bindCalendarInteractions();
    bindHolidayActions();
    if(calendarMotion) window.setTimeout(()=>{calendarMotion='';},360);
  }
  bindBriefActions();
}

function findEventByKey(key) { return allEvents.find(event=>eventKey(event)===key); }

function closeDropdown() {
  if (activeDropdown) { activeDropdown.remove(); activeDropdown=null; }
}

document.addEventListener('click',closeDropdown);

function openStatusDropdown(pill,event) {
  closeDropdown();
  const current=getStatus(event);
  const dropdown=document.createElement('div');
  dropdown.className='status-dropdown';
  dropdown.innerHTML=STATUS_OPTIONS.map(option=>`<button class="status-option" data-status="${option.s}" type="button" style="color:${option.color}"><span class="opt-dot" style="background:${option.dot}"></span>${option.icon} ${option.s}${current===option.s?' ✔':''}</button>`).join('');
  document.body.appendChild(dropdown);
  const rect=pill.getBoundingClientRect();
  const width=Math.min(248,window.innerWidth-20);
  dropdown.style.width=`${width}px`;
  const height=dropdown.offsetHeight;
  dropdown.style.top=(rect.bottom+6+height>window.innerHeight?Math.max(10,rect.top-height-6):rect.bottom+6)+'px';
  dropdown.style.left=Math.max(10,Math.min(rect.left,window.innerWidth-width-10))+'px';
  activeDropdown=dropdown;
  dropdown.querySelectorAll('.status-option').forEach(option=>option.addEventListener('click',async click=>{
    click.stopPropagation();
    const newStatus=option.dataset.status;
    closeDropdown();
    showToast('Guardando estado…');
    try {
      const result=await sendScriptAction('estado',{fila:event._row,fecha:event.FECHA,hora:event.HORA,detalle:event.DETALLE,estado:newStatus});
      event._row=Number(result.row)||event._row;
      event.ESTADO=newStatus;
      updateHeaderStats(); buildTabs(); render();
      haptic(18); showToast(`✓ Estado actualizado: ${newStatus}`);
      scheduleRefresh();
    } catch (error) {
      showToast(`⚠️ ${error.message||'No fue posible sincronizar el estado'}`);
    }
  }));
}

function bindCardActions() {
  document.querySelectorAll('.status-pill').forEach(pill=>pill.addEventListener('click',event=>{
    event.stopPropagation(); const item=findEventByKey(pill.dataset.key); if(item) openStatusDropdown(pill,item);
  }));
  document.querySelectorAll('.card-action.edit').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation(); const item=findEventByKey(button.dataset.key); if(item) openActivityModal('edit',item);
  }));
  document.querySelectorAll('.card-action.delete').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation(); const item=findEventByKey(button.dataset.key); if(item) openDeleteModal(item);
  }));
}

function setView(view) {
  currentView=view;
  document.body.dataset.view=view;
  document.body.classList.remove('header-collapsed');
  adaptiveHeaderPinnedOpenAt=null;
  document.querySelectorAll('.nav-btn:not(.nav-add)').forEach(button=>button.classList.remove('active'));
  const map={agenda:'navAgenda',calendario:'navCalendar',buscar:'navSearch',mes:'navMes'};
  document.getElementById(map[view])?.classList.add('active');
  const searchInfo=document.getElementById('searchInfo');
  const searchBar=document.querySelector('.search-bar');
  if (view==='buscar') { searchBar.style.display='flex'; setTimeout(()=>searchInput.focus(),50); }
  else searchBar.style.display='';
  searchInfo.style.display='none';
  searchInput.value='';
  if (view==='calendario') {
    requestAnimationFrame(() => {
      window.scrollTo({top:0,behavior:'smooth'});
      updateAdaptiveHeader({forceExpanded:true});
    });
  } else {
    updateAdaptiveHeader({forceExpanded:true});
  }
}

document.getElementById('navAgenda').addEventListener('click',()=>{currentTab='hoy';setView('agenda');buildTabs();render();});
document.getElementById('navCalendar').addEventListener('click',()=>{setView('calendario');render();});
document.getElementById('navMes').addEventListener('click',()=>{setView('mes');render();});
document.getElementById('navSearch').addEventListener('click',()=>setView('buscar'));
document.getElementById('briefCalendarButton')?.addEventListener('click',()=>{setView('calendario');render();});

const activityModal=document.getElementById('activityModal');
const timePickerModal=document.getElementById('timePickerModal');
const deleteModal=document.getElementById('deleteModal');
const createChoiceModal=document.getElementById('createChoiceModal');
const holidayModal=document.getElementById('holidayModal');
const holidayDeleteModal=document.getElementById('holidayDeleteModal');
let editingHoliday=null;
let pendingHolidayDelete=null;
const hiddenTimeInput=document.getElementById('fHora');
const timeFieldValue=document.getElementById('timeFieldValue');
const timePickerHour=document.getElementById('timePickerHour');
const timePickerMinute=document.getElementById('timePickerMinute');
let timePickerTotalMinutes=9*60;

function setActivityTime(value=''){
  const normalized=/^\d{2}:\d{2}$/.test(value)?value:'';
  hiddenTimeInput.value=normalized;
  timeFieldValue.textContent=normalized||'Sin hora';
  document.querySelectorAll('.time-shortcuts button').forEach(button=>{
    button.classList.toggle('active',button.dataset.time===normalized);
  });
}

let voiceCreateContext=null;

function resetActivityForm() {
  ['fDetalle','fLugar'].forEach(id=>document.getElementById(id).value='');
  setActivityTime('');
  document.getElementById('fTipo').value='Actividad';
  document.getElementById('fEstado').value='Confirmada';
  document.getElementById('formMsg').textContent='';
  hideVoiceCreatePreview();
  if(fVoiceParticipants) fVoiceParticipants.value='';
  if(voiceParticipantsReview) voiceParticipantsReview.hidden=true;
  voiceCreateContext=null;
}

function openActivityModal(mode,event=null) {
  editingEvent=mode==='edit'?event:null;
  resetActivityForm();
  const title=document.getElementById('activityModalTitle');
  const subtitle=document.getElementById('activityModalSubtitle');
  const save=document.getElementById('btnGuardar');
  if (editingEvent) {
    title.textContent='✏️ Editar actividad';
    subtitle.textContent='Modifica la fecha, tipo, detalle, estado y demás antecedentes.';
    save.textContent='Guardar cambios';
    document.getElementById('fFecha').value=dateToInput(editingEvent.FECHA);
    setActivityTime(formatTime(editingEvent.HORA));
    document.getElementById('fDetalle').value=editingEvent.DETALLE||'';
    document.getElementById('fTipo').value=normalizeType(editingEvent.TIPO);
    document.getElementById('fEstado').value=getStatus(editingEvent);
    document.getElementById('fLugar').value=editingEvent.LUGAR||'';
  } else {
    title.textContent='➕ Nueva actividad'; subtitle.textContent='Registra la pauta, cobertura o tarea de comunicaciones.'; save.textContent='Guardar actividad';
    document.getElementById('fFecha').value=new Date().toISOString().split('T')[0];
  }
  activityModal.classList.add('open');
  setTimeout(()=>document.getElementById('fDetalle').focus(),280);
}

function closeActivityModal() {
  activityModal.classList.remove('open');
  timePickerModal.classList.remove('open');
  editingEvent=null;
  if(activityDictationRecognition?.isActive?.()) activityDictationRecognition.stop();
}

document.getElementById('navAdd').addEventListener('click',openCreateChoiceModal);
document.getElementById('btnCancelarModal').addEventListener('click',closeActivityModal);
document.getElementById('btnCloseActivityModal').addEventListener('click',closeActivityModal);

activityModal.addEventListener('click',event=>{if(event.target===activityModal)closeActivityModal();});



function hideVoiceCreatePreview(){const p=document.getElementById('voiceCreatePreview');if(p)p.hidden=true;}
function voiceValueLabel(label,value){return value?`<span class="voice-preview-chip"><b>${escapeHTML(label)}</b>${escapeHTML(value)}</span>`:'';}
function showVoiceCreatePreview(parsed){
  const p=document.getElementById('voiceCreatePreview'),c=document.getElementById('voicePreviewChips'),t=document.getElementById('voicePreviewTranscript');if(!p||!c||!t)return;
  const d=parsed.data||{},people=d.PARTICIPANTES||parsed.meta?.people||'';
  c.innerHTML=[voiceValueLabel('Actividad',d.DETALLE),voiceValueLabel('Fecha',d.FECHA),voiceValueLabel('Hora',d.HORA||'Sin hora'),voiceValueLabel('Lugar',d.LUGAR),voiceValueLabel('Participantes',people),voiceValueLabel('Tipo',d.TIPO),voiceValueLabel('Estado',d.ESTADO)].filter(Boolean).join('');
  t.textContent=`“${parsed.raw}”`;p.hidden=false;
}
function applyVoiceCreateResult(parsed){
  if(!parsed||parsed.intent!=='create'){showToast('No pude interpretar el dictado como una nueva actividad.');return false;}
  openActivityModal('add');const d=parsed.data||{},people=(d.PARTICIPANTES||parsed.meta?.people||'').trim();
  voiceCreateContext={participants:people,raw:parsed.raw||''};
  document.getElementById('fFecha').value=d.FECHA?dateToInput(d.FECHA):'';
  setActivityTime(d.HORA||'');
  document.getElementById('fDetalle').value=d.DETALLE||'';
  document.getElementById('fTipo').value=normalizeType(d.TIPO||'Actividad');
  document.getElementById('fEstado').value=normalizeStatus(d.ESTADO||'Por Confirmar');
  document.getElementById('fLugar').value=d.LUGAR||'';
  if(fVoiceParticipants)fVoiceParticipants.value=people;
  if(voiceParticipantsReview)voiceParticipantsReview.hidden=false;
  showVoiceCreatePreview(parsed);
  const missing=(parsed.missing||[]).map(item=>item==='fecha'?'fecha obligatoria':item==='detalle'?'nombre de actividad obligatorio':item);
  const warnings=parsed.warnings||[],issues=[...missing,...warnings];
  document.getElementById('formMsg').textContent=issues.length?`⚠️ Revise antes de guardar: ${issues.join(' · ')}`:'✓ Dictado interpretado. Revise cada campo y pulse Guardar actividad.';
  return true;
}
function parseAndPreviewVoiceActivity(text){
  if(!window.AgendaVoiceCreate){showToast('El intérprete de voz no está disponible.');return false;}
  return applyVoiceCreateResult(window.AgendaVoiceCreate.parse(text,{now:new Date(),forceCreate:true}));
}

function openCreateChoiceModal(){
  createChoiceModal?.classList.add('open');
}
function closeCreateChoiceModal(){
  createChoiceModal?.classList.remove('open');
}

document.getElementById('btnCloseCreateChoice')?.addEventListener('click',closeCreateChoiceModal);
createChoiceModal?.addEventListener('click',event=>{if(event.target===createChoiceModal)closeCreateChoiceModal();});
document.getElementById('createActivityChoice')?.addEventListener('click',()=>{
  closeCreateChoiceModal();
  openActivityModal('add');
});
document.getElementById('createHolidayChoice')?.addEventListener('click',()=>{
  closeCreateChoiceModal();
  openHolidayModal('add');
});

function defaultHolidayScope(type){
  return type==='Feriado regional'?'Región de Coquimbo':'Nacional';
}
function resetHolidayForm(){
  document.getElementById('hFecha').value='';
  document.getElementById('hNombre').value='';
  document.getElementById('hTipo').value='Feriado nacional';
  document.getElementById('hAlcance').value='Nacional';
  document.getElementById('hFuente').value='';
  document.getElementById('holidayFormMsg').textContent='';
}
function openHolidayModal(mode='add',holiday=null){
  editingHoliday=mode==='edit'?holiday:null;
  resetHolidayForm();
  const title=document.getElementById('holidayModalTitle');
  const subtitle=document.getElementById('holidayModalSubtitle');
  const save=document.getElementById('btnGuardarFeriado');

  if(editingHoliday){
    title.textContent='Editar feriado';
    subtitle.textContent='Actualice solo fechas oficialmente confirmadas.';
    save.textContent='Guardar cambios';
    document.getElementById('hFecha').value=dateToInput(editingHoliday.date);
    document.getElementById('hNombre').value=editingHoliday.name||'';
    document.getElementById('hTipo').value=editingHoliday.type||'Feriado nacional';
    document.getElementById('hAlcance').value=editingHoliday.scope||defaultHolidayScope(editingHoliday.type);
    document.getElementById('hFuente').value=editingHoliday.source||'';
  }else{
    title.textContent='Agregar feriado';
    subtitle.textContent='Registre únicamente una fecha oficialmente confirmada.';
    save.textContent='Guardar feriado';
    const base=selectedCalDate||new Date();
    document.getElementById('hFecha').value=dateToInput(formatDateKey(base));
  }
  holidayModal.classList.add('open');
  setTimeout(()=>document.getElementById('hNombre')?.focus(),240);
}
function closeHolidayModal(){
  holidayModal?.classList.remove('open');
  editingHoliday=null;
}
document.getElementById('btnCloseHolidayModal')?.addEventListener('click',closeHolidayModal);
document.getElementById('btnCancelarFeriado')?.addEventListener('click',closeHolidayModal);
holidayModal?.addEventListener('click',event=>{if(event.target===holidayModal)closeHolidayModal();});

document.getElementById('hTipo')?.addEventListener('change',event=>{
  const scope=document.getElementById('hAlcance');
  if(!scope.value.trim()||['Nacional','Región de Coquimbo'].includes(scope.value.trim())){
    scope.value=defaultHolidayScope(event.target.value);
  }
});

function holidayPayloadFromForm(){
  const input=document.getElementById('hFecha').value;
  const type=document.getElementById('hTipo').value;
  return {
    fecha:normalizeDateKey(inputToDate(input)),
    nombre:document.getElementById('hNombre').value.trim(),
    tipo:type,
    alcance:document.getElementById('hAlcance').value.trim()||defaultHolidayScope(type),
    fuente:document.getElementById('hFuente').value.trim()||'Registro manual desde Agenda Comunicaciones'
  };
}

document.getElementById('btnGuardarFeriado')?.addEventListener('click',async()=>{
  const data=holidayPayloadFromForm();
  const message=document.getElementById('holidayFormMsg');
  const button=document.getElementById('btnGuardarFeriado');

  if(!data.fecha||!data.nombre){
    message.textContent='⚠️ Complete la fecha y el nombre del feriado.';
    return;
  }

  button.disabled=true;
  button.textContent=editingHoliday?'Guardando cambios…':'Guardando…';
  message.textContent='';

  try{
    if(editingHoliday){
      await sendScriptAction('feriado_editar',{
        fila:editingHoliday._row,
        fechaOriginal:editingHoliday.date,
        nombreOriginal:editingHoliday.name,
        fecha:data.fecha,
        nombre:data.nombre,
        tipo:data.tipo,
        alcance:data.alcance,
        fuente:data.fuente
      });
      showToast('✓ Feriado actualizado');
    }else{
      await sendScriptAction('feriado_nuevo',data);
      showToast('✓ Feriado agregado');
    }

    closeHolidayModal();
    officialHolidaySheetSyncStarted=false;
    await syncOfficialChileHolidaysFromSheet();

    const date=parseDate(data.fecha);
    if(date){
      selectedCalDate=new Date(date);
      calendarDate=new Date(date.getFullYear(),date.getMonth(),1);
      setView('calendario');
    }
    haptic([18,35,18]);
    updateHeaderStats();
    render();
  }catch(error){
    message.textContent=`⚠️ ${error.message||'No fue posible guardar el feriado.'}`;
  }finally{
    button.disabled=false;
    button.textContent=editingHoliday?'Guardar cambios':'Guardar feriado';
  }
});

function findHolidayByDate(dateKey){
  const date=parseDate(dateKey);
  return date?getChileHoliday(date):null;
}
function bindHolidayActions(){
  document.querySelectorAll('.edit-holiday').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation();
    const holiday=findHolidayByDate(button.dataset.holidayDate);
    if(holiday&&!holiday.protected) openHolidayModal('edit',holiday);
  }));
  document.querySelectorAll('.delete-holiday').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation();
    const holiday=findHolidayByDate(button.dataset.holidayDate);
    if(!holiday||holiday.protected) return;
    pendingHolidayDelete=holiday;
    document.getElementById('holidayDeleteName').textContent=`“${holiday.name}”`;
    document.getElementById('holidayDeleteMsg').textContent='';
    holidayDeleteModal.classList.add('open');
  }));
}
function closeHolidayDeleteModal(){
  holidayDeleteModal?.classList.remove('open');
  pendingHolidayDelete=null;
}
document.getElementById('btnCloseHolidayDelete')?.addEventListener('click',closeHolidayDeleteModal);
document.getElementById('btnCancelHolidayDelete')?.addEventListener('click',closeHolidayDeleteModal);
holidayDeleteModal?.addEventListener('click',event=>{if(event.target===holidayDeleteModal)closeHolidayDeleteModal();});

document.getElementById('btnConfirmHolidayDelete')?.addEventListener('click',async()=>{
  if(!pendingHolidayDelete) return;
  const holiday={...pendingHolidayDelete};
  const button=document.getElementById('btnConfirmHolidayDelete');
  const message=document.getElementById('holidayDeleteMsg');
  button.disabled=true;
  button.textContent='Eliminando…';
  message.textContent='';

  try{
    await sendScriptAction('feriado_eliminar',{fila:holiday._row,fecha:holiday.date,nombre:holiday.name});
    closeHolidayDeleteModal();
    officialHolidaySheetSyncStarted=false;
    await syncOfficialChileHolidaysFromSheet();
    haptic(28);
    showToast('✓ Feriado eliminado');
    updateHeaderStats();
    render();
  }catch(error){
    message.textContent=`⚠️ ${error.message||'No fue posible eliminar el feriado.'}`;
  }finally{
    button.disabled=false;
    button.textContent='Sí, eliminar feriado';
  }
});

function clampTimePart(value,min,max){
  const number=Number.parseInt(value,10);
  return Number.isFinite(number)?Math.min(max,Math.max(min,number)):min;
}

function roundToFive(value){
  return Math.min(55,Math.max(0,Math.round(value/5)*5));
}

function syncTimePickerFields(){
  const total=((timePickerTotalMinutes%(24*60))+(24*60))%(24*60);
  const hour=Math.floor(total/60);
  const minute=total%60;
  timePickerHour.value=String(hour).padStart(2,'0');
  timePickerMinute.value=String(minute).padStart(2,'0');
}

function readTimePickerFields(){
  const hour=clampTimePart(timePickerHour.value,0,23);
  const minute=roundToFive(clampTimePart(timePickerMinute.value,0,59));
  timePickerTotalMinutes=hour*60+minute;
  syncTimePickerFields();
}

function defaultPickerTime(){
  const current=new Date();
  const rounded=Math.ceil((current.getHours()*60+current.getMinutes())/15)*15;
  return rounded%(24*60);
}

function openTimePicker(){
  if(hiddenTimeInput.value){
    const [hour,minute]=hiddenTimeInput.value.split(':').map(Number);
    timePickerTotalMinutes=hour*60+minute;
  }else{
    timePickerTotalMinutes=defaultPickerTime();
  }
  document.activeElement?.blur?.();
  syncTimePickerFields();
  timePickerModal.classList.add('open');
  requestAnimationFrame(()=>{
    const modal=timePickerModal.querySelector('.time-picker-modal');
    if(modal) modal.scrollTop=0;
  });
}

function closeTimePicker(){
  timePickerHour.blur();
  timePickerMinute.blur();
  timePickerModal.classList.remove('open');
}

document.getElementById('timeFieldButton').addEventListener('click',openTimePicker);
document.getElementById('btnCloseTimePicker').addEventListener('click',closeTimePicker);
document.getElementById('btnCancelTimePicker').addEventListener('click',closeTimePicker);
timePickerModal.addEventListener('click',event=>{if(event.target===timePickerModal)closeTimePicker();});

document.getElementById('timeMinus15').addEventListener('click',()=>{
  readTimePickerFields();
  timePickerTotalMinutes=(timePickerTotalMinutes-15+24*60)%(24*60);
  syncTimePickerFields();
});
document.getElementById('timePlus15').addEventListener('click',()=>{
  readTimePickerFields();
  timePickerTotalMinutes=(timePickerTotalMinutes+15)%(24*60);
  syncTimePickerFields();
});
timePickerHour.addEventListener('change',readTimePickerFields);
timePickerMinute.addEventListener('change',readTimePickerFields);
[timePickerHour,timePickerMinute].forEach(input=>input.addEventListener('focus',()=>{
  window.setTimeout(()=>input.scrollIntoView({block:'center',behavior:'smooth'}),180);
}));

document.querySelectorAll('[data-picker-time]').forEach(button=>button.addEventListener('click',()=>{
  const [hour,minute]=button.dataset.pickerTime.split(':').map(Number);
  timePickerTotalMinutes=hour*60+minute;
  syncTimePickerFields();
}));

document.getElementById('btnClearTime').addEventListener('click',()=>{
  setActivityTime('');
  closeTimePicker();
});
document.getElementById('btnConfirmTime').addEventListener('click',()=>{
  readTimePickerFields();
  const hour=Math.floor(timePickerTotalMinutes/60);
  const minute=timePickerTotalMinutes%60;
  setActivityTime(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
  closeTimePicker();
});
document.querySelectorAll('.time-shortcuts button').forEach(button=>button.addEventListener('click',()=>{
  setActivityTime(button.dataset.time||'');
}));


function getFormEvent() {
  const inputDate=document.getElementById('fFecha').value;
  const baseDetail=document.getElementById('fDetalle').value.trim();
  const participants=voiceCreateContext?(fVoiceParticipants?.value||'').trim():'';
  const participantSuffix=participants?` · Participan: ${participants}`:'';
  const detail=participants&&!baseDetail.toLocaleLowerCase('es-CL').includes(`participan: ${participants}`.toLocaleLowerCase('es-CL'))?`${baseDetail}${participantSuffix}`:baseDetail;
  return {
    FECHA:normalizeDateKey(inputToDate(inputDate)),
    'DÍA':dayNameFromInput(inputDate),
    HORA:normalizeTimeValue(document.getElementById('fHora').value),
    TIPO:normalizeType(document.getElementById('fTipo').value),
    DETALLE:detail,
    LUGAR:document.getElementById('fLugar').value.trim(),
    ESTADO:normalizeStatus(document.getElementById('fEstado').value),
  };
}

document.getElementById('btnGuardar').addEventListener('click',async()=>{
  const data=getFormEvent();
  const message=document.getElementById('formMsg');
  const button=document.getElementById('btnGuardar');
  if (!data.FECHA||!data.DETALLE) { message.textContent='⚠️ Completa la fecha y el detalle.'; return; }
  if(data.DETALLE.length>460){message.textContent='⚠️ El detalle más participantes es demasiado extenso. Redúzcalo antes de guardar.';return;}
  button.disabled=true; button.textContent=editingEvent?'Guardando cambios…':'Guardando…'; message.textContent='';
  try {
    if (editingEvent) {
      const original={...editingEvent};
      const result=await sendScriptAction('editar',{
        fila:original._row,fechaOriginal:original.FECHA,horaOriginal:original.HORA,detalleOriginal:original.DETALLE,
        fecha:data.FECHA,dia:data['DÍA'],hora:data.HORA,tipo:data.TIPO,detalle:data.DETALLE,
        lugar:data.LUGAR,estado:data.ESTADO
      });
      Object.assign(editingEvent,data);
      editingEvent._row=Number(result.row)||editingEvent._row;
      haptic([18,35,18]); showToast('✓ Actividad actualizada');
    } else {
      const result=await sendScriptAction('nueva',{
        fecha:data.FECHA,dia:data['DÍA'],hora:data.HORA,tipo:data.TIPO,detalle:data.DETALLE,
        lugar:data.LUGAR,estado:data.ESTADO
      });
      const tempRow=Math.max(1,...allEvents.map(e=>Number(e._row)||1))+1;
      allEvents.push({...data,_row:Number(result.row)||tempRow});
      haptic([18,35,18]); showToast('✓ Actividad creada');
    }
    closeActivityModal(); updateHeaderStats(); buildTabs(); render(); scheduleActivityReminders(); sweepDueReminders(); scheduleRefresh();
  } catch (error) {
    message.textContent=`⚠️ ${error.message||'No fue posible sincronizar con la planilla.'}`;
  } finally {
    button.disabled=false; button.textContent=editingEvent?'Guardar cambios':'Guardar actividad';
  }
});


function normalizedEventIdentity(event){
  return {
    fecha:normalizeDateKey(event?.FECHA),
    hora:normalizeTimeValue(event?.HORA),
    tipo:normalizeType(event?.TIPO),
    detalle:String(event?.DETALLE||'').trim().toLocaleLowerCase('es-CL').replace(/\s+/g,' '),
    lugar:String(event?.LUGAR||'').trim().toLocaleLowerCase('es-CL').replace(/\s+/g,' ')
  };
}

function sameEventIdentity(a,b){
  const left=normalizedEventIdentity(a);
  const right=normalizedEventIdentity(b);
  return left.fecha===right.fecha&&
    left.hora===right.hora&&
    left.tipo===right.tipo&&
    left.detalle===right.detalle&&
    left.lugar===right.lugar;
}

function isRowLookupError(error){
  return /localizar la actividad|no contiene actividades|fila/i.test(String(error?.message||''));
}

async function refreshAndResolveEvent(reference){
  await loadData({silent:true});
  const exact=allEvents.find(event=>sameEventIdentity(event,reference));
  if(exact) return exact;
  const target=normalizedEventIdentity(reference);
  return allEvents.find(event=>{
    const candidate=normalizedEventIdentity(event);
    return candidate.fecha===target.fecha&&
      candidate.hora===target.hora&&
      candidate.detalle===target.detalle;
  })||null;
}

function openDeleteModal(event) {
  pendingDeleteEvent=event;
  document.getElementById('deleteActivityName').textContent=`“${expandTeamCodes(event.DETALLE)}”`;
  document.getElementById('deleteMsg').textContent='';
  deleteModal.classList.add('open');
}

function closeDeleteModal() { deleteModal.classList.remove('open'); pendingDeleteEvent=null; }

document.getElementById('btnCloseDeleteModal').addEventListener('click',closeDeleteModal);
document.getElementById('btnCancelDelete').addEventListener('click',closeDeleteModal);
deleteModal.addEventListener('click',event=>{if(event.target===deleteModal)closeDeleteModal();});

document.getElementById('btnConfirmDelete').addEventListener('click',async()=>{
  if(!pendingDeleteEvent) return;
  const item={...pendingDeleteEvent};
  const button=document.getElementById('btnConfirmDelete');
  const message=document.getElementById('deleteMsg');
  button.disabled=true;
  button.textContent='Eliminando…';
  message.textContent='';
  try{
    let resolved=item;
    try{
      await sendScriptAction('eliminar',{
        fila:resolved._row,
        fecha:resolved.FECHA,
        hora:resolved.HORA,
        detalle:resolved.DETALLE
      });
    }catch(firstError){
      if(!isRowLookupError(firstError)) throw firstError;
      message.textContent='Verificando la actividad en la planilla…';
      resolved=await refreshAndResolveEvent(item);
      if(!resolved) throw firstError;

      // Tras actualizar desde Apps Script, la fila corresponde a la posición real
      // de la planilla. El envío exclusivo de la fila mantiene compatibilidad
      // con implementaciones anteriores de Apps Script.
      await sendScriptAction('eliminar',{fila:resolved._row});
    }

    const deletedRow=Number(resolved._row);
    let removed=false;
    allEvents=allEvents.filter(event=>{
      if(removed) return true;
      const sameRow=deletedRow&&Number(event._row)===deletedRow;
      if(sameRow&&sameEventIdentity(event,resolved)){
        removed=true;
        return false;
      }
      return true;
    });
    closeDeleteModal();
    updateHeaderStats();
    buildTabs();
    render();
    haptic(28);
    showToast('✓ Actividad eliminada');
    scheduleRefresh();
  }catch(error){
    message.textContent=`⚠️ ${error.message||'No fue posible eliminar la actividad.'}`;
  }finally{
    button.disabled=false;
    button.textContent='Sí, eliminar actividad';
  }
});

function sendScriptAction(action,params={}) {
  if (!SCRIPT_URL) return Promise.reject(new Error('SCRIPT_URL no configurada'));
  return new Promise((resolve,reject)=>{
    const callbackName=`__agenda_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    const query=new URLSearchParams({
      accion:action,
      requestId:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      callback:callbackName
    });
    Object.entries(params).forEach(([key,value])=>query.set(key,value??''));

    const script=document.createElement('script');
    let finished=false;
    const cleanup=()=>{
      if(finished) return;
      finished=true;
      clearTimeout(timer);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName]=undefined; }
    };
    const fail=message=>{ cleanup(); reject(new Error(message)); };
    const timer=setTimeout(()=>fail('La planilla no respondió. Revisa la conexión o la implementación de Apps Script.'),15000);

    window[callbackName]=payload=>{
      if(payload&&payload.ok){ cleanup(); resolve(payload); }
      else fail(payload?.error||'Google Sheets rechazó la operación.');
    };
    script.onerror=()=>fail('No fue posible conectar con Google Apps Script.');
    script.src=`${SCRIPT_URL}?${query.toString()}`;
    document.body.appendChild(script);
  });
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>loadData({silent:true}),2200);
}

const MESES={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11};
const NUMEROS={uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciséis:16,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,'veintidós':22,veintidos:22,'veintitrés':23,veintitres:23,veinticuatro:24,veinticinco:25,'veintiséis':26,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,'treinta y uno':31};
const WEEKDAYS={domingo:0,lunes:1,martes:2,miércoles:3,miercoles:3,jueves:4,viernes:5,sábado:6,sabado:6};

function nextWeekdayDate(dayIndex){
  const today=todayAtMidnight();
  let delta=(dayIndex-today.getDay()+7)%7;
  if(delta===0) delta=7;
  const date=new Date(today); date.setDate(today.getDate()+delta); return date;
}

function parseSpanishQuery(query) {
  const lower=query.toLowerCase().trim(); let targetDate=null;
  const today=todayAtMidnight();
  if(/\bpasado mañana\b/.test(lower)){ targetDate=new Date(today); targetDate.setDate(today.getDate()+2); }
  else if(/\bmañana\b/.test(lower)){ targetDate=new Date(today); targetDate.setDate(today.getDate()+1); }
  else if(/\bhoy\b/.test(lower)){ targetDate=today; }
  for (const [word,number] of Object.entries(NUMEROS)) {
    for (const [monthName,monthNumber] of Object.entries(MESES)) {
      if (lower.includes(`${word} de ${monthName}`)||lower.includes(`${word} ${monthName}`)) { targetDate=new Date(new Date().getFullYear(),monthNumber,number); break; }
    }
    if (targetDate) break;
  }
  if (!targetDate) { const match=lower.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)/); if(match&&MESES[match[2]]!==undefined)targetDate=new Date(new Date().getFullYear(),MESES[match[2]],Number(match[1])); }
  if (!targetDate) { const match=lower.match(/(\d{1,2})[\/-](\d{1,2})/); if(match)targetDate=new Date(new Date().getFullYear(),Number(match[2])-1,Number(match[1])); }
  if (!targetDate) {
    const weekday=Object.keys(WEEKDAYS).find(name=>new RegExp(`\\b${name}\\b`).test(lower));
    if(weekday) targetDate=nextWeekdayDate(WEEKDAYS[weekday]);
  }
  return {targetDate,rawQuery:lower};
}

function hasExplicitDateExpression(query){
  const lower=String(query||'').toLowerCase();
  const monthNames=Object.keys(MESES).join('|');
  const numberWords=Object.keys(NUMEROS).sort((a,b)=>b.length-a.length).map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  return new RegExp(`(?:\\b\\d{1,2}\\s*(?:de\\s+)?(?:${monthNames})\\b)|(?:\\b(?:${numberWords})\\s+(?:de\\s+)?(?:${monthNames})\\b)|(?:\\b\\d{1,2}[/-]\\d{1,2}\\b)`).test(lower);
}

function formatVoiceDate(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime())) return '';
  const text=date.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
  return text.charAt(0).toUpperCase()+text.slice(1);
}

function searchEvents(query) {
  if (!query.trim()) return null;
  const {targetDate,rawQuery}=parseSpanishQuery(query);
  let base=[...allEvents];
  if (/\b(esta semana|semana)\b/.test(rawQuery)&&!targetDate) base=filterEvents('semana');
  else if (targetDate) base=base.filter(event=>sameDay(parseDate(event.FECHA),targetDate));

  const type=rawQuery.includes('jurisdicc')?'Jurisdiccional':rawQuery.includes('audiovis')?'Audiovisual':rawQuery.includes('turno')?'Turno':rawQuery.includes('efem')?'Efeméride':rawQuery.includes('ausenc')?'Ausencias':rawQuery.includes('actividad')?'Actividad':null;
  if(type) base=base.filter(event=>normalizeType(event.TIPO)===type);

  const status=rawQuery.includes('por confirmar')?'Por Confirmar':rawQuery.includes('bolet')?'Boletín':rawQuery.includes('redes')?'Redes Sociales':rawQuery.includes('pendiente')?'Pendiente':rawQuery.includes('cancelad')?'Cancelada':rawQuery.includes('confirmad')?'Confirmada':null;
  if(status) base=base.filter(event=>getStatus(event)===status);

  const commandWords=['muéstrame','muestrame','mostrar','muestra','qué','que','tenemos','tengo','agenda','actividad','actividades','para','del','de','el','la','las','los','esta','este','buscar','busca','ver','pauta','pautas'];
  const excluded=['mañana','hoy','semana','jurisdiccional','jurisdiccionales','audiovisual','audiovisuales','turno','turnos','efeméride','efemeride','efemérides','efemerides','ausencia','ausencias','confirmada','confirmadas','pendiente','pendientes','boletín','boletin','redes','sociales','cancelada'];
  const words=rawQuery.split(/\s+/).map(word=>word.replace(/[^a-záéíóúñ0-9]/g,'')).filter(word=>word.length>2&&!commandWords.includes(word)&&!Object.keys(WEEKDAYS).includes(word)&&!Object.keys(MESES).includes(word)&&!excluded.includes(word));
  if(targetDate||type||status||/\b(esta semana|semana)\b/.test(rawQuery)){
    if(!words.length) return base.slice().sort((a,b)=>parseDate(a.FECHA)-parseDate(b.FECHA)||compareEventsChronologically(a,b));
  }
  const getText=event=>[event.DETALLE,expandTeamCodes(event.DETALLE),event.LUGAR,expandTeamCodes(event.LUGAR),normalizeType(event.TIPO),getStatus(event)].join(' ').toLowerCase();
  if(!words.length) return base.slice().sort((a,b)=>parseDate(a.FECHA)-parseDate(b.FECHA)||compareEventsChronologically(a,b));
  let results=base.filter(event=>words.every(word=>getText(event).includes(word)));
  if(results.length) return results;
  return base.filter(event=>words.some(word=>getText(event).includes(word)));
}

const searchInput=document.getElementById('searchInput');
function showSearchResults(query,results,voice=false){
  const info=document.getElementById('searchInfo');
  const parsed=parseSpanishQuery(query);
  const exactDateEmpty=!results.length&&parsed.targetDate&&hasExplicitDateExpression(query);
  const dateLabel=exactDateEmpty?formatVoiceDate(parsed.targetDate):'';
  const holiday=exactDateEmpty?getChileHoliday(parsed.targetDate):null;
  info.style.display='block';
  info.classList.toggle('voice-date-feedback',exactDateEmpty);
  info.textContent=results.length
    ? `${voice?'Orden comprendida · ':''}${results.length} resultado${results.length!==1?'s':''} para “${query}”`
    : exactDateEmpty
      ? holiday?`Feriado nacional: ${holiday.name}. Sin actividad agendada para ${dateLabel}.`:`Sin actividad agendada para ${dateLabel}.`
      : `Sin resultados para “${query}”`;
  document.getElementById('content').innerHTML=results.length
    ? renderGroups(results)
    : exactDateEmpty
      ? holiday
        ? `<div class="empty empty-date holiday-search-empty"><div class="icon">✦</div><p><strong>${escapeHTML(holiday.name)}</strong><br>Feriado nacional · Sin actividad agendada<br>${escapeHTML(dateLabel)}</p></div>`
        : `<div class="empty empty-date"><div class="icon">✓</div><p><strong>Sin actividad agendada</strong><br>${escapeHTML(dateLabel)}</p></div>`
      : `<div class="empty"><div class="icon">🔍</div><p>Sin resultados para<br><strong>${escapeHTML(query)}</strong></p></div>`;
  bindCardActions();
}

function handleSearch(query) {
  document.getElementById('clearSearch').style.display=query?'block':'none';
  const info=document.getElementById('searchInfo');
  if (!query.trim()) { info.style.display='none'; render(); return; }
  showSearchResults(query,searchEvents(query)||[],false);
}

function executeVoiceCommand(text){
  const normalized=text.toLowerCase().trim();
  const parsedCommand=parseSpanishQuery(normalized);
  if(parsedCommand.targetDate&&hasExplicitDateExpression(normalized)&&/\b(actividad|actividades|agenda|tenemos|tengo|hay|programad|pauta|pautas|cobertura|qué|que)\b/.test(normalized)){
    const dateEvents=allEvents.filter(event=>sameDay(parseDate(event.FECHA),parsedCommand.targetDate)).sort(compareEventsChronologically);
    selectedCalDate=new Date(parsedCommand.targetDate);
    calendarDate=new Date(parsedCommand.targetDate.getFullYear(),parsedCommand.targetDate.getMonth(),1);
    setView('calendario');
    render();
    const dateLabel=formatVoiceDate(parsedCommand.targetDate);
    const holiday=getChileHoliday(parsedCommand.targetDate);
    const info=document.getElementById('searchInfo');
    info.style.display='block';
    info.classList.add('voice-date-feedback');
    if(dateEvents.length){
      info.textContent=`${dateEvents.length} ${dateEvents.length===1?'actividad agendada':'actividades agendadas'} para ${dateLabel}.${holiday?` Feriado nacional: ${holiday.name}.`:''}`;
      showToast(`${dateEvents.length} ${dateEvents.length===1?'actividad':'actividades'} · ${dateLabel}`);
    }else{
      info.textContent=holiday?`Feriado nacional: ${holiday.name}. Sin actividad agendada para ${dateLabel}.`:`Sin actividad agendada para ${dateLabel}.`;
      showToast(holiday?holiday.name:'Sin actividad agendada');
    }
    haptic(12);
    return;
  }
  if(/\b(calendario|mes)\b/.test(normalized)&&!/(actividad|tengo|buscar|busca)/.test(normalized)){
    const parsed=parseSpanishQuery(normalized);
    if(parsed.targetDate){ selectedCalDate=parsed.targetDate; calendarDate=new Date(parsed.targetDate.getFullYear(),parsed.targetDate.getMonth(),1); }
    setView('calendario'); render(); showToast('Calendario abierto'); return;
  }
  if(/\b(próxima actividad|proxima actividad|qué sigue|que sigue)\b/.test(normalized)){
    const next=nextTimedEventForToday();
    if(next){
      setView('buscar'); searchInput.value=text; showSearchResults(text,[next],true); showToast(`Próxima: ${formatTime(next.HORA)}`);
    }else showToast('No quedan actividades con hora para hoy');
    return;
  }
  setView('buscar');
  searchInput.value=text;
  document.getElementById('clearSearch').style.display='block';
  const results=searchEvents(text)||[];
  showSearchResults(text,results,true);
  haptic(12);
}

searchInput.addEventListener('input',event=>handleSearch(event.target.value));
document.getElementById('clearSearch').addEventListener('click',()=>{searchInput.value='';handleSearch('');searchInput.focus();});


const activityVoiceBtn=document.getElementById('activityVoiceBtn');
const activityVoiceHint=document.getElementById('activityVoiceHint');
const voiceBtn=document.getElementById('voiceBtn');
const createVoiceChoice=document.getElementById('createVoiceChoice');
const voiceRedictateButton=document.getElementById('voiceRedictateButton');
const voiceParticipantsReview=document.getElementById('voiceParticipantsReview');
const fVoiceParticipants=document.getElementById('fVoiceParticipants');
const voiceCaptureModal=document.getElementById('voiceCaptureModal');
const voiceCaptureStage=document.getElementById('voiceCaptureStage');
const voiceCaptureStatus=document.getElementById('voiceCaptureStatus');
const voiceCaptureElapsed=document.getElementById('voiceCaptureElapsed');
const voiceCaptureProgress=document.getElementById('voiceCaptureProgress');
const voiceCaptureTranscript=document.getElementById('voiceCaptureTranscript');
const voiceHoldButton=document.getElementById('voiceHoldButton');
const voiceHoldLabel=document.getElementById('voiceHoldLabel');
const voiceHoldHint=document.getElementById('voiceHoldHint');
const voiceLiveHint=document.getElementById('voiceLiveHint');
const btnVoiceHandsFree=document.getElementById('btnVoiceHandsFree');
const btnVoiceCaptureCancel=document.getElementById('btnVoiceCaptureCancel');
const btnCloseVoiceCapture=document.getElementById('btnCloseVoiceCapture');
const SpeechRecognitionAPI=window.SpeechRecognition||window.webkitSpeechRecognition;
const speechUA=navigator.userAgent||'';
const speechIsIOS=/iPad|iPhone|iPod/.test(speechUA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const speechIsIOSAlternative=speechIsIOS&&/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/.test(speechUA);
const speechIsStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

function speechErrorMessage(code=''){
  const messages={
    'not-allowed':'Permiso de voz bloqueado. En iPhone, revise el micrófono y que Siri esté activada.',
    'service-not-allowed':'La voz no está disponible aquí. En iPhone, use Safari o la aplicación instalada y active Siri.',
    'audio-capture':'No fue posible acceder al micrófono.',
    'no-speech':'No se detectó voz. Toque el micrófono e intente nuevamente.',
    'network':'El reconocimiento de voz necesita conexión en este dispositivo.',
    'language-not-supported':'El reconocimiento no admite español en este dispositivo.'
  };
  return messages[code]||'No fue posible reconocer la voz. Intente nuevamente.';
}

function createSpeechController({button,onPending,onListening,onTranscript,onError,onIdle}){
  let recognition=null;
  let state='idle';
  let startTimer=0;
  let listenTimer=0;
  let finalized=true;
  let manualStop=false;
  let gotResult=false;

  const clearTimers=()=>{
    window.clearTimeout(startTimer);
    window.clearTimeout(listenTimer);
    startTimer=0;
    listenTimer=0;
  };

  const setVisualState=next=>{
    state=next;
    button.classList.toggle('starting',next==='starting');
    button.classList.toggle('listening',next==='listening');
    button.setAttribute('aria-busy',next==='idle'?'false':'true');
  };

  const finalize=(reason='end')=>{
    if(finalized) return;
    finalized=true;
    clearTimers();
    recognition=null;
    setVisualState('idle');
    onIdle?.(reason,gotResult);
  };

  const stop=()=>{
    if(state==='idle') return;
    manualStop=true;
    const current=recognition;
    try{ current?.abort(); }catch(_){ }
    finalize('cancel');
  };

  const start=()=>{
    if(!SpeechRecognitionAPI){
      onError?.('El reconocimiento de voz no está disponible en este navegador.');
      return;
    }
    if(speechIsIOSAlternative&&!speechIsStandalone){
      onError?.('En iPhone, abra la agenda desde Safari o desde el ícono instalado para usar la voz.');
      return;
    }
    if(state!=='idle'){
      stop();
      return;
    }

    manualStop=false;
    gotResult=false;
    finalized=false;
    recognition=new SpeechRecognitionAPI();
    const current=recognition;
    current.lang='es-CL';
    current.continuous=false;
    current.interimResults=false;
    current.maxAlternatives=1;
    setVisualState('starting');
    onPending?.();

    current.onstart=()=>{
      if(finalized) return;
      window.clearTimeout(startTimer);
      setVisualState('listening');
      onListening?.();
      listenTimer=window.setTimeout(()=>{
        if(finalized) return;
        try{ current.stop(); }catch(_){ finalize('timeout'); }
      },9000);
    };

    current.onresult=event=>{
      if(finalized) return;
      const transcript=event.results?.[0]?.[0]?.transcript?.trim()||'';
      if(transcript){
        gotResult=true;
        onTranscript?.(transcript);
      }
      try{ current.stop(); }catch(_){ finalize('result'); }
    };

    current.onerror=event=>{
      if(finalized) return;
      const code=event.error||'';
      if(!(manualStop&&code==='aborted')) onError?.(speechErrorMessage(code));
      finalize(code||'error');
    };

    current.onend=()=>{
      if(finalized) return;
      if(!manualStop&&!gotResult) onError?.('No se detectó una instrucción. Toque el micrófono e intente nuevamente.');
      finalize(gotResult?'result':'end');
    };

    try{
      current.start();
      startTimer=window.setTimeout(()=>{
        if(finalized||state!=='starting') return;
        onError?.(speechIsIOS
          ? 'El micrófono no respondió. Verifique Siri y el permiso de micrófono; luego intente nuevamente.'
          : 'El micrófono no respondió. Intente nuevamente.');
        try{ current.abort(); }catch(_){ }
        finalize('start-timeout');
      },2800);
    }catch(error){
      onError?.('No fue posible iniciar el micrófono. Espere un momento e intente nuevamente.');
      finalize('start-error');
    }
  };

  return {start,stop,isActive:()=>state!=='idle'};
}


function formatVoiceElapsed(ms){
  const seconds=Math.max(0,Math.floor(ms/1000));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
function setVoiceDetected(field,value,detected=false){
  const item=document.querySelector(`[data-voice-field="${field}"]`);if(!item)return;
  item.classList.toggle('detected',Boolean(detected));const strong=item.querySelector('strong');if(strong)strong.textContent=value||'—';
}
function updateVoiceCaptureAnalysis(text){
  const clean=String(text||'').trim();
  voiceCaptureTranscript.textContent=clean||'Mantenga pulsado y diga la actividad completa. Puede hablar con pausas.';
  if(!clean||!window.AgendaVoiceCreate){
    setVoiceDetected('actividad','—',false);setVoiceDetected('fecha','—',false);setVoiceDetected('hora','—',false);setVoiceDetected('tipo','Actividad',false);setVoiceDetected('lugar','—',false);setVoiceDetected('estado','Por Confirmar',false);setVoiceDetected('personas','—',false);return;
  }
  const parsed=window.AgendaVoiceCreate.parse(clean,{now:new Date(),forceCreate:true}),d=parsed.data||{},meta=parsed.meta||{};
  setVoiceDetected('actividad',d.DETALLE||'—',Boolean(d.DETALLE));
  setVoiceDetected('fecha',d.FECHA||'—',Boolean(parsed.detected?.date));
  setVoiceDetected('hora',meta.explicitNoTime?'Sin hora':(d.HORA||'—'),Boolean(parsed.detected?.time||meta.explicitNoTime));
  setVoiceDetected('tipo',d.TIPO||'Actividad',Boolean(parsed.detected?.type||meta.inferredType));
  setVoiceDetected('lugar',d.LUGAR||'—',Boolean(parsed.detected?.location));
  setVoiceDetected('estado',d.ESTADO||'Por Confirmar',Boolean(parsed.detected?.status));
  setVoiceDetected('personas',d.PARTICIPANTES||meta.people||'—',Boolean(parsed.detected?.people));
}
function setVoiceHoldVisual(active){
  voiceHoldButton?.classList.toggle('is-pressed',Boolean(active));
  voiceCaptureStage?.classList.toggle('is-held',Boolean(active));
  if(voiceHoldLabel)voiceHoldLabel.textContent=active?'ESCUCHANDO · SUELTE AL TERMINAR':'MANTENGA PULSADO PARA HABLAR';
  if(voiceHoldHint)voiceHoldHint.textContent=active?'Puede hablar con calma y hacer pausas':'Suelte cuando haya terminado';
  if(voiceLiveHint)voiceLiveHint.textContent=active?'Puede seguir hablando':'Aparecerá mientras habla';
}
function syncVoiceHandsFreeButton(){
  if(!btnVoiceHandsFree)return;
  const active=voiceCaptureMode==='handsfree'&&(voiceCaptureSession?.isActive?.()||voiceCaptureSession?.isFinishing?.());
  btnVoiceHandsFree.classList.toggle('is-active',active);
  btnVoiceHandsFree.textContent=active?'Terminar y revisar':'Manos libres';
  btnVoiceHandsFree.setAttribute('aria-pressed',active?'true':'false');
}
function setVoiceCaptureState(state,detail=''){
  if(!voiceCaptureStage)return;
  voiceCaptureStage.className=`voice-capture-stage is-${state}${voiceHoldButton?.classList.contains('is-pressed')?' is-held':''}`;
  const labels={ready:'Lista para escuchar',starting:'Activando micrófono…',listening:voiceCaptureMode==='hold'?'Escuchando activamente':'Escuchando en modo manos libres',waiting:'Sigo escuchando — puede continuar',restarting:'Reconectando escucha…',processing:'Interpretando la actividad…',error:'No fue posible continuar',idle:'Listo'};
  voiceCaptureStatus.textContent=detail||labels[state]||labels.ready;
}
function resetVoiceCaptureUI(){
  voiceCaptureMode='hold';voiceCaptureSession?.cancel?.();voiceCaptureSession=null;setVoiceHoldVisual(false);syncVoiceHandsFreeButton();
  voiceCaptureElapsed.textContent='00:00';voiceCaptureProgress.style.width='0%';updateVoiceCaptureAnalysis('');setVoiceCaptureState('ready');
}
function closeVoiceCapture({cancel=true}={}){
  if(cancel)voiceCaptureSession?.cancel?.();voiceCaptureSession=null;voiceCaptureMode='hold';setVoiceHoldVisual(false);syncVoiceHandsFreeButton();
  voiceCaptureModal?.classList.remove('open');document.body.classList.remove('voice-capture-open');
}
function openVoiceStudio(){
  if(!SpeechRecognitionAPI){showToast('El reconocimiento de voz no está disponible en este navegador.');return;}
  if(speechIsIOSAlternative&&!speechIsStandalone){showToast('En iPhone, use Safari o la aplicación instalada para crear por voz.');return;}
  if(!window.AgendaLongVoiceSession||!window.AgendaPressToTalk){showToast('No fue posible cargar el modo de agendamiento por voz.');return;}
  closeCreateChoiceModal();resetVoiceCaptureUI();voiceCaptureModal?.classList.add('open');document.body.classList.add('voice-capture-open');
  setTimeout(()=>voiceHoldButton?.focus({preventScroll:true}),140);
}
function buildVoiceCaptureSession(){
  return window.AgendaLongVoiceSession.create({
    Recognition:SpeechRecognitionAPI,lang:'es-CL',maxMs:120000,restartDelay:260,finishGraceMs:950,
    onState:(state,detail)=>{setVoiceCaptureState(state,detail==='no-speech'?'Sigo escuchando — puede continuar':'');syncVoiceHandsFreeButton();},
    onTranscript:text=>updateVoiceCaptureAnalysis(text),
    onTick:(elapsed,max)=>{voiceCaptureElapsed.textContent=formatVoiceElapsed(elapsed);voiceCaptureProgress.style.width=`${Math.min(100,(elapsed/max)*100)}%`;if(max-elapsed<15000&&max-elapsed>0&&voiceCaptureSession?.isActive?.())voiceCaptureStatus.textContent=`Escuchando · quedan ${Math.max(1,Math.ceil((max-elapsed)/1000))} s`;},
    onDone:text=>{setVoiceHoldVisual(false);closeVoiceCapture({cancel:false});parseAndPreviewVoiceActivity(text);},
    onError:message=>{setVoiceHoldVisual(false);voiceCaptureMode='hold';syncVoiceHandsFreeButton();setVoiceCaptureState('error',message);showToast(`⚠️ ${message}`);}
  });
}
function beginVoiceCapture(mode='hold'){
  if(voiceCaptureSession?.isActive?.()||voiceCaptureSession?.isFinishing?.())return false;
  voiceCaptureMode=mode;updateVoiceCaptureAnalysis('');voiceCaptureElapsed.textContent='00:00';voiceCaptureProgress.style.width='0%';
  voiceCaptureSession=buildVoiceCaptureSession();syncVoiceHandsFreeButton();
  const started=voiceCaptureSession.start();if(!started){voiceCaptureMode='hold';syncVoiceHandsFreeButton();return false;}
  if(mode==='hold')setVoiceHoldVisual(true);haptic(8);return true;
}
function finishVoiceCapture(reason='release'){
  if(!voiceCaptureSession)return false;
  // No exigimos texto antes de detener: algunos navegadores entregan la última
  // transcripción justo después de soltar. voice-session.js espera ese cierre.
  setVoiceHoldVisual(false);setVoiceCaptureState('processing');haptic([8,18,8]);return voiceCaptureSession.finish(reason);
}
function cancelVoiceHoldAttempt(){
  if(!voiceCaptureSession?.isActive?.())return;
  voiceCaptureSession.cancel?.();voiceCaptureSession=null;voiceCaptureMode='hold';setVoiceHoldVisual(false);syncVoiceHandsFreeButton();setVoiceCaptureState('ready','La pulsación se interrumpió. Mantenga pulsado para intentarlo nuevamente.');
}

let activityDictationRecognition=null;
let searchSpeechController=null;
let voiceCaptureSession=null;
let voiceCaptureMode='hold';
let voicePressBinding=null;

if(!SpeechRecognitionAPI){
  activityVoiceBtn.disabled=true;
  activityVoiceBtn.classList.add('unavailable');
  activityVoiceHint.textContent='El dictado no está disponible en este navegador; puede escribir normalmente.';
  voiceBtn.disabled=true;
  voiceBtn.classList.add('unavailable');
  voiceBtn.title='Voz no disponible en este navegador';
  if(createVoiceChoice){createVoiceChoice.disabled=true;createVoiceChoice.classList.add('unavailable');}
}else{
  activityDictationRecognition=createSpeechController({
    button:activityVoiceBtn,
    onPending:()=>{activityVoiceHint.textContent='Preparando micrófono…';},
    onListening:()=>{activityVoiceHint.textContent='Escuchando… hable con naturalidad.';},
    onTranscript:transcript=>{
      const field=document.getElementById('fDetalle');
      field.value=[field.value.trim(),transcript].filter(Boolean).join(' ');
      field.focus();
      field.setSelectionRange(field.value.length,field.value.length);
      activityVoiceHint.textContent='Dictado incorporado. Puede corregirlo antes de guardar.';
    },
    onError:message=>{activityVoiceHint.textContent=message;},
    onIdle:(reason,gotResult)=>{
      if(!gotResult&&['cancel'].includes(reason)) activityVoiceHint.textContent='Puede escribir o usar el micrófono.';
    }
  });

  searchSpeechController=createSpeechController({
    button:voiceBtn,
    onPending:()=>showToast('Preparando micrófono…'),
    onListening:()=>showToast('🎙️ Escuchando: diga una fecha o actividad'),
    onTranscript:text=>executeVoiceCommand(text),
    onError:message=>showToast(message)
  });

  activityVoiceBtn.addEventListener('click',()=>activityDictationRecognition.start());
  voiceBtn.addEventListener('click',()=>searchSpeechController.start());

  voicePressBinding=window.AgendaPressToTalk?.bind(voiceHoldButton,{
    onPress:()=>{if(voiceCaptureMode==='handsfree'&&voiceCaptureSession?.isActive?.())return;beginVoiceCapture('hold');},
    onRelease:()=>{if(voiceCaptureMode==='hold')finishVoiceCapture('release');},
    onCancel:()=>cancelVoiceHoldAttempt()
  });
  createVoiceChoice?.addEventListener('click',openVoiceStudio);
  voiceRedictateButton?.addEventListener('click',()=>{closeActivityModal();setTimeout(openVoiceStudio,140);});
  btnVoiceHandsFree?.addEventListener('click',()=>{
    if(voiceCaptureMode==='handsfree'&&(voiceCaptureSession?.isActive?.()||voiceCaptureSession?.isFinishing?.())){finishVoiceCapture('handsfree');return;}
    if(voiceCaptureSession?.isActive?.())return;
    setVoiceHoldVisual(false);beginVoiceCapture('handsfree');
  });
  btnVoiceCaptureCancel?.addEventListener('click',()=>closeVoiceCapture({cancel:true}));
  btnCloseVoiceCapture?.addEventListener('click',()=>closeVoiceCapture({cancel:true}));
  voiceCaptureModal?.addEventListener('click',event=>{if(event.target===voiceCaptureModal)closeVoiceCapture({cancel:true});});
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='hidden') return;
  activityDictationRecognition?.stop?.();
  searchSpeechController?.stop?.();
  if(voiceCaptureSession?.isActive?.()||voiceCaptureSession?.isFinishing?.()) closeVoiceCapture({cancel:true});
});


const REMINDER_STORAGE_KEY='agenda-comunicaciones-reminders-15';
const REMINDER_SENT_KEY='agenda-comunicaciones-reminders-sent-v1';
const REMINDER_MINUTES=15;
const reminderToggle=document.getElementById('reminderToggle');
const reminderTimers=new Map();
function remindersEnabled(){return localStorage.getItem(REMINDER_STORAGE_KEY)==='on'&&typeof Notification!=='undefined'&&Notification.permission==='granted';}
function syncReminderToggle(){if(!reminderToggle)return;const on=remindersEnabled();reminderToggle.classList.toggle('active',on);reminderToggle.setAttribute('aria-pressed',on?'true':'false');reminderToggle.title=on?'Recordatorios 15 min activados':'Activar recordatorios 15 min';}
function readSentReminders(){try{return JSON.parse(localStorage.getItem(REMINDER_SENT_KEY)||'{}')||{};}catch{return {};}}
function writeSentReminders(v){try{localStorage.setItem(REMINDER_SENT_KEY,JSON.stringify(v));}catch{}}
function reminderEventKey(e){return[e.FECHA,e.HORA,e.TIPO,e.DETALLE,e.LUGAR].join('|');}
function eventStartDateTime(e){const d=parseDate(e.FECHA),t=normalizeTimeValue(e.HORA);if(!d||!t)return null;const[h,m]=t.split(':').map(Number);return new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,m,0,0);}
async function showAgendaNotification(title,body,tag){
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return false;
 try{const reg=await navigator.serviceWorker?.ready;if(!reg?.showNotification)return false;await reg.showNotification(title,{body,tag,renotify:false,icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:{url:location.href.split('#')[0]}});return true;}catch(e){console.warn('Notification',e);return false;}
}
async function fireActivityReminder(e,{force=false}={}){
 if(!force&&!remindersEnabled())return false;const start=eventStartDateTime(e);if(!start)return false;const key=reminderEventKey(e),sent=readSentReminders();if(!force&&sent[key])return false;
 const mins=Math.max(0,Math.round((start-Date.now())/60000)),when=mins>=14?'en 15 minutos':mins>1?`en ${mins} minutos`:mins===1?'en 1 minuto':'ahora';
 const body=`${formatTime(e.HORA)} · ${expandTeamCodes(e.DETALLE)}${e.LUGAR?` · ${expandTeamCodes(e.LUGAR)}`:''}`;
 const shown=await showAgendaNotification(`Agenda Comunicaciones · ${when}`,body,`agenda-com-${key}`);
 if(shown&&!force){
   sent[key]=Date.now();
   const cutoff=Date.now()-7*24*60*60*1000;
   Object.keys(sent).forEach(item=>{if(Number(sent[item])<cutoff)delete sent[item];});
   writeSentReminders(sent);
 }
 return shown;
}
function clearReminderTimers(){reminderTimers.forEach(clearTimeout);reminderTimers.clear();}
function scheduleActivityReminders(){
 clearReminderTimers();if(!remindersEnabled())return;const now=Date.now(),horizon=now+86400000;
 allEvents.forEach(e=>{const start=eventStartDateTime(e);if(!start||getStatus(e)==='Cancelada')return;const due=start.getTime()-REMINDER_MINUTES*60000;if(due<=now||due>horizon)return;const key=reminderEventKey(e);reminderTimers.set(key,setTimeout(()=>{reminderTimers.delete(key);fireActivityReminder(e);},due-now));});
}
async function sweepDueReminders(){if(!remindersEnabled())return;const now=Date.now();for(const e of allEvents){if(getStatus(e)==='Cancelada')continue;const start=eventStartDateTime(e);if(!start)continue;const diff=start-now;if(diff<=REMINDER_MINUTES*60000&&diff>=0)await fireActivityReminder(e);}}
async function enableActivityReminders(){
 if(typeof Notification==='undefined'||!('serviceWorker'in navigator)){showToast('Este navegador no admite recordatorios de la PWA.');return;}
 if(speechIsIOS&&!speechIsStandalone){showToast('En iPhone, instale la app en la pantalla de inicio antes de activar avisos.');return;}
 let p=Notification.permission;if(p!=='granted'){try{p=await Notification.requestPermission();}catch{p='denied';}}
 if(p!=='granted'){localStorage.removeItem(REMINDER_STORAGE_KEY);syncReminderToggle();showToast('No se autorizó el envío de notificaciones.');return;}
 localStorage.setItem(REMINDER_STORAGE_KEY,'on');syncReminderToggle();scheduleActivityReminders();
 await showAgendaNotification('Agenda Comunicaciones','Recordatorios activados · aviso 15 minutos antes de cada actividad con hora.','agenda-com-test');
 showToast('🔔 Recordatorios de 15 minutos activados');
}
function disableActivityReminders(){localStorage.removeItem(REMINDER_STORAGE_KEY);clearReminderTimers();syncReminderToggle();showToast('Recordatorios desactivados');}
reminderToggle?.addEventListener('click',()=>remindersEnabled()?disableActivityReminders():enableActivityReminders());
syncReminderToggle();setInterval(sweepDueReminders,30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){syncReminderToggle();scheduleActivityReminders();sweepDueReminders();}});
window.addEventListener('focus',()=>{scheduleActivityReminders();sweepDueReminders();});

function showToast(message) {
  const toast=document.getElementById('toast'); toast.textContent=message; toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2800);
}

document.addEventListener('keydown',event=>{
  if(event.key!=='Escape') return;
  if(voiceCaptureModal?.classList.contains('open')) { closeVoiceCapture({cancel:true}); return; }
  closeDropdown();
  if(timePickerModal.classList.contains('open')) { closeTimePicker(); return; }
  if(activityModal.classList.contains('open')) closeActivityModal();
  if(deleteModal.classList.contains('open')) closeDeleteModal();
  if(createChoiceModal?.classList.contains('open')) closeCreateChoiceModal();
  if(holidayModal?.classList.contains('open')) closeHolidayModal();
  if(holidayDeleteModal?.classList.contains('open')) closeHolidayDeleteModal();
});




// Encabezado adaptativo móvil estable: usa umbrales separados para impedir parpadeos.
let adaptiveHeaderFrame=0;
let adaptiveHeaderPinnedOpenAt=null;

function expandAdaptiveHeader(){
  document.body.classList.remove('header-collapsed');
}

function collapseAdaptiveHeader(){
  document.body.classList.add('header-collapsed');
}

function updateAdaptiveHeader({forceExpanded=false}={}){
  const mobile=window.matchMedia('(max-width: 759px)').matches;
  const calendarView=currentView==='calendario';
  const y=Math.max(0,window.scrollY);

  if(forceExpanded||!mobile||!calendarView){
    adaptiveHeaderPinnedOpenAt=null;
    expandAdaptiveHeader();
    return;
  }

  if(y<=24){
    adaptiveHeaderPinnedOpenAt=null;
    expandAdaptiveHeader();
    return;
  }

  if(adaptiveHeaderPinnedOpenAt!==null){
    if(y>adaptiveHeaderPinnedOpenAt+48){
      adaptiveHeaderPinnedOpenAt=null;
      collapseAdaptiveHeader();
    }else{
      expandAdaptiveHeader();
    }
    return;
  }

  if(y>=112) collapseAdaptiveHeader();
}

window.addEventListener('scroll',()=>{
  if(adaptiveHeaderFrame) return;
  adaptiveHeaderFrame=requestAnimationFrame(()=>{
    adaptiveHeaderFrame=0;
    updateAdaptiveHeader();
  });
},{passive:true});

window.addEventListener('resize',()=>updateAdaptiveHeader({forceExpanded:true}));

document.getElementById('appHeader')?.addEventListener('click',event=>{
  if(
    currentView==='calendario'&&
    document.body.classList.contains('header-collapsed')&&
    !event.target.closest('button')
  ){
    adaptiveHeaderPinnedOpenAt=window.scrollY;
    expandAdaptiveHeader();
  }
});


const themeToggle = document.getElementById('themeToggle');
const themeColorMeta = document.getElementById('themeColorMeta');

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function syncThemeControls() {
  const theme = currentTheme();
  const nextThemeName = theme === 'dark' ? 'claro' : 'oscuro';
  themeToggle.setAttribute('aria-label', `Cambiar a modo ${nextThemeName}`);
  themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  themeToggle.title = `Modo ${theme === 'dark' ? 'oscuro' : 'claro'} · Cambiar a ${nextThemeName}`;
  if (themeColorMeta) themeColorMeta.content = theme === 'dark' ? '#101d49' : '#f4f7fb';
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  if (persist) {
    try { localStorage.setItem('agenda-theme', currentTheme()); } catch (_) {}
  }
  syncThemeControls();
}

themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast(next === 'light' ? '☀ Modo claro activado' : '☾ Modo oscuro activado');
});

syncThemeControls();


// Bienvenida de inicio. La agenda carga detrás y la animación nunca bloquea más de 1,6 s.
const launchScreen=document.getElementById('launchScreen');
const launchStartedAt=performance.now();
let launchDismissRequested=false;

function dismissLaunchScreen(){
  if(!launchScreen||launchDismissRequested) return;
  launchDismissRequested=true;

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minimumVisibleTime=reduceMotion?900:2400;
  const elapsed=performance.now()-launchStartedAt;
  const delay=Math.max(0,minimumVisibleTime-elapsed);

  window.setTimeout(()=>{
    launchScreen.classList.add('leaving');
    window.setTimeout(()=>launchScreen.remove(),reduceMotion?160:460);
  },delay);
}

// Respaldo: incluso con una red lenta, la interfaz queda disponible rápidamente.
window.setTimeout(dismissLaunchScreen,3200);


async function loadData({silent=false}={}) {
  if(!silent) document.getElementById('content').innerHTML='<div class="loading"><div class="spinner"></div>Cargando Agenda Comunicaciones…</div>';
  try {
    const demoMode=new URLSearchParams(window.location.search).has('demo');
    if(demoMode){
      const today=new Date();
      const key=offset=>formatDateKey(new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset));
      allEvents=[
        {FECHA:key(0),'DÍA':'Hoy',HORA:'09:30',TIPO:'Actividad',DETALLE:'Entrevista ministra Radio San Bartolomé',LUGAR:'La Serena',ESTADO:'Confirmada',_row:2},
        {FECHA:key(0),'DÍA':'Hoy',HORA:'14:45',TIPO:'Jurisdiccional',DETALLE:'TOPLS 124-26 · Sentencia homicidio',LUGAR:'',ESTADO:'Confirmada',_row:3},
        {FECHA:key(1),'DÍA':'Mañana',HORA:'',TIPO:'Audiovisual',DETALLE:'Short de actividad institucional',LUGAR:'',ESTADO:'Redes Sociales',_row:4},
        {FECHA:key(2),'DÍA':'',HORA:'09:00',TIPO:'Actividad',DETALLE:'Bus de la Justicia · cobertura',LUGAR:'Coquimbo',ESTADO:'Boletín',_row:5},
        {FECHA:key(4),'DÍA':'',HORA:'',TIPO:'Turno',DETALLE:'PH',LUGAR:'',ESTADO:'Sin estado',_row:6}
      ];
      lastSuccessfulLoadAt=Date.now();
      updateHeaderStats();buildTabs();render();scheduleActivityReminders();sweepDueReminders();dismissLaunchScreen();return;
    }

    if(!SCRIPT_URL) throw new Error('La aplicación todavía no tiene configurada la URL de Apps Script.');
    const payload=await sendScriptAction('listar');
    if(payload?.schema!=='comunicaciones-live-v1'||!Array.isArray(payload?.eventos)){
      throw new Error('La implementación de Apps Script debe actualizarse a Agenda Comunicaciones 1.0.7.');
    }
    allEvents=payload.eventos.map(event=>({
      FECHA:normalizeDateKey(event.FECHA||event.fecha),
      'DÍA':event['DÍA']||event.dia||'',
      HORA:normalizeTimeValue(event.HORA||event.hora),
      TIPO:normalizeType(event.TIPO||event.tipo),
      DETALLE:String(event.DETALLE||event.detalle||'').trim(),
      LUGAR:String(event.LUGAR||event.lugar||'').trim(),
      ESTADO:normalizeStatus(event.ESTADO||event.estado),
      _row:Number(event._row||event.fila)||0
    })).filter(event=>event.FECHA&&event.DETALLE);
    lastSuccessfulLoadAt=Date.now();
    updateHeaderStats();buildTabs();render();scheduleActivityReminders();sweepDueReminders();dismissLaunchScreen();
    if(silent) showToast('↻ Agenda sincronizada');
  } catch(error) {
    dismissLaunchScreen();
    if(!silent){
      const configuration=!SCRIPT_URL;
      document.getElementById('content').innerHTML=configuration
        ? '<div class="empty"><div class="icon">⚙️</div><p><strong>Falta conectar Apps Script</strong><br>Despliega el Code.gs incluido y pega la URL /exec en config.js.</p></div>'
        : '<div class="empty"><div class="icon">⚠️</div><p>Error al cargar.<br>Verifica la conexión con la planilla.</p></div>';
    }
  }
}


// Sincronización automática: no requiere un botón permanente en la cabecera.
function refreshAgendaIfStale() {
  const twoMinutes = 2 * 60 * 1000;
  if (!lastSuccessfulLoadAt || Date.now() - lastSuccessfulLoadAt >= twoMinutes) {
    loadData({silent:true});
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshAgendaIfStale();
});

window.addEventListener('online', () => loadData({silent:true}));

ensureChileHolidayYear(new Date().getFullYear());
syncOfficialChileHolidaysFromSheet();
loadData();


// Habilita instalación como aplicación y actualizaciones seguras del shell visual.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(() => {
      // La agenda sigue funcionando aunque el navegador no admita el service worker.
    });
  });
}
