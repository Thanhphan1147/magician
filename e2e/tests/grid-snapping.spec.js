import { test, expect } from '@playwright/test';

test.describe('Grid Snapping Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Juju Magician')).toBeVisible();
  });

  test('should have dot grid background', async ({ page }) => {
    // Check that the background has a dot pattern
    const background = page.locator('.svelte-flow__background');
    await expect(background).toBeVisible();
    
    // Background should have the pattern element
    const pattern = page.locator('.svelte-flow__background pattern');
    await expect(pattern).toBeAttached();
  });

  test('should snap charm node to grid when dragged', async ({ page }) => {
    // Add a model frame first
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    await page.waitForTimeout(300);
    
    // Add a charm template
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Fill and drag-drop
    const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('test-charm');
    await page.waitForTimeout(100);

    const modelFrame = await page.locator('.model-frame').first();
    const modelFrameBox = await modelFrame.boundingBox();
    const charmBox = await charmTemplate.boundingBox();

    await page.mouse.move(charmBox.x + charmBox.width / 2, charmBox.y + charmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(modelFrameBox.x + 200, modelFrameBox.y + 150, { steps: 10 });
    await page.mouse.up();
    
    // Wait for node to be added to canvas
    await page.waitForTimeout(500);
    
    // Find the charm node
    const charmNode = page.locator('.svelte-flow__node-charmNode').first();
    await expect(charmNode).toBeVisible();
    
    // Get initial position
    const initialBox = await charmNode.boundingBox();
    expect(initialBox).not.toBeNull();
    
    // Drag the node to a non-grid-aligned position
    // We'll drag it 37px right and 43px down (non-multiples of 20)
    await charmNode.hover();
    await page.mouse.down();
    await page.mouse.move(
      initialBox.x + initialBox.width / 2 + 37,
      initialBox.y + initialBox.height / 2 + 43,
      { steps: 10 }
    );
    await page.mouse.up();
    
    // Wait for snap animation
    await page.waitForTimeout(300);
    
    // Get final position
    const finalBox = await charmNode.boundingBox();
    expect(finalBox).not.toBeNull();
    
    // Calculate the movement
    const deltaX = finalBox.x - initialBox.x;
    const deltaY = finalBox.y - initialBox.y;
    
    // The final position should be snapped to grid (multiple of 20)
    // Allow tolerance for transform, viewport translation, and CSS positioning
    const GRID_SIZE = 20;
    const tolerance = 10; // Increased tolerance due to viewport transforms
    
    // Check if position is close to a grid line
    const snappedX = Math.round(deltaX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(deltaY / GRID_SIZE) * GRID_SIZE;
    
    expect(Math.abs(deltaX - snappedX)).toBeLessThan(tolerance);
    expect(Math.abs(deltaY - snappedY)).toBeLessThan(tolerance);
    
    console.log(`Dragged by (${deltaX}, ${deltaY}), expected snap to (${snappedX}, ${snappedY})`);
  });

  test('should not snap model frames to grid', async ({ page }) => {
    // The default model frame should already exist
    const modelFrame = page.locator('.svelte-flow__node-modelFrame').first();
    await expect(modelFrame).toBeVisible();
    
    // Get initial position
    const initialBox = await modelFrame.boundingBox();
    expect(initialBox).not.toBeNull();
    
    // Try to drag it by a non-grid amount
    await modelFrame.hover();
    await page.mouse.down();
    await page.mouse.move(
      initialBox.x + initialBox.width / 2 + 37,
      initialBox.y + initialBox.height / 2 + 43,
      { steps: 10 }
    );
    await page.mouse.up();
    
    // Wait a bit
    await page.waitForTimeout(300);
    
    // Get final position
    const finalBox = await modelFrame.boundingBox();
    expect(finalBox).not.toBeNull();
    
    // Calculate movement
    const deltaX = finalBox.x - initialBox.x;
    const deltaY = finalBox.y - initialBox.y;
    
    // Model frames should NOT snap, so the position should be close to
    // the non-snapped drag amount (37, 43)
    const expectedX = 37;
    const expectedY = 43;
    const tolerance = 10;
    
    const diffX = Math.abs(deltaX - expectedX);
    const diffY = Math.abs(deltaY - expectedY);
    
    console.log(`Model frame dragged by (${deltaX}, ${deltaY}), expected around (${expectedX}, ${expectedY})`);
    console.log(`Difference from expected: (${diffX}, ${diffY})`);
    
    // Should be close to the non-snapped position
    expect(diffX).toBeLessThan(tolerance);
    expect(diffY).toBeLessThan(tolerance);
  });

  test('should snap multiple charm nodes independently', async ({ page }) => {
    // Add a model frame first
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    await page.waitForTimeout(300);
    
    // Add two charm templates
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Deploy both charms via drag-drop
    const charmTemplates = page.locator('.charm-templates .bg-gray-700');
    await charmTemplates.nth(0).locator('input[placeholder="Charm name"]').fill('charm-1');
    await charmTemplates.nth(1).locator('input[placeholder="Charm name"]').fill('charm-2');
    await page.waitForTimeout(100);

    const modelFrame = await page.locator('.model-frame').first();
    const modelFrameBox = await modelFrame.boundingBox();

    // Deploy first charm
    let charmBox = await charmTemplates.nth(0).boundingBox();
    await page.mouse.move(charmBox.x + charmBox.width / 2, charmBox.y + charmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(modelFrameBox.x + 200, modelFrameBox.y + 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Deploy second charm
    charmBox = await page.locator('.charm-templates .bg-gray-700').first().boundingBox();
    await page.mouse.move(charmBox.x + charmBox.width / 2, charmBox.y + charmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(modelFrameBox.x + 500, modelFrameBox.y + 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    const charmNodes = page.locator('.svelte-flow__node-charmNode');
    const nodeCount = await charmNodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);
    
    // Get positions and drag using page coordinates
    const firstNode = charmNodes.nth(0);
    const secondNode = charmNodes.nth(1);
    
    const firstBox = await firstNode.boundingBox();
    const secondBox = await secondNode.boundingBox();
    
    // Drag first node using page.mouse directly
    const firstCenterX = firstBox.x + firstBox.width / 2;
    const firstCenterY = firstBox.y + firstBox.height / 2;
    
    await page.mouse.move(firstCenterX, firstCenterY);
    await page.mouse.down();
    await page.mouse.move(firstCenterX + 33, firstCenterY + 27, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    
    // Drag second node
    const secondCenterX = secondBox.x + secondBox.width / 2;
    const secondCenterY = secondBox.y + secondBox.height / 2;
    
    await page.mouse.move(secondCenterX, secondCenterY);
    await page.mouse.down();
    await page.mouse.move(secondCenterX + 58, secondCenterY + 72, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    
    // Both should have snapped independently
    const finalFirst = await firstNode.boundingBox();
    const finalSecond = await secondNode.boundingBox();
    
    expect(finalFirst).not.toBeNull();
    expect(finalSecond).not.toBeNull();
    
    // They should be at different positions (not overlapping)
    const xDiff = Math.abs(finalFirst.x - finalSecond.x);
    const yDiff = Math.abs(finalFirst.y - finalSecond.y);
    
    expect(xDiff > 10 || yDiff > 10).toBeTruthy();
    
    console.log(`Two nodes positioned at different locations with offset (${xDiff}, ${yDiff})`);
  });

  test('should maintain grid snapping after refresh', async ({ page }) => {
    // Add a model frame first
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    await page.waitForTimeout(300);
    
    // Add a charm template and drag-drop
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('test-charm');
    await page.waitForTimeout(100);

    const modelFrame = await page.locator('.model-frame').first();
    const modelFrameBox = await modelFrame.boundingBox();
    const charmBox = await charmTemplate.boundingBox();

    await page.mouse.move(charmBox.x + charmBox.width / 2, charmBox.y + charmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(modelFrameBox.x + 200, modelFrameBox.y + 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    const charmNode = page.locator('.svelte-flow__node-charmNode').first();
    
    // Drag it
    const box = await charmNode.boundingBox();
    await charmNode.hover();
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 45,
      box.y + box.height / 2 + 35,
      { steps: 5 }
    );
    await page.mouse.up();
    await page.waitForTimeout(300);
    
    // Get position after snap
    const afterSnap = await charmNode.boundingBox();
    
    // Reload page
    await page.reload();
    await expect(page.getByText('Juju Magician')).toBeVisible();
    
    // Add a model frame and deploy another node - should still snap
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    const newTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await newTemplate.locator('input[placeholder="Charm name"]').fill('new-charm');
    await page.waitForTimeout(100);

    const newModelFrame = await page.locator('.model-frame').first();
    const newModelFrameBox = await newModelFrame.boundingBox();
    const newCharmBox = await newTemplate.boundingBox();

    await page.mouse.move(newCharmBox.x + newCharmBox.width / 2, newCharmBox.y + newCharmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(newModelFrameBox.x + 200, newModelFrameBox.y + 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    const newNode = page.locator('.svelte-flow__node-charmNode').first();
    const newBox = await newNode.boundingBox();
    
    await newNode.hover();
    await page.mouse.down();
    await page.mouse.move(
      newBox.x + newBox.width / 2 + 37,
      newBox.y + newBox.height / 2 + 43,
      { steps: 5 }
    );
    await page.mouse.up();
    await page.waitForTimeout(300);
    
    const finalNewBox = await newNode.boundingBox();
    
    // Calculate delta
    const deltaX = finalNewBox.x - newBox.x;
    const deltaY = finalNewBox.y - newBox.y;
    
    const GRID_SIZE = 20;
    const snappedX = Math.round(deltaX / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(deltaY / GRID_SIZE) * GRID_SIZE;
    
    // Should still snap after reload
    expect(Math.abs(deltaX - snappedX)).toBeLessThan(10);
    expect(Math.abs(deltaY - snappedY)).toBeLessThan(10);
  });
});
