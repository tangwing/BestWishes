import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { App } from './App';
import { Home } from './pages/Home';
import { Agreement } from './pages/Agreement';
import { Compose } from './pages/Compose';
import { Sent } from './pages/Sent';
import { MyBlessings } from './pages/MyBlessings';
import { Profile } from './pages/Profile';
import { Streak } from './pages/Streak';
import { Moderation } from './pages/Moderation';
import { PublicPage } from './pages/PublicPage';

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'agreement', element: <Agreement /> },
      { path: 'compose', element: <Compose /> },
      { path: 'sent/:id', element: <Sent /> },
      { path: 'mine', element: <MyBlessings /> },
      { path: 'profile', element: <Profile /> },
      { path: 'streak', element: <Streak /> },
      { path: 'moderation', element: <Moderation /> },
    ],
  },
  { path: '/p/:slug', element: <PublicPage /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
