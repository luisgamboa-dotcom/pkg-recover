import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Purga sesiones del antiguo modo exploración (backdoor retirado): si algún
// navegador conserva esas claves, se eliminan al cargar para que nadie entre
// como admin sin cuenta.
try {
  localStorage.removeItem('rp-explore-session');
  localStorage.removeItem('rp-explore-role');
  localStorage.removeItem('rp-explore-db-v1');
  localStorage.removeItem('rp-demo-session');
  localStorage.removeItem('rp-demo-role');
  localStorage.removeItem('rp-demo-db-v1');
} catch {
  /* almacenamiento no disponible */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
