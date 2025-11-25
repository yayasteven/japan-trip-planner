import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // 引入 Tailwind CSS 基礎樣式

const container = document.getElementById('root');
const root = createRoot(container);

// 嚴格模式有助於偵測潛在問題
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
