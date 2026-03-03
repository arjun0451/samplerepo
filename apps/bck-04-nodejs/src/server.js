const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = 8080;
const DATA_DIR = "/data";

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const POD_NAME = process.env.HOSTNAME || os.hostname();
const LOG_FILE = path.join(DATA_DIR, `log-${POD_NAME}.txt`);
const COUNTER_FILE = path.join(DATA_DIR, `counter-${POD_NAME}.txt`);

if (!fs.existsSync(COUNTER_FILE)) fs.writeFileSync(COUNTER_FILE, "0");

setInterval(() => {
    let counter = parseInt(fs.readFileSync(COUNTER_FILE, 'utf-8'));
    counter++;
    const logEntry = `Pod: ${POD_NAME} | Write #${counter} | ${new Date().toISOString()}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
    fs.writeFileSync(COUNTER_FILE, counter.toString());
}, 3000);

function hash(file) {
    if (!fs.existsSync(file)) return "N/A";
    return crypto.createHash('sha256')
        .update(fs.readFileSync(file))
        .digest('hex');
}

function df(dir) {
    try {
        return execSync(`df -h ${dir}`).toString();
    } catch {
        return "Unavailable";
    }
}

app.get('/', (req, res) => {

    const files = fs.readdirSync(DATA_DIR);
    const counterFiles = files.filter(f => f.startsWith("counter-"));
    const logFiles = files.filter(f => f.startsWith("log-"));

    const podData = counterFiles.map(file => {
        const pod = file.split('-').slice(1).join('-').replace('.txt', '');
        const counterPath = path.join(DATA_DIR, file);
        const logFile = logFiles.find(lf => lf.includes(pod));
        const logPath = logFile ? path.join(DATA_DIR, logFile) : null;

        return {
            pod,
            counter: fs.existsSync(counterPath) ? fs.readFileSync(counterPath, 'utf-8') : "N/A",
            logs: logPath && fs.existsSync(logPath)
                ? fs.readFileSync(logPath, 'utf-8').split("\n").slice(-6).join("\n")
                : "No logs yet",
            hash: logPath ? hash(logPath) : "N/A"
        };
    });

    let html = `
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="5">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BCK-04 RWX Dashboard</title>

<style>
body {
    margin: 0;
    font-family: 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
    color: #ffffff;
}

.header {
    text-align: center;
    padding: 20px;
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 1px;
}

.subtitle {
    text-align: center;
    color: #00ffd5;
    margin-bottom: 20px;
}

.dashboard {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    padding: 20px;
}

.card {
    backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 20px;
    width: 320px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.2);
    transition: 0.3s ease;
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
}

.card h3 {
    margin-top: 0;
    color: #00ffd5;
}

.counter {
    font-size: 22px;
    font-weight: bold;
    color: #ffffff;
}

.hash {
    font-size: 12px;
    word-break: break-all;
    color: #ffcc00;
}

.terminal {
    background: #000;
    color: #00ff00;
    padding: 10px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 12px;
    height: 120px;
    overflow-y: auto;
}

.section {
    padding: 20px;
    text-align: center;
}

.filesystem {
    background: #111;
    padding: 15px;
    border-radius: 8px;
    color: #00ff00;
    font-family: monospace;
    display: inline-block;
    text-align: left;
}

.footer {
    text-align: center;
    padding: 20px;
    font-size: 14px;
    color: #ccc;
}
</style>
</head>

<body>

<div class="header">🚀 OpenShift RWX Multi-POD Dashboard</div>
<div class="subtitle">BCK-04 Stateful Backup Validation</div>

<div class="section">
    <h2>Filesystem Usage</h2>
    <div class="filesystem">
        <pre>${df(DATA_DIR)}</pre>
    </div>
</div>

<div class="dashboard">
`;

    podData.forEach(pod => {
        html += `
        <div class="card">
            <h3>Pod: ${pod.pod}</h3>
            <div class="counter">Writes: ${pod.counter}</div>
            <p><b>SHA256:</b></p>
            <div class="hash">${pod.hash}</div>
            <h4>Last Logs</h4>
            <div class="terminal">${pod.logs}</div>
        </div>
        `;
    });

    html += `
</div>

<div class="footer">
    UTC Time: ${new Date().toUTCString()}
</div>

</body>
</html>
`;

    res.send(html);
});

app.listen(PORT, () =>
    console.log(`Modern RWX Dashboard running on port ${PORT}...`)
);
