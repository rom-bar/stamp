const { test, expect } = require('@playwright/test');
const { login, seedStampCatalog } = require('./helpers');

async function selectByText(select, text) {
  const option = select.locator('option').filter({ hasText: text }).last();
  await select.selectOption(await option.getAttribute('value'));
}

test.describe('stamp, reward, and admin controls', () => {
  test('admin creates catalog, awards stamps, and redeems a reward', async ({ page }) => {
    await login(page, 'family_a');
    await seedStampCatalog(page, 'stamp-flow');

    await page.locator('[data-tab=give]').click();
    const form = page.locator('#give-form');
    await expect(form.locator('select')).toHaveCount(2);
    await expect(form.locator('[data-design-select]')).toHaveCount(0);
    await expect(form.locator('[data-child-select] option')).toHaveCount(2);
    await expect(form.locator('[data-reason-select] option')).toHaveCount(43);
    await form.locator('[data-child-select]').selectOption({ label: 'stamp-flow child' });
    await selectByText(form.locator('[data-reason-select]'), 'stamp-flow reason');
    await form.getByRole('button', { name: /tambahkan 1 stamp/i }).click();
    await expect(page.locator('#notice')).toContainText(/ditambahkan/i);
    await expect(page.locator('#stamp-celebration')).toBeVisible();
    await expect(page.locator('#celebration-stamp')).toHaveText('🌱');
    await expect(page.locator('#celebration-detail')).toContainText('stamp-flow reason');
    await expect(form.locator('[data-child-select]')).toHaveValue('');
    await expect(form.locator('[data-reason-select]')).toHaveValue('');
    await page.locator('#stamp-celebration .celebration-close').click();

    await page.context().setOffline(true);
    await form.locator('[data-child-select]').selectOption({ label: 'stamp-flow child' });
    await selectByText(form.locator('[data-reason-select]'), 'stamp-flow reason');
    await form.getByRole('button', { name: /tambahkan 1 stamp/i }).click();
    await expect(page.locator('#stamp-celebration')).toBeVisible();
    await expect(form.locator('[data-child-select]')).toHaveValue('');
    await page.context().setOffline(false);
    await expect.poll(async () => (await page.locator('#sync-label').textContent()) || '').toMatch(/Tersinkron|sinkron/i);

    await page.locator('[data-bottom-tab=home]').click();
    await page.locator('[data-tab=collection]').click();
    await expect(page.locator('#collection-total')).toContainText('2 stamp');
    await page.locator('[data-bottom-tab=home]').click();
    await page.locator('[data-tab=rewards]').click();
    await expect(page.locator('#reward-list')).toContainText('stamp-flow reward');
    await expect(page.locator('[data-redeem]')).toBeEnabled();
    await page.locator('[data-redeem]').click();
    await expect(page.locator('#reward-balance')).toContainText('0 stamp');
  });

  test('admin-only setup and invite controls are not exposed to an authenticated member', async ({ browser, page }) => {
    await login(page, 'family_a');
    const inviteResult = await page.evaluate(async () => {
      const response = await fetch('/api/invite', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'member-e2e', role: 'member' }) });
      return { status: response.status, body: await response.json() };
    });
    expect(inviteResult.status).toBe(201);
    const member = await browser.newContext();
    const memberPage = await member.newPage();
    await memberPage.goto('/');
    await memberPage.locator('input[name=username]').fill('member-e2e');
    await memberPage.locator('input[name=password]').fill(inviteResult.body.password);
    await memberPage.locator('form').getByRole('button', { name: /masuk/i }).click();
    await expect(memberPage).toHaveURL(/\/app$/);
    const invite = await memberPage.evaluate(async () => {
      const response = await fetch('/api/invite', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'should-fail', role: 'member' }) });
      return response.status;
    });
    expect([401, 403]).toContain(invite);
    await expect(memberPage.locator('[data-admin-tab]')).toBeHidden();
    await expect(memberPage.locator('[data-admin-only]')).toHaveCount(2);
    expect(await memberPage.locator('[data-admin-only]').evaluateAll(elements => elements.every(element => element.hidden))).toBe(true);
    await expect(memberPage.locator('[data-member-only]')).not.toHaveAttribute('hidden');
    await member.close();
  });

  test('unsafe user text is rendered as text, never as executable markup', async ({ page }) => {
    await login(page, 'family_a');
    await page.locator('[data-tab=journal]').click();
    const payload = '<img src=x onerror=window.__xss=1> & <script>window.__xss=2</script>';
    await page.locator('#journal-entry-date').fill('2026-11-04');
    await page.locator('#journal-form input[name=title]').fill(payload);
    await page.locator('#journal-form textarea[name=body]').fill(payload);
    await page.locator('#journal-share').check();
    await page.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
    const card = page.locator('.journal-card').filter({ hasText: payload }).last();
    await expect(card).toContainText(payload);
    await expect(card.locator('script, img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
  });
});
