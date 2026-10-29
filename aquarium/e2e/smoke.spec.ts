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
  for (const name of ['Bridge', 'Interchange', 'PIP', 'Lab', 'Fish-der', 'Hatchery']) {
    // On a phone Fish-der hides the dock; its own "Return to fish" brings it back.
    if (!(await page.locator('.dock').isVisible())) await page.getByRole('button', { name: 'Return to fish' }).click();
    await page.locator('.dock button', { hasText: name }).click();
    await page.waitForTimeout(400);
  }
  await page.locator('.dock button', { hasText: 'Hatchery' }).click();
  if (await toggle.count()) await toggle.click();
  await page.locator('.roster button').first().click();
  await expect(page.locator('.post')).toBeVisible();
  expect(errors).toEqual([]);
});

test('fish-der: tabs, the profile sheet, and on a phone the whole screen', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.locator('.dock button', { hasText: 'Fish-der' }).click();
  await expect(page.locator('.fd-tabs')).toBeVisible();
  // The intro comms float over the bottom of whichever room is up, so press buttons directly.
  const press = (name: string) => page.getByRole('button', { name, exact: true }).dispatchEvent('click');
  const phone = info.project.name === 'phone';
  await expect(page.locator('.dock')).toBeVisible({ visible: !phone });
  await expect(page.locator('.panel')).toHaveCount(0);

  // The full profile slides up over the fish and goes again.
  const card = page.locator('.tcard.top');
  await expect(card).toBeVisible();
  await card.locator('.more').dispatchEvent('click');
  await expect(card.locator('.info-sheet.open')).toBeVisible();
  await expect(card.locator('.info-sheet dl.facts').first()).toBeVisible();
  await card.getByRole('button', { name: 'Back to the fish' }).dispatchEvent('click');
  await expect(card.locator('.info-sheet.open')).toHaveCount(0);

  // Ten photos: the profile, two pairs of life stages, seven animations.
  await expect(card.locator('.pips i')).toHaveCount(10);

  // A super like lands in S tier and in the gallery.
  await press('Super like');
  await press('Tier list');
  await expect(page.locator('.tier.t-S .tier-fish')).toHaveCount(1);
  await press('Gallery');
  await expect(page.locator('.like-cell')).toHaveCount(1);
  await page.locator('.like-cell').dispatchEvent('click');
  await expect(page.locator('.liked-view .tcard')).toBeVisible();
  await press('Your stats');
  await expect(page.locator('.stat-tiles')).toBeVisible();
  await press('Swipe');

  if (phone) {
    await press('Return to fish');
    await expect(page.locator('.dock')).toBeVisible();
    await expect(page.locator('.station')).toHaveClass(/room-hatchery/);
  } else {
    await expect(page.getByRole('button', { name: 'Return to fish' })).toBeHidden();
  }
  expect(errors).toEqual([]);
});
