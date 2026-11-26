import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const stamp = Date.now().toString(36);
const SHOTS = path.resolve(__dirname, '../../../screenshot');
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

async function expectNoAxeViolations(page: Page) {
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const violations = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (window as any).axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return res.violations.map(
      (v: any) => `${v.id}: ${v.nodes.map((n: any) => n.target).join(' | ')}`,
    );
  });
  expect(violations).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const vp of viewports) {
  test.describe(`/profile at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      const unique = Math.random().toString(36).slice(2, 8);
      const res = await page.request.post('/api/auth/register', {
        data: { email: `pw-ui-${vp.name}-${stamp}-${unique}@example.com`, password: 'password123' },
      });
      expect(res.ok()).toBeTruthy();
    });

    test('layout fits the viewport and the avatar has alt text', async ({ page }) => {
      await page.goto('/profile');
      await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expect(page.getByRole('img', { name: /^Avatar of / }).first()).toBeVisible();
      await page.screenshot({
        path: path.join(SHOTS, `profile-ui-${vp.name}.png`),
        fullPage: true,
      });

      await page.goto('/');
      await expectNoHorizontalScroll(page);
      await expect(page.getByRole('img', { name: /^Avatar of / }).first()).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `home-ui-${vp.name}.png`), fullPage: true });
    });

    test('passes the axe accessibility audit (contrast, labels, names)', async ({ page }) => {
      await page.goto('/profile');
      await expectNoAxeViolations(page);
      await page.goto('/');
      await expectNoAxeViolations(page);
    });

    test('all forms are reachable and operable with the keyboard', async ({ page }) => {
      await page.goto('/profile');

      // Tab order reaches every form control.
      await page.locator('body').click({ position: { x: 0, y: 0 } });
      const seen = new Set<string>();
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        const id = await page.evaluate(() => document.activeElement?.id ?? '');
        if (id) seen.add(id);
      }
      expect(seen).toContain('avatar');
      expect(seen).toContain('username');
      expect([...seen].some((id) => id.includes('password'))).toBeTruthy();

      // Submit the username form with Enter only.
      await page.getByLabel('Username').fill(`kb_${vp.name}_${stamp}`);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toHaveText('Username saved.');
    });
  });
}
