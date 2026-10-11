import React from 'react';
export default function Brand({ light = false }) { return <button className={`brand ${light ? 'brand-light' : ''}`} onClick={() => window.dispatchEvent(new Event('home'))}><span className="brand-mark">f</span><span>food<span className="brand-strong">rescue</span></span></button>; }
