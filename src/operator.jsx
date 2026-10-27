import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OperatorInbox from './marketing/OperatorInbox.jsx';
import './styles/marketing.css';
createRoot(document.getElementById('root')).render(<StrictMode><OperatorInbox/></StrictMode>);
