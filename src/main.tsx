import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Static Hosting API Router & HTML-to-JSON Shield for motafalsifa.vercel.app and custom domains
if (typeof window !== 'undefined') {
  const host = window.location.hostname;
  const isStaticHosting =
    host === 'motafalsifa.vercel.app' ||
    host === 'al-motafalsifa.firebaseapp.com' ||
    host.endsWith('.dpdns.org') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    host === 'localhost';

  if (isStaticHosting) {
    const origFetch = window.fetch.bind(window);
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const isApiCall = urlStr.startsWith('/api/') || urlStr.includes('//motafalsifa.vercel.app/api/') || urlStr.includes('//al-motafalsifa.firebaseapp.com/api/');

      if (isApiCall) {
        const cleanPath = urlStr.replace(/^https?:\/\/[^/]+/, '');

        if (cleanPath === '/api/platform-data' || cleanPath.startsWith('/api/platform-data?')) {
          return origFetch('/initial_platform_data.json', init);
        }

        if (cleanPath === '/api/courses' || cleanPath.startsWith('/api/courses?')) {
          const res = await origFetch('/initial_platform_data.json', init).catch(() => null);
          if (res && res.ok) {
            const data = await res.json().catch(() => ({}));
            return new Response(JSON.stringify({ success: true, courses: data.courses || [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        if (cleanPath === '/api/exams' || cleanPath.startsWith('/api/exams?')) {
          const res = await origFetch('/initial_platform_data.json', init).catch(() => null);
          if (res && res.ok) {
            const data = await res.json().catch(() => ({}));
            return new Response(JSON.stringify({ success: true, exams: data.exams || [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        if (cleanPath === '/api/settings' || cleanPath.startsWith('/api/settings?')) {
          const res = await origFetch('/initial_platform_data.json', init).catch(() => null);
          if (res && res.ok) {
            const data = await res.json().catch(() => ({}));
            return new Response(JSON.stringify({ success: true, settings: data.settings || {} }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        if (cleanPath === '/api/users' || cleanPath.startsWith('/api/users?')) {
          const res = await origFetch('/initial_platform_data.json', init).catch(() => null);
          if (res && res.ok) {
            const data = await res.json().catch(() => ({}));
            return new Response(JSON.stringify({ success: true, users: data.users || [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        if (cleanPath.includes('/enrollment-status')) {
          return new Response(JSON.stringify({
            success: true,
            isEnrolledInDb: false,
            authoritativePrice: 0,
            walletBalance: 0,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (cleanPath.includes('/video-auth')) {
          return new Response(JSON.stringify({
            status: 'allowed',
            secureToken: btoa('allowed_playback_token'),
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (cleanPath === '/api/auth/login') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication is handled by the backend server.',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (cleanPath.includes('/auth/check-session') || cleanPath.includes('/auth/register-session')) {
          return new Response(JSON.stringify({
            ok: true,
            active: true,
            success: true,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (cleanPath === '/api/github-hls/status') {
          return new Response(JSON.stringify({
            connected: true,
            configured: true,
            username: 'hos098sam-jpg',
            repo: 'x3bb48b-c76c300b',
            success: true,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (cleanPath.startsWith('/api/deleted-ids') || cleanPath.startsWith('/api/wallet/codes')) {
          return new Response(JSON.stringify({
            success: true,
            courses: [],
            users: [],
            videos: [],
            exams: [],
            codes: [],
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (init?.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(init.method.toUpperCase())) {
          return new Response(JSON.stringify({
            success: true,
            synced: true,
            message: 'Handled via Firestore client synchronization',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        try {
          const res = await origFetch(input, init);
          const cType = res.headers.get('content-type') || '';
          if (cType.includes('text/html')) {
            return new Response(JSON.stringify({
              error: 'Not found on static hosting',
              status: 404,
              ok: false,
            }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return res;
        } catch {
          return new Response(JSON.stringify({
            error: 'Network request intercepted on static hosting',
            status: 404,
            ok: false,
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return origFetch(input, init);
    };
  }
}

// Global monkey-patch for JSON.stringify to prevent circular structure crashes across any component or event
const nativeStringify = JSON.stringify;
JSON.stringify = function (value: any, replacer?: any, space?: any) {
  try {
    return nativeStringify.call(this, value, replacer, space);
  } catch (err: any) {
    if (err && String(err?.message || '').toLowerCase().includes('circular')) {
      const seen = new WeakSet();
      try {
        return nativeStringify.call(
          this,
          value,
          (key: string, val: any) => {
            if (typeof val === 'object' && val !== null) {
              if (
                (typeof Element !== 'undefined' && val instanceof Element) ||
                (typeof Node !== 'undefined' && val instanceof Node) ||
                (typeof Window !== 'undefined' && val instanceof Window) ||
                (typeof Document !== 'undefined' && val instanceof Document) ||
                (typeof Event !== 'undefined' && val instanceof Event) ||
                ('target' in val && 'nativeEvent' in val) ||
                ('stateNode' in val && 'return' in val) ||
                key.startsWith('__react') ||
                key.startsWith('_react') ||
                seen.has(val)
              ) {
                return undefined;
              }
              seen.add(val);
            }
            if (typeof replacer === 'function') {
              return replacer(key, val);
            }
            return val;
          },
          space
        );
      } catch {
        return 'null';
      }
    }
    throw err;
  }
} as typeof JSON.stringify;

// Guard HTMLVideoElement.prototype.requestPictureInPicture against calling before metadata loads
if (typeof window !== 'undefined' && typeof HTMLVideoElement !== 'undefined') {
  const originalRequestPiP = HTMLVideoElement.prototype.requestPictureInPicture;
  if (originalRequestPiP) {
    HTMLVideoElement.prototype.requestPictureInPicture = async function (this: HTMLVideoElement) {
      if (this.disablePictureInPicture || this.readyState < 1) {
        console.warn('requestPictureInPicture skipped: video metadata not loaded yet or PiP disabled.');
        return new Promise<PictureInPictureWindow>((_, reject) => {
          try {
            if (this.readyState >= 1 && !this.disablePictureInPicture) {
              originalRequestPiP.call(this).then(_).catch(reject);
            } else {
              const notReadyErr = new DOMException('Metadata for the video element are not loaded yet.', 'InvalidStateError');
              reject(notReadyErr);
            }
          } catch (syncErr) {
            reject(syncErr);
          }
        }).catch((err) => {
          console.warn('Handled PiP request promise rejection:', err?.message || err);
          return null as unknown as PictureInPictureWindow;
        });
      }
      try {
        return await originalRequestPiP.call(this);
      } catch (err: any) {
        console.warn('Handled PiP call failure:', err?.message || err);
        return null as unknown as PictureInPictureWindow;
      }
    };
  }

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    const isSyntheticEvent =
      reason instanceof Event ||
      (reason && typeof reason === 'object' && 'isTrusted' in reason && !('message' in reason));
    const isPiPMetadataError =
      msg.includes('Metadata for the video element are not loaded yet') ||
      msg.includes('requestPictureInPicture') ||
      reason?.name === 'InvalidStateError';
    const isCircularJsonError =
      msg.includes('Converting circular structure to JSON') ||
      msg.includes('circular structure') ||
      msg.includes('__reactFiber');
    const isJsonParseError =
      msg.includes('is not valid JSON') ||
      msg.includes('Unexpected token') ||
      msg.includes('SyntaxError: JSON.parse');

    if (isSyntheticEvent || isPiPMetadataError || isCircularJsonError || isJsonParseError) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Handled rejection gracefully:', msg);
    }
  });

  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      const isCircularJsonError =
        msg.includes('Converting circular structure to JSON') ||
        msg.includes('circular structure') ||
        msg.includes('__reactFiber');
      const isJsonParseError =
        msg.includes('is not valid JSON') ||
        msg.includes('Unexpected token') ||
        msg.includes('SyntaxError: JSON.parse');

      if (
        isCircularJsonError ||
        isJsonParseError ||
        msg.includes('Metadata for the video element are not loaded yet') ||
        msg.includes('requestPictureInPicture') ||
        (event.target &&
          (event.target instanceof HTMLMediaElement ||
            event.target instanceof HTMLImageElement ||
            event.target instanceof HTMLScriptElement))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('Handled uncaught error gracefully:', msg);
        return true;
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
