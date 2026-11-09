'use strict';
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

async function openSettings(page) {
  await page.locator('[data-bottom-tab="more"]').click();
  await page.locator('.more-grid [data-tab="setup"]').click();
  await expect(page.locator('#panel-setup')).toBeVisible();
}

async function addReasonLocally(page, name) {
  const form = page.locator('[data-create-form="reason.add"]');
  await form.locator('input[name="name"]').fill(name);
  await form.getByRole('button', { name: 'Tambah alasan' }).click();
  await expect(page.locator('#setup-reasons')).toContainText(name);
  await expect.poll(() => page.evaluate(() => (window.__pending || []).length)).toBe(1);
}

async function serverReasonCount(page, name) {
  return page.evaluate(async reasonName => {
    const response = await fetch('/api/bootstrap', { credentials:'same-origin', cache:'no-store' });
    if (!response.ok) throw new Error(`bootstrap HTTP ${response.status}`);
    const snapshot = await response.json();
    return snapshot.reasons.filter(reason => reason.name === reasonName).length;
  }, name);
}

test.describe('manual family and catalog sync', () => {
  test('online sync refreshes family data and catalog; repeated sync does not duplicate data', async ({ page }) => {
    await page.setViewportSize({ width:1280, height:900 });
    await login(page, 'family_a');
    const name = 'Manual sync latest reason';
    const operation = {
      id:'manual-sync-new-reason',
      kind:'reason.add',
      payload:{ id:'manual-sync-reason-entity', name, emoji:'🔄' },
    };
    const seeded = await page.evaluate(async operation => {
      const response = await fetch('/api/sync', {
        method:'POST', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ operations:[operation] }),
      });
      return { status:response.status, body:await response.json() };
    }, operation);
    expect(seeded.status).toBe(200);
    expect(seeded.body.applied).toContain(operation.id);

    await openSettings(page);
    const catalogRequests = [];
    page.on('request', request => {
      if (request.url().includes('/static/coloring-templates.js?manual-sync=')) catalogRequests.push(request.url());
    });
    const syncButton = page.getByRole('button', { name:'Sinkronkan sekarang' });
    await syncButton.click();
    await expect(page.locator('#manual-sync-status')).toContainText('Berhasil');
    await expect(page.locator('#setup-reasons')).toContainText(name);
    await expect(page.locator('#manual-sync-last-sync')).toContainText('Sinkronisasi terakhir:');
    await syncButton.click();
    await expect(page.locator('#manual-sync-status')).toContainText('Berhasil');
    expect(catalogRequests).toHaveLength(2);
    expect(await serverReasonCount(page, name)).toBe(1);

    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="coloring"]').click();
    await expect(page.locator('#coloring-template-count')).toContainText('120 gambar');
    await expect(page.locator('#coloring-category-filter [data-coloring-category]')).toHaveCount(13);
  });

  test('offline writes survive a manual sync attempt and sync after reconnect without duplicates', async ({ page }) => {
    await login(page, 'family_a');
    await openSettings(page);
    const name = 'Offline pending manual sync';
    await page.context().setOffline(true);
    await addReasonLocally(page, name);
    await page.getByRole('button', { name:'Sinkronkan sekarang' }).click();
    await expect(page.locator('#manual-sync-status')).toContainText('Offline');
    await expect.poll(() => page.evaluate(() => (window.__pending || []).length)).toBe(1);

    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => (window.__pending || []).length), { timeout:12_000 }).toBe(0);
    await expect.poll(() => serverReasonCount(page, name), { timeout:12_000 }).toBe(1);
    await page.getByRole('button', { name:'Sinkronkan sekarang' }).click();
    await expect(page.locator('#manual-sync-status')).toContainText('Berhasil');
    expect(await serverReasonCount(page, name)).toBe(1);
  });

  test('failed request keeps queued writes and a later manual retry applies them once', async ({ page }) => {
    await login(page, 'family_a');
    await openSettings(page);
    const name = 'Retry preserved reason';
    await page.context().setOffline(true);
    await addReasonLocally(page, name);
    await page.evaluate(() => {
      window.__manualSyncTestOriginalFetch = window.fetch;
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.startsWith('/api/bootstrap')) return Promise.reject(new TypeError('forced temporary network failure'));
        return window.__manualSyncTestOriginalFetch(input, init);
      };
    });
    await page.context().setOffline(false);
    await page.waitForTimeout(250);

    await page.getByRole('button', { name:'Sinkronkan sekarang' }).click();
    await expect(page.locator('#manual-sync-status')).toContainText('gagal');
    await expect.poll(() => page.evaluate(() => (window.__pending || []).length)).toBe(1);

    await page.evaluate(() => { window.fetch = window.__manualSyncTestOriginalFetch; });
    await page.getByRole('button', { name:'Sinkronkan sekarang' }).click();
    await expect(page.locator('#manual-sync-status')).toContainText('Berhasil');
    await expect.poll(() => page.evaluate(() => (window.__pending || []).length)).toBe(0);
    expect(await serverReasonCount(page, name)).toBe(1);
  });

  test('sync controls fit and work on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width:390, height:844 });
    await login(page, 'family_b');
    await openSettings(page);
    await expect(page.getByRole('button', { name:'Sinkronkan sekarang' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport:document.documentElement.clientWidth,
      page:document.documentElement.scrollWidth,
      card:document.querySelector('.sync-control-card').getBoundingClientRect().toJSON(),
      button:document.querySelector('#manual-sync-button').getBoundingClientRect().toJSON(),
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.button.left).toBeGreaterThanOrEqual(dimensions.card.left - 1);
    expect(dimensions.button.right).toBeLessThanOrEqual(dimensions.card.right + 1);
    await page.getByRole('button', { name:'Sinkronkan sekarang' }).click();
    await expect(page.locator('#manual-sync-status')).toContainText('Berhasil');
  });
});


test('catalog and category filters survive offline reload on desktop and mobile', async ({ page }) => {
  await login(page, 'family_a');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout:12_000 }).toBe(true);
  const shell = await page.evaluate(async () => {
    const cache = await caches.open('stamp-family-shell-v11');
    return { catalog:!!(await cache.match('/static/coloring-templates.js')), script:!!(await cache.match('/static/app.js')) };
  });
  expect(shell.catalog).toBe(true);
  expect(shell.script).toBe(true);

  for (const viewport of [{ width:1365, height:900 }, { width:390, height:844 }]) {
    await page.setViewportSize(viewport);
    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="coloring"]').click();
    await page.locator('#coloring-category-filter [data-coloring-category="Semua"]').click();
    await expect(page.locator('#coloring-template-count')).toContainText('120 gambar');
    await page.locator('#coloring-category-filter [data-coloring-category="Hewan"]').click();
    await expect(page.locator('#coloring-gallery .coloring-card:not(.blank-card)')).toHaveCount(10);

    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator('#welcome-title')).toContainText('family_a');
    await expect(page.locator('#notice')).toContainText('Mode offline aktif');
    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="coloring"]').click();
    await expect(page.locator('#coloring-category-filter [data-coloring-category]')).toHaveCount(13);
    await page.locator('#coloring-category-filter [data-coloring-category="Semua"]').click();
    await expect(page.locator('#coloring-template-count')).toContainText('120 gambar');
    await page.locator('#coloring-category-filter [data-coloring-category="Hewan"]').click();
    await expect(page.locator('#coloring-gallery .coloring-card:not(.blank-card)')).toHaveCount(10);

    if (viewport.width === 1365) {
      await expect(page.locator('#sync-label')).toContainText('Offline · data tersimpan');
    }
  }
});
