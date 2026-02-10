import { test, expect } from '@playwright/test';

test.describe('Model Frame Boundary Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.svelte-flow');
  });

  test('should expand model frame height when node is placed deep', async ({ page }) => {
    const modelFrame = page.locator('[data-id="model-1"]').first();
    
    // Get initial height
    const initialBox = await modelFrame.boundingBox();
    console.log(`Initial: ${initialBox.width}x${initialBox.height}`);
    
    // Add a charm
    await page.click('button:has-text("Add Charm Node")');
    const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('ingress-configurator');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('deepnode');
    
    await page.waitForTimeout(200);
    
    // Drag to a deep position (y=500)
    await charmTemplate.dragTo(modelFrame, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 200, y: 500 }
    });
    
    await page.waitForTimeout(2000);
    
    // Check new height
    const newBox = await modelFrame.boundingBox();
    console.log(`After deep node: ${newBox.width}x${newBox.height}`);
    
    // With node at y=500, height=150, padding=100: should be at least 750px
    expect(newBox.height).toBeGreaterThan(700);
  });
});
