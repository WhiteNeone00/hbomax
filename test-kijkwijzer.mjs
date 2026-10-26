import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true
});

try {
  const page = await browser.newPage();

  await page.goto("https://www.kijkwijzer.nl/", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  console.log("Homepage:", page.url());
  console.log("Title:", await page.title());

  await page.goto(
    "https://www.kijkwijzer.nl/umbraco/surface/searchresults/search?query=the%20dog%20star&producties=0&Leeftijd=&Leeftijd_PEGI=&Inhoud=&Inhoud_PEGI=&ProductieType=&ProductiesSort=&amount=",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000
    }
  );

  await page.waitForTimeout(3000);

  console.log("Search title:", await page.title());
  console.log("Search URL:", page.url());
  console.log(
    "Page preview:",
    (await page.locator("body").innerText()).slice(0, 1000)
  );
} finally {
  await browser.close();
}
