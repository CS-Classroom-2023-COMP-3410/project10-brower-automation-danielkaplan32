const puppeteer = require('puppeteer');
const fs = require('fs');

// TODO: Load the credentials from the 'credentials.json' file
// HINT: Use the 'fs' module to read and parse the file
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const LIST_NAME = 'Node Libraries'; 

(async () => {
    // TODO: Launch a browser instance and open a new page
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100, // Slowed to debug
        defaultViewport: null,
        args: ['--start-maximized']
    });
    const page = await browser.newPage();

    // Navigate to GitHub login page
    await page.goto('https://github.com/login');

    // TODO: Login to GitHub using the provided credentials
    // HINT: Use the 'type' method to input username and password, then click on the submit button
    await page.type('#login_field', credentials.username, { delay: 10 });
    await page.type('#password', credentials.password, { delay: 10 });
    await page.click('input[name="commit"]');

    // Wait for successful login
    await page.waitForSelector('.avatar.circle');

    // Extract the actual GitHub username to be used later
    const actualUsername = await page.$eval('meta[name="octolytics-actor-login"]', meta => meta.content);

    const repositories = ["cheeriojs/cheerio", "axios/axios", "puppeteer/puppeteer"];

    for (const repo of repositories) {
        await page.goto(`https://github.com/${repo}`, { waitUntil: 'networkidle2' });

        // TODO: Star the repository
        // HINT: Use selectors to identify and click on the star button
        const starBtn = await page.$('.unstarred button[aria-label^="Star"]');
        if (starBtn) {
            await page.evaluate(el => el.click(), starBtn);
            await page.waitForSelector('.starred');
            await new Promise(r => setTimeout(r, 2000)); // Make sure action is fully processed
        }
    }

    // TODO: Navigate to the user's starred repositories page
    await page.goto(`https://github.com/${actualUsername}?tab=stars`, { waitUntil: 'networkidle2' });

    // TODO: Click on the "Create list" button
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, summary')).find(b => b.textContent.includes('Create list'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // TODO: Create a list named "Node Libraries"
    // HINT: Wait for the input field and type the list name
    await page.waitForSelector('#user_list_name');
    await page.type('#user_list_name', LIST_NAME, { delay: 10 });

    // Wait for buttons to become visible
    await new Promise(r => setTimeout(r, 1000));

    // Identify and click the "Create" button
    await page.waitForFunction(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create');
        return btn && !btn.disabled;
    });

    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create');
        if (btn) btn.click();
    });

    // Allow some time for the list creation process
    await new Promise(r => setTimeout(r, 4000));

    // Refreshed navigation to the stars page to start the batch addition
    await page.goto(`https://github.com/${actualUsername}?tab=stars`, { waitUntil: 'networkidle2' });

    for (const repo of repositories) {
        // Cleaning repo name for the search logic
        const repoNameOnly = repo.split('/')[1];
        console.log(`Adding to list: ${repoNameOnly}`);

        // TODO: Add this repository to the "Node Libraries" list
        // HINT: Open the dropdown, wait for it to load, and find the list by its name
        await page.evaluate(async (name, targetList) => {
            const rows = Array.from(document.querySelectorAll('.col-12.d-block.width-full'));
            const row = rows.find(r => r.querySelector('h3')?.innerText.toLowerCase().includes(name.toLowerCase()));
            
            if (row) {
                const summary = row.querySelector('summary[aria-label="Add this repository to a list"]');
                if (summary) {
                    summary.click(); // Open dropdown
                    await new Promise(r => setTimeout(r, 1500)); // Wait for load
                    
                    const checkboxes = Array.from(document.querySelectorAll('.js-user-list-menu-item'));
                    const targetCheckbox = checkboxes.find(input => {
                        const labelText = input.closest('label')?.innerText || "";
                        return labelText.includes(targetList);
                    });

                    if (targetCheckbox && !targetCheckbox.checked) {
                        targetCheckbox.click();
                    }
                    
                    await new Promise(r => setTimeout(r, 1000)); // Allow time to process
                    summary.click(); // Close dropdown
                }
            }
        }, repoNameOnly, LIST_NAME);

        // Allow some time for the action to process
        await new Promise(r => setTimeout(r, 2000));
    }

    // Refreshed navigation to the stars page to see additions to list
    await page.goto(`https://github.com/${actualUsername}?tab=stars`, { waitUntil: 'networkidle2' });
    console.log("Completed");
    // Final review pause
    await new Promise(r => setTimeout(r, 5000));
    
    // Close the browser
    await browser.close();
})();
