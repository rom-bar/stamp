'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { login, seedStampCatalog } = require('./helpers');

const previewDir = process.env.STAMP_PREVIEW_DIR || '/workspace/stamp-family-previews';

async function selectByText(select, text) {
  const option = select.locator('option').filter({ hasText:text }).last();
  await select.selectOption(await option.getAttribute('value'));
}

test('captures mobile previews for the two-input stamp form and coloring gallery', async ({ page }) => {
  fs.mkdirSync(previewDir, { recursive:true });
  await page.setViewportSize({ width:390, height:844 });
  await login(page, 'family_a');
  await seedStampCatalog(page, 'preview');

  await page.locator('[data-bottom-tab="stamp"]').click();
  await page.locator('#give-form [data-child-select]').selectOption({ label:'preview child' });
  await selectByText(page.locator('#give-form [data-reason-select]'), 'preview reason');
  await expect(page.locator('#give-form select')).toHaveCount(2);
  await page.screenshot({ path:path.join(previewDir, 'stamp-form-mobile.png') });
  await page.locator('#give-form').getByRole('button', { name:/tambahkan 1 stamp/i }).click();
  await expect(page.locator('#celebration-stamp')).toHaveText('🌱');
  await page.screenshot({ path:path.join(previewDir, 'stamp-celebration-mobile.png') });
  await page.locator('#stamp-celebration .celebration-close').click();

  await page.locator('[data-bottom-tab="home"]').click();
  await page.locator('.feature-grid [data-tab="coloring"]').click();
  await page.locator('#coloring-gallery-heading').evaluate(element => window.scrollTo({ top:element.getBoundingClientRect().top + window.scrollY - 10, behavior:'instant' }));
  await expect(page.locator('#coloring-template-count')).toContainText('120 gambar');
  await expect(page.locator('#coloring-gallery .coloring-card:not(.blank-card)')).toHaveCount(120);
  await page.locator('#notice').evaluate(element => { element.hidden = true; });
  await page.screenshot({ path:path.join(previewDir, 'coloring-gallery-mobile.png') });
});
