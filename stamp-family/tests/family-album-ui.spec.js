'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { login, syncOperations, op } = require('./helpers');

const reviewDir = process.env.STAMP_UI_REVIEW_DIR || '/workspace/stamp-family-ui-review';

function prepareReviewDir() {
  fs.mkdirSync(reviewDir, { recursive: true });
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page, `${label} overflows horizontally: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function assertSquareHomeTiles(page, width, height) {
  await page.setViewportSize({ width, height });
  const dimensions = await page.locator('#panel-dashboard .feature-card').evaluateAll(cards => cards.map(card => {
    const rect = card.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  expect(dimensions, `${width}px home tile count`).toHaveLength(5);
  for (const [index, rect] of dimensions.entries()) {
    expect(Math.abs(rect.width - rect.height), `${width}px tile ${index + 1} should stay square`)
      .toBeLessThanOrEqual(1);
  }
  await assertNoHorizontalOverflow(page, `${width}px home`);
}

async function makeAlbumDrawing(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f7ebd4';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#efc768';
    context.beginPath();
    context.arc(500, 86, 45, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d8a16f';
    context.beginPath();
    context.moveTo(196, 224);
    context.lineTo(320, 114);
    context.lineTo(444, 224);
    context.closePath();
    context.fill();
    context.fillStyle = '#fffaf0';
    context.fillRect(224, 218, 192, 105);
    context.fillStyle = '#66866a';
    context.fillRect(266, 248, 42, 75);
    context.fillStyle = '#98b28c';
    context.beginPath();
    context.ellipse(105, 302, 84, 45, 0, 0, Math.PI * 2);
    context.ellipse(535, 308, 110, 49, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#4d7254';
    for (const [x, y, radius] of [[88, 196, 28], [130, 172, 35], [566, 202, 31], [606, 178, 39]]) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = 'rgba(74, 91, 65, .25)';
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
    return canvas.toDataURL('image/png');
  });
}

test.describe('family album UI', () => {
  test('home tiles stay square, navigation labels stay exact, and fonts remain local', async ({ page }) => {
    prepareReviewDir();
    const fontRequests = [];
    page.on('request', request => {
      if (/\.(woff2?|ttf|otf)(?:\?|$)/i.test(request.url())) fontRequests.push(request.url());
    });

    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page, 'family_a');
    await expect(page.locator('#panel-dashboard')).toBeVisible();
    const labels = await page.locator('[data-bottom-tab]').evaluateAll(items =>
      items.map(item => item.lastElementChild.textContent.trim()));
    expect(labels).toEqual(['Beranda', 'Stamp', 'Lainnya']);

    const stampBox = await page.locator('[data-bottom-tab="stamp"]').boundingBox();
    expect(Math.abs(stampBox.x + stampBox.width / 2 - 1365 / 2)).toBeLessThanOrEqual(2);
    await assertSquareHomeTiles(page, 1365, 1024);
    await page.screenshot({ path: path.join(reviewDir, 'family-home-desktop.png') });

    await page.setViewportSize({ width: 390, height: 844 });
    await assertSquareHomeTiles(page, 390, 844);
    const mobileStampBox = await page.locator('[data-bottom-tab="stamp"]').boundingBox();
    expect(Math.abs(mobileStampBox.x + mobileStampBox.width / 2 - 390 / 2)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: path.join(reviewDir, 'family-home-mobile.png') });

    for (const width of [320, 360, 430, 720, 768, 1024]) {
      await assertSquareHomeTiles(page, width, 844);
    }
    await page.locator('[data-bottom-tab="home"]').click();
    const focusedPanel = await page.evaluate(() => document.activeElement.closest('.panel')?.id || '');
    expect(focusedPanel).toBe('panel-dashboard');
    expect(fontRequests).toEqual([]);
  });

  test('journal reader presents dated album content on desktop and phone', async ({ page }) => {
    prepareReviewDir();
    await page.setViewportSize({ width: 1365, height: 900 });
    await login(page, 'family_c');
    const date = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const title = 'Kebun kecil setelah hujan';
    const body = 'Kami menanam biji bunga bersama. Tanah masih basah, dan semua orang memilih satu warna untuk gambar rumah kecil ini.';
    const drawing = await makeAlbumDrawing(page);
    await syncOperations(page, [op(`ui-album-${Date.now()}`, 'journal.add', {
      date,
      title,
      body,
      drawing,
      shared: true,
    })]);
    await page.reload();
    await expect(page.locator('#welcome-title')).toContainText('family_c');
    await page.locator('.feature-grid [data-tab="journal"]').click();
    await expect(page.locator('#panel-journal')).toBeVisible();
    const sampleCard = page.locator('#journal-list .journal-card').filter({ hasText: title });
    await expect(sampleCard).toContainText(title);
    await expect(sampleCard).toContainText('Dibagikan');
    await expect(sampleCard.locator('> img')).toHaveAttribute('alt', /Gambar kenangan/);
    expect(await page.evaluate(() => document.activeElement.closest('.panel')?.id || '')).toBe('panel-journal');
    await sampleCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(reviewDir, 'family-journal-desktop.png') });
    await assertNoHorizontalOverflow(page, 'desktop journal reader');

    await page.locator('[data-bottom-tab="home"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.feature-grid [data-tab="journal"]').click();
    await expect(sampleCard).toContainText(title);
    await sampleCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(reviewDir, 'family-journal-mobile.png') });
    await assertNoHorizontalOverflow(page, 'mobile journal reader');
  });
});
