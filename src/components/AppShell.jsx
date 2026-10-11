import React from 'react';
import { PageRouter } from '../PageRouter.jsx';
import Icon from './Icon.jsx';
import Brand from './Brand.jsx';

import FoodCard from './FoodCard.jsx';
import PageHeading from './PageHeading.jsx';
import Step from './Step.jsx';
import Empty from './Empty.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

export default function AppShell({ app }) {
  const { page, role, navForRole, mobileNav, setMobileNav, navigate, flash, modal, setModal, claims, selected, form, setForm, addListing, claimFood, roles, toast, setRole, logout, session, profile } = app;
  if (!app.authReady) return <div className="app-bootstrap-loading" role="status" aria-live="polite"><Brand/><div className="bootstrap-spinner"/><h1>Opening FoodRescue</h1><p>Restoring your secure session and loading the community workspace…</p></div>;
  return <div className="app-shell">
    <header className={`topbar ${['Sign in','Create account','Onboarding'].includes(page)?'app-topbar-auth':''}`}><div className="topbar-inner"><Brand /><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle menu">☰</button>
      <nav className={`top-links ${mobileNav ? 'show' : ''}`}><button className={page === 'Overview' ? 'top-active' : ''} onClick={() => navigate('Overview')}>How it works</button><button onClick={() => navigate('Impact')}>Our impact</button><button onClick={() => navigate('Overview')}>About us</button><button onClick={() => flash('Say hello at hello@foodrescue.org')}>Contact</button></nav>
      <div className="top-actions">
        <button className="role-pill" onClick={() => setModal('role')} aria-label="Open account menu">
          <span className="avatar">{role === 'Recipient' ? 'H' : role[0]}</span>
          <span>{role}</span>
          <span className="chevron">⌄</span>
        </button>
        {session?.access_token ? (
          <button
            className="btn btn-quiet top-dashboard"
            onClick={() => navigate(role === 'Admin' ? 'Admin dashboard' : role === 'Donor' ? 'Donor dashboard' : role === 'Volunteer' ? 'Volunteer dashboard' : 'Recipient dashboard')}
          >
            Dashboard
          </button>
        ) : (
          <>
            <button className="btn btn-quiet" onClick={() => navigate('Sign in')}>Log in</button>
            <button className="btn btn-primary top-join" onClick={() => navigate('Create account')}>Get started <span>↗</span></button>
          </>
        )}
      </div>
    </div></header>
    <div className={`app-body ${['Sign in','Create account','Onboarding'].includes(page)?'app-body-auth':''}`}><aside className={`sidebar ${mobileNav ? 'sidebar-show' : ''}`}><div className="sidebar-top"><div className="side-label">{role === 'Admin' ? 'PLATFORM' : 'YOUR SPACE'}</div>{navForRole(role).map(([name, icon]) => <button key={name} onClick={() => navigate(name)} className={`side-link ${page === name ? 'side-current' : ''}`}><Icon>{icon}</Icon>{name}{name === 'My claims' && claims.length > 0 && <span className="count-badge">{claims.length}</span>}</button>)}<div className="side-divider"/><div className="side-label">QUICK ACTIONS</div>{role === 'Donor' ? <button className="side-link" onClick={() => navigate('Post food')}><Icon>＋</Icon>Post surplus food</button> : role === 'Volunteer' ? <button className="side-link" onClick={() => navigate('Available pickups')}><Icon>⌕</Icon>Find a pickup</button> : role === 'Admin' ? <button className="side-link" onClick={() => navigate('Manage reports')}><Icon>⚑</Icon>Review reports</button> : <button className="side-link" onClick={() => navigate('Browse food')}><Icon>⌕</Icon>Find food</button>}</div>
      <div className="sidebar-bottom"><div className="impact-mini"><div className="impact-mini-icon">✳</div><strong>Small acts, big impact.</strong><span>Every rescued meal matters.</span><button onClick={() => navigate('Impact')}>See your impact <span>→</span></button></div><button className="profile-mini" onClick={() => setModal('role')}><span className="avatar avatar-large">H</span><span><strong>{profile?.full_name || (session ? role : 'FoodRescue member')}</strong><small>{session ? `${role} account` : 'Community member'}</small></span><span className="more">···</span></button></div></aside>
      <main className="main-content"><div className="content-wrap">
        {app.backendErrors?.length > 0 && <section className="backend-alert" role="status" aria-live="polite"><div><strong>Some live data could not be loaded.</strong><p>{app.backendErrors.slice(0,3).map((item)=>`${item.label}: ${item.message}`).join(' · ')}</p></div><button className="btn btn-outline" onClick={()=>app.loadBackendData()} disabled={app.backendLoading}>{app.backendLoading?'Retrying…':'Retry data load'}</button></section>}
        <ErrorBoundary onHome={()=>navigate('Overview')}><PageRouter page={page} app={app} /></ErrorBoundary>
      </div><footer className="page-footer"><span>© 2026 FoodRescue</span><span>Good food, shared with purpose.</span><button onClick={()=>flash('FoodRescue is built around community care.')}>Made for good things <span>✳</span></button></footer></main></div>
    {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('')}}><section className={`modal ${modal==='detail'?'detail-modal':''}`} role="dialog" aria-modal="true" aria-label={modal==='listing'?'Post surplus food':modal==='detail'?'Food listing details':'FoodRescue account'}><button className="modal-close" onClick={()=>setModal('')} aria-label="Close">×</button>
      {modal==='listing' && <><span className="section-kicker">MAKE GOOD GO FURTHER</span><h2>Share your surplus.</h2><p className="modal-intro">A few details help nearby organizations find the food they need.</p><form onSubmit={addListing} className="modal-form"><label>What are you sharing?<input required autoFocus placeholder="e.g. Fresh vegetable bowls" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-split"><label>Quantity<input required type="number" min="1" placeholder="e.g. 20" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/></label><label>Food type<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Meals</option><option>Bakery</option><option>Produce</option></select></label></div><label>Pickup area<input placeholder="Neighborhood or area" value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></label><label>Pickup by<input type="datetime-local" value={form.pickup} onChange={e=>setForm({...form,pickup:e.target.value})}/></label><div className="form-note">✳ Your listing will be visible to nearby community organizations.</div><button type="submit" className="btn btn-primary btn-large modal-submit">Publish listing <span>↗</span></button></form></>}
      {modal==='detail'&&selected&&<><img className="detail-image" src={selected.image} alt={selected.title}/><div className="detail-body"><span className="status-pill status-green"><i/>{selected.badge}</span><h2>{selected.title}</h2><p className="detail-donor">Shared with care by <strong>{selected.donor}</strong></p><div className="detail-facts"><span>🍽 <strong>{selected.qty}</strong></span><span>⌖ <strong>{selected.distance} away</strong></span><span>◷ <strong>{selected.time}</strong></span><span>♧ <strong>{selected.category}</strong></span></div><div className="area-note"><span>⌖</span><span><strong>{selected.area}</strong><small>Exact pickup details shared after confirmation</small></span></div><button className="btn btn-primary btn-large modal-submit" onClick={()=>claimFood(selected)}>{claims.some(c=>c.id===selected.id)?'Already claimed':'Claim this food'} <span>↗</span></button><p className="privacy-note">By claiming, you’re helping good food reach someone who needs it.</p></div></>}
      {modal==='role'&&<><span className="section-kicker">YOUR ACCOUNT</span><h2>{profile?.full_name || 'FoodRescue account'}</h2><p className="modal-intro">{session ? `Signed in as ${role}.` : 'Choose a community workspace.'}</p>{session ? <><div className="role-options"><button className="role-option role-chosen" onClick={()=>{setModal('');navigate(role==='Admin'?'Admin dashboard':role==='Donor'?'Donor dashboard':role==='Volunteer'?'Volunteer dashboard':'Recipient dashboard')}}><span className="role-emoji">✓</span><span><strong>{role}</strong><small>Open your workspace</small></span><span className="role-arrow">→</span></button></div><button className="btn btn-outline btn-large" style={{width:'100%',marginTop:12}} onClick={async()=>{setModal('');await logout?.()}}>Sign out</button></> : <div className="role-options">{roles.map(r=><button key={r.id} className={`role-option ${role===r.id?'role-chosen':''}`} onClick={()=>{setRole(r.id);setModal('');navigate(r.id==='Donor'?'Donor dashboard':r.id==='Volunteer'?'Volunteer dashboard':'Recipient dashboard')}}><span className="role-emoji">{r.emoji}</span><span><strong>{r.title}</strong><small>{r.sub}</small></span><span className="role-arrow">→</span></button>)}</div>}</>}
      {(modal==='signup'||modal==='signin')&&<><span className="section-kicker">WELCOME TO FOODRESCUE</span><h2>{modal==='signup'?'Make room for good.':'Welcome back.'}</h2><p className="modal-intro">{modal==='signup'?'Create your account and join the FoodRescue community.':'Sign in to your FoodRescue workspace.'}</p><div className="role-options"><button className="role-option role-chosen" onClick={()=>{setModal('');navigate(modal==='signup'?'Create account':'Sign in')}}><span className="role-emoji">↗</span><span><strong>{modal==='signup'?'Open secure account creation':'Open secure sign in'}</strong><small>Uses your connected Supabase authentication.</small></span><span className="role-arrow">→</span></button></div><p className="auth-switch">{modal==='signup'?'Already part of the community?':'New to FoodRescue?'} <button onClick={()=>setModal(modal==='signup'?'signin':'signup')}>{modal==='signup'?'Sign in':'Create account'}</button></p></>}
    </section></div>}
    {toast&&<div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}
