import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './sw-registration.js' 
import App from './App.jsx'

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <BrowserRouter basename="/ig342Final-Project">
      <App />
    </BrowserRouter>
  </StrictMode>
);