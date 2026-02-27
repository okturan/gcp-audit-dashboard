const { chromium } = await import('/Users/okan/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs');

const BASE = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5174';
const OUT = 'docs/screenshots';
const VIEWPORT = { width: 1440, height: 900 };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  console.log('Loading app...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Wait for initial render
  await page.waitForTimeout(3000);

  // Debug: log what we see
  const pageText = await page.textContent('body');
  console.log('Page text preview:', pageText.slice(0, 200));

  // If credential loader is showing, wait for auto-auth via gcloud CLI
  const signInVisible = await page.locator('text=Sign in with Google').isVisible({ timeout: 2000 }).catch(() => false);
  if (signInVisible) {
    console.log('Credential loader is showing. Waiting for auto-auth...');
    // The app auto-fetches /api/gcloud-token on load
    await page.waitForTimeout(5000);
  }

  // Check if we need to discover
  const discoverCTA = page.locator('button:has-text("Discover GCP Resources")');
  if (await discoverCTA.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Clicking Discover...');
    await discoverCTA.click();
    console.log('Waiting for discovery to complete (up to 2 min)...');
    await page.waitForSelector('text=Security Health', { timeout: 120000 });
    await page.waitForTimeout(2000);
  }

  // Fallback: try toolbar discover
  const hasData = await page.locator('text=Security Health').isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasData) {
    const toolbarBtn = page.locator('button:has-text("Discover")').first();
    if (await toolbarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicking toolbar Discover...');
      await toolbarBtn.click();
      console.log('Waiting for discovery...');
      await page.waitForSelector('text=Security Health', { timeout: 120000 });
      await page.waitForTimeout(2000);
    } else {
      console.log('Could not find Discover button. Taking screenshots of current state.');
    }
  }

  const views = ['Overview', 'Graph', 'Table', 'Charts', 'Findings'];
  for (const view of views) {
    const fname = view.toLowerCase();
    console.log(`Capturing ${view}...`);
    const tab = page.locator(`button.view-tab:has-text("${view}")`);
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(view === 'Graph' ? 2000 : 1000);
    } else {
      console.log(`  Tab "${view}" not found, taking current state`);
    }
    await page.screenshot({ path: `${OUT}/${fname}.png`, fullPage: false });
    console.log(`  Saved ${OUT}/${fname}.png`);
  }

  await browser.close();
  console.log(`Done! Screenshots saved to ${OUT}/`);
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err.message);
  process.exit(1);
});
