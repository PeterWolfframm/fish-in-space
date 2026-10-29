// Smoke: the station boots, the tank canvas draws, every room opens, and nothing throws.
import { test, expect } from '@playwright/test';

test('boots and visits every room', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('.scene canvas')).toBeVisible();
  // The roster is open by default for small tanks; bigger tanks fold it behind a toggle.
  const toggle = page.locator('.roster-toggle');
  if (await toggle.count()) await toggle.click();
  await expect(page.locator('.roster button').first()).toBeVisible();
  await page.waitForTimeout(1500);
  // A blank or solid canvas compresses to a tiny PNG; the tank with fish and plants does not.
  const png = await page.locator('.scene canvas').screenshot();
  expect(png.byteLength).toBeGreaterThan(20_000);
  for (const name of ['Bridge', 'X-change', 'PIP', 'Lab', 'Fish-der', 'Hatchery']) {
    await page.locator('.dock button', { hasText: name }).click();
    await page.waitForTimeout(400);
  }
  await page.locator('.dock button', { hasText: 'Hatchery' }).click();
  if (await toggle.count()) await toggle.click();
  await page.locator('.roster button').first().click();
  await expect(page.locator('.post')).toBeVisible();
  expect(errors).toEqual([]);
});
