import React, { useEffect, useMemo, useState } from 'react';
import { ScreenHeading } from '../../components/WorkspaceComponents.jsx';

const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export default function DonationDetailsPage({ app }) {
  const recordId = decodeURIComponent(app.location.pathname.split('/').filter(Boolean).at(-1) || '');
  const food = useMemo(() => {
    const found = (app.backendMyFood || []).find(item => String(item.id) === recordId);
    if (found) return found;
    return app.selected && String(app.selected.id) === recordId ? app.selected : null;
  }, [app.backendMyFood, app.selected, recordId]);
  const raw = food?.raw || food || {};
  const [form, setForm] = useState({title:'',description:'',category:'Meals',quantity:'',unit:'Portions',pickupDeadline:'',allergens:'',storageNotes:'',pickupArea:'',imageUrl:''});
  const [saving,setSaving] = useState(false);
  const [localError,setLocalError] = useState('');
  useEffect(() => {
    if (!food) return;
    setForm({
      title: raw.title || food.title || '', description: raw.description || '',
      category: raw.category || food.category || 'Meals', quantity: String(raw.quantity ?? (String(food.qty||'').match(/^([0-9.]+)/)?.[1] || '')),
      unit: raw.unit || String(food.qty||'').replace(/^[0-9.]+\s*/,'') || 'Portions',
      pickupDeadline: localDateTime(raw.pickup_deadline), allergens: raw.allergens || '',
      storageNotes: raw.storage_notes || '', pickupArea: raw.pickup_area || food.area || '',
      imageUrl: raw.image_url || ''
    });
    setLocalError('');
  }, [food?.id, raw.updated_at]);

  if (!recordId || !/^[0-9a-f-]{36}$/i.test(recordId) || !food) {
    return <><ScreenHeading eyebrow="DONOR WORKSPACE" title="Listing not found" description={app.backendLoading ? 'Loading your food listings…' : 'This listing is not in your account, no longer available, or could not be loaded.'}/><button className="btn btn-outline" onClick={()=>app.navigate('My listings')}>← My listings</button></>;
  }

  const status = String(raw.status || food.status || '').toLowerCase();
  const editable = ['available','draft'].includes(status);
  const change = (key,value) => setForm(current=>({...current,[key]:value}));
  const submit = async (event) => {
    event.preventDefault();
    setLocalError('');
    if (!form.title.trim() || Number(form.quantity)<=0 || !form.pickupArea.trim() || !form.pickupDeadline) {
      setLocalError('Title, positive quantity, pickup area and pickup deadline are required.'); return;
    }
    setSaving(true);
    try {
      const ok = await app.updateFoodListing(recordId, form);
      if (!ok) setLocalError('The listing was not updated. Check the error notification and try again.');
    } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!window.confirm('Remove this listing? This cannot be undone.')) return;
    setLocalError(''); setSaving(true);
    try { const ok = await app.deleteFoodListing(recordId); if (!ok) setLocalError('This listing could not be removed.'); }
    finally { setSaving(false); }
  };

  return <><ScreenHeading eyebrow="DONOR WORKSPACE" title={form.title || 'Manage listing'} description="Update the details that recipients use to assess and collect your surplus food." action={<button className="btn btn-outline" onClick={()=>app.navigate('My listings')}>← Your listings</button>}/>
    <div className="onboarding-profile donor-listing-editor">
      <div className="area-note"><span>✓</span><span><strong>Status: {status || 'unknown'}</strong><small>{editable ? 'This listing can be edited or removed while it remains available or draft.' : 'This listing is locked because its pickup workflow has started or closed.'}</small></span></div>
      {localError && <div className="form-note" role="alert">{localError}</div>}
      <form className="modal-form" onSubmit={submit}>
        <label>Listing title<input required maxLength={70} value={form.title} onChange={e=>change('title',e.target.value)} disabled={!editable||saving}/></label>
        <label>Description<textarea rows="3" maxLength={2000} value={form.description} onChange={e=>change('description',e.target.value)} disabled={!editable||saving}/></label>
        <div className="form-split"><label>Category<select value={form.category} onChange={e=>change('category',e.target.value)} disabled={!editable||saving}><option>Meals</option><option>Bakery</option><option>Produce</option><option>Packaged</option></select></label><label>Quantity<input required type="number" min="0.1" step="any" value={form.quantity} onChange={e=>change('quantity',e.target.value)} disabled={!editable||saving}/></label></div>
        <div className="form-split"><label>Unit<input required maxLength={40} value={form.unit} onChange={e=>change('unit',e.target.value)} disabled={!editable||saving}/></label><label>Pickup deadline<input required type="datetime-local" value={form.pickupDeadline} onChange={e=>change('pickupDeadline',e.target.value)} disabled={!editable||saving}/></label></div>
        <label>Approximate pickup area<input required maxLength={160} value={form.pickupArea} onChange={e=>change('pickupArea',e.target.value)} disabled={!editable||saving}/></label>
        <label>Allergens<input maxLength={1000} value={form.allergens} onChange={e=>change('allergens',e.target.value)} placeholder="Use ‘Not provided’ if unknown" disabled={!editable||saving}/></label>
        <label>Storage and handling notes<textarea rows="2" maxLength={1000} value={form.storageNotes} onChange={e=>change('storageNotes',e.target.value)} disabled={!editable||saving}/></label>
        <label>Image URL (optional)<input type="url" value={form.imageUrl} onChange={e=>change('imageUrl',e.target.value)} placeholder="https://…" disabled={!editable||saving}/></label>
        {editable && <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Saving…':'Save changes'}</button><button className="btn btn-danger" type="button" onClick={remove} disabled={saving}>Remove listing</button></div>}
      </form>
    </div>
  </>;
}
