import { expect, test, type Page } from '@playwright/test';

const stamp = Date.now().toString(36);
const password = 'password123';
const newPassword = 'new-password456';

async function fillAndSubmit(page: Page, oldPw: string, nextPw: string) {
  await page.getByLabel('Current password', { exact: true }).fill(oldPw);
  await page.getByLabel('New password', { exact: true }).fill(nextPw);
  await page.getByLabel('Confirm new password', { exact: true }).fill(nextPw);
  await page.getByRole('button', { name: 'Change password' }).click();
}

test('user changes their password; only the new one logs in afterwards', async ({
  page,
  browser,
  baseURL,
}) => {
  const email = `pw-change-ok-${stamp}@example.com`;
  const res = await page.request.post('/api/auth/register', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  await page.goto('/profile');

  await fillAndSubmit(page, password, newPassword);
  await expect(page.getByText('Password changed.')).toBeVisible();
  await expect(page.getByLabel('Current password', { exact: true })).toHaveValue('');

  const fresh = await browser.newContext({ baseURL });
  const oldLogin = await fresh.request.post('/api/auth/login', { data: { email, password } });
  expect(oldLogin.ok()).toBeFalsy();
  const newLogin = await fresh.request.post('/api/auth/login', {
    data: { email, password: newPassword },
  });
  expect(newLogin.ok()).toBeTruthy();
  await fresh.close();
});

test('a wrong current password shows an error, keeps the session and the old password', async ({
  page,
  browser,
  baseURL,
}) => {
  const email = `pw-change-bad-${stamp}@example.com`;
  const res = await page.request.post('/api/auth/register', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  await page.goto('/profile');

  await fillAndSubmit(page, 'not-the-password', newPassword);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Password changed.')).toHaveCount(0);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue(newPassword);

  const fresh = await browser.newContext({ baseURL });
  const login = await fresh.request.post('/api/auth/login', { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  await fresh.close();
});
