import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/theme.css';
import { App } from './app/App';
import { SessionProvider } from './app/session';
import { Home } from './app/pages/Home';
import { Login } from './app/pages/Login';
import { Profile } from './app/pages/Profile';
import { Agreement } from './app/pages/Agreement';
import { Compose } from './app/pages/Compose';
import { Sent } from './app/pages/Sent';
import { Inbox } from './app/pages/Inbox';
import { Moderation } from './app/pages/Moderation';
import { PublicPage } from './app/pages/PublicPage';
import { WishRequests } from './app/pages/WishRequests';
import { PublishWishRequest } from './app/pages/PublishWishRequest';
import { WishRequestDetail } from './app/pages/WishRequestDetail';
import { RespondToWishRequest } from './app/pages/RespondToWishRequest';
import { AudioFeedback } from './app/pages/AudioFeedback';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      { path: 'profile', element: <Profile /> },
      { path: 'agreement', element: <Agreement /> },
      { path: 'give', element: <Compose /> },
      { path: 'sent/:id', element: <Sent /> },
      { path: 'pouch', element: <Inbox /> },
      { path: 'moderation', element: <Moderation /> },
      { path: 'plaza', element: <WishRequests /> },
      { path: 'plaza/new', element: <PublishWishRequest /> },
      { path: 'plaza/:id', element: <WishRequestDetail /> },
      { path: 'plaza/:id/respond', element: <RespondToWishRequest /> },
      { path: 'blessings/:id/feedback', element: <AudioFeedback /> },
    ],
  },
  { path: '/p/:slug', element: <PublicPage /> },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('缺少 #root');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </React.StrictMode>,
);
