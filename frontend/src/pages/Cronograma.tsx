import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '@/store';
import { scheduleApi } from '@/services/api';
import type { GanttTask, ScheduleDependencyItem } from '@/types';

// ── Design constants ──────────────────────────────────────────────────────────

const DAY_W     = 20;   // px per day cell
const ROW_H     = 32;   // px per row
const HDR_WK_H  = 26;   // week date header height
const HDR_DAY_H = 20;   // weekday letter header height
const HDR_H     = HDR_WK_H + HDR_DAY_H;
const LEFT_W    = 420;  // left panel width

// Row palette by EAP level
const PALETTE = [
  { bg: '#E3EAF4', fg: '#1A3A6B', hov: '#D4DEF0', badge: '#2C5282' },   // 0 - blueprint
  { bg: '#FDECEA', fg: '#7D2B24', hov: '#FAD9D7', badge: '#C0392B' },   // 1 - terracotta
  { bg: '#EBF4E8', fg: '#2A5C1E', hov: '#DCEFD7', badge: '#27AE60' },   // 2 - sage
  { bg: '#FEF9EC', fg: '#5C4A0A', hov: '#FAF2D8', badge: '#D4A017' },   // 3+ - amber
] as const;

const GANTT_PLAN_BG  = 'rgba(91,63,138,0.18)';
const GANTT_BAR      = '#5B3F8A';
const GANTT_CRITICAL = '#C0392B';
const TODAY_COL      = '#E84040';

const PT_MONTHS  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const DAY_LETTERS = ['D','S','T','Q','Q','S','S']; // Sun=0 … Sat=6

function getLv(level: number) { return PALETTE[Math.min(level, PALETTE.length - 1)]; }

// ── Day grid types ────────────────────────────────────────────────────────────

interface DayCell {
  idx: number;
  date: string;   // YYYY-MM-DD
  letter: string;
  isWeekend: boolean;
  isToday: boolean;
  wkLabel: string; // "12-mai-2026" on Monday, '' otherwise
}

// ── Mock data ─────────────────────────────────────────────────────────────────

function buildMockTasks(): GanttTask[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (om: number, od = 0) => new Date(y, m + om, 1 + od).toISOString().split('T')[0];
  return [
    { id:'1', code:'1',       name:'OBRA RESIDENCIAL',        level:0, startDate:iso(-1), endDate:iso(11), plannedProgress:35, actualProgress:30, isCriticalPath:false, hasChildren:true,  durationDays:365, weight:1    },
    { id:'2', code:'1.1',     name:'INFRAESTRUTURA',           level:1, parentId:'1', startDate:iso(-1), endDate:iso(2), plannedProgress:90, actualProgress:85, isCriticalPath:true,  hasChildren:true,  durationDays:90,  weight:.12  },
    { id:'3', code:'1.1.1',   name:'Terraplanagem e Locação',  level:2, parentId:'2', startDate:iso(-1), endDate:iso(-1,14), plannedProgress:100, actualProgress:100, isCriticalPath:true, hasChildren:false, durationDays:14, weight:.02 },
    { id:'4', code:'1.1.2',   name:'Estacas e Fundações',      level:2, parentId:'2', startDate:iso(-1,10), endDate:iso(1), plannedProgress:100, actualProgress:90, isCriticalPath:true, hasChildren:false, durationDays:45, weight:.06 },
    { id:'5', code:'1.1.3',   name:'Vigas Baldrame',           level:2, parentId:'2', startDate:iso(1), endDate:iso(2), plannedProgress:60, actualProgress:40, isCriticalPath:true, hasChildren:false, durationDays:30, weight:.04 },
    { id:'6', code:'1.2',     name:'ESTRUTURA',                level:1, parentId:'1', startDate:iso(1), endDate:iso(9), plannedProgress:40, actualProgress:25, isCriticalPath:true,  hasChildren:true,  durationDays:240, weight:.30 },
    { id:'7', code:'1.2.1',   name:'Estrutura Térreo',         level:2, parentId:'6', startDate:iso(1), endDate:iso(2), plannedProgress:80, actualProgress:60, isCriticalPath:true, hasChildren:false, durationDays:30, weight:.04 },
    { id:'8', code:'1.2.2',   name:'Pavimentos Tipo',          level:2, parentId:'6', startDate:iso(2), endDate:iso(8), plannedProgress:20, actualProgress:10, isCriticalPath:true, hasChildren:false, durationDays:180, weight:.20 },
    { id:'9', code:'1.2.3',   name:'Cobertura',                level:2, parentId:'6', startDate:iso(8), endDate:iso(9), plannedProgress:0, actualProgress:0, isCriticalPath:true, hasChildren:false, durationDays:30, weight:.06 },
    { id:'10',code:'1.3',     name:'VEDAÇÕES E INSTALAÇÕES',   level:1, parentId:'1', startDate:iso(3), endDate:iso(10), plannedProgress:10, actualProgress:5, isCriticalPath:false, hasChildren:true, durationDays:210, weight:.35 },
    { id:'11',code:'1.3.1',   name:'Alvenaria',                level:2, parentId:'10', startDate:iso(3), endDate:iso(8), plannedProgress:15, actualProgress:8, isCriticalPath:false, hasChildren:false, durationDays:150, weight:.12 },
    { id:'12',code:'1.3.2',   name:'Instalações Hidráulicas',  level:2, parentId:'10', startDate:iso(4), endDate:iso(10), plannedProgress:5, actualProgress:2, isCriticalPath:false, hasChildren:false, durationDays:180, weight:.10 },
    { id:'13',code:'1.3.3',   name:'Instalações Elétricas',    level:2, parentId:'10', startDate:iso(4), endDate:iso(10), plannedProgress:5, actualProgress:2, isCriticalPath:false, hasChildren:false, durationDays:180, weight:.10 },
    { id:'14',code:'1.4',     name:'ACABAMENTOS',              level:1, parentId:'1', startDate:iso(7), endDate:iso(11), plannedProgress:0, actualProgress:0, isCriticalPath:false, hasChildren:true, durationDays:120, weight:.19 },
    { id:'15',code:'1.4.1',   name:'Revestimento de Piso',     level:2, parentId:'14', startDate:iso(7), endDate:iso(10), plannedProgress:0, actualProgress:0, isCriticalPath:false, hasChildren:false, durationDays:90, weight:.07 },
    { id:'16',code:'1.4.2',   name:'Pintura',                  level:2, parentId:'14', startDate:iso(9), endDate:iso(11), plannedProgress:0, actualProgress:0, isCriticalPath:false, hasChildren:false, durationDays:60, weight:.06 },
    { id:'17',code:'1.4.3',   name:'Esquadrias e Acabamentos', level:2, parentId:'14', startDate:iso(9), endDate:iso(11), plannedProgress:0, actualProgress:0, isCriticalPath:false, hasChildren:false, durationDays:60, weight:.06 },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string) {
  return new Date(s.slice(0, 10) + 'T00:00:00');
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().split('T')[0];
}

function buildDayCells(minDate: Date, maxDate: Date): DayCell[] {
  const cells: DayCell[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  // Start at Monday before minDate
  const cur = new Date(minDate);
  while (cur.getDay() !== 1) cur.setDate(cur.getDate() - 1);
  // End at Sunday after maxDate
  const end = new Date(maxDate);
  while (end.getDay() !== 0) end.setDate(end.getDate() + 1);

  let idx = 0;
  while (cur <= end) {
    const dow = cur.getDay();
    const dateStr = cur.toISOString().split('T')[0];
    const isMonday = dow === 1;
    cells.push({
      idx,
      date: dateStr,
      letter: DAY_LETTERS[dow],
      isWeekend: dow === 0 || dow === 6,
      isToday: dateStr === todayStr,
      wkLabel: isMonday ? `${cur.getDate()}-${PT_MONTHS[cur.getMonth()]}-${cur.getFullYear()}` : '',
    });
    cur.setDate(cur.getDate() + 1);
    idx++;
  }
  return cells;
}

function buildWeekHeaders(cells: DayCell[]): { label: string; left: number; width: number }[] {
  const headers: { label: string; left: number; width: number }[] = [];
  let i = 0;
  while (i < cells.length) {
    if (cells[i].wkLabel !== '' || i === 0) {
      let j = i + 1;
      while (j < cells.length && cells[j].wkLabel === '') j++;
      headers.push({ label: cells[i].wkLabel || cells[i].date.slice(0, 10), left: i * DAY_W, width: (j - i) * DAY_W });
      i = j;
    } else { i++; }
  }
  return headers;
}

function getBarPos(task: GanttTask, cells: DayCell[]) {
  const s = task.startDate.slice(0, 10);
  const e = task.endDate.slice(0, 10);
  const si = cells.findIndex(c => c.date === s);
  const ei = cells.findIndex(c => c.date === e);
  if (si < 0) return null;
  const fi = ei >= 0 ? ei : cells.length - 1;
  return { left: si * DAY_W, width: Math.max(DAY_W, (fi - si + 1) * DAY_W) };
}

function progressBadge(actual: number, planned: number): { cls: string; bg: string; color: string } {
  if (actual >= planned) return { cls: '', bg: '#D1FAE5', color: '#065F46' };
  if (actual >= planned - 15) return { cls: '', bg: '#FEF3C7', color: '#92400E' };
  return { cls: '', bg: '#FEE2E2', color: '#991B1B' };
}

function fmtDate(s: string) {
  try { return parseDate(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return s.slice(0, 10); }
}

// ── FormState ─────────────────────────────────────────────────────────────────

interface FormState {
  name: string; code: string; level: number; parentId: string;
  startDate: string; endDate: string; durationDays: number;
  plannedProgress: number; actualProgress: number; weight: number; isCriticalPath: boolean;
}

function defaultForm(parent: GanttTask | null, all: GanttTask[]): FormState {
  const today = new Date().toISOString().split('T')[0];
  const in30  = addDays(new Date(), 30);
  if (parent) {
    const siblings = all.filter(t => t.parentId === parent.id);
    return { name:'', code:`${parent.code}.${siblings.length+1}`, level:parent.level+1, parentId:parent.id, startDate:today, endDate:in30, durationDays:30, plannedProgress:0, actualProgress:0, weight:1, isCriticalPath:false };
  }
  const roots = all.filter(t => !t.parentId);
  return { name:'', code:String(roots.length+1), level:0, parentId:'', startDate:today, endDate:in30, durationDays:30, plannedProgress:0, actualProgress:0, weight:1, isCriticalPath:false };
}

function formFromTask(t: GanttTask): FormState {
  const s = parseDate(t.startDate), e = parseDate(t.endDate);
  return { name:t.name, code:t.code, level:t.level, parentId:t.parentId??'', startDate:t.startDate.slice(0,10), endDate:t.endDate.slice(0,10), durationDays:t.durationDays??Math.max(1,daysBetween(s,e)), plannedProgress:t.plannedProgress, actualProgress:t.actualProgress, weight:t.weight??1, isCriticalPath:t.isCriticalPath };
}

const inp: React.CSSProperties = { padding:'5px 8px', fontSize:12, border:'0.5px solid var(--bd2)', borderRadius:6, background:'var(--bg1)', color:'var(--t1)', width:'100%', boxSizing:'border-box' };

// ── TaskModal ─────────────────────────────────────────────────────────────────

interface TaskModalProps {
  open: boolean; editingTask: GanttTask | null; parentTask: GanttTask | null;
  allTasks: GanttTask[]; projectId: string;
  addToast: (t:{type:string;title:string;description?:string})=>void;
  onClose: ()=>void; onSaved: ()=>void;
}

function TaskModal({ open, editingTask, parentTask, allTasks, projectId, addToast, onClose, onSaved }: TaskModalProps) {
  const [form, setForm] = useState<FormState>(() => editingTask ? formFromTask(editingTask) : defaultForm(parentTask, allTasks));
  const [saving, setSaving] = useState(false);
  const [deps, setDeps] = useState<ScheduleDependencyItem[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [addingDep, setAddingDep] = useState(false);
  const [addDepRole, setAddDepRole] = useState<'predecessor'|'successor'>('predecessor');
  const [depSearch, setDepSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(editingTask ? formFromTask(editingTask) : defaultForm(parentTask, allTasks));
    setDeps([]); setAddingDep(false); setDepSearch('');
    if (editingTask) {
      setLoadingDeps(true);
      scheduleApi.getDependencies(editingTask.id).then(setDeps).catch(()=>setDeps([])).finally(()=>setLoadingDeps(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key==='startDate'||key==='endDate') {
        const s=parseDate((key==='startDate'?value:prev.startDate) as string), e=parseDate((key==='endDate'?value:prev.endDate) as string);
        if (!isNaN(s.getTime())&&!isNaN(e.getTime())&&e>s) next.durationDays=daysBetween(s,e);
      } else if (key==='durationDays'&&(value as number)>0) {
        const s=parseDate(prev.startDate);
        if (!isNaN(s.getTime())) next.endDate=addDays(s,value as number);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { addToast({type:'error',title:'Nome obrigatório'}); return; }
    setSaving(true);
    try {
      const payload = { name:form.name.trim(), code:form.code.trim(), level:form.level, parentId:form.parentId||undefined, startDate:form.startDate, endDate:form.endDate, durationDays:form.durationDays, plannedProgress:form.plannedProgress, actualProgress:form.actualProgress, weight:form.weight, isCriticalPath:form.isCriticalPath };
      if (editingTask) { await scheduleApi.update(editingTask.id, payload); addToast({type:'success',title:'Salvo',description:`"${form.name}" atualizado.`}); }
      else { await scheduleApi.create(projectId, payload); addToast({type:'success',title:'Criado',description:`"${form.name}" adicionado.`}); }
      onSaved(); onClose();
    } catch (err: unknown) {
      const msg = (err as {response?:{data?:{message?:string}}})?.response?.data?.message;
      addToast({type:'error',title:'Erro ao salvar',description:msg??'Tente novamente.'});
    } finally { setSaving(false); }
  }

  async function handleAddDep(targetId: string) {
    if (!editingTask) return;
    try {
      const dep = addDepRole==='predecessor' ? await scheduleApi.addDependency(editingTask.id,{predecessorId:targetId}) : await scheduleApi.addDependency(targetId,{predecessorId:editingTask.id});
      setDeps(prev=>[...prev,dep]); setAddingDep(false); setDepSearch('');
    } catch (err: unknown) {
      const msg=(err as {response?:{data?:{message?:string}}})?.response?.data?.message;
      addToast({type:'error',title:'Erro',description:msg??'Não foi possível adicionar.'});
    }
  }

  async function handleRemoveDep(depId: string) {
    try { await scheduleApi.removeDependency(depId); setDeps(prev=>prev.filter(d=>d.id!==depId)); }
    catch { addToast({type:'error',title:'Erro',description:'Não foi possível remover.'}); }
  }

  const predecessors = deps.filter(d=>d.successorId===editingTask?.id);
  const successors   = deps.filter(d=>d.predecessorId===editingTask?.id);
  const depCandidates = useMemo(()=>{
    if (!addingDep) return [];
    const used=new Set([...deps.map(d=>d.predecessorId),...deps.map(d=>d.successorId),editingTask?.id??'']);
    const q=depSearch.toLowerCase();
    return allTasks.filter(t=>!used.has(t.id)&&(!q||t.name.toLowerCase().includes(q)||t.code.includes(q))).slice(0,25);
  },[addingDep,deps,depSearch,allTasks,editingTask]);

  if (!open) return null;

  const depRow = (dep: ScheduleDependencyItem, side: 'pred'|'succ') => {
    const item = side==='pred' ? dep.predecessor : dep.successor;
    return (
      <div key={dep.id} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',fontSize:11}}>
        <span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--t3)',minWidth:32,flexShrink:0}}>{item?.code}</span>
        <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--t1)'}}>{item?.name}</span>
        <span style={{color:'var(--t3)',fontSize:9,background:'var(--bg2)',padding:'1px 5px',borderRadius:4,flexShrink:0}}>{dep.type}{dep.lagDays?`+${dep.lagDays}d`:''}</span>
        <button onClick={()=>handleRemoveDep(dep.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:14,lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
      </div>
    );
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'var(--bg1)',border:'0.5px solid var(--bd)',borderRadius:14,padding:'1.25rem',width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:600,fontSize:14,color:'var(--t1)'}}>{editingTask?'Editar atividade':parentTask?`Nova atividade em "${parentTask.name}"`:'Nova atividade'}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t2)',fontSize:18,lineHeight:1}}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{gridColumn:'1 / -1'}}><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Nome *</label><input style={inp} value={form.name} onChange={e=>change('name',e.target.value)} autoFocus /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Código WBS</label><input style={inp} value={form.code} onChange={e=>change('code',e.target.value)} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Nível</label><input style={inp} type="number" min={0} max={10} value={form.level} onChange={e=>change('level',parseInt(e.target.value)||0)} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Data de início</label><input style={inp} type="date" value={form.startDate} onChange={e=>change('startDate',e.target.value)} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Data de término</label><input style={inp} type="date" value={form.endDate} onChange={e=>change('endDate',e.target.value)} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Duração (dias)</label><input style={inp} type="number" min={1} value={form.durationDays} onChange={e=>change('durationDays',parseInt(e.target.value)||1)} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Peso</label><input style={inp} type="number" min={0} step={0.01} value={form.weight} onChange={e=>change('weight',parseFloat(e.target.value)||0)} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Prog. Planejado (%)</label><input style={inp} type="number" min={0} max={100} value={form.plannedProgress} onChange={e=>change('plannedProgress',Math.min(100,Math.max(0,parseInt(e.target.value)||0)))} /></div>
          <div><label style={{fontSize:11,color:'var(--t2)',display:'block',marginBottom:3}}>Prog. Realizado (%)</label><input style={inp} type="number" min={0} max={100} value={form.actualProgress} onChange={e=>change('actualProgress',Math.min(100,Math.max(0,parseInt(e.target.value)||0)))} /></div>
          <div style={{gridColumn:'1 / -1',display:'flex',alignItems:'center',gap:8}}><input type="checkbox" id="cp-chk" checked={form.isCriticalPath} onChange={e=>change('isCriticalPath',e.target.checked)} style={{cursor:'pointer',accentColor:'#C9312F'}} /><label htmlFor="cp-chk" style={{fontSize:12,color:'var(--t1)',cursor:'pointer'}}>Caminho crítico</label></div>
        </div>
        {editingTask && (
          <div style={{borderTop:'0.5px solid var(--bd)',paddingTop:12}}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--t1)',marginBottom:10}}>Dependências</div>
            {loadingDeps ? <div style={{fontSize:11,color:'var(--t2)'}}>Carregando...</div> : (
              <>
                <div style={{marginBottom:8}}><div style={{fontSize:11,fontWeight:500,color:'var(--t2)',marginBottom:4}}>Predecessoras</div>{predecessors.length===0?<div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>Nenhuma</div>:predecessors.map(d=>depRow(d,'pred'))}</div>
                <div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:500,color:'var(--t2)',marginBottom:4}}>Sucessoras</div>{successors.length===0?<div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>Nenhuma</div>:successors.map(d=>depRow(d,'succ'))}</div>
                {!addingDep?(
                  <div style={{display:'flex',gap:6}}>
                    <button className="ao-btn ao-btn-sm" onClick={()=>{setAddingDep(true);setAddDepRole('predecessor');}}>+ Predecessora</button>
                    <button className="ao-btn ao-btn-sm" onClick={()=>{setAddingDep(true);setAddDepRole('successor');}}>+ Sucessora</button>
                  </div>
                ):(
                  <div style={{background:'var(--bg2)',borderRadius:8,padding:10,border:'0.5px solid var(--bd)'}}>
                    <div style={{fontSize:11,color:'var(--t2)',marginBottom:6}}>Selecionar {addDepRole==='predecessor'?'predecessora':'sucessora'}:</div>
                    <input style={{...inp,marginBottom:6}} placeholder="Buscar..." value={depSearch} onChange={e=>setDepSearch(e.target.value)} autoFocus />
                    <div style={{maxHeight:120,overflowY:'auto',marginBottom:6}}>
                      {depCandidates.length===0?<div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>Nenhuma encontrada</div>:depCandidates.map(t=>(
                        <div key={t.id} onClick={()=>handleAddDep(t.id)} style={{cursor:'pointer',padding:'4px 6px',borderRadius:4,fontSize:11,display:'flex',gap:6,alignItems:'center'}} onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background='var(--bg3)';}} onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background='';}}>
                          <span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--t3)',minWidth:32,flexShrink:0}}>{t.code}</span>
                          <span style={{color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
                        </div>
                      ))}
                    </div>
                    <button className="ao-btn ao-btn-sm" onClick={()=>{setAddingDep(false);setDepSearch('');}}>Cancelar</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,borderTop:'0.5px solid var(--bd)',paddingTop:12}}>
          <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="ao-btn ao-btn-sm" style={{background:'#2563EB',color:'#fff',border:'none',opacity:saving||!form.name.trim()?0.6:1}} onClick={handleSave} disabled={saving||!form.name.trim()}>{saving?'Salvando...':editingTask?'Atualizar':'Criar'}</button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirm ─────────────────────────────────────────────────────────────

interface DeleteConfirmProps { task:GanttTask|null; allTasks:GanttTask[]; loading:boolean; onConfirm:()=>void; onCancel:()=>void; }

function DeleteConfirm({ task, allTasks, loading, onConfirm, onCancel }: DeleteConfirmProps) {
  if (!task) return null;
  const childCount = allTasks.filter(t=>{ let pid=t.parentId; while(pid){if(pid===task.id)return true; pid=allTasks.find(x=>x.id===pid)?.parentId;} return false;}).length;
  return (
    <div style={{position:'fixed',inset:0,zIndex:1001,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{background:'var(--bg1)',border:'0.5px solid var(--bd)',borderRadius:12,padding:'1.25rem',width:'100%',maxWidth:360}}>
        <div style={{fontWeight:600,fontSize:14,color:'var(--t1)',marginBottom:8}}>Excluir atividade</div>
        <p style={{fontSize:12,color:'var(--t2)',marginBottom:childCount>0?6:16}}>Tem certeza que deseja excluir <strong style={{color:'var(--t1)'}}>{`"${task.name}"`}</strong>?</p>
        {childCount>0&&<p style={{fontSize:12,color:'#C9312F',marginBottom:16}}>⚠ {childCount} atividade{childCount>1?'s filha':' filha'} também {childCount>1?'serão excluídas':'será excluída'}.</p>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button className="ao-btn ao-btn-sm" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="ao-btn ao-btn-sm" style={{background:'#C9312F',color:'#fff',border:'none',opacity:loading?0.6:1}} onClick={onConfirm} disabled={loading}>{loading?'Excluindo...':'Excluir'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────

interface TableViewProps {
  visibleTasks: GanttTask[]; expanded: Set<string>; hoveredRow: string|null;
  onToggle:(id:string)=>void; onEdit:(t:GanttTask,e:React.MouseEvent)=>void;
  onAddChild:(t:GanttTask,e:React.MouseEvent)=>void; onDelete:(t:GanttTask,e:React.MouseEvent)=>void;
  onHover:(id:string|null)=>void; loading:boolean;
}

function TableView({ visibleTasks, expanded, hoveredRow, onToggle, onEdit, onAddChild, onDelete, onHover, loading }: TableViewProps) {
  const COL = '28px 60px 1fr 56px 84px 84px 56px 88px 88px 60px';
  const hdrStyle: React.CSSProperties = { display:'grid', gridTemplateColumns:COL, height:38, background:'#1C2E4A', color:'#fff', alignItems:'center', flexShrink:0, borderRadius:'10px 10px 0 0', fontSize:10, fontWeight:600, letterSpacing:'0.06em' };
  const cellPad: React.CSSProperties = { padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center' };
  const numCell: React.CSSProperties = { ...cellPad, justifyContent:'center' };

  return (
    <div style={{border:'0.5px solid var(--bd)',borderRadius:10,overflow:'hidden'}}>
      <div style={hdrStyle}>
        <div />
        <div style={cellPad}>CÓDIGO</div>
        <div style={cellPad}>TAREFA</div>
        <div style={numCell}>PROG.</div>
        <div style={cellPad}>INÍCIO</div>
        <div style={cellPad}>TÉRMINO</div>
        <div style={numCell}>DIAS</div>
        <div style={numCell}>PLANEJADO</div>
        <div style={numCell}>REALIZADO</div>
        <div />
      </div>
      <div style={{maxHeight:520,overflowY:'auto'}}>
        {loading ? Array.from({length:8}).map((_,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:COL,height:ROW_H,alignItems:'center',borderBottom:'0.5px solid var(--bd)'}}>
            {Array.from({length:5}).map((_2,j)=><div key={j} style={{height:8,background:'var(--bg3)',borderRadius:4,margin:'0 8px'}}/>)}
          </div>
        )) : visibleTasks.map(task=>{
          const lv = getLv(task.level);
          const isHov = hoveredRow===task.id;
          const isExp = expanded.has(task.id)||false;
          const pb = progressBadge(task.actualProgress,task.plannedProgress);
          const bg = isHov ? lv.hov : lv.bg;

          return (
            <div
              key={task.id}
              style={{display:'grid',gridTemplateColumns:COL,height:ROW_H,alignItems:'center',borderBottom:'0.5px solid var(--bd)',background:bg,cursor:'pointer',color:lv.fg,fontSize:11,transition:'background .1s'}}
              onMouseEnter={()=>onHover(task.id)}
              onMouseLeave={()=>onHover(null)}
              onClick={e=>onEdit(task,e)}
            >
              {/* Toggle */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                {task.hasChildren?(
                  <button onClick={e=>{e.stopPropagation();onToggle(task.id);}} style={{width:18,height:18,border:'none',background:'none',cursor:'pointer',color:'inherit',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',padding:0,transition:'transform .15s',transform:isExp?'rotate(90deg)':'rotate(0deg)'}}>▶</button>
                ):<span/>}
              </div>
              {/* Code */}
              <div style={{...cellPad,fontFamily:'var(--mono)',fontSize:10,opacity:0.7}}>{task.code}</div>
              {/* Name */}
              <div style={{...cellPad,paddingLeft:8+task.level*16,fontWeight:task.level<=1?600:400,gap:4}}>
                {task.isCriticalPath&&<span style={{width:4,height:4,borderRadius:'50%',background:GANTT_CRITICAL,flexShrink:0,display:'inline-block'}}/>}
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={task.name}>{task.name}</span>
              </div>
              {/* Progress badge */}
              <div style={numCell}>
                <span style={{padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,background:pb.bg,color:pb.color}}>{task.actualProgress}%</span>
              </div>
              {/* Start */}
              <div style={cellPad}>{fmtDate(task.startDate)}</div>
              {/* End */}
              <div style={cellPad}>{fmtDate(task.endDate)}</div>
              {/* Duration */}
              <div style={numCell}>{task.durationDays??'—'}d</div>
              {/* Planned % bar */}
              <div style={{...numCell,flexDirection:'column',gap:2}}>
                <span style={{fontSize:9}}>{task.plannedProgress}%</span>
                <div style={{width:60,height:4,background:'rgba(0,0,0,0.12)',borderRadius:2}}>
                  <div style={{width:`${task.plannedProgress}%`,height:'100%',background:'rgba(91,63,138,0.6)',borderRadius:2}}/>
                </div>
              </div>
              {/* Actual % bar */}
              <div style={{...numCell,flexDirection:'column',gap:2}}>
                <span style={{fontSize:9}}>{task.actualProgress}%</span>
                <div style={{width:60,height:4,background:'rgba(0,0,0,0.12)',borderRadius:2}}>
                  <div style={{width:`${task.actualProgress}%`,height:'100%',background:GANTT_BAR,borderRadius:2}}/>
                </div>
              </div>
              {/* Actions */}
              <div style={{display:'flex',gap:2,padding:'0 4px',justifyContent:'center'}}>
                {isHov&&<>
                  <button title="Subitem" onClick={e=>onAddChild(task,e)} style={{width:18,height:18,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:4,background:'rgba(255,255,255,0.6)',cursor:'pointer',color:lv.fg,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>+</button>
                  <button title="Excluir" onClick={e=>onDelete(task,e)} style={{width:18,height:18,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:4,background:'rgba(255,255,255,0.6)',cursor:'pointer',color:'#C9312F',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>×</button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Cronograma() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  const [tasks, setTasks]     = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch]   = useState('');
  const [hoveredRow, setHoveredRow] = useState<string|null>(null);
  const [viewMode, setViewMode] = useState<'gantt'|'table'>('gantt');

  const [modalOpen, setModalOpen]     = useState(false);
  const [editingTask, setEditingTask] = useState<GanttTask|null>(null);
  const [parentTask, setParentTask]   = useState<GanttTask|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GanttTask|null>(null);
  const [deleting, setDeleting]       = useState(false);

  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const hdrRef   = useRef<HTMLDivElement>(null);
  const syncRef  = useRef(false);

  useEffect(()=>{ const t=setTimeout(()=>setSearch(searchRaw.trim().toLowerCase()),250); return()=>clearTimeout(t); },[searchRaw]);

  const loadData = useCallback(()=>{
    if (!projectId) return;
    setLoading(true);
    scheduleApi.ganttData(projectId)
      .then(data=>{ setTasks(data); setExpanded(new Set(data.filter(t=>t.hasChildren&&t.level<=1).map(t=>t.id))); })
      .catch(()=>{ const mock=buildMockTasks(); setTasks(mock); setExpanded(new Set(mock.filter(t=>t.hasChildren&&t.level<=1).map(t=>t.id))); })
      .finally(()=>setLoading(false));
  },[projectId]);

  useEffect(()=>{
    if (projectId) loadData();
    else { const m=buildMockTasks(); setTasks(m); setExpanded(new Set(m.filter(t=>t.hasChildren&&t.level<=1).map(t=>t.id))); }
  },[loadData,projectId]);

  const ancestorIds = useMemo(():Set<string>=>{
    if (!search) return new Set();
    const ip: Record<string,string>={};
    tasks.forEach(t=>{if(t.parentId)ip[t.id]=t.parentId;});
    const ans=new Set<string>();
    tasks.filter(t=>t.name.toLowerCase().includes(search)).forEach(t=>{let p=t.parentId;while(p){ans.add(p);p=ip[p];}});
    return ans;
  },[search,tasks]);

  const visibleTasks = useMemo(()=>{
    if (search) { const m=new Set(tasks.filter(t=>t.name.toLowerCase().includes(search)).map(t=>t.id)); return tasks.filter(t=>m.has(t.id)||ancestorIds.has(t.id)); }
    const hidden=new Set<string>();
    tasks.forEach(t=>{
      if (!t.parentId) return;
      let pid:string|undefined=t.parentId;
      while(pid){const par=tasks.find(x=>x.id===pid);if(!par)break;if(par.hasChildren&&!expanded.has(par.id)){hidden.add(t.id);break;}pid=par.parentId;}
    });
    return tasks.filter(t=>!hidden.has(t.id));
  },[tasks,expanded,search,ancestorIds]);

  // Day grid
  const dayCells = useMemo(()=>{
    if (tasks.length===0){ const now=new Date(); return buildDayCells(new Date(now.getFullYear(),now.getMonth()-1,1),new Date(now.getFullYear(),now.getMonth()+8,1)); }
    const dates=tasks.flatMap(t=>[parseDate(t.startDate),parseDate(t.endDate)]);
    const mn=new Date(Math.min(...dates.map(d=>d.getTime()))); mn.setMonth(mn.getMonth()-1);
    const mx=new Date(Math.max(...dates.map(d=>d.getTime()))); mx.setMonth(mx.getMonth()+1);
    return buildDayCells(mn,mx);
  },[tasks]);

  const weekHeaders = useMemo(()=>buildWeekHeaders(dayCells),[dayCells]);
  const totalGridW  = dayCells.length * DAY_W;
  const todayX = useMemo(()=>{ const s=new Date().toISOString().split('T')[0]; const i=dayCells.findIndex(c=>c.date===s); return i>=0?i*DAY_W+DAY_W/2:-1; },[dayCells]);

  function onLeftScroll(){if(syncRef.current)return;syncRef.current=true;if(rightRef.current&&leftRef.current)rightRef.current.scrollTop=leftRef.current.scrollTop;syncRef.current=false;}
  function onRightScroll(){if(syncRef.current)return;syncRef.current=true;if(leftRef.current&&rightRef.current)leftRef.current.scrollTop=rightRef.current.scrollTop;if(hdrRef.current&&rightRef.current)hdrRef.current.scrollLeft=rightRef.current.scrollLeft;syncRef.current=false;}

  function toggleExpand(id:string){setExpanded(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});}
  function expandAll(){setExpanded(new Set(tasks.filter(t=>t.hasChildren).map(t=>t.id)));}
  function collapseAll(){setExpanded(new Set());}

  function handleExport(){
    if (!tasks.length) return;
    const hdr='Código,Nome,Nível,Início,Fim,Duração,Plan%,Real%,Crítico';
    const rows=tasks.map(t=>`"${t.code}","${t.name}",${t.level},"${t.startDate.slice(0,10)}","${t.endDate.slice(0,10)}",${t.durationDays??''},${t.plannedProgress},${t.actualProgress},${t.isCriticalPath?'Sim':'Não'}`);
    const blob=new Blob(['﻿'+[hdr,...rows].join('\n')],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cronograma.csv';a.click();
    addToast({type:'success',title:'CSV exportado'});
  }

  function openNew(){ setEditingTask(null); setParentTask(null); setModalOpen(true); }
  function openNewChild(t:GanttTask,e:React.MouseEvent){ e.stopPropagation(); setEditingTask(null); setParentTask(t); setModalOpen(true); }
  function openEdit(t:GanttTask,e:React.MouseEvent){ e.stopPropagation(); setEditingTask(t); setParentTask(null); setModalOpen(true); }
  function openDelete(t:GanttTask,e:React.MouseEvent){ e.stopPropagation(); setDeleteTarget(t); }

  async function confirmDelete(){
    if (!deleteTarget) return;
    setDeleting(true);
    try{ await scheduleApi.delete(deleteTarget.id); addToast({type:'success',title:'Excluído',description:`"${deleteTarget.name}" removido.`}); setDeleteTarget(null); loadData(); }
    catch{ addToast({type:'error',title:'Erro',description:'Não foi possível excluir.'}); }
    finally{ setDeleting(false); }
  }

  if (!currentProject) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:16,textAlign:'center',padding:'0 1rem'}}>
      <p style={{fontSize:16,fontWeight:600,color:'var(--t1)',marginBottom:4}}>Selecione um projeto</p>
      <p style={{fontSize:13,color:'var(--t2)'}}>Escolha um projeto no seletor acima para visualizar o cronograma.</p>
    </div>
  );

  // Left panel row
  const renderLeftRow = (task: GanttTask) => {
    const lv    = getLv(task.level);
    const isHov = hoveredRow===task.id;
    const isExp = expanded.has(task.id)||!!search;
    const pb    = progressBadge(task.actualProgress,task.plannedProgress);
    const bg    = isHov ? lv.hov : lv.bg;

    return (
      <div
        key={task.id}
        onMouseEnter={()=>setHoveredRow(task.id)}
        onMouseLeave={()=>setHoveredRow(null)}
        onClick={e=>openEdit(task,e)}
        style={{height:ROW_H,display:'flex',alignItems:'center',borderBottom:'0.5px solid rgba(0,0,0,0.07)',background:bg,cursor:'pointer',transition:'background .08s',overflow:'hidden',userSelect:'none',color:lv.fg}}
      >
        {/* Indent + expand */}
        <div style={{width:8+task.level*14,flexShrink:0}}/>
        {task.hasChildren
          ? <button onClick={e=>{e.stopPropagation();toggleExpand(task.id);}} style={{width:18,height:18,border:'none',background:'none',cursor:'pointer',color:'inherit',fontSize:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',padding:0,transition:'transform .15s',transform:isExp?'rotate(90deg)':'rotate(0deg)'}}>▶</button>
          : <span style={{width:18,flexShrink:0}}/>
        }
        {/* Code */}
        <span style={{fontFamily:'var(--mono)',fontSize:9,opacity:0.5,flexShrink:0,minWidth:44}}>{task.code}</span>
        {/* Name */}
        <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:task.level<=1?12:11,fontWeight:task.level<=1?600:400,paddingRight:4,display:'flex',alignItems:'center',gap:4}}>
          {task.isCriticalPath&&<span style={{width:5,height:5,borderRadius:'50%',background:GANTT_CRITICAL,flexShrink:0,display:'inline-block'}}/>}
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={task.name}>{task.name}</span>
        </span>
        {/* Prog / actions */}
        {isHov ? (
          <div style={{display:'flex',gap:2,flexShrink:0,paddingRight:4}}>
            <button title="Subitem" onClick={e=>openNewChild(task,e)} style={{width:20,height:20,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:4,background:'rgba(255,255,255,0.7)',cursor:'pointer',color:lv.fg,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>+</button>
            <button title="Editar" onClick={e=>openEdit(task,e)} style={{width:20,height:20,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:4,background:'rgba(255,255,255,0.7)',cursor:'pointer',color:lv.fg,fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>✎</button>
            <button title="Excluir" onClick={e=>openDelete(task,e)} style={{width:20,height:20,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:4,background:'rgba(255,255,255,0.7)',cursor:'pointer',color:'#C9312F',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>×</button>
          </div>
        ):(
          <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0,paddingRight:6}}>
            <span style={{padding:'1px 6px',borderRadius:8,fontSize:9,fontWeight:700,background:pb.bg,color:pb.color}}>{task.actualProgress}%</span>
          </div>
        )}
        {/* Dates columns */}
        <div style={{width:78,flexShrink:0,fontSize:10,color:'inherit',opacity:0.7,borderLeft:'0.5px solid rgba(0,0,0,0.08)',paddingLeft:6,paddingRight:4}}>{fmtDate(task.startDate)}</div>
        <div style={{width:78,flexShrink:0,fontSize:10,color:'inherit',opacity:0.7,borderLeft:'0.5px solid rgba(0,0,0,0.08)',paddingLeft:6}}>{fmtDate(task.endDate)}</div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="ao-card" style={{padding:'0.75rem 1rem',marginBottom:0}}>

        {/* Toolbar */}
        <div className="ao-card-hdr" style={{marginBottom:8}}>
          <span className="ao-card-title">EAP — Cronograma completo</span>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <input placeholder="Buscar atividade..." value={searchRaw} onChange={e=>setSearchRaw(e.target.value)}
              style={{padding:'5px 9px',fontSize:11,border:'0.5px solid var(--bd2)',borderRadius:8,background:'var(--bg1)',color:'var(--t1)',width:160}} />
            <button className="ao-btn ao-btn-sm" onClick={expandAll}>Expandir</button>
            <button className="ao-btn ao-btn-sm" onClick={collapseAll}>Recolher</button>
            <button className="ao-btn ao-btn-sm" onClick={handleExport}>CSV</button>

            {/* View toggle */}
            <div style={{display:'flex',gap:2,background:'var(--bg3)',borderRadius:8,padding:2}}>
              {(['gantt','table'] as const).map(v=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'4px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,background:viewMode===v?'var(--bg1)':'transparent',color:viewMode===v?'var(--t1)':'var(--t3)',fontWeight:viewMode===v?600:400,transition:'all .15s',fontFamily:'var(--font)'}}>
                  {v==='gantt'?'Gantt':'Lista'}
                </button>
              ))}
            </div>

            <button className="ao-btn ao-btn-sm" style={{background:'#2563EB',color:'#fff',border:'none'}} onClick={openNew}>+ Nova atividade</button>
          </div>
        </div>

        {/* Level legend */}
        <div style={{display:'flex',gap:10,fontSize:10,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
          {PALETTE.map((p,i)=>(
            <span key={i} style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{width:10,height:10,borderRadius:2,background:p.bg,border:`1px solid ${p.badge}`,display:'inline-block'}}/>
              <span style={{color:'var(--t2)'}}>{['Raiz','Fase','Etapa','Tarefa'][i]}</span>
            </span>
          ))}
          <span style={{display:'flex',alignItems:'center',gap:4,marginLeft:4}}>
            <span style={{width:12,height:5,background:GANTT_BAR,borderRadius:2,display:'inline-block'}}/>
            <span style={{color:'var(--t2)'}}>Realizado</span>
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:12,height:5,background:GANTT_PLAN_BG.replace('0.18','0.5'),borderRadius:2,display:'inline-block',border:`1px solid ${GANTT_BAR}33`}}/>
            <span style={{color:'var(--t2)'}}>Planejado</span>
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:GANTT_CRITICAL,display:'inline-block'}}/>
            <span style={{color:'var(--t2)'}}>Crítico</span>
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:1,height:12,background:TODAY_COL,display:'inline-block'}}/>
            <span style={{color:'var(--t2)'}}>Hoje</span>
          </span>
          {viewMode==='gantt'&&<span style={{fontSize:10,color:'var(--t3)',fontStyle:'italic',marginLeft:4}}>· Clique para editar · Passe o mouse para ações</span>}
        </div>

        {/* ── GANTT VIEW ── */}
        {viewMode==='gantt'&&(
          <div style={{display:'flex',border:'0.5px solid var(--bd)',borderRadius:10,overflow:'hidden',height:520}}>

            {/* Left panel */}
            <div style={{width:LEFT_W,flexShrink:0,borderRight:'0.5px solid rgba(0,0,0,0.12)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {/* Header */}
              <div style={{height:HDR_H,background:'#1C2E4A',color:'#fff',display:'flex',alignItems:'flex-end',flexShrink:0,fontSize:10,fontWeight:600,letterSpacing:'0.06em',borderBottom:'0.5px solid rgba(255,255,255,0.1)'}}>
                <div style={{flex:1,padding:'0 8px 6px',borderRight:'0.5px solid rgba(255,255,255,0.1)'}}>TAREFA</div>
                <div style={{width:78,padding:'0 6px 6px',borderRight:'0.5px solid rgba(255,255,255,0.1)',textAlign:'center'}}>INÍCIO</div>
                <div style={{width:78,padding:'0 6px 6px',textAlign:'center'}}>TÉRMINO</div>
              </div>
              {/* Rows */}
              <div ref={leftRef} onScroll={onLeftScroll} style={{overflowY:'scroll',overflowX:'hidden',flex:1}}>
                {loading
                  ? Array.from({length:12}).map((_,i)=><div key={i} style={{height:ROW_H,borderBottom:'0.5px solid var(--bd)',display:'flex',alignItems:'center',padding:'0 12px',gap:8}}><div style={{height:8,background:'var(--bg3)',borderRadius:4,width:'70%'}}/></div>)
                  : visibleTasks.map(renderLeftRow)
                }
              </div>
            </div>

            {/* Right: day grid */}
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
              {/* Day headers */}
              <div ref={hdrRef} style={{height:HDR_H,flexShrink:0,overflow:'hidden',background:'#1C2E4A',borderBottom:'0.5px solid rgba(255,255,255,0.1)'}}>
                <div style={{position:'relative',width:totalGridW,height:HDR_H}}>
                  {/* Week headers row */}
                  {weekHeaders.map((wh,i)=>(
                    <div key={i} style={{position:'absolute',left:wh.left,top:0,width:wh.width,height:HDR_WK_H,borderRight:'0.5px solid rgba(255,255,255,0.1)',padding:'0 6px',fontSize:9,color:'rgba(255,255,255,0.8)',display:'flex',alignItems:'center',fontWeight:600,letterSpacing:'0.04em',overflow:'hidden',whiteSpace:'nowrap'}}>
                      {wh.label}
                    </div>
                  ))}
                  {/* Day letters row */}
                  {dayCells.map(day=>(
                    <div key={day.idx} style={{position:'absolute',left:day.left,top:HDR_WK_H,width:DAY_W,height:HDR_DAY_H,borderRight:`0.5px solid rgba(255,255,255,${day.isWeekend?0.05:0.08})`,fontSize:8,color:day.isToday?TODAY_COL:day.isWeekend?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.6)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:day.isToday?700:400,background:day.isToday?'rgba(232,64,64,0.15)':'transparent'}}>
                      {day.letter}
                    </div>
                  ))}
                  {/* Today line in header */}
                  {todayX>=0&&<div style={{position:'absolute',left:todayX,top:0,width:2,height:HDR_H,background:TODAY_COL,zIndex:3}}/>}
                </div>
              </div>

              {/* Scrollable bar body */}
              <div ref={rightRef} onScroll={onRightScroll} style={{flex:1,overflow:'auto',background:'var(--bg1)'}}>
                <div style={{position:'relative',width:totalGridW,height:visibleTasks.length*ROW_H}}>
                  {/* Weekend column shading */}
                  {dayCells.filter(d=>d.isWeekend).map(day=>(
                    <div key={day.idx} style={{position:'absolute',left:day.left,top:0,bottom:0,width:DAY_W,background:'rgba(0,0,0,0.025)',pointerEvents:'none'}}/>
                  ))}
                  {/* Vertical day lines */}
                  {dayCells.filter((_,i)=>i%7===0).map(day=>(
                    <div key={day.idx} style={{position:'absolute',left:day.left,top:0,bottom:0,width:1,background:'rgba(0,0,0,0.08)',pointerEvents:'none'}}/>
                  ))}
                  {/* Today line */}
                  {todayX>=0&&<div style={{position:'absolute',left:todayX,top:0,bottom:0,width:2,background:'rgba(232,64,64,0.35)',zIndex:2,pointerEvents:'none'}}/>}

                  {/* Task rows + bars */}
                  {!loading&&visibleTasks.map((task,rowIdx)=>{
                    const lv = getLv(task.level);
                    const isHov = hoveredRow===task.id;
                    const pos = getBarPos(task,dayCells);
                    const barH  = task.level<=1?12:8;
                    const barTop= Math.round((ROW_H-barH)/2);
                    const bg = isHov ? lv.hov : lv.bg;
                    const barColor = task.isCriticalPath ? GANTT_CRITICAL : GANTT_BAR;

                    return (
                      <div key={task.id} style={{position:'absolute',top:rowIdx*ROW_H,left:0,width:'100%',height:ROW_H,background:bg,borderBottom:'0.5px solid rgba(0,0,0,0.07)'}}
                        onMouseEnter={()=>setHoveredRow(task.id)} onMouseLeave={()=>setHoveredRow(null)}>
                        {pos&&<>
                          {/* Planned bar (background) */}
                          <div style={{position:'absolute',left:pos.left,width:pos.width,height:barH,top:barTop,background:task.isCriticalPath?'rgba(192,57,43,0.15)':GANTT_PLAN_BG,borderRadius:3,border:`0.5px solid ${barColor}33`}}/>
                          {/* Actual bar */}
                          <div style={{position:'absolute',left:pos.left,width:Math.max(2,Math.round(pos.width*task.actualProgress/100)),height:barH,top:barTop,background:barColor,borderRadius:3}}/>
                          {/* Progress label on bar */}
                          {task.actualProgress>10&&(
                            <span style={{position:'absolute',left:pos.left+6,top:barTop-1,fontSize:8,color:'#fff',fontWeight:700,lineHeight:`${barH}px`,pointerEvents:'none'}}>{task.actualProgress}%</span>
                          )}
                          {/* Bar tooltip */}
                          <div style={{position:'absolute',left:pos.left,width:pos.width,height:ROW_H,top:0,zIndex:1}} title={`${task.code} — ${task.name}\nInício: ${fmtDate(task.startDate)}  Fim: ${fmtDate(task.endDate)}\nDuração: ${task.durationDays??'—'} dias\nPlanejado: ${task.plannedProgress}%  Realizado: ${task.actualProgress}%`}/>
                        </>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {viewMode==='table'&&(
          <TableView
            visibleTasks={visibleTasks} expanded={expanded} hoveredRow={hoveredRow}
            onToggle={toggleExpand} onEdit={openEdit} onAddChild={openNewChild} onDelete={openDelete}
            onHover={setHoveredRow} loading={loading}
          />
        )}
      </div>

      <TaskModal open={modalOpen} editingTask={editingTask} parentTask={parentTask} allTasks={tasks} projectId={projectId!} addToast={addToast} onClose={()=>setModalOpen(false)} onSaved={loadData}/>
      <DeleteConfirm task={deleteTarget} allTasks={tasks} loading={deleting} onConfirm={confirmDelete} onCancel={()=>setDeleteTarget(null)}/>
    </>
  );
}
