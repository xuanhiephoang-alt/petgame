import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:5199/model-viewer.html?only=" + (process.argv[3] ?? ""));
await page.waitForTimeout(8000);
await page.screenshot({ path: process.argv[2] });
await browser.close();
