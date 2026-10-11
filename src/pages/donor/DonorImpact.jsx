import React from 'react';
import PageHeading from '../../components/PageHeading.jsx';
export default function DonorImpactPage({ app }) {
  const listings = app.backendMyFood || [];
  const quantities=new Map();
  listings.forEach(f=>{const amount=Number(f.raw?.quantity??f.quantity)||0;if(amount>0){const unit=String(f.raw?.unit||f.unit||'units');quantities.set(unit,(quantities.get(unit)||0)+amount)}});
  const quantitySummary=quantities.size===0?'0':quantities.size===1?`${Number([...quantities.values()][0].toFixed(2)).toLocaleString()} ${[...quantities.keys()][0].toLowerCase()}`:`${quantities.size} unit types`;
  const completed = (app.claims||[]).filter(c=>c.status==='picked_up').length;
  return <><PageHeading kicker="YOUR GOOD, IN NUMBERS" title="Donor impact" text="See the difference your surplus makes in the community."/><div className="impact-cards"><div><span>🍽</span><strong>{quantitySummary}</strong><small>quantity listed</small></div><div><span>♧</span><strong>{completed}</strong><small>pickups completed</small></div><div><span>♡</span><strong>{listings.length}</strong><small>food listings</small></div></div></>;
}
