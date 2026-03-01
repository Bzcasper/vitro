// Blocks popups, redirects, and known ad domains from embed iframes.
// This runs at the app level to protect the TV browser experience.

const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
  'ads.yahoo.com',
  'amazon-adsystem.com',
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'adsterra.com',
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.com',
  'clickadu.com',
  'hilltopads.net',
  'richpush.co',
  'pushground.com',
  'evadav.com',
  'monetag.com',
  'a-ads.com',
  'ad-maven.com',
  'adcash.com',
  'admaven.com',
  'bidvertiser.com',
  'popunder.net',
  'popmyads.com',
  'revcontent.com',
  'mgid.com',
  'taboola.com',
  'outbrain.com',
  'zedo.com',
  'serving-sys.com',
  'betrad.com',
  'adsrvr.org',
  'adnxs.com',
  'rubiconproject.com',
  'pubmatic.com',
  'criteo.com',
  'casalemedia.com',
  'openx.net',
  'indexexchange.com',
  'lijit.com',
  'sovrn.com',
  'contextweb.com',
  'yieldmo.com',
  'sharethrough.com',
];

let initialized = false;

export function initAdBlocker(): void {
  if (initialized) return;
  initialized = true;

  // 1. Block window.open popups globally
  const originalOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
    // Allow our own cast/external links (user-initiated from our UI)
    const caller = new Error().stack || '';
    if (caller.includes('CastButton') || caller.includes('useCast')) {
      return originalOpen.call(window, url, target, features);
    }

    // Block everything else (ad popups from iframes)
    console.warn('[Vitro AdBlock] Blocked popup:', url);
    return null;
  };

  // 2. Block ad domain requests via Service Worker or fetch intercept
  if ('serviceWorker' in navigator) {
    // We can't easily intercept iframe sub-requests, but we can block
    // navigation-level redirects
  }

  // 3. Intercept and block beforeunload/unload hijacking (anti-redirect)
  window.addEventListener(
    'beforeunload',
    (e) => {
      // Only allow if user actually navigated via our UI
      const activeElement = document.activeElement;
      const isOurUI =
        activeElement?.closest('[data-vitro-nav]') ||
        activeElement?.closest('.tv-focusable') ||
        activeElement?.tagName === 'A';

      if (!isOurUI) {
        e.preventDefault();
        e.returnValue = '';
        console.warn('[Vitro AdBlock] Blocked page redirect attempt');
      }
    },
    { capture: true }
  );

  // 4. MutationObserver to kill injected ad elements in our DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        // Kill injected iframes (not our player iframe)
        if (node.tagName === 'IFRAME' && !node.closest('.aspect-video')) {
          const src = node.getAttribute('src') || '';
          if (isAdUrl(src)) {
            node.remove();
            console.warn('[Vitro AdBlock] Removed injected iframe:', src);
          }
        }

        // Kill overlay divs that cover the page (common ad trick)
        if (node.tagName === 'DIV') {
          const style = window.getComputedStyle(node);
          if (
            style.position === 'fixed' &&
            style.zIndex &&
            parseInt(style.zIndex) > 9000 &&
            !node.closest('#root')
          ) {
            node.remove();
            console.warn('[Vitro AdBlock] Removed overlay ad element');
          }
        }

        // Kill injected scripts from ad domains
        if (node.tagName === 'SCRIPT') {
          const src = (node as HTMLScriptElement).src || '';
          if (isAdUrl(src)) {
            node.remove();
            console.warn('[Vitro AdBlock] Removed ad script:', src);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // 5. Block click hijacking on the page body (ads that capture all clicks)
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement;

      // Allow clicks on our UI elements
      if (
        target.closest('#root') ||
        target.closest('iframe') ||
        target.closest('[data-vitro-nav]')
      ) {
        return;
      }

      // Block suspicious full-page click interceptors
      if (target === document.body || target === document.documentElement) {
        e.preventDefault();
        e.stopPropagation();
        console.warn('[Vitro AdBlock] Blocked body click hijack');
      }
    },
    { capture: true }
  );

  console.log('[Vitro AdBlock] Initialized — popups & ad domains blocked');
}

function isAdUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return AD_DOMAINS.some((domain) => lower.includes(domain));
}
