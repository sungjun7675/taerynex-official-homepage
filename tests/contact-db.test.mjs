import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createContactHandler,PUBLIC_API_KEY,CONSENT_VERSION} from '../supabase/functions/website-contact/handler.js';
import {createContactApi,ContactError} from '../src/marketing/contact-api.js';

const migration = await readFile('supabase/migrations/20261027120957_website_contact_intake.sql','utf8');
const owner=randomUUID(), session=randomUUID(), outsider=randomUUID();
const email='operator@example.com';
const payload=(overrides={})=>({requestId:randomUUID(),email:'visitor@example.com',message:'Please explain closed testing.',locale:'en',consent:true,website:'',...overrides});
const args=body=>[body.requestId,body.email,body.message,body.locale,body.website,CONSENT_VERSION];
const uuidError=code=>err=>err.code===code;

test('real Postgres fixture: service boundaries, intake, quotas, inbox and retention',async t=>{
  const db=new PGlite(); await db.waitReady; t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);`);
  // Execute the exact new migration, never the archived restaurant migrations.
  await db.exec(migration);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',[owner,email,outsider,'other@example.com']);
  await db.query('insert into auth.sessions values($1,$2,null)',[session,owner]);
  await db.query('insert into website_contact_private.operator values(true,$1,$2)',[owner,email]);
  const intake=async body=>{
    await db.exec('set role service_role');
    try {return (await db.query('select public.website_contact_intake($1,$2,$3,$4,$5,$6) as result',args(body))).rows[0].result;}
    finally {await db.exec('reset role');}
  };
  const inbox=async(command,actor=owner,sid=session)=>{
    await db.exec('set role service_role');
    try {return (await db.query('select public.website_contact_inbox($1,$2,$3::jsonb) as result',[actor,sid,JSON.stringify(command)])).rows[0].result;}
    finally {await db.exec('reset role');}
  };
  const count=async()=>Number((await db.query('select count(*) as n from website_contact_private.inquiries')).rows[0].n);
  const reset=()=>db.exec('truncate website_contact_private.inquiries');

  await t.test('anon/authenticated cannot CRUD tables or execute either RPC; service cannot CRUD tables',async()=>{
    for(const role of ['anon','authenticated','service_role']) {
      await db.exec(`set role ${role}`);
      try {
        for(const statement of ['select * from website_contact_private.inquiries','insert into website_contact_private.inquiries default values','update website_contact_private.inquiries set status=\'resolved\'','delete from website_contact_private.inquiries','select * from website_contact_private.operator']) await assert.rejects(db.query(statement),uuidError('42501'));
        if(role!=='service_role') {
          await assert.rejects(db.query('select public.website_contact_intake($1,$2,$3,$4,$5,$6)',args(payload())),uuidError('42501'));
          await assert.rejects(db.query('select public.website_contact_inbox($1,$2,$3::jsonb)',[owner,session,'{"action":"list"}']),uuidError('42501'));
        }
      } finally {await db.exec('reset role');}
    }
    const tables=await db.query("select relrowsecurity,relforcerowsecurity from pg_class where relnamespace='website_contact_private'::regnamespace and relkind='r'");
    assert.equal(tables.rows.length,2); assert.ok(tables.rows.every(row=>row.relrowsecurity && row.relforcerowsecurity));
  });
  await t.test('persisted receipt, idempotent retry and conflicting payload',async()=>{
    const body=payload(), first=await intake(body);
    assert.equal(first.status,'received'); assert.match(first.receipt,/^[a-f0-9-]{36}$/);
    assert.deepEqual(await intake(body),first); assert.equal(await count(),1);
    await assert.rejects(intake({...body,message:'A different request payload.'}),uuidError('P0409'));
    assert.equal(await count(),1);
  });
  await t.test('DB rejects missing consent, honeypot, invalid locale, email and unbounded message',async()=>{
    await reset();
    for(const change of [{website:'robot'},{message:'x'},{message:'x'.repeat(3001)},{locale:'xx'},{email:'invalid'},{email:'UPPER@example.com'}]) await assert.rejects(intake(payload(change)),uuidError('22023'));
    await assert.rejects(db.query('select public.website_contact_intake($1,$2,$3,$4,$5,$6)',[...args(payload()).slice(0,-1),'wrong']),uuidError('22023'));
    assert.equal(await count(),0);
  });
  await t.test('email and global/capacity quotas enforced inside database without collecting IP',async()=>{
    await reset(); for(let i=0;i<3;i++) await intake(payload());
    await assert.rejects(intake(payload()),uuidError('P0429'));
    await reset(); for(let i=0;i<6;i++) await intake(payload({email:`person${i}@example.com`}));
    assert.equal(await count(),6);
    await reset();
    await db.exec(`insert into website_contact_private.inquiries(request_id,email,message,locale,consent_version)
      select gen_random_uuid(),'seed'||i||'@example.com','Fixture request content','en','${CONSENT_VERSION}' from generate_series(1,100) i;`);
    await assert.rejects(intake(payload()),uuidError('P0429'));
    await reset();
    await db.exec(`insert into website_contact_private.inquiries(request_id,email,message,locale,consent_version,created_at)
      select gen_random_uuid(),'seed'||i||'@example.com','Fixture request content','en','${CONSENT_VERSION}',now()-interval '2 days' from generate_series(1,1000) i;`);
    await assert.rejects(intake(payload()),uuidError('P0429')); await reset();
  });
  await t.test('pinned UUID, email confirmation, live session and session expiry independently enforced',async()=>{
    for(const [actor,sid] of [[outsider,session],[owner,randomUUID()]]) await assert.rejects(inbox({action:'list'},actor,sid),uuidError('42501'));
    await db.query('update auth.users set email_confirmed_at=null where id=$1',[owner]);
    await assert.rejects(inbox({action:'list'}),uuidError('42501'));
    await db.query('update auth.users set email_confirmed_at=now(),is_anonymous=true where id=$1',[owner]);
    await assert.rejects(inbox({action:'list'}),uuidError('42501'));
    await db.query('update auth.users set is_anonymous=false,email=$2 where id=$1',[owner,'changed@example.com']);
    await assert.rejects(inbox({action:'list'}),uuidError('42501'));
    await db.query('update auth.users set email=$2 where id=$1',[owner,email]);
    await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[session]);
    await assert.rejects(inbox({action:'list'}),uuidError('42501'));
    await db.query('update auth.sessions set not_after=null where id=$1',[session]);
  });
  await t.test('stable bounded keyset pagination, filter, resolve/reopen without retention extension, deletion',async()=>{
    await reset();
    await db.exec(`insert into website_contact_private.inquiries(request_id,email,message,locale,consent_version)
      select gen_random_uuid(),'page'||i||'@example.com','<img src=x onerror=alert(1)>','en','${CONSENT_VERSION}' from generate_series(1,24) i;`);
    const first=(await inbox({action:'list'})).items; assert.equal(first.length,21);
    const tail=first[19];
    const second=(await inbox({action:'list',before:{created_at:tail.created_at,id:tail.id}})).items;
    assert.equal(second.length,4); assert.equal(new Set([...first.slice(0,20),...second].map(x=>x.id)).size,24);
    assert.equal(first[0].message,'<img src=x onerror=alert(1)>'); assert.equal(first[0].ip_hash,undefined);
    await inbox({action:'status',id:tail.id,status:'resolved'});
    const resolved=(await inbox({action:'list',status:'resolved'})).items; assert.equal(resolved.length,1);
    assert.ok(new Date(resolved[0].expires_at)-Date.now()<31*86400000);
    await inbox({action:'status',id:tail.id,status:'new'});
    const reopened=(await db.query('select expires_at from website_contact_private.inquiries where id=$1',[tail.id])).rows[0];
    assert.equal(new Date(reopened.expires_at).getTime(),new Date(resolved[0].expires_at).getTime());
    await assert.rejects(inbox({action:'status',id:tail.id,status:'invented'}),uuidError('22023'));
    await inbox({action:'delete',id:tail.id}); assert.equal(await count(),23);
  });
  await t.test('retention function actually deletes expired rows',async()=>{
    await reset(); const result=await intake(payload());
    await db.exec('select website_contact_private.purge()');
    assert.equal(await count(),1);
    await db.exec("update website_contact_private.inquiries set expires_at=now()-interval '1 second'; select website_contact_private.purge();");
    assert.equal(await count(),0);
  });
  await t.test('mocked HTTP + real DB integration: ambiguous response retry stores exactly once, operator reads stored request',async()=>{
    await reset();
    const jwt=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub:owner,session_id:session})).toString('base64url')}.fixture`;
    let checked=0;
    const handler=createContactHandler({getUser:async token=>{checked++;return token===jwt ? {id:owner,email,email_confirmed_at:'2026-10-27',is_anonymous:false} : null;},rpc:async(name,p)=>name==='website_contact_intake' ? intake({requestId:p.p_request,email:p.p_email,message:p.p_message,locale:p.p_locale,website:p.p_honeypot}) : inbox(p.p_command,p.p_actor,p.p_session)});
    let loseResponse=true;
    const fetcher=async(url,options)=>{
      const response=await handler(new Request(url,{...options,headers:{...options.headers,origin:'https://taerynex.com'}}));
      if(loseResponse) {loseResponse=false;throw new Error('connection lost AFTER commit');} return response;
    };
    const api=createContactApi({url:'https://edfrlptpeuhjsgxdfwke.supabase.co',publishableKey:PUBLIC_API_KEY},fetcher);
    const body=payload(); await assert.rejects(api.submit(body),err=>err instanceof ContactError && err.code==='uncertain'); assert.equal(await count(),1);
    const receipt=await api.submit(body); assert.equal(await count(),1);
    const list=await api.inbox({action:'list'},jwt); assert.equal(list.items[0].id,receipt); assert.equal(checked,1);
    await assert.rejects(api.inbox({action:'list'},'forged'),err=>err.code==='unauthorized');
    await db.query('delete from auth.sessions where id=$1',[session]);
    await assert.rejects(api.inbox({action:'list'},jwt),err=>err.code==='unauthorized');
  });
});
