import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  reportDates,
  type SavedMeasurement,
  type SavedWeeklyReport,
} from './weeklyReport';

const display = (measurement?: SavedMeasurement): string =>
  measurement?.state === 'available'
    ? String(Math.round(measurement.value))
    : '—';

function escapeHtml(value: unknown): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value).replace(
    /[&<>"']/g,
    character => replacements[character],
  );
}

export function buildWeeklyReportHtml(report: SavedWeeklyReport): string {
  const details = report.access === 'pro' ? report.details : undefined;
  const dates = reportDates(report.weekStart, report.weekEndExclusive);

  const buildingTrend = report.pillars.some(
    pillar => pillar.trendMessage === 'Building first 7 day trend',
  );

  const comparison = buildingTrend
    ? 'Building first 7 day trend'
    : report.comparisonAvailable
      ? 'Changes compared with the previous saved week.'
      : 'Comparison unavailable';

  const pillars = report.pillars.map(pillar => {
    let change = '—';

    if (
      report.comparisonAvailable &&
      pillar.change.state === 'available'
    ) {
      const points = Math.round(pillar.change.value);

      change = `${
        points > 0 ? '+' : points < 0 ? '−' : ''
      }${Math.abs(points)} pts`;
    }

    return `
      <tr>
        <th scope="row">${escapeHtml(pillar.name)}</th>
        <td>${display(pillar.score)}${
          pillar.score.state === 'available' ? '%' : ''
        }</td>
        <td>${escapeHtml(change)}</td>
      </tr>
    `;
  }).join('');

  const activity = details ? [
    ['Workouts', display(details.workouts)],
    ['Bond sessions', display(details.bondSessions)],
    ['Check-in days', display(details.checkins)],
    [
      'Streak at report time',
      `${display(details.streak.days)}${
        details.streak.days.state === 'available' ? ' days' : ''
      }`,
    ],
  ].map(([label, value]) => `
    <tr>
      <th scope="row">${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join('') : '';

  const protection = details?.streak.protectedDates.length
    ? `
      <section>
        <h2>Streak protected</h2>
        <ul>
          ${details.streak.protectedDates.map(date => `
            <li>${escapeHtml(
              new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              }),
            )}</li>
          `).join('')}
        </ul>
      </section>
    `
    : '';

  const focus = details?.focus
    ? `
      <section>
        <h2>Next week</h2>
        <p>${escapeHtml(details.focus.text)}</p>
        <p class="muted">
          A small step for ${escapeHtml(details.focus.pillar)}.
        </p>
      </section>
    `
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Dad Health weekly report</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    margin: 0;
    background: #111214;
    color: #f7f7f2;
    font: 14px/1.5 Arial, sans-serif;
    overflow-wrap: anywhere;
  }
  h1, h2 {
    margin: 0 0 10px;
    text-transform: uppercase;
    line-height: 1.2;
  }
  h1 { font-size: 28px; }
  h2 { margin-top: 24px; font-size: 18px; color: #c8f55a; }
  .eyebrow {
    color: #c8f55a;
    letter-spacing: 2px;
    font-size: 11px;
    font-weight: bold;
  }
  .dates { margin: 0 0 22px; color: #bfc1bd; }
  .hero {
    background: #c8f55a;
    color: #080808;
    padding: 20px;
    display: table;
    width: 100%;
    break-inside: avoid;
  }
  .circle-cell {
    display: table-cell;
    width: 38%;
    vertical-align: middle;
  }
  .circle {
    border: 5px solid #080808;
    border-radius: 50%;
    width: 140px;
    height: 140px;
    text-align: center;
    padding-top: 17px;
  }
  .score { font-size: 54px; font-weight: bold; line-height: 1.2; }
  .scale { font-size: 12px; text-transform: uppercase; }
  .pillars {
    display: table-cell;
    vertical-align: middle;
    padding-left: 16px;
  }
  .hero-title {
    font-size: 15px;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 600; }
  td { text-align: right; }
  th, td { padding: 10px 0; border-bottom: 1px solid #383a38; }
  .hero th, .hero td { padding: 7px 0; border-color: #a3c74a; }
  .hero td { padding-left: 10px; white-space: nowrap; }
  .hero th { text-transform: uppercase; font-size: 12px; }
  .muted { color: #bfc1bd; font-size: 12px; }
  section, tr { break-inside: avoid; }
  .footer {
    border-top: 1px solid #383a38;
    margin-top: 24px;
    padding-top: 12px;
    font-size: 10px;
    color: #bfc1bd;
  }
</style>
</head>
<body>
  <p class="eyebrow">DAD HEALTH</p>
  <h1>Weekly report</h1>
  <p class="dates">${escapeHtml(dates)}</p>

  <div class="hero">
    <div class="circle-cell">
      <div class="circle">
        <div class="score">${display(report.totalScore)}</div>
        <div class="scale">of 100</div>
      </div>
    </div>
    <div class="pillars">
      <div class="hero-title">Weekly Dad Health Score</div>
      <table><tbody>${pillars}</tbody></table>
    </div>
  </div>

  <p class="muted">${escapeHtml(comparison)}</p>

  ${details ? `
    <section>
      <h2>Your week</h2>
      <table><tbody>${activity}</tbody></table>
    </section>
  ` : ''}

  ${protection}
  ${focus}

  ${report.access === 'free' ? `
    <p class="muted">
      Activity totals, streak details and next-week focus
      are included with Dad Health Pro.
    </p>
  ` : ''}

  <p class="footer">
    Saved weekly report · ${escapeHtml(dates)}.
    Values reflect the saved report, not live activity.
  </p>
</body>
</html>`;
}

export async function shareWeeklyDadHealthReport(
  report: SavedWeeklyReport,
  isCurrent: () => boolean = () => true,
): Promise<string | null> {
  if (!isCurrent()) return null;

  try {
    const available = await Sharing.isAvailableAsync();

    if (!isCurrent()) return null;
    if (!available) return 'Saving reports is unavailable on this device.';

    const { uri } = await Print.printToFileAsync({
      html: buildWeeklyReportHtml(report),
    });

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
  }
}
