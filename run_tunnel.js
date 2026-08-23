const { spawn } = require('node:child_process');

function startTunnel() {
    console.log("🚀 Starting persistent public tunnel with auto-reconnect...");

    // SSH tunnel with ServerAliveInterval to keep alive indefinitely
    const ssh = spawn('ssh', [
        '-tt',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=20',
        '-o', 'ServerAliveCountMax=10',
        '-o', 'ExitOnForwardFailure=yes',
        '-R', '80:127.0.0.1:3000',
        'nokey@localhost.run'
    ]);

    ssh.stdout.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/(https:\/\/[a-z0-9]+\.lhr\.life)/i);
        if (match) {
            console.log("\n=======================================================");
            console.log("🌟 PUBLIC SHAREABLE LIVE URL:");
            console.log(match[1]);
            console.log("=======================================================\n");
        }
        process.stdout.write(data);
    });

    ssh.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    ssh.on('close', (code) => {
        console.log(`Tunnel closed with code ${code}. Reconnecting in 3 seconds...`);
        setTimeout(startTunnel, 3000);
    });
}

startTunnel();
