import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// CSS sırası önemli: önce temel iskelet, sonra tasarım token'ları.
// Premium bileşen katmanı App.tsx'in son import'undan gelir, en sonda kalır.
import './styles.css';
import './theme.css';
import { App } from './App';
import { installGlobalErrorLogging } from './lib/errorLogger';
import { I18nProvider } from './lib/i18n';

if (!localStorage.getItem('dilmac-spectral-v3')) {
  localStorage.setItem('dilmac-theme', 'dark');
  localStorage.setItem('dilmac-spectral-v3', '1');
}
installGlobalErrorLogging();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
