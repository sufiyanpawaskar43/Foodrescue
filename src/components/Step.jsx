import React from 'react';

export default function Step({number,icon,title,text}){return <div className="step"><div className="step-mark"><span>{icon}</span><small>{number}</small></div><div><h3>{title}</h3><p>{text}</p></div></div>}