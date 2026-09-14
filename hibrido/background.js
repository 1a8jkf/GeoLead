// --- SISTEMA DE LICENÇA (TRIAL) ---
chrome.runtime.onInstalled.addListener(() => {
    initLicense();
});

initLicense();

function initLicense() {
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
        chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
            let userId = 'anonymous';
            let userEmail = '';
            if (userInfo && userInfo.id) {
                userId = userInfo.id;
                userEmail = userInfo.email;
            }
            chrome.storage.sync.get(['gl_trial_start', 'gl_user_id'], (res) => {
                if (!res.gl_trial_start) {
                    chrome.storage.sync.set({
                        gl_trial_start: Date.now(),
                        gl_user_id: userId,
                        gl_user_email: userEmail
                    });
                }
            });
        });
    } else {
        // Fallback se identity não estiver disponível
        chrome.storage.sync.get(['gl_trial_start'], (res) => {
            if (!res.gl_trial_start) {
                chrome.storage.sync.set({ gl_trial_start: Date.now() });
            }
        });
    }
}
// --- FIM SISTEMA DE LICENÇA ---

let isProcessing = false;
let queue = [];
let totalQueueSize = 0;
let successCount = 0;
let errorCount = 0;
let currentDelay = { value: 10, unit: 1 };
let currentPauseConfig = { enabled: false, duration: 5, every: 30 };
let messagesSincePause = 0;
let currentAttachment = null;
let currentAudio = null;

// Extractor State
let isExtracting = false;
let extLogs = [];
let extData = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start') {
        queue = request.queue;
        currentDelay = request.delay || { value: 10, unit: 1 };
        currentPauseConfig = request.pauseConfig || { enabled: false, duration: 5, every: 30 };
        currentAttachment = request.attachment || null;
        currentAudio = request.audio || null;
        totalQueueSize = queue.length;
        successCount = 0;
        errorCount = 0;
        messagesSincePause = 0;
        isProcessing = true;
        updateState();
        processNext();
        sendResponse({status: 'started'});
    } else if (request.action === 'stop') {
        isProcessing = false;
        queue = [];
        updateState();
        sendResponse({status: 'stopped'});
    } else if (request.action === 'task_completed') {
        if (isProcessing) {
            queue.shift(); 
            successCount++;
            messagesSincePause++;
            updateState();
            
            let waitTime = 0;
            
            if (currentPauseConfig.enabled && messagesSincePause >= currentPauseConfig.every) {
                messagesSincePause = 0;
                waitTime = currentPauseConfig.duration * 60 * 1000;
                console.log(`Lumo Sender: Pausa programada! Aguardando ${currentPauseConfig.duration} minutos...`);
            } else {
                if (currentDelay.random) {
                    const min = currentDelay.min * currentDelay.randomUnit * 1000;
                    const max = currentDelay.max * currentDelay.randomUnit * 1000;
                    // Ensure max is greater than or equal to min
                    const safeMax = Math.max(min, max);
                    waitTime = Math.floor(Math.random() * (safeMax - min + 1)) + min;
                } else {
                    waitTime = currentDelay.value * currentDelay.unit * 1000;
                }
                console.log(`Lumo Sender: Aguardando ${waitTime/1000}s para o próximo envio...`);
            }
            
            setTimeout(processNext, waitTime);
        }
    } else if (request.action === 'task_error') {
        if (isProcessing) {
            queue.shift();
            errorCount++;
            updateState();
            setTimeout(processNext, 3000); 
        }
    } else if (request.action === 'get_state') {
        sendResponse({
            isProcessing,
            queueSize: queue.length,
            totalQueueSize,
            successCount,
            errorCount
        });
    }
    
    // --- LÓGICA DO EXTRATOR ---
    else if (request.action === 'get_ext_state') {
        sendResponse({
            isExtracting,
            extLogs,
            extData
        });
    }
    else if (request.action === 'start_extract') {
        isExtracting = true;
        extLogs = [];
        extData = [];
        sendResponse({ status: 'ok' });
    }
    else if (request.type === 'EXTRACTION_LOG') {
        if (isExtracting) {
            extLogs.push(request.message);
            // Salva apenas os últimos 50 logs para não estourar memória
            if (extLogs.length > 50) extLogs.shift();
            
            // Repassa para o popup se estiver aberto
            chrome.runtime.sendMessage({ type: 'FWD_EXTRACTION_LOG', message: request.message }).catch(() => {});
        }
    }
    else if (request.type === 'EXTRACTION_FINISHED') {
        isExtracting = false;
        if (request.payload.success) {
            extData = request.payload.data;
        }
        chrome.runtime.sendMessage({ type: 'FWD_EXTRACTION_FINISHED', payload: request.payload }).catch(() => {});
    }
    else if (request.action === 'reset_extract') {
        isExtracting = false;
        extLogs = [];
        extData = [];
        sendResponse({ status: 'ok' });
    }

    return true;
});

function updateState() {
    chrome.storage.local.set({ 
        isProcessing, 
        whatsappQueue: queue,
        totalQueueSize,
        successCount,
        errorCount
    });
}

function processNext() {
    if (!isProcessing) return;
    if (queue.length === 0) {
        isProcessing = false;
        updateState();
        return;
    }
    
    const task = queue[0];
    
    chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
        if (tabs.length === 0) {
            isProcessing = false;
            updateState();
            return;
        }
        
        const tabId = tabs[0].id;
        
        // Em vez de mudar a URL da aba (que causa refresh), 
        // mandamos o content.js injetar e clicar num link
        sendExecuteMessage(tabId, 25, task);
    });
}

function sendExecuteMessage(tabId, retries, task) {
    if (!isProcessing) return;
    chrome.tabs.sendMessage(tabId, { action: 'execute_send', task: task, attachment: currentAttachment, audio: currentAudio }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== 'received') {
            if (retries > 0) {
                // Tenta novamente super rápido
                setTimeout(() => sendExecuteMessage(tabId, retries - 1, task), 1000);
            } else {
                // Timeout absoluto
                queue.shift();
                errorCount++;
                updateState();
                setTimeout(processNext, 2000);
            }
        }
    });
}
