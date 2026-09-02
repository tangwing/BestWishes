import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('缺少 #root');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
