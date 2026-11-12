/** Cancel, Escape, and confirm a real destructive action on audit-only data. */
import assert from "node:assert/strict";
import { API, APP, launch, pageAs, seededMemberToken } from "./_shared.mjs";

const token = await seededMemberToken();
const browser = await launch();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

try {
  for (const width of [1440, 390]) {
    const made = await fetch(`${API}/feed/posts`, {
      method: "POST", headers,
      body: JSON.stringify({ text: `Confirmation audit ${Date.now()}`, audience: "everyone" }),
    });
    assert.equal(made.status, 201, "audit post creates");
    const post = await made.json();
    const page = await pageAs(browser, token, { width, height: 900 });
    let deletes = 0;
    page.on("request", (request) => {
      if (request.method() === "DELETE" && new URL(request.url()).pathname.endsWith(`/feed/posts/${post.id}`)) deletes++;
    });
    const open = async () => {
      await page.$eval(`[data-post="${post.id}"] button[aria-label="Post options"]`, (button) => {
        button.scrollIntoView({ block: "center", behavior: "instant" });
      });
      await page.waitForFunction((selector) => {
        const button = document.querySelector(selector);
        if (!button) return false;
        const box = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
      }, { timeout: 15000 }, `[data-post="${post.id}"] button[aria-label="Post options"]`);
      await page.click(`[data-post="${post.id}"] button[aria-label="Post options"]`);
      await page.waitForSelector(`[data-post="${post.id}"] [role="menu"]`, { visible: true });
      await page.$$eval('[role="menu"] button', (buttons) => {
        const button = buttons.find((item) => item.textContent.trim() === "Delete post");
        if (!button) throw new Error("Delete post menu item is missing");
        button.click();
      });
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
        .some((dialog) => dialog.getBoundingClientRect().height > 0 && dialog.textContent.includes("Delete this post?")));
    };
    const choose = async (label) => page.$$eval('[role="dialog"]', (dialogs, text) => {
      const dialog = dialogs.find((item) => item.getBoundingClientRect().height > 0 && item.textContent.includes("Delete this post?"));
      const button = [...(dialog?.querySelectorAll("button") || [])].find((item) => item.textContent.trim() === text);
      if (!button) throw new Error(`Missing dialog action: ${text}`);
      button.click();
    }, label);
    try {
      await page.goto(`${APP}/app/community`, { waitUntil: "networkidle2", timeout: 45000 });
      await page.waitForFunction(() => document.documentElement.getAttribute("data-app-splash") !== "on", { timeout: 15000 });
      await page.waitForSelector(`[data-post="${post.id}"]`);
      // A newly provisioned audit member is correctly asked for a second
      // contact method. Dismiss that prompt before exercising the post menu.
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
        .some((dialog) => dialog.getBoundingClientRect().height > 0 && dialog.textContent.includes("Complete your profile")),
      { timeout: 3500 }).catch(() => {});
      await page.$$eval('[role="dialog"]', (dialogs) => {
        const prompt = dialogs.find((dialog) => dialog.textContent.includes("Complete your profile"));
        [...(prompt?.querySelectorAll("button") || [])].find((button) => button.textContent.trim() === "Later")?.click();
      });
      await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"]')]
        .some((dialog) => dialog.getBoundingClientRect().height > 0 && dialog.textContent.includes("Complete your profile")));
      await open();
      await choose("Cancel");
      await page.waitForSelector('[role="dialog"]', { hidden: true });
      assert.equal(deletes, 0, "Cancel never sends a delete");
      await open();
      await page.keyboard.press("Escape");
      await page.waitForSelector('[role="dialog"]', { hidden: true });
      assert.equal(deletes, 0, "Escape never sends a delete");
      await open();
      await choose("Delete post");
      await page.waitForSelector(`[data-post="${post.id}"]`, { hidden: true });
      assert.equal(deletes, 1, "confirmation sends exactly one delete");
      console.log(`PASS: ${width}px — Cancel and Escape preserve the post; confirmation deletes it once`);
    } catch (error) {
      console.error(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.map((dialog) => ({
        text: dialog.textContent.slice(0, 500), visible: dialog.getBoundingClientRect().height,
      }))));
      throw error;
    } finally {
      await page.close();
      await fetch(`${API}/feed/posts/${post.id}`, { method: "DELETE", headers });
    }
  }
} finally {
  await browser.close();
}
