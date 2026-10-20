// Mirrors backend/TransitOps.Application/Validators/IndianRegulatoryFormats.cs.
// The API is the source of truth; these checks only give earlier feedback in forms.

const STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HP', 'HR',
  'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR',
  'PB', 'PY', 'RJ', 'SK', 'TG', 'TN', 'TR', 'TS', 'UA', 'UK', 'UP', 'WB',
]);

export const REGISTRATION_HINT = 'e.g. MH-12-AB-1234 or 22-BH-1234-AA';
export const LICENCE_HINT = 'e.g. MH14 20180045921 (state, RTO, issue year, 7-digit serial)';

const compact = (value: string) => value.trim().toUpperCase().replace(/[\s\-./]/g, '');

type Result = { ok: boolean; value: string; error: string };

export function normalizeRegistration(input: string): Result {
  const reg = compact(input);
  if (!reg) return { ok: false, value: '', error: 'Registration number is required.' };

  const bh = /^(\d{2})BH(\d{4})([A-HJ-NP-Z]{1,2})$/.exec(reg);
  if (bh) {
    const year = Number(bh[1]);
    if (year < 21 || year > new Date().getFullYear() % 100)
      return { ok: false, value: '', error: 'Bharat (BH) series year must be between 21 and the current year.' };
    if (bh[2] === '0000') return { ok: false, value: '', error: 'Registration number cannot be 0000.' };
    return { ok: true, value: `${bh[1]}-BH-${bh[2]}-${bh[3]}`, error: '' };
  }
  if (/^\d{2}BH/.test(reg))
    return { ok: false, value: '', error: 'Bharat (BH) series numbers look like 22-BH-1234-AA (series letters cannot be I or O).' };

  const delhi = /^DL(\d{1,2})([A-Z])([A-Z]{0,2})(\d{1,4})$/.exec(reg);
  const standard = delhi ? null : /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(reg);
  if (!delhi && !standard)
    return { ok: false, value: '', error: `Registration number must follow the Indian format, ${REGISTRATION_HINT}.` };

  const state = reg.slice(0, 2);
  if (!STATE_CODES.has(state)) return { ok: false, value: '', error: `'${state}' is not a valid Indian state/UT code.` };

  const rto = Number(delhi ? delhi[1] : standard![2]);
  const numberPart = delhi ? delhi[4] : standard![4];
  if (rto === 0) return { ok: false, value: '', error: 'RTO code cannot be 00.' };
  if (Number(numberPart) === 0) return { ok: false, value: '', error: 'Registration number cannot be 0000.' };

  const number = numberPart.padStart(4, '0');
  if (delhi) {
    const series = delhi[3] ? `${delhi[3]}-` : '';
    return { ok: true, value: `DL-${rto}${delhi[2]}-${series}${number}`, error: '' };
  }
  const series = standard![3] ? `${standard![3]}-` : '';
  return { ok: true, value: `${state}-${String(rto).padStart(2, '0')}-${series}${number}`, error: '' };
}

export function normalizeLicence(input: string): Result {
  const lic = compact(input);
  if (!lic) return { ok: false, value: '', error: 'Driving licence number is required.' };

  const match = /^([A-Z]{2})(\d[0-9A-Z])(\d{4})(\d{7})$/.exec(lic);
  if (!match)
    return { ok: false, value: '', error: `Driving licence number must be 15 characters, ${LICENCE_HINT}.` };
  if (!STATE_CODES.has(match[1])) return { ok: false, value: '', error: `'${match[1]}' is not a valid Indian state/UT code.` };
  if (match[2] === '00') return { ok: false, value: '', error: 'RTO code in the licence number cannot be 00.' };

  const year = Number(match[3]);
  if (year < 1950 || year > new Date().getFullYear())
    return { ok: false, value: '', error: `Issue year ${year} in the licence number is not valid.` };
  if (match[4] === '0000000') return { ok: false, value: '', error: 'Licence serial number cannot be all zeros.' };
  return { ok: true, value: lic, error: '' };
}

/** Error for an expiry date that is unrealistic for an Indian licence, or null. */
export function licenceExpiryError(licence: string, expiryDate: string): string | null {
  if (!expiryDate) return 'Licence expiry date is required.';
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const max = new Date();
  max.setFullYear(max.getFullYear() + 20);
  if (expiry > max) return 'Licence expiry cannot be more than 20 years in the future.';
  const parsed = normalizeLicence(licence);
  if (parsed.ok) {
    const issueYear = Number(parsed.value.slice(4, 8));
    if (expiry.getFullYear() < issueYear) return `Licence expiry cannot be before its issue year (${issueYear}).`;
  }
  return null;
}
