// Studio smoke: opt-in (STUDIO=1) since it's a dev tool.
import { test, expect } from '@playwright/test';

test.skip(!process.env.STUDIO, 'set STUDIO=1 to run the Algorithm Studio smoke test');

test('studio boots, switches generators, animates, and edits traits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/studio.html');
  const canvas = page.locator('canvas.studio-sprite');
  await expect(canvas).toBeVisible();

  const genSelect = page.locator('.studio-toolbar select').first();
  const options = await genSelect.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(5);

  for (const id of ['pilot', 'fish', 'fish4', 'plant', 'waterplant']) {
    const hasOption = (await genSelect.locator(`option[value="${id}"]`).count()) > 0;
    if (!hasOption) continue;
    await genSelect.selectOption(id);
    await page.waitForTimeout(300);
    await expect(canvas).toBeVisible();
  }

  await genSelect.selectOption('fish4');
  await expect(page.locator('.studio-params')).toBeVisible();
  await expect(page.locator('.studio-traits')).toBeVisible();

  const before = await canvas.screenshot();
  const traitSelect = page.locator('.studio-traits select').first();
  if (await traitSelect.count()) {
    const traitOptions = await traitSelect.locator('option').allTextContents();
    if (traitOptions.length > 1) {
      await traitSelect.selectOption({ index: 1 });
      await page.waitForTimeout(200);
      const after = await canvas.screenshot();
      expect(Buffer.compare(before, after)).not.toBe(0);
    }
  }

  expect(errors).toEqual([]);
});
