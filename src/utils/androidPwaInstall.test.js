import { describe, it, expect } from 'vitest';
import { isAndroidChrome, isMobileViewport } from './androidPwaInstall.js';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

describe('isAndroidChrome', () => {
  it('accepts Chrome on Android', () => {
    expect(isAndroidChrome(ANDROID_CHROME)).toBe(true);
  });

  it('rejects iPhone Safari', () => {
    expect(
      isAndroidChrome(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe(false);
  });

  it('rejects desktop Chrome', () => {
    expect(
      isAndroidChrome(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });

  it('rejects Samsung Internet even when Chrome appears in the UA', () => {
    expect(
      isAndroidChrome(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(false);
  });
});

describe('isMobileViewport', () => {
  it('treats widths below xl as mobile', () => {
    expect(isMobileViewport(375)).toBe(true);
    expect(isMobileViewport(1199.98)).toBe(true);
    expect(isMobileViewport(1200)).toBe(false);
  });
});
