import { Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { ProgressReport } from '../hooks/useProgressReport';

export async function shareDadHealthReport(month: string, score: number, report: ProgressReport): Promise<string> {
  const table = buildReportTable(month, score, report);
  try {
    const { uri } = await Print.printToFileAsync({ html: buildReportHtml(month, score, report) });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Save or share Dad Health report',
      });
      return 'Report ready.';
    }
    await Share.share({ title: 'My Dad Health Report', message: table });
    return 'Report shared.';
  } catch {
    try {
      await Share.share({ title: 'My Dad Health Report', message: table });
      return 'Report shared.';
    } catch {
      return 'We could not share your report. Please try again.';
    }
  }
}

function buildReportTable(month: string, score: number, report: ProgressReport) {
  const rows = [
    ['Dad Health Score', `${score}/100`],
    ['Workouts', String(report.workouts)],
    ['Journal entries', String(report.journal)],
    ['Dad dates', String(report.dadDates)],
    ['Average sleep', report.avgSleep == null ? 'Not available' : `${report.avgSleep}h`],
    ['Day streak', String(report.streak)],
    ['Average mood', report.avgMood ?? 'Not available'],
  ];
  const labelWidth = Math.max('Metric'.length, ...rows.map(([label]) => label.length));
  const valueWidth = Math.max('Value'.length, ...rows.map(([, value]) => value.length));
  const divider = `+-${'-'.repeat(labelWidth)}-+-${'-'.repeat(valueWidth)}-+`;
  const tableRows = rows.map(([label, value]) => `| ${label.padEnd(labelWidth)} | ${value.padEnd(valueWidth)} |`);
  return [
    `DAD HEALTH - ${month} REPORT`, '', divider,
    `| ${'Metric'.padEnd(labelWidth)} | ${'Value'.padEnd(valueWidth)} |`, divider,
    ...tableRows, divider, '', 'Track your dad health at Dad Health.',
  ].join('\n');
}

function buildReportHtml(month: string, score: number, report: ProgressReport) {
  const rows = [
    ['Workouts', String(report.workouts)],
    ['Journal entries', String(report.journal)],
    ['Dad dates', String(report.dadDates)],
    ['Average sleep', report.avgSleep == null ? 'Not available' : `${report.avgSleep}h`],
    ['Day streak', String(report.streak)],
    ['Average mood', report.avgMood ?? 'Not available'],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background-color: #080808 !important; color: #f7f7f2; font-family: Arial, sans-serif; }
    .report { padding: 18mm; background-color: #080808 !important; page-break-inside: avoid; break-inside: avoid; }
    .eyebrow { color: #c8f55a; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
    h1 { margin: 10px 0 28px; font-size: 34px; line-height: 1; text-transform: uppercase; } .score { background-color: #c8f55a !important; color: #080808; padding: 22px; margin-bottom: 24px; }
    .score-label { font-size: 11px; font-weight: 700; text-transform: uppercase; } .score-value { font-size: 48px; font-weight: 800; line-height: 1; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; } th { color: #c8f55a; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; text-align: left; padding: 12px; border-bottom: 2px solid #c8f55a; }
    td { padding: 14px 12px; border-bottom: 1px solid #303030; font-size: 14px; } td:last-child { color: #c8f55a; font-weight: 700; text-align: right; }
    .footer { color: #777; font-size: 10px; margin-top: 28px; }
  </style></head><body><main class="report"><div class="eyebrow">DAD HEALTH</div><h1>${month} report</h1><section class="score"><div class="score-label">Dad Health Score</div><div class="score-value">${score}<span style="font-size:18px"> / 100</span></div></section><table><thead><tr><th>Metric</th><th style="text-align:right">Value</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}</tbody></table><div class="footer">Track your dad health at Dad Health.</div></main></body></html>`;
}
