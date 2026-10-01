import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type Platform = 'ios' | 'android' | 'other';

const BYPASS_KEY = 'kickoff.webBypass';

@Injectable({ providedIn: 'root' })
export class Install {
  readonly platform = detectPlatform();

  /** True when a phone opens the app in a browser tab instead of from the home screen. */
  readonly needsInstall =
    environment.showInstallGuide && this.platform !== 'other' && !isStandalone() && !hasBypass();
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS reports itself as a Mac; the touchscreen gives it away.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** Hidden escape hatch: ?webb=1 skips the gate, and is remembered on the phone. */
function hasBypass(): boolean {
  const url = new URL(location.href);
  if (url.searchParams.get('webb') === '1') {
    try {
      localStorage.setItem(BYPASS_KEY, '1');
    } catch {
      // Storage blocked: the bypass still works for this visit.
    }
    url.searchParams.delete('webb');
    history.replaceState(history.state, '', url);
    return true;
  }
  try {
    return localStorage.getItem(BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}