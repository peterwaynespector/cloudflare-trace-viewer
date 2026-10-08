// DOM Elements
const loadBtn = document.getElementById('loadBtn');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const resultContainer = document.getElementById('resultContainer');
const copyBtn = document.getElementById('copyBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// API Endpoint
const TRACE_API = 'https://one.one.one.one/cdn-cgi/trace';

// Field mapping untuk tab
const fieldTabs = {
    'ip': ['overview', 'network', 'security'],
    'h': ['overview', 'network'],
    'loc': ['overview'],
    'colo': ['overview', 'network'],
    'http': ['overview', 'network'],
    'tls': ['security'],
    'uag': ['network'],
    'visit_scheme': ['overview', 'network'],
    'ts': ['overview', 'network'],
    'fl': ['overview'],
    'sni': ['security'],
    'warp': ['security'],
    'gateway': ['security'],
    'rbi': ['security'],
    'kex': ['security'],
    'sliver': ['network']
};

// Utility Functions
function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;
    
    if (type === 'error') {
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 5000);
    }
}

function hideStatus() {
    statusEl.classList.remove('show');
}

function setLoading(isLoading) {
    if (isLoading) {
        loadingEl.classList.remove('hidden');
        resultContainer.classList.add('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
}

function formatTimestamp(timestamp) {
    try {
        // Timestamp dari Cloudflare dalam format: epoch.millis
        const epochMs = parseFloat(timestamp) * 1000;
        const date = new Date(epochMs);
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        };
        
        return date.toLocaleDateString('id-ID', options);
    } catch (e) {
        return timestamp;
    }
}

function parseTraceResponse(text) {
    const data = {};
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        if (!line || !line.includes('=')) continue;
        
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        
        if (key && value) {
            data[key] = value;
        }
    }

    return data;
}

function updateUI(data) {
    // Update semua field
    for (const [key, value] of Object.entries(data)) {
        // Overview tab
        const overviewEl = document.getElementById(`${key}-overview`);
        if (overviewEl) {
            if (key === 'ts') {
                overviewEl.textContent = value;
                const formattedEl = document.getElementById('ts-formatted');
                if (formattedEl) {
                    formattedEl.textContent = formatTimestamp(value);
                }
            } else {
                overviewEl.textContent = value || '—';
            }
        }

        // Network tab
        const networkEl = document.getElementById(`${key}-network`);
        if (networkEl) {
            networkEl.textContent = value || '—';
        }

        // Security tab
        const securityEl = document.getElementById(`${key}-security`);
        if (securityEl) {
            securityEl.textContent = value || '—';
        }
    }

    // Update raw data
    const rawDataEl = document.getElementById('raw-data');
    if (rawDataEl) {
        rawDataEl.textContent = Object.entries(data)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
    }
}

function showResults() {
    resultContainer.classList.remove('hidden');
    setLoading(false);
    
    // Scroll ke results
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Event Listeners
loadBtn.addEventListener('click', fetchTraceData);
copyBtn.addEventListener('click', copyRawData);

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        
        // Update active button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active content
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    });
});

async function fetchTraceData() {
    try {
        showStatus('Mengambil data dari Cloudflare Trace API...');
        setLoading(true);

        const response = await fetch(TRACE_API, {
            method: 'GET',
            cache: 'no-cache',
            mode: 'cors',
            headers: {
                'Accept': 'text/plain'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        const data = parseTraceResponse(text);

        if (!Object.keys(data).length) {
            throw new Error('Response API kosong atau tidak valid');
        }

        // Validasi IP
        if (!data.ip) {
            throw new Error('Tidak dapat mengambil IP address');
        }

        updateUI(data);
        showResults();
        showStatus('✓ Data berhasil diambil dari Cloudflare Trace API', 'success');

    } catch (error) {
        setLoading(false);
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showStatus('❌ Gagal terhubung ke API. Pastikan koneksi internet aktif.', 'error');
        } else if (error.message.includes('CORS')) {
            showStatus('❌ Error CORS. Coba refresh halaman atau gunakan browser lain.', 'error');
        } else {
            showStatus(`❌ ${error.message}`, 'error');
        }
        
        console.error('Error:', error);
    }
}

function copyRawData() {
    const rawData = document.getElementById('raw-data').textContent;
    
    if (!rawData || rawData === '—') {
        showStatus('Tidak ada data untuk disalin', 'error');
        return;
    }

    navigator.clipboard.writeText(rawData).then(() => {
        showStatus('✓ Data berhasil disalin ke clipboard', 'success');
        
        // Ubah teks tombol sementara
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span>✓ Disalin!</span>';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Copy error:', err);
        showStatus('❌ Gagal menyalin data', 'error');
    });
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    // Delay sedikit untuk animasi yang smooth
    setTimeout(() => {
        fetchTraceData();
    }, 500);
});

// Refresh data every 5 minutes
setInterval(() => {
    fetchTraceData();
}, 5 * 60 * 1000);
