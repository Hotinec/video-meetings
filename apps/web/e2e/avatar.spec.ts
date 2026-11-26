import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const stamp = Date.now().toString(36);
const password = 'password123';

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// The page has two forms (avatar, username), each with its own Save button.
const saveButton = (page: Page) =>
  page
    .locator('form')
    .filter({ has: page.getByLabel('Avatar', { exact: true }) })
    .getByRole('button', { name: 'Save' });

const SAVED_AVATAR = 'img[src^="/api/users/"][src$="/avatar"]';

async function register(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/register', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
}

test('user uploads an avatar and sees it on /profile and the home page', async ({ page }) => {
  await register(page.request, `pw-av-ok-${stamp}@example.com`);
  await page.goto('/profile');

  await page.getByLabel('Avatar', { exact: true }).setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByAltText('Preview of the selected avatar')).toBeVisible();
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Avatar saved.');
  await expect(page.locator(SAVED_AVATAR).first()).toBeVisible();

  await page.goto('/');
  await expect(page.locator(SAVED_AVATAR).first()).toBeVisible();
});

test('an invalid file type shows an error and keeps the old avatar', async ({ page }) => {
  await register(page.request, `pw-av-bad-${stamp}@example.com`);
  await page.goto('/profile');

  const input = page.getByLabel('Avatar', { exact: true });
  await input.setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await saveButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Avatar saved.');
  await expect(page.locator(SAVED_AVATAR).first()).toBeVisible();

  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.locator('#avatar-error')).toHaveText(
    'File type not allowed. Allowed types: JPEG, PNG, WebP',
  );
  await expect(saveButton(page)).toBeDisabled();
  await expect(page.locator(SAVED_AVATAR).first()).toBeVisible();

  await page.reload();
  await expect(page.locator(SAVED_AVATAR).first()).toBeVisible();
});
