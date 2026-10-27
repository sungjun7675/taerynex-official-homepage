import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createContactHandler,PUBLIC_API_KEY} from '../supabase/functions/website-contact/handler.js';
const body=()=>({requestId:randomUUID(),email:'reader@example.com',message:'How can I join the closed test?',locale:'ko',consent:true,website:''});
const req=(value=body(),options={})=>new Request('https://example.test/functions/v1/website-contact',{
  method:'POST',headers:{origin:'https://taerynex.com',apikey:PUBLIC_API_KEY,'content-type':'application/json',...options.headers},body:JSON.stringify(value),...Object.fromEntries(Object.entries(options).filter(([key])=>key!=='headers')),
});

test('HTTP boundary rejects malformed/unbounded/unconsented and extra data before touching DB',async()=>{
  let calls=0; const handler=createContactHandler({getUser:async()=>null,rpc:async()=>{calls++;return {};}});
  for(const value of [{...body(),consent:false},{...body(),email:'bad'},{...body(),message:'short'},{...body(),message:'x'.repeat(3001)},{...body(),birthDate:'2000-01-01'},{...body(),attachment:'x'},{...body(),locale:'xx'},{...body(),requestId:'not-uuid'},[],null]) assert.equal((await handler(req(value))).status,400);
  assert.equal((await handler(req(body(),{headers:{origin:'https://attacker.example'}}))).status,403);
  assert.equal((await handler(req(body(),{headers:{apikey:'wrong'}}))).status,401);
  assert.equal((await handler(req(body(),{headers:{'content-type':'text/plain'}}))).status,415);
  assert.equal((await handler(req(body(),{body:'not json'}))).status,400);
  assert.equal((await handler(req(body(),{body:'x'.repeat(16001)}))).status,400);
  assert.equal(calls,0);
});

test('CORS preflight, service failures, honeypot and receipt truthfulness',async()=>{
  const receipt=randomUUID(); let captured;
  const handler=createContactHandler({getUser:async()=>null,rpc:async(name,p)=>{captured=p; if(p.p_honeypot)throw{code:'22023'};return {status:'received',receipt};}});
  const result=await handler(req()); assert.equal(result.status,201); assert.deepEqual(await result.json(),{status:'received',receipt});
  assert.ok(!Object.hasOwn(captured,'p_ip_hash')); assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal((await handler(req({...body(),website:'bot'}))).status,400);
  const preflight=await handler(new Request('https://example.test/functions/v1/website-contact',{method:'OPTIONS',headers:{origin:'https://taerynex.com'}}));
  assert.equal(preflight.status,204); assert.equal(preflight.headers.get('access-control-allow-origin'),'https://taerynex.com');
  for(const [code,status] of [['P0429',429],['P0409',409],['42501',403],['unknown',503]]) {
    const fail=createContactHandler({rpc:async()=>{throw{code,message:'private service details'};},getUser:async()=>null});
    const response=await fail(req()); assert.equal(response.status,status); assert.ok(!(await response.text()).includes('private service details'));
  }
  const empty=createContactHandler({rpc:async()=>({}),getUser:async()=>null});
  assert.equal((await empty(req())).status,503);
});

test('operator HTTP validates user server-side before any privileged RPC',async()=>{
  const uid=randomUUID(),sid=randomUUID(); let calls=0; let user=null;
  const handler=createContactHandler({getUser:async()=>user,rpc:async()=>{calls++;return {items:[]};}});
  const jwt=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url')}.test`;
  const request=()=>new Request('https://example.test/functions/v1/website-contact/inbox',{method:'POST',headers:{origin:'https://taerynex.com',apikey:PUBLIC_API_KEY,'content-type':'application/json',Authorization:`Bearer ${jwt}`},body:'{"action":"list"}'});
  for(const invalid of [null,{id:uid,email:'operator@example.com',email_confirmed_at:null},{id:uid,email:'operator@example.com',email_confirmed_at:'yes',is_anonymous:true}]) {user=invalid; assert.equal((await handler(request())).status,403);}
  assert.equal(calls,0);
  user={id:randomUUID(),email:'operator@example.com',email_confirmed_at:'yes'}; assert.equal((await handler(request())).status,401);
  user={id:uid,email:'operator@example.com',email_confirmed_at:'yes'}; assert.equal((await handler(request())).status,200); assert.equal(calls,1);
});

test('stalled and aborted partial streams terminate without awaiting hanging cancel',async()=>{
  for(const abortRequest of [false,true]) {
    let canceled=false,calls=0;
    const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){canceled=true;return new Promise(()=>{});}});
    const controller=new AbortController();
    const request=new Request('https://example.test/functions/v1/website-contact',{method:'POST',headers:{origin:'https://taerynex.com',apikey:PUBLIC_API_KEY,'content-type':'application/json'},body:stream,duplex:'half',signal:controller.signal});
    const handler=createContactHandler({readTimeoutMs:25,operationTimeoutMs:100,rpc:async()=>{calls++;},getUser:async()=>null});
    let guard;const bound=new Promise((_,reject)=>{guard=setTimeout(()=>reject(new Error('read deadline did not terminate')),500);});
    const pending=handler(request);if(abortRequest)setTimeout(()=>controller.abort(),5);
    try {assert.equal((await Promise.race([pending,bound])).status,408);} finally {clearTimeout(guard);}
    assert.equal(calls,0);assert.equal(canceled,true);assert.equal(request.body.locked,false);
  }
});

test('one shared operation budget bounds stalled service work',async()=>{
  const handler=createContactHandler({readTimeoutMs:10,operationTimeoutMs:25,rpc:()=>new Promise(()=>{}),getUser:async()=>null});
  let guard;const bound=new Promise((_,reject)=>{guard=setTimeout(()=>reject(new Error('operation did not terminate')),500);});
  try {assert.equal((await Promise.race([handler(req()),bound])).status,408);} finally {clearTimeout(guard);}
});
