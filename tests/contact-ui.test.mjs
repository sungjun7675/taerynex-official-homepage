import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {contactCopy} from '../src/marketing/contact-copy.js';
import {localeCodes} from '../src/marketing/locales.js';

const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://taerynex.com/admin/inquiries'});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','Event','MouseEvent','history']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {renderToString}=await import('react-dom/server');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const {default:Form}=await server.ssrLoadModule('/src/marketing/ContactForm.jsx');
const {default:Inbox}=await server.ssrLoadModule('/src/marketing/OperatorInbox.jsx');
const authModule=await server.ssrLoadModule('/src/marketing/operator-auth.js');
const root=createRoot(document.getElementById('root'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const render=async element=>{await act(async()=>{root.render(element);await tick();});};
const fill=async(selector,value)=>act(async()=>{
  const input=document.querySelector(selector);
  const proto=input.tagName==='TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);
  input.dispatchEvent(new Event('input',{bubbles:true}));
});
const submit=()=>act(async()=>{document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();});
const click=selector=>act(async()=>{document.querySelector(selector).click();await tick();});
const text=()=>document.body.textContent;

test('contact and operator rendered integration',async t=>{
  t.after(async()=>{await act(()=>root.unmount());await server.close();dom.window.close();});
  await t.test('all 13 locales render explicit notice, empty mandatory consent and bounded fields',()=>{
    assert.deepEqual(Object.keys(contactCopy).sort(),[...localeCodes].sort());
    for(const locale of localeCodes) {
      assert.ok(Object.values(contactCopy[locale]).every(value=>typeof value==='string' && value.length));
      const html=renderToString(createElement(Form,{locale,api:{ready:true}}));
      const view=new JSDOM(html).window.document;
      assert.equal(view.querySelector('[type=checkbox]').checked,false);
      assert.equal(view.querySelector('textarea').maxLength,3000);
      assert.ok(view.querySelector('#contact-notice').textContent.includes('30'));
      assert.ok(view.querySelector('#contact-notice').textContent.includes('90'));
      assert.equal(view.querySelector('[type=file]'),null); assert.equal(view.querySelector('[type=date]'),null);
      assert.ok(view.querySelector('#contact-title').textContent===contactCopy[locale].title);
    }
  });
  await t.test('form validates consent, retains exact uncertain payload for retry and clears PII only after receipt',async()=>{
    const calls=[]; const receipt=randomUUID();
    const api={ready:true,submit:async body=>{calls.push(body);if(calls.length===1)throw{code:'uncertain'};return receipt;}};
    await render(createElement(Form,{locale:'en',api,key:'retry'}));
    await fill('#contact-email','reader@example.com');await fill('#contact-message','Please explain the app features.');
    await submit();assert.equal(calls.length,0);assert.ok(text().includes(contactCopy.en.invalid));assert.equal(document.activeElement.type,'checkbox');
    await click('[type=checkbox]');await submit();assert.equal(calls.length,1);
    assert.ok(text().includes(contactCopy.en.failure));assert.equal(document.querySelector('textarea').readOnly,true);
    assert.ok(!text().includes(receipt));await submit();assert.equal(calls.length,2);assert.strictEqual(calls[0],calls[1]);
    assert.ok(text().includes(receipt));assert.equal(document.querySelector('[type=email]'),null);assert.ok(!text().includes('reader@example.com'));
  });
  await t.test('offline and unavailable states do not report a receipt or call the network',async()=>{
    let calls=0; const api={ready:true,submit:async()=>{calls++;}};
    await render(createElement(Form,{locale:'ko',api,key:'offline'}));
    await fill('#contact-email','reader@example.com');await fill('#contact-message','문의 내용을 확인해 주세요.');await click('[type=checkbox]');
    Object.defineProperty(navigator,'onLine',{value:false,configurable:true});await submit();
    assert.equal(calls,0);assert.ok(text().includes(contactCopy.ko.offline));assert.equal(document.querySelector('textarea').value,'문의 내용을 확인해 주세요.');
    Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
    await render(createElement(Form,{locale:'ko',api:{ready:false},key:'unavailable'}));
    assert.equal(document.querySelector('fieldset').disabled,true);assert.ok(text().includes(contactCopy.ko.unavailable));
  });
  await t.test('rapid duplicate submits start only one attempt',async()=>{
    let done,calls=0;const api={ready:true,submit:()=>{calls++;return new Promise(resolve=>{done=resolve;});}};
    await render(createElement(Form,{locale:'en',api,key:'double'}));
    await fill('#contact-email','reader@example.com');await fill('#contact-message','Please explain the closed test.');await click('[type=checkbox]');
    await act(async()=>{const form=document.querySelector('form');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
    assert.equal(calls,1);await act(async()=>{done(randomUUID());await tick();});
  });
  await t.test('Korean operator: exact existing-user OTP request, callback cleanup, plain text, pagination, status, copy, logout clears data',async()=>{
    let current=null,callback;const commands=[],otps=[];
    const ownerSession={access_token:'fixture-user-jwt',expires_at:Math.floor(Date.now()/1000)+120,user:{id:randomUUID()}};
    const client={auth:{onAuthStateChange:fn=>{callback=fn;return{data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session:current},error:null}),startAutoRefresh(){},stopAutoRefresh(){},signInWithOtp:async request=>{otps.push(request);return{error:null};},signOut:async()=>{current=null;callback('SIGNED_OUT',null);return{error:null};}}};
    const item=i=>({id:`fixture-${i}`,email:`reader${i}@example.com`,message:'<script>alert("unsafe")</script>',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),locale:'en',status:'new'});
    const transport={inbox:async command=>{commands.push(command);return{items:command.action==='list' ? command.before ? [item(21)] : Array.from({length:21},(_,i)=>item(i)) : []};}};
    await render(createElement(Inbox,{clientFactory:()=>client,transport,key:'operator'}));await fill('#operator-email','operator@example.com');await submit();
    assert.deepEqual(otps,[{email:'operator@example.com',options:{shouldCreateUser:false,emailRedirectTo:'https://taerynex.com/admin/inquiries'}}]);
    assert.equal(document.querySelector('[type=password]'),null);assert.equal(history.length,1);
    current=ownerSession;await act(async()=>{callback('SIGNED_IN',current);await tick();});
    assert.equal(document.querySelectorAll('.operator-item').length,20);assert.ok(text().includes('<script>alert("unsafe")</script>'));assert.equal(document.querySelector('script'),null);
    const button=label=>[...document.querySelectorAll('button')].find(el=>el.textContent===label);
    await act(async()=>{button('다음').click();await tick();});assert.equal(document.querySelectorAll('.operator-item').length,1);assert.ok(commands.at(-1).before);
    await act(async()=>{button('이전').click();await tick();});assert.equal(document.querySelectorAll('.operator-item').length,20);
    let copied;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{copied=value;}},configurable:true});
    await act(async()=>{button('답변 이메일 복사').click();await tick();});assert.equal(copied,'reader0@example.com');assert.ok(text().includes('복사했습니다'));
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied');}},configurable:true});
    await act(async()=>{button('답변 이메일 복사').click();await tick();});assert.ok(text().includes('복사하지 못했습니다'));
    await act(async()=>{const select=document.querySelector('.operator-item select');select.value='resolved';select.dispatchEvent(new Event('change',{bubbles:true}));await tick();});
    assert.ok(commands.some(command=>command.action==='status' && command.status==='resolved'));
    await act(async()=>{button('로그아웃').click();await tick();});assert.equal(document.querySelectorAll('.operator-item').length,0);assert.ok(!text().includes('reader0@example.com'));
  });
  await t.test('operator token expiry clears messages while a late response cannot restore them',async()=>{
    let callback,current={access_token:'fixture',expires_at:Math.floor(Date.now()/1000)+1,user:{id:randomUUID()}};
    const client={auth:{onAuthStateChange:fn=>{callback=fn;return{data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session:current}}),startAutoRefresh(){},stopAutoRefresh(){}}};
    let respond;const transport={inbox:()=>new Promise(resolve=>{respond=resolve;})};
    await render(createElement(Inbox,{clientFactory:()=>client,transport,key:'expire'}));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));});
    await act(async()=>{respond({items:[{id:'late',email:'private@example.com',message:'secret'}]});await tick();});
    assert.ok(!text().includes('private@example.com'));assert.ok(text().includes('만료되었습니다'));
  });
  await t.test('blocked tab storage refuses login; actual SDK restores an unexpired tab session on recreation',async()=>{
    const descriptor=Object.getOwnPropertyDescriptor(window,'sessionStorage');
    Object.defineProperty(window,'sessionStorage',{configurable:true,get(){throw new Error('blocked');}});
    try {
      assert.equal(authModule.createOperatorAuth(),null);
      await render(createElement(Inbox,{key:'blocked'}));
      assert.ok(text().includes('저장 공간을 사용할 수 없습니다'));assert.equal(document.querySelector('button').disabled,true);
    } finally {Object.defineProperty(window,'sessionStorage',descriptor);}
    const storage=authModule.probeTabStorage(window.sessionStorage);
    const fixtureSession={access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:randomUUID(),email:'operator@example.com'}};
    storage.setItem('taerynex-operator-auth',JSON.stringify(fixtureSession));
    const config={url:'https://edfrlptpeuhjsgxdfwke.supabase.co',publishableKey:'sb_publishable_fixture'};
    const first=authModule.createTabAuthClient(config,storage);
    const initial=await first.auth.getSession();await first.auth.dispose();
    assert.equal(initial.data.session.user.id,fixtureSession.user.id);
    const reload=authModule.createTabAuthClient(config,storage);
    const restored=await reload.auth.getSession();await reload.auth.dispose();
    assert.equal(restored.data.session.user.id,fixtureSession.user.id);
    assert.equal(authModule.eraseOperatorTabSession(),true);assert.equal(storage.getItem('taerynex-operator-auth'),null);
  });
  await t.test('Auth SDK fetch has an abortable request deadline',async()=>{
    const original=globalThis.fetch;let observed;
    globalThis.fetch=async(_input,options)=>{observed=options.signal;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));};
    const guard=setTimeout(()=>{},200);
    try {await assert.rejects(authModule.boundedAuthFetch('https://example.test',{},15),err=>err.name==='TimeoutError');assert.equal(observed.aborted,true);}
    finally {clearTimeout(guard);globalThis.fetch=original;}
  });
  await t.test('installed SDK logout sends one authenticated request before erasure; failures and late events cannot restore private UI',async()=>{
    const originalFetch=globalThis.fetch;
    const storage=window.sessionStorage;
    for(const succeeds of [true,false]) {
      const fixtureSession={access_token:'fixture-logout-token',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:randomUUID(),email:'operator@example.com'}};
      storage.setItem('taerynex-operator-auth',JSON.stringify(fixtureSession));
      let replyLogout,replyInbox,notify;const requests=[];
      globalThis.fetch=async(input,options)=>{
        const url=new URL(input.url || String(input));
        assert.equal(url.pathname,'/auth/v1/logout');assert.equal(url.searchParams.get('scope'),'local');
        requests.push({method:options.method,authorization:new Headers(options.headers).get('authorization')});
        return new Promise(resolve=>{replyLogout=resolve;});
      };
      const client=authModule.createTabAuthClient({url:'https://edfrlptpeuhjsgxdfwke.supabase.co',publishableKey:'sb_publishable_fixture'},storage);
      const subscribe=client.auth.onAuthStateChange.bind(client.auth);
      client.auth.onAuthStateChange=callback=>{notify=callback;return subscribe(callback);};
      let reads=0;
      const privateItem={id:'logout-item',email:'logout-private@example.com',message:'Private inquiry content',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),locale:'en',status:'new'};
      const transport={inbox:async()=>++reads===1 ? {items:[privateItem]} : new Promise(resolve=>{replyInbox=resolve;})};
      try {
        await render(createElement(Inbox,{clientFactory:()=>client,transport,key:`sdk-logout-${succeeds}`}));
        assert.ok(text().includes(privateItem.email));
        const button=label=>[...document.querySelectorAll('button')].find(el=>el.textContent===label);
        await act(async()=>{button('새로고침').click();await tick();});
        await act(async()=>{button('로그아웃').click();await tick();});
        assert.equal(requests.length,1);assert.deepEqual(requests[0],{method:'POST',authorization:'Bearer fixture-logout-token'});
        assert.equal(document.querySelectorAll('.operator-item').length,0);assert.ok(!text().includes(privateItem.message));
        assert.notEqual(storage.getItem('taerynex-operator-auth'),null);
        // Simulate a stale refresh event while SDK revocation owns its lock;
        // neither callback reentry nor a late inbox response can repopulate UI.
        await act(async()=>{notify('TOKEN_REFRESHED',fixtureSession);replyInbox({items:[privateItem]});await tick();});
        assert.ok(!text().includes(privateItem.email));assert.notEqual(storage.getItem('taerynex-operator-auth'),null);
        await act(async()=>{replyLogout(succeeds ? new Response(null,{status:204}) : new Response('{"message":"unavailable"}',{status:503,headers:{'content-type':'application/json'}}));await tick();});
        assert.equal(requests.length,1);assert.equal(storage.getItem('taerynex-operator-auth'),null);
        assert.ok(text().includes(succeeds ? '로그아웃했습니다.' : '서버 로그아웃을 확인하지 못했습니다.'));
        await act(async()=>{notify('TOKEN_REFRESHED',fixtureSession);await tick();});
        assert.equal(document.querySelectorAll('.operator-item').length,0);assert.ok(!text().includes(privateItem.email));
      } finally {
        await render(null);await client.auth.dispose();storage.removeItem('taerynex-operator-auth');globalThis.fetch=originalFetch;
      }
    }
  });
});
