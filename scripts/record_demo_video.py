import asyncio
import os
import shutil
import time
from playwright.async_api import async_playwright

OUTPUT_DIR = os.path.abspath("demo_video")
os.makedirs(OUTPUT_DIR, exist_ok=True)

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BROWSER_EXE = CHROME_PATH if os.path.exists(CHROME_PATH) else EDGE_PATH

print(f"Using browser executable: {BROWSER_EXE}")

async def run_demo_recording():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=BROWSER_EXE,
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--autoplay-policy=no-user-gesture-required",
            ]
        )

        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=OUTPUT_DIR,
            record_video_size={"width": 1920, "height": 1080},
        )

        page = await context.new_page()

        print("Navigating to http://127.0.0.1:5173/ ...")
        await page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
        await asyncio.sleep(2)

        # ── SCENE 1: Login & Welcome ──────────────────────────
        print("Scene 1: Logging in as Guest...")
        # Check if guest button or google sign-in is present
        guest_btn = page.locator("button:has-text('Continue as Guest'), button:has-text('Guest')")
        if await guest_btn.count() > 0:
            await guest_btn.first.click()
        else:
            # Fallback click google sign in
            google_btn = page.locator("button:has-text('Continue with Google')")
            if await google_btn.count() > 0:
                await google_btn.first.click()
        
        await asyncio.sleep(3)

        # ── SCENE 2: Voice Architecture & Personas ───────────
        print("Scene 2: Exploring Voice Architectures & Rime Personas...")
        # Switch model to Arcana
        arcana_btn = page.locator("button:has-text('Arcana'), button:has-text('Rime Arcana')")
        if await arcana_btn.count() > 0:
            await arcana_btn.first.click()
            await asyncio.sleep(2)

        # Switch model back to Mist
        mist_btn = page.locator("button:has-text('Mist'), button:has-text('Rime Mist')")
        if await mist_btn.count() > 0:
            await mist_btn.first.click()
            await asyncio.sleep(2)

        # Click voice persona card 'Marsh'
        marsh_card = page.locator("div:has-text('Marsh'), button:has-text('Marsh')").first
        if await marsh_card.count() > 0:
            await marsh_card.click()
            await asyncio.sleep(2)

        # Preview voice
        preview_btn = page.locator("button:has-text('Preview'), button:has-text('Listen')")
        if await preview_btn.count() > 0:
            await preview_btn.first.click()
            await asyncio.sleep(3)

        # Click voice persona card 'Amber'
        amber_card = page.locator("div:has-text('Amber'), button:has-text('Amber')").first
        if await amber_card.count() > 0:
            await amber_card.click()
            await asyncio.sleep(2)

        # ── SCENE 3: Normal Conversation Turn ────────────────
        print("Scene 3: Normal Conversation & Full-Duplex Dialogue...")
        input_box = page.locator("textarea, input[placeholder*='message'], input[type='text']").last
        if await input_box.count() > 0:
            await input_box.fill("Explain how full-duplex generation fencing works in VoicePilot AI")
            await page.keyboard.press("Enter")
            await asyncio.sleep(5)

        # ── SCENE 4: Hard Voice Problem — Interruption ────────
        print("Scene 4: Interruption & Recovery Barge-in...")
        if await input_box.count() > 0:
            await input_box.fill("Tell me the detailed history of acoustic wave physics and sound propagation in fluids")
            await page.keyboard.press("Enter")
            await asyncio.sleep(1.5)  # Wait for speech to start streaming
            
            # Click Interrupt button while speaking
            interrupt_btn = page.locator("button:has-text('Interrupt'), button:has-text('Barge')")
            if await interrupt_btn.count() > 0:
                await interrupt_btn.first.click()
                print("Barge-in triggered!")
                await asyncio.sleep(2)

            # Send revised turn
            await input_box.fill("Cancel that, what is the speed of sound in air?")
            await page.keyboard.press("Enter")
            await asyncio.sleep(4)

        # ── SCENE 5: Acceptance Test Runner ───────────────────
        print("Scene 5: Acceptance Runner (7 Invariant Checks)...")
        acceptance_tab = page.locator("button:has-text('Acceptance'), a:has-text('Acceptance')")
        if await acceptance_tab.count() > 0:
            await acceptance_tab.first.click()
            await asyncio.sleep(2)

            # Click Run Acceptance Test button
            run_btn = page.locator("button:has-text('Run Acceptance')")
            if await run_btn.count() > 0:
                await run_btn.first.click()
                await asyncio.sleep(4)

        # ── SCENE 6: Real-Time Observability ──────────────────
        print("Scene 6: Real-time Observability Dashboard...")
        obs_tab = page.locator("button:has-text('Observability'), a:has-text('Observability')")
        if await obs_tab.count() > 0:
            await obs_tab.first.click()
            await asyncio.sleep(3)
            # Scroll down to show event log
            await page.evaluate("window.scrollBy(0, 400)")
            await asyncio.sleep(2)
            await page.evaluate("window.scrollBy(0, -400)")
            await asyncio.sleep(1)

        # ── SCENE 7: Pronunciation Lab & Benchmark ────────────
        print("Scene 7: Pronunciation Lab & Benchmark...")
        pron_tab = page.locator("button:has-text('Pronunciation'), a:has-text('Pronunciation')")
        if await pron_tab.count() > 0:
            await pron_tab.first.click()
            await asyncio.sleep(2.5)

        bench_tab = page.locator("button:has-text('Benchmark'), a:has-text('Benchmark')")
        if await bench_tab.count() > 0:
            await bench_tab.first.click()
            await asyncio.sleep(2.5)

        # ── SCENE 8: Return to Console & Wrap-up ──────────────
        print("Scene 8: Finishing walkthrough on Agent Console...")
        console_tab = page.locator("button:has-text('Console'), a:has-text('Console')")
        if await console_tab.count() > 0:
            await console_tab.first.click()
            await asyncio.sleep(2)

        # Close page and context to finalize video writing
        print("Finalizing video recording...")
        video_path = await page.video.path()
        await page.close()
        await context.close()
        await browser.close()

        target_file = os.path.join(OUTPUT_DIR, "voicepilot_ai_demo_walkthrough.webm")
        if os.path.exists(video_path):
            shutil.copy(video_path, target_file)
            print(f"SUCCESS: Demo video saved to: {target_file}")
            print(f"File size: {os.path.getsize(target_file)} bytes")

if __name__ == "__main__":
    asyncio.run(run_demo_recording())
