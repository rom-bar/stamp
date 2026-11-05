'use strict';

const { test, expect } = require('@playwright/test');
const { login, syncOperations, op } = require('./helpers');

const PASSWORD = 'Test-password-2026';

function isoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function pngFixture() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGO8ExDAwMDAxMDAwMDAAAAShgGAfGAxEQAAAABJRU5ErkJggg==', 'base64');
}

function mp4Fixture() {
  return Buffer.from('000000186674797069736f6d0000020069736f6d69736f3261766331', 'hex');
}

async function bootstrap(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/bootstrap', { credentials: 'same-origin', cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  });
}

async function waitForSync(page) {
  await expect.poll(async () => (await page.locator('#sync-label').textContent()) || '', { timeout: 12_000 })
    .toMatch(/^Tersinkron$/i);
}

async function inviteMember(page, username) {
  return page.evaluate(async ({ username, password }) => {
    const response = await fetch('/api/invite', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, role: 'member' }),
    });
    return { status: response.status, body: await response.json(), password };
  }, { username, password: PASSWORD });
}

async function familyUserId(page, username) {
  const snapshot = await bootstrap(page);
  expect(snapshot.status).toBe(200);
  const users = snapshot.body.members || snapshot.body.users || [];
  const user = users.find(item => item.username === username);
  if (user) return user.id;
  if (snapshot.body.user?.username === username) return snapshot.body.user.id;
  return snapshot.body.user?.id;
}

test.describe('media and calendar', () => {
  test('shared journal accepts image and video media, serves them to the family, and survives reload', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, 'family_a');
    await page.locator('[data-tab=journal]').click();

    const title = `Media memory ${Date.now()}`;
    await page.locator('#journal-entry-date').fill(isoDate());
    await page.locator('#journal-form input[name=title]').fill(title);
    await page.locator('#journal-form textarea[name=body]').fill('Image and video fixture coverage.');
    await page.locator('#journal-share').check();
    await page.locator('#journal-media-input').setInputFiles([
      { name: 'memory.png', mimeType: 'image/png', buffer: pngFixture() },
      { name: 'memory.mp4', mimeType: 'video/mp4', buffer: mp4Fixture() },
    ]);
    await expect(page.locator('.media-preview-item')).toHaveCount(2);
    await page.locator('#journal-form button[type=submit]').click();

    const card = page.locator('.journal-card').filter({ hasText: title }).last();
    await expect(card).toContainText(title);
    const grid = card.locator('.journal-media-grid');
    await expect(grid).toBeVisible();
    await expect(grid.locator('.journal-media-item img')).toHaveCount(1);
    await expect(grid.locator('.journal-media-item video')).toHaveCount(1);
    await expect(grid.locator('.journal-media-item')).toHaveCount(2);
    const mediaIds = await grid.locator('.journal-media-item').evaluateAll(items => items.map(item => item.dataset.mediaId));
    expect(mediaIds).toHaveLength(2);
    expect(mediaIds.every(Boolean)).toBe(true);
    await waitForSync(page);

    const snapshot = await bootstrap(page);
    const journal = snapshot.body.journals.find(entry => entry.title === title);
    expect(journal).toBeTruthy();
    expect(journal.media).toHaveLength(2);
    for (const id of mediaIds) {
      const response = await page.request.get(`/api/media/${encodeURIComponent(id)}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^(image\/jpeg|video\/mp4)/);
    }

    await page.reload();
    await page.locator('[data-tab=journal]').click();
    const reloadedCard = page.locator('.journal-card').filter({ hasText: title }).last();
    await expect(reloadedCard.locator('.journal-media-item img')).toHaveCount(1);
    await expect(reloadedCard.locator('.journal-media-item video')).toHaveCount(1);
    await context.close();
  });

  test('shared journal media remains visible offline and syncs after reconnecting', async ({ page }) => {
    await login(page, 'family_a');
    await page.context().setOffline(true);
    await page.locator('[data-tab=journal]').click();
    const title = `Offline media ${Date.now()}`;
    await page.locator('#journal-entry-date').fill(isoDate());
    await page.locator('#journal-form input[name=title]').fill(title);
    await page.locator('#journal-share').check();
    await page.locator('#journal-media-input').setInputFiles({ name:'offline.png', mimeType:'image/png', buffer:pngFixture() });
    await expect(page.locator('.media-preview-item')).toHaveCount(1);
    await page.locator('#journal-form button[type=submit]').click();
    const card = page.locator('.journal-card').filter({ hasText:title }).last();
    await expect(card.locator('.journal-media-item img')).toHaveCount(1);
    await expect(page.locator('#sync-label')).toContainText(/offline|menunggu/i);
    await page.context().setOffline(false);
    await waitForSync(page);
    const saved = (await bootstrap(page)).body.journals.find(entry => entry.title === title);
    expect(saved?.media).toHaveLength(1);
    const mediaResponse = await page.request.get(`/api/media/${encodeURIComponent(saved.media[0].id)}`);
    expect(mediaResponse.status()).toBe(200);
  });

  test('calendar form creates member-assigned task and all-family event with schedule', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, 'family_a');
    const username = `calendar-member-${Date.now()}`;
    const invite = await inviteMember(page, username);
    expect(invite.status).toBe(201);
    const memberId = await familyUserId(page, username);
    expect(memberId).toBeTruthy();
    await page.reload();

    await page.locator('[data-tab=calendar]').click();
    await expect(page.locator('#panel-calendar')).toBeVisible();
    const date = isoDate(1);
    await page.locator('#calendar-date').fill(date);
    await page.locator('#calendar-time').fill('09:30');
    await page.locator('#calendar-title').fill('Member task');
    await page.locator('#calendar-description').fill('Assigned task description');
    await page.locator('#calendar-assignee').selectOption(memberId);
    await page.locator('#calendar-kind').selectOption('task');
    await page.locator('#calendar-event-form button[type=submit]').click();
    await expect(page.locator('#calendar-grid')).toContainText('Member task');
    await expect(page.locator('#calendar-grid')).toContainText(username);
    await expect(page.locator('#calendar-grid')).toContainText('09:30');

    await page.locator('#calendar-date').fill(date);
    await page.locator('#calendar-time').fill('18:00');
    await page.locator('#calendar-title').fill('Family activity');
    await page.locator('#calendar-description').fill('Everyone is invited');
    await page.locator('#calendar-assignee').selectOption('all');
    await page.locator('#calendar-kind').selectOption('activity');
    await page.locator('#calendar-event-form button[type=submit]').click();
    const events = page.locator('#calendar-grid .calendar-event');
    await expect(events.filter({ hasText: 'Family activity' })).toContainText(/seluruh|all/i);
    await expect(events.filter({ hasText: 'Family activity' })).toContainText('18:00');
    await waitForSync(page);
    await context.close();
  });

  test('calendar and media enforce family, type, signature, and size boundaries', async ({ browser }) => {
    const familyAContext = await browser.newContext();
    const familyAPage = await familyAContext.newPage();
    await login(familyAPage, 'family_a');
    const familyAUserId = await familyUserId(familyAPage, 'family_a');

    const familyBContext = await browser.newContext();
    const familyBPage = await familyBContext.newPage();
    await login(familyBPage, 'family_b');
    const familyBUserId = await familyUserId(familyBPage, 'family_b');
    expect(familyAUserId).not.toBe(familyBUserId);

    const rejected = await familyAPage.evaluate(async ({ foreignId }) => {
      const response = await fetch('/api/sync', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: [{ id: `calendar-cross-family-${Date.now()}`, kind: 'calendar.add', payload: {
          id: `calendar-cross-family-entry-${Date.now()}`, date: '2026-11-06', time: '12:00', title: 'Must reject', description: '', assigneeId: foreignId, kind: 'task',
        } }] }),
      });
      return { status: response.status, body: await response.json() };
    }, { foreignId: familyBUserId });
    expect(rejected.status).toBe(200);
    expect(Object.keys(rejected.body.rejected || {})).toHaveLength(1);

    const invalidAttempts = await familyAPage.evaluate(async ({ unsupported, malformed, oversized }) => {
      const upload = (index, type, data) => fetch('/api/media/upload', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ operationId:`invalid-media-operation-${Date.now()}-${index}`, id:`invalid-media-entry-${Date.now()}-${index}`, type, data })
      });
      const responses = await Promise.all([
        upload(1, 'text/plain', unsupported),
        upload(2, 'image/jpeg', malformed),
        upload(3, 'image/jpeg', oversized),
      ]);
      return responses.map(response => response.status);
    }, {
      unsupported: Buffer.from('not supported').toString('base64'),
      malformed: Buffer.from('not an image').toString('base64'),
      oversized: Buffer.alloc(5 * 1024 * 1024, 0xff).toString('base64'),
    });
    expect(invalidAttempts.every(status => status === 400 || status === 413)).toBe(true);
    const familyBTitle = `Family B media ${Date.now()}`;
    const familyBMediaID = `family-b-media-${Date.now()}`;
    const familyBUpload = await familyBPage.evaluate(async ({ id, title, date, data }) => {
      const upload = await fetch('/api/media/upload', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ operationId:`upload-${id}`, id, type:'image/jpeg', data })
      });
      const uploadBody = await upload.json();
      if (!upload.ok) return { uploadStatus:upload.status, uploadBody };
      const operationID = `journal-${id}`;
      const sync = await fetch('/api/sync', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ operations:[{ id:operationID, kind:'journal.add', payload:{ id:`entry-${id}`, date, title, body:'', shared:true, mediaIds:[id] } }] })
      });
      const syncBody = await sync.json();
      return { uploadStatus:upload.status, uploadBody, syncStatus:sync.status, syncBody, mediaID:id };
    }, {
      id:familyBMediaID, title:familyBTitle, date:isoDate(),
      data:Buffer.from([0xff,0xd8,0xff,0x00]).toString('base64'),
    });
    expect(familyBUpload.uploadStatus).toBe(201);
    expect(familyBUpload.syncStatus).toBe(200);
    expect(familyBUpload.syncBody.applied).toContain(`journal-${familyBMediaID}`);
    const validMedia = await bootstrap(familyBPage);
    const foreignMediaId = validMedia.body.journals?.find(entry => entry.title === familyBTitle)?.media?.[0]?.id;
    expect(foreignMediaId).toBeTruthy();
    const ownMedia = await familyBPage.request.get(`/api/media/${encodeURIComponent(foreignMediaId)}`);
    expect(ownMedia.status()).toBe(200);
    const response = await familyAPage.request.get(`/api/media/${encodeURIComponent(foreignMediaId)}`);
    expect([403, 404]).toContain(response.status());
    await familyAContext.close();
    await familyBContext.close();
  });
});
