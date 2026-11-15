'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { login, seedStampCatalog, syncOperations, op } = require('./helpers');

const previewDir = process.env.STAMP_PREVIEW_DIR || '/workspace/stamp-family-previews';

async function capture(page, name, fullPage = false) {
  await page.screenshot({ path:path.join(previewDir, name), fullPage });
}

test('captures mobile and desktop previews for reason management, the combined picker, and coloring', async ({ page }) => {
  fs.mkdirSync(previewDir, { recursive:true });
  const prefix = `preview-${Date.now()}`;
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/');
  await expect(page.getByText(/Admin pertama\?|stamp-family create-admin/i)).toHaveCount(0);
  await capture(page, 'login-mobile.png');
  await page.setViewportSize({ width:1365, height:900 });
  await capture(page, 'login-desktop.png');
  await page.setViewportSize({ width:390, height:844 });
  await login(page, 'family_a');
  await seedStampCatalog(page, prefix);
  await syncOperations(page, [op(`${prefix}-reason-two`, 'reason.add', { name:`${prefix} reason 2`, emoji:'🌸' })]);
  await page.reload();
  await expect(page.locator('#welcome-title')).toContainText('family_a');

  await page.locator('[data-bottom-tab="more"]').click();
  await page.locator('.more-grid [data-tab="reasons"]').click();
  await expect(page.locator('#reason-list-search')).toHaveValue('');
  await expect(page.locator('#reason-list')).toContainText(`${prefix} reason`);
  await expect(page.locator('#reason-list')).toContainText(`${prefix} reason 2`);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await capture(page, 'stamp-reasons-mobile.png');
  await page.setViewportSize({ width:1365, height:900 });
  await capture(page, 'stamp-reasons-desktop.png');

  await page.setViewportSize({ width:390, height:844 });
  await page.locator('[data-bottom-tab="stamp"]').click();
  await page.locator('#give-form [data-child-select]').selectOption({ label:`${prefix} child` });
  const picker = page.getByRole('combobox', { name:'Cari dan pilih alasan' });
  await picker.fill(`${prefix} reason`);
  await expect(page.locator('#give-reason-options [role="option"]')).toHaveCount(2);
  await capture(page, 'stamp-form-combobox-mobile.png', true);
  await page.setViewportSize({ width:1365, height:900 });
  await capture(page, 'stamp-form-combobox-desktop.png', true);
  await picker.press('ArrowDown');
  await picker.press('Enter');
  await expect(page.locator('#give-reason-selected')).not.toHaveValue('');
  await page.setViewportSize({ width:390, height:844 });
  await page.locator('#give-form').getByRole('button', { name:/tambahkan 1 stamp/i }).click();
  await expect(page.locator('#celebration-stamp')).toHaveText('🌱');
  await capture(page, 'stamp-celebration-mobile.png');
  await page.locator('#stamp-celebration .celebration-close').click();

  await page.locator('[data-bottom-tab="home"]').click();
  await page.locator('.feature-grid [data-tab="coloring"]').click();
  await page.locator('#coloring-gallery-heading').evaluate(element => window.scrollTo({ top:element.getBoundingClientRect().top + window.scrollY - 10, behavior:'instant' }));
  await expect(page.locator('#coloring-template-count')).toContainText('120 gambar');
  await expect(page.locator('#coloring-gallery .coloring-card:not(.blank-card)')).toHaveCount(120);
  await page.locator('#notice').evaluate(element => { element.hidden = true; });
  await capture(page, 'coloring-gallery-mobile.png');
});
