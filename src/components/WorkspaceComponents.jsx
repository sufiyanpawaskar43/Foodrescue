import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const quickActions = {
  Donor: [['Post surplus food','Create a fresh listing','＋','Post food'],['Review pickup requests','Coordinate a handover','↗','Pickup requests'],['See your impact','Meals rescued so far','✳','Donor impact']],
  Recipient: [['Browse nearby food','Find today’s surplus','⌕','Browse food'],['See your claims','Plan your next pickup','♡','My claims'],['Explore your impact','Every meal matters','✳','Impact']],
  Volunteer: [['Find available pickups','Help food get there','⌕','Available pickups'],['Your pickup schedule','See upcoming handovers','◷','Volunteer schedule'],['View pickup history','See your contribution','✓','Volunteer pickups']],
  Admin: [['Verify organizations','Review partner requests','✓','Organization verification'],['Moderate listings','Keep the feed healthy','▧','Moderate listings'],['Review reports','Resolve community concerns','⚑','Manage reports']],
};

export function ScreenHeading({ eyebrow, title, description, action }) {
  return <header className="screen-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function DashboardPage({ role, onNavigate, app }) {
  const [range,setRange]=useState('This month');
  const rawFoods=app?.foods||[]; const rawDonorFoods=app?.backendMyFood||[]; const rawAllFoods=app?.backendModerationFood||[];
  const rawClaims=app?.claims||[]; const rawPickups=app?.backendVolunteerPickups||[]; const rawUsers=app?.backendUsers||[];
  const rawOrganizations=app?.backendOrganizations||[]; const rawReports=app?.backendReports||[];
  const rangeStart=()=>{const start=new Date();start.setHours(0,0,0,0);if(range==='This week')start.setDate(start.getDate()-((start.getDay()+6)%7));else if(range==='This month')start.setDate(1);else start.setMonth(0,1);return start;};
  const startDate=rangeStart();
  const inRange=(date)=>{if(!date)return true;const timestamp=new Date(date).getTime();return Number.isFinite(timestamp)&&timestamp>=startDate.getTime()&&timestamp<=Date.now();};
  const foods=rawFoods.filter(x=>inRange(x.created_at||x.raw?.created_at));
  const donorFoods=rawDonorFoods.filter(x=>inRange(x.created_at||x.raw?.created_at));
  const allFoods=rawAllFoods.filter(x=>inRange(x.created_at||x.raw?.created_at));
  const claims=rawClaims.filter(x=>inRange(x.claimed_at));
  const pickups=rawPickups.filter(x=>inRange(x.created_at||x.accepted_at));
  const users=rawUsers.filter(x=>inRange(x.created_at));
  const organizations=rawOrganizations.filter(x=>inRange(x.created_at));
  const reports=rawReports.filter(x=>inRange(x.created_at));
  const quantitySummary=(items)=>{
    const byUnit=new Map();
    for(const item of items){
      const raw=Number(item.raw?.quantity ?? item.quantity ?? Number.parseFloat(String(item.qty||'').replace(/[^0-9.]/g,'')));
      if(!Number.isFinite(raw)||raw<=0)continue;
      const unit=String(item.raw?.unit||item.unit||'units').trim()||'units';
      byUnit.set(unit,(byUnit.get(unit)||0)+raw);
    }
    if(!byUnit.size)return '0';
    if(byUnit.size>1)return `${byUnit.size} unit types`;
    const [unit,amount]=[...byUnit.entries()][0];
    const formatted=Number(amount.toFixed(2)).toLocaleString();
    return `${formatted} ${unit.toLowerCase()}`;
  };
  const m=role==='Admin' ? [[String(users.length),'Members','♙'],[String(organizations.length),'Organizations','⌂'],[String(allFoods.length),'Food listings','▧'],[String(reports.filter(x=>!['resolved','dismissed'].includes(x.status)).length),'Open reports','⚑']]
    : role==='Donor' ? [[String(donorFoods.length),'Your listings','▧'],[String(claims.filter(x=>x.status==='pending').length),'Awaiting pickup','↗'],[quantitySummary(donorFoods),'Quantity shared','✳'],[String(claims.filter(x=>x.status==='picked_up').length),'Completed pickups','✓']]
    : role==='Volunteer' ? [[String(claims.filter(x=>x.status==='approved').length),'Pickups available','⌕'],[String(pickups.filter(x=>x.status==='completed').length),'Completed pickups','✓'],[String(pickups.filter(x=>['requested','accepted','in_progress'].includes(x.status)).length),'Your active pickups','◷'],[quantitySummary(pickups.map(p=>claims.find(c=>c.claimId===p.claim_id)).filter(Boolean)),'Food moved','↗']]
    : [[String(foods.length),'Available listings','⌕'],[String(claims.length),'Your claims','♡'],[String(claims.filter(x=>x.status==='picked_up').length),'Pickups completed','✓'],[quantitySummary(claims),'Quantity claimed','✳']];
  const recentActivities=(app?.backendNotifications||[]).slice(0,4);
  return <>
    <ScreenHeading eyebrow={`${role.toUpperCase()} WORKSPACE`} title={role==='Admin'?'Platform overview':`Good ${new Date().getHours()<12?'morning':'afternoon'}, ${(app?.profile?.full_name || 'there')} 👋`} description={role==='Admin'?'A clear view of the good happening across FoodRescue.':'A little surplus can go a long way. Here’s what’s happening in your community.'} action={<select className="range-select" value={range} onChange={e=>setRange(e.target.value)}><option>This month</option><option>This week</option><option>This year</option></select>}/>
    <div className="dashboard-metrics">{m.map(([value,label,icon])=><div className="metric-card" key={label}><span className="metric-icon">{icon}</span><strong>{value}</strong><small>{label}</small><span className="metric-trend">Live Supabase data</span></div>)}</div>
    <section className="workspace-section"><div className="workspace-section-title"><div><span className="section-kicker">KEEP THE GOOD GOING</span><h2>Quick actions</h2></div></div><div className="action-grid">{(quickActions[role]||quickActions.Recipient).map(([title,sub,icon,target])=><button className="action-card" key={title} onClick={()=>onNavigate(target)}><span className="action-icon">{icon}</span><span><strong>{title}</strong><small>{sub}</small></span><span className="action-arrow">↗</span></button>)}</div></section>
    <section className="workspace-section activity-layout"><div><div className="workspace-section-title"><div><span className="section-kicker">WHAT’S HAPPENING</span><h2>Recent activity</h2></div><button className="text-link" onClick={()=>onNavigate('Notifications')}>View all →</button></div><div className="activity-list">{recentActivities.length ? recentActivities.map(item=><div className="activity-item" key={item.id}><span className="activity-icon">{item.type==='claim'?'↗':item.type==='pickup'?'✓':item.type==='report'?'⚑':'✳'}</span><span><strong>{item.title}</strong><small>{item.created_at?new Date(item.created_at).toLocaleString():'Recent activity'}</small></span><span className="activity-dot"/></div>) : <div className="empty-state"><strong>No recent activity yet</strong><p>Updates from your FoodRescue account will appear here.</p></div>}</div></div><aside className="community-card"><span className="section-kicker">A GOOD THING TO KNOW</span><div className="community-illustration">✳</div><h3>Good food travels further together.</h3><p>Every listing, claim and pickup makes your neighborhood a little stronger.</p><button className="text-link" onClick={()=>onNavigate('Impact')}>See community impact →</button></aside></section>
  </>;
}

export function ListingFormPage({ form, setForm, onSubmit }) {
  const update=(key,value)=>setForm(old=>({...old,[key]:value}));
  const [uploadMessage,setUploadMessage]=useState('JPG, PNG or WebP, up to 5 MB');
  const previewUrlRef=useRef(null);
  useEffect(()=>()=>{if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current)},[]);
  const choosePhoto=(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setUploadMessage('Choose a JPG, PNG or WebP image.');event.target.value='';return}
    if(file.size>5*1024*1024){setUploadMessage('That image is larger than 5 MB. Choose a smaller file.');event.target.value='';return}
    if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current=URL.createObjectURL(file);
    update('image',previewUrlRef.current);update('imageFile',file);setUploadMessage(file.name);
  };
  return <><ScreenHeading eyebrow="A GOOD THING STARTS HERE" title="Post surplus food" description="Tell nearby organizations what you have. A few clear details help good food find a home."/>
    <form className="listing-layout" onSubmit={onSubmit}><div className="listing-form-card"><h2>Food details</h2><p>Share the essentials so a recipient can decide if it’s right for them.</p><label>Listing title<input required maxLength="70" value={form.title} onChange={e=>update('title',e.target.value)} placeholder="e.g. Fresh vegetable rice bowls"/><small>Keep it clear and specific.</small></label><label>Description<textarea rows="4" value={form.description||''} onChange={e=>update('description',e.target.value)} placeholder="Tell recipients what is included and how it should be stored."/></label><div className="form-split"><label>Category<select value={form.category} onChange={e=>update('category',e.target.value)}><option>Meals</option><option>Bakery</option><option>Produce</option><option>Packaged</option></select></label><label>Quantity<input required type="number" min="1" value={form.qty} onChange={e=>update('qty',e.target.value)} placeholder="e.g. 20"/></label></div><label>Unit<select value={form.unit||'Portions'} onChange={e=>update('unit',e.target.value)}><option>Portions</option><option>Meals</option><option>Boxes</option><option>Kg</option><option>Pieces</option></select></label><div className="form-split"><label>Available from<input type="datetime-local" value={form.availableFrom||''} onChange={e=>update('availableFrom',e.target.value)}/></label><label>Pickup deadline<input required type="datetime-local" value={form.pickup} onChange={e=>update('pickup',e.target.value)}/></label></div><label>Allergens<input value={form.allergens||''} onChange={e=>update('allergens',e.target.value)} placeholder="e.g. Dairy, gluten, peanuts"/></label><label>Storage notes<input value={form.storageNotes||''} onChange={e=>update('storageNotes',e.target.value)} placeholder="e.g. Keep refrigerated"/></label><label>Pickup area<input required value={form.area} onChange={e=>update('area',e.target.value)} placeholder="Neighborhood / pickup area"/></label><div className="upload-box">{form.image?<img className="upload-preview" src={form.image} alt="Selected food"/>:<span>↥</span>}<strong>{form.image?'Photo ready to publish':'Add food photos'}</strong><small>{uploadMessage}</small><label className="btn btn-outline upload-button">Choose photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto}/></label></div><button className="btn btn-primary btn-large form-publish">Publish food listing <span>↗</span></button></div><aside className="guidelines-card"><span className="guideline-icon">✳</span><h3>Good sharing guidelines</h3><p>A few thoughtful details help keep every handover clear.</p>{['Only share food that is suitable to donate','Be clear about ingredients and allergens','Set a realistic pickup deadline','Share an approximate pickup area publicly','Donors are responsible for food information'].map((text,i)=><div className="guideline" key={text}><span>{i<4?'✓':'!'}</span>{text}</div>)}</aside></form>
  </>;
}

export function AuthPage({ mode, onNavigate, onSignIn, onCreateAccount, onAdminSignIn, onRetrySession, showSessionRetry=false, isAdmin=false, selectedRole='Recipient', onRoleChange, loading=false, error='', initialEmail='' }) {
  const admin = isAdmin || mode === 'Admin sign in';
  const [email,setEmail]=useState(initialEmail);
  const [password,setPassword]=useState('');
  const submit = (event) => {
    event.preventDefault();
    const payload={email:email.trim(),password};
    if (admin) onAdminSignIn?.(payload);
    else if (mode === 'Create account') onCreateAccount?.(payload);
    else onSignIn?.(payload);
  };
  const communityRoles = [
    ['Recipient', '⌂', 'NGO, shelter or community group'],
    ['Donor', '♧', 'Restaurant, bakery or event'],
    ['Volunteer', '♡', 'Help with pickup and delivery'],
  ];
  return <div className="auth-screen"><div className="auth-panel">
    <span className="section-kicker">{admin?'FOODRESCUE ADMIN':'WELCOME TO FOODRESCUE'}</span>
    <h1>{mode==='Sign in'||admin?'Welcome back.':'Make room for good.'}</h1>
    <p>{admin?'Sign in to the platform administration workspace.':mode==='Sign in'?'Sign in to continue your community work.':'Create an account and join a community that shares more.'}</p>
    {!admin&&<div className="auth-role-section"><div className="auth-role-heading"><strong>{mode==='Sign in'?'Sign in as':'Create account as'}</strong><small>Select your FoodRescue role</small></div><div className="auth-role-grid">{communityRoles.map(([id,icon,sub])=><button type="button" key={id} className={`auth-role-option ${selectedRole===id?'selected':''}`} onClick={()=>onRoleChange?.(id)}><span className="onboarding-icon">{icon}</span><span><strong>{id}</strong><small>{sub}</small></span><span className="radio-dot"/></button>)}</div><div className="auth-role-confirm">{mode==='Sign in'?'You’re signing in as':'You’re creating your account as'} <strong>{selectedRole}</strong>.</div></div>}
    {error&&<div className="form-note" role="alert">{error}</div>}
    {showSessionRetry&&<button type="button" className="btn btn-outline" onClick={onRetrySession} disabled={loading}>Retry session restore</button>}
    <form className="modal-form" onSubmit={submit}>
      <label>Email address<input required autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={admin?'admin@foodrescue.org':selectedRole==='Donor'?'you@business.org':selectedRole==='Volunteer'?'you@volunteer.org':'you@organization.org'}/></label>
      <label>Password<input required autoComplete={mode==='Sign in'?'current-password':'new-password'} minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
      <button disabled={loading} className="btn btn-primary btn-large modal-submit">{loading?'Please wait…':admin?'Admin sign in':mode==='Sign in'?`Sign in as ${selectedRole}`:'Create account'} {!loading&&<span>↗</span>}</button>
    </form>
    {!admin&&<><div className="auth-or"><span/>or continue with<span/></div><button type="button" className="btn btn-outline auth-provider" disabled title="Google OAuth is not configured in Supabase">G &nbsp; Google sign-in not configured</button></>}
    <p className="auth-switch">{admin?'Need a community account?':mode==='Sign in'?"Don't have an account?":"Already have an account?"}<button type="button" onClick={()=>admin?onNavigate('Sign in'):onNavigate(mode==='Sign in'?'Create account':'Sign in')}>{admin?'Sign in as a community member':mode==='Sign in'?'Create account':'Sign in'}</button></p>
    <small className="demo-note">{error?'Fix the issue above and try again.':admin?'Admin access requires a pre-approved administrator profile.':'Instant community sign-up requires “Confirm email” to be OFF in Supabase Email provider settings.'}</small>
  </div><div className="auth-art"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85" alt="A colorful shared meal"/><div><span>✳ COMMUNITY, SERVED FRESH</span><strong>Good food can<br/>change a day.</strong><p>Together, we make sure more of it reaches the people who need it.</p></div></div></div>;
}
export function OnboardingPage({ onComplete, initialRole='Recipient', loading=false, error='', roleLocked=true }) {
  const [choice,setChoice]=useState(initialRole);
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [neighborhood,setNeighborhood]=useState('');
  const [about,setAbout]=useState('');
  const [localError,setLocalError]=useState('');
  useEffect(()=>setChoice(initialRole),[initialRole]);
  const submit=async()=>{
    setLocalError('');
    if(!name.trim()){setLocalError('Enter your full name or organization name before continuing.');return;}
    if(name.trim().length>150){setLocalError('Keep the name to 150 characters or fewer.');return;}
    try { await onComplete?.({role:choice,fullName:name.trim(),organizationName:name.trim(),phone:phone.trim(),neighborhood:neighborhood.trim(),about:about.trim()}); }
    catch(error) { setLocalError(error?.message||'Could not save your profile.'); }
  };
  return <><ScreenHeading eyebrow="LET’S GET TO KNOW YOU" title="Choose your role" description="Your workspace will be tailored to the way you help your community."/>
    {(error||localError)&&<div className="form-note" role="alert">{localError||error}</div>}
    <div className="onboarding-grid">{[['Recipient','NGO, shelter or community organization','⌂'],['Donor','Restaurant, bakery, caterer or event','♧'],['Volunteer','Help coordinate a community pickup','♡']].map(([name,description,icon])=><button type="button" disabled={roleLocked} className={`onboarding-option ${choice===name?'selected':''}`} key={name} onClick={()=>setChoice(name)}><span className="onboarding-icon">{icon}</span><strong>I’m a {name.toLowerCase()}</strong><small>{description}</small><span className="radio-dot"/></button>)}</div>
    {roleLocked&&<p className="privacy-note">Your role is tied to this account and cannot be changed during onboarding.</p>}
    <div className="onboarding-profile"><h2>Tell us about yourself</h2><p>Save your profile and organization details so you can complete verification.</p><div className="form-split"><label>Organization or full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Helping Hands NGO"/></label><label>Phone number<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" placeholder="+91 00000 00000"/></label></div><label>Neighborhood<input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} placeholder="City and pickup area"/></label><label>About your organization<textarea value={about} onChange={e=>setAbout(e.target.value)} rows="3" placeholder="Who do you support? What kind of food helps most?"/></label><button disabled={loading} className="btn btn-primary btn-large" onClick={submit}>{loading?'Saving…':'Continue to your workspace'} <span>→</span></button></div></>;
}
export function DataPage({ title, eyebrow='WORKSPACE', description, rows=[], columns=[], onAction, actionLabel='Review', onSecondaryAction, secondaryActionLabel='Reject', emptyLabel='Nothing to show yet' }) {
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('All statuses');
  const normalizedStatus=(row)=>String(row[columns.length-1]??'').trim().toLowerCase().replaceAll(' ','_');
  const statusMatch=(row)=>{
    if(status==='All statuses')return true;
    const current=normalizedStatus(row);
    const groups={
      'Needs review':['pending','open','needs_review','escalated'],
      'Active':['active','available','verified','accepted','in_progress','approved'],
      'Completed':['completed','resolved','dismissed','picked_up'],
      'Open':['open','pending','requested','in_progress','escalated'],
      'Upcoming':['requested','accepted','in_progress','approved'],
    };
    return (groups[status]||[status.toLowerCase().replaceAll(' ','_')]).includes(current);
  };
  const filtered=rows.filter(row=>row.join(' ').toLowerCase().includes(query.toLowerCase())&&statusMatch(row));
  const visibleCells=(row)=>row.slice(0,columns.length);
  const exportCsv=()=>{
    const quote=value=>`"${String(value??'').replaceAll('"','""')}"`;
    const csv=[columns,...filtered.map(visibleCells)].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`foodrescue-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <><ScreenHeading eyebrow={eyebrow} title={title} description={description}/><div className="data-toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search this page"/></div><select className="range-select" value={status} onChange={e=>setStatus(e.target.value)}><option>All statuses</option><option>Needs review</option><option>Active</option><option>Completed</option><option>Open</option><option>Upcoming</option></select><button className="btn btn-outline" onClick={exportCsv}>↓ Export</button></div><div className="data-table-wrap">{filtered.length?<table className="data-table"><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}<th>Action</th></tr></thead><tbody>{filtered.map((row,i)=>{const label=typeof actionLabel==='function'?actionLabel(row):actionLabel;return <tr key={String(row[columns.length]??`${row[0]??'row'}-${i}`)}>{visibleCells(row).map((cell,j)=><td key={j}>{cell}</td>)}<td><div className="table-actions"><button className="table-action" disabled={label==='Approved'||label==='Completed'||label==='Suspended'} onClick={()=>onAction?.(row)}>{label} {label==='Approved'||label==='Completed'||label==='Suspended'?'✓':'→'}</button>{onSecondaryAction&&<button className="table-action table-action-secondary" onClick={()=>onSecondaryAction(row)}>{secondaryActionLabel}</button>}</div></td></tr>})}</tbody></table>:<div className="empty-state"><span>🌱</span><strong>{query||status!=='All statuses'?'No matching records':emptyLabel}</strong><p>New activity will appear here when it’s available.</p></div>}</div></>;
}

export function AdminRecordPage({ kind, record, onBack, onAction, documents=[], onGetDocumentUrl }) {
  const [note,setNote]=useState('');
  const [status,setStatus]=useState('');
  const [preview,setPreview]=useState(false);
  const [documentUrls,setDocumentUrls]=useState({});
  const [documentBusy,setDocumentBusy]=useState('');
  const [documentError,setDocumentError]=useState('');
  const [actionBusy,setActionBusy]=useState(false);
  const [memberRole,setMemberRole]=useState(String(record?.[1]||'Recipient').replace(/^./,c=>c.toUpperCase()));
  useEffect(()=>setMemberRole(String(record?.[1]||'Recipient').replace(/^./,c=>c.toUpperCase())),[record?.[5],record?.[1]]);
  useEffect(()=>{setDocumentUrls({});setDocumentError('');setDocumentBusy('')},[record?.[5]]);
  const prepareDocumentUrl=async(doc)=>{
    if(documentBusy)return;setDocumentBusy(doc.id);setDocumentError('');
    try{const url=await onGetDocumentUrl?.(doc.storage_path);if(!url)throw new Error('No secure document link was returned.');setDocumentUrls(current=>({...current,[doc.id]:url}));}
    catch(error){setDocumentError(error?.message||'Could not create a secure document link.');}
    finally{setDocumentBusy('')}
  };
  const config={
    organization:{eyebrow:'PARTNER VERIFICATION',title:'Review organization',label:'Organization',fields:[['Organization type',record?.[1]||'NGO'],['Submitted',record?.[2]||'Date unavailable'],['Documents',record?.[3]||'0 files'],['Verification status',record?.[4]||'Needs review']],description:'Review the organization profile and submitted documents before changing verification status.',primary:'Approve organization',secondary:'Request more information',danger:'Decline request'},
    listing:{eyebrow:'TRUST & SAFETY',title:'Review listing',label:'Food listing',fields:[['Donor',record?.[1]||'Community donor'],['Category',record?.[2]||'Meals'],['Pickup deadline',record?.[3]||'Deadline unavailable'],['Listing status',record?.[4]||'Available']],description:'Check that the listing is clear, time-sensitive details are present, and the food information is appropriate.',primary:'Approve listing',secondary:'Request an edit',danger:'Hide listing'},
    report:{eyebrow:'COMMUNITY SAFETY',title:'Review community report',label:'Report',fields:[['Target',record?.[1]||'Food listing'],['Reason',record?.[2]||'No reason provided'],['Submitted',record?.[3]||'Date unavailable'],['Report status',record?.[4]||'Open']],description:'Review the report details, inspect the related record, and record the moderation outcome.',primary:'Mark resolved',secondary:'Escalate for review',danger:'Dismiss report'},
    user:{eyebrow:'PLATFORM ADMIN',title:'Member profile',label:'Community member',fields:[['Role',record?.[1]||'Recipient'],['Organization',record?.[2]||'No organization profile'],['Joined',record?.[3]||'Date unavailable'],['Account status',record?.[4]||'Active']],description:'Review account details, verification state, and recent community activity.',primary:'Save member changes',secondary:'',danger:record?.[4] === 'suspended' ? 'Restore account' : 'Suspend account'},
    audit:{eyebrow:'PLATFORM AUDIT',title:'Audit event details',label:'Recorded action',fields:[['Actor',record?.[1]||'Platform member'],['Record reference',record?.[2]||'Record unavailable'],['Timestamp',record?.[3]||'Date unavailable'],['Outcome',record?.[4]||'Recorded']],description:'This read-only event records an action taken on the platform.',primary:'Export event',secondary:'Copy record reference',danger:''},
  }[kind];
  if(!config)return null;
  const act=async(name)=>{if(actionBusy)return;if(kind==='audit'&&name==='Export event'){const blob=new Blob([JSON.stringify({event:record},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='foodrescue-audit-event.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Audit event downloaded as JSON.');return}if(kind==='audit'&&name==='Copy record reference'){try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable');await navigator.clipboard.writeText(record?.[2]||'');setStatus('Record reference copied.')}catch{setStatus('Clipboard permission was unavailable. Copy the reference from the details.')}return}setActionBusy(true);try{const result=await onAction?.(kind,name,record,memberRole,note);if(result!==false)setStatus(`${name} saved.`);}catch(error){setDocumentError(error?.message||`Could not complete ${name.toLowerCase()}.`)}finally{setActionBusy(false)}};
  return <>
    <ScreenHeading eyebrow={config.eyebrow} title={config.title} description={config.description} action={<button className="btn btn-outline" onClick={onBack}>← Back to list</button>}/>
    <div className={`record-detail-layout record-kind-${kind}`}>
      <div className="record-main-column">
        <section className="record-card">
          <div className="record-card-heading"><span className="record-symbol">{kind==='organization'?'♧':kind==='listing'?'▧':kind==='report'?'⚑':kind==='user'?'◉':'◷'}</span><div><span className="section-kicker">{config.label}</span><h2>{record?.[0]||'FoodRescue community record'}</h2></div><span className={`status-pill ${kind==='report'?'status-amber':'status-green'}`}><i/>{kind==='report'?'Needs attention':record?.[4]||'Needs review'}</span></div>
          
          
          
          
          <div className="record-fields">{config.fields.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
          {kind==='organization'&&<section className="review-documents"><div className="record-subhead"><div><span className="section-kicker">PRIVATE STORAGE</span><h3>Verification documents</h3></div><span className="status-pill status-muted"><i/>{documents.length} files</span></div>{documentError&&<p className="form-note" role="alert">{documentError}</p>}{documents.length?documents.map(doc=><div className="review-document" key={doc.id}><span><strong>{doc.document_type==='application/pdf'?'PDF document':'Image document'}</strong><small>Uploaded {doc.created_at?new Date(doc.created_at).toLocaleString():'date unavailable'}</small></span><div>{documentUrls[doc.id]?<a className="btn btn-outline" href={documentUrls[doc.id]} target="_blank" rel="noreferrer">Open secure link ↗</a>:<button className="btn btn-outline" disabled={Boolean(documentBusy)} onClick={()=>prepareDocumentUrl(doc)}>{documentBusy===doc.id?'Preparing…':'Prepare 5-minute link'}</button>}</div></div>):<p className="small-muted">No private verification documents have been uploaded for this organization.</p>}<small>Links are generated on demand, expire after five minutes, and are only available to the organization owner or platform admin.</small></section>}
          {kind==='user'&&<div className="member-activity"><label className="member-role-field">Account role<select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option>Recipient</option><option>Donor</option><option>Volunteer</option></select></label><small>Admin role cannot be assigned from this screen.</small></div>}
          {kind==='audit'&&<div className="audit-payload"><div className="record-subhead"><div><span className="section-kicker">EVENT PAYLOAD</span><h3>Recorded metadata</h3></div><span className="status-pill status-green"><i/>Read only</span></div><pre>{JSON.stringify({action:record?.[0]||null,actor:record?.[1]||null,entity_id:record?.[2]||null,created_at:record?.[3]||null,result:record?.[4]||null},null,2)}</pre></div>}
          {kind!=='audit'&&<section className="review-note-section"><label>Internal review note<textarea rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Add context for the moderation history…"/></label><small>Notes are for platform staff and aren’t shown publicly.</small></section>}
        </section>
        {kind!=='audit'&&<section className="review-timeline"><span className="section-kicker">REVIEW HISTORY</span><p>Moderation actions are recorded in the platform audit log.</p></section>}
      </div>
      <aside className="review-actions"><span className="section-kicker">{kind==='audit'?'EVENT ACTIONS':'REVIEW OUTCOME'}</span><h3>{kind==='audit'?'Record tools':'Make a decision'}</h3><p>{kind==='audit'?'This immutable event is available for audit and download.':'Review the information above, then record a clear outcome for this case.'}</p>{status&&<div className="review-feedback">✓ <span>{status}</span></div>}{documentError&&<div className="form-note" role="alert">{documentError}</div>}{config.primary&&<button className="btn btn-primary" disabled={actionBusy} onClick={()=>act(config.primary)}>{config.primary} <span>→</span></button>}{config.secondary&&<button className="btn btn-outline" disabled={actionBusy} onClick={()=>act(config.secondary)}>{config.secondary}</button>}{config.danger&&<button className="btn btn-danger" disabled={actionBusy} onClick={()=>act(config.danger)}>{config.danger}</button>}<div className="review-aside-note"><span>♧</span><span><strong>Thoughtful reviews build trust</strong><small>{kind==='organization'?'Only verified partners can receive donated food.':kind==='listing'?'Donors are responsible for accurate food and allergen information.':kind==='report'?'Keep a clear record of how community concerns are handled.':kind==='user'?'Account access changes should follow platform policy.':'Audit entries are read-only and time-stamped.'}</small></span></div></aside>
    </div>
  </>;
}

export function NotificationsPage({items:externalItems=[],onMarkAllRead}) {
  const [items,setItems]=useState(externalItems.map(n=>({id:n.id,title:n.title,time:n.created_at?new Date(n.created_at).toLocaleString():'Recent',read:Boolean(n.read_at),type:n.type||'•'})));
  useEffect(()=>{setItems(externalItems.map(n=>({id:n.id,title:n.title,time:n.created_at?new Date(n.created_at).toLocaleString():'Recent',read:Boolean(n.read_at),type:n.type||'•'})))},[externalItems]);
  const [marking,setMarking]=useState(false);
  const markAll=async()=>{
    if(marking)return;
    setMarking(true);
    try {
      const result=await onMarkAllRead?.();
      if(result!==false)setItems(current=>current.map(item=>({...item,read:true})));
    } finally { setMarking(false); }
  };
  return <><ScreenHeading eyebrow="STAY IN THE LOOP" title="Notifications" description="Updates about new food, claims, pickups and your community." action={<button className="btn btn-outline" onClick={markAll} disabled={marking||!items.some(n=>!n.read)}>{marking?'Saving…':'Mark all as read'}</button>}/><div className="notification-list">{items.length ? items.map(n=><article className={`notification-row ${n.read?'read':''}`} key={n.id}><span className="activity-icon">{n.type}</span><div><strong>{n.title}</strong><p>{n.time}</p></div>{!n.read&&<span className="notification-unread"/>}</article>) : <div className="empty-state"><strong>You’re all caught up</strong><p>Food claims, pickup updates and account notifications will appear here.</p></div>}</div></>;
}

export function QRVerificationPage({ onComplete }) {
  const [code,setCode]=useState('');
  const [message,setMessage]=useState('');
  const [verified,setVerified]=useState(false);
  const [scanning,setScanning]=useState(false);
  const [verifying,setVerifying]=useState(false);
  const busyRef=useRef(false);
  const verifiedRef=useRef(false);
  const mountedRef=useRef(true);
  const videoRef=useRef(null);
  const controlsRef=useRef(null);
  const stopScanner=()=>{try{controlsRef.current?.stop()}catch{}controlsRef.current=null;if(mountedRef.current)setScanning(false)};
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;try{controlsRef.current?.stop()}catch{}controlsRef.current=null}},[]);
  const finish=async(value,kind)=>{
    if(busyRef.current||verifiedRef.current)return;
    busyRef.current=true;
    if(mountedRef.current){setVerifying(true);setMessage('Checking pickup code…')}
    try{
      const result=await onComplete?.(value,kind);
      const ok=Boolean(result?.ok);
      if(ok)verifiedRef.current=true;
      if(mountedRef.current){setVerified(ok);setMessage(result?.message||(ok?'Pickup verified.':'Pickup code could not be verified.'))}
      if(ok)stopScanner();
    }catch(error){if(mountedRef.current){setVerified(false);setMessage(error?.message||'Pickup code could not be verified.')}}
    finally{busyRef.current=false;if(mountedRef.current)setVerifying(false)}
  };
  const startScanner=async()=>{
    if(scanning||verifying||verifiedRef.current)return;
    setMessage('');setScanning(true);
    try{
      // Pickup passes contain QR codes only. A multi-format reader tries many
      // barcode families on every camera frame and emits noisy NotFoundException
      // traces when no code is visible; the QR-only reader treats that as normal.
      const {BrowserQRCodeReader}=await import('@zxing/browser');
      if(!mountedRef.current)return;
      const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:250,delayBetweenScanSuccess:250});
      const controls=await reader.decodeFromVideoDevice(undefined,videoRef.current,(result,error,callbackControls)=>{
        if(result&&!busyRef.current&&!verifiedRef.current){
          controlsRef.current=callbackControls;
          void finish(result.getText(),'qr');
          try{callbackControls.stop()}catch{}
          if(mountedRef.current)setScanning(false);
          return;
        }
        // A frame without a QR code is expected during live scanning. ZXing's
        // NotFound/Checksum/Format exceptions are retry signals, not user errors.
        const errorName=error?.constructor?.name||error?.name||'';
        if(error && !/(NotFoundException|ChecksumException|FormatException)/.test(errorName)){
          try{callbackControls?.stop()}catch{}
          controlsRef.current=null;
          if(mountedRef.current){
            setScanning(false);
            setMessage('The camera scanner encountered an error. Try again or enter the one-time pickup code.');
          }
        }
      });
      if(!mountedRef.current){try{controls?.stop()}catch{};return;}
      controlsRef.current=controls;
    }catch{if(mountedRef.current){setScanning(false);setMessage('Camera unavailable. Allow camera access or enter the pickup code below.')}}
  };
  return <><ScreenHeading eyebrow="SAFE, SIMPLE HANDOVERS" title="Verify a pickup" description="Scan the claimant’s one-time QR code, or enter their fallback code to complete the handover."/><div className="qr-layout"><div className="qr-card"><div className="scanner-frame"><video ref={videoRef} className={`qr-video ${scanning?'is-scanning':''}`} muted playsInline/><span className="scan-corner tl"/><span className="scan-corner tr"/><span className="scan-corner bl"/><span className="scan-corner br"/>{!scanning&&<div className="qr-illustration">{Array.from({length:81},(_,i)=><i key={i} className={(i*13+i%3)%7<3?'dark':''}/>)}</div>}{scanning&&<span className="scan-line"/>}</div><strong>{scanning?'Camera is ready — hold the QR in frame':'Scan the claimant’s pickup QR'}</strong><p>Codes are checked against active Supabase claims and can only be used once.</p><button className="btn btn-outline" onClick={scanning?stopScanner:startScanner} disabled={verifying}>{scanning?'Stop camera':'Start camera scanner'} <span>{scanning?'×':'⌖'}</span></button><label>Or enter the one-time fallback code<input value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. 482915" inputMode="numeric"/></label><button className="btn btn-primary btn-large" disabled={verified||verifying||code.trim().length<4} onClick={()=>finish(code.trim(),'code')}>{verified?'Pickup verified ✓':verifying?'Verifying…':'Verify pickup'} <span>→</span></button>{message&&<div className={verified?'verify-success':'form-note'}>{verified?'✓ ':''}{message}</div>}</div><aside className="guidelines-card"><span className="section-kicker">BEFORE YOU VERIFY</span><h3>Make every handover count.</h3><div className="guideline"><span>1</span>Confirm the food matches the claim.</div><div className="guideline"><span>2</span>Ask the claimant to show their pickup code.</div><div className="guideline"><span>3</span>Verify once and hand over the food.</div><div className="form-note">Verification is performed by the secure Supabase RPC and the pickup token/code can only be used once.</div></aside></div></>;
}

export function PickupPassPage({ food, onBack }) {
  const [qr,setQr]=useState('');
  const [qrError,setQrError]=useState('');
  useEffect(()=>{let active=true;setQr('');setQrError('');if(food?.pickupToken)QRCode.toDataURL(food.pickupToken,{width:260,margin:1,color:{dark:'#10241b',light:'#ffffff'}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setQrError('The pickup QR could not be generated. Use the one-time numeric code instead.');});else setQrError('The approved pickup token was not returned by the server. Refresh claims or contact support.');return()=>{active=false};},[food?.pickupToken]);
  if(!food)return <><ScreenHeading eyebrow="YOUR PICKUP" title="No active pickup pass" description="Claim a food listing to create a one-time pickup QR code." action={<button className="btn btn-outline" onClick={onBack}>Browse claims</button>}/></>;
  return <><ScreenHeading eyebrow="YOUR CONFIRMED PICKUP" title="Pickup pass" description="Show this QR code or your fallback code to the donor at handover." action={<button className="btn btn-outline" onClick={onBack}>← My claims</button>}/><section className="pickup-pass-card"><div className="pickup-pass-food"><img src={food.image} alt=""/><span><small>FOOD LISTING</small><h2>{food.title}</h2><p>{food.donor} · {food.qty}</p><p>{food.area} · {food.time}</p><span className="status-pill status-green"><i/>{food.pickupStatus||'Confirmed'}</span></span></div><div className="pickup-pass-code">{qr?<img src={qr} alt="One-time pickup QR code"/>:<div className="pass-loading" role={qrError?'alert':'status'}>{qrError||'Preparing secure pickup QR…'}</div>}<small>ONE-TIME PICKUP CODE</small><strong>{food.pickupCode||'Unavailable'}</strong><p>Ask the donor to scan this code or enter it on the pickup verification page.</p></div><p className="privacy-note">Keep this code private until you meet the donor. It becomes invalid after verification.</p></section></>;
}

export function FoodDetailPage({ food, onClaim, claimed }) {
  return <><ScreenHeading eyebrow="FRESH FROM A NEIGHBORING KITCHEN" title="Food details" description="Everything you need to know before you claim this listing."/><div className="full-detail"><img src={food.image} alt={food.title}/><div className="full-detail-body"><span className="status-pill status-green"><i/>{food.badge}</span><h2>{food.title}</h2><p>Shared with care by <strong>{food.donor}</strong></p><div className="detail-facts"><span>🍽 <strong>{food.qty}</strong></span><span>⌖ <strong>{food.distance === 'Distance unavailable' ? 'Distance not available' : `${food.distance} away`}</strong></span><span>◷ <strong>{food.time}</strong></span><span>♧ <strong>{food.category}</strong></span></div><div className="area-note"><span>⌖</span><span><strong>{food.area}</strong><small>Approximate pickup area. Exact details are shared with the confirmed claimant.</small></span></div><h3>Food & storage notes</h3><p>{food.raw?.description || 'No additional description was provided.'}</p><p><strong>Allergens:</strong> {food.raw?.allergens || 'Not provided by the donor.'}</p><p><strong>Storage and handling:</strong> {food.raw?.storage_notes || 'No storage instructions were provided.'}</p><button className="btn btn-primary btn-large" onClick={onClaim}>{claimed?'Already claimed':'Claim this food'} <span>↗</span></button><p className="privacy-note">Claiming is a request. Your pickup is confirmed by the donor.</p></div></div></>;
}

export function ProfileSettingsPage({ flash, profile={}, organization=null, documents=[], onSave, onUploadDocument }) {
  const [name,setName]=useState(profile?.full_name||'');
  const [phone,setPhone]=useState(profile?.phone||'');
  const [neighborhood,setNeighborhood]=useState(profile?.neighborhood||'');
  const [organizationName,setOrganizationName]=useState(organization?.name||'');
  const [organizationType,setOrganizationType]=useState(organization?.organization_type||(profile?.role==='donor'?'Business':'Community organization'));
  const [contactPerson,setContactPerson]=useState(organization?.contact_person||profile?.full_name||'');
  const [about,setAbout]=useState(organization?.about||'');
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [uploading,setUploading]=useState(false);
  useEffect(()=>{
    setName(profile?.full_name||'');setPhone(profile?.phone||'');setNeighborhood(profile?.neighborhood||'');
  },[profile?.id,profile?.full_name,profile?.phone,profile?.neighborhood]);
  useEffect(()=>{
    setOrganizationName(organization?.name||'');
    setOrganizationType(organization?.organization_type||(profile?.role==='donor'?'Business':'Community organization'));
    setContactPerson(organization?.contact_person||profile?.full_name||'');
    setAbout(organization?.about||'');
  },[organization?.id,organization?.name,organization?.organization_type,organization?.contact_person,organization?.about,profile?.full_name,profile?.role]);
  const isOrgRole=['donor','recipient'].includes(String(profile?.role||'').toLowerCase());
  const save=async()=>{
    setSaving(true);setSaveError('');
    try{
      const ok=await onSave?.({fullName:name.trim(),phone:phone.trim(),neighborhood:neighborhood.trim(),organizationName:organizationName.trim(),organizationType,contactPerson:contactPerson.trim(),about:about.trim()});
      if(ok!==false)flash?.('Profile updated.');
    }catch(error){setSaveError(error?.message||'Could not save profile.');}
    finally{setSaving(false)}
  };
  const upload=async(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    setUploading(true);setSaveError('');
    try{const ok=await onUploadDocument?.(file);if(ok)flash?.('Verification document uploaded.');}
    catch(error){setSaveError(error?.message||'Could not upload verification document.');}
    finally{setUploading(false);event.target.value='';}
  };
  return <><ScreenHeading eyebrow="YOUR ACCOUNT" title="Profile & verification" description="Manage your contact details, organization information, and verification status."/>
    {saveError&&<div className="form-note" role="alert">{saveError}</div>}
    <div className="profile-settings-layout"><section className="onboarding-profile"><h2>Profile details</h2><div className="profile-identity"><span className="avatar avatar-large">{(name||'U').slice(0,1).toUpperCase()}</span><span><strong>{name||'FoodRescue member'}</strong><small>{profile?.role ? `${profile.role} account` : 'Community account'}</small></span><span className={`status-pill ${profile?.status==='active'?'status-green':'status-amber'}`}><i/>{profile?.status||'active'}</span></div><div className="form-split"><label>Full name<input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label><label>Phone number<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" maxLength={30}/></label></div><label>Neighborhood<input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} placeholder="City and pickup area" maxLength={120}/></label><label>Email<input type="email" value={profile?.email||''} readOnly/></label>
      {isOrgRole&&<><div className="divider"/><h2>Organization details</h2><label>Organization name<input required value={organizationName} onChange={e=>setOrganizationName(e.target.value)} maxLength={150} placeholder="Registered or community name"/></label><label>Organization type<select value={organizationType} onChange={e=>setOrganizationType(e.target.value)}><option>Community organization</option><option>NGO</option><option>Shelter</option><option>Business</option><option>Restaurant</option><option>Bakery</option><option>Event organizer</option></select></label><label>Contact person<input value={contactPerson} onChange={e=>setContactPerson(e.target.value)} maxLength={120}/></label><label>About<textarea rows="3" value={about} onChange={e=>setAbout(e.target.value)} maxLength={1000} placeholder="Describe your organization and how food donations are used."/></label><div className="area-note"><span>✓</span><span><strong>Verification status: {organization?.verification_status||'Not submitted'}</strong><small>Publishing food or claiming it may require organization verification according to platform policy.</small></span></div></>}
      <button className="btn btn-primary" disabled={saving||!name.trim()||(isOrgRole&&!organizationName.trim())} onClick={save}>{saving?'Saving…':'Save profile'}</button>
    </section><aside className="guidelines-card"><span className="guideline-icon">✓</span><h3>Build community trust</h3><p>Verified organizations help donors share with confidence.</p><div className="verification-step done">✓ &nbsp; Account created</div><div className="verification-step done">✓ &nbsp; Contact details</div><div className={`verification-step ${organization?.verification_status==='verified'?'done':''}`}>{organization?.verification_status==='verified'?'✓':'3'} &nbsp; Verification {organization?.verification_status||'documents'}</div>
      {isOrgRole&&<><label className="btn btn-outline" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:uploading?'wait':'pointer'}}>{uploading?'Uploading…':'Upload documents'}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={uploading||!organization?.id} style={{display:'none'}} onChange={upload}/></label><small>{organization?.id?'PDF, PNG or JPEG up to 10 MB.':'Save your organization details before uploading documents.'}</small><div className="document-list">{documents.length?documents.map(doc=><div key={doc.id} className="verification-step"><span>{doc.document_type==='application/pdf'?'PDF':'Image'}</span><small>{new Date(doc.created_at).toLocaleDateString()}</small></div>):<small>No verification documents uploaded yet.</small>}</div></>}
      <small>Private documents are only visible to authorized platform admins and the organization owner.</small></aside></div></>;
}

export function InteractiveMapPage({ foods, onOpen, onBack }) {
  return <><ScreenHeading eyebrow="YOUR NEIGHBORHOOD" title="Food nearby" description="Browse the approximate pickup areas supplied by each listing." action={<button className="btn btn-outline" onClick={onBack}>☰ Browse list</button>}/><div className="map-workspace"><div className="map-canvas map-no-coordinates"><div className="map-no-coordinates-icon">⌖</div><h2>Area-based browsing</h2><p>Street-map coordinates and your live location are not configured for these listings. To avoid showing a misleading pin, use the actual pickup area entered by the donor.</p><p className="map-legend">Approximate pickup areas only · no street-level address displayed</p></div><div className="map-results"><div className="workspace-section-title"><div><span className="section-kicker">AVAILABLE LISTINGS</span><h2>{foods.length} listings</h2></div></div>{foods.slice(0,5).map(f=><button className="map-result" key={f.id} onClick={()=>onOpen(f)}><img src={f.image} alt=""/><span><strong>{f.title}</strong><small>{f.donor} · {f.distance}</small><small>{f.qty} · {f.area||'Pickup area not provided'}</small></span><span className="status-pill status-green">Available</span></button>)}</div></div></>;
}
