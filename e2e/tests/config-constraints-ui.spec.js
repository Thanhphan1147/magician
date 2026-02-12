import { test, expect } from '@playwright/test';

test.describe('Config and Constraints UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://10.71.108.112:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should add and remove config key-value pairs', async ({ page }) => {
    // Click "Add Charm Node" button to add a charm template
    await page.click('button:has-text("Add Charm Node")');
    await page.waitForTimeout(500);

    // Fill in the charm name
    await page.fill('input[placeholder="Charm name"]', 'postgresql-k8s');
    await page.waitForTimeout(300);

    // Click "More options" to expand the config/constraints section
    await page.click('button:has-text("More options")');
    await page.waitForTimeout(300);

    // Verify initial state: should have one config pair by default
    const initialConfigKeys = await page.locator('.config-pair input[placeholder="key"]').count();
    expect(initialConfigKeys).toBeGreaterThanOrEqual(1);

    // Add a config key-value pair
    await page.locator('.config-pair').first().locator('input[placeholder="key"]').fill('max_connections');
    await page.locator('.config-pair').first().locator('input[placeholder="value"]').fill('100');

    // Click "Add Config" button to add another pair
    await page.click('button:has-text("+ Add Config")');
    await page.waitForTimeout(300);

    // Verify we now have 2 config pairs
    const configPairsAfterAdd = await page.locator('.config-pair').count();
    expect(configPairsAfterAdd).toBe(2);

    // Fill the second pair
    await page.locator('.config-pair').nth(1).locator('input[placeholder="key"]').fill('shared_buffers');
    await page.locator('.config-pair').nth(1).locator('input[placeholder="value"]').fill('256MB');

    // Remove the first config pair
    await page.locator('.config-pair').nth(0).locator('button[title="Remove"]').click();
    await page.waitForTimeout(300);

    // Verify we're back to 1 config pair
    const configPairsAfterRemove = await page.locator('.config-pair').count();
    expect(configPairsAfterRemove).toBe(1);

    // Verify the remaining pair has the second values
    const remainingKey = await page.locator('.config-pair input[placeholder="key"]').inputValue();
    const remainingValue = await page.locator('.config-pair input[placeholder="value"]').inputValue();
    expect(remainingKey).toBe('shared_buffers');
    expect(remainingValue).toBe('256MB');
  });

  test('should add and remove constraint key-value pairs', async ({ page }) => {
    // Click "Add Charm Node" button to add a charm template
    await page.click('button:has-text("Add Charm Node")');
    await page.waitForTimeout(500);

    // Fill in the charm name
    await page.fill('input[placeholder="Charm name"]', 'postgresql-k8s');
    await page.waitForTimeout(300);

    // Click "More options" to expand the config/constraints section
    await page.click('button:has-text("More options")');
    await page.waitForTimeout(300);

    // Verify initial state: should have one constraint pair by default
    const initialConstraintKeys = await page.locator('.constraint-pair input[placeholder="key"]').count();
    expect(initialConstraintKeys).toBeGreaterThanOrEqual(1);

    // Add a constraint key-value pair
    await page.locator('.constraint-pair').first().locator('input[placeholder="key"]').fill('mem');
    await page.locator('.constraint-pair').first().locator('input[placeholder="value"]').fill('4G');

    // Click "Add Constraint" button to add another pair
    await page.click('button:has-text("+ Add Constraint")');
    await page.waitForTimeout(300);

    // Verify we now have 2 constraint pairs
    const constraintPairsAfterAdd = await page.locator('.constraint-pair').count();
    expect(constraintPairsAfterAdd).toBe(2);

    // Fill the second pair
    await page.locator('.constraint-pair').nth(1).locator('input[placeholder="key"]').fill('cores');
    await page.locator('.constraint-pair').nth(1).locator('input[placeholder="value"]').fill('2');

    // Remove the first constraint pair
    await page.locator('.constraint-pair').nth(0).locator('button[title="Remove"]').click();
    await page.waitForTimeout(300);

    // Verify we're back to 1 constraint pair
    const constraintPairsAfterRemove = await page.locator('.constraint-pair').count();
    expect(constraintPairsAfterRemove).toBe(1);

    // Verify the remaining pair has the second values
    const remainingKey = await page.locator('.constraint-pair input[placeholder="key"]').inputValue();
    const remainingValue = await page.locator('.constraint-pair input[placeholder="value"]').inputValue();
    expect(remainingKey).toBe('cores');
    expect(remainingValue).toBe('2');
  });

  test('should persist config/constraints when deploying charm', async ({ page }) => {
    // Click "Add Charm Node" button
    await page.click('button:has-text("Add Charm Node")');
    await page.waitForTimeout(500);

    // Fill in the charm name
    await page.fill('input[placeholder="Charm name"]', 'postgresql-k8s');
    await page.waitForTimeout(300);

    // Click "More options" to expand
    await page.click('button:has-text("More options")');
    await page.waitForTimeout(300);

    // Add config values
    await page.locator('.config-pair').first().locator('input[placeholder="key"]').fill('max_connections');
    await page.locator('.config-pair').first().locator('input[placeholder="value"]').fill('100');

    // Add constraint values
    await page.locator('.constraint-pair').first().locator('input[placeholder="key"]').fill('mem');
    await page.locator('.constraint-pair').first().locator('input[placeholder="value"]').fill('4G');

    // Verify the inputs are there
    const configKey = await page.locator('.config-pair input[placeholder="key"]').inputValue();
    const configValue = await page.locator('.config-pair input[placeholder="value"]').inputValue();
    const constraintKey = await page.locator('.constraint-pair input[placeholder="key"]').inputValue();
    const constraintValue = await page.locator('.constraint-pair input[placeholder="value"]').inputValue();

    expect(configKey).toBe('max_connections');
    expect(configValue).toBe('100');
    expect(constraintKey).toBe('mem');
    expect(constraintValue).toBe('4G');
  });
});
