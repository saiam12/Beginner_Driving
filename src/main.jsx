import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './ui-system.css';
import MainPage from './pages/MainPage';

createRoot(document.getElementById('root')).render(<MainPage />);
