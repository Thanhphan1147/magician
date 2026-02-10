import { test, expect } from '@playwright/test';

test.describe('Relation Removal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
  });

  test('should remove relation via button click', async ({ page }) => {
    const model = 'test-relation-removal';
    
    await page.fill('input[placeholder="default"]', model);
    await page.waitForTimeout(500);
    
    // Add first charm
    await page.click('button:has-text("Add Charm Node")');
    const charmInputs1 = await page.locator('input[placeholder="Charm name"]').all();
    await charmInputs1[0].fill('postgresql-k8s');
    
    // Add second charm
    await page.click('button:has-text("Add Charm Node")');
    await page.waitForTimeout(500);
    const charmInputs2 = await page.locator('input[placeholder="Charm name"]').all();
    await charmInputs2[1].fill('pgbouncer-k8s');
    
    const modelFrame = await page.locator('[data-id="model-1"]').first();
    const modelBox = await modelFrame.boundingBox();
    
    const charmCards = await page.locator('.bg-gray-700').all();
    await charmCards[0].dragTo(modelFrame, {
      targetPosition: { x: modelBox.width / 3, y: modelBox.height / 2 }
    });
    await page.waitForTimeout(2000);
    
    const charmCards2 = await page.locator('.bg-gray-700').all();
    await charmCards2[0].dragTo(modelFrame, {
      targetPosition: { x: (modelBox.width * 2) / 3, y: modelBox.height / 2 }
    });
    await page.waitForTimeout(2000);
    
    console.log('Waiting for deployments...');
    await page.waitForTimeout(15000);
    
    const charmNodes = await page.locator('[data-type="charmNode"]').all();
    expect(charmNodes.length).toBe(2);
    
    const handles = await page.locator('[data-handleid]').all();
    console.log(`Found ${handles.length} handles`);
    
    await handles[1].hover();
    await page.mouse.down();
    await handles[2].hover({ force: true });
    await page.mouse.up();
    
    console.log('Waiting for relation creation...');
    await page.waitForTimeout(10000);
    
    const statusBefore = await page.evaluate(async (m) => {
      const resp = await fetch(`/api/status/${m}`);
      return await resp.json();
    }, model);
    
    let relsBefore = 0;
    Object.values(statusBefore.status.applications).forEach(app => {
      if (app.relations) {
        Object.entries(app.relations).forEach(([endpoint, rels]) => {
          if (!endpoint.includes('-peers')) relsBefore += rels.length;
        });
      }
    });
    
    console.log(`Relations before: ${relsBefore}`);
    expect(relsBefore).toBeGreaterThan(0);
    
    await page.waitForTimeout(1000);
    const edge = await page.locator('.svelte-flow__edge-path').first();
    await edge.click({ force: true });
    await page.waitForTimeout(1000);
    
    await expect(page.locator('.relation-info-card')).toBeVisible({ timeout: 5000 });
    
    const removeBtn = page.locator('button:has-text("Remove Relation")');
    await expect(removeBtn).toBeVisible();
    
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    await removeBtn.click();
    
    console.log('Waiting for removal...');
    await page.waitForTimeout(10000);
    
    const statusAfter = await page.evaluate(async (m) => {
      const resp = await fetch(`/api/status/${m}`);
      return await resp.json();
    }, model);
    
    let relsAfter = 0;
    Object.values(statusAfter.status.applications).forEach(app => {
      if (app.relations) {
        Object.entries(app.relations).forEach(([endpoint, rels]) => {
          if (!endpoint.includes('-peers')) relsAfter += rels.length;
        });
      }
    });
    
    console.log(`Relations after: ${relsAfter}`);
    expect(relsAfter).toBe(0);
    
    await page.evaluate(async (m) => {
      await fetch('/api/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, application: 'postgresql-k8s', force: true })
      });
      await fetch('/api/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, application: 'pgbouncer-k8s', force: true })
      });
    }, model);
  });

  test('should remove relation via delete key', async ({ page }) => {
    const model = 'test-relation-key';
    
    await page.fill('input[placeholder="default"]', model);
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Add Charm Node")');
    const charmInputs1 = await page.locator('input[placeholder="Charm name"]').all();
    await charmInputs1[0].fill('postgresql-k8s');
    
    await page.click('button:has-text("Add Charm Node")');
    await page.waitForTimeout(500);
    const charmInputs2 = await page.locator('input[placeholder="Charm name"]').all();
    await charmInputs2[1].fill('pgbouncer-k8s');
    
    const modelFrame = await page.locator('[data-id="model-1"]').first();
    const modelBox = await modelFrame.boundingBox();
    
    const charmCards = await page.locator('.bg-gray-700').all();
    await charmCards[0].dragTo(modelFrame, {
      targetPosition: { x: modelBox.width / 3, y: modelBox.height / 2 }
    });
    await page.waitForTimeout(2000);
    
    const charmCards2 = await page.locator('.bg-gray-700').all();
    await charmCards2[0].dragTo(modelFrame, {
      targetPosition: { x: (modelBox.width * 2) / 3, y: modelBox.height / 2 }
    });
    
    await page.waitForTimeout(15000);
    
    const handles = await page.locator('[data-handleid]').all();
    await handles[1].hover();
    await page.mouse.down();
    await handles[2].hover({ force: true });
    await page.mouse.up();
    
    await page.waitForTimeout(10000);
    
    const statusBefore = await page.evaluate(async (m) => {
      const resp = await fetch(`/api/status/${m}`);
      return await resp.json();
    }, model);
    
    let relsBefore = 0;
    Object.values(statusBefore.status.applications).forEach(app => {
      if (app.relations) {
        Object.entries(app.relations).forEach(([endpoint, rels]) => {
          if (!endpoint.includes('-peers')) relsBefore += rels.length;
        });
      }
    });
    
    expect(relsBefore).toBeGreaterThan(0);
    
    const edge = await page.locator('.svelte-flow__edge-path').first();
    await edge.click({ force: true });
    await page.waitForTimeout(1000);
    
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    await page.keyboard.press('Delete');
    
    console.log('Waiting for removal...');
    await page.waitForTimeout(10000);
    
    const statusAfter = await page.evaluate(async (m) => {
      const resp = await fetch(`/api/status/${m}`);
      return await resp.json();
    }, model);
    
    let relsAfter = 0;
    Object.values(statusAfter.status.applications).forEach(app => {
      if (app.relations) {
        Object.entries(app.relations).forEach(([endpoint, rels]) => {
          if (!endpoint.includes('-peers')) relsAfter += rels.length;
        });
      }
    });
    
    expect(relsAfter).toBe(0);
    
    await page.evaluate(async (m) => {
      await fetch('/api/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, application: 'postgresql-k8s', force: true })
      });
      await fetch('/api/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, application: 'pgbouncer-k8s', force: true })
      });
    }, model);
  });
});
