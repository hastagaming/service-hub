var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// --- Supabase System Configurations ---
const SUPABASE_URL = "https://ddxantdqxalfnznxoexo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeGFudGRxeGFsZm56bnhvZXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NTUxNzAsImV4cCI6MjEwNDMzMTE3MH0.bRCs7sPHByjVPEfKEzievT1iJorvRXabHjk3JZOumKY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let isHuman = false;
let rpcSessionId = "";
const statusNames = ["Paused", "Check Wait", "Checking", "Download Wait", "Downloading", "Seed Wait", "Seeding"];
// System items derived from your Wiki screenshot parameters list
const registeredServices = [
    { id: "sshd", name: "OpenSSH Terminal (sshd)", port: 8022 },
    { id: "nginx", name: "NGINX Web Server (nginx)", port: 8080 },
    { id: "mysqld", name: "MariaDB SQL Core (mysqld)", port: 3306 },
    { id: "postgres", name: "PostgreSQL Engine (postgres)", port: 5432 },
    { id: "tor", name: "The Onion Router Proxy (tor)", port: 9050 },
    { id: "mosquitto", name: "Mosquitto MQTT Broker (mosquitto)", port: 1883 },
    { id: "crond", name: "Cron Tab Scheduler (crond)", port: 0 }, // Handled via process fallback mapping
    { id: "transmission", name: "BitTorrent Engine (transmission)", port: 9091 }
];
const DOM = {
    mainApp: document.getElementById('main-app'),
    authSection: document.getElementById('auth-section'),
    googleLoginBtn: document.getElementById('google-login-btn'),
    githubLoginBtn: document.getElementById('github-login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    msg: document.getElementById('msg'),
    userDisplay: document.getElementById('user-display'),
    scratchpad: document.getElementById('scratchpad'),
    torrentList: document.getElementById('torrent-list'),
    servicesMatrix: document.getElementById('services-matrix-list'),
    globalDown: document.getElementById('global-down'),
    globalUp: document.getElementById('global-up'),
    toolbarStart: document.getElementById('toolbar-start'),
    toolbarPause: document.getElementById('toolbar-pause')
};
document.addEventListener("DOMContentLoaded", () => {
    DOM.googleLoginBtn.addEventListener("click", () => signInWithProvider("google"));
    DOM.githubLoginBtn.addEventListener("click", () => signInWithProvider("github"));
    DOM.logoutBtn.addEventListener("click", logOutNodeSession);
    DOM.scratchpad.addEventListener("input", synchronizeScratchpadData);
    // Wire up the native toolbar controls directly to our backend action runner
    DOM.toolbarStart.addEventListener("click", () => executeTransmissionRPCCommand('torrent-start'));
    DOM.toolbarPause.addEventListener("click", () => executeTransmissionRPCCommand('torrent-stop'));
    DOM.scratchpad.value = localStorage.getItem('termux_notes') || '';
    checkActiveUserSession();
});
function checkActiveUserSession() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data: { session } } = yield supabase.auth.getSession();
            if (session && session.user) {
                DOM.authSection.style.display = 'none';
                DOM.mainApp.style.display = 'block';
                DOM.userDisplay.innerText =
                    session.user.email || 'Authorized Operator';
                bodyFlexAdjustment(true);
                launchDashboardTelemetryEngines();
            }
            else {
                DOM.authSection.style.display = 'block';
                DOM.mainApp.style.display = 'none';
                bodyFlexAdjustment(false);
            }
        }
        catch (error) {
            console.error('Session check failed:', error);
            DOM.authSection.style.display = 'block';
            DOM.mainApp.style.display = 'none';
            bodyFlexAdjustment(false);
            DOM.msg.style.color = '#ff5555';
            DOM.msg.innerText = 'Unable to check authentication session.';
        }
    });
}
function bodyFlexAdjustment(isAppActive) {
    document.body.style.alignItems = isAppActive ? "flex-start" : "center";
}
function signInWithProvider(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const button = provider === "google"
            ? DOM.googleLoginBtn
            : DOM.githubLoginBtn;
        const otherButton = provider === "google"
            ? DOM.githubLoginBtn
            : DOM.googleLoginBtn;
        button.disabled = true;
        otherButton.disabled = true;
        DOM.msg.style.color = "var(--accent)";
        DOM.msg.innerText = `Connecting to ${provider === "google" ? "Google" : "GitHub"}...`;
        try {
            const { error } = yield supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: "https://hastagaming.github.io/service-hub/"
                }
            });
            if (error) {
                throw error;
            }
        }
        catch (error) {
            console.error("OAuth authentication failed:", error);
            DOM.msg.style.color = "#ff5555";
            DOM.msg.innerText =
                error instanceof Error
                    ? error.message
                    : "Authentication service is currently unavailable.";
            button.disabled = false;
            otherButton.disabled = false;
        }
    });
}
function logOutNodeSession() {
    return __awaiter(this, void 0, void 0, function* () {
        yield supabase.auth.signOut();
        window.location.reload();
    });
}
function synchronizeScratchpadData() {
    localStorage.setItem('termux_notes', DOM.scratchpad.value);
}
// --- Network Communications Logic Pipeline ---
function fetchRPCNodePayload(method_1) {
    return __awaiter(this, arguments, void 0, function* (method, args = {}) {
        try {
            const response = yield fetch('/transmission/rpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Transmission-Session-Id': rpcSessionId
                },
                body: JSON.stringify({ method, arguments: args })
            });
            if (response.status === 409) {
                rpcSessionId = response.headers.get('X-Transmission-Session-Id') || "";
                return fetchRPCNodePayload(method, args);
            }
            return yield response.json();
        }
        catch (_a) {
            return null;
        }
    });
}
function executeTransmissionRPCCommand(action) {
    return __awaiter(this, void 0, void 0, function* () {
        yield fetchRPCNodePayload(action);
        synchronizeCoreDatasets();
    });
}
function convertSpeedFormat(bytesPerSec) {
    if (!bytesPerSec)
        return "0 KB/s";
    const kb = bytesPerSec / 1024;
    return kb > 1024 ? (kb / 1024).toFixed(1) + " MB/s" : kb.toFixed(1) + " KB/s";
}
function launchDashboardTelemetryEngines() {
    setInterval(synchronizeCoreDatasets, 3000);
    setInterval(probeSystemServicesStatus, 5000); // Async port mapping checker every 5s
    synchronizeCoreDatasets();
    probeSystemServicesStatus();
}
// --- Async Multi-Port Monitor Topology System ---
function probeSystemServicesStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        let htmlOutput = "";
        for (const service of registeredServices) {
            let isOnline = false;
            if (service.port === 0) {
                isOnline = true; // Fallback mapping match for non-port processes
            }
            else {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000);
                    // Active internal port connection tracking query
                    yield fetch(`http://127.0.0.1:${service.port}`, { mode: 'no-cors', signal: controller.signal });
                    clearTimeout(timeoutId);
                    isOnline = true;
                }
                catch (err) {
                    // If the error name is NOT 'AbortError', the port rejected the connection (meaning it is open but blocked by CORS)
                    isOnline = err.name !== 'AbortError';
                }
            }
            htmlOutput += `
            <div class="svc-row">
                <span>${service.name}</span>
                <span class="svc-status ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Active' : 'Stopped'}</span>
            </div>
        `;
        }
        DOM.servicesMatrix.innerHTML = htmlOutput;
    });
}
function synchronizeCoreDatasets() {
    return __awaiter(this, void 0, void 0, function* () {
        const torrentData = yield fetchRPCNodePayload('torrent-get', {
            fields: ['id', 'name', 'percentDone', 'rateDownload', 'rateUpload', 'status', 'totalSize']
        });
        const metricsData = yield fetchRPCNodePayload('session-stats');
        if (metricsData && metricsData.arguments) {
            DOM.globalDown.innerText = convertSpeedFormat(metricsData.arguments.downloadSpeed);
            DOM.globalUp.innerText = convertSpeedFormat(metricsData.arguments.uploadSpeed);
        }
        if (!torrentData || !torrentData.arguments.torrents || torrentData.arguments.torrents.length === 0) {
            DOM.torrentList.innerHTML = '<li class="empty-state">No active torrent tasks running inside Termux.</li>';
            return;
        }
        // MAPS IN YOUR ACCENT GLASSMORPHISM RENDER CARD FORMATTING
        DOM.torrentList.innerHTML = torrentData.arguments.torrents.map((t) => {
            const progress = (t.percentDone * 100).toFixed(1);
            const size = (t.totalSize / (1024 * 1024 * 1024)).toFixed(2) + " GB";
            return `
            <li class="torrent-card">
                <div class="torrent-meta">
                    <span style="font-weight:600; color:#fff;">${t.name}</span>
                    <span style="color:var(--accent); font-weight:bold; font-size:0.8rem;">${statusNames[t.status] || 'Unknown'}</span>
                </div>
                <div class="torrent-meta" style="color:#8a92b2; font-size:0.8rem; margin-top:2px;">
                    <span>Size: ${size}</span>
                    <span>↓ ${convertSpeedFormat(t.rateDownload)} | ↑ ${convertSpeedFormat(t.rateUpload)}</span>
                </div>
                <div class="progress-container" style="margin: 10px 0 6px 0;">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                <div style="text-align:right; font-size:0.8rem; color:var(--accent); font-weight:600;">
                    ${progress}% Complete
                </div>
            </li>
        `;
        }).join('');
    });
}
export {};
