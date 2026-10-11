import React from 'react';

export default function PageHeading({kicker,title,text,action}){return <div className="page-heading"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{text}</p></div>{action}</div>}