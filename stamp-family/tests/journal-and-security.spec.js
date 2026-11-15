const { test, expect } = require('@playwright/test');
const { login, syncOperations, op } = require('./helpers');

async function today(page) {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

async function waitForSync(page) {
  await expect.poll(async () => (await page.locator('#sync-label').textContent()) || '', { timeout: 12_000 })
    .toMatch(/Tersinkron|tersinkron|sinkron/i);
}

async function saveSharedEntry(page, title, body = 'Cerita uji bersama.') {
  await page.locator('[data-tab=journal]').click();
  await page.locator('#journal-entry-date').fill(await today(page));
  await page.locator('#journal-form input[name=title]').fill(title);
  await page.locator('#journal-form textarea[name=body]').fill(body);
  await page.locator('#journal-share').check();
  await page.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
  await expect(page.locator('#journal-list')).toContainText(title);
  await waitForSync(page);
}

test.describe('authentication and family boundaries', () => {
  test('unauthenticated navigation is gated and wrong credentials do not start a session', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('body')).toContainText(/silakan masuk|login|masuk/i);

    await page.goto('/');
    await page.locator('input[name=username]').fill('family_a');
    await page.locator('input[name=password]').fill('wrong-password');
    await page.locator('form').getByRole('button', { name: /masuk/i }).click();
    await expect(page.locator('#login-message')).toContainText(/salah/i);
    expect(await page.context().cookies()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'stamp_session' }),
    ]));
  });

  test('private entries remain on this device and shared entries do not cross families', async ({ browser }) => {
    const familyA = await browser.newContext();
    const familyB = await browser.newContext();
    const a = await familyA.newPage();
    const b = await familyB.newPage();
    await login(a, 'family_a');
    await a.locator('[data-tab=journal]').click();
    await a.locator('#journal-entry-date').fill(await today(a));
    await a.locator('#journal-form input[name=title]').fill('Private family A');
    await a.locator('#journal-form textarea[name=body]').fill('Only this device should see this.');
    await a.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
    await expect(a.locator('#journal-list')).toContainText('Private family A');
    await expect(a.locator('#journal-list')).toContainText('Pribadi');
    await a.reload();
    await a.locator('[data-tab=journal]').click();
    await expect(a.locator('#journal-list')).toContainText('Private family A');

    await a.locator('#journal-form input[name=title]').fill('Shared family A');
    await a.locator('#journal-form textarea[name=body]').fill('Visible to family A only.');
    await a.locator('#journal-share').check();
    await a.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
    await expect(a.locator('#journal-list')).toContainText('Shared family A');
    await waitForSync(a);

    await login(b, 'family_b');
    await b.locator('[data-tab=journal]').click();
    await expect(b.locator('#journal-list')).not.toContainText('Private family A');
    await expect(b.locator('#journal-list')).not.toContainText('Shared family A');
    await familyA.close();
    await familyB.close();
  });

  test('same-origin protection, payload limits and cross-family references are enforced', async ({ browser }) => {
    const bContext = await browser.newContext();
    const b = await bContext.newPage();
    await login(b, 'family_b');
    const date = await today(b);
    await syncOperations(b, [
      op('foreign-activity-create', 'activity.add', { date, title: 'Foreign challenge', prompt: 'Do not cross families.' }),
      op('foreign-journal-create', 'journal.add', { date, title: 'Foreign journal', body: 'Family B only.', shared: true, activityId: 'activity.add-foreign-activity-create' }),
    ]);
    await bContext.close();

    const aContext = await browser.newContext();
    const a = await aContext.newPage();
    await login(a, 'family_a');
    const base = new URL(a.url());
    const cookies = (await aContext.cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const foreign = await aContext.request.post(new URL('/api/sync', base).href, {
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      data: { operations: [
        { id: 'cross-comment-attempt', kind: 'journal.comment.add', payload: { id: 'bad-comment', journalId: 'journal.add-foreign-journal-create', body: 'Cross-family comment' } },
        { id: 'cross-reaction-attempt', kind: 'journal.react.toggle', payload: { id: 'bad-reaction', journalId: 'journal.add-foreign-journal-create', emoji: '👍' } },
        { id: 'cross-activity-attempt', kind: 'journal.add', payload: { id: 'bad-response', date, title: 'Cross-family response', body: 'No', shared: true, activityId: 'activity.add-foreign-activity-create' } },
      ] },
    });
    expect(foreign.status()).toBe(200);
    const result = await foreign.json();
    expect(Object.keys(result.rejected || {})).toHaveLength(3);
    expect(result.snapshot.journals.some(entry => entry.id === 'journal.add-foreign-journal-create')).toBe(false);

    const csrf = await aContext.request.post(new URL('/api/sync', base).href, {
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: cookies },
      data: { operations: [] },
    });
    expect(csrf.status()).toBe(403);
    const oversized = await a.evaluate(async () => {
      const response = await fetch('/api/sync', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: [{ id: 'oversized-e2e', kind: 'journal.add', payload: { id: 'oversized-entry', date: '2026-01-01', title: 'x'.repeat(300_000), shared: true } }] }),
      });
      return response.status;
    });
    expect([400, 413]).toContain(oversized);
    await aContext.close();
  });
});

test.describe('journal, canvas, prompts and offline-first behavior', () => {
  test('optional daily prompt can prefill the journal without requiring it', async ({ page }) => {
    await login(page, 'family_a');
    await page.locator('[data-tab=journal]').click();
    const prompt = (await page.locator('#daily-prompt-text').textContent()).trim();
    expect(prompt.length).toBeGreaterThan(10);
    await page.locator('#use-daily-prompt').click();
    await expect(page.locator('#journal-form textarea[name=body]')).toHaveValue(prompt);
    await page.locator('#journal-form textarea[name=body]').fill('Prompt dilewati—saya menulis hal lain.');
    await expect(page.locator('#journal-form textarea[name=body]')).toHaveValue('Prompt dilewati—saya menulis hal lain.');
  });

  test('canvas supports color, brush size, eraser, undo, backgrounds and saved artwork', async ({ page }) => {
    await login(page, 'family_a');
    await page.locator('[data-tab=journal]').click();
    await page.locator('#journal-entry-date').fill(await today(page));
    await page.locator('#journal-form input[name=title]').fill('Canvas memory');
    await page.locator('#journal-background').selectOption('dots');
    const canvas = page.locator('#journal-canvas');
    await canvas.scrollIntoViewIfNeeded();
    const baseImage = await canvas.evaluate(el => el.toDataURL());
    await page.locator('#journal-brush-size').evaluate(el => { el.value = '14'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('#journal-brush-value')).toHaveText('14');
    await page.locator('#journal-eraser').click();
    await expect(page.locator('#journal-eraser')).toHaveAttribute('aria-pressed', 'true');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 220, box.y + 120, { steps: 5 });
    await page.mouse.up();
    const drawnImage = await canvas.evaluate(el => el.toDataURL());
    expect(drawnImage).not.toBe(baseImage);
    await page.locator('#journal-undo').click();
    await expect.poll(() => canvas.evaluate(el => el.toDataURL())).toBe(baseImage);

    await page.locator('#journal-eraser').click();
    await page.locator('#journal-background').selectOption('sky');
    await page.locator('#journal-pen-color').evaluate(el => { el.value = '#ca5b48'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.mouse.move(box.x + 35, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 220, box.y + 115, { steps: 5 });
    await page.mouse.up();
    await page.locator('#journal-share').check();
    await page.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
    const card = page.locator('#journal-list .journal-card').filter({ hasText: 'Canvas memory' });
    await expect(card).toContainText('Canvas memory');
    await expect(card.locator('img')).toHaveCount(1);
  });

  test('shared journal queues while offline and synchronizes after reconnecting', async ({ page }) => {
    await login(page, 'family_a');
    await page.context().setOffline(true);
    await page.locator('[data-tab=journal]').click();
    await page.locator('#journal-entry-date').fill(await today(page));
    await page.locator('#journal-form input[name=title]').fill('Offline memory');
    await page.locator('#journal-form textarea[name=body]').fill('Saved while disconnected.');
    await page.locator('#journal-share').check();
    await page.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
    await expect(page.locator('#journal-list')).toContainText('Offline memory');
    await expect(page.locator('#sync-label')).toHaveText(/offline|menunggu/i);
    await page.context().setOffline(false);
    await waitForSync(page);
  });
});

test.describe('family reactions, comments, collaborative activities and memories', () => {
  test('family members can react and comment; other families cannot see the entry', async ({ browser }) => {
    const familyA = await browser.newContext();
    const a = await familyA.newPage();
    await login(a, 'family_a');
    await saveSharedEntry(a, 'Social memory', 'A moment for the family.');
    const card = a.locator('#journal-list .journal-card').filter({ hasText: 'Social memory' });
    const clap = card.locator('[data-react-entry][data-emoji="👏"]');
    await clap.click();
    await expect(clap).toHaveAttribute('aria-pressed', 'true');
    const commentForm = card.locator('[data-comment-entry]');
    await commentForm.locator('input[name=body]').fill('Aku juga ingat hari itu!');
    await commentForm.getByRole('button', { name: /kirim/i }).click();
    await expect(card).toContainText('Aku juga ingat hari itu!');
    await waitForSync(a);

    const familyB = await browser.newContext();
    const b = await familyB.newPage();
    await login(b, 'family_b');
    await b.locator('[data-tab=journal]').click();
    await expect(b.locator('#journal-list')).not.toContainText('Social memory');
    await familyA.close();
    await familyB.close();
  });

  test('a dated family challenge accepts a response and updates the weekly memory', async ({ page }) => {
    await login(page, 'family_a');
    await page.locator('[data-tab=journal]').click();
    const previousMemoryCount = Number((await page.locator('#weekly-memory h3').textContent()).match(/\d+/)?.[0] || 0);
    const date = await today(page);
    await page.locator('#activity-date').fill(date);
    await page.locator('#activity-title').fill('Draw our happy place');
    await page.locator('#activity-prompt').fill('Draw a place where our family feels happy.');
    await page.locator('#activity-form').getByRole('button', { name: /mulai tantangan/i }).click();
    const activity = page.locator('#activities-list .activity-card').filter({ hasText: 'Draw our happy place' });
    await expect(activity).toContainText('Draw a place where our family feels happy.');
    await activity.getByRole('button', { name: /ikut tantangan/i }).click();
    await expect(page.locator('#journal-share')).toBeChecked();
    await expect(page.locator('#journal-activity-id')).not.toHaveValue('');
    await page.locator('#journal-form input[name=title]').fill('Our garden answer');
    await page.locator('#journal-form textarea[name=body]').fill('We feel happy in our garden.');
    await page.locator('#journal-form').getByRole('button', { name: /simpan/i }).click();
    await expect(page.locator('#journal-list')).toContainText('Our garden answer');
    await expect(page.locator('#journal-list')).toContainText('Tantangan: Draw our happy place');
    await expect(page.locator('#weekly-memory h3')).toContainText(`${previousMemoryCount + 1} kenangan`);
    await waitForSync(page);
  });
});
