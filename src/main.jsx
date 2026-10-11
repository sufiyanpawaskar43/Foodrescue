import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(<ErrorBoundary onHome={() => window.location.assign('/')}><React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode></ErrorBoundary>);
