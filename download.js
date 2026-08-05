const fs = require('fs');
const https = require('https');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        fs.writeFileSync(dest, data);
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  await download("https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ODRhZTI3Njg0ZmUwOTM0ZjE2MjJkMDFjODI2EgsSBxDvkNfWphoYAZIBIwoKcHJvamVjdF9pZBIVQhMzOTc1NTgwMDU5MzcwMzgzNTE2&filename=&opi=89354086", "home.html");
  await download("https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1ODRhZTI2YTk3NGIwMWE2MDM1Mjc3MmFiOGM5EgsSBxDvkNfWphoYAZIBIwoKcHJvamVjdF9pZBIVQhMzOTc1NTgwMDU5MzcwMzgzNTE2&filename=&opi=89354086", "detail.html");
  console.log("Downloaded successfully.");
}

main();
