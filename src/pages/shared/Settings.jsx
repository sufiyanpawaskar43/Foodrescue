import React, { useEffect, useState } from 'react';
import { ScreenHeading } from '../../components/WorkspaceComponents.jsx';
const defaults={require_org_verification:true,approximate_pickup_areas:true,volunteer_assistance:true,flag_expired_listings:true};
export default function SettingsPage({ app }) {
  const [settings,setSettings]=useState(defaults);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{const next={...defaults};(app.backendSettings||[]).forEach(x=>{if(Object.hasOwn(next,x.key))next[x.key]=Boolean(x.value?.enabled ?? x.value)});setSettings(next)},[app.backendSettings]);
  const update=(key,value)=>setSettings(s=>({...s,[key]:value}));
  const save=async()=>{if(saving)return;setSaving(true);setError('');try{for(const [key,value] of Object.entries(settings)){const ok=await app.savePlatformSetting(key,{enabled:value});if(!ok)throw new Error(`Could not save the setting: ${key}. Check the notification and try again.`);}app.flash('All platform settings saved.');}catch(e){setError(e?.message||'Could not save all platform settings.');}finally{setSaving(false)}};
  return <><ScreenHeading eyebrow="PLATFORM ADMIN" title="Platform settings" description="Configure platform-wide safety and experience preferences."/><div className="onboarding-profile"><h2>Platform preferences</h2>{error&&<div className="form-note" role="alert">{error}</div>}{[['require_org_verification','Require organization verification before claiming','Recipient eligibility'],['approximate_pickup_areas','Show approximate pickup areas before claims','Location privacy'],['volunteer_assistance','Allow volunteers to assist with pickups','Volunteer coordination'],['flag_expired_listings','Flag listings that pass their pickup deadline','Food listing expiry']].map(([key,label,sub])=><label className="setting-row" key={key}><span><strong>{sub}</strong><small>{label}</small></span><input type="checkbox" checked={settings[key]} onChange={e=>update(key,e.target.checked)}/></label>)}<button className="btn btn-primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save settings'}</button></div></>;
}
