import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Barlow_400Regular } from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { reportDates, type SavedWeeklyReport } from './weeklyReport';
import { displayReportValue, reportHeadline, reportChange, overallReportChange, reportFocus, reportActivity, reportProtection, hasReportChanges, reportStreakLabel } from './weeklyReportPresentation';

function escapeHtml(value: unknown): string {
  const replacements: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, character => replacements[character]);
}

export function buildWeeklyReportHtml(report: SavedWeeklyReport, fontCss = ''): string {
  const details = report.access === 'pro' ? report.details : undefined;
  const headline = reportHeadline(report), focus = reportFocus(report);
  const dates = reportDates(report.weekStart, report.weekEndExclusive);
  const total = report.totalScore?.state === 'available' ? report.totalScore.value : null;
  const overall = overallReportChange(report);
  const circumference = 2 * Math.PI * 52;
  const pillars = report.pillars.map(p => `<tr><th>${escapeHtml(p.name)}</th>
    ${report.access === 'pro' ? `<td>${displayReportValue(p.score)} /100</td>` : ''}
    <td>${escapeHtml(reportChange(report, p.change))}</td></tr>`).join('');
  const activities = details ? [
    reportActivity(details.workouts, 'workout', 'workouts'),
    reportActivity(details.bondSessions, 'Bond session', 'Bond sessions'),
    reportActivity(details.checkins, 'check-in', 'check-ins'),
  ].map(text => `<div class="tile">${escapeHtml(text)}</div>`).join('') : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dad Health weekly report</title>
  <style>
    ${fontCss}
    @page { size: A4 portrait; margin: 16mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #0A0A0A; color: #FFFFFF; font: 14px/1.5 'Barlow', Arial, sans-serif; overflow-wrap: anywhere; }
    h1,h2,h3 { font-family: 'Barlow Condensed','Arial Narrow',Arial,sans-serif; line-height: 1.15; text-transform: uppercase; margin: 0 0 12px; }
    h1 { font-size: 28px; } h2 { font-size: 22px; } h3 { font-size: 18px; }
    p { margin: 8px 0 16px; } .eyebrow { color: #C8F55A; letter-spacing: 2px; font-weight: bold; }
    .card { border-radius: 24px; background: #151515; padding: 20px; margin: 20px 0; }
    .hero { display: table; width: 100%; break-inside: avoid; }
    .circle { display: table-cell; width: 160px; vertical-align: middle; position: relative; }
    .hero-copy { display: table-cell; vertical-align: middle; padding-left: 20px; }
    .change { font-size: 24px; font-weight: bold; } .rise { color: #C8F55A; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; } td { text-align: right; }
    th,td { padding: 14px 6px; border-bottom: 1px solid #303030; } tr { break-inside: avoid; }
    .tiles { display: table; width: 100%; border-spacing: 8px; break-inside: avoid; }
    .tile { display: table-cell; width: 33.33%; background: #151515; border-radius: 20px; padding: 18px 8px; text-align: center; }
    .protected { color: #9DDFFF; } .protection-date { break-inside: avoid; }
    .focus { background: #C8F55A; color: #0A0A0A; } .focus h2 { margin-top: 14px; }
    .locked { text-align: center; } .decoration { height: 14px; border-radius: 12px; background: #303030; width: 60%; margin: 12px auto; filter: blur(4px); }
    .footer { font-size: 11px; border-top: 1px solid #303030; padding-top: 12px; }
    h1,h2,h3 { break-after: avoid; } p { orphans: 3; widows: 3; }
  </style></head><body>
    <p class="eyebrow">YOUR WEEK IN DAD HEALTH</p><p>${escapeHtml(dates)}</p>
    <h1>${escapeHtml(headline.title)}</h1>${headline.body ? `<p>${escapeHtml(headline.body)}</p>` : ''}
    <div class="card hero"><div class="circle">
      <svg width="150" height="150" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="52" stroke="#303030" stroke-width="9" fill="none"/>
        ${total === null ? '' : `<circle cx="60" cy="60" r="52" stroke="#C8F55A" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="${circumference * (1 - total / 100)}" transform="rotate(-90 60 60)"/>`}
        <text x="60" y="65" text-anchor="middle" fill="#FFFFFF" font-size="36" font-weight="bold">${displayReportValue(report.totalScore)}</text>
        <text x="60" y="84" text-anchor="middle" fill="#FFFFFF" font-size="12">/100</text>
      </svg></div><div class="hero-copy"><h3>Dad Health score</h3>
      ${overall ? `<p class="change ${report.overallChange?.state === 'available' && report.overallChange.value > 0 ? 'rise' : ''}">${escapeHtml(overall)}</p>` : ''}</div></div>
            ${report.access === 'pro' || hasReportChanges(report) ? `<div class="card"><table><tbody>${pillars}</tbody></table></div>` : ''}
    ${details ? `<div class="tiles">${activities}</div><div class="card">
          <h2>${escapeHtml(reportStreakLabel(details.streak.days))}</h2><p>At report time</p>
      ${details.streak.protectedDates.length ? `<h3 class="protected">&#10052; Streak protected</h3>` : ''}
      ${details.streak.protectedDates.map(date => `<div class="protection-date"><p>${escapeHtml(reportProtection(date))}<br>${escapeHtml(new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }))}</p></div>`).join('')}
    </div>` : report.access === 'free' ? `<div class="card locked"><div class="decoration"></div><h2>See what drove your week</h2><p class="eyebrow">PRO</p><p>See my full week</p></div>` : ''}
    <p class="footer">Saved weekly report ${escapeHtml(dates)}. Values reflect the saved report, not live activity.</p>
    ${focus ? `<div class="card focus"><h3>Your one focus for next week</h3><h2>${escapeHtml(focus.title)}</h2><p>${escapeHtml(focus.explanation)}</p></div>` : ''}
  </body></html>`;
}

async function reportFontCss(): Promise<string> {
  try {
    const faces = await Promise.all([
      ['Barlow', Barlow_400Regular, 400], ['Barlow Condensed', BarlowCondensed_700Bold, 700],
    ].map(async ([family, module, weight]) => {
      const asset = await Asset.fromModule(module as number).downloadAsync();
      if (!asset.localUri) throw new Error('Font unavailable');
      const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
      return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/ttf;base64,${base64}) format('truetype'); }`;
    }));
    return faces.join('\n');
  } catch {
    // Preserve export availability if a bundled font cannot be read.
    return '';
  }
}

export async function shareWeeklyDadHealthReport(
  report: SavedWeeklyReport,
  isCurrent: () => boolean = () => true,
): Promise<string | null> {
  if (!isCurrent()) return null;
  let temporaryUri: string | null = null;
  try {
    const available = await Sharing.isAvailableAsync();

    if (!isCurrent()) return null;
    if (!available) return 'Saving reports is unavailable on this device.';

    const fontCss = await reportFontCss();
    if (!isCurrent()) return null;
    const { uri } = await Print.printToFileAsync({
      html: buildWeeklyReportHtml(report, fontCss),
    });
    temporaryUri = uri;

    if (!isCurrent()) return null;

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Save report',
    });

    return isCurrent() ? 'Report ready to save.' : null;
  } catch {
    return isCurrent()
      ? 'We couldn’t save your report. Please try again.'
      : null;
  } finally {
    // Remove only this invocation's app-owned temporary PDF, including stale
    // account responses. Copies explicitly saved through Files remain untouched.
    if (temporaryUri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
  }
}
