import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeeklyActivity, WeeklyProgram, WeeklyRestriction } from '../../types';
import { ORIGIN_LABEL, STATUS_LABEL } from './weekly-logic';

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function programTitle(program: WeeklyProgram): string {
  return `Programação Semanal — Semana ${program.weekNumber}/${program.year} (${fmtDate(program.startDate)} a ${fmtDate(program.endDate)})`;
}

function activityRows(activities: WeeklyActivity[]) {
  return activities.map((a) => ({
    Local: a.local || '—',
    Torre: a.torre || '—',
    Pavimento: a.pavimento || '—',
    Atividade: a.activityName,
    Empresa: a.contractor?.name ?? '—',
    'Responsável': a.responsible || '—',
    Status: STATUS_LABEL[a.status],
    '% Executado': a.status === 'CANCELADA' ? 'Fora do PPC' : `${a.percentExecuted}%`,
    Origem: ORIGIN_LABEL[a.origin],
  }));
}

function restrictionRows(restrictions: WeeklyRestriction[], activities: WeeklyActivity[]) {
  const nameById = new Map(activities.map((a) => [a.id, a.activityName]));
  return restrictions.map((r) => ({
    Tipo: r.type?.name ?? '—',
    'Descrição': r.description,
    'Resp. remoção': r.responsible,
    Prevista: fmtDate(r.dueDate),
    Resolvida: fmtDate(r.resolvedAt),
    Impacta: r.impactsProgram ? 'Sim' : 'Não',
    Status: r.status === 'RESOLVIDA' ? 'Resolvida' : 'Pendente',
    'Atividades vinculadas': (r.activityLinks ?? [])
      .map((l) => nameById.get(l.activityId) ?? '')
      .filter(Boolean)
      .join('; ') || '—',
  }));
}

export function exportToExcel(
  program: WeeklyProgram,
  activities: WeeklyActivity[],
  restrictions: WeeklyRestriction[],
) {
  const wb = XLSX.utils.book_new();
  const wsActivities = XLSX.utils.json_to_sheet(activityRows(activities));
  wsActivities['!cols'] = [12, 14, 14, 44, 22, 20, 14, 12, 18].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsActivities, 'Programação');

  const wsRestrictions = XLSX.utils.json_to_sheet(restrictionRows(restrictions, activities));
  wsRestrictions['!cols'] = [16, 44, 24, 12, 12, 8, 10, 44].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsRestrictions, 'Restrições');

  XLSX.writeFile(wb, `programacao-semanal-S${program.weekNumber}-${program.year}.xlsx`);
}

export function exportToPdf(
  program: WeeklyProgram,
  activities: WeeklyActivity[],
  restrictions: WeeklyRestriction[],
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(13);
  doc.text(programTitle(program), 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Status: ${program.status} · Reunião: ${fmtDate(program.meetingDate)} · Gerado em ${fmtDate(new Date().toISOString())}`,
    40,
    56,
  );

  const acts = activityRows(activities);
  autoTable(doc, {
    startY: 72,
    head: [Object.keys(acts[0] ?? { Atividade: '' })],
    body: acts.map((r) => Object.values(r)),
    styles: { fontSize: 7.5, cellPadding: 3 },
    headStyles: { fillColor: [29, 78, 216], fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  });

  if (restrictions.length > 0) {
    const rests = restrictionRows(restrictions, activities);
    const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Restrições', 40, lastY + 26);
    autoTable(doc, {
      startY: lastY + 34,
      head: [Object.keys(rests[0])],
      body: rests.map((r) => Object.values(r)),
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [217, 119, 6], fontSize: 7.5 },
      alternateRowStyles: { fillColor: [252, 248, 240] },
    });
  }

  doc.save(`programacao-semanal-S${program.weekNumber}-${program.year}.pdf`);
}
