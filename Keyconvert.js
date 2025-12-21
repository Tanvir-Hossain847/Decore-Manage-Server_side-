const fs = require('fs');
const key = fs.readFileSync('./style-decor-d89db-firebase-adminsdk-fbsvc-bf21d628a1.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)