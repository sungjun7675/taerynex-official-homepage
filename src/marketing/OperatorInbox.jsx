import { useEffect, useRef, useState } from 'react';
import { createContactApi } from './contact-api.js';
import { createOperatorAuth, operatorAuthIssue, eraseOperatorTabSession } from './operator-auth.js';

const api = createContactApi();
const labels = {new:'새 문의',in_progress:'처리 중',resolved:'해결됨'};
export default function OperatorInbox({clientFactory=createOperatorAuth,transport=api}) {
  const [client] = useState(clientFactory);
  const [session,setSession] = useState(null);
  const [operatorEmail,setOperatorEmail]=useState('');
  const [items,setItems] = useState([]); const [status,setStatus] = useState(''); const [cursors,setCursors] = useState([]);
  const [next,setNext] = useState(null); const [busy,setBusy] = useState(false); const [notice,setNotice] = useState('');
  const generation = useRef(0); const mounted = useRef(true); const currentSession = useRef(null); const blockSessions=useRef(false); const revoking=useRef(false);
  function clear(eraseCredentials=true) { generation.current++; currentSession.current=null; setSession(null); setItems([]); setCursors([]); setNext(null); setOperatorEmail(''); setBusy(false); if(eraseCredentials && !revoking.current) eraseOperatorTabSession(); }
  useEffect(()=>{
    mounted.current=true;
    if (!client) return;
    const {data} = client.auth.onAuthStateChange((event,value)=>{
      if(blockSessions.current) return;
      if (!value || event==='SIGNED_OUT') clear();
      else { currentSession.current=value; setSession(value); }
    });
    // getSession waits for SDK callback parsing; then remove all callback data,
    // including error text, without copying tokens into application state/URL.
    client.auth.getSession().then(({data:initial,error})=>{
      if (!mounted.current) return;
      history.replaceState(null,'','/admin/inquiries');
      if (error) { clear(); setNotice('로그인 링크를 확인하지 못했습니다. 새 링크를 요청해 주세요.'); }
      else if (initial.session && !blockSessions.current) { currentSession.current=initial.session; setSession(initial.session); }
    }).catch(()=>{ if (mounted.current) {history.replaceState(null,'','/admin/inquiries');clear();setNotice('로그인하지 못했습니다. 새 링크를 요청해 주세요.');} });
    client.auth.startAutoRefresh();
    return ()=>{ mounted.current=false; generation.current++; data.subscription.unsubscribe(); client.auth.stopAutoRefresh(); };
  },[client]);
  async function call(command) {
    const {data,error} = await client.auth.getSession();
    if (error || !data.session || data.session.expires_at*1000<=Date.now()) { blockSessions.current=true;client.auth.stopAutoRefresh();clear(); throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
    try { return await transport.inbox(command,data.session.access_token); }
    catch (err) { if (err.code==='unauthorized') { blockSessions.current=true;client.auth.stopAutoRefresh();clear(); throw new Error('로그인이 만료되었거나 접근 권한이 없습니다. 관리자 설정을 확인한 뒤 다시 로그인해 주세요.'); } throw new Error('처리를 확인하지 못했습니다. 새로고침하여 저장된 상태를 확인해 주세요.'); }
  }
  async function load(before=null,filter=status) {
    if (!currentSession.current) return;
    const ticket=++generation.current; setBusy(true); setNotice(''); setItems([]); setNext(null);
    try {
      const result=await call({action:'list',...(filter ? {status:filter} : {}),...(before ? {before} : {})});
      if (ticket!==generation.current || !mounted.current || !currentSession.current) return;
      if (!Array.isArray(result.items)) throw new Error('문의 목록을 확인하지 못했습니다. 다시 시도해 주세요.');
      const page=result.items.slice(0,20); setItems(page);
      if (result.items.length>20) { const tail=page.at(-1); setNext({created_at:tail.created_at,id:tail.id}); }
    } catch(err) { if (mounted.current && ticket===generation.current) setNotice(err.message); }
    finally { if (mounted.current && ticket===generation.current) setBusy(false); }
  }
  useEffect(()=>{
    if (!session) return;
    if (!currentSession.current) currentSession.current=session;
    const timer=setTimeout(()=>{ blockSessions.current=true;client.auth.stopAutoRefresh();clear(); setNotice('로그인이 만료되었습니다. 다시 로그인해 주세요.'); },Math.max(0,session.expires_at*1000-Date.now()));
    return ()=>clearTimeout(timer);
  },[session]);
  // Sign-in and TOKEN_REFRESHED arrive through Auth events; only initial
  // authentication triggers a new listing, preserving the selected page.
  const activeUser = session?.user?.id;
  useEffect(()=>{ if (activeUser) {setStatus('');setCursors([]);load(null,'');} },[activeUser]);
  async function login(event) {
    event.preventDefault(); if (busy || !client || revoking.current) return;
    if(operatorEmail.trim().length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(operatorEmail.trim())) {setNotice('운영자 이메일 주소를 확인해 주세요.');return;}
    setBusy(true); setNotice('');blockSessions.current=false;
    try {
      const {error}=await client.auth.signInWithOtp({email:operatorEmail.trim(),options:{shouldCreateUser:false,emailRedirectTo:'https://taerynex.com/admin/inquiries'}});
      if (error) throw new Error('로그인 링크를 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setOperatorEmail('');
      setNotice('로그인 링크를 요청했습니다. 운영자 이메일의 링크를 열어 주세요. 실제 메일 도착 여부는 받은편지함에서 확인해 주세요.');
    } catch(err) { setNotice(err.message); } finally { setBusy(false); }
  }
  async function logout() {
    if(revoking.current) return;
    revoking.current=true;blockSessions.current=true;client.auth.stopAutoRefresh();clear(false);setBusy(true);setNotice('로그아웃 중입니다.');
    let deadline;
    // Preserve SDK credentials until revocation: erasing them first makes the
    // SDK return success without sending /logout. Block Auth callback reentry
    // while the SDK holds its session lock, and bound the whole operation.
    try {
      const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('logout_timeout')),12000);});
      const {error}=await Promise.race([client.auth.signOut({scope:'local'}),timeout]);
      if(error) throw error;
      if(mounted.current) setNotice('로그아웃했습니다.');
    } catch {
      if(mounted.current) setNotice('화면의 정보는 지웠지만 서버 로그아웃을 확인하지 못했습니다. 이 탭을 닫고 관리자 설정에서 로그인을 해제해 주세요.');
    } finally {
      clearTimeout(deadline);eraseOperatorTabSession();revoking.current=false;
      if(mounted.current) setBusy(false);
    }
  }
  async function mutate(command) {
    if (busy) return; setBusy(true); setNotice('');
    try { await call(command); await load(cursors.at(-1) || null); }
    catch(err) { setNotice(err.message); } finally { setBusy(false); }
  }
  async function copyEmail(email) {
    try { await navigator.clipboard.writeText(email); setNotice('답변받을 이메일 주소를 복사했습니다. 사용하는 메일에서 직접 답변을 보내 주세요.'); }
    catch { setNotice('주소를 복사하지 못했습니다. 표시된 이메일 주소를 직접 선택하여 복사해 주세요.'); }
  }
  const date = value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  return <main className="operator-shell shell"><a href="/app/ko" className="wordmark">TAERYNEX</a><h1>문의 관리</h1><p>운영자 전용 · 답변은 이메일 주소를 복사한 뒤 사용하는 메일에서 직접 보내 주세요. 이 화면에서 답변 메일을 발송하지 않습니다.</p>
    {!client && <p>{operatorAuthIssue==='storage_blocked' ? '이 탭의 로그인 저장 공간을 사용할 수 없습니다. 브라우저의 사이트 저장 설정을 허용한 뒤 다시 열어 주세요. 로그인 링크는 요청하지 않았습니다.' : '로그인 준비 중입니다. 관리자 설정을 확인해 주세요.'}</p>}
    {!session ? <form onSubmit={login}><label htmlFor="operator-email">운영자 이메일</label><input id="operator-email" type="email" autoComplete="username" required maxLength={254} value={operatorEmail} onChange={e=>setOperatorEmail(e.target.value)} disabled={!client || busy}/><button className="button button-gold" disabled={!client || busy}>이메일로 로그인 링크 받기</button><p>운영자 이메일로 받은 링크를 열어 로그인하세요. 로그인은 이 탭에만 보관되어 새로고침해도 유지됩니다. 공용 컴퓨터에서는 반드시 로그아웃한 뒤 탭을 닫아 주세요. 비밀번호는 입력하지 않습니다.</p></form> : <>
      <button type="button" onClick={logout}>로그아웃</button><div className="operator-toolbar"><label>처리 상태 <select value={status} disabled={busy} onChange={e=>{setStatus(e.target.value);setCursors([]);load(null,e.target.value);}}><option value="">전체</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>load(cursors.at(-1) || null)}>새로고침</button></div>
      {items.map(item=><article className="operator-item" key={item.id}><h2>{item.email}</h2><button type="button" onClick={()=>copyEmail(item.email)}>답변 이메일 복사</button><p>접수번호 {item.id} · <time dateTime={item.created_at}>{date(item.created_at)} (한국 시간)</time> · {item.locale}</p><p className="operator-message">{item.message}</p><p>보관 기한: {date(item.expires_at)} (한국 시간)</p><label>처리 상태 <select value={item.status} disabled={busy} onChange={e=>mutate({action:'status',id:item.id,status:e.target.value})}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>{if(window.confirm('철회 요청 또는 개인정보 최소화를 위해 이 문의를 영구 삭제하시겠습니까?')) mutate({action:'delete',id:item.id});}}>문의 삭제</button></article>)}
      {!busy && items.length===0 && <p>이 페이지에 문의가 없습니다.</p>}<nav className="operator-toolbar" aria-label="문의 페이지"><button disabled={busy || !cursors.length} onClick={()=>{const previous=cursors.slice(0,-1);setCursors(previous);load(previous.at(-1)||null);}}>이전</button><button disabled={busy || !next} onClick={()=>{setCursors([...cursors,next]);load(next);}}>다음</button></nav>
    </>}<p role="status" aria-live="polite">{busy ? '불러오는 중…' : notice}</p>
  </main>;
}
