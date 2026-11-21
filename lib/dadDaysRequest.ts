import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

const messages: Record<string, string> = {
  client_setup_failed: 'We could not start Dad Days search. Please close and reopen the app.',
  invalid_request: 'Check the age, budget and location selected for your search.',
  session_expired: 'Your session has expired. Please log in again.',
  session_unavailable: 'We could not verify your session. Please try again.',
  allowance_unavailable: 'We could not verify your Dad Days allowance. Please try again.',
  rate_limit_exceeded: "You're searching too quickly. Wait a moment and try again.",
  provider_busy: 'Dad Days is busy right now. Please try again shortly.',
  provider_configuration: 'Dad Days search is temporarily unavailable. Please try again later.',
  provider_failed: 'Dad Days could not find activities right now. Please try again shortly.',
  provider_response_invalid: 'Dad Days returned an incomplete response. Please search again.',
  usage_save_failed: 'We could not confirm this search. Please try again shortly.',
  network_failed: 'We could not reach Dad Days. Check your connection and try again.',
  request_timeout: 'Dad Days took too long to respond. Please try again.',
  response_invalid: 'We could not read the Dad Days response. Please try again.',
  server_failed: 'Dad Days is temporarily unavailable. Please try again shortly.',
  search_limit_reached: 'Your free Dad Days allowance has been used.',
};
export class DadDaysRequestError extends Error {
  constructor(public code: string, public status = 0) { super(messages[code] ?? messages.server_failed); }
}

/** No body, location, token, provider message or account identifier is logged. */
export async function dadDaysRequest(base: string, owner: string, payload?: object): Promise<any> {
  let requestId: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  let stage = 'setup', status = 0;
  let responseId: string | null = null;
  try {
    if (__DEV__) console.log('[DadDays]', { requestId, stage, status, code: 'starting' });
    requestId = Crypto.randomUUID();
    responseId = requestId;
    stage = 'session';
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== owner) throw new DadDaysRequestError('session_expired', 401);
    stage = 'request';
    const response = await fetch(`${base}/api/dad_days_searches`, {
      method: payload ? 'POST' : 'GET', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Dad-Days-Request-ID': requestId, Authorization: `Bearer ${data.session.access_token}` },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    status = response.status;
    const returnedId = response.headers.get('x-dad-days-request-id');
    if (returnedId && /^[a-f0-9-]{36}$/i.test(returnedId)) responseId = returnedId;
    stage = 'response';
    // Authentication status remains actionable even if a proxy returns HTML.
    if (status === 401) throw new DadDaysRequestError('session_expired', status);
    let body;
    try { body = await response.json(); } catch { throw new DadDaysRequestError('response_invalid', status); }
    if (!response.ok) {
      const code = typeof body?.error === 'string' && Object.hasOwn(messages, body.error) ? body.error : status === 429 ? 'rate_limit_exceeded' : 'server_failed';
      // Only this exact authenticated backend response can request an upgrade.
      throw new DadDaysRequestError(code === 'search_limit_reached' && status !== 403 ? 'server_failed' : code, status);
    }
    if (!body || typeof body !== 'object') throw new DadDaysRequestError('response_invalid', status);
    if (payload && (!Array.isArray(body.results) || !body.results.every((item: any) => item &&
      ['name','description','address','estimatedCost','ageRange','websiteUrl'].every(key => typeof item[key] === 'string') &&
      typeof item.distanceMiles === 'number' && Number.isFinite(item.distanceMiles) && typeof item.requiresBooking === 'boolean'))) {
      throw new DadDaysRequestError('response_invalid', status);
    }
    if (__DEV__) console.log('[DadDays]', { requestId: responseId, stage, status, code: 'ok' });
    return body;
  } catch (error) {
    const failure = error instanceof DadDaysRequestError ? error : new DadDaysRequestError(stage === 'setup' ? 'client_setup_failed' : controller.signal.aborted ? 'request_timeout' : 'network_failed', status);
    if (__DEV__) console.log('[DadDays]', { requestId: responseId, stage, status: failure.status, code: failure.code });
    throw failure;
  } finally { clearTimeout(timer); }
}
