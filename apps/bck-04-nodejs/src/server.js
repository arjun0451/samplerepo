const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = 8080;
const DATA_DIR = "/data";

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Identify pod (hostname)
const POD_NAME = process.env.HOSTNAME || os.hostname();
const LOG_FILE = path.join(DATA_DIR, `log-${POD_NAME}.txt`);
const COUNTER_FILE = path.join(DATA_DIR, `counter-${POD_NAME}.txt`);

// Initialize counter
if (!fs.existsSync(COUNTER_FILE)) fs.writeFileSync(COUNTER_FILE, "0");

// Background write every 3 seconds
setInterval(() => {
    let counter = parseInt(fs.readFileSync(COUNTER_FILE, 'utf-8'));
    counter++;
    const logEntry = `Pod: ${POD_NAME} | Write #${counter} | ${new Date().toISOString()}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
    fs.writeFileSync(COUNTER_FILE, counter.toString());
}, 3000);

// SHA256 helper
function hash(file) {
    if (!fs.existsSync(file)) return "N/A";
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Disk usage helper
function df(dir) {
    try {
        return execSync(`df -h ${dir}`).toString();
    } catch {
        return "Unavailable";
    }
}

// HTML generator
app.get('/', (req, res) => {
    const files = fs.readdirSync(DATA_DIR);
    const counterFiles = files.filter(f => f.startsWith("counter-"));
    const logFiles = files.filter(f => f.startsWith("log-"));

    const podData = counterFiles.map(file => {
        const pod = file.split('-').slice(2).join('-').replace('.txt', '');
        const counterPath = path.join(DATA_DIR, file);
        const logFile = logFiles.find(lf => lf.includes(pod));
        const logPath = logFile ? path.join(DATA_DIR, logFile) : null;

        return {
            pod,
            counter: fs.existsSync(counterPath) ? fs.readFileSync(counterPath, 'utf-8') : "N/A",
            logs: logPath && fs.existsSync(logPath)
                ? fs.readFileSync(logPath, 'utf-8').split("\n").slice(-5).join("\n")
                : "No logs yet",
            hash: logPath ? hash(logPath) : "N/A"
        };
    });

    // Build HTML with modern terminal style
    let html = `
    <html>
    <head>
        <meta http-equiv="refresh" content="5">
        <style>
            body { font-family: monospace; background: #1e1e2f; color: #c5c8c6; margin:0; padding:0; }
            h1, h2 { text-align:center; color:#f1f1f1; margin:10px 0; }
            .banner { background: #28293d; padding: 10px; margin: 10px; border-radius: 8px; text-align:center; }
            .pods { display:flex; flex-wrap:wrap; justify-content:center; }
            .pod { background: rgba(0,0,0,0.4); margin: 5px; padding:10px; border-radius: 8px; width:300px; }
            .pod-header { font-weight:bold; color:#61dafb; margin-bottom:5px; }
            pre { background: rgba(255,255,255,0.05); padding:5px; border-radius:4px; overflow-x:auto; max-height:150px; }
            .footer { text-align:center; font-size:0.8em; margin:10px 0; color:#888; }
            .pod-symbol { font-size:1.2em; margin-right:5px; color:#00ff00; }
        </style>
    </head>
    <body>
        <div class="banner">🟢 <b>OpenShift RWX Multi-POD Backup Dashboard - BCK-04</b></div>
        <h2>Overall Filesystem Usage</h2>
        <pre>${df(DATA_DIR)}</pre>

        <div class="pods">`;

    podData.forEach(pod => {
        html += `
            <div class="pod">
                <div class="pod-header"><span class="pod-symbol">🟢</span>Pod: ${pod.pod}</div>
                <p><b>Write Counter:</b> ${pod.counter}</p>
                <p><b>SHA256 (log file):</b><br>${pod.hash}</p>
                <h4>Last 5 Log Entries</h4>
                <pre>${pod.logs}</pre>
            </div>`;
    });

    html += `
        </div>
        <div class="footer">UTC Time: ${new Date().toUTCString()}</div>
    </body>
    </html>`;

    res.send(html);
});

app.listen(PORT, () => console.log(`🟢 RWX Multi-POD Test App running on port ${PORT}...`));
