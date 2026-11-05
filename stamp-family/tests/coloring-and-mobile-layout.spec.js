'use strict';

const { test, expect } = require('@playwright/test');
const { login, seedStampCatalog } = require('./helpers');

async function assertNoHorizontalOverflow(page, panelId) {
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')].map(element => {
      const rect = element.getBoundingClientRect();
      return { tag:element.tagName, id:element.id, className:typeof element.className === 'string' ? element.className : '', left:Math.round(rect.left), right:Math.round(rect.right), width:Math.round(rect.width) };
    }).filter(item => item.width > 0 && (item.left < -1 || item.right > document.documentElement.clientWidth + 1)).slice(0, 8),
  }));
  expect(dimensions.page, `Horizontal overflow in #${panelId}: ${JSON.stringify(dimensions.offenders)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function waitForSync(page) {
  await expect.poll(async () => (await page.locator('#sync-label').textContent()) || '', { timeout: 12_000 })
    .toMatch(/Tersinkron|sinkron/i);
}

test.describe('mobile menu layout and coloring', () => {
  test('all app menus and the three bottom tabs fit a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'family_b');
    await seedStampCatalog(page, 'mobile-layout');
    const shellCache = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const cache = await caches.open('stamp-family-shell-v8');
      const script = await cache.match('/static/app.js');
      return { keys:await caches.keys(), script:script ? await script.text() : '' };
    });
    expect(shellCache.keys).toContain('stamp-family-shell-v8');
    expect(shellCache.script).toContain('floodColoringArea');

    const navItems = page.locator('[data-bottom-tab]');
    await expect(navItems).toHaveCount(3);
    const navBoxes = await navItems.evaluateAll(items => items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x:rect.x, right:rect.right, width:rect.width, visible:getComputedStyle(item).display !== 'none' };
    }));
    expect(navBoxes.every(item => item.visible && item.x >= 0 && item.right <= 390)).toBe(true);
    expect(Math.max(...navBoxes.map(item => item.width)) - Math.min(...navBoxes.map(item => item.width))).toBeLessThanOrEqual(1);
    expect(navBoxes[0].right).toBeLessThanOrEqual(navBoxes[1].x + 1);
    expect(navBoxes[1].right).toBeLessThanOrEqual(navBoxes[2].x + 1);

    await assertNoHorizontalOverflow(page, 'panel-dashboard');
    for (const tab of ['journal', 'coloring', 'calendar', 'collection', 'rewards']) {
      await page.locator('[data-bottom-tab="home"]').click();
      await page.locator(`.feature-grid [data-tab="${tab}"]`).click();
      await assertNoHorizontalOverflow(page, `panel-${tab}`);
    }

    await page.locator('[data-bottom-tab="stamp"]').click();
    await assertNoHorizontalOverflow(page, 'panel-give');
    await page.locator('[data-bottom-tab="more"]').click();
    await assertNoHorizontalOverflow(page, 'panel-more');
    await page.locator('[data-tab="setup"]').click();
    await assertNoHorizontalOverflow(page, 'panel-setup');

    await page.locator('[data-bottom-tab="home"]').click();
    await assertNoHorizontalOverflow(page, 'panel-dashboard');

    const rewardCard = page.locator('#reward-list .reward-card').first();
    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="rewards"]').click();
    await expect(rewardCard).toBeVisible();
    const cardBox = await rewardCard.boundingBox();
    const actionBox = await rewardCard.locator('[data-redeem]').boundingBox();
    expect(actionBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    expect(actionBox.width).toBeGreaterThan(250);
    await assertNoHorizontalOverflow(page, 'panel-rewards');
  });

  test('coloring bucket fill, PNG download, and private/shared journal saves respect privacy', async ({ page, browser }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'family_a');
    await page.locator('.feature-grid [data-tab="coloring"]').click();
    await expect(page.locator('#coloring-gallery .coloring-card')).toHaveCount(7);
    await page.locator('[data-coloring-template="flower"]').click();
    await expect(page.locator('#coloring-editor-view')).toBeVisible();
    const canvas = page.locator('#coloring-canvas');
    await expect.poll(() => canvas.evaluate(el => {
      const pixels = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 80 && pixels[i + 1] < 80 && pixels[i + 2] < 80) dark++;
      return dark;
    })).toBeGreaterThan(100);

    await page.locator('[data-coloring-color="#35b7d2"]').click();
    await page.locator('[data-coloring-tool="fill"]').click();
    const canvasBox = await canvas.boundingBox();
    await canvas.click({ position:{ x:canvasBox.width / 2, y:canvasBox.height / 2 } });
    const centerPixel = await canvas.evaluate(el => [...el.getContext('2d').getImageData(el.width / 2, el.height / 2, 1, 1).data]);
    expect(centerPixel[0]).toBeLessThan(80);
    expect(centerPixel[1]).toBeGreaterThan(130);
    expect(centerPixel[2]).toBeGreaterThan(150);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#coloring-download').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    const privateTitle = `Private art ${Date.now()}`;
    await page.locator('#coloring-title').fill(privateTitle);
    await page.locator('#coloring-save-form button[type="submit"]').click();
    await expect(page.locator('#panel-journal')).toBeVisible();
    await expect(page.locator('#journal-list')).toContainText(privateTitle);
    const localOnlyBadge = page.locator('#journal-list .journal-card').filter({ hasText:privateTitle });
    await expect(localOnlyBadge).toContainText('Pribadi');
    const privateOnServer = await page.evaluate(async title => {
      const response = await fetch('/api/bootstrap', { credentials:'same-origin', cache:'no-store' });
      const result = await response.json();
      return result.journals.some(entry => entry.title === title);
    }, privateTitle);
    expect(privateOnServer).toBe(false);

    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="coloring"]').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#coloring-back').click();
    await expect(page.locator('#coloring-gallery-view')).toBeVisible();
    await page.locator('[data-coloring-template="blank"]').click();
    await page.locator('[data-coloring-color="#65bd70"]').click();
    await page.locator('[data-coloring-tool="fill"]').click();
    const blankBox = await canvas.boundingBox();
    await canvas.click({ position:{ x:blankBox.width / 2, y:blankBox.height / 2 } });
    const sharedTitle = `Shared coloring ${Date.now()}`;
    await page.locator('#coloring-title').fill(sharedTitle);
    await page.locator('#coloring-share').check();
    await page.locator('#coloring-save-form button[type="submit"]').click();
    await expect(page.locator('#journal-list')).toContainText(sharedTitle);
    await expect(page.locator('#journal-list .journal-card').filter({ hasText:sharedTitle })).toContainText('Dibagikan');
    await waitForSync(page);

    const storedDrawing = await page.evaluate(async title => {
      const response = await fetch('/api/bootstrap', { credentials:'same-origin', cache:'no-store' });
      const result = await response.json();
      return result.journals.find(entry => entry.title === title)?.drawing || '';
    }, sharedTitle);
    expect(storedDrawing).toMatch(/^data:image\/jpeg;base64,/);

    const otherFamily = await browser.newContext();
    const otherPage = await otherFamily.newPage();
    await login(otherPage, 'family_b');
    await otherPage.locator('[data-tab="journal"]').click();
    await expect(otherPage.locator('#journal-list')).not.toContainText(privateTitle);
    await expect(otherPage.locator('#journal-list')).not.toContainText(sharedTitle);
    await otherFamily.close();
  });
});
