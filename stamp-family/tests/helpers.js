const { expect } = require('@playwright/test');

const PASSWORD = 'Test-password-2026';

async function login(page, username) {
  await page.goto('/');
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('form').filter({ has: page.locator('input[name=username]') }).getByRole('button', { name: /masuk/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('#welcome-title')).toContainText(username);
}

async function syncOperations(page, operations) {
  const result = await page.evaluate(async (operations) => {
    const response = await fetch('/api/sync', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    });
    return { status: response.status, body: await response.json() };
  }, operations);
  expect(result.status).toBe(200);
  expect(Object.keys(result.body.rejected || {})).toHaveLength(0);
  return result.body;
}

function op(id, kind, payload) {
  return { id, kind, payload: { id: `${kind}-${id}`, ...payload } };
}

async function seedStampCatalog(page, prefix = 'e2e') {
  await syncOperations(page, [
    op(`${prefix}-child`, 'child.add', { name: `${prefix} child`, color: '#f2b66d' }),
    op(`${prefix}-reason`, 'reason.add', { name: `${prefix} reason`, emoji: '🌱' }),
    op(`${prefix}-reward`, 'reward.add', { name: `${prefix} reward`, description: 'e2e reward', goal: 2 }),
  ]);
  await page.reload();
  await expect(page.locator('#setup-children')).toContainText(`${prefix} child`);
}

async function skipUnless(page, selector, reason) {
  if (await page.locator(selector).count() === 0) {
    // Playwright's test.skip is intentionally called by the test after this helper.
    return reason;
  }
  return null;
}

module.exports = { PASSWORD, login, syncOperations, op, seedStampCatalog, skipUnless };
