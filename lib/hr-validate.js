'use strict';

// Проверки снимка отчёта перед записью в базу.
// Снимок — объект вида { meta:{...}, composition:{...}, ... } (та же форма, что DEMO в index.html).
// Возвращает { errors, warnings }. Запись блокируется, если есть errors.
// Warnings не блокируют, но попадают в отчёт импорта, чтобы их видели.

const BLOCK_KEYS = [
  'meta', 'composition', 'recruitment', 'admin', 'assessment', 'discipline',
  'departments', 'budget', 'plan', 'hrEfficiency', 'uchrInteraction', 'functionAnalysis',
  'proposals', 'massRecruitment',
];

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function sum(arr, pick) {
  return (arr || []).reduce((s, x) => s + (isNum(pick(x)) ? pick(x) : 0), 0);
}

function validateSnapshot(snap, period) {
  const errors = [];
  const warnings = [];

  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
    return { errors: ['snapshot_not_object'], warnings };
  }

  for (const k of Object.keys(snap)) {
    if (!BLOCK_KEYS.includes(k)) errors.push(`unknown_block:${k}`);
  }

  const missing = BLOCK_KEYS.filter((k) => snap[k] === undefined);
  if (missing.length) warnings.push(`missing_blocks:${missing.join(',')}`);

  // meta
  if (!snap.meta || typeof snap.meta.period !== 'string' || !snap.meta.period.trim()) {
    errors.push('meta.period_required');
  }
  if (period && !PERIOD_RE.test(period)) errors.push('period_format_YYYY-MM');

  // percentages must be within 0..100
  const pct = (path, v) => {
    if (v === null || v === undefined) return;
    if (!isNum(v) || v < 0 || v > 100) errors.push(`out_of_range_0_100:${path}`);
  };
  if (snap.composition && snap.composition.turnoverRate) {
    pct('composition.turnoverRate.current', snap.composition.turnoverRate.current);
    pct('composition.turnoverRate.prev', snap.composition.turnoverRate.prev);
  }

  // composition vs headcount history
  const comp = snap.composition;
  if (comp && comp.gender && Array.isArray(comp.headcountHistory) && comp.headcountHistory.length) {
    const last = comp.headcountHistory[comp.headcountHistory.length - 1];
    const genderSum = (comp.gender.male || 0) + (comp.gender.female || 0);
    if (isNum(last.count) && genderSum !== last.count) {
      warnings.push(`gender_sum_${genderSum}_ne_headcount_${last.count}`);
    }
  }

  // admin: headcount total vs male+female
  if (snap.admin && Array.isArray(snap.admin.headcount) && snap.admin.headcount.length) {
    const h = snap.admin.headcount[snap.admin.headcount.length - 1];
    if (isNum(h.male) && isNum(h.female) && isNum(h.total) && h.male + h.female !== h.total) {
      warnings.push(`admin_headcount_sum_${h.male + h.female}_ne_total_${h.total}`);
    }
  }

  // discipline: by type vs total
  const disc = snap.discipline;
  if (disc && Array.isArray(disc.byType) && disc.totalViolations) {
    const byType = sum(disc.byType, (x) => x.count);
    if (isNum(disc.totalViolations.current) && byType !== disc.totalViolations.current) {
      warnings.push(`discipline_bytype_${byType}_ne_total_${disc.totalViolations.current}`);
    }
  }
  if (disc && Array.isArray(disc.byDept) && disc.byType) {
    const byType = sum(disc.byType, (x) => x.count);
    const byDept = sum(disc.byDept, (x) => x.count);
    if (byDept > byType) errors.push(`discipline_bydept_${byDept}_gt_bytype_${byType}`);
  }

  // recruitment: adaptation arithmetic
  const ad = snap.recruitment && snap.recruitment.adaptation;
  if (ad && isNum(ad.total) && isNum(ad.passed) && isNum(ad.failed) && isNum(ad.inProgress)) {
    if (ad.passed + ad.failed + ad.inProgress !== ad.total) {
      warnings.push(`adaptation_${ad.passed}+${ad.failed}+${ad.inProgress}_ne_total_${ad.total}`);
    }
  }

  // assessment: driver test participants must cover satisfactory + unsatisfactory
  const dt = snap.assessment && snap.assessment.driverTest;
  if (dt) {
    for (const pk of ['oct', 'sept']) {
      const p = dt[pk];
      if (!p || !isNum(p.participants)) continue;
      const judged = (p.satisfactory || 0) + (p.unsatisfactory || 0);
      if (judged > p.participants) errors.push(`driverTest_${pk}_judged_${judged}_gt_participants_${p.participants}`);
    }
  }

  // departments: empty KPI rows
  if (snap.departments && Array.isArray(snap.departments.rows)) {
    for (const r of snap.departments.rows) {
      if (r.kpi === null || r.kpi === undefined) warnings.push(`departments_kpi_empty:${r.dept}`);
    }
  }

  // budget: null facts
  if (snap.budget && Array.isArray(snap.budget.byLine)) {
    for (const l of snap.budget.byLine) {
      if (l.fact === null || l.fact === undefined) warnings.push(`budget_fact_empty:${l.line}`);
    }
  }

  return { errors, warnings };
}

module.exports = { validateSnapshot, BLOCK_KEYS, PERIOD_RE };
