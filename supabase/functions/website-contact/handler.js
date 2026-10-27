export const LOCALES = ['ko','en','ja','zh-Hans','zh-Hant','es','pt','fr','de','id','th','vi','hi'];
export const CONSENT_VERSION = 'website-contact-2026-10-27';
// Public identifier, not a secret or an authorization boundary.
export const PUBLIC_API_KEY = 'sb_publishable_VoEzGZ_ttrb6B71HHAZxcA_ArDD7XLi';

export function validateIntake(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const allowed = ['requestId','email','message','locale','consent','website'];
  return Object.keys(body).every(k => allowed.includes(k)) &&
    typeof body.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) &&
    typeof body.email === 'string' && body.email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email) &&
    typeof body.message === 'string' && body.message.trim().length >= 10 && body.message.length <= 3000 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.message) &&
    LOCALES.includes(body.locale) && body.consent === true && typeof body.website === 'string' && body.website.length <= 200;
}

function abortable(promise,signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  let abort;
  const canceled=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});});
  return Promise.race([promise,canceled]).finally(()=>signal.removeEventListener('abort',abort));
}

async function readBody(request,signal,readTimeoutMs) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(readTimeoutMs)]);
  let size = 0; const chunks = [];
  let completed=false;
  try {
    for (;;) {
      const {done,value} = await abortable(reader.read(),deadline);
      if (done) {completed=true;break;}
      size += value.length;
      if (size > 16000) throw new Error('invalid');
      chunks.push(value);
    }
  } finally {
    // A malicious stream can leave cancel() pending forever. Never await it.
    if (!completed) {try {void reader.cancel().catch(()=>{});} catch { /* best effort */ }}
    try {reader.releaseLock();} catch { /* a pending read is rejected on release */ }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

// Dependency injection keeps the real HTTP/auth/RPC boundary testable in Node.
// Never log the request, token, email, message or service response.
export function createContactHandler({ rpc, getUser, origin = 'https://taerynex.com', apiKey = PUBLIC_API_KEY, readTimeoutMs=2000, operationTimeoutMs=12000 }) {
  return async request => {
    const cors = {'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
    const reply = (status, body) => new Response(JSON.stringify(body),{status,headers:cors});
    if (request.headers.get('origin') !== origin) return reply(403,{error:'forbidden'});
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Max-Age':'600'}});
    if (request.headers.get('apikey') !== apiKey) return reply(401,{error:'unauthorized'});
    if (request.method !== 'POST') return reply(405,{error:'method'});
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return reply(415,{error:'invalid'});
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(operationTimeoutMs)]);
    try {
      const body = await readBody(request,signal,readTimeoutMs);
      const path = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
      if (path === 'inbox') {
        const authorization = request.headers.get('authorization') || '';
        if (!authorization.startsWith('Bearer ')) return reply(401,{error:'unauthorized'});
        const token = authorization.slice(7);
        const user = await abortable(getUser(token,{signal}),signal);
        if (!user || !user.email_confirmed_at || user.is_anonymous) return reply(403,{error:'forbidden'});
        // Payload is used only AFTER server-side Auth verification. DB checks
        // the matching live session and pinned owner UUID again.
        let claims;
        try { claims = JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/'))); } catch { return reply(401,{error:'unauthorized'}); }
        if (claims.sub !== user.id || !claims.session_id) return reply(401,{error:'unauthorized'});
        const result = await abortable(rpc('website_contact_inbox',{p_actor:user.id,p_session:claims.session_id,p_command:body},{signal}),signal);
        return reply(200,result);
      }
      if (path !== 'website-contact' || !validateIntake(body)) return reply(400,{error:'invalid'});
      const result = await abortable(rpc('website_contact_intake',{
        p_request:body.requestId,p_email:body.email.trim().toLowerCase(),p_message:body.message.trim(),
        p_locale:body.locale,p_honeypot:body.website,p_consent:CONSENT_VERSION,
      },{signal}),signal);
      if (!result?.receipt || result.status !== 'received') throw new Error('storage');
      return reply(201,{status:'received',receipt:result.receipt});
    } catch (error) {
      const code = error?.code;
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || signal.aborted) return reply(408,{error:'timeout'});
      if (code === 'P0429') return reply(429,{error:'rate_limited'});
      if (code === 'P0409') return reply(409,{error:'conflict'});
      if (code === '42501') return reply(403,{error:'forbidden'});
      if (code === '22023' || error instanceof SyntaxError || error?.message === 'invalid') return reply(400,{error:'invalid'});
      return reply(503,{error:'unavailable'});
    }
  };
}
