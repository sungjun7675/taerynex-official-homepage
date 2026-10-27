import { useRef, useState } from 'react';
import { createContactApi } from './contact-api.js';
import { contactCopy } from './contact-copy.js';
const defaultApi = createContactApi();

export default function ContactForm({locale,api=defaultApi}) {
  const c = contactCopy[locale];
  const [email,setEmail] = useState(''); const [message,setMessage] = useState('');
  const [consent,setConsent] = useState(false); const [website,setWebsite] = useState('');
  const [state,setState] = useState('idle'); const [error,setError] = useState(''); const [receipt,setReceipt] = useState('');
  const pending = useRef(null); const busy = useRef(false); const feedback = useRef(null);
  const locked = Boolean(pending.current);
  async function submit(event) {
    event.preventDefault();
    if (busy.current || !api.ready || receipt) return;
    if (!pending.current && (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim()) || email.trim().length>254 || message.trim().length<10 || message.length>3000 || !consent)) {
      setError('invalid');
      const invalidEmail=!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim()) || email.trim().length>254;
      const selector=invalidEmail ? '#contact-email' : message.trim().length<10 || message.length>3000 ? '#contact-message' : '[type=checkbox]';
      event.currentTarget.querySelector(selector)?.focus();
      return;
    }
    if (!navigator.onLine) { setError('offline'); return; }
    busy.current = true; setState('sending'); setError('');
    try {
      // Retain the exact key AND body across ambiguous timeouts/retries. No PII
      // is persisted to browser storage or sent to analytics.
      pending.current ||= {requestId:crypto.randomUUID(),email:email.trim(),message:message.trim(),locale,consent:true,website};
      const saved = await api.submit(pending.current);
      setReceipt(saved); setEmail(''); setMessage(''); setConsent(false); setWebsite(''); pending.current=null; setState('received');
    } catch (err) { setError(['invalid','conflict','limited'].includes(err.code) ? err.code : 'failure'); setState('failed'); }
    finally { busy.current=false; requestAnimationFrame(()=>feedback.current?.focus()); }
  }
  return <section id="contact" className="contact-section section" tabIndex="-1" aria-labelledby="contact-title"><div className="shell contact-layout">
    <div><p className="eyebrow">TAERYNEX · SUPPORT</p><h2 id="contact-title">{c.title}</h2><p>{c.intro}</p><p>{c.avoid}</p><p className="contact-address">taerynex@gmail.com</p></div>
    <form onSubmit={submit} method="post" action="#contact" aria-describedby="contact-notice" noValidate>
      {!api.ready && <p role="status">{c.unavailable}</p>}
      {receipt ? <p className="contact-feedback" role="status" tabIndex="-1" ref={feedback}>{c.received} <strong>{receipt}</strong></p> : <>
        <fieldset disabled={!api.ready || state==='sending'}>
          <label htmlFor="contact-email">{c.email}</label><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} readOnly={locked} onChange={e=>setEmail(e.target.value)} aria-invalid={error==='invalid'} aria-describedby={error ? 'contact-feedback' : undefined}/>
          <label htmlFor="contact-message">{c.message}</label><textarea id="contact-message" name="message" required minLength={10} maxLength={3000} rows={7} value={message} readOnly={locked} onChange={e=>setMessage(e.target.value)} aria-invalid={error==='invalid'} aria-describedby="contact-avoid"/>
          <p id="contact-avoid" className="contact-small">{c.avoid}</p>
          <div className="contact-trap" aria-hidden="true"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></div>
          <label className="contact-consent"><input type="checkbox" required checked={consent} disabled={locked} onChange={e=>setConsent(e.target.checked)} aria-describedby="contact-notice"/>{c.consent}</label>
          <button className="button button-gold" type="submit">{state==='sending' ? c.sending : state==='failed' ? c.retry : c.send}</button>
        </fieldset>
        <p id="contact-feedback" className="contact-feedback" role="status" aria-live="polite" tabIndex="-1" ref={feedback}>{error ? c[error] : state==='sending' ? c.sending : ''}</p>
      </>}
      <p id="contact-notice" className="contact-small">{c.notice}</p><noscript><p>{c.unavailable}</p></noscript>
    </form>
  </div></section>;
}
