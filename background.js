// --- SISTEMA DE LICENÇA (TRIAL) ---
chrome.runtime.onInstalled.addListener(() => {
    initLicense();
    ensureFollowupAlarm();
    senderHydrationPromise.then(() => runFollowupScheduler('installed'));
});

chrome.runtime.onStartup.addListener(() => {
    ensureFollowupAlarm();
    senderHydrationPromise.then(() => runFollowupScheduler('startup'));
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
                chrome.storage.local.get(['gl_trial_start_backup'], local => {
                    const trialStart = Number(res.gl_trial_start) || Number(local.gl_trial_start_backup) || Date.now();
                    if (!res.gl_trial_start || !res.gl_user_id) {
                        chrome.storage.sync.set({
                            gl_trial_start: trialStart,
                            gl_user_id: res.gl_user_id || userId,
                            gl_user_email: userEmail
                        });
                    }
                    if (Number(local.gl_trial_start_backup) !== trialStart) {
                        chrome.storage.local.set({ gl_trial_start_backup: trialStart });
                    }
                });
            });
        });
    } else {
        // Fallback se identity não estiver disponível
        chrome.storage.sync.get(['gl_trial_start'], (res) => {
            chrome.storage.local.get(['gl_trial_start_backup'], local => {
                const trialStart = Number(res.gl_trial_start) || Number(local.gl_trial_start_backup) || Date.now();
                if (!res.gl_trial_start) chrome.storage.sync.set({ gl_trial_start: trialStart });
                if (Number(local.gl_trial_start_backup) !== trialStart) chrome.storage.local.set({ gl_trial_start_backup: trialStart });
            });
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
const SENDER_ALARM_NAME = 'geolead_sender_next';
const SENDER_WATCHDOG_ALARM_NAME = 'geolead_sender_watchdog';
const SENDER_TASK_LEASE_MS = 90 * 1000;
const SENDER_ACTIONS = new Set(['start', 'stop', 'task_completed', 'task_error', 'get_state']);
const FOLLOWUP_ALARM_NAME = 'geolead_followup_scheduler';
const FOLLOWUP_STORAGE_KEY = 'glFollowupCampaigns';
const FOLLOWUP_LEASE_MS = 3 * 60 * 1000;
const FOLLOWUP_RETRY_MS = 10 * 60 * 1000;
const FOLLOWUP_LOGIN_RETRY_MS = 30 * 60 * 1000;
const FOLLOWUP_ACTIONS = new Set([
    'get_followup_campaigns', 'configure_followup_campaign', 'toggle_followup_campaign',
    'delete_followup_campaign', 'retry_followup_contact', 'followup_task_result'
]);
let senderTimeoutId = null;
let isTaskInFlight = false;
let activeTaskId = '';
let nextRunAt = 0;
let lastWaitMs = 0;
let lastWaitReason = '';
let senderBatches = [];
let senderRunId = '';
let senderTaskLeaseUntil = 0;
let followupSchedulerRunning = false;
const WEBSITE_ENRICH_CACHE = new Map();
const WEBSITE_ENRICH_TTL_MS = 15 * 60 * 1000;
const WEBSITE_HTML_LIMIT = 1500000;
const PUBLIC_SOCIAL_DOMAINS = [
    'instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'threads.net', 'pinterest.com'
];

const senderHydrationPromise = new Promise((resolve) => {
    chrome.storage.local.get([
        'isProcessing', 'whatsappQueue', 'totalQueueSize', 'successCount', 'errorCount',
        'senderDelayConfig', 'senderPauseConfig', 'messagesSincePause', 'senderAttachment',
        'senderAudio', 'senderNextRunAt', 'senderLastWaitMs', 'senderLastWaitReason',
        'senderTaskInFlight', 'senderActiveTaskId', 'senderBatches', 'senderRunId',
        'senderTaskLeaseUntil'
    ], (stored) => {
        isProcessing = Boolean(stored.isProcessing);
        queue = Array.isArray(stored.whatsappQueue) ? stored.whatsappQueue : [];
        totalQueueSize = Number(stored.totalQueueSize) || queue.length;
        successCount = Number(stored.successCount) || 0;
        errorCount = Number(stored.errorCount) || 0;
        currentDelay = normalizeDelayConfig(stored.senderDelayConfig);
        currentPauseConfig = normalizePauseConfig(stored.senderPauseConfig);
        messagesSincePause = Math.max(0, Number(stored.messagesSincePause) || 0);
        currentAttachment = stored.senderAttachment || null;
        currentAudio = stored.senderAudio || null;
        nextRunAt = Math.max(0, Number(stored.senderNextRunAt) || 0);
        lastWaitMs = Math.max(0, Number(stored.senderLastWaitMs) || 0);
        lastWaitReason = String(stored.senderLastWaitReason || '');
        activeTaskId = String(stored.senderActiveTaskId || '');
        senderBatches = normalizeSenderBatches(stored.senderBatches);
        senderRunId = String(stored.senderRunId || '');
        senderTaskLeaseUntil = Math.max(0, Number(stored.senderTaskLeaseUntil) || 0);
        const interruptedTask = Boolean(stored.senderTaskInFlight);

        // Um service worker pode ser suspenso no meio de um envio. Ao voltar,
        // aguardamos alguns segundos e repetimos somente a tarefa que continuou
        // no início da fila, identificada por um ID estável.
        isTaskInFlight = false;
        senderTaskLeaseUntil = 0;
        chrome.alarms.clear(SENDER_WATCHDOG_ALARM_NAME).catch(() => {});
        resolve();

        if (isProcessing) {
            const remaining = interruptedTask ? 5000 : Math.max(250, nextRunAt - Date.now());
            scheduleNext(remaining, interruptedTask ? 'resume_retry' : (lastWaitReason || 'resume'));
        }
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SENDER_ALARM_NAME) {
        senderHydrationPromise.then(() => runScheduledSend(nextRunAt));
        return;
    }
    if (alarm.name === SENDER_WATCHDOG_ALARM_NAME) {
        senderHydrationPromise.then(() => recoverTimedOutSenderTask());
        return;
    }
    if (alarm.name === FOLLOWUP_ALARM_NAME) {
        senderHydrationPromise.then(() => runFollowupScheduler('alarm'));
    }
});

ensureFollowupAlarm();
senderHydrationPromise.then(() => runFollowupScheduler('worker_boot'));

// Extractor State
let isExtracting = false;
let isExtractionPaused = false;
let extLogs = [];
let extData = [];
let extTabId = null;
let extMeta = { query: '', startedAt: null, updatedAt: null, filters: {} };
let extProgress = {
    processed: 0,
    collected: 0,
    discovered: 0,
    estimatedTotal: 0,
    percent: 0,
    stage: 'idle',
    currentLead: ''
};

chrome.storage.local.get(['glExtractionState'], (stored) => {
    const saved = stored.glExtractionState;
    if (!saved) return;
    isExtracting = Boolean(saved.isExtracting);
    isExtractionPaused = Boolean(saved.isPaused);
    extLogs = Array.isArray(saved.logs) ? saved.logs : [];
    extData = Array.isArray(saved.data) ? saved.data : [];
    extProgress = saved.progress || extProgress;
    extMeta = saved.meta || extMeta;
    extTabId = saved.tabId || null;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (SENDER_ACTIONS.has(request.action)) {
        senderHydrationPromise
            .then(() => handleSenderMessage(request, sendResponse))
            .catch(() => sendResponse({ status: 'error' }));
        return true;
    }

    if (FOLLOWUP_ACTIONS.has(request.action)) {
        senderHydrationPromise
            .then(() => handleFollowupMessage(request))
            .then(result => sendResponse(result || { status: 'ok' }))
            .catch(error => sendResponse({ status: 'error', error: error && error.message ? error.message : 'followup_failed' }));
        return true;
    }

    if (request.action === 'enrich_public_contacts') {
        enrichPublicContactData(request.website)
            .then(data => sendResponse({ status: 'ok', data }))
            .catch(error => sendResponse({ status: 'error', error: error && error.message ? error.message : 'enrichment_failed' }));
        return true;
    }

    // --- LÓGICA DO EXTRATOR ---
    if (request.action === 'get_ext_state') {
        chrome.storage.local.get(['glExtractionState'], (stored) => {
            const saved = stored.glExtractionState;
            if (saved && !isExtracting) {
                isExtracting = Boolean(saved.isExtracting);
                isExtractionPaused = Boolean(saved.isPaused);
                extLogs = Array.isArray(saved.logs) ? saved.logs : [];
                extData = Array.isArray(saved.data) ? saved.data : [];
                extProgress = saved.progress || extProgress;
                extMeta = saved.meta || extMeta;
                extTabId = saved.tabId || extTabId;
            }
            sendResponse(getExtractionState());
        });
    }
    else if (request.action === 'start_extract') {
        isExtracting = true;
        isExtractionPaused = false;
        extLogs = [];
        extData = [];
        extTabId = request.tabId || null;
        extMeta = {
            query: request.query || '',
            startedAt: Date.now(),
            updatedAt: Date.now(),
            filters: request.filters || {},
            target: Number(request.maxResults) || null
        };
        extProgress = {
            processed: 0,
            collected: 0,
            discovered: 0,
            target: Number(request.maxResults) || null,
            percent: Number(request.maxResults) > 0 ? 0 : null,
            indeterminate: !(Number(request.maxResults) > 0),
            stage: 'starting',
            currentLead: 'Preparando a extração'
        };
        persistExtractionState();
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
    else if (request.type === 'EXTRACTION_PROGRESS') {
        // Um progresso vindo da aba do Maps também reidrata o service worker
        // caso o Chrome o tenha suspendido durante uma extração longa.
        if (!isExtracting) isExtracting = true;
        {
            const payload = request.payload || {};
            const row = payload.row;
            extProgress = { ...extProgress, ...payload };
            delete extProgress.row;
            extMeta.updatedAt = Date.now();

            if (row) {
                const rowKey = row.mapsUrl || `${row.nome || ''}|${row.telefone || ''}`;
                const existingIndex = extData.findIndex(item => (item.mapsUrl || `${item.nome || ''}|${item.telefone || ''}`) === rowKey);
                if (existingIndex >= 0) extData[existingIndex] = row;
                else extData.push(row);
            }

            persistExtractionState();
            chrome.runtime.sendMessage({
                type: 'FWD_EXTRACTION_PROGRESS',
                payload: extProgress,
                row,
                data: extData,
                meta: extMeta,
                isPaused: isExtractionPaused
            }).catch(() => {});
        }
    }
    else if (request.type === 'EXTRACTION_FINISHED') {
        isExtracting = false;
        isExtractionPaused = false;
        if (request.payload.success) {
            extData = request.payload.data;
        }
        const wasStopped = request.payload.finishReason === 'user_stopped';
        const finishTarget = Number(extProgress.target) || 0;
        const finishPercent = finishTarget ? Math.min(100, Math.round((extData.length / finishTarget) * 100)) : 100;
        extProgress = {
            ...extProgress,
            processed: Math.max(extProgress.processed || 0, extData.length),
            collected: extData.length,
            percent: finishPercent,
            indeterminate: false,
            stage: request.payload.success ? (wasStopped ? 'stopped' : 'completed') : 'error',
            currentLead: request.payload.success ? (wasStopped ? 'Extração encerrada' : 'Varredura concluída') : 'A extração terminou com erro',
            finishReason: request.payload.finishReason || extProgress.finishReason
        };
        extMeta.updatedAt = Date.now();
        persistExtractionState();
        chrome.runtime.sendMessage({ type: 'FWD_EXTRACTION_FINISHED', payload: request.payload }).catch(() => {});
    }
    else if (request.action === 'pause_extract') {
        if (!isExtracting || !extTabId) {
            sendResponse({ status: 'unavailable' });
        } else {
            isExtractionPaused = true;
            extProgress.stage = 'paused';
            extMeta.updatedAt = Date.now();
            persistExtractionState();
            chrome.tabs.sendMessage(extTabId, { action: 'PAUSE_EXTRACTION' }, () => {
                if (chrome.runtime.lastError) {
                    isExtractionPaused = false;
                    extProgress.stage = 'error';
                    persistExtractionState();
                    sendResponse({ status: 'unavailable' });
                } else {
                    sendResponse({ status: 'paused' });
                }
            });
        }
    }
    else if (request.action === 'resume_extract') {
        if (!isExtracting || !extTabId) {
            sendResponse({ status: 'unavailable' });
        } else {
            isExtractionPaused = false;
            extProgress.stage = 'searching';
            extMeta.updatedAt = Date.now();
            persistExtractionState();
            chrome.tabs.sendMessage(extTabId, { action: 'RESUME_EXTRACTION' }, () => {
                if (chrome.runtime.lastError) {
                    isExtractionPaused = true;
                    extProgress.stage = 'paused';
                    persistExtractionState();
                    sendResponse({ status: 'unavailable' });
                } else {
                    sendResponse({ status: 'resumed' });
                }
            });
        }
    }
    else if (request.action === 'stop_extract_control') {
        if (!isExtracting || !extTabId) {
            sendResponse({ status: 'unavailable' });
        } else {
            chrome.tabs.sendMessage(extTabId, { action: 'STOP_EXTRACTION' }, () => {
                sendResponse({ status: chrome.runtime.lastError ? 'unavailable' : 'stopping' });
            });
        }
    }
    else if (request.action === 'reset_extract') {
        isExtracting = false;
        isExtractionPaused = false;
        extLogs = [];
        extData = [];
        extProgress = { processed: 0, collected: 0, discovered: 0, estimatedTotal: 0, percent: 0, stage: 'idle', currentLead: '' };
        extMeta = { query: '', startedAt: null, updatedAt: Date.now(), filters: {} };
        persistExtractionState();
        sendResponse({ status: 'ok' });
    }

    return true;
});

function getExtractionState() {
    return {
        isExtracting,
        isPaused: isExtractionPaused,
        extLogs,
        extData,
        extProgress,
        extMeta
    };
}

function persistExtractionState() {
    chrome.storage.local.set({
        glExtractionState: {
            isExtracting,
            isPaused: isExtractionPaused,
            logs: extLogs.slice(-50),
            data: extData.slice(-1000),
            progress: extProgress,
            meta: extMeta,
            tabId: extTabId,
            updatedAt: Date.now()
        }
    });
}

function normalizePositiveInteger(value, fallback, maximum = 86400) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, maximum);
}

function normalizeDelayConfig(config = {}) {
    const random = Boolean(config && config.random);
    const unit = Number(config && config.unit) === 60 ? 60 : 1;
    const randomUnit = Number(config && config.randomUnit) === 60 ? 60 : 1;
    const value = normalizePositiveInteger(config && config.value, 10);
    let min = normalizePositiveInteger(config && config.min, 10);
    let max = normalizePositiveInteger(config && config.max, 23);
    if (min > max) [min, max] = [max, min];
    return { random, value, unit, min, max, randomUnit };
}

function normalizePauseConfig(config = {}) {
    return {
        enabled: Boolean(config && config.enabled),
        duration: normalizePositiveInteger(config && config.duration, 5, 720),
        every: normalizePositiveInteger(config && config.every, 30, 10000)
    };
}

function normalizeSenderBatches(value) {
    return (Array.isArray(value) ? value : []).slice(0, 100).map((batch, index) => ({
        id: String(batch && batch.id || `batch_${index + 1}`),
        name: String(batch && batch.name || `Campanha ${index + 1}`).slice(0, 80),
        sourceListId: String(batch && batch.sourceListId || ''),
        total: Math.max(0, Number(batch && batch.total) || 0),
        success: Math.max(0, Number(batch && batch.success) || 0),
        error: Math.max(0, Number(batch && batch.error) || 0),
        status: ['queued', 'running', 'completed', 'stopped'].includes(batch && batch.status) ? batch.status : 'queued',
        campaignId: String(batch && batch.campaignId || ''),
        completedAt: Math.max(0, Number(batch && batch.completedAt) || 0)
    }));
}

function markCurrentSenderBatchRunning() {
    const currentBatchId = queue[0] && String(queue[0].senderBatchId || '');
    senderBatches.forEach(batch => {
        if (batch.id === currentBatchId && batch.status === 'queued') batch.status = 'running';
    });
}

function calculateConfiguredDelay() {
    if (!currentDelay.random) return currentDelay.value * currentDelay.unit * 1000;
    const min = currentDelay.min * currentDelay.randomUnit * 1000;
    const max = currentDelay.max * currentDelay.randomUnit * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clearSenderSchedule(resetTimestamp = true) {
    if (senderTimeoutId !== null) {
        clearTimeout(senderTimeoutId);
        senderTimeoutId = null;
    }
    chrome.alarms.clear(SENDER_ALARM_NAME).catch(() => {});
    if (resetTimestamp) nextRunAt = 0;
}

function armSenderWatchdog() {
    if (!isProcessing || !isTaskInFlight || !senderTaskLeaseUntil) return;
    chrome.alarms.create(SENDER_WATCHDOG_ALARM_NAME, {
        when: Math.max(Date.now() + 1000, senderTaskLeaseUntil)
    }).catch(() => {});
}

function clearSenderWatchdog() {
    senderTaskLeaseUntil = 0;
    chrome.alarms.clear(SENDER_WATCHDOG_ALARM_NAME).catch(() => {});
}

function recoverTimedOutSenderTask() {
    if (!isProcessing || !isTaskInFlight) {
        clearSenderWatchdog();
        return;
    }
    if (senderTaskLeaseUntil > Date.now() + 250) {
        armSenderWatchdog();
        return;
    }

    // Se uma navegação/F5 destruiu o content script antes do retorno, libera a
    // mesma tarefa para outra tentativa em vez de deixar a fila congelada.
    isTaskInFlight = false;
    activeTaskId = '';
    clearSenderWatchdog();
    updateState();
    scheduleNext(1000, 'task_recovery');
}

function scheduleNext(waitMs, reason = 'configured_delay') {
    if (!isProcessing) return;
    clearSenderSchedule(false);
    const safeWait = Math.max(0, Math.round(Number(waitMs) || 0));
    const target = Date.now() + safeWait;
    nextRunAt = target;
    lastWaitMs = safeWait;
    lastWaitReason = reason;
    updateState();

    // setTimeout mantém precisão para intervalos curtos. O alarm funciona como
    // recuperação caso o Chrome suspenda o service worker durante a espera.
    if (safeWait <= 60000) {
        senderTimeoutId = setTimeout(() => runScheduledSend(target), safeWait);
    }
    chrome.alarms.create(SENDER_ALARM_NAME, { when: Math.max(Date.now() + 1, target) }).catch(() => {});
}

function runScheduledSend(expectedTarget) {
    if (!isProcessing || isTaskInFlight) return;
    if (expectedTarget && nextRunAt && expectedTarget !== nextRunAt) return;
    const remaining = nextRunAt - Date.now();
    if (remaining > 150) {
        scheduleNext(remaining, lastWaitReason || 'configured_delay');
        return;
    }
    clearSenderSchedule();
    processNext();
}

function isCurrentTaskResult(request) {
    if (!queue.length) return false;
    const requestTaskId = String(request.taskId || '');
    const queuedTaskId = String(queue[0].id || '');
    if (requestTaskId && queuedTaskId && requestTaskId !== queuedTaskId) return false;
    if (activeTaskId && queuedTaskId && activeTaskId !== queuedTaskId) return false;
    return isTaskInFlight || (requestTaskId && requestTaskId === queuedTaskId);
}

function finishCurrentTask(success) {
    const completedTask = queue[0] || null;
    const completedBatch = completedTask
        ? senderBatches.find(batch => batch.id === String(completedTask.senderBatchId || ''))
        : null;
    queue.shift();
    isTaskInFlight = false;
    activeTaskId = '';
    clearSenderWatchdog();
    if (success) {
        successCount++;
        messagesSincePause++;
    } else {
        errorCount++;
    }
    if (completedBatch) {
        if (success) completedBatch.success++;
        else completedBatch.error++;
        const batchStillQueued = queue.some(task => String(task.senderBatchId || '') === completedBatch.id);
        if (!batchStillQueued) {
            completedBatch.status = 'completed';
            completedBatch.completedAt = Date.now();
        }
    }
    markCurrentSenderBatchRunning();
    if (completedTask && completedTask.campaignId && completedTask.contactId) {
        recordInitialCampaignResult(completedTask, success).catch(error => {
            console.warn('GeoLead: não foi possível registrar o resultado inicial da campanha.', error);
        });
    }

    if (!queue.length) {
        isProcessing = false;
        clearSenderSchedule();
        senderBatches.forEach(batch => {
            if (batch.status !== 'stopped') {
                batch.status = 'completed';
                batch.completedAt = batch.completedAt || Date.now();
            }
        });
        updateState();
        return;
    }

    if (success && currentPauseConfig.enabled && messagesSincePause >= currentPauseConfig.every) {
        messagesSincePause = 0;
        const waitTime = currentPauseConfig.duration * 60 * 1000;
        console.log(`GeoLead: pausa humana de ${currentPauseConfig.duration} minuto(s).`);
        scheduleNext(waitTime, 'human_pause');
        return;
    }

    const waitTime = success ? calculateConfiguredDelay() : 3000;
    console.log(`GeoLead: próximo envio em ${Math.round(waitTime / 1000)} segundo(s).`);
    scheduleNext(waitTime, success ? 'configured_delay' : 'error_delay');
}

async function handleSenderMessage(request, sendResponse) {
    if (request.action === 'start') {
        clearSenderSchedule();
        clearSenderWatchdog();
        senderRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        senderBatches = [];
        queue = [];

        const requestedGroups = Array.isArray(request.groups) && request.groups.length
            ? request.groups
            : [{
                id: 'manual',
                name: request.campaignMeta && request.campaignMeta.name,
                sourceListId: request.campaignMeta && request.campaignMeta.sourceListId,
                sourceName: request.campaignMeta && request.campaignMeta.sourceName,
                contacts: request.campaignMeta && request.campaignMeta.contacts,
                tasks: Array.isArray(request.queue) ? request.queue : []
            }];
        const seenPhones = new Set();
        const createdCampaignIds = [];

        for (let groupIndex = 0; groupIndex < requestedGroups.length; groupIndex++) {
            const group = requestedGroups[groupIndex] || {};
            const rawTasks = Array.isArray(group.tasks) ? group.tasks : [];
            const preparedGroup = rawTasks.map((task, taskIndex) => ({
                ...task,
                id: task && task.id ? String(task.id) : `gl_${senderRunId}_${groupIndex}_${taskIndex}_${Math.random().toString(36).slice(2, 7)}`
            })).filter(task => {
                const phone = String(task && task.phone || '').replace(/\D/g, '');
                if (!phone || seenPhones.has(phone)) return false;
                seenPhones.add(phone);
                task.phone = phone;
                return true;
            });
            if (!preparedGroup.length) continue;

            const batchId = String(group.id || `batch_${groupIndex + 1}_${Date.now()}`);
            const batchName = String(group.name || group.sourceName || `Campanha ${senderBatches.length + 1}`).slice(0, 80);
            const campaignMeta = {
                name: batchName,
                sourceListId: String(group.sourceListId || ''),
                sourceName: String(group.sourceName || batchName),
                contacts: Array.isArray(group.contacts) ? group.contacts : []
            };
            const campaign = await createCampaignForQueue(preparedGroup, campaignMeta);
            if (campaign) createdCampaignIds.push(campaign.id);
            const batchIndex = senderBatches.length;
            senderBatches.push({
                id: batchId,
                name: batchName,
                sourceListId: campaignMeta.sourceListId,
                total: preparedGroup.length,
                success: 0,
                error: 0,
                status: batchIndex === 0 ? 'running' : 'queued',
                campaignId: campaign ? campaign.id : '',
                completedAt: 0
            });
            preparedGroup.forEach((task, taskIndex) => {
                queue.push({
                    ...task,
                    senderBatchId: batchId,
                    senderBatchName: batchName,
                    senderBatchIndex: batchIndex,
                    senderBatchTaskIndex: taskIndex,
                    campaignId: campaign ? campaign.id : '',
                    contactId: campaign && campaign.contacts[taskIndex] ? campaign.contacts[taskIndex].id : ''
                });
            });
        }
        if (createdCampaignIds.length > 1) {
            const campaigns = await loadFollowupCampaigns();
            const campaignById = new Map(campaigns.map(campaign => [campaign.id, campaign]));
            const orderedCreated = createdCampaignIds.map(id => campaignById.get(id)).filter(Boolean);
            const untouched = campaigns.filter(campaign => !createdCampaignIds.includes(campaign.id));
            await saveFollowupCampaigns([...orderedCreated, ...untouched]);
        }
        currentDelay = normalizeDelayConfig(request.delay);
        currentPauseConfig = normalizePauseConfig(request.pauseConfig);
        currentAttachment = request.attachment || null;
        currentAudio = request.audio || null;
        totalQueueSize = queue.length;
        successCount = 0;
        errorCount = 0;
        messagesSincePause = 0;
        isTaskInFlight = false;
        activeTaskId = '';
        lastWaitMs = 0;
        lastWaitReason = '';
        isProcessing = queue.length > 0;
        updateState();
        if (isProcessing) processNext();
        sendResponse({
            status: isProcessing ? 'started' : 'empty',
            campaignId: createdCampaignIds[0] || '',
            campaignIds: createdCampaignIds,
            runId: senderRunId,
            batches: senderBatches
        });
        return;
    }

    if (request.action === 'stop') {
        const cancelledTasks = queue.slice();
        isProcessing = false;
        queue = [];
        isTaskInFlight = false;
        activeTaskId = '';
        clearSenderWatchdog();
        senderBatches.forEach(batch => {
            if (batch.status !== 'completed') batch.status = 'stopped';
        });
        clearSenderSchedule();
        updateState();
        markInitialTasksStopped(cancelledTasks).catch(() => {});
        sendResponse({ status: 'stopped' });
        return;
    }

    if (request.action === 'task_completed' || request.action === 'task_error') {
        if (isProcessing && isCurrentTaskResult(request)) {
            finishCurrentTask(request.action === 'task_completed');
            sendResponse({ status: 'accepted' });
        } else {
            sendResponse({ status: 'ignored' });
        }
        return;
    }

    if (request.action === 'get_state') {
        sendResponse({
            isProcessing,
            queueSize: queue.length,
            totalQueueSize,
            successCount,
            errorCount,
            delay: currentDelay,
            pauseConfig: currentPauseConfig,
            messagesSincePause,
            nextRunAt,
            lastWaitMs,
            lastWaitReason,
            isTaskInFlight,
            taskLeaseUntil: senderTaskLeaseUntil,
            runId: senderRunId,
            batches: senderBatches,
            processedCount: successCount + errorCount,
            progressPercent: totalQueueSize > 0 ? Math.min(100, Math.round(((successCount + errorCount) / totalQueueSize) * 100)) : 0,
            currentBatchId: queue[0] ? String(queue[0].senderBatchId || '') : '',
            currentBatchName: queue[0] ? String(queue[0].senderBatchName || '') : ''
        });
    }
}

function updateState() {
    chrome.storage.local.set({
        isProcessing,
        whatsappQueue: queue,
        totalQueueSize,
        successCount,
        errorCount,
        senderDelayConfig: currentDelay,
        senderPauseConfig: currentPauseConfig,
        messagesSincePause,
        senderAttachment: currentAttachment,
        senderAudio: currentAudio,
        senderNextRunAt: nextRunAt,
        senderLastWaitMs: lastWaitMs,
        senderLastWaitReason: lastWaitReason,
        senderTaskInFlight: isTaskInFlight,
        senderActiveTaskId: activeTaskId,
        senderTaskLeaseUntil,
        senderRunId,
        senderBatches
    });
}

function processNext() {
    if (!isProcessing || isTaskInFlight) return;
    if (queue.length === 0) {
        isProcessing = false;
        clearSenderSchedule();
        updateState();
        return;
    }

    const task = queue[0];
    clearSenderSchedule();
    isTaskInFlight = true;
    activeTaskId = String(task.id || '');
    senderTaskLeaseUntil = Date.now() + SENDER_TASK_LEASE_MS;
    armSenderWatchdog();
    updateState();

    chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
        if (!isProcessing || activeTaskId !== String(task.id || '')) return;
        if (tabs.length === 0) {
            chrome.tabs.create({ url: "https://web.whatsapp.com", active: true }, (tab) => {
                prepareWhatsAppTab(tab, true).then(readyTab => {
                    if (readyTab && readyTab.id) sendExecuteMessage(readyTab.id, 90, task);
                    else finishCurrentTask(false);
                });
            });
            return;
        }

        // Se o WhatsApp já estava aberto antes da extensão ser atualizada, o
        // content script pode não existir nessa aba. Nesse caso fazemos o F5
        // automaticamente e os retries abaixo aguardam o carregamento terminar.
        prepareWhatsAppTab(tabs[0], false).then(readyTab => {
            if (readyTab && readyTab.id) sendExecuteMessage(readyTab.id, 90, task);
            else finishCurrentTask(false);
        });
    });
}

function waitBackground(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function probeWhatsAppTab(tabId) {
    return new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, response => {
            if (chrome.runtime.lastError || !response || response.status !== 'alive') {
                resolve({ alive: false, documentReady: false, appReady: false, loginRequired: false });
                return;
            }
            resolve({
                alive: true,
                documentReady: Boolean(response.documentReady),
                appReady: Boolean(response.appReady),
                loginRequired: Boolean(response.loginRequired)
            });
        });
    });
}

function reloadWhatsAppTab(tabId) {
    return new Promise(resolve => {
        chrome.tabs.update(tabId, { url: "https://web.whatsapp.com/", active: true }, () => resolve(!chrome.runtime.lastError));
    });
}

async function prepareWhatsAppTab(tab, wasCreated = false) {
    if (!tab || !tab.id) return null;
    let reloadAttempted = Boolean(wasCreated);
    let stableDocumentChecks = 0;

    // O content script nasce antes de o aplicativo do WhatsApp terminar de
    // montar. Só entregar a tarefa depois deste handshake evita que a navegação
    // pós-F5 destrua o script no meio do primeiro contato.
    for (let attempt = 0; attempt < 90; attempt++) {
        const readiness = await probeWhatsAppTab(tab.id);
        if (readiness.alive) {
            if (readiness.appReady || readiness.loginRequired) return tab;
            stableDocumentChecks = readiness.documentReady ? stableDocumentChecks + 1 : 0;
            if (stableDocumentChecks >= 6) return tab;
        } else {
            stableDocumentChecks = 0;
            if (!reloadAttempted) {
                reloadAttempted = true;
                const reloaded = await reloadWhatsAppTab(tab.id);
                if (!reloaded) return null;
            }
        }
        await waitBackground(1000);
    }
    return null;
}

function sendExecuteMessage(tabId, retries, task) {
    if (!isProcessing || !isTaskInFlight || activeTaskId !== String(task.id || '')) return;
    chrome.tabs.sendMessage(tabId, { action: 'execute_send', task: task, attachment: currentAttachment, audio: currentAudio }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== 'received') {
            if (retries > 0) {
                const retryDelay = response && response.status === 'busy' ? 2000 : 1000;
                setTimeout(() => sendExecuteMessage(tabId, retries - 1, task), retryDelay);
            } else {
                // Timeout absoluto
                finishCurrentTask(false);
            }
        }
    });
}

// --- CAMPANHAS E FOLLOW-UPS PERSISTENTES ---
function storageLocalGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageLocalSet(values) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(values, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
        });
    });
}

function ensureFollowupAlarm() {
    try {
        chrome.alarms.create(FOLLOWUP_ALARM_NAME, { periodInMinutes: 1 });
    } catch (error) {
        console.warn('GeoLead: não foi possível criar o alarme de follow-up.', error);
    }
}

async function loadFollowupCampaigns() {
    const stored = await storageLocalGet([FOLLOWUP_STORAGE_KEY]);
    return Array.isArray(stored[FOLLOWUP_STORAGE_KEY]) ? stored[FOLLOWUP_STORAGE_KEY] : [];
}

async function saveFollowupCampaigns(campaigns) {
    await storageLocalSet({ [FOLLOWUP_STORAGE_KEY]: campaigns.slice(0, 100) });
    updateFollowupBadge(campaigns);
    chrome.runtime.sendMessage({ type: 'FOLLOWUP_CAMPAIGNS_UPDATED' }).catch(() => {});
}

function normalizeCampaignPhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function makeCampaignId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultCampaignName(meta = {}) {
    if (String(meta.name || '').trim()) return String(meta.name).trim().slice(0, 70);
    const date = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date());
    return `Disparo · ${date}`;
}

async function createCampaignForQueue(tasks, meta = {}) {
    if (!Array.isArray(tasks) || tasks.length === 0) return null;
    const now = Date.now();
    const campaignId = makeCampaignId('campaign');
    const metadataByPhone = new Map();
    (Array.isArray(meta.contacts) ? meta.contacts : []).forEach(contact => {
        const phone = normalizeCampaignPhone(contact && contact.phone);
        if (phone) metadataByPhone.set(phone, contact);
    });

    const contacts = tasks.map((task, index) => {
        const phone = normalizeCampaignPhone(task && task.phone);
        const metadata = metadataByPhone.get(phone) || {};
        return {
            id: makeCampaignId(`contact_${index}`),
            phone,
            name: String(metadata.name || phone || 'Lead').slice(0, 100),
            status: 'queued_initial',
            initialSentAt: 0,
            lastSentAt: 0,
            lastMessage: '',
            followupIndex: 0,
            nextFollowupAt: 0,
            technicalRetries: 0,
            error: ''
        };
    });

    const campaign = {
        id: campaignId,
        name: defaultCampaignName(meta),
        sourceListId: String(meta.sourceListId || ''),
        sourceName: String(meta.sourceName || ''),
        status: 'awaiting_plan',
        createdAt: now,
        updatedAt: now,
        steps: [],
        schedule: normalizeFollowupSchedule(meta.schedule || {}),
        contacts
    };
    const campaigns = await loadFollowupCampaigns();
    campaigns.unshift(campaign);
    await saveFollowupCampaigns(campaigns);
    return campaign;
}

async function recordInitialCampaignResult(task, success) {
    const campaigns = await loadFollowupCampaigns();
    const campaign = campaigns.find(item => item.id === task.campaignId);
    if (!campaign) return;
    const contact = (campaign.contacts || []).find(item => item.id === task.contactId);
    if (!contact || contact.status !== 'queued_initial') return;
    const now = Date.now();
    if (success) {
        contact.initialSentAt = now;
        contact.lastSentAt = now;
        contact.lastMessage = String(task.message || '');
        contact.error = '';
        if (campaign.status === 'active' && campaign.steps && campaign.steps.length > 0) {
            contact.status = 'waiting';
            contact.nextFollowupAt = alignFollowupTime(now + campaign.steps[0].delayMinutes * 60000, campaign.schedule);
        } else {
            contact.status = 'awaiting_plan';
        }
    } else {
        contact.status = 'initial_failed';
        contact.error = 'initial_send_failed';
    }
    campaign.updatedAt = now;
    updateCampaignCompletion(campaign);
    await saveFollowupCampaigns(campaigns);
}

async function markInitialTasksStopped(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return;
    const campaigns = await loadFollowupCampaigns();
    let changed = false;
    tasks.forEach(task => {
        const campaign = campaigns.find(item => item.id === task.campaignId);
        const contact = campaign && (campaign.contacts || []).find(item => item.id === task.contactId);
        if (!contact || contact.status !== 'queued_initial') return;
        contact.status = 'initial_cancelled';
        contact.error = 'initial_send_cancelled';
        campaign.updatedAt = Date.now();
        changed = true;
    });
    if (changed) await saveFollowupCampaigns(campaigns);
}

function normalizeFollowupSchedule(schedule = {}) {
    const validClock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
    let startTime = validClock(schedule.startTime) ? schedule.startTime : '09:00';
    let endTime = validClock(schedule.endTime) ? schedule.endTime : '18:00';
    if (startTime >= endTime) {
        startTime = '09:00';
        endTime = '18:00';
    }
    return {
        businessHoursEnabled: schedule.businessHoursEnabled !== false,
        startTime,
        endTime,
        includeWeekends: Boolean(schedule.includeWeekends)
    };
}

function normalizeFollowupSteps(steps) {
    return (Array.isArray(steps) ? steps : []).slice(0, 3).map((step, index) => ({
        id: String(step.id || `step_${index + 1}`),
        delayMinutes: Math.min(525600, Math.max(1, Math.round(Number(step.delayMinutes) || 0))),
        templateId: String(step.templateId || ''),
        templateName: String(step.templateName || `Follow-up ${index + 1}`).slice(0, 80),
        message: String(step.message || '').trim()
    })).filter(step => step.message);
}

function clockMinutes(value, fallback) {
    const parts = String(value || '').split(':').map(Number);
    if (parts.length !== 2 || parts.some(part => !Number.isFinite(part))) return fallback;
    return parts[0] * 60 + parts[1];
}

function alignFollowupTime(timestamp, schedule = {}) {
    const normalized = normalizeFollowupSchedule(schedule);
    if (!normalized.businessHoursEnabled) return Math.max(Date.now(), Number(timestamp) || Date.now());
    const startMinutes = clockMinutes(normalized.startTime, 9 * 60);
    const endMinutes = clockMinutes(normalized.endTime, 18 * 60);
    const date = new Date(Math.max(Date.now(), Number(timestamp) || Date.now()));

    for (let attempt = 0; attempt < 10; attempt++) {
        const weekend = date.getDay() === 0 || date.getDay() === 6;
        if (weekend && !normalized.includeWeekends) {
            date.setDate(date.getDate() + 1);
            date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
            continue;
        }
        const currentMinutes = date.getHours() * 60 + date.getMinutes();
        if (currentMinutes < startMinutes) {
            date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
            return date.getTime();
        }
        if (currentMinutes >= endMinutes) {
            date.setDate(date.getDate() + 1);
            date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
            continue;
        }
        return date.getTime();
    }
    return date.getTime();
}

function resolveFollowupSpintax(input) {
    let output = String(input || '');
    const groupPattern = /\{([^{}]*\|[^{}]*)\}/g;
    let passes = 0;
    while (passes < 20 && groupPattern.test(output)) {
        groupPattern.lastIndex = 0;
        output = output.replace(groupPattern, (_match, content) => {
            const options = content.split('|');
            return options[Math.floor(Math.random() * options.length)] || '';
        });
        passes++;
        groupPattern.lastIndex = 0;
    }
    return output;
}

function updateCampaignCompletion(campaign) {
    if (!campaign || campaign.status !== 'active') return;
    const pendingStatuses = new Set(['queued_initial', 'awaiting_plan', 'waiting', 'checking']);
    if (!(campaign.contacts || []).some(contact => pendingStatuses.has(contact.status))) {
        campaign.status = 'completed';
        campaign.completedAt = Date.now();
    }
}

function updateFollowupBadge(campaigns) {
    if (!chrome.action || !chrome.action.setBadgeText) return;
    const needsAttention = (campaigns || []).some(campaign =>
        campaign.lastIssue === 'login_required' || (campaign.contacts || []).some(contact => contact.status === 'needs_review')
    );
    chrome.action.setBadgeBackgroundColor({ color: needsAttention ? '#ef4444' : '#17c873' }).catch(() => {});
    chrome.action.setBadgeText({ text: needsAttention ? '!' : '' }).catch(() => {});
}

async function handleFollowupMessage(request) {
    if (request.action === 'get_followup_campaigns') {
        const campaigns = await loadFollowupCampaigns();
        updateFollowupBadge(campaigns);
        return { status: 'ok', campaigns };
    }

    if (request.action === 'configure_followup_campaign') {
        const campaigns = await loadFollowupCampaigns();
        const campaign = campaigns.find(item => item.id === String(request.campaignId || ''));
        if (!campaign) return { status: 'not_found' };
        const steps = normalizeFollowupSteps(request.steps);
        if (steps.length === 0) return { status: 'invalid_steps' };
        const now = Date.now();
        campaign.steps = steps;
        campaign.schedule = normalizeFollowupSchedule(request.schedule || {});
        campaign.status = 'active';
        campaign.lastIssue = '';
        campaign.completedAt = 0;
        (campaign.contacts || []).forEach(contact => {
            if (!contact.initialSentAt || ['initial_failed', 'initial_cancelled', 'replied'].includes(contact.status)) return;
            if (contact.followupIndex >= steps.length) {
                contact.status = 'completed';
                contact.nextFollowupAt = 0;
                return;
            }
            contact.status = 'waiting';
            const baseTime = contact.lastSentAt || contact.initialSentAt || now;
            contact.nextFollowupAt = alignFollowupTime(baseTime + steps[contact.followupIndex].delayMinutes * 60000, campaign.schedule);
            contact.error = '';
            contact.processingUntil = 0;
            contact.dispatchToken = '';
        });
        campaign.updatedAt = now;
        updateCampaignCompletion(campaign);
        await saveFollowupCampaigns(campaigns);
        ensureFollowupAlarm();
        setTimeout(() => runFollowupScheduler('configured'), 50);
        return { status: 'configured', campaign };
    }

    if (request.action === 'toggle_followup_campaign') {
        const campaigns = await loadFollowupCampaigns();
        const campaign = campaigns.find(item => item.id === String(request.campaignId || ''));
        if (!campaign) return { status: 'not_found' };
        const resume = campaign.status === 'paused';
        campaign.status = resume ? 'active' : 'paused';
        campaign.updatedAt = Date.now();
        if (resume) {
            (campaign.contacts || []).forEach(contact => {
                if (contact.status === 'checking') {
                    contact.status = 'waiting';
                    contact.processingUntil = 0;
                    contact.dispatchToken = '';
                }
                if (contact.status === 'waiting') {
                    contact.nextFollowupAt = alignFollowupTime(Math.max(Date.now(), contact.nextFollowupAt || 0), campaign.schedule);
                }
            });
        }
        await saveFollowupCampaigns(campaigns);
        if (resume) setTimeout(() => runFollowupScheduler('resumed'), 50);
        return { status: campaign.status, campaign };
    }

    if (request.action === 'delete_followup_campaign') {
        const campaigns = await loadFollowupCampaigns();
        const filtered = campaigns.filter(item => item.id !== String(request.campaignId || ''));
        if (filtered.length === campaigns.length) return { status: 'not_found' };
        await saveFollowupCampaigns(filtered);
        return { status: 'deleted' };
    }

    if (request.action === 'retry_followup_contact') {
        const campaigns = await loadFollowupCampaigns();
        const campaign = campaigns.find(item => item.id === String(request.campaignId || ''));
        const contact = campaign && (campaign.contacts || []).find(item => item.id === String(request.contactId || ''));
        if (!campaign || !contact || !campaign.steps || contact.followupIndex >= campaign.steps.length) return { status: 'not_found' };
        contact.status = 'waiting';
        contact.error = '';
        contact.technicalRetries = 0;
        contact.nextFollowupAt = alignFollowupTime(Date.now(), campaign.schedule);
        contact.processingUntil = 0;
        contact.dispatchToken = '';
        campaign.status = 'active';
        campaign.updatedAt = Date.now();
        await saveFollowupCampaigns(campaigns);
        setTimeout(() => runFollowupScheduler('manual_retry'), 50);
        return { status: 'queued' };
    }

    if (request.action === 'followup_task_result') {
        return applyFollowupTaskResult(request);
    }

    return { status: 'unsupported' };
}

async function applyFollowupTaskResult(request) {
    const campaigns = await loadFollowupCampaigns();
    const campaign = campaigns.find(item => item.id === String(request.campaignId || ''));
    const contact = campaign && (campaign.contacts || []).find(item => item.id === String(request.contactId || ''));
    if (!campaign || !contact) return { status: 'not_found' };
    if (contact.status !== 'checking' || String(contact.dispatchToken || '') !== String(request.dispatchToken || '')) {
        return { status: 'ignored' };
    }

    const now = Date.now();
    const result = String(request.result || 'error');
    contact.processingUntil = 0;
    contact.dispatchToken = '';
    if (result === 'replied') {
        contact.status = 'replied';
        contact.repliedAt = now;
        contact.nextFollowupAt = 0;
        contact.error = '';
    } else if (result === 'sent') {
        contact.followupIndex = Math.min((campaign.steps || []).length, Number(contact.followupIndex || 0) + 1);
        contact.lastSentAt = now;
        contact.lastMessage = String(request.message || contact.pendingMessage || '');
        contact.pendingMessage = '';
        contact.technicalRetries = 0;
        contact.error = '';
        campaign.lastIssue = '';
        if (contact.followupIndex >= (campaign.steps || []).length) {
            contact.status = 'completed';
            contact.nextFollowupAt = 0;
        } else {
            contact.status = 'waiting';
            const step = campaign.steps[contact.followupIndex];
            contact.nextFollowupAt = alignFollowupTime(now + step.delayMinutes * 60000, campaign.schedule);
        }
    } else if (result === 'login_required') {
        contact.status = 'waiting';
        contact.nextFollowupAt = alignFollowupTime(now + FOLLOWUP_LOGIN_RETRY_MS, campaign.schedule);
        contact.error = 'login_required';
        campaign.lastIssue = 'login_required';
    } else if (result === 'needs_review') {
        contact.status = 'needs_review';
        contact.nextFollowupAt = 0;
        contact.error = String(request.error || 'reply_state_uncertain');
    } else {
        contact.technicalRetries = Number(contact.technicalRetries || 0) + 1;
        contact.error = String(request.error || 'followup_send_failed');
        if (contact.technicalRetries >= 3) {
            contact.status = 'needs_review';
            contact.nextFollowupAt = 0;
        } else {
            contact.status = 'waiting';
            contact.nextFollowupAt = alignFollowupTime(now + FOLLOWUP_RETRY_MS, campaign.schedule);
        }
    }
    campaign.updatedAt = now;
    updateCampaignCompletion(campaign);
    await saveFollowupCampaigns(campaigns);
    if (campaign.status === 'active') setTimeout(() => runFollowupScheduler('task_result'), 100);
    return { status: 'accepted' };
}

async function runFollowupScheduler(reason = 'manual') {
    if (followupSchedulerRunning) return;
    followupSchedulerRunning = true;
    try {
        ensureFollowupAlarm();
        const campaigns = await loadFollowupCampaigns();
        const now = Date.now();
        let changed = false;

        campaigns.forEach(campaign => {
            if (campaign.status !== 'active') return;
            (campaign.contacts || []).forEach(contact => {
                if (contact.status === 'checking' && (reason === 'startup' || Number(contact.processingUntil || 0) <= now)) {
                    contact.status = 'waiting';
                    contact.processingUntil = 0;
                    contact.dispatchToken = '';
                    contact.nextFollowupAt = alignFollowupTime(now, campaign.schedule);
                    contact.error = 'stale_dispatch_recovered';
                    changed = true;
                }
            });
        });

        if (isProcessing || isTaskInFlight) {
            if (changed) await saveFollowupCampaigns(campaigns);
            return;
        }

        let selected = null;
        for (const campaign of campaigns) {
            if (campaign.status !== 'active' || !Array.isArray(campaign.steps) || campaign.steps.length === 0) continue;
            for (const contact of campaign.contacts || []) {
                if (contact.status !== 'waiting' || contact.followupIndex >= campaign.steps.length) continue;
                const alignedTime = alignFollowupTime(contact.nextFollowupAt || now, campaign.schedule);
                if (alignedTime !== contact.nextFollowupAt) {
                    contact.nextFollowupAt = alignedTime;
                    changed = true;
                }
                if (alignedTime <= now + 1000) {
                    selected = { campaign, contact, step: campaign.steps[contact.followupIndex] };
                    break;
                }
            }
            if (selected) break;
        }

        if (!selected) {
            if (changed) await saveFollowupCampaigns(campaigns);
            return;
        }

        const token = makeCampaignId('dispatch');
        selected.contact.status = 'checking';
        selected.contact.dispatchToken = token;
        selected.contact.processingUntil = now + FOLLOWUP_LEASE_MS;
        selected.contact.pendingMessage = selected.contact.pendingMessage || resolveFollowupSpintax(selected.step.message);
        selected.contact.error = '';
        selected.campaign.updatedAt = now;
        await saveFollowupCampaigns(campaigns);

        const tab = await ensureWhatsAppBackgroundTab();
        if (!tab || !tab.id) {
            await applyFollowupTaskResult({
                campaignId: selected.campaign.id,
                contactId: selected.contact.id,
                dispatchToken: token,
                result: 'error',
                error: 'whatsapp_tab_unavailable'
            });
            return;
        }

        sendFollowupExecution(tab.id, {
            campaignId: selected.campaign.id,
            contactId: selected.contact.id,
            dispatchToken: token,
            phone: selected.contact.phone,
            name: selected.contact.name,
            message: selected.contact.pendingMessage,
            lastMessage: selected.contact.lastMessage,
            lastSentAt: selected.contact.lastSentAt,
            reason
        }, 60);
    } catch (error) {
        console.warn('GeoLead: falha no agendador de follow-up.', error);
    } finally {
        followupSchedulerRunning = false;
    }
}

function ensureWhatsAppBackgroundTab() {
    return new Promise(resolve => {
        chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, tabs => {
            if (tabs && tabs.length > 0) {
                prepareWhatsAppTab(tabs[0], false).then(resolve);
                return;
            }
            chrome.tabs.create({ url: 'https://web.whatsapp.com', active: false }, tab => {
                prepareWhatsAppTab(tab || null, true).then(resolve);
            });
        });
    });
}

function sendFollowupExecution(tabId, task, retries) {
    chrome.tabs.sendMessage(tabId, { action: 'execute_followup', task }, response => {
        const unavailable = chrome.runtime.lastError || !response || response.status !== 'received';
        if (!unavailable) return;
        if (retries > 0) {
            setTimeout(() => sendFollowupExecution(tabId, task, retries - 1), response && response.status === 'busy' ? 2000 : 1000);
            return;
        }
        applyFollowupTaskResult({
            campaignId: task.campaignId,
            contactId: task.contactId,
            dispatchToken: task.dispatchToken,
            result: 'error',
            error: 'content_script_unavailable'
        }).catch(() => {});
    });
}
// --- FIM CAMPANHAS E FOLLOW-UPS ---

function emptyPublicContactData() {
    return { email: '', social: [], pagesChecked: 0 };
}

async function enrichPublicContactData(rawWebsite) {
    const startUrl = normalizeEnrichmentUrl(rawWebsite);
    if (!startUrl) return emptyPublicContactData();

    const cacheKey = startUrl.origin.toLowerCase();
    const cached = WEBSITE_ENRICH_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const home = await fetchPublicHtml(startUrl.href, 6500);
    if (!home) return emptyPublicContactData();

    const emails = new Set(extractPublicEmails(home.html));
    const socials = new Set(extractPublicSocialUrls(home.html + ' ' + home.finalUrl));
    const contactPages = extractContactPageUrls(home.html, home.finalUrl).slice(0, 2);
    const extraPages = await Promise.all(contactPages.map(url => fetchPublicHtml(url, 5000).catch(() => null)));
    let pagesChecked = 1;

    extraPages.filter(Boolean).forEach(page => {
        pagesChecked++;
        extractPublicEmails(page.html).forEach(email => emails.add(email));
        extractPublicSocialUrls(page.html + ' ' + page.finalUrl).forEach(url => socials.add(url));
    });

    const result = {
        email: chooseBestPublicEmail(Array.from(emails), new URL(home.finalUrl).hostname),
        social: Array.from(socials).slice(0, 8),
        pagesChecked
    };

    if (WEBSITE_ENRICH_CACHE.size >= 250) {
        const oldestKey = WEBSITE_ENRICH_CACHE.keys().next().value;
        if (oldestKey) WEBSITE_ENRICH_CACHE.delete(oldestKey);
    }
    WEBSITE_ENRICH_CACHE.set(cacheKey, { expiresAt: Date.now() + WEBSITE_ENRICH_TTL_MS, data: result });
    return result;
}

function normalizeEnrichmentUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || '').trim());
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        if (url.username || url.password || isBlockedEnrichmentHost(url.hostname)) return null;
        url.hash = '';
        return url;
    } catch (_) {
        return null;
    }
}

function isBlockedEnrichmentHost(rawHost) {
    const host = String(rawHost || '').replace(/^\[|\]$/g, '').toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
    if (host.includes(':')) {
        return host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
    }
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
    const parts = host.split('.').map(Number);
    if (parts.some(part => part < 0 || part > 255)) return true;
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
        (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
        parts[0] >= 224;
}

async function fetchPublicHtml(rawUrl, timeoutMs) {
    const safeUrl = normalizeEnrichmentUrl(rawUrl);
    if (!safeUrl) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(safeUrl.href, {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
            headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.6' }
        });
        if (!response.ok) return null;

        const finalUrl = normalizeEnrichmentUrl(response.url || safeUrl.href);
        if (!finalUrl) return null;
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) return null;
        const declaredLength = Number(response.headers.get('content-length')) || 0;
        if (declaredLength > WEBSITE_HTML_LIMIT * 2) return null;
        const html = (await response.text()).slice(0, WEBSITE_HTML_LIMIT);
        return { html, finalUrl: finalUrl.href };
    } catch (_) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function decodePublicHtml(value) {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', commat: '@', period: '.' };
    return String(value || '')
        .replace(/\\u002f/gi, '/')
        .replace(/\\u0026/gi, '&')
        .replace(/\\\//g, '/')
        .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
            const value = parseInt(code, 16);
            return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : '';
        })
        .replace(/&#(\d+);/g, (_match, code) => {
            const value = parseInt(code, 10);
            return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : '';
        })
        .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] || match);
}

function normalizePublicEmail(rawEmail) {
    let email = String(rawEmail || '').trim().toLowerCase();
    try {
        email = decodeURIComponent(email);
    } catch (_) {}
    email = email.replace(/^mailto\s*:/i, '').split('?')[0].replace(/^[<("'[\s]+|[>)"',;:\]\s]+$/g, '');
    if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)) return '';
    const parts = email.split('@');
    if (parts[0].length > 64 || parts[1].split('.').some(part => !part || part.startsWith('-') || part.endsWith('-'))) return '';
    const topLevel = parts[1].split('.').pop();
    const rejectedTopLevels = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'css', 'js', 'json', 'woff', 'woff2', 'ttf', 'map']);
    if (rejectedTopLevels.has(topLevel)) return '';
    if (['example.com', 'example.org', 'example.net'].includes(parts[1]) || /\.(?:example|invalid|test)$/.test(parts[1])) return '';
    if (/^(?:no-?reply|donotreply|mailer-daemon)$/i.test(parts[0])) return '';
    return email;
}

function extractPublicEmails(html) {
    const decoded = decodePublicHtml(html);
    const deobfuscated = decoded
        .replace(/\s*(?:\[at\]|\(at\)|\{at\}|\[arroba\]|\(arroba\)|\{arroba\}|arroba)\s*/gi, '@')
        .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\}|\[ponto\]|\(ponto\)|\{ponto\}|ponto)\s*/gi, '.');
    const emails = new Set();
    const mailtoPattern = /mailto\s*:\s*([^"'?<>\s]+)/gi;
    const emailPattern = /[a-z0-9.!#$%&'*+/=?^_~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
    const cloudflarePattern = /(?:data-cfemail\s*=\s*["']|\/cdn-cgi\/l\/email-protection#)([0-9a-f]{6,})/gi;
    let match;

    while ((match = cloudflarePattern.exec(deobfuscated))) {
        const email = normalizePublicEmail(decodeCloudflareEmail(match[1]));
        if (email) emails.add(email);
    }
    while ((match = mailtoPattern.exec(deobfuscated))) {
        const email = normalizePublicEmail(match[1]);
        if (email) emails.add(email);
    }
    while ((match = emailPattern.exec(deobfuscated))) {
        const email = normalizePublicEmail(match[0]);
        if (email) emails.add(email);
    }
    return Array.from(emails);
}

function decodeCloudflareEmail(encoded) {
    const hex = String(encoded || '');
    if (hex.length < 4 || hex.length % 2 !== 0) return '';
    const key = parseInt(hex.slice(0, 2), 16);
    if (!Number.isFinite(key)) return '';
    let decoded = '';
    for (let index = 2; index < hex.length; index += 2) {
        const value = parseInt(hex.slice(index, index + 2), 16);
        if (!Number.isFinite(value)) return '';
        decoded += String.fromCharCode(value ^ key);
    }
    return decoded;
}

function chooseBestPublicEmail(emails, websiteHost) {
    const host = String(websiteHost || '').replace(/^www\./, '').toLowerCase();
    const preferredLocals = ['contato', 'contact', 'comercial', 'vendas', 'atendimento', 'hello', 'oi', 'info', 'admin', 'recepcao'];
    return emails
        .map(email => {
            const parts = email.split('@');
            const domain = parts[1].replace(/^www\./, '');
            let score = domain === host ? 100 : (host.endsWith('.' + domain) || domain.endsWith('.' + host) ? 70 : 0);
            const preferredIndex = preferredLocals.indexOf(parts[0]);
            if (preferredIndex >= 0) score += 30 - preferredIndex;
            if (parts[0].includes('contato') || parts[0].includes('comercial')) score += 15;
            return { email, score };
        })
        .sort((a, b) => b.score - a.score || a.email.length - b.email.length)[0]?.email || '';
}

function canonicalizePublicSocialUrl(rawUrl) {
    try {
        const cleaned = String(rawUrl || '').replace(/[),.;]+$/g, '');
        const url = new URL(cleaned);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (!PUBLIC_SOCIAL_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain))) return '';
        const path = url.pathname.replace(/\/+$/, '') || '/';
        if (path === '/') return '';

        const lowerPath = path.toLowerCase();
        const rejected = [
            '/share', '/sharer', '/dialog', '/plugins', '/intent', '/search',
            '/watch', '/shorts', '/embed', '/results', '/explore', '/accounts',
            '/reel', '/stories', '/video/'
        ];
        if (rejected.some(fragment => lowerPath === fragment || lowerPath.startsWith(fragment + '/') || lowerPath.includes(fragment))) return '';
        url.hash = '';
        ['hl', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid', 'igshid'].forEach(param => url.searchParams.delete(param));
        return url.toString().replace(/\/$/, '');
    } catch (_) {
        return '';
    }
}

function extractPublicSocialUrls(html) {
    const decoded = decodePublicHtml(html);
    const social = new Set();
    const pattern = /(?:https?:)?\/\/[^\s"'<>\\]+/gi;
    let match;
    while ((match = pattern.exec(decoded))) {
        const candidate = match[0].startsWith('//') ? 'https:' + match[0] : match[0];
        const normalized = canonicalizePublicSocialUrl(candidate);
        if (normalized) social.add(normalized);
    }
    return Array.from(social);
}

function extractContactPageUrls(html, baseUrl) {
    const decoded = decodePublicHtml(html);
    const base = normalizeEnrichmentUrl(baseUrl);
    if (!base) return [];
    const baseHost = base.hostname.replace(/^www\./, '').toLowerCase();
    const candidates = new Map();
    const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
    const keywords = ['contato', 'contact', 'fale-conosco', 'faleconosco', 'atendimento', 'sobre', 'about', 'quem-somos', 'equipe', 'team', 'institucional'];
    let match;

    while ((match = anchorPattern.exec(decoded))) {
        const href = match[1] || match[2] || match[3] || '';
        try {
            const url = new URL(href, base.href);
            const host = url.hostname.replace(/^www\./, '').toLowerCase();
            if (!['http:', 'https:'].includes(url.protocol) || host !== baseHost || isBlockedEnrichmentHost(url.hostname)) continue;
            const searchable = (url.pathname + ' ' + url.search).toLowerCase();
            const keywordIndex = keywords.findIndex(keyword => searchable.includes(keyword));
            if (keywordIndex < 0) continue;
            if (/\.(?:pdf|jpg|jpeg|png|gif|webp|zip)$/i.test(url.pathname)) continue;
            url.hash = '';
            const normalized = url.href;
            const score = 100 - keywordIndex;
            if (!candidates.has(normalized) || candidates.get(normalized) < score) candidates.set(normalized, score);
        } catch (_) {}
    }
    return Array.from(candidates.entries()).sort((a, b) => b[1] - a[1]).map(entry => entry[0]);
}
