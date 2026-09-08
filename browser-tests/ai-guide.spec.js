import { expect, test } from '@playwright/test';

test('AI Guide supports a sourced conversation and visible citation', async ({ page }) => {
  await page.route('**/api/ai', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    status: 'source-excerpt', enabled: true, answer: 'Freedom Park is in Salvokop, Pretoria.',
    label: 'Experimental source-locked excerpt.', sourceIds: ['freedom-park'],
  }) }));
  await page.goto('/ai');
  await page.getByLabel('Ask the AI Guide').fill('What is Freedom Park?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('What is Freedom Park?')).toBeVisible();
  await expect(page.getByText('Freedom Park is in Salvokop, Pretoria.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Freedom Park/ })).toHaveAttribute('href', 'https://www.freedompark.co.za/');
});

test('AI Guide explains when a question lacks source support', async ({ page }) => {
  await page.route('**/api/ai', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    status: 'fallback', enabled: false, reason: 'insufficient-source-evidence', sourceIds: [],
  }) }));
  await page.goto('/ai');
  await page.getByLabel('Ask the AI Guide').fill('What did a stationmaster eat in 1902?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText(/will not invent an answer/)).toBeVisible();
});
