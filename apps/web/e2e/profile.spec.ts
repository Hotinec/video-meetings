import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const stamp = Date.now().toString(36);
const password = 'password123';

async function register(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/register', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
}

async function saveUsername(page: Page, username: string) {
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Save' }).click();
}

test('unauthenticated visitor is redirected from /profile to /login', async ({ page }) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});

test('user changes their username and sees it on the home page', async ({ page }) => {
  await register(page.request, `pw-ok-${stamp}@example.com`);
  await page.goto('/profile');

  await saveUsername(page, `ok_${stamp}`);
  await expect(page.getByRole('status')).toHaveText('Username saved.');

  await page.goto('/');
  await expect(page.getByText(`ok_${stamp}`).first()).toBeVisible();
});

test('a duplicate username (different case) shows an error and keeps the input', async ({
  browser,
  baseURL,
  page,
}) => {
  const other = await browser.newContext({ baseURL });
  const otherPage = await other.newPage();
  await register(otherPage.request, `pw-dup-a-${stamp}@example.com`);
  await otherPage.goto('/profile');
  await saveUsername(otherPage, `Taken_${stamp}`);
  await expect(otherPage.getByRole('status')).toBeVisible();
  await other.close();

  await register(page.request, `pw-dup-b-${stamp}@example.com`);
  await page.goto('/profile');
  const attempt = `taken_${stamp}`;
  await saveUsername(page, attempt);
  // Scoped by id: Next's route announcer also exposes a role="alert" in an open shadow root.
  await expect(page.locator('#username-error')).toHaveText('Username is already taken');
  await expect(page.getByLabel('Username')).toHaveValue(attempt);
});
