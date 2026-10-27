import { contactConfig } from './contact-config.js';

export class ContactError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function createContactApi(config = contactConfig, fetcher = globalThis.fetch) {
  const ready = config.url === 'https://edfrlptpeuhjsgxdfwke.supabase.co' &&
    (/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey) || /^eyJ[A-Za-z0-9_.-]+$/.test(config.publishableKey));
  async function request(path, body, token) {
    if (!ready) throw new ContactError('unavailable');
    let response;
    try {
      response = await fetcher(`${config.url}/functions/v1/website-contact${path}`,{
        method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,...(token ? {Authorization:`Bearer ${token}`} : {})},
        body:JSON.stringify(body),signal:AbortSignal.timeout(18000),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',
      });
    } catch { throw new ContactError('uncertain'); }
    let data;
    try { data = await response.json(); } catch { throw new ContactError('uncertain'); }
    if (!response.ok) throw new ContactError(({400:'invalid',409:'conflict',429:'limited',401:'unauthorized',403:'unauthorized'})[response.status] || 'uncertain');
    return data;
  }
  return {ready,
    async submit(body) {
      const data = await request('',body);
      if (data.status !== 'received' || !/^[a-f0-9-]{36}$/i.test(data.receipt)) throw new ContactError('uncertain');
      return data.receipt;
    },
    inbox: (body,token) => request('/inbox',body,token),
  };
}
