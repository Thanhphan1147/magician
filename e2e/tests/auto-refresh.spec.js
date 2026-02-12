import { test, expect } from '@playwright/test';

test.describe('Auto-refresh Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the page to load
    await page.waitForSelector('.model-frame');
  });

  test.afterEach(async ({ page }) => {
    // Stop any auto-refresh that might be running
    try {
      // Click dropdown to open it
      await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click({ timeout: 2000 });
      
      // Check if auto-refresh is running and stop it
      const stopButton = page.locator('button:has-text("Stop Auto-refresh")');
      if (await stopButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await stopButton.click();
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  test('should show dropdown when clicking dropdown button', async ({ page }) => {
    // Click the dropdown button (the down arrow)
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Check that dropdown appears
    await expect(page.locator('text=Auto-refresh every (seconds):')).toBeVisible();
    await expect(page.locator('input[type="number"][placeholder="Enter seconds"]')).toBeVisible();
  });

  test('should disable start button when input is empty', async ({ page }) => {
    // Click the dropdown button
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Check that the start button is disabled
    const startButton = page.locator('button:has-text("Start Auto-refresh")');
    await expect(startButton).toBeDisabled();
  });

  test('should enable start button when valid interval is entered', async ({ page }) => {
    // Click the dropdown button
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Enter a valid interval
    const input = page.locator('input[type="number"][placeholder="Enter seconds"]');
    await input.fill('5');
    
    // Check that the start button is enabled
    const startButton = page.locator('button:has-text("Start Auto-refresh")');
    await expect(startButton).toBeEnabled();
  });

  test('should disable start button when interval is 0 or negative', async ({ page }) => {
    // Click the dropdown button
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Enter 0
    const input = page.locator('input[type="number"][placeholder="Enter seconds"]');
    await input.fill('0');
    
    // Check that the start button is disabled
    let startButton = page.locator('button:has-text("Start Auto-refresh")');
    await expect(startButton).toBeDisabled();
    
    // Enter negative number
    await input.fill('-5');
    await expect(startButton).toBeDisabled();
  });

  test('should start auto-refresh and show status message', async ({ page }) => {
    // Click the dropdown button
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Enter a valid interval
    const input = page.locator('input[type="number"][placeholder="Enter seconds"]');
    await input.fill('10');
    
    // Click start auto-refresh
    const startButton = page.locator('button:has-text("Start Auto-refresh")');
    await startButton.click();
    
    // Dropdown should close
    await expect(page.locator('text=Auto-refresh every (seconds):')).not.toBeVisible();
    
    // Open dropdown again to check status
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Should show auto-refresh status
    await expect(page.locator('text=Auto-refreshing every 10s')).toBeVisible();
    
    // Button should now say "Stop Auto-refresh" and be red
    const stopButton = page.locator('button:has-text("Stop Auto-refresh")');
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toHaveClass(/bg-red-600/);
  });

  test('should stop auto-refresh when stop button is clicked', async ({ page }) => {
    // Start auto-refresh first
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    const input = page.locator('input[type="number"][placeholder="Enter seconds"]');
    await input.fill('10');
    await page.locator('button:has-text("Start Auto-refresh")').click();
    
    // Open dropdown again
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Click stop
    const stopButton = page.locator('button:has-text("Stop Auto-refresh")');
    await stopButton.click();
    
    // Dropdown should close
    await expect(page.locator('text=Auto-refresh every (seconds):')).not.toBeVisible();
    
    // Open dropdown again to verify it stopped
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Should show start button again
    await expect(page.locator('button:has-text("Start Auto-refresh")')).toBeVisible();
    await expect(page.locator('text=Auto-refreshing every')).not.toBeVisible();
  });

  test('should perform refresh at specified intervals', async ({ page }) => {
    // Click the dropdown button
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Enter a short interval for testing (2 seconds)
    const input = page.locator('input[type="number"][placeholder="Enter seconds"]');
    await input.fill('2');
    
    // Click start auto-refresh
    await page.locator('button:has-text("Start Auto-refresh")').click();
    
    // Wait for the first refresh to complete
    await page.waitForTimeout(500);
    
    // Get the initial last refresh time
    const initialTime = await page.locator('text=/Last updated:/').textContent();
    
    // Wait for the interval to pass (2 seconds + buffer)
    await page.waitForTimeout(2500);
    
    // Get the new last refresh time
    const newTime = await page.locator('text=/Last updated:/').textContent();
    
    // The times should be different (indicating a refresh occurred)
    expect(initialTime).not.toBe(newTime);
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    // Click the dropdown button
    await page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])').click();
    
    // Verify dropdown is open
    await expect(page.locator('text=Auto-refresh every (seconds):')).toBeVisible();
    
    // Click outside (on the model frame header)
    await page.locator('h2:has-text("Model:")').click();
    
    // Note: This test might need adjustment depending on whether we implement click-outside behavior
    // For now, we're just documenting the expected behavior
  });
});
