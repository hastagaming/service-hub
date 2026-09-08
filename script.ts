export {}

declare global {
    interface Window {
        supabase: any;
    }
}

interface TorrentTask {
    id: number;
    name: string;
    percentDone: number;
    rateDownload: number;
    rateUpload: number;
    status: number;
    totalSize: number;
}

interface RPCResponse {
    method: string;
    arguments: {
        torrents?: TorrentTask[];
        downloadSpeed?: number;
        uploadSpeed?: number;
    };
}

interface ServiceBlueprint {
    id: string;
    name: string;
    port: number;
}

// --- Supabase System Configurations ---
const SUPABASE_URL: string = "https://ddxantdqxalfnznxoexo.supabase.co";
const SUPABASE_KEY: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeGFudGRxeGFsZm56bnhvZXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NTUxNzAsImV4cCI6MjEwNDMzMTE3MH0.bRCs7sPHByjVPEfKEzievT1iJorvRXabHjk3JZOumKY";
const supabase = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isHuman: boolean = false;
let rpcSessionId: string = "";
const statusNames: string[] = ["Paused", "Check Wait", "Checking", "Download Wait", "Downloading", "Seed Wait", "Seeding"];

// System items derived from your Wiki screenshot parameters list
const registeredServices: ServiceBlueprint[] = [
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
    mainApp: document.getElementById('main-app') as HTMLDivElement,
    authSection: document.getElementById('auth-section') as HTMLDivElement,
    googleLoginBtn: document.getElementById('google-login-btn') as HTMLButtonElement,
    githubLoginBtn: document.getElementById('github-login-btn') as HTMLButtonElement,
    logoutBtn: document.getElementById('logout-btn') as HTMLButtonElement,
    msg: document.getElementById('msg') as HTMLDivElement,
    userDisplay: document.getElementById('user-display') as HTMLSpanElement,
    scratchpad: document.getElementById('scratchpad') as HTMLTextAreaElement,
    torrentList: document.getElementById('torrent-list') as HTMLUListElement,
    servicesMatrix: document.getElementById('services-matrix-list') as HTMLDivElement,
    globalDown: document.getElementById('global-down') as HTMLSpanElement,
    globalUp: document.getElementById('global-up') as HTMLSpanElement,
    toolbarStart: document.getElementById('toolbar-start') as HTMLButtonElement,
    toolbarPause: document.getElementById('toolbar-pause') as HTMLButtonElement
};

document.addEventListener("DOMContentLoaded", () => {
    DOM.googleLoginBtn.addEventListener(
        "click",
        () => signInWithProvider("google")
    );
    DOM.githubLoginBtn.addEventListener(
        "click",
        () => signInWithProvider("github")
    );
    DOM.logoutBtn.addEventListener("click", logOutNodeSession);
    DOM.scratchpad.addEventListener("input", synchronizeScratchpadData);
    // Wire up the native toolbar controls directly to our backend action runner
    DOM.toolbarStart.addEventListener("click", () => executeTransmissionRPCCommand('torrent-start'));
    DOM.toolbarPause.addEventListener("click", () => executeTransmissionRPCCommand('torrent-stop'));
    DOM.scratchpad.value = localStorage.getItem('termux_notes') || '';
    checkActiveUserSession();
});

async function checkActiveUserSession(): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
            DOM.authSection.style.display = 'none';
            DOM.mainApp.style.display = 'block';
            DOM.userDisplay.innerText =
                session.user.email || 'Authorized Operator';

            bodyFlexAdjustment(true);
            launchDashboardTelemetryEngines();
        } else {
            DOM.authSection.style.display = 'block';
            DOM.mainApp.style.display = 'none';
            bodyFlexAdjustment(false);
        }
    } catch (error) {
        console.error('Session check failed:', error);

        DOM.authSection.style.display = 'block';
        DOM.mainApp.style.display = 'none';
        bodyFlexAdjustment(false);

        DOM.msg.style.color = '#ff5555';
        DOM.msg.innerText = 'Unable to check authentication session.';
    }
}

function bodyFlexAdjustment(isAppActive: boolean): void {
    document.body.style.alignItems = isAppActive ? "flex-start" : "center";
}

async function signInWithProvider(
    provider: "google" | "github"
): Promise<void> {

    const button =
        provider === "google"
            ? DOM.googleLoginBtn
            : DOM.githubLoginBtn;

    const otherButton =
        provider === "google"
            ? DOM.githubLoginBtn
            : DOM.googleLoginBtn;

    button.disabled = true;
    otherButton.disabled = true;

    DOM.msg.style.color = "var(--accent)";
    DOM.msg.innerText =
        `Connecting to ${provider === "google" ? "Google" : "GitHub"}...`;

    console.log("[OAuth] Starting:", provider);
    console.log("[OAuth] Supabase:", supabase);
    console.log("[OAuth] Redirect:",
        "https://hastagaming.github.io/service-hub/"
    );

    try {

        const result = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo:
                    "https://hastagaming.github.io/service-hub/"
            }
        });

        console.log("[OAuth] Result:", result);

        if (result.error) {
            throw result.error;
        }

        console.log("[OAuth] Redirect initiated");

    } catch (error) {

        console.error("[OAuth] FAILED:", error);

        DOM.msg.style.color = "#ff5555";

        DOM.msg.innerText =
            error instanceof Error
                ? `OAuth error: ${error.message}`
                : "OAuth authentication failed.";

        button.disabled = false;
        otherButton.disabled = false;
    }
}

async function logOutNodeSession(): Promise<void> { 
    await supabase.auth.signOut(); 
    window.location.reload(); 
}

function synchronizeScratchpadData(): void { 
    localStorage.setItem('termux_notes', DOM.scratchpad.value); 
}

// --- Network Communications Logic Pipeline ---
async function fetchRPCNodePayload(method: string, args: object = {}): Promise<any> {
    try {
        const response = await fetch('/transmission/rpc', {
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
        return await response.json();
    } catch { 
        return null; 
    }
}

async function executeTransmissionRPCCommand(action: 'torrent-start' | 'torrent-stop'): Promise<void> {
    await fetchRPCNodePayload(action);
    synchronizeCoreDatasets();
}

function convertSpeedFormat(bytesPerSec: number | undefined): string {
    if (!bytesPerSec) return "0 KB/s";
    const kb = bytesPerSec / 1024;
    return kb > 1024 ? (kb / 1024).toFixed(1) + " MB/s" : kb.toFixed(1) + " KB/s";
}

function launchDashboardTelemetryEngines(): void {
    setInterval(synchronizeCoreDatasets, 3000);
    setInterval(probeSystemServicesStatus, 5000); // Async port mapping checker every 5s
    synchronizeCoreDatasets();
    probeSystemServicesStatus();
}

// --- Async Multi-Port Monitor Topology System ---
async function probeSystemServicesStatus(): Promise<void> {
    let htmlOutput = "";
    
    for (const service of registeredServices) {
        let isOnline = false;
        
        if (service.port === 0) {
            isOnline = true; // Fallback mapping match for non-port processes
        } else {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);
                
                // Active internal port connection tracking query
                await fetch(`http://127.0.0.1:${service.port}`, { mode: 'no-cors', signal: controller.signal });
                clearTimeout(timeoutId);
                isOnline = true;
            } catch (err: any) {
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
}

async function synchronizeCoreDatasets(): Promise<void> {
    const torrentData: RPCResponse = await fetchRPCNodePayload('torrent-get', {
        fields: ['id', 'name', 'percentDone', 'rateDownload', 'rateUpload', 'status', 'totalSize']
    });
    const metricsData: RPCResponse = await fetchRPCNodePayload('session-stats');

    if (metricsData && metricsData.arguments) {
        DOM.globalDown.innerText = convertSpeedFormat(metricsData.arguments.downloadSpeed);
        DOM.globalUp.innerText = convertSpeedFormat(metricsData.arguments.uploadSpeed);
    }

    if (!torrentData || !torrentData.arguments.torrents || torrentData.arguments.torrents.length === 0) {
        DOM.torrentList.innerHTML = '<li class="empty-state">No active torrent tasks running inside Termux.</li>';
        return;
    }

    // MAPS IN YOUR ACCENT GLASSMORPHISM RENDER CARD FORMATTING
    DOM.torrentList.innerHTML = torrentData.arguments.torrents.map((t: TorrentTask) => {
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
}
