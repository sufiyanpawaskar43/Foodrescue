import React from 'react';
import PageHeading from '../../components/PageHeading.jsx';
import Empty from '../../components/Empty.jsx';

export default function MypickupsPage({ app }) {
  const items=(app.claims||[]).filter(item=>['approved','picked_up'].includes(String(item.status||'').toLowerCase()));
  return <><PageHeading kicker="YOUR PICKUP JOURNEY" title="My pickups" text="Confirmed handovers and the pickups you have completed."/>
    {items.length ? <div className="list-stack">{items.map(item=><div className="claim-row" key={item.claimId}>
      <div className="pickup-check">{item.status==='picked_up'?'✓':'⌖'}</div>
      <div className="claim-main"><span className={`status-pill ${item.status==='picked_up'?'status-muted':'status-green'}`}><i/>{item.status==='picked_up'?'Picked up':'Pickup approved'}</span><h3>{item.title}</h3><p>{item.donor} · {item.qty}</p></div>
      <div className="claim-meta"><strong>{item.time}</strong><span>{item.area||'Area shared after confirmation'}</span></div>
      {item.status==='approved' ? <button className="btn btn-outline" onClick={()=>app.openPickupPass(item)}>Pickup pass <span>→</span></button> : <span className="small-muted">Completed</span>}
    </div>)}</div> : <Empty title="No confirmed pickups yet." text="Once a donor approves a claim, your pickup details will be available here." action={()=>app.navigate('My claims')}/>}
  </>;
}
