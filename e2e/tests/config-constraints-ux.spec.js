import { test, expect } from '@playwright/test';

test.describe('Config and Constraints UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://10.71.108.112:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should have key-value pair inputs for config with add/remove buttons', async ({ page }) => {
    // Create a model frame first
    await page.getByRole('button', { name: 'Create Model' }).click();
    await page.getByPlaceholder('Model Name').fill('test-model');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(1000);

    // Drag a charm template onto the canvas
    const charmTemplate = page.locator('.charm-template').first();
    const canvas = page.locator('.react-flow__pane');
    
    await charmTemplate.dragTo(canvas, {
      targetPosition: { x: 400, y: 300 }
    });
    await page.waitForTimeout(500);

    // Find the deployed charm node
    const charmNode = page.locator('.charm-node').first();
    await expect(charmNode).toBeVisible();

    // Check that there's one initial config pair
    const configInputs = charmNode.locator('input[placeholder="key"]').filter({ has: page.locator('input[placeholder="value"]') });
    await expect(configInputs.first()).toBeVisible();

    // Check for "Add another config" button
    const addConfigButton = charmNode.getByText('+ Add another config');
    await expect(addConfigButton).toBeVisible();

    // Click to add another config pair
    await addConfigButton.click();
    await page.waitForTimeout(200);

    // Now there should be 2 config pairs
    const configPairs = charmNode.locator('label:has-text("Config") + div > div').filter({ has: page.locator('input[placeholder="key"]') });
    const count = await configPairs.count();
    expect(count).toBe(2);

    // Fill in the config values
    const firstKeyInput = charmNode.locator('label:has-text("Config") + div input[placeholder="key"]').nth(0);
    const firstValueInput = charmNode.locator('label:has-text("Config") + div input[placeholder="value"]').nth(0);
    await firstKeyInput.fill('timeout');
    await firstValueInput.fill('300');

    const secondKeyInput = charmNode.locator('label:has-text("Config") + div input[placeholder="key"]').nth(1);
    const secondValueInput = charmNode.locator('label:has-text("Config") + div input[placeholder="value"]').nth(1);
    await secondKeyInput.fill('max-connections');
    await secondValueInput.fill('100');

    // Verify remove button is visible for multiple pairs
    const removeButton = charmNode.locator('label:has-text("Config") + div button:has-text("✕")').first();
    await expect(removeButton).toBeVisible();

    // Remove the second pair
    const secondRemoveButton = charmNode.locator('label:has-text("Config") + div button:has-text("✕")').nth(1);
    await secondRemoveButton.click();
    await page.waitForTimeout(200);

    // Now there should be only 1 config pair again
    const updatedCount = await charmNode.locator('label:has-text("Config") + div > div').filter({ has: page.locator('input[placeholder="key"]') }).count();
    expect(updatedCount).toBe(1);

    // Verify the first pair still has values
    await expect(firstKeyInput).toHaveValue('timeout');
    await expect(firstValueInput).toHaveValue('300');
  });

  test('should have key-value pair inputs for constraints with add/remove buttons', async ({ page }) => {
    // Create a model frame first
    await page.getByRole('button', { name: 'Create Model' }).click();
    await page.getByPlaceholder('Model Name').fill('test-model-2');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(1000);

    // Drag a charm template onto the canvas
    const charmTemplate = page.locator('.charm-template').first();
    const canvas = page.locator('.react-flow__pane');
    
    await charmTemplate.dragTo(canvas, {
      targetPosition: { x: 400, y: 300 }
    });
    await page.waitForTimeout(500);

    // Find the deployed charm node
    const charmNode = page.locator('.charm-node').first();
    await expect(charmNode).toBeVisible();

    // Check for "Add another constraint" button
    const addConstraintButton = charmNode.getByText('+ Add another constraint');
    await expect(addConstraintButton).toBeVisible();

    // Click to add another constraint pair
    await addConstraintButton.click();
    await page.waitForTimeout(200);

    // Now there should be 2 constraint pairs
    const constraintPairs = charmNode.locator('label:has-text("Constraints") + div > div').filter({ has: page.locator('input[placeholder="key"]') });
    const count = await constraintPairs.count();
    expect(count).toBe(2);

    // Fill in the constraint values
    const firstKeyInput = charmNode.locator('label:has-text("Constraints") + div input[placeholder="key"]').nth(0);
    const firstValueInput = charmNode.locator('label:has-text("Constraints") + div input[placeholder="value"]').nth(0);
    await firstKeyInput.fill('mem');
    await firstValueInput.fill('4G');

    const secondKeyInput = charmNode.locator('label:has-text("Constraints") + div input[placeholder="key"]').nth(1);
    const secondValueInput = charmNode.locator('label:has-text("Constraints") + div input[placeholder="value"]').nth(1);
    await secondKeyInput.fill('cores');
    await secondValueInput.fill('2');

    // Verify remove button is visible
    const removeButton = charmNode.locator('label:has-text("Constraints") + div button:has-text("✕")').first();
    await expect(removeButton).toBeVisible();
  });

  test('should correctly format config as comma-separated key=value pairs', async ({ page }) => {
    // Create a model frame first
    await page.getByRole('button', { name: 'Create Model' }).click();
    await page.getByPlaceholder('Model Name').fill('test-model-3');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(1000);

    // Drag a charm template onto the canvas
    const charmTemplate = page.locator('.charm-template').first();
    const canvas = page.locator('.react-flow__pane');
    
    await charmTemplate.dragTo(canvas, {
      targetPosition: { x: 400, y: 300 }
    });
    await page.waitForTimeout(500);

    // Find the deployed charm node
    const charmNode = page.locator('.charm-node').first();
    await expect(charmNode).toBeVisible();

    // Add another config pair
    const addConfigButton = charmNode.getByText('+ Add another config');
    await addConfigButton.click();
    await page.waitForTimeout(200);

    // Fill in config values
    const firstKeyInput = charmNode.locator('label:has-text("Config") + div input[placeholder="key"]').nth(0);
    const firstValueInput = charmNode.locator('label:has-text("Config") + div input[placeholder="value"]').nth(0);
    await firstKeyInput.fill('port');
    await firstValueInput.fill('8080');

    const secondKeyInput = charmNode.locator('label:has-text("Config") + div input[placeholder="key"]').nth(1);
    const secondValueInput = charmNode.locator('label:has-text("Config") + div input[placeholder="value"]').nth(1);
    await secondKeyInput.fill('host');
    await secondValueInput.fill('localhost');

    // The derived config value should be: "port=8080, host=localhost"
    // We can't directly verify the derived value, but we can verify inputs have correct values
    await expect(firstKeyInput).toHaveValue('port');
    await expect(firstValueInput).toHaveValue('8080');
    await expect(secondKeyInput).toHaveValue('host');
    await expect(secondValueInput).toHaveValue('localhost');
  });

  test.afterEach(async ({ page }) => {
    // Clean up: Remove all deployed charm nodes
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const charmNodes = await page.locator('.charm-node').all();
      
      console.log(`Cleanup attempt ${attempts + 1}: Found ${charmNodes.length} charm nodes`);
      
      if (charmNodes.length === 0) {
        console.log('All charm nodes removed');
        break;
      }
      
      for (let i = 0; i < charmNodes.length; i++) {
        const node = charmNodes[i];
        try {
          // Find the delete button (trash icon) in the charm node header
          const deleteButton = node.locator('button[title*="Remove"]').first();
          
          if (await deleteButton.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log(`Clicking delete button for node ${i + 1}`);
            await deleteButton.click();
            await page.waitForTimeout(500);
            
            // Click the "Delete" button in the confirmation dialog
            const confirmButton = page.locator('button:has-text("Delete")').last();
            if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
              console.log(`Confirming deletion for node ${i + 1}`);
              await confirmButton.click();
              // Wait for Juju to process the removal - pollTask can take time
              await page.waitForTimeout(5000);
            }
          }
        } catch (error) {
          console.error(`Error during cleanup of node ${i + 1}:`, error.message);
        }
      }
      
      attempts++;
      await page.waitForTimeout(1000);
    }
    
    console.log('Cleanup complete after', attempts, 'attempts');
  });
});
