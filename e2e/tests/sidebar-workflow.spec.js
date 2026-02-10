import { test, expect } from '@playwright/test';

test.describe('Sidebar Charm Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://10.71.108.112:5173');
    await page.waitForSelector('.svelte-flow');
  });

  test('should create charm template in sidebar when Add Charm Node is clicked', async ({ page }) => {
    // Initially no charm templates
    const emptyMessage = await page.locator('text=No charms added yet').isVisible();
    expect(emptyMessage).toBe(true);

    // Click "Add Charm Node"
    await page.click('button:has-text("Add Charm Node")');

    // Should see a charm template in sidebar
    const charmTemplate = await page.locator('.charm-templates .bg-gray-700').first();
    await expect(charmTemplate).toBeVisible();

    // Should have input fields
    const charmInput = await charmTemplate.locator('input[placeholder="Charm name"]');
    const channelInput = await charmTemplate.locator('input[placeholder="Channel"]');
    const appNameInput = await charmTemplate.locator('input[placeholder="App name (optional)"]');
    
    await expect(charmInput).toBeVisible();
    await expect(channelInput).toBeVisible();
    await expect(appNameInput).toBeVisible();

    // Should NOT have a deploy button anymore (drag-and-drop instead)
    const deployButton = await charmTemplate.locator('button:has-text("Deploy to Model")').count();
    expect(deployButton).toBe(0);
  });

  test('should enable dragging when charm name is filled', async ({ page }) => {
    // Add a charm template
    await page.click('button:has-text("Add Charm Node")');

    const charmTemplate = await page.locator('.charm-templates .bg-gray-700').first();
    const charmInput = await charmTemplate.locator('input[placeholder="Charm name"]');

    // Initially not draggable (no charm name)
    let draggable = await charmTemplate.getAttribute('draggable');
    expect(draggable).toBe('false');

    // Fill in charm name
    await charmInput.fill('postgresql-k8s');
    await page.waitForTimeout(100);

    // Should be draggable now
    draggable = await charmTemplate.getAttribute('draggable');
    expect(draggable).toBe('true');
    
    // Should show drag hint
    const dragHint = await charmTemplate.locator('text=Drag to model frame').isVisible();
    expect(dragHint).toBe(true);
  });

  test('should update charm template values', async ({ page }) => {
    // Add a charm template
    await page.click('button:has-text("Add Charm Node")');

    const charmTemplate = await page.locator('.charm-templates .bg-gray-700').first();

    // Fill in all fields
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('postgresql-k8s');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('my-db');
    await charmTemplate.locator('input[placeholder="Channel"]').fill('edge');
    await charmTemplate.locator('input[placeholder="Rev"]').fill('123');

    // Verify values are updated
    await expect(charmTemplate.locator('input[placeholder="Charm name"]')).toHaveValue('postgresql-k8s');
    await expect(charmTemplate.locator('input[placeholder="App name (optional)"]')).toHaveValue('my-db');
    await expect(charmTemplate.locator('input[placeholder="Channel"]')).toHaveValue('edge');
    await expect(charmTemplate.locator('input[placeholder="Rev"]')).toHaveValue('123');
  });

  test('should remove charm template when remove button is clicked', async ({ page }) => {
    // Add two charm templates
    await page.click('button:has-text("Add Charm Node")');
    await page.click('button:has-text("Add Charm Node")');

    // Should have 2 templates
    let templates = await page.locator('.charm-templates .bg-gray-700').count();
    expect(templates).toBe(2);

    // Click remove on the first one
    await page.locator('.charm-templates .bg-gray-700').first().locator('button[title="Remove"]').click();

    // Should have 1 template now
    templates = await page.locator('.charm-templates .bg-gray-700').count();
    expect(templates).toBe(1);

    // Remove the last one
    await page.locator('.charm-templates .bg-gray-700').first().locator('button[title="Remove"]').click();

    // Should show empty message
    const emptyMessage = await page.locator('text=No charms added yet').isVisible();
    expect(emptyMessage).toBe(true);
  });

  test('should add multiple charm templates to sidebar', async ({ page }) => {
    // Add 3 charm templates
    await page.click('button:has-text("Add Charm Node")');
    await page.click('button:has-text("Add Charm Node")');
    await page.click('button:has-text("Add Charm Node")');

    // Should have 3 templates
    const templates = await page.locator('.charm-templates .bg-gray-700').count();
    expect(templates).toBe(3);

    // Each should have input fields
    for (let i = 0; i < 3; i++) {
      const template = await page.locator('.charm-templates .bg-gray-700').nth(i);
      const charmInput = await template.locator('input[placeholder="Charm name"]');
      await expect(charmInput).toBeVisible();
    }
  });

  test('should create charm node on canvas when dragged and dropped into model frame', async ({ page }) => {
    // First add a model frame
    await page.click('button:has-text("Add Model Frame")');
    await page.waitForTimeout(300);

    // Add a charm template
    await page.click('button:has-text("Add Charm Node")');
    const charmTemplate = await page.locator('.charm-templates .bg-gray-700').first();

    // Fill in charm details
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('test-charm');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('my-test');
    await page.waitForTimeout(100);

    // Count nodes before deployment
    const nodesBefore = await page.locator('.svelte-flow__node').count();

    // Use Playwright's dragTo method
    const modelFrame = await page.locator('.model-frame').first();
    await charmTemplate.dragTo(modelFrame, {
      sourcePosition: { x: 50, y: 50 },
      targetPosition: { x: 200, y: 150 }
    });
    await page.waitForTimeout(500);

    // Should have one more node now (the charm node)
    const nodesAfter = await page.locator('.svelte-flow__node').count();
    expect(nodesAfter).toBe(nodesBefore + 1);

    // The charm node should have the correct title
    const charmNode = await page.locator('.charm-node:has-text("my-test")');
    await expect(charmNode).toBeVisible();
    
    // The charm template should be removed from sidebar after deployment
    const templatesAfter = await page.locator('.charm-templates .bg-gray-700').count();
    expect(templatesAfter).toBe(0);
  });

  test('should show alert when dropping charm outside model frame', async ({ page }) => {
    // Add a charm template
    await page.click('button:has-text("Add Charm Node")');
    const charmTemplate = await page.locator('.charm-templates .bg-gray-700').first();

    // Fill in charm name
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('test-charm');
    await page.waitForTimeout(100);

    // Set up dialog handler
    let alertShown = false;
    page.on('dialog', async dialog => {
      expect(dialog.message()).toBe('Please drop the charm into a model frame');
      alertShown = true;
      await dialog.accept();
    });

    // Drag and drop outside any model frame (to the canvas)
    const charmBox = await charmTemplate.boundingBox();
    const canvas = await page.locator('.canvas-container');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(charmBox.x + charmBox.width / 2, charmBox.y + charmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      canvasBox.x + 100, // Drop on canvas, not in any model frame
      canvasBox.y + 100,
      { steps: 10 }
    );
    await page.mouse.up();
    await page.waitForTimeout(300);

    expect(alertShown).toBe(true);
  });

  test('should not show input fields on auto-deployed charm node', async ({ page }) => {
    // Add model frame first
    await page.click('button:has-text("Add Model Frame")');
    await page.waitForTimeout(300);

    // Add charm template
    await page.click('button:has-text("Add Charm Node")');
    const charmTemplate = await page.locator('.charm-templates .bg-gray-700').first();
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('test-charm');
    await page.waitForTimeout(100);

    // Drag and drop into model frame
    const modelFrame = await page.locator('.model-frame').first();
    const modelFrameBox = await modelFrame.boundingBox();
    const charmBox = await charmTemplate.boundingBox();

    await page.mouse.move(charmBox.x + charmBox.width / 2, charmBox.y + charmBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      modelFrameBox.x + modelFrameBox.width / 2,
      modelFrameBox.y + modelFrameBox.height / 2,
      { steps: 10 }
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    // The charm node on canvas should not show input fields
    const charmNode = await page.locator('.charm-node');
    const inputFields = await charmNode.locator('input').count();
    expect(inputFields).toBe(0);

    // Should show deploying indicator
    const deployingText = await charmNode.locator('text=Deploying...').isVisible();
    expect(deployingText).toBe(true);
  });
});
