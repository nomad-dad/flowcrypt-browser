/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Browser, EvaluateFunc, Page, Target } from 'puppeteer';
import { Util } from '../util';
import { ControllablePage } from './controllable';
import { Semaphore } from './browser-pool';
import { TIMEOUT_ELEMENT_APPEAR } from '.';
import { AvaContext } from '../tests/tooling';

export class BrowserHandle {
  public pages: ControllablePage[] = [];
  public browser: Browser;
  private semaphore: Semaphore;
  private viewport: { height: number; width: number };

  public constructor(browser: Browser, semaphore: Semaphore, height: number, width: number) {
    this.browser = browser;
    this.semaphore = semaphore;
    this.viewport = { height, width };
  }

  public newPage = async (
    t: AvaContext,
    url?: string,
    initialScript?: EvaluateFunc<unknown[]>,
    extraHeaders?: Record<string, string>
  ): Promise<ControllablePage> => {
    const page = await this.browser.newPage();
    if (extraHeaders !== undefined) {
      await page.setExtraHTTPHeaders(extraHeaders);
    }
    await page.setViewport(this.viewport);
    const controllablePage = new ControllablePage(t, page);
    if (url) {
      if (initialScript) {
        await page.evaluateOnNewDocument(initialScript);
      }
      await controllablePage.goto(url);
    }
    this.pages.push(controllablePage);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (url && url.includes(t.urls!.extensionId)) {
      await controllablePage.waitUntilViewLoaded();
    }
    return controllablePage;
  };

  public newExtensionPage = async (t: AvaContext, url: string): Promise<ControllablePage> => {
    return this.newPage(t, t.urls?.extension(url));
  };

  public newExtensionInboxPage = async (t: AvaContext, acctEmail: string, threadId?: string): Promise<ControllablePage> => {
    return this.newPage(t, t.urls?.extensionInbox(acctEmail, threadId));
  };

  public newExtensionSettingsPage = async (t: AvaContext, acctEmail?: string | undefined): Promise<ControllablePage> => {
    return this.newPage(t, t.urls?.extensionSettings(acctEmail));
  };

  public newMockGmailPage = async (t: AvaContext, extraHeaders?: Record<string, string>): Promise<ControllablePage> => {
    return this.newPage(t, t.urls?.mockGmailUrl(), undefined, extraHeaders);
  };

  public newPageTriggeredBy = async (t: AvaContext, triggeringAction: () => Promise<void>): Promise<ControllablePage> => {
    const page = (await this.doAwaitTriggeredPage(triggeringAction)) as Page;
    const url = page.url();
    const controllablePage = new ControllablePage(t, page);
    try {
      await page.setViewport(this.viewport);
      this.pages.push(controllablePage);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (url.includes(t.urls!.extensionId)) {
        await controllablePage.waitUntilViewLoaded();
      }
      return controllablePage;
    } catch (e) {
      if (String(e).includes('page has been closed') && url.includes('localhost') && url.includes('/o/oauth2/auth')) {
        // the extension may close the auth page after success before we had a chance to evaluate it
        return controllablePage; // returning already closed auth page
      }
      throw e;
    }
  };

  public closeAllPages = async () => {
    for (const page of await this.browser.pages()) {
      if (page.url() !== 'about:blank') {
        await page.close();
      }
    }
    this.pages = [];
  };

  public close = async () => {
    await this.browser.close();
    this.semaphore.release();
  };

  public release = () => {
    this.semaphore.release();
  };

  public debugPagesHtml = async (t: AvaContext, alsoLogToConsole: boolean) => {
    let html = '';
    for (let i = 0; i < this.pages.length; i++) {
      const cPage = this.pages[i];
      const url = await Promise.race([cPage.page.url(), new Promise(resolve => setTimeout(() => resolve('(url get timeout)'), 10 * 1000)) as Promise<string>]);
      const consoleMsgs = await cPage.console(t, alsoLogToConsole);
      const alerts = cPage.alerts
        .map(a => `${a.active ? `<b class="c-error">ACTIVE ${a.target.type()}</b>` : a.target.type()}: ${a.target.message()}`)
        .join('\n');
      html += '<div class="page">';
      html += `<pre title="url">Page ${i} (${cPage.page.isClosed() ? 'closed' : 'active'}) ${Util.htmlEscape(url)}</pre>`;
      html += `<pre title="console">${consoleMsgs || '(no console messages)'}</pre>`;
      html += `<pre title="alerts">${alerts || '(no alerts)'}</pre>`;
      if (url !== 'about:blank' && !cPage.page.isClosed()) {
        try {
          html += `<img src="data:image/png;base64,${await cPage.screenshot()}"><br>`;
        } catch (e) {
          html += `<div style="border:1px solid white;">Could not get screen shot: ${Util.htmlEscape(
            e instanceof Error ? e.stack || String(e) : String(e)
          )}</div>`;
        }
        try {
          html += `<pre style="height:300px;overflow:auto;">${Util.htmlEscape(await cPage.html())}</pre>`;
        } catch (e) {
          html += `<pre>Could not get page HTML: ${Util.htmlEscape(e instanceof Error ? e.stack || String(e) : String(e))}</pre>`;
        }
      }
      html += '</div>';
    }
    return html;
  };

  private doAwaitTriggeredPage = (triggeringAction: () => Promise<void>): Promise<Page | null> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Action did not trigger a new page within timeout period')), TIMEOUT_ELEMENT_APPEAR * 1000);
      let resolved = 0;
      const listener = async (target: Target) => {
        if (target.type() === 'page') {
          if (!resolved++) {
            this.browser.removeListener('targetcreated', listener);
            target.page().then(resolve, reject);
          }
        }
      };
      this.browser.on('targetcreated', listener);
      triggeringAction().catch(console.error);
    });
  };
}
