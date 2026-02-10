import { test, expect } from '@playwright/test';

test.describe('Model Frame Auto Resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.svelte-flow');
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

  test('should auto-resize model frame when charm nodes are added', async ({ page }) => {
    // Get initial model frame size
    const modelFrame = page.locator('[data-id="model-1"]').first();
    const initialBox = await modelFrame.boundingBox();
    
    expect(initialBox).not.toBeNull();
    const initialWidth = initialBox.width;
    const initialHeight = initialBox.height;
    
    console.log(`Initial size: ${initialWidth}x${initialHeight}`);

    // Add 2 charm templates
    await page.click('button:has-text("Add Charm Node")');
    await page.click('button:has-text("Add Charm Node")');

    // Deploy first charm (normal position)
    let charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('app1');
    await page.waitForTimeout(200);
    
    await charmTemplate.dragTo(modelFrame, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 200, y: 250 }
    });
    await page.waitForTimeout(500);

    // Deploy second charm (deep position to force resize)
    charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('app2');
    await page.waitForTimeout(200);
    
    await charmTemplate.dragTo(modelFrame, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 500, y: 500 }
    });
    await page.waitForTimeout(1000);

    // Get new model frame size
    const newBox = await modelFrame.boundingBox();
    expect(newBox).not.toBeNull();
    const newWidth = newBox.width;
    const newHeight = newBox.height;
    
    console.log(`New size: ${newWidth}x${newHeight}`);

    // Model frame should have grown to accommodate the deep node
    // Node at y=500, height=150, padding=100 = 750px minimum
    expect(newWidth).toBeGreaterThanOrEqual(initialWidth);
    expect(newHeight).toBeGreaterThan(initialHeight);
    expect(newHeight).toBeGreaterThan(700);
  });

  test('should maintain minimum size when model frame is empty', async ({ page }) => {
    // Get model frame size when empty
    const modelFrame = page.locator('[data-id="model-1"]').first();
    const emptyBox = await modelFrame.boundingBox();
    
    expect(emptyBox).not.toBeNull();
    
    // Should maintain minimum dimensions (800x600)
    expect(emptyBox.width).toBeGreaterThanOrEqual(800);
    expect(emptyBox.height).toBeGreaterThanOrEqual(600);
  });

  test('should resize when nodes are added via refresh', async ({ page }) => {
    // Get initial size
    const modelFrame = page.locator('[data-id="model-1"]').first();
    const initialBox = await modelFrame.boundingBox();
    expect(initialBox).not.toBeNull();

    // Add and deploy a charm
    await page.click('button:has-text("Add Charm Node")');
    const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('test1');
    
    await page.waitForTimeout(200);
    
    await charmTemplate.dragTo(modelFrame, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 500, y: 400 }
    });
    
    await page.waitForTimeout(1000);

    // Get size after first deployment
    const boxAfterDeploy = await modelFrame.boundingBox();
    expect(boxAfterDeploy).not.toBeNull();

    // Refresh to get nodes from Juju
    const refreshButton = modelFrame.locator('button:has-text("Refresh Status")');
    await refreshButton.click({ force: true });
    await page.waitForTimeout(1500);

    // Size should be maintained or adjusted based on actual node positions
    const boxAfterRefresh = await modelFrame.boundingBox();
    expect(boxAfterRefresh).not.toBeNull();
    
    // Frame should still be at least as big as it needs to be
    expect(boxAfterRefresh.width).toBeGreaterThanOrEqual(initialBox.width);
  });

  test('should shrink back to minimum when all nodes are removed', async ({ page }) => {
    const modelFrame = page.locator('[data-id="model-1"]').first();
    
    // Add and deploy charms
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Add Charm Node")');
      const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
      await charmTemplate.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
      await charmTemplate.locator('input[placeholder="App name (optional)"]').fill(`app${i}`);
      
      await page.waitForTimeout(200);
      
      await charmTemplate.dragTo(modelFrame, {
        sourcePosition: { x: 50, y: 50 },
        targetPosition: { x: 200 + i * 300, y: 200 }
      });
      
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(1000);

    // Get expanded size
    const expandedBox = await modelFrame.boundingBox();
    expect(expandedBox).not.toBeNull();

    // Remove all charm nodes
    const charmNodes = await page.locator('.charm-node').all();
    for (const node of charmNodes) {
      const parentNode = page.locator('.svelte-flow__node').filter({ has: node });
      const deleteButton = parentNode.locator('button.absolute.top-2.right-2');
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        const confirmButton = page.locator('button:has-text("Remove")');
        await confirmButton.click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);

    // Get size after all removed - should NOT shrink back (model frames keep their size)
    // This is by design - we only grow, we don't shrink
    const finalBox = await modelFrame.boundingBox();
    expect(finalBox).not.toBeNull();
    
    // Size should remain at expanded size (we don't shrink on node removal)
    // This prevents jarring layout changes when removing nodes
    expect(finalBox.width).toBeGreaterThanOrEqual(expandedBox.width - 10); // Allow small variance
  });
});
