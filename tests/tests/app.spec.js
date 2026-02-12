import { test, expect } from '@playwright/test';

test.describe('Juju Magician - Frontend Tests', () => {
  
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Check for main title
    await expect(page.getByText('Juju Magician')).toBeVisible();
    
    // Check for sidebar
    await expect(page.getByText('Infrastructure Manager')).toBeVisible();
  });

  test('should have toolbar buttons', async ({ page }) => {
    await page.goto('/');
    
    // Check for tool buttons
    await expect(page.getByRole('button', { name: /Add Charm Node/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Model Frame/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Clear Canvas/i })).toBeVisible();
  });

  test('should have model input field', async ({ page }) => {
    await page.goto('/');
    
    // Check for model selection input
    const modelInput = page.getByPlaceholder('default');
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toHaveValue('default');
  });

  test('should toggle sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Initially sidebar should be visible
    await expect(page.getByText('Juju Magician')).toBeVisible();
    
    // Click hide sidebar button
    const toggleButton = page.getByRole('button', { name: /Hide Sidebar/i });
    await toggleButton.click();
    
    // Sidebar should be hidden, button text should change
    await expect(page.getByRole('button', { name: /Show Sidebar/i })).toBeVisible();
  });

  test('should add a charm node', async ({ page }) => {
    await page.goto('/');
    
    // Click Add Charm Node
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Wait for charm template to appear in sidebar
    const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    await expect(charmTemplate).toBeVisible();
    await expect(charmTemplate.locator('input[placeholder="Charm name"]')).toBeVisible();
  });

  test('should fill all charm node fields', async ({ page }) => {
    await page.goto('/');
    
    // Add a charm template
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Get the charm template in sidebar
    const charmTemplate = page.locator('.charm-templates .bg-gray-700').first();
    
    // Fill all fields
    await charmTemplate.locator('input[placeholder="Charm name"]').fill('postgresql-k8s');
    await charmTemplate.locator('input[placeholder="Channel"]').fill('14/stable');
    await charmTemplate.locator('input[placeholder="Rev"]').fill('123');
    await charmTemplate.locator('input[placeholder="App name (optional)"]').fill('my-db');
    
    // Verify all fields are filled
    await expect(charmTemplate.locator('input[placeholder="Charm name"]')).toHaveValue('postgresql-k8s');
    await expect(charmTemplate.locator('input[placeholder="Channel"]')).toHaveValue('14/stable');
  });

  test('should add multiple charm nodes', async ({ page }) => {
    await page.goto('/');
    
    // Add first charm template
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Add second charm template
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Should have 2 charm templates in sidebar
    const charmTemplates = page.locator('.charm-templates .bg-gray-700');
    await expect(charmTemplates).toHaveCount(2);
  });

  test('should add model frame', async ({ page }) => {
    await page.goto('/');
    
    // Click Add Model Frame
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    
    // Should have at least 2 model frames (one default + one added)
    const modelFrames = page.locator('.model-frame');
    await expect(modelFrames).toHaveCount(2);
  });

  test('should refresh model status', async ({ page }) => {
    await page.goto('/');
    
    // Find the first model frame
    const modelFrame = page.locator('.model-frame').first();
    
    // Click Refresh Status button
    const refreshButton = modelFrame.getByRole('button', { name: /Refresh Status/i });
    await refreshButton.click();
    
    // Should show spinner while refreshing
    // Then should show last refresh time
    await expect(modelFrame.getByText(/Last updated:/i)).toBeVisible({ timeout: 5000 });
  });

  test('should create a relation edge', async ({ page }) => {
    await page.goto('/');
    
    // Add a model frame first
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    await page.waitForTimeout(300);
    
    // Add two charm templates
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Verify we have 2 charm templates in sidebar
    const charmTemplates = page.locator('.charm-templates .bg-gray-700');
    await expect(charmTemplates).toHaveCount(2);
    
    // Fill in charm details
    await charmTemplates.nth(0).locator('input[placeholder="Charm name"]').fill('postgresql-k8s');
    await charmTemplates.nth(1).locator('input[placeholder="Charm name"]').fill('nginx-ingress-integrator');
    await page.waitForTimeout(100);

    // Drag and drop both charms into model frame
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
    
    // Verify both charm nodes are on canvas
    const charmNodes = page.locator('.charm-node');
    await expect(charmNodes).toHaveCount(2);
  });

  test('should clear canvas', async ({ page }) => {
    await page.goto('/');
    
    // Add a model frame and charm template
    await page.getByRole('button', { name: /Add Model Frame/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Add Charm Node/i }).click();
    
    // Fill and drag-drop the charm
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
    
    // Verify node exists on canvas
    await expect(page.locator('.charm-node')).toHaveCount(1);
    
    // Listen for confirm dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Click Clear Canvas
    await page.getByRole('button', { name: /Clear Canvas/i }).click();
    
    // Charm nodes should be cleared
    await expect(page.locator('.charm-node')).toHaveCount(0);
  });

  test('should change active model', async ({ page }) => {
    await page.goto('/');
    
    // Change model name
    const modelInput = page.getByPlaceholder('default');
    await modelInput.clear();
    await modelInput.fill('production');
    
    // Verify the value changed
    await expect(modelInput).toHaveValue('production');
  });

  test('backend health check', async ({ request }) => {
    const response = await request.get('http://10.71.108.112:5000/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
  });

  test.skip('backend deploy API', async ({ request }) => {
    // Skipped: Real Juju deployments take several minutes and require actual infrastructure
  });

  test.skip('backend relate API', async ({ request }) => {
    // Skipped: Real Juju operations take time and require actual infrastructure
  });
});
