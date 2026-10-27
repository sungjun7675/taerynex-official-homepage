import { createClient } from '@supabase/supabase-js';
import { contactConfig } from './contact-config.js';
// Dedicated operator bundle. Tab-only storage survives reload without another
// scarce default-SMTP email. Never use localStorage or store inquiry drafts.
// Dashboard invitation precedes sign-in; the privately pinned UUID is the authorization
// boundary. Implicit callback supports a new email tab.
let singleton;
export let operatorAuthIssue='';
export function probeTabStorage(storage) {
  const probe='taerynex-operator-storage-check';
  storage.setItem(probe,'1');
  if(storage.getItem(probe)!=='1') throw new Error('storage_blocked');
  storage.removeItem(probe);
  return storage;
}
export function eraseOperatorTabSession() {
  try {window.sessionStorage.removeItem('taerynex-operator-auth');return true;}
  catch {return false;}
}
export function boundedAuthFetch(input,options={},timeoutMs=10000) {
  const signal=AbortSignal.any([...(options.signal ? [options.signal] : []),AbortSignal.timeout(timeoutMs)]);
  return fetch(input,{...options,signal});
}
export function createTabAuthClient(config,storage) {
  return createClient(config.url,config.publishableKey,{global:{fetch:boundedAuthFetch},auth:{storage,storageKey:'taerynex-operator-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
}
export function createOperatorAuth(config = contactConfig) {
  if (!config.publishableKey) return null;
  if (singleton) return singleton;
  let storage;
  try {storage=probeTabStorage(window.sessionStorage);} catch {operatorAuthIssue='storage_blocked';return null;}
  operatorAuthIssue='';
  return singleton=createTabAuthClient(config,storage);
}
