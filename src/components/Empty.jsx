import React from 'react';

export default function Empty({title,text,action}){return <div className="empty-state"><span>🌱</span><strong>{title}</strong><p>{text}</p><button className="btn btn-primary" onClick={action}>Find nearby food <span>→</span></button></div>}