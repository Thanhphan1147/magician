import { test, expect } from '@playwright/test';

test.describe('Node Positioning and Spacing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.svelte-flow');
  });

  test.afterEach(async ({ page }) => {
    // Clean up: Remove all deployed charm nodes
    const charmNodes = await page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').all();
    
    for (const node of charmNodes) {
      // Click the delete button (X) on each charm node
      const deleteButton = node.locator('button.absolute.top-2.right-2');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirm deletion in the dialog
        const confirmButton = page.locator('button:has-text("Remove")');
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
    }
    
    // Extra wait to ensure cleanup completes
    await page.waitForTimeout(1000);
  });

  test('should position new charm nodes without overlapping', async ({ page }) => {
    // Add two charm templates
    await page.locator('button:has-text("Add Charm Node")').click();
    await page.locator('button:has-text("Add Charm Node")').click();

    // Fill in first charm template
    const firstCharmInputs = page.locator('.charm-templates .bg-gray-700').nth(0);
    await firstCharmInputs.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await firstCharmInputs.locator('input[placeholder="App name (optional)"]').fill('ingress1');

    // Fill in second charm template
    const secondCharmInputs = page.locator('.charm-templates .bg-gray-700').nth(1);
    await secondCharmInputs.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await secondCharmInputs.locator('input[placeholder="App name (optional)"]').fill('ingress2');

    // Drag first charm to model frame
    const firstCharm = page.locator('.charm-templates .bg-gray-700').nth(0);
    const modelFrame = page.locator('.model-frame').first();
    await firstCharm.hover();
    await page.mouse.down();
    await modelFrame.hover({ position: { x: 100, y: 150 } });
    await page.mouse.up();

    // Wait for deployment
    await page.waitForTimeout(500);

    // Drag second charm to model frame
    const secondCharm = page.locator('.charm-templates .bg-gray-700').nth(0); // Index changes after first is removed
    await secondCharm.hover();
    await page.mouse.down();
    await modelFrame.hover({ position: { x: 120, y: 170 } });
    await page.mouse.up();

    // Wait for deployment
    await page.waitForTimeout(500);

    // Refresh to get actual positions from Juju
    await page.locator('button:has-text("Refresh Status")').click();
    await page.waitForTimeout(1000);

    // Get all charm nodes
    const charmNodes = await page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').all();
    expect(charmNodes.length).toBeGreaterThanOrEqual(2);

    // Get positions of the first two nodes
    const positions = [];
    for (let i = 0; i < Math.min(2, charmNodes.length); i++) {
      const box = await charmNodes[i].boundingBox();
      positions.push(box);
    }

    // Check that nodes don't overlap (minimum spacing)
    if (positions.length >= 2) {
      const dx = Math.abs(positions[0].x - positions[1].x);
      const dy = Math.abs(positions[0].y - positions[1].y);
      
      // Nodes should be separated by at least 300px horizontally OR 150px vertically
      const hasHorizontalSeparation = dx >= 300;
      const hasVerticalSeparation = dy >= 150;
      
      expect(hasHorizontalSeparation || hasVerticalSeparation).toBe(true);
    }
  });

  test('should keep node data consistent after refresh', async ({ page }) => {
    // Add and deploy a charm
    await page.locator('button:has-text("Add Charm Node")').click();
    
    const charmInputs = page.locator('.charm-templates .bg-gray-700').nth(0);
    await charmInputs.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await charmInputs.locator('input[placeholder="App name (optional)"]').fill('testingress');

    // Drag charm to specific position in model frame
    const charm = page.locator('.charm-templates .bg-gray-700').nth(0);
    const modelFrame = page.locator('.model-frame').first();
    await charm.hover();
    await page.mouse.down();
    await modelFrame.hover({ position: { x: 200, y: 200 } });
    await page.mouse.up();

    // Wait for deployment
    await page.waitForTimeout(1000);

    // Should have one charm node
    let charmNodes = await page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').all();
    expect(charmNodes.length).toBe(1);

    // Refresh status
    await page.locator('button:has-text("Refresh Status")').click();
    await page.waitForTimeout(1000);

    // Should still have exactly one charm node (not duplicated)
    charmNodes = await page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').all();
    expect(charmNodes.length).toBe(1);
    
    // Node should still be visible and have the correct app name
    const nodeText = await charmNodes[0].textContent();
    expect(nodeText).toContain('testingress');
  });

  test.skip('should space out multiple nodes in a grid pattern', async ({ page }) => {
    // This test verifies that new nodes (from refresh) are placed in a grid
    // We'll simulate this by checking the spacing pattern
    
    // Add multiple charms
    for (let i = 0; i < 4; i++) {
      await page.locator('button:has-text("Add Charm Node")').click();
    }

    // Deploy all charms
    for (let i = 0; i < 4; i++) {
      const charmInputs = page.locator('.charm-templates .bg-gray-700').nth(0);
      await charmInputs.locator('input[placeholder="Charm name"]').fill(`app${i}`);
      await charmInputs.locator('input[placeholder="App name (optional)"]').fill(`app${i}`);

      const charm = page.locator('.charm-templates .bg-gray-700').nth(0);
      const modelFrame = page.locator('.model-frame').first();
      await charm.hover();
      await page.mouse.down();
      // Drop at different positions
      await modelFrame.hover({ position: { x: 100 + i * 50, y: 150 + i * 30 } });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    // Wait for all deployments
    await page.waitForTimeout(1000);

    // Refresh to apply grid positioning
    await page.locator('button:has-text("Refresh Status")').click();
    await page.waitForTimeout(1500);

    // Get all charm nodes
    const charmNodes = await page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').all();
    expect(charmNodes.length).toBeGreaterThanOrEqual(4);

    // Verify no overlapping
    const positions = [];
    for (const node of charmNodes) {
      const box = await node.boundingBox();
      if (box) positions.push(box);
    }

    // Check each pair of nodes doesn't overlap
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = Math.abs(positions[i].x - positions[j].x);
        const dy = Math.abs(positions[i].y - positions[j].y);
        
        // If nodes are in the same row (similar Y), check horizontal spacing
        if (dy < 50) {
          expect(dx).toBeGreaterThanOrEqual(300);
        }
        // If nodes are in the same column (similar X), check vertical spacing
        else if (dx < 50) {
          expect(dy).toBeGreaterThanOrEqual(150);
        }
        // Otherwise, they should be in different grid cells
        else {
          const hasGoodSpacing = dx >= 300 || dy >= 150;
          expect(hasGoodSpacing).toBe(true);
        }
      }
    }
  });

  test.skip('should maintain spacing when adding new node to existing nodes', async ({ page }) => {
    // Deploy first charm
    await page.locator('button:has-text("Add Charm Node")').click();
    let charmInputs = page.locator('.charm-templates .bg-gray-700').nth(0);
    await charmInputs.locator('input[placeholder="Charm name"]').fill('first');
    await charmInputs.locator('input[placeholder="App name (optional)"]').fill('first');

    let charm = page.locator('.charm-templates .bg-gray-700').nth(0);
    let modelFrame = page.locator('.model-frame').first();
    await charm.hover();
    await page.mouse.down();
    await modelFrame.hover({ position: { x: 100, y: 150 } });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Refresh
    await page.locator('button:has-text("Refresh Status")').click();
    await page.waitForTimeout(1000);

    // Get position of first node
    const firstNode = page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').first();
    const firstBox = await firstNode.boundingBox();

    // Deploy second charm
    await page.locator('button:has-text("Add Charm Node")').click();
    charmInputs = page.locator('.charm-templates .bg-gray-700').nth(0);
    await charmInputs.locator('input[placeholder="Charm name"]').fill('second');
    await charmInputs.locator('input[placeholder="App name (optional)"]').fill('second');

    charm = page.locator('.charm-templates .bg-gray-700').nth(0);
    await charm.hover();
    await page.mouse.down();
    await modelFrame.hover({ position: { x: 100, y: 150 } });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Refresh again
    await page.locator('button:has-text("Refresh Status")').click();
    await page.waitForTimeout(1000);

    // Get all nodes
    const allNodes = await page.locator('.svelte-flow .svelte-flow__node[data-id^="charm-"]').all();
    expect(allNodes.length).toBe(2);

    // First node position should be preserved
    const firstBoxAfter = await allNodes[0].boundingBox();
    expect(Math.abs(firstBoxAfter.x - firstBox.x)).toBeLessThan(5);
    expect(Math.abs(firstBoxAfter.y - firstBox.y)).toBeLessThan(5);

    // Second node should not overlap with first
    const secondBox = await allNodes[1].boundingBox();
    const dx = Math.abs(firstBoxAfter.x - secondBox.x);
    const dy = Math.abs(firstBoxAfter.y - secondBox.y);
    
    const hasGoodSpacing = dx >= 300 || dy >= 150;
    expect(hasGoodSpacing).toBe(true);
  });
});
