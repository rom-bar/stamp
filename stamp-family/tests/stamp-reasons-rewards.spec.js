const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { login, seedStampCatalog, syncOperations, op } = require('./helpers');

const reviewDir = process.env.STAMP_UI_REVIEW_DIR || '/workspace/stamp-family-ui-review';

async function capture(page, name, fullPage = true) {
  fs.mkdirSync(reviewDir, { recursive:true });
  await page.screenshot({ path:path.join(reviewDir, name), fullPage });
}

async function addStamps(page, prefix, childId, reasonId, count) {
  const familyId = await page.evaluate(() => JSON.parse(localStorage.getItem('stampFamilyProfile') || '{}').familyId);
  const operations = Array.from({ length:count }, (_, index) => op(
    `${prefix}-stamp-${String(index + 1).padStart(2, '0')}`,
    'stamp.give',
    { childId, reasonId, designId:`system-reason-${familyId}` },
  ));
  await syncOperations(page, operations);
  await page.reload();
  await expect(page.locator('#welcome-title')).toContainText('family_b');
}

test.describe('stamp reasons, rewards, and animal quiz', () => {
  test('manages searchable reasons, separates collection labels, and records regular and spontaneous redemptions', async ({ page }) => {
    await page.setViewportSize({ width:390, height:844 });
    await login(page, 'family_b');
    const prefix = `family-flow-${Date.now()}`;
    await seedStampCatalog(page, prefix);

    await page.locator('[data-bottom-tab="more"]').click();
    await page.locator('.more-grid [data-tab="reasons"]').click();
    const reasonName = `${prefix} reason`;
    await page.locator('#reason-list-search').fill(prefix);
    await expect(page.locator('#reason-list .reason-row')).toHaveCount(1);
    await expect(page.locator('#reason-list')).toContainText(reasonName);
    await capture(page, 'stamp-reasons-mobile.png');

    const createReason = page.locator('[data-create-form="reason.add"]');
    await createReason.locator('input[name="name"]').fill(reasonName);
    await createReason.getByRole('button', { name:'Tambah alasan' }).click();
    await expect(page.locator('#notice')).toContainText(/nama alasan ini sudah digunakan/i);
    await expect(page.locator('#reason-list .reason-row')).toHaveCount(1);

    const duplicateResult = await page.evaluate(async (name) => {
      const operationId = `server-duplicate-${Date.now()}`;
      const response = await fetch('/api/sync', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ operations:[{ id:operationId, kind:'reason.add', payload:{ id:`payload-${operationId}`, name, emoji:'⭐' } }] }),
      });
      const data = await response.json();
      return { status:response.status, message:data.rejected?.[operationId] || '' };
    }, reasonName);
    expect(duplicateResult.status).toBe(200);
    expect(duplicateResult.message).toMatch(/nama alasan sudah digunakan/i);

    const newReason = `${prefix} reason tambahan`;
    await createReason.locator('input[name="name"]').fill(newReason);
    await createReason.getByRole('button', { name:'Tambah alasan' }).click();
    await expect(page.locator('#notice')).toContainText(/disimpan/i);
    await page.locator('#reason-list-search').fill(newReason);
    await expect(page.locator('#reason-list')).toContainText(newReason);

    const xssName = '<img src=x onerror=window.__reasonXss=1>';
    const xssResult = await page.evaluate(async (name) => {
      const operationId = `reason-xss-${Date.now()}`;
      const response = await fetch('/api/sync', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ operations:[{ id:operationId, kind:'reason.add', payload:{ id:`payload-${operationId}`, name, emoji:'⭐' } }] }),
      });
      const data = await response.json();
      return { status:response.status, rejected:data.rejected?.[operationId] || '' };
    }, xssName);
    expect(xssResult.status).toBe(200);
    expect(xssResult.rejected).toBe('');
    await page.reload();
    await expect(page.locator('#welcome-title')).toContainText('family_b');
    await page.locator('[data-bottom-tab="more"]').click();
    await page.locator('.more-grid [data-tab="reasons"]').click();
    await page.locator('#reason-list-search').fill('img src=x');
    await expect(page.locator('#reason-list')).toContainText(xssName);
    await expect(page.locator('#reason-list img, #reason-list script')).toHaveCount(0);
    expect(await page.evaluate(() => window.__reasonXss || 0)).toBe(0);

    await page.locator('[data-bottom-tab="stamp"]').click();
    await page.locator('#give-reason-search').fill(prefix);
    const reasonSelect = page.locator('#give-form [data-reason-select]');
    await expect(reasonSelect.locator('option')).toHaveCount(3);
    await expect(reasonSelect).toContainText(reasonName);
    await capture(page, 'stamp-add-reason-search-mobile.png');
    await page.locator('#give-reason-search').fill('not-a-reason');
    await expect(page.locator('#give-reason-empty')).toBeVisible();
    await page.locator('#give-reason-search').fill('');

    const childSelect = page.locator('#give-form [data-child-select]');
    await childSelect.selectOption({ label:`${prefix} child` });
    const childId = await childSelect.inputValue();
    const reasonId = await reasonSelect.locator('option').evaluateAll((options, name) => options.find(option => option.textContent.trim().endsWith(name))?.value, reasonName);
    await addStamps(page, prefix, childId, reasonId, 4);

    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="collection"]').click();
    await page.locator('#collection-child').selectOption({ label:`${prefix} child` });
    await expect(page.locator('#collection-total')).toContainText('4 stamp');
    await expect(page.locator('#stamp-list .stamp-emoji')).toHaveCount(0);
    await expect(page.locator('#stamp-list .stamp-category').first()).toHaveText('Stamp');
    await expect(page.locator('#stamp-list .stamp-reason').first()).toHaveText(reasonName);
    await capture(page, 'stamp-collection-mobile.png');

    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="rewards"]').click();
    await page.locator('#reward-child').selectOption({ label:`${prefix} child` });
    const rewardCard = page.locator('#reward-list article').filter({ hasText:`${prefix} reward` });
    await expect(rewardCard.locator('[data-redeem]')).toBeEnabled();
    await rewardCard.locator('[data-redeem]').click();
    await expect(page.locator('#redemption-list')).toContainText(`${prefix} reward`);
    await expect(page.locator('#redemption-list')).toContainText('2 stamp');
    await expect(page.locator('#redemption-list .redemption-row')).toHaveCount(1);
    await expect(page.locator('#reward-balance')).toContainText('2 stamp tersedia');

    await page.locator('#custom-redeem-form input[name="rewardName"]').fill('Hadiah dadakan: es krim');
    await page.locator('#custom-redeem-form input[name="cost"]').fill('2');
    await page.locator('#custom-redeem-form button[type="submit"]').click();
    await expect(page.locator('#redemption-list')).toContainText('Hadiah dadakan: es krim');
    await expect(page.locator('#redemption-list .redemption-row')).toHaveCount(2);
    await expect(page.locator('#reward-balance')).toContainText('0 stamp tersedia');
    await expect(page.locator('#reward-list')).not.toContainText('Hadiah dadakan: es krim');
    await expect(page.locator('#notice')).toContainText(/ditukar/i);
    await page.locator('#notice').evaluate(element => { element.hidden = true; });
    await capture(page, 'stamp-rewards-mobile.png');

    await page.locator('#custom-redeem-form input[name="rewardName"]').fill('Hadiah berlebih');
    await page.locator('#custom-redeem-form input[name="cost"]').fill('1');
    await page.locator('#custom-redeem-form button[type="submit"]').click();
    await expect(page.locator('#notice')).toContainText(/stamp belum cukup/i);
    await expect(page.locator('#redemption-list .redemption-row')).toHaveCount(2);
    const phoneWidth = await page.evaluate(() => ({ viewport:innerWidth, page:document.documentElement.scrollWidth }));
    expect(phoneWidth.page).toBeLessThanOrEqual(phoneWidth.viewport + 1);
    await page.setViewportSize({ width:1365, height:900 });
    const desktopWidth = await page.evaluate(() => ({ viewport:innerWidth, page:document.documentElement.scrollWidth }));
    expect(desktopWidth.page).toBeLessThanOrEqual(desktopWidth.viewport + 1);
    await expect(page.locator('#redemption-history-title')).toBeVisible();
  });

  test('plays a medium 10-question round with 100 local animal images, including offline', async ({ page }) => {
    await page.setViewportSize({ width:390, height:844 });
    await login(page, 'family_b');
    expect(await page.evaluate(() => window.STAMP_ANIMAL_BANK?.length)).toBe(100);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout:20_000 }).toBe(true);
    const cache = await page.evaluate(async () => {
      const shell = await caches.open('stamp-family-shell-v13');
      return {
        bank:!!(await shell.match('/static/animal-bank.js')),
        atlas:!!(await shell.match('/static/animal-atlas.svg')),
      };
    });
    expect(cache.bank).toBe(true);
    expect(cache.atlas).toBe(true);

    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator('#welcome-title')).toContainText('family_b');
    await page.locator('.feature-grid [data-tab="animal-game"]').click();
    await page.getByRole('button', { name:'Mulai bermain' }).click();
    await expect(page.locator('.animal-question-image')).toBeVisible();
    await expect(page.locator('.animal-question-image use')).toHaveAttribute('href', /#animal-/);
    await expect.poll(() => page.evaluate(async () => (await fetch('/static/animal-atlas.svg')).ok)).toBe(true);
    await expect(page.locator('[data-animal-answer]')).toHaveCount(4);
    await page.locator('#animal-hint-toggle').click();
    await expect(page.locator('#animal-hint-text')).toBeVisible();
    await expect(page.locator('[data-animal-answer]:not(:disabled)')).toHaveCount(3);
    await page.setViewportSize({ width:390, height:1100 });
    await page.locator('.animal-options').scrollIntoViewIfNeeded();
    await capture(page, 'animal-quiz-mobile.png', false);

    for (let index = 0; index < 10; index++) {
      const source = await page.locator('.animal-question-image use').getAttribute('href');
      const code = source.split('#animal-').pop();
      await page.locator(`[data-animal-answer="${code}"]`).click();
      await expect(page.locator('#animal-feedback')).toContainText('Tepat');
      await page.locator('#animal-next').click();
    }
    await expect(page.locator('.animal-result-score')).toHaveText('10 dari 10 benar');
    await expect(page.getByRole('button', { name:'Main lagi' })).toBeVisible();
    const mobileWidth = await page.evaluate(() => ({ viewport:innerWidth, page:document.documentElement.scrollWidth }));
    expect(mobileWidth.page).toBeLessThanOrEqual(mobileWidth.viewport + 1);

    await page.context().setOffline(false);
    await page.setViewportSize({ width:1365, height:900 });
    await page.locator('[data-bottom-tab="home"]').click();
    await page.locator('.feature-grid [data-tab="animal-game"]').click();
    await page.locator('#animal-game-restart').click();
    await expect(page.locator('.animal-options')).toBeVisible();
    await capture(page, 'animal-quiz-desktop.png');
    const desktopWidth = await page.evaluate(() => ({ viewport:innerWidth, page:document.documentElement.scrollWidth }));
    expect(desktopWidth.page).toBeLessThanOrEqual(desktopWidth.viewport + 1);
  });
});
