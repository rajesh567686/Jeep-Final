const puppeteer = require('puppeteer-core');
const { parse } = require('csv-parse');
const fs = require('fs');

// Path to the Chrome executable
// const CHROME_PATH = 'C://Program Files (x86)//Microsoft//Edge//Application/msedge.exe';  // Adjust this path according to your installation
const CHROME_PATH = 'C://Program Files//Google//Chrome//Application//chrome.exe'
const csvFilePath = 'csv.csv';

(async () => {
    try {
        const csvData = await fs.promises.readFile(csvFilePath, 'utf-8');
        const records = await parseCSV(csvData);

        for (const record of records) {
            const proxyUsername = record.Proxy_Username;
            const proxyPassword = record.Proxy_Password;
            const proxyAddress = record.Proxy_Address;
            const proxyPort = record.Proxy_Port;

            console.log(`Using proxy: ${proxyAddress}:${proxyPort}`);

            const browser = await puppeteer.launch({
                executablePath: CHROME_PATH, 
                headless: false,
                args: [
                    `--proxy-server=${proxyAddress}:${proxyPort}`,
                        `--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/114.0.5735.99 Mobile/15E148 Safari/604.1`
                //   `user-agent= Mozilla/5.0 (Android 10; Mobile; rv:68.0) Gecko/68.0 Firefox/68.0`

                        ,'--disable-device-emulation',
                    '--disable-network-emulation',

                ],
                ignoreHTTPSErrors: true
            });

            const page = await browser.newPage();
            page.setDefaultNavigationTimeout(90000);

            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');
            await client.send('Storage.clearDataForOrigin', {
                origin: 'https://trackback.gotrackier.com',
                storageTypes: 'all'
            });

            if (proxyUsername && proxyPassword) {
                await page.authenticate({
                    username: proxyUsername,
                    password: proxyPassword
                });
            }

            try {
                await page.setViewport({ width: 390, height: 844 });

                await page.goto('https://trackback.gotrackier.com/click?campaign_id=31585&pub_id=18', {
                    waitUntil: 'domcontentloaded'
                });

                await page.waitForSelector('a[data-cats-id="I Accept"]', { timeout: 30000 });
                await page.click('a[data-cats-id="I Accept"]');
                await new Promise(resolve => setTimeout(resolve, 70000));

                await fillFormField(page, '#first_name', record.First_Name);
                await fillFormField(page, '#last_name', record.Last_name);
                await fillFormField(page, '#phone', record.mobile);
                await fillFormField(page, '#email', record.email);

                await page.waitForSelector('.sdp-form-dropdown-option-control-container', { timeout: 30000, visible: true });
                await page.click('.sdp-form-dropdown-option-control-container');
                await page.type('.sdp-form-dropdown-option-control-container', record.option, { delay: 200 });

                await checkCheckbox(page, '#extended_privacy', record.yes_checkbox);
                await checkCheckbox(page, '#marketing_consent', record.please);

                await page.waitForSelector('input[value="Submit"]', { timeout: 30000, visible: true });
                await page.click('input[value="Submit"]', { delay: 200 });
                await new Promise(resolve => setTimeout(resolve, 100000));
                await page.screenshot({ path: `error_${record.First_Name}.png` });

                console.log(`Form submitted for: ${record.First_Name}`);
            } catch (error) {
                console.error(`Error: ${error}`);
            } finally {
                // await browser.close();
            }
        }


        console.log('All forms submitted successfully.');
    } catch (error) {
        console.error('Error:', error);
    }
})();

async function parseCSV(csvData) {
    return new Promise((resolve, reject) => {
        parse(csvData, { columns: true, trim: true }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function fillFormField(page, selector, value) {
    console.log(`Filling field ${selector} with value ${value}`);
    await page.waitForSelector(selector, { timeout: 30000, visible: true });
    await page.focus(selector);
    await page.keyboard.type(value, { delay: 400 });
}

async function checkCheckbox(page, selector, value) {
    console.log(`Checking checkbox ${selector} with value ${value}`);
    await page.waitForSelector(selector, { timeout: 30000, visible: true });
    const checkbox = await page.$(selector);
    if (checkbox) {
        const isChecked = await (await checkbox.getProperty('checked')).jsonValue();
        if (value.toLowerCase() === 'yes' && !isChecked) {
            await checkbox.click();
        } else if (value.toLowerCase() !== 'yes' && isChecked) {
            await checkbox.click();
        }
    }
}
