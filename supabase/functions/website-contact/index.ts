import { createContactHandler } from './handler.js';

// Existing automatically provided platform secrets only. No secret writes.
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (url !== 'https://edfrlptpeuhjsgxdfwke.supabase.co' || !serviceKey) throw new Error('Website project configuration required');

async function rpc(name: string, body: unknown, {signal}: {signal: AbortSignal}) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`,{
    method:'POST',headers:{apikey:serviceKey!,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal,
  });
  const data = await response.json();
  if (!response.ok) throw {code:data.code};
  return data;
}
async function getUser(token: string, {signal}: {signal: AbortSignal}) {
  const response = await fetch(`${url}/auth/v1/user`,{
    headers:{apikey:serviceKey!,Authorization:`Bearer ${token}`},signal,
  });
  return response.ok ? response.json() : null;
}
Deno.serve(createContactHandler({rpc,getUser}));
