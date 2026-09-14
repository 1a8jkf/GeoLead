document.addEventListener('DOMContentLoaded', () => {
    let phoneList = [];

    const phoneInput = document.getElementById('phoneInput');
    const btnAddPhone = document.getElementById('btnAddPhone');
    const numbersListEl = document.getElementById('numbersList');
    const numCount = document.getElementById('numCount');

    const messageInput = document.getElementById('message');
    const msgWarning = document.getElementById('msgWarning');

    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const sentCount = document.getElementById('sentCount');
    const errCount = document.getElementById('errCount');
    const senderSavedListSelect = document.getElementById('senderSavedListSelect');
    const btnQueueSavedList = document.getElementById('btnQueueSavedList');
    const senderListQueueEl = document.getElementById('senderListQueue');
    const senderQueueCount = document.getElementById('senderQueueCount');
    const senderProgressCard = document.getElementById('senderProgressCard');
    const senderProgressStatus = document.getElementById('senderProgressStatus');
    const senderProgressPercent = document.getElementById('senderProgressPercent');
    const senderProgressBar = document.getElementById('senderProgressBar');
    const senderProgressText = document.getElementById('senderProgressText');
    const senderCurrentBatch = document.getElementById('senderCurrentBatch');
    const senderBatchProgress = document.getElementById('senderBatchProgress');

    const btnUploadCsv = document.getElementById('btnUploadCsv');
    const csvFileInput = document.getElementById('csvFileInput');
    const delayValue = document.getElementById('delayValue');
    const delayUnit = document.getElementById('delayUnit');

    const useRandomDelay = document.getElementById('useRandomDelay');
    const fixedDelayContainer = document.getElementById('fixedDelayContainer');
    const randomDelayContainer = document.getElementById('randomDelayContainer');
    const delayMin = document.getElementById('delayMin');
    const delayMax = document.getElementById('delayMax');
    const delayUnitRandom = document.getElementById('delayUnitRandom');

    const usePause = document.getElementById('usePause');
    const pauseContainer = document.getElementById('pauseContainer');
    const pauseDuration = document.getElementById('pauseDuration');
    const pauseEvery = document.getElementById('pauseEvery');

    const filterPhone = document.getElementById('filterPhone');
    const filterEmail = document.getElementById('filterEmail');
    const filterSocial = document.getElementById('filterSocial');

    const btnAttach = document.getElementById('btnAttach');
    const btnRemoveAttach = document.getElementById('btnRemoveAttach');
    const attachmentInput = document.getElementById('attachmentInput');
    const attachmentName = document.getElementById('attachmentName');

    const tabText = document.getElementById('tabText');
    const tabAudio = document.getElementById('tabAudio');
    const textSection = document.getElementById('textSection');
    const audioSection = document.getElementById('audioSection');

    const btnRecordAudio = document.getElementById('btnRecordAudio');
    const btnStopRecord = document.getElementById('btnStopRecord');
    const recordTimer = document.getElementById('recordTimer');
    const audioPreview = document.getElementById('audioPreview');
    const btnRemoveAudio = document.getElementById('btnRemoveAudio');
    const btnUploadAudio = document.getElementById('btnUploadAudio');
    const audioFileInput = document.getElementById('audioFileInput');
    const audioFormatStatus = document.getElementById('audioFormatStatus');
    const microphoneSelect = document.getElementById('microphoneSelect');
    const btnRefreshMicrophones = document.getElementById('btnRefreshMicrophones');
    const behaviorSummary = document.getElementById('behaviorSummary');

    let mediaRecorder = null;
    let audioChunks = [];
    let recordInterval = null;
    let recordSeconds = 0;

    let currentMode = 'text';
    let currentAttachment = null;
    let currentAudio = null;
    let messageTemplates = [];
    let currentTemplateAttachment = null;
    let editingTemplateId = null;
    let currentLang = 'pt';
    let senderCampaignContext = null;
    let senderListQueue = [];
    let latestSenderState = null;
    let followupCampaigns = [];
    let editingFollowupCampaignId = '';

    const btnDashboard = document.getElementById('btnDashboard');

    const newTemplateName = document.getElementById('newTemplateName');
    const newTemplateText = document.getElementById('newTemplateText');
    const btnAttachTemplate = document.getElementById('btnAttachTemplate');
    const templateAttachmentInput = document.getElementById('templateAttachmentInput');
    const btnRemoveTemplateAttach = document.getElementById('btnRemoveTemplateAttach');
    const templateAttachmentName = document.getElementById('templateAttachmentName');
    const btnSaveTemplate = document.getElementById('btnSaveTemplate');
    const templatesList = document.getElementById('templatesList');
    const emptyTemplates = document.getElementById('emptyTemplates');
    const templateSelect = document.getElementById('templateSelect');
    const btnCancelTemplateEdit = document.getElementById('btnCancelTemplateEdit');
    const btnRefreshSpintaxPreview = document.getElementById('btnRefreshSpintaxPreview');
    const templateSpintaxPreview = document.getElementById('templateSpintaxPreview');
    const dashTemplateCount = document.getElementById('dashTemplateCount');

    const imagePreviewOverlay = document.getElementById('imagePreviewOverlay');
    const imagePreviewImg = document.getElementById('imagePreviewImg');

    if (imagePreviewOverlay) {
        imagePreviewOverlay.addEventListener('click', () => {
            imagePreviewOverlay.style.display = 'none';
        });
    }

    function renderAttachmentPreview(attachment, containerEl, defaultText) {
        containerEl.innerHTML = '';
        if (!attachment) {
            containerEl.innerText = defaultText;
            return;
        }

        if (attachment.type && attachment.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = attachment.data;
            img.style.width = '24px';
            img.style.height = '24px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.cursor = 'pointer';
            img.style.border = '1px solid var(--border)';
            img.title = 'Clique para ampliar';
            img.onclick = (e) => {
                e.stopPropagation();
                if (imagePreviewOverlay && imagePreviewImg) {
                    imagePreviewImg.src = attachment.data;
                    imagePreviewOverlay.style.display = 'flex';
                }
            };
            const nameSpan = document.createElement('span');
            nameSpan.innerText = attachment.name;
            containerEl.appendChild(img);
            containerEl.appendChild(nameSpan);
        } else {
            containerEl.innerText = attachment.name;
        }
    }

    // Modal de Ajuda do Spintax
    const spintaxHelpBtns = document.querySelectorAll('.spintax-help-btn');
    const spintaxHelpModal = document.getElementById('spintaxHelpModal');
    const btnCloseSpintaxHelp = document.getElementById('btnCloseSpintaxHelp');
    const btnCopySpintax = document.getElementById('btnCopySpintax');
    const spintaxExampleText = document.getElementById('spintaxExampleText');

    spintaxHelpBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que clique feche coisas
            spintaxHelpModal.style.display = 'flex';
        });
    });

    if (btnCloseSpintaxHelp) {
        btnCloseSpintaxHelp.addEventListener('click', () => {
            spintaxHelpModal.style.display = 'none';
        });
    }

    if (spintaxHelpModal) {
        spintaxHelpModal.addEventListener('click', (e) => {
            if (e.target === spintaxHelpModal) {
                spintaxHelpModal.style.display = 'none';
            }
        });
    }

    if (btnCopySpintax && spintaxExampleText) {
        btnCopySpintax.addEventListener('click', () => {
            navigator.clipboard.writeText(spintaxExampleText.innerText).then(() => {
                showToast("Exemplo copiado para a área de transferência!", "success");
                spintaxHelpModal.style.display = 'none';

                const templatePaneOpen = dashboardTemplatesPane && dashboardTemplatesPane.style.display !== 'none';
                if (!templatePaneOpen) {
                    const currentVal = messageInput.value.trim();
                    if(currentVal) {
                        messageInput.value = currentVal + '\n\n' + spintaxExampleText.innerText;
                    } else {
                        messageInput.value = spintaxExampleText.innerText;
                    }
                    saveState();
                    checkReady();
                } else {
                    const currentVal = newTemplateText.value.trim();
                    if(currentVal) {
                        newTemplateText.value = currentVal + '\n\n' + spintaxExampleText.innerText;
                    } else {
                        newTemplateText.value = spintaxExampleText.innerText;
                    }
                    renderSpintaxPreview();
                }
            }).catch(err => {
                showToast("Erro ao copiar texto.", "error");
            });
        });
    }

    // Recupera dados salvos
    chrome.storage.local.get([
        'savedPhones', 'savedMessage', 'savedDelayValue', 'savedDelayUnit', 'savedAttachment', 'savedAudio', 'savedMode',
        'savedUseRandomDelay', 'savedDelayMin', 'savedDelayMax', 'savedDelayUnitRandom',
        'savedUsePause', 'savedPauseDuration', 'savedPauseEvery',
        'savedFilterPhone', 'savedFilterEmail', 'savedFilterSocial', 'savedTemplates',
        'savedExtractLimit', 'savedMicrophoneId', 'savedCampaignContext', 'savedSenderListQueue', 'glContactLists', 'savedMainView'
    ], (data) => {
        if (data.savedPhones) {
            phoneList = data.savedPhones;
            renderPhones();
        }
        if (data.savedMainView) {
            showMainView(data.savedMainView);
        }
        if (data.savedMessage) messageInput.value = data.savedMessage;
        if (data.savedDelayValue) delayValue.value = data.savedDelayValue;
        if (data.savedDelayUnit) delayUnit.value = data.savedDelayUnit;

        if (typeof data.savedUseRandomDelay === 'boolean') useRandomDelay.checked = data.savedUseRandomDelay;
        if (data.savedDelayMin) delayMin.value = data.savedDelayMin;
        if (data.savedDelayMax) delayMax.value = data.savedDelayMax;
        if (data.savedDelayUnitRandom) delayUnitRandom.value = data.savedDelayUnitRandom;
        toggleRandomDelayUI(false);

        if (typeof data.savedUsePause === 'boolean') usePause.checked = data.savedUsePause;
        if (data.savedPauseDuration) pauseDuration.value = data.savedPauseDuration;
        if (data.savedPauseEvery) pauseEvery.value = data.savedPauseEvery;
        togglePauseUI(false);

        if (data.savedFilterPhone) filterPhone.checked = data.savedFilterPhone;
        if (data.savedFilterEmail) filterEmail.checked = data.savedFilterEmail;
        if (data.savedFilterSocial) filterSocial.checked = data.savedFilterSocial;

        if (data.savedAttachment) {
            currentAttachment = data.savedAttachment;
            renderAttachmentPreview(currentAttachment, attachmentName, 'Nenhum anexo selecionado');
            btnRemoveAttach.style.display = 'inline-block';
        }
        if (data.savedAudio) {
            currentAudio = data.savedAudio;
            audioPreview.src = currentAudio.data;
            document.getElementById('audioPreviewContainer').style.display = 'flex';
            const savedName = currentAudio.name || 'Áudio salvo';
            if (currentAudio.type === 'audio/wav') {
                setAudioFormatStatus('Gravação antiga em WAV detectada. Grave novamente ou importe MP3, M4A ou OGG.', 'warning');
            } else {
                setAudioFormatStatus(`${savedName} pronto para envio.`);
            }
        }
        if (data.savedCampaignContext && typeof data.savedCampaignContext === 'object') senderCampaignContext = data.savedCampaignContext;
        if (Array.isArray(data.savedSenderListQueue)) senderListQueue = data.savedSenderListQueue;
        if (data.savedMode) {
            setMode(data.savedMode);
        }
        if (data.savedTemplates) {
            messageTemplates = data.savedTemplates;
            renderTemplatesList();
            renderTemplateSelect();
        }
        if (data.savedExtractLimit && extractLimit) extractLimit.value = String(data.savedExtractLimit);
        if (Array.isArray(data.glContactLists)) savedContactLists = data.glContactLists;
        refreshMicrophoneDevices(data.savedMicrophoneId || '');
        renderSavedLists();
        renderSenderSavedListOptions();
        renderSenderListQueue();
        refreshFollowupCampaigns();
        updateBehaviorSummary();
        updateUI();
        checkReady();

        // Sync Extractor State
        chrome.runtime.sendMessage({ action: 'get_ext_state' }, (res) => {
            if (res) {
                applyDashboardState(res);
                if (res.isExtracting) {
                    btnStartExtract.disabled = true;
                    btnStartExtract.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extraindo...';
                    btnStopExtract.style.display = 'block';
                    extractionTerminal.innerHTML = '';
                    (res.extLogs || []).forEach(log => {
                        let type = '';
                        if (log.includes('❌')) type = 'error';
                        if (log.includes('✅')) type = 'system';
                        addExtLog(log, type);
                    });
                } else if (res.extData && res.extData.length > 0) {
                    extractedData = res.extData;
                    updateExtractionCompletionUI();
                    extractionTerminal.innerHTML = '';
                    (res.extLogs || []).forEach(log => {
                        let type = '';
                        if (log.includes('❌')) type = 'error';
                        if (log.includes('✅')) type = 'system';
                        addExtLog(log, type);
                    });
                }
            }
        });
    });

    function setMode(mode) {
        currentMode = mode;
        if (mode === 'text') {
            tabText.classList.add('active');
            tabAudio.classList.remove('active');
            textSection.style.display = 'block';
            audioSection.style.display = 'none';
        } else {
            tabAudio.classList.add('active');
            tabText.classList.remove('active');
            audioSection.style.display = 'block';
            textSection.style.display = 'none';
            refreshMicrophoneDevices(microphoneSelect ? microphoneSelect.value : '');
        }
        saveState();
        checkReady();
    }

    tabText.addEventListener('click', () => setMode('text'));
    tabAudio.addEventListener('click', () => setMode('audio'));

    function toggleRandomDelayUI(persist = true) {
        if (useRandomDelay.checked) {
            fixedDelayContainer.style.display = 'none';
            randomDelayContainer.style.display = 'flex';
        } else {
            fixedDelayContainer.style.display = 'flex';
            randomDelayContainer.style.display = 'none';
        }
        updateBehaviorSummary();
        if (persist) saveState();
    }

    function togglePauseUI(persist = true) {
        if (usePause.checked) {
            pauseContainer.style.display = 'flex';
        } else {
            pauseContainer.style.display = 'none';
        }
        updateBehaviorSummary();
        if (persist) saveState();
    }

    useRandomDelay.addEventListener('change', toggleRandomDelayUI);
    usePause.addEventListener('change', togglePauseUI);

    function positiveInteger(value, fallback, max = 1440) {
        const parsed = Math.round(Number(value));
        if (!Number.isFinite(parsed) || parsed < 1) return fallback;
        return Math.min(parsed, max);
    }

    function buildDelayConfig(syncFields = false) {
        const unit = Number(delayUnit.value) === 60 ? 60 : 1;
        const randomUnit = Number(delayUnitRandom.value) === 60 ? 60 : 1;
        const value = positiveInteger(delayValue.value, 10);
        let min = positiveInteger(delayMin.value, 10);
        let max = positiveInteger(delayMax.value, 23);
        if (min > max) [min, max] = [max, min];
        if (syncFields) {
            delayValue.value = value;
            delayMin.value = min;
            delayMax.value = max;
        }
        return { random: useRandomDelay.checked, value, unit, min, max, randomUnit };
    }

    function buildPauseConfig(syncFields = false) {
        const duration = positiveInteger(pauseDuration.value, 5, 720);
        const every = positiveInteger(pauseEvery.value, 30, 10000);
        if (syncFields) {
            pauseDuration.value = duration;
            pauseEvery.value = every;
        }
        return { enabled: usePause.checked, duration, every };
    }

    function updateBehaviorSummary(senderState = null) {
        if (!behaviorSummary) return;
        const delayConfig = buildDelayConfig(false);
        const pauseConfig = buildPauseConfig(false);
        let message;
        if (senderState && senderState.isProcessing && Number(senderState.nextRunAt) > Date.now()) {
            const seconds = Math.max(1, Math.ceil((Number(senderState.nextRunAt) - Date.now()) / 1000));
            message = senderState.lastWaitReason === 'human_pause'
                ? t('behaviorWaitingPause', { seconds })
                : t('behaviorWaitingDelay', { seconds });
        } else if (delayConfig.random) {
            message = t('behaviorRandom', {
                min: delayConfig.min,
                max: delayConfig.max,
                unit: t(delayConfig.randomUnit === 60 ? 'minutes' : 'seconds')
            });
        } else {
            message = t('behaviorFixed', {
                value: delayConfig.value,
                unit: t(delayConfig.unit === 60 ? 'minutes' : 'seconds')
            });
        }
        if (pauseConfig.enabled) message += ` ${t('behaviorPause', { duration: pauseConfig.duration, every: pauseConfig.every })}`;
        behaviorSummary.innerHTML = '<i class="fas fa-shield-heart"></i>';
        const span = document.createElement('span');
        span.textContent = message;
        behaviorSummary.appendChild(span);
    }

    function cleanPhone(phone) {
        return phone.replace(/\D/g, '');
    }

    function normalizePhoneForSender(value) {
        let clean = cleanPhone(String(value || ''));
        const countryCodeEl = document.getElementById('countryCode');
        const countryCode = countryCodeEl ? countryCodeEl.value : '55';
        if (clean.length >= 8 && clean.length <= 11) clean = countryCode + clean;
        return clean.length >= 10 && clean.length <= 16 ? clean : '';
    }

    function compactSenderQueueContacts(contacts) {
        const byPhone = new Map();
        (Array.isArray(contacts) ? contacts : []).forEach(row => {
            const phone = normalizePhoneForSender(row && (row.phone || row.telefone));
            if (!phone || byPhone.has(phone)) return;
            byPhone.set(phone, {
                phone,
                name: String(row && (row.name || row.nome) || phone).slice(0, 100),
                email: String(row && row.email || '').slice(0, 160),
                website: String(row && row.website || '').slice(0, 500)
            });
        });
        return [...byPhone.values()];
    }

    function renderSenderSavedListOptions() {
        if (!senderSavedListSelect) return;
        const selected = senderSavedListSelect.value;
        const queuedIds = new Set(senderListQueue.map(item => String(item.sourceListId || '')).filter(Boolean));
        senderSavedListSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('senderQueueSelect');
        senderSavedListSelect.appendChild(placeholder);
        savedContactLists.forEach(list => {
            const option = document.createElement('option');
            option.value = String(list.id || '');
            const phoneCount = compactSenderQueueContacts(list.contacts).length;
            option.textContent = `${list.name || t('listUnnamed')} · ${phoneCount}`;
            option.disabled = queuedIds.has(String(list.id || ''));
            senderSavedListSelect.appendChild(option);
        });
        if ([...senderSavedListSelect.options].some(option => option.value === selected && !option.disabled)) {
            senderSavedListSelect.value = selected;
        }
        if (btnQueueSavedList) btnQueueSavedList.disabled = !senderSavedListSelect.value || Boolean(latestSenderState && latestSenderState.isProcessing);
    }

    function removeSenderQueueItem(queueId) {
        const removed = senderListQueue.find(item => item.queueId === queueId);
        if (!removed) return;
        const otherPhones = new Set(senderListQueue
            .filter(item => item.queueId !== queueId)
            .flatMap(item => compactSenderQueueContacts(item.contacts).map(contact => contact.phone)));
        const removedPhones = new Set(compactSenderQueueContacts(removed.contacts).map(contact => contact.phone));
        senderListQueue = senderListQueue.filter(item => item.queueId !== queueId);
        phoneList = phoneList.filter(phone => !removedPhones.has(cleanPhone(phone)) || otherPhones.has(cleanPhone(phone)));
        senderCampaignContext = senderListQueue.length ? senderCampaignContext : null;
        renderPhones();
        renderSenderListQueue();
        renderSenderSavedListOptions();
        saveState();
    }

    function moveSenderQueueItem(queueId, direction) {
        const index = senderListQueue.findIndex(item => item.queueId === queueId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= senderListQueue.length) return;
        [senderListQueue[index], senderListQueue[target]] = [senderListQueue[target], senderListQueue[index]];
        renderSenderListQueue();
        saveState();
    }

    function renderSenderListQueue() {
        if (!senderListQueueEl || !senderQueueCount) return;
        senderListQueue = senderListQueue.map((item, index) => ({
            queueId: String(item && item.queueId || `sender_list_${Date.now()}_${index}`),
            sourceListId: String(item && item.sourceListId || ''),
            sourceName: String(item && (item.sourceName || item.name) || t('campaignUnnamed')).slice(0, 80),
            name: String(item && (item.name || item.sourceName) || t('campaignUnnamed')).slice(0, 80),
            contacts: compactSenderQueueContacts(item && item.contacts)
        })).filter(item => item.contacts.length > 0).slice(0, 50);

        senderQueueCount.textContent = senderListQueue.length;
        senderListQueueEl.innerHTML = '';
        if (!senderListQueue.length) {
            const empty = document.createElement('div');
            empty.className = 'sender-queue-empty';
            empty.innerHTML = `<i class="fas fa-list-check"></i><span>${t('senderQueueEmpty')}</span>`;
            senderListQueueEl.appendChild(empty);
            renderSenderSavedListOptions();
            return;
        }

        const locked = Boolean(latestSenderState && latestSenderState.isProcessing);
        senderListQueue.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'sender-queue-item';
            const order = document.createElement('span');
            order.className = 'sender-queue-order';
            order.textContent = index + 1;
            const copy = document.createElement('div');
            copy.className = 'sender-queue-copy';
            const name = document.createElement('strong');
            name.textContent = item.name;
            const meta = document.createElement('small');
            meta.textContent = t('senderQueueContacts', { count: item.contacts.length });
            copy.append(name, meta);
            const actions = document.createElement('div');
            actions.className = 'sender-queue-actions';
            const up = createIconButton('fas fa-arrow-up', t('senderQueueMoveUp'), () => moveSenderQueueItem(item.queueId, -1));
            const down = createIconButton('fas fa-arrow-down', t('senderQueueMoveDown'), () => moveSenderQueueItem(item.queueId, 1));
            const remove = createIconButton('fas fa-xmark', t('senderQueueRemove'), () => removeSenderQueueItem(item.queueId), 'remove');
            up.disabled = locked || index === 0;
            down.disabled = locked || index === senderListQueue.length - 1;
            remove.disabled = locked;
            actions.append(up, down, remove);
            row.append(order, copy, actions);
            senderListQueueEl.appendChild(row);
        });
        renderSenderSavedListOptions();
    }

    function enqueueSenderList(contacts, source = {}, navigate = true) {
        const compactContacts = compactSenderQueueContacts(contacts);
        if (!compactContacts.length) {
            showToast(t('noValidPhone'), 'error');
            return false;
        }
        const sourceListId = String(source.sourceListId || '');
        if (sourceListId && senderListQueue.some(item => item.sourceListId === sourceListId)) {
            showToast(t('senderQueueAlreadyAdded'), 'info');
            if (navigate) navSender.click();
            return false;
        }
        const sourceName = String(source.sourceName || source.name || t('defaultMapsLeads')).slice(0, 80);
        const queueItem = {
            queueId: `sender_list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            sourceListId,
            sourceName,
            name: String(source.name || sourceName).slice(0, 80),
            contacts: compactContacts
        };
        senderListQueue.push(queueItem);
        senderCampaignContext = {
            sourceListId,
            sourceName,
            name: queueItem.name,
            contacts: Object.fromEntries(compactContacts.map(contact => [contact.phone, contact]))
        };
        addPhones(compactContacts.map(contact => contact.phone));
        renderSenderListQueue();
        renderSenderSavedListOptions();
        saveState();
        showToast(t('senderQueueAdded', { name: queueItem.name, count: compactContacts.length }), 'success');
        if (navigate) navSender.click();
        return true;
    }

    function addPhones(rawList) {
        let added = false;
        rawList.forEach(p => {
            const clean = normalizePhoneForSender(p);
            if (clean && !phoneList.includes(clean)) {
                phoneList.push(clean);
                added = true;
            }
        });
        if (added) {
            renderPhones();
            saveState();
        }
    }

    function removePhone(phone) {
        phoneList = phoneList.filter(p => p !== phone);
        senderListQueue = senderListQueue.map(item => ({
            ...item,
            contacts: compactSenderQueueContacts(item.contacts).filter(contact => contact.phone !== cleanPhone(phone))
        })).filter(item => item.contacts.length > 0);
        renderPhones();
        renderSenderListQueue();
        saveState();
    }

    function renderPhones() {
        numbersListEl.innerHTML = '';
        if (phoneList.length === 0) {
            numbersListEl.innerHTML = '<div class="empty-state" id="emptyState">Nenhum contato adicionado</div>';
        } else {
            phoneList.forEach(phone => {
                const chip = document.createElement('div');
                chip.className = 'chip';
                chip.innerHTML = `<span>${phone}</span> <i class="fas fa-times"></i>`;
                chip.querySelector('i').addEventListener('click', () => removePhone(phone));
                numbersListEl.appendChild(chip);
            });
        }
        numCount.innerText = phoneList.length;
        numbersListEl.scrollTop = numbersListEl.scrollHeight;
        checkReady();
    }

    function saveState() {
        chrome.storage.local.set({
            savedPhones: phoneList,
            savedMessage: messageInput.value,
            savedDelayValue: delayValue.value,
            savedDelayUnit: delayUnit.value,
            savedUseRandomDelay: useRandomDelay.checked,
            savedDelayMin: delayMin.value,
            savedDelayMax: delayMax.value,
            savedDelayUnitRandom: delayUnitRandom.value,
            savedUsePause: usePause.checked,
            savedPauseDuration: pauseDuration.value,
            savedPauseEvery: pauseEvery.value,
            savedFilterPhone: filterPhone.checked,
            savedFilterEmail: filterEmail.checked,
            savedFilterSocial: filterSocial.checked,
            savedAttachment: currentAttachment,
            savedAudio: currentAudio,
            savedMode: currentMode,
            savedExtractLimit: extractLimit ? extractLimit.value : '300',
            savedMicrophoneId: microphoneSelect ? microphoneSelect.value : '',
            savedCampaignContext: senderCampaignContext,
            savedSenderListQueue: senderListQueue
        });
    }

    btnAddPhone.addEventListener('click', () => {
        if (phoneInput.value.trim() !== '') {
            senderCampaignContext = null;
            addPhones([phoneInput.value]);
            phoneInput.value = '';
            phoneInput.focus();
        }
    });

    phoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnAddPhone.click();
        }
    });

    const btnClearContacts = document.getElementById('btnClearContacts');
    if (btnClearContacts) {
        btnClearContacts.addEventListener('click', () => {
            if (phoneList.length === 0) return;
            if (confirm("Deseja realmente excluir todos os contatos da lista?")) {
                phoneList = [];
                senderCampaignContext = null;
                senderListQueue = [];
                renderPhones();
                renderSenderListQueue();
                saveState();
                showToast("Lista de contatos limpa.", "info");
            }
        });
    }

    if (senderSavedListSelect) {
        senderSavedListSelect.addEventListener('change', () => {
            if (btnQueueSavedList) btnQueueSavedList.disabled = !senderSavedListSelect.value || Boolean(latestSenderState && latestSenderState.isProcessing);
        });
    }
    if (btnQueueSavedList) {
        btnQueueSavedList.addEventListener('click', () => {
            const list = savedContactLists.find(item => String(item.id || '') === senderSavedListSelect.value);
            if (!list) return;
            enqueueSenderList(list.contacts, {
                sourceListId: list.id,
                sourceName: list.name,
                name: list.name
            }, false);
        });
    }

    phoneInput.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (text) {
            const lines = text.split(/[\n\t,;]+/);
            let foundPhones = [];
            lines.forEach(str => {
                let clean = cleanPhone(str);
                if (clean.length === 10 || clean.length === 11) {
                    clean = '55' + clean;
                }
                if (clean.length >= 12 && clean.length <= 15) {
                    foundPhones.push(clean);
                }
            });

            if (foundPhones.length > 0) {
                e.preventDefault();
                senderCampaignContext = null;
                addPhones(foundPhones);
                phoneInput.value = '';
            }
        }
    });

    btnUploadCsv.addEventListener('click', () => {
        csvFileInput.click();
    });

    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    let foundPhones = [];
                    json.forEach(row => {
                        row.forEach(cell => {
                            if (cell !== undefined && cell !== null) {
                                const str = String(cell);
                                let clean = cleanPhone(str);
                                if (clean.length === 10 || clean.length === 11) {
                                    clean = '55' + clean;
                                }
                                if (clean.length >= 12 && clean.length <= 15) {
                                    foundPhones.push(clean);
                                }
                            }
                        });
                    });

                    if (foundPhones.length > 0) {
                        senderCampaignContext = null;
                        addPhones(foundPhones);
                        showToast("Planilha importada com sucesso!", "success");
                    } else {
                        showToast("Nenhum número de telefone válido encontrado na planilha.", "error");
                    }
                } catch (err) {
                    console.error("Erro ao ler Excel:", err);
                    showToast("Erro ao ler o arquivo Excel. Verifique se ele não está corrompido.", "error");
                }
                csvFileInput.value = '';
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const content = evt.target.result;
                const lines = content.split(/[\n,;]/);
                senderCampaignContext = null;
                addPhones(lines);
                csvFileInput.value = '';
            };
            reader.readAsText(file);
        }
    });

    btnAttach.addEventListener('click', () => {
        attachmentInput.click();
    });

    attachmentInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("Por favor, selecione um arquivo menor que 5MB.", "error");
            attachmentInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            currentAttachment = {
                name: file.name,
                type: file.type,
                data: evt.target.result
            };
            renderAttachmentPreview(currentAttachment, attachmentName, 'Nenhum anexo selecionado');
            btnRemoveAttach.style.display = 'inline-block';
            saveState();
        };
        reader.readAsDataURL(file);
    });

    btnRemoveAttach.addEventListener('click', () => {
        currentAttachment = null;
        attachmentInput.value = '';
        renderAttachmentPreview(null, attachmentName, 'Nenhum anexo selecionado');
        btnRemoveAttach.style.display = 'none';
        saveState();
    });

    function updateTimer() {
        recordSeconds++;
        const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const s = String(recordSeconds % 60).padStart(2, '0');
        recordTimer.innerText = `${m}:${s}`;
    }

    function getBestAudioRecordingFormat() {
        if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
        const formats = [
            // MP4/M4A é a primeira escolha porque o WhatsApp Web o aceita como
            // áudio nativo. O contêiner real ainda é validado no momento do envio.
            { mimeType: 'audio/mp4;codecs=mp4a.40.2', type: 'audio/mp4', extension: 'm4a', reliable: true },
            { mimeType: 'audio/mp4', type: 'audio/mp4', extension: 'm4a', reliable: true },
            { mimeType: 'audio/ogg;codecs=opus', type: 'audio/ogg', extension: 'ogg', reliable: true },
            { mimeType: 'audio/webm;codecs=opus', type: 'audio/webm', extension: 'webm', reliable: false },
            { mimeType: 'audio/webm', type: 'audio/webm', extension: 'webm', reliable: false }
        ];

        return formats.find(format => MediaRecorder.isTypeSupported(format.mimeType)) || null;
    }

    function setAudioFormatStatus(message, type = 'success') {
        if (!audioFormatStatus) return;
        audioFormatStatus.classList.remove('warning', 'error');
        if (type !== 'success') audioFormatStatus.classList.add(type);
        const icon = type === 'error' ? 'fa-circle-exclamation' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check';
        audioFormatStatus.innerHTML = '';
        const iconElement = document.createElement('i');
        iconElement.className = `fas ${icon}`;
        audioFormatStatus.append(iconElement, document.createTextNode(` ${message}`));
    }

    async function refreshMicrophoneDevices(preferredDeviceId = '') {
        if (!microphoneSelect) return [];
        const previous = preferredDeviceId || microphoneSelect.value;
        microphoneSelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = t('microphoneDefault');
        microphoneSelect.appendChild(defaultOption);

        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            setAudioFormatStatus(t('microphoneApiUnavailable'), 'error');
            return [];
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(device => device.kind === 'audioinput');
            inputs.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `${t('microphoneLabel')} ${index + 1}`;
                microphoneSelect.appendChild(option);
            });
            if (previous && inputs.some(device => device.deviceId === previous)) microphoneSelect.value = previous;
            if (inputs.length === 0) setAudioFormatStatus(t('microphoneNotFound'), 'error');
            return inputs;
        } catch (error) {
            console.warn('GeoLead: não foi possível listar microfones.', error);
            setAudioFormatStatus(t('microphoneListError'), 'warning');
            return [];
        }
    }

    async function acquireMicrophoneStream() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const error = new Error(t('microphoneApiUnavailable'));
            error.name = 'NotSupportedError';
            throw error;
        }
        const selectedDeviceId = microphoneSelect ? microphoneSelect.value : '';
        const audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        };
        if (selectedDeviceId) audioConstraints.deviceId = { exact: selectedDeviceId };

        try {
            return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
        } catch (error) {
            const staleSelection = selectedDeviceId && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError');
            if (!staleSelection) throw error;
            microphoneSelect.value = '';
            await refreshMicrophoneDevices('');
            return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
    }

    if (btnRefreshMicrophones) {
        btnRefreshMicrophones.addEventListener('click', async () => {
            btnRefreshMicrophones.disabled = true;
            await refreshMicrophoneDevices(microphoneSelect ? microphoneSelect.value : '');
            btnRefreshMicrophones.disabled = false;
            saveState();
        });
    }
    if (microphoneSelect) microphoneSelect.addEventListener('change', saveState);
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', () => refreshMicrophoneDevices(microphoneSelect ? microphoneSelect.value : ''));
    }

    function storeAudioBlob(blob, fileName, mimeType, source = 'recorded') {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentAudio = {
                name: fileName,
                type: mimeType,
                data: event.target.result,
                source
            };
            audioPreview.src = event.target.result;
            document.getElementById('audioPreviewContainer').style.display = 'flex';
            saveState();
            checkReady();
        };
        reader.onerror = () => setAudioFormatStatus('Não foi possível preparar este áudio.', 'error');
        reader.readAsDataURL(blob);
    }

    btnRecordAudio.addEventListener('click', async () => {
        btnRecordAudio.disabled = true;
        let captureStream = null;
        try {
            const stream = await acquireMicrophoneStream();
            captureStream = stream;
            await refreshMicrophoneDevices(stream.getAudioTracks()[0]?.getSettings()?.deviceId || '');
            saveState();
            const recordingFormat = getBestAudioRecordingFormat();
            if (!recordingFormat) {
                stream.getTracks().forEach(track => track.stop());
                setAudioFormatStatus('Seu navegador não oferece um formato de gravação compatível. Importe um arquivo MP3, M4A ou OGG.', 'error');
                return;
            }

            mediaRecorder = new MediaRecorder(stream, {
                mimeType: recordingFormat.mimeType,
                audioBitsPerSecond: 96000
            });
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const actualMimeType = mediaRecorder.mimeType || recordingFormat.type;
                const finalType = actualMimeType.startsWith('audio/mp4') ? 'audio/mp4' :
                    actualMimeType.startsWith('audio/ogg') ? 'audio/ogg' : 'audio/webm';
                const extension = finalType === 'audio/mp4' ? 'm4a' : finalType === 'audio/ogg' ? 'ogg' : 'webm';
                const finalBlob = new Blob(audioChunks, { type: actualMimeType });

                storeAudioBlob(finalBlob, `audio_geolead_${Date.now()}.${extension}`, finalType);
                if (recordingFormat.reliable) {
                    setAudioFormatStatus(`Áudio pronto em ${extension.toUpperCase()}. O formato será validado antes do envio.`);
                } else {
                    setAudioFormatStatus('O navegador gravou em WebM. Se o WhatsApp não aceitar como mídia, a extensão enviará o áudio como documento automaticamente.', 'warning');
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            btnRecordAudio.style.display = 'none';
            btnStopRecord.style.display = 'inline-block';
            recordSeconds = 0;
            recordTimer.innerText = '00:00';
            recordInterval = setInterval(updateTimer, 1000);

            document.getElementById('audioPreviewContainer').style.display = 'none';
            audioPreview.src = '';
            currentAudio = null;
            checkReady();
            setAudioFormatStatus(`Gravando em ${recordingFormat.extension.toUpperCase()}…`);
        } catch (err) {
            if (captureStream) captureStream.getTracks().forEach(track => track.stop());
            console.error('Erro ao acessar microfone:', err);
            const message = String(err.message || '').toLowerCase();
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || message.includes('permission')) {
                setAudioFormatStatus(t('microphonePermissionDenied'), 'error');
                chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
            } else if (err.name === 'NotFoundError' || message.includes('requested device not found')) {
                setAudioFormatStatus(t('microphoneNotFound'), 'error');
                chrome.tabs.create({ url: chrome.runtime.getURL('permission.html?reason=not-found') });
            } else if (err.name === 'NotReadableError' || err.name === 'AbortError') {
                setAudioFormatStatus(t('microphoneBusy'), 'error');
            } else {
                setAudioFormatStatus(`${t('microphoneAccessError')} ${err.message || err.name}`, 'error');
            }
        } finally {
            if (!mediaRecorder || mediaRecorder.state === 'inactive') btnRecordAudio.disabled = false;
        }
    });

    btnStopRecord.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        clearInterval(recordInterval);
        btnRecordAudio.style.display = 'inline-block';
        btnStopRecord.style.display = 'none';
    });

    btnRemoveAudio.addEventListener('click', () => {
        currentAudio = null;
        document.getElementById('audioPreviewContainer').style.display = 'none';
        audioPreview.src = '';
        if (audioFileInput) audioFileInput.value = '';
        setAudioFormatStatus('A gravação será preparada em formato compatível com o WhatsApp.');
        saveState();
        checkReady();
    });

    if (btnUploadAudio && audioFileInput) {
        btnUploadAudio.addEventListener('click', () => audioFileInput.click());
        audioFileInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            const extension = (file.name.split('.').pop() || '').toLowerCase();
            const allowedExtensions = ['mp3', 'm4a', 'aac', 'ogg'];
            if (!allowedExtensions.includes(extension)) {
                setAudioFormatStatus('Formato não suportado. Use MP3, M4A, AAC ou OGG.', 'error');
                audioFileInput.value = '';
                return;
            }
            if (file.size > 16 * 1024 * 1024) {
                setAudioFormatStatus('O áudio deve ter no máximo 16 MB.', 'error');
                audioFileInput.value = '';
                return;
            }

            const mimeByExtension = {
                mp3: 'audio/mpeg',
                m4a: 'audio/mp4',
                aac: 'audio/aac',
                ogg: 'audio/ogg'
            };
            storeAudioBlob(file, file.name, file.type || mimeByExtension[extension], 'uploaded');
            setAudioFormatStatus(`${file.name} pronto para envio.`);
        });
    }

    function checkReady() {
        const msg = messageInput.value.trim();
        const hasText = msg !== '';
        const supportedAudioTypes = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm'];
        const hasAudio = currentAudio !== null && supportedAudioTypes.includes(currentAudio.type);
        const isValidMessage = (currentMode === 'text' && hasText) || (currentMode === 'audio' && hasAudio);

        if (!isValidMessage) {
            msgWarning.style.display = 'block';
        } else {
            msgWarning.style.display = 'none';
        }

        if (phoneList.length > 0 && isValidMessage) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
        }
        saveState();
    }

    messageInput.addEventListener('input', checkReady);
    const handleBehaviorChange = () => { updateBehaviorSummary(); saveState(); };
    delayValue.addEventListener('input', handleBehaviorChange);
    delayUnit.addEventListener('change', handleBehaviorChange);
    delayMin.addEventListener('input', handleBehaviorChange);
    delayMax.addEventListener('input', handleBehaviorChange);
    delayUnitRandom.addEventListener('change', handleBehaviorChange);
    pauseDuration.addEventListener('input', handleBehaviorChange);
    pauseEvery.addEventListener('input', handleBehaviorChange);
    filterPhone.addEventListener('change', saveState);
    filterEmail.addEventListener('change', saveState);
    filterSocial.addEventListener('change', saveState);

    function renderSenderProgress(state) {
        if (!senderProgressCard) return;
        const total = Math.max(0, Number(state && state.totalQueueSize) || 0);
        const success = Math.max(0, Number(state && state.successCount) || 0);
        const errors = Math.max(0, Number(state && state.errorCount) || 0);
        const processed = Math.min(total || success + errors, Math.max(0, Number(state && state.processedCount) || success + errors));
        const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
        const batches = Array.isArray(state && state.batches) ? state.batches : [];
        const active = Boolean(state && state.isProcessing);
        const stopped = !active && total > 0 && processed < total && batches.some(batch => batch.status === 'stopped');
        const completed = !active && total > 0 && processed >= total;

        senderProgressCard.classList.toggle('is-active', active);
        senderProgressCard.classList.toggle('is-completed', completed);
        senderProgressCard.classList.toggle('has-errors', errors > 0);
        const statusKey = active
            ? (state.isTaskInFlight ? 'senderProgressSending' : 'senderProgressWaiting')
            : completed ? 'senderProgressCompleted' : stopped ? 'senderProgressStopped' : 'senderProgressReady';
        senderProgressStatus.innerHTML = `<i></i><span>${t(statusKey)}</span>`;
        senderProgressPercent.textContent = `${percent}%`;
        senderProgressBar.style.width = `${percent}%`;
        senderProgressText.textContent = t('senderProgressCount', { processed, total, success, errors });
        senderCurrentBatch.textContent = active && state.currentBatchName
            ? t('senderProgressCurrentList', { name: state.currentBatchName })
            : completed ? t('senderProgressAllDone') : stopped ? t('senderProgressStoppedDetail') : t('senderProgressNoList');

        senderBatchProgress.innerHTML = '';
        batches.forEach((batch, index) => {
            const chip = document.createElement('span');
            chip.className = `sender-batch-chip ${batch.status || 'queued'}`;
            const batchProcessed = Math.max(0, Number(batch.success) || 0) + Math.max(0, Number(batch.error) || 0);
            chip.textContent = `${index + 1}. ${batch.name || t('campaignUnnamed')} · ${batchProcessed}/${Number(batch.total) || 0}`;
            chip.title = chip.textContent;
            senderBatchProgress.appendChild(chip);
        });
    }

    function updateUI() {
        chrome.runtime.sendMessage({ action: 'get_state' }, (res) => {
            if (chrome.runtime.lastError || !res) return;

            const queueLockChanged = !latestSenderState || Boolean(latestSenderState.isProcessing) !== Boolean(res.isProcessing);
            latestSenderState = res;
            sentCount.innerText = res.successCount;
            errCount.innerText = res.errorCount;
            updateBehaviorSummary(res);
            renderSenderProgress(res);
            if (queueLockChanged) renderSenderListQueue();

            if (res.isProcessing) {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'flex';
                phoneInput.disabled = true;
                btnAddPhone.disabled = true;
                btnUploadCsv.disabled = true;
                messageInput.disabled = true;
                delayValue.disabled = true;
                delayUnit.disabled = true;
                useRandomDelay.disabled = true;
                delayMin.disabled = true;
                delayMax.disabled = true;
                delayUnitRandom.disabled = true;
                usePause.disabled = true;
                pauseDuration.disabled = true;
                pauseEvery.disabled = true;
                btnAttach.disabled = true;
                btnRemoveAttach.disabled = true;
                btnRecordAudio.disabled = true;
                btnStopRecord.disabled = true;
                btnRemoveAudio.disabled = true;
                if (btnUploadAudio) btnUploadAudio.disabled = true;
                if (microphoneSelect) microphoneSelect.disabled = true;
                if (btnRefreshMicrophones) btnRefreshMicrophones.disabled = true;
                tabText.disabled = true;
                tabAudio.disabled = true;
                if (senderSavedListSelect) senderSavedListSelect.disabled = true;
                if (btnQueueSavedList) btnQueueSavedList.disabled = true;
            } else {
                startBtn.style.display = 'flex';
                stopBtn.style.display = 'none';
                phoneInput.disabled = false;
                btnAddPhone.disabled = false;
                btnUploadCsv.disabled = false;
                messageInput.disabled = false;
                delayValue.disabled = false;
                delayUnit.disabled = false;
                useRandomDelay.disabled = false;
                delayMin.disabled = false;
                delayMax.disabled = false;
                delayUnitRandom.disabled = false;
                usePause.disabled = false;
                pauseDuration.disabled = false;
                pauseEvery.disabled = false;
                btnAttach.disabled = false;
                btnRemoveAttach.disabled = false;
                btnRecordAudio.disabled = false;
                btnStopRecord.disabled = false;
                btnRemoveAudio.disabled = false;
                if (btnUploadAudio) btnUploadAudio.disabled = false;
                if (microphoneSelect) microphoneSelect.disabled = false;
                if (btnRefreshMicrophones) btnRefreshMicrophones.disabled = false;
                tabText.disabled = false;
                tabAudio.disabled = false;
                if (senderSavedListSelect) senderSavedListSelect.disabled = false;
                renderSenderSavedListOptions();
                checkReady();
            }
        });
    }

    setInterval(updateUI, 1000);
    updateUI();

    function resolveSpintax(input, randomSource = Math.random) {
        let output = String(input || '');
        const groupPattern = /\{([^{}]*\|[^{}]*)\}/g;
        let passes = 0;
        while (passes < 20 && groupPattern.test(output)) {
            groupPattern.lastIndex = 0;
            output = output.replace(groupPattern, (_match, content) => {
                const options = content.split('|');
                const index = Math.min(options.length - 1, Math.floor(randomSource() * options.length));
                return options[Math.max(0, index)];
            });
            passes++;
            groupPattern.lastIndex = 0;
        }
        return output;
    }

    function renderSpintaxPreview() {
        if (!templateSpintaxPreview) return;
        const source = newTemplateText.value.trim();
        if (!source) {
            templateSpintaxPreview.textContent = t('templatesPreviewEmpty');
            templateSpintaxPreview.classList.add('is-empty');
            return;
        }
        const variants = [...new Set(Array.from({ length: 5 }, () => resolveSpintax(source)))].slice(0, 3);
        templateSpintaxPreview.innerHTML = '';
        templateSpintaxPreview.classList.remove('is-empty');
        variants.forEach((variant, index) => {
            const row = document.createElement('div');
            const label = document.createElement('strong');
            label.textContent = `${t('templatesVariant')} ${index + 1}`;
            const text = document.createElement('span');
            text.textContent = variant;
            row.append(label, text);
            templateSpintaxPreview.appendChild(row);
        });
    }

    if (btnRefreshSpintaxPreview) btnRefreshSpintaxPreview.addEventListener('click', renderSpintaxPreview);
    if (newTemplateText) newTemplateText.addEventListener('input', renderSpintaxPreview);

    function buildSenderDispatchGroups(message) {
        const availablePhones = new Set(phoneList.map(phone => normalizePhoneForSender(phone)).filter(Boolean));
        const usedPhones = new Set();
        const groups = [];
        const makeTask = contact => ({
            phone: contact.phone,
            message: currentMode === 'text' && message ? resolveSpintax(message) : '',
            name: contact.name || contact.phone
        });

        senderListQueue.forEach((item, index) => {
            const contacts = compactSenderQueueContacts(item.contacts).filter(contact => {
                if (!availablePhones.has(contact.phone) || usedPhones.has(contact.phone)) return false;
                usedPhones.add(contact.phone);
                return true;
            });
            if (!contacts.length) return;
            groups.push({
                id: String(item.queueId || `saved_${index + 1}`),
                name: item.name || item.sourceName || t('campaignUnnamed'),
                sourceListId: item.sourceListId || '',
                sourceName: item.sourceName || item.name || '',
                contacts,
                tasks: contacts.map(makeTask)
            });
        });

        const manualContacts = phoneList.map(phone => normalizePhoneForSender(phone)).filter(phone => phone && !usedPhones.has(phone)).map(phone => {
            const metadata = senderCampaignContext && senderCampaignContext.contacts
                ? senderCampaignContext.contacts[phone]
                : null;
            return {
                phone,
                name: metadata && metadata.name ? metadata.name : phone,
                email: metadata && metadata.email ? metadata.email : '',
                website: metadata && metadata.website ? metadata.website : ''
            };
        });
        if (manualContacts.length) {
            const manualName = groups.length ? t('senderManualCampaign') : (senderCampaignContext && senderCampaignContext.name ? senderCampaignContext.name : t('senderManualCampaign'));
            groups.push({
                id: `manual_${Date.now()}`,
                name: manualName,
                sourceListId: '',
                sourceName: t('senderManualSource'),
                contacts: manualContacts,
                tasks: manualContacts.map(makeTask)
            });
        }
        return groups;
    }

    startBtn.addEventListener('click', () => {
        if (startBtn.disabled) return;
        let msg = '';
        let audio = null;
        if (currentMode === 'text') msg = messageInput.value.trim();
        else if (currentMode === 'audio') audio = currentAudio;

        const delay = buildDelayConfig(true);
        const groups = buildSenderDispatchGroups(msg);
        const queue = groups.flatMap(group => group.tasks);
        const pauseConfig = buildPauseConfig(true);
        const campaignMeta = {
            name: groups[0] ? groups[0].name : '',
            sourceListId: groups[0] ? groups[0].sourceListId : '',
            sourceName: groups[0] ? groups[0].sourceName : '',
            contacts: groups[0] ? groups[0].contacts : []
        };
        updateBehaviorSummary();
        saveState();
        showToast(t('senderStartingBackground'), 'info');

        chrome.runtime.sendMessage({
            action: 'start', queue, groups, delay, pauseConfig,
            attachment: currentAttachment, audio, campaignMeta
        }, (res) => {
            if (res && res.status === 'started') {
                updateUI();
                refreshFollowupCampaigns();
            } else {
                showToast(t('senderStartError'), 'error');
            }
        });
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stop' }, () => {
            updateUI();
        });
    });
    // ==========================================
    // LÓGICA DE MODELOS DE MENSAGEM (TEMPLATES)
    // ==========================================
    function saveTemplates() {
        chrome.storage.local.set({ savedTemplates: messageTemplates });
        renderTemplatesList();
        renderTemplateSelect();
    }

    function renderTemplatesList() {
        if (dashTemplateCount) dashTemplateCount.textContent = messageTemplates.length;
        if (messageTemplates.length === 0) {
            templatesList.innerHTML = '';
            templatesList.appendChild(makeDashboardEmpty('fas fa-message', t('templatesEmpty'), t('templatesEmptyDescription')));
        } else {
            templatesList.innerHTML = '';
            messageTemplates.forEach((tpl) => {
                const item = document.createElement('div');
                item.className = 'template-item';

                const info = document.createElement('div');
                info.className = 'template-info';

                const name = document.createElement('div');
                name.className = 'template-name';
                name.innerText = tpl.name;

                const preview = document.createElement('div');
                preview.className = 'template-preview';

                if (tpl.text) {
                    const textSpan = document.createElement('span');
                    textSpan.innerText = tpl.text.length > 115 ? tpl.text.substring(0, 115) + '…' : tpl.text;
                    preview.appendChild(textSpan);
                }

                if (tpl.attachment) {
                    const badge = document.createElement('small');
                    badge.innerHTML = `<i class="fas fa-paperclip"></i> ${t('templatesWithAttachment')}`;
                    preview.appendChild(badge);
                }

                info.appendChild(name);
                info.appendChild(preview);

                const actions = document.createElement('div');
                actions.className = 'template-actions';

                const btnUse = document.createElement('button');
                btnUse.className = 'use';
                btnUse.title = t('templatesUse');
                btnUse.innerHTML = '<i class="fas fa-paper-plane"></i>';
                btnUse.onclick = () => applyTemplateToSender(tpl, true);

                const btnEdit = document.createElement('button');
                btnEdit.className = 'edit';
                btnEdit.title = t('templatesEdit');
                btnEdit.innerHTML = '<i class="fas fa-pen"></i>';
                btnEdit.onclick = () => beginTemplateEdit(tpl);

                const btnDelete = document.createElement('button');
                btnDelete.className = 'delete';
                btnDelete.title = t('templatesDelete');
                btnDelete.innerHTML = '<i class="fas fa-trash"></i>';
                btnDelete.onclick = () => {
                    if(confirm(t('templatesDeleteConfirm'))) {
                        messageTemplates = messageTemplates.filter(t => t.id !== tpl.id);
                        saveTemplates();
                        if (templateSelect.value === tpl.id) {
                            templateSelect.value = '';
                        }
                        if (editingTemplateId === tpl.id) resetTemplateForm();
                    }
                };

                actions.append(btnUse, btnEdit, btnDelete);

                item.appendChild(info);
                item.appendChild(actions);
                templatesList.appendChild(item);
            });
        }
    }

    function renderTemplateSelect() {
        const val = templateSelect.value;
        templateSelect.innerHTML = '';
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = t('templatesSelectOptional');
        templateSelect.appendChild(emptyOption);
        if (messageTemplates.length > 0) {
            templateSelect.style.display = 'block';
            messageTemplates.forEach(tpl => {
                const opt = document.createElement('option');
                opt.value = tpl.id;
                opt.innerText = tpl.name;
                templateSelect.appendChild(opt);
            });
            if (messageTemplates.find(t => t.id === val)) {
                templateSelect.value = val;
            }
        } else {
            templateSelect.style.display = 'none';
        }
    }

    function applyTemplateToSender(template, navigate = false) {
        messageInput.value = template.text || '';
        currentAttachment = template.attachment || null;
        if (currentAttachment) {
            renderAttachmentPreview(currentAttachment, attachmentName, t('noAttachment'));
            btnRemoveAttach.style.display = 'inline-block';
        } else {
            renderAttachmentPreview(null, attachmentName, t('noAttachment'));
            btnRemoveAttach.style.display = 'none';
            attachmentInput.value = '';
        }
        templateSelect.value = template.id;
        setMode('text');
        saveState();
        checkReady();
        if (navigate) {
            navSender.click();
            showToast(t('templatesApplied'), 'success');
        }
    }

    function beginTemplateEdit(template) {
        editingTemplateId = template.id;
        newTemplateName.value = template.name || '';
        newTemplateText.value = template.text || '';
        currentTemplateAttachment = template.attachment || null;
        renderAttachmentPreview(currentTemplateAttachment, templateAttachmentName, t('noAttachment'));
        btnRemoveTemplateAttach.style.display = currentTemplateAttachment ? 'inline-block' : 'none';
        btnCancelTemplateEdit.style.display = 'inline-flex';
        btnSaveTemplate.querySelector('span').textContent = t('templatesUpdate');
        renderSpintaxPreview();
        newTemplateName.focus();
    }

    function resetTemplateForm() {
        editingTemplateId = null;
        newTemplateName.value = '';
        newTemplateText.value = '';
        currentTemplateAttachment = null;
        templateAttachmentInput.value = '';
        renderAttachmentPreview(null, templateAttachmentName, t('noAttachment'));
        btnRemoveTemplateAttach.style.display = 'none';
        btnCancelTemplateEdit.style.display = 'none';
        btnSaveTemplate.querySelector('span').textContent = t('templatesSave');
        renderSpintaxPreview();
    }

    btnCancelTemplateEdit.addEventListener('click', resetTemplateForm);

    btnAttachTemplate.addEventListener('click', () => {
        templateAttachmentInput.click();
    });

    templateAttachmentInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast(t('templatesFileTooLarge'), 'error');
            templateAttachmentInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            currentTemplateAttachment = {
                name: file.name,
                type: file.type,
                data: evt.target.result
            };
            renderAttachmentPreview(currentTemplateAttachment, templateAttachmentName, t('noAttachment'));
            btnRemoveTemplateAttach.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    });

    btnRemoveTemplateAttach.addEventListener('click', () => {
        currentTemplateAttachment = null;
        templateAttachmentInput.value = '';
        renderAttachmentPreview(null, templateAttachmentName, t('noAttachment'));
        btnRemoveTemplateAttach.style.display = 'none';
    });

    btnSaveTemplate.addEventListener('click', () => {
        const name = newTemplateName.value.trim();
        const text = newTemplateText.value.trim();

        if (!name) {
            showToast(t('templatesNameRequired'), 'error');
            return;
        }
        if (!text && !currentTemplateAttachment) {
            showToast(t('templatesContentRequired'), 'error');
            return;
        }

        const templateData = {
            id: editingTemplateId || `tpl_${Date.now()}`,
            name: name,
            text: text,
            attachment: currentTemplateAttachment,
            updatedAt: Date.now()
        };
        if (editingTemplateId) {
            const index = messageTemplates.findIndex(template => template.id === editingTemplateId);
            if (index >= 0) messageTemplates[index] = { ...messageTemplates[index], ...templateData };
            else messageTemplates.unshift(templateData);
        } else {
            templateData.createdAt = Date.now();
            messageTemplates.unshift(templateData);
        }
        saveTemplates();
        const wasEditing = Boolean(editingTemplateId);
        resetTemplateForm();
        showToast(t(wasEditing ? 'templatesUpdatedToast' : 'templatesSavedToast'), 'success');
    });

    templateSelect.addEventListener('change', (e) => {
        const tplId = e.target.value;
        if (tplId) {
            const tpl = messageTemplates.find(t => t.id === tplId);
            if (tpl) applyTemplateToSender(tpl, false);
        } else {
            // Limpa tudo caso selecione a opção em branco
            messageInput.value = '';
            currentAttachment = null;
            renderAttachmentPreview(null, attachmentName, t('noAttachment'));
            btnRemoveAttach.style.display = 'none';
            attachmentInput.value = '';
            saveState();
        }
    });

    // ==========================================
    // LÓGICA DAS ABAS (EXTRATOR, DISPARADOR E DASHBOARD)
    // ==========================================
    const navExtractor = document.getElementById('navExtractor');
    const navSender = document.getElementById('navSender');
    const viewExtractor = document.getElementById('viewExtractor');
    const viewSender = document.getElementById('viewSender');
    const viewDashboard = document.getElementById('viewDashboard');
    let previousMainView = 'extractor';

    function showMainView(view) {
        const isDashboard = view === 'dashboard';
        viewExtractor.style.display = view === 'extractor' ? 'block' : 'none';
        viewSender.style.display = view === 'sender' ? 'block' : 'none';
        viewDashboard.style.display = isDashboard ? 'block' : 'none';
        navExtractor.classList.toggle('active', view === 'extractor');
        navSender.classList.toggle('active', view === 'sender');
        btnDashboard.classList.toggle('active', isDashboard);
        if (!isDashboard) previousMainView = view;
        if (isDashboard && typeof refreshDashboardState === 'function') refreshDashboardState();
        chrome.storage.local.set({ savedMainView: view });
    }

    navExtractor.addEventListener('click', () => {
        showMainView('extractor');
    });

    navSender.addEventListener('click', () => {
        showMainView('sender');
    });

    btnDashboard.addEventListener('click', () => showMainView('dashboard'));

    // --- TRADUÇÃO (i18n) ---
    const translations = {
        pt: {
            navExtractor: "1. Extrator",
            navSender: "2. Disparador",
            titleExtract: "Buscar Leads no Google Maps",
            helpText1: "1. Digite o que deseja buscar (ex: Dentistas em São Paulo).",
            placeholderSearch: "Ex: Dentistas em São Paulo",
            helpText2: "2. Ajuste os filtros e clique em \"Buscar Leads\":",
            filterNoWebsite: "Ignorar perfis que possuem site",
            filterPhone: "Exigir telefone",
            filterEmail: "Exigir e-mail",
            filterSocial: "Exigir redes sociais",
            enrichmentPermissionExplanation: "Para procurar e-mails e redes que não aparecem no Maps, o GeoLead precisa ler os sites públicos dos estabelecimentos durante esta função. Como os domínios variam, o Chrome mostrará uma permissão ampla. Deseja continuar?",
            enrichmentPermissionDenied: "Permissão não concedida. A extração continuará apenas com os dados visíveis no Google Maps.",
            enrichmentPermissionUnavailable: "Este Chrome não disponibilizou a permissão para consultar os sites públicos.",
            enrichmentPermissionGranted: "Busca complementar em sites públicos ativada.",
            enrichmentDisabledLog: "Busca em sites não autorizada · filtros de e-mail/redes usarão somente o que estiver visível no Maps.",
            autoSendAfter: "Começar disparo automático ao terminar",
            btnStartExtract: "Buscar Leads",
            btnStopExtract: "Parar",
            terminalWait: "Pronto. Aguardando comando...",
            btnDownloadCsv: "Baixar CSV",
            btnSendToSender: "Enviar p/ Disparador",
            titleContacts: "Contatos",
            titleImport: "Importar Lista, CSV ou Excel",
            btnImport: "Importar",
            placeholderPhone: "Número (e aperte Enter)",
            emptyContacts: "Nenhum contato adicionado",
            titleMessage: "Mensagem",
            tabText: "Texto",
            tabAudio: "Áudio",
            placeholderMessage: "Escreva sua mensagem...",
            tipSpintax: "Use {Oi|Olá} para alternar palavras automaticamente a cada envio.",
            btnAttach: "Anexar",
            noAttachment: "Nenhum anexo selecionado",
            btnRecord: "Gravar Áudio",
            btnStopRecord: "Parar Gravação",
            tipAudio: "O áudio será enviado como se tivesse sido gravado na hora!",
            msgWarning: "Você precisa definir uma mensagem de texto ou um áudio.",
            delayLabel: "Intervalo de Envio",
            useRandomDelay: "Usar variação aleatória de tempo",
            minLabel: "Mín:",
            maxLabel: "Máx:",
            usePause: "Pausar envios (simular comportamento humano)",
            pauseText1: "Pausar",
            pauseText2: "min a cada",
            pauseText3: "msgs",
            btnStartSend: "Iniciar Disparos",
            btnStopSend: "Parar",
            statSent: "Enviados",
            statErrors: "Falhas",
            seconds: "segundos",
            minutes: "minutos",
            dashKicker: "Visão da extração",
            dashTitle: "Dashboard de leads",
            dashNoSearch: "Nenhuma busca registrada ainda",
            dashBack: "Voltar",
            dashCurrentTab: "Extração atual",
            dashListsTab: "Listas salvas",
            dashTemplatesTab: "Modelos",
            dashCampaignsTab: "Campanhas",
            dashReady: "Pronto para extrair",
            dashZeroProfiles: "0 perfis analisados",
            dashWaitingMaps: "Aguardando uma busca no Google Maps",
            dashPause: "Pausar extração",
            dashResume: "Retomar extração",
            dashStop: "Encerrar",
            dashLeadsExtracted: "leads extraídos",
            dashWithPhone: "com telefone",
            dashWithEmail: "com e-mail",
            dashWithoutSite: "sem site",
            dashContactsFound: "Contatos encontrados",
            dashDownloadCsv: "Baixar CSV",
            dashSendContacts: "Enviar contatos ao disparador",
            dashSearchPlaceholder: "Buscar por nome, telefone ou e-mail",
            dashLeadColumn: "Lead",
            dashContactColumn: "Contato",
            dashStatusColumn: "Status",
            statusPaused: "Extração pausada",
            statusFiltering: "Aplicando filtros",
            statusCollected: "Lead adicionado",
            statusAnalyzing: "Analisando perfil",
            statusDiscovering: "Descobrindo perfis",
            statusRunning: "Varredura em andamento",
            statusCompleted: "Extração concluída",
            statusStopped: "Extração encerrada",
            statusError: "Extração com erro",
            statusReady: "Pronto para extrair",
            profilesTarget: "{processed} perfis analisados · {collected} de {target} leads",
            profilesMaximum: "{processed} perfis analisados · {collected} extraídos · {discovered} descobertos",
            scanning: "Varrendo…",
            progressUnknownTitle: "O total depende de quantos resultados o Google Maps disponibilizar.",
            progressTargetTitle: "Progresso calculado sobre a meta de leads escolhida.",
            searchPrefix: "Busca: {query}",
            recordsOne: "1 registro",
            recordsMany: "{count} registros",
            noSearchResults: "Nenhum resultado para esta busca",
            noLeads: "Nenhum lead extraído",
            searchTryAgain: "Tente buscar por outro nome, telefone ou e-mail.",
            extractToFill: "Inicie uma extração no Google Maps para preencher esta lista.",
            nameNotIdentified: "Nome não identificado",
            profileMaps: "Perfil do Google Maps",
            noPhone: "Sem telefone",
            noEmail: "Sem e-mail",
            noSite: "Sem site",
            withSite: "Com site",
            listsLibraryTitle: "Biblioteca de contatos",
            listsLibraryDescription: "Nomeie, consulte, baixe ou combine extrações.",
            listsMergeSelected: "Mesclar selecionadas",
            listsEmpty: "Nenhuma lista salva",
            listsEmptyDescription: "Ao concluir uma extração, use “Salvar como lista”.",
            listUnnamed: "Lista sem nome",
            listMetadata: "{contacts} contatos · {phones} telefones · {date}",
            dateNotInformed: "data não informada",
            selectList: "Selecionar {name}",
            viewContacts: "Ver contatos",
            downloadThisList: "Baixar esta lista",
            useInSender: "Usar no Disparador",
            deleteList: "Excluir lista",
            deleteListConfirm: "Excluir a lista “{name}”?",
            contactHeader: "CONTATO",
            qualificationHeader: "QUALIFICAÇÃO",
            listDeleted: "Lista excluída.",
            saveListsError: "Não foi possível salvar as listas de contatos.",
            noContactsToSave: "Não há contatos para salvar.",
            modalMergeKicker: "Mesclar listas",
            modalSaveKicker: "Salvar extração",
            modalMergeTitle: "Nomeie a lista combinada",
            modalSaveTitle: "Dê um nome para esta lista",
            modalMergeDescription: "{count} contatos únicos serão reunidos sem alterar as listas originais.",
            modalSaveDescription: "{count} contatos ficarão disponíveis para consulta, download e mesclagem.",
            modalMergeConfirm: "Criar lista mesclada",
            modalSaveConfirm: "Salvar lista",
            modalNameRequired: "Digite um nome para a lista.",
            listNamePlaceholder: "Ex: Dentistas de Curitiba · Agosto",
            modalCancel: "Cancelar",
            mergedListsDefault: "Listas mescladas",
            defaultMapsLeads: "Leads do Google Maps",
            noValidPhone: "Nenhum telefone válido encontrado.",
            contactsSent: "{count} contatos válidos foram enviados para o Disparador!",
            completionSummary: "{leads} leads únicos · {phones} telefones prontos para usar.",
            dashboardActionError: "Não foi possível alterar a extração atual.",
            dashboardStopping: "Encerrando a extração com segurança…",
            dashboardNoActiveExtraction: "Não há uma extração ativa.",
            mergedListCreated: "Lista mesclada criada.",
            dashboardListSaved: "Lista salva no dashboard.",
            templatesCreateTitle: "Criar modelo de mensagem",
            templatesCreateDescription: "Cadastre textos com Spintax e anexos para reutilizar no Disparador.",
            templatesNameLabel: "Nome do modelo",
            templatesNamePlaceholder: "Ex: Prospecção de dentistas",
            templatesMessageLabel: "Mensagem",
            templatesMessagePlaceholder: "Escreva a mensagem do modelo...",
            templatesSpintaxHelp: "Spintax funcional:",
            templatesSpintaxExample: "use {Oi|Olá} para variar cada envio.",
            templatesGeneratePreview: "Gerar exemplos",
            templatesPreviewEmpty: "As variações da mensagem aparecerão aqui.",
            templatesVariant: "Variação",
            templatesAttach: "Anexar imagem ou documento",
            templatesCancelEdit: "Cancelar edição",
            templatesSave: "Salvar modelo",
            templatesUpdate: "Atualizar modelo",
            templatesSavedTitle: "Modelos salvos",
            templatesSavedDescription: "Use, edite ou exclua seus modelos cadastrados.",
            templatesEmpty: "Nenhum modelo salvo",
            templatesEmptyDescription: "Crie o primeiro modelo no formulário acima.",
            templatesWithAttachment: "Com anexo",
            templatesUse: "Usar no Disparador",
            templatesEdit: "Editar modelo",
            templatesDelete: "Excluir modelo",
            templatesDeleteConfirm: "Deseja excluir este modelo?",
            templatesSelectOptional: "Selecione um modelo (opcional)...",
            templatesApplied: "Modelo aplicado ao Disparador.",
            templatesFileTooLarge: "Selecione um arquivo menor que 5 MB.",
            templatesNameRequired: "Dê um nome para o modelo.",
            templatesContentRequired: "O modelo precisa ter uma mensagem ou um anexo.",
            templatesSavedToast: "Modelo salvo com sucesso!",
            templatesUpdatedToast: "Modelo atualizado com sucesso!",
            trialLabel: "Período de teste",
            trialExpiredShort: "Expirado",
            trialBuyTitle: "Gerenciar licença na Kiwify",
            senderQueueTitle: "Fila de listas",
            senderQueueDescription: "Cada lista vira uma campanha e será processada na ordem abaixo.",
            senderQueueSelect: "Selecione uma lista salva…",
            senderQueueAdd: "Adicionar",
            senderQueueEmpty: "Nenhuma lista na fila. Você também pode usar contatos manuais.",
            senderQueueContacts: "{count} contatos nesta campanha",
            senderQueueMoveUp: "Mover campanha para cima",
            senderQueueMoveDown: "Mover campanha para baixo",
            senderQueueRemove: "Remover campanha da fila",
            senderQueueAlreadyAdded: "Esta lista já está na fila de campanhas.",
            senderQueueAdded: "“{name}” adicionada à fila com {count} contatos.",
            senderManualCampaign: "Contatos manuais",
            senderManualSource: "Entrada manual ou arquivo importado",
            senderProgressReady: "Pronto para iniciar",
            senderProgressSending: "Enviando contato",
            senderProgressWaiting: "Aguardando próximo envio",
            senderProgressCompleted: "Disparo concluído",
            senderProgressStopped: "Disparo interrompido",
            senderProgressCount: "{processed} de {total} contatos · {success} enviados · {errors} falhas",
            senderProgressCurrentList: "Campanha atual: {name}",
            senderProgressAllDone: "Todas as campanhas da fila foram concluídas",
            senderProgressStoppedDetail: "A fila foi interrompida antes do fim",
            senderProgressNoList: "Nenhuma campanha em execução",
            senderStartingBackground: "Disparo iniciado. O WhatsApp Web será aberto em segundo plano quando necessário.",
            senderStartError: "Não foi possível iniciar o disparo.",
            campaignsTitle: "Campanhas e follow-ups",
            campaignsDescription: "Programe tentativas adicionais e pare automaticamente quando houver resposta.",
            campaignsRefresh: "Atualizar campanhas",
            campaignsSafetyNote: "O Chrome retoma prazos vencidos ao abrir. Antes de cada follow-up, o GeoLead abre a conversa e verifica se o contato respondeu.",
            campaignsEmpty: "Nenhuma campanha ainda",
            campaignsEmptyDescription: "O próximo disparo iniciado aparecerá aqui para você configurar os follow-ups.",
            campaignUnnamed: "Campanha sem nome",
            campaignMetadata: "{contacts} contatos · criada em {date}",
            campaignStatusActive: "Ativa",
            campaignStatusPaused: "Pausada",
            campaignStatusCompleted: "Concluída",
            campaignStatusConfigure: "Configurar",
            campaignStatusLogin: "Conectar WhatsApp",
            campaignStatusReview: "Revisar",
            campaignMetricSent: "envio inicial",
            campaignMetricWaiting: "aguardando",
            campaignMetricReplied: "responderam",
            campaignMetricReview: "revisar",
            campaignLoginNeeded: "Abra o WhatsApp Web e conecte sua conta. A campanha tentará novamente depois.",
            campaignNextRun: "Próximo processamento: {date}",
            campaignConfigureHint: "O envio inicial foi registrado. Configure os follow-ups desta campanha.",
            campaignNoPending: "Nenhum follow-up pendente.",
            campaignEditPlan: "Editar plano",
            campaignConfigure: "Configurar follow-ups",
            campaignViewContacts: "Ver contatos da campanha",
            campaignResume: "Retomar campanha",
            campaignPause: "Pausar campanha",
            campaignDelete: "Excluir campanha",
            campaignDeleteConfirm: "Excluir a campanha “{name}” e seus agendamentos?",
            campaignDeleted: "Campanha excluída.",
            campaignRetryContact: "Revisado: tentar novamente",
            campaignContactRetried: "Contato recolocado na fila com segurança.",
            contactStatusInitialQueue: "Envio inicial na fila",
            contactStatusAwaitingPlan: "Aguardando plano",
            contactStatusWaiting: "Aguardando prazo",
            contactStatusChecking: "Verificando resposta",
            contactStatusReplied: "Respondeu · cancelado",
            contactStatusCompleted: "Sequência concluída",
            contactStatusInitialFailed: "Falha no envio inicial",
            contactStatusInitialCancelled: "Envio inicial cancelado",
            contactStatusReview: "Revisão necessária",
            followupModalKicker: "AUTOMAÇÃO SEGURA",
            followupModalDescription: "Escolha até três modelos de texto. Cada prazo começa após o último envio confirmado.",
            followupWait: "Aguardar",
            followupUnit: "Unidade",
            followupDays: "dias",
            followupHours: "horas",
            followupTemplate: "Modelo",
            followupBusinessHours: "Respeitar horário de envio",
            followupFrom: "Das",
            followupTo: "Até",
            followupWeekends: "Incluir fins de semana",
            followupConfirmation: "Revisei destinatários, modelos e horários desta campanha.",
            followupActivate: "Ativar follow-ups",
            followupSelectTemplate: "Selecione um modelo...",
            followupNeedsTemplate: "Crie ao menos um modelo de texto antes de configurar follow-ups.",
            followupConfirmRequired: "Confirme que revisou os destinatários, modelos e horários.",
            followupInvalidHours: "O horário final precisa ser posterior ao horário inicial.",
            followupSelectAllTemplates: "Escolha um modelo de texto para cada etapa ativa.",
            followupOneStepRequired: "Ative pelo menos uma etapa de follow-up.",
            followupSaveError: "Não foi possível salvar a configuração de follow-up.",
            followupActivated: "Follow-ups ativados. Os prazos continuarão válidos após reiniciar o Chrome.",
            microphoneLabel: "Microfone",
            microphoneDefault: "Padrão do sistema",
            microphoneRefresh: "Atualizar microfones",
            microphoneApiUnavailable: "A gravação de microfone não está disponível neste navegador.",
            microphoneNotFound: "Nenhum microfone ativo foi encontrado. Verifique o Windows, conecte ou habilite o dispositivo e tente novamente.",
            microphoneListError: "Não foi possível atualizar a lista de microfones.",
            microphonePermissionDenied: "O acesso ao microfone foi bloqueado. Libere a permissão na página aberta.",
            microphoneBusy: "O microfone está ocupado ou indisponível para o Chrome.",
            microphoneAccessError: "Não foi possível acessar o microfone:",
            behaviorFixed: "Intervalo fixo de {value} {unit}.",
            behaviorRandom: "Intervalo aleatório de {min} a {max} {unit}.",
            behaviorPause: "Pausa humana de {duration} min a cada {every} mensagens.",
            behaviorWaitingDelay: "Próximo envio em aproximadamente {seconds}s.",
            behaviorWaitingPause: "Pausa humana ativa: retorno em aproximadamente {seconds}s."
        },
        en: {
            navExtractor: "1. Extractor",
            navSender: "2. Sender",
            titleExtract: "Search Leads on Google Maps",
            helpText1: "1. Type what you want to search (e.g. Dentists in New York).",
            placeholderSearch: "Ex: Dentists in New York",
            helpText2: "2. Adjust the filters and click \"Search Leads\":",
            filterNoWebsite: "Ignore profiles that have a website",
            filterPhone: "Require phone",
            filterEmail: "Require email",
            filterSocial: "Require social media",
            enrichmentPermissionExplanation: "To find emails and social profiles that are not shown in Maps, GeoLead needs to read each business's public website for this feature. Since domains vary, Chrome will display a broad permission. Continue?",
            enrichmentPermissionDenied: "Permission was not granted. Extraction will continue using only data visible in Google Maps.",
            enrichmentPermissionUnavailable: "This Chrome version did not make public website permission available.",
            enrichmentPermissionGranted: "Public website enrichment enabled.",
            enrichmentDisabledLog: "Website search not authorized · email/social filters will only use what is visible on Maps.",
            autoSendAfter: "Start automatic sending when finished",
            btnStartExtract: "Search Leads",
            btnStopExtract: "Stop",
            terminalWait: "Ready. Waiting for command...",
            btnDownloadCsv: "Download CSV",
            btnSendToSender: "Send to Sender",
            titleContacts: "Contacts",
            titleImport: "Import List, CSV or Excel",
            btnImport: "Import",
            placeholderPhone: "Number (and press Enter)",
            emptyContacts: "No contacts added",
            titleMessage: "Message",
            tabText: "Text",
            tabAudio: "Audio",
            placeholderMessage: "Write your message...",
            tipSpintax: "Use {Hi|Hello} to alternate words automatically on each send.",
            btnAttach: "Attach",
            noAttachment: "No attachment selected",
            btnRecord: "Record Audio",
            btnStopRecord: "Stop Recording",
            tipAudio: "The audio will be sent as if it was recorded right now!",
            msgWarning: "You need to define a text message or an audio.",
            delayLabel: "Sending Interval",
            useRandomDelay: "Use random time variation",
            minLabel: "Min:",
            maxLabel: "Max:",
            usePause: "Pause sending (simulate human behavior)",
            pauseText1: "Pause",
            pauseText2: "min every",
            pauseText3: "msgs",
            btnStartSend: "Start Sending",
            btnStopSend: "Stop",
            statSent: "Sent",
            statErrors: "Failed",
            seconds: "seconds",
            minutes: "minutes",
            dashKicker: "Extraction overview",
            dashTitle: "Lead dashboard",
            dashNoSearch: "No search recorded yet",
            dashBack: "Back",
            dashCurrentTab: "Current extraction",
            dashListsTab: "Saved lists",
            dashTemplatesTab: "Message templates",
            dashCampaignsTab: "Campaigns",
            dashReady: "Ready to extract",
            dashZeroProfiles: "0 profiles analyzed",
            dashWaitingMaps: "Waiting for a Google Maps search",
            dashPause: "Pause extraction",
            dashResume: "Resume extraction",
            dashStop: "Stop",
            dashLeadsExtracted: "leads extracted",
            dashWithPhone: "with phone",
            dashWithEmail: "with email",
            dashWithoutSite: "without website",
            dashContactsFound: "Contacts found",
            dashDownloadCsv: "Download CSV",
            dashSendContacts: "Send contacts to Sender",
            dashSearchPlaceholder: "Search by name, phone or email",
            dashLeadColumn: "Lead",
            dashContactColumn: "Contact",
            dashStatusColumn: "Status",
            statusPaused: "Extraction paused",
            statusFiltering: "Applying filters",
            statusCollected: "Lead added",
            statusAnalyzing: "Analyzing profile",
            statusDiscovering: "Discovering profiles",
            statusRunning: "Scanning in progress",
            statusCompleted: "Extraction completed",
            statusStopped: "Extraction stopped",
            statusError: "Extraction error",
            statusReady: "Ready to extract",
            profilesTarget: "{processed} profiles analyzed · {collected} of {target} leads",
            profilesMaximum: "{processed} profiles analyzed · {collected} extracted · {discovered} discovered",
            scanning: "Scanning…",
            progressUnknownTitle: "The total depends on how many results Google Maps makes available.",
            progressTargetTitle: "Progress calculated against the selected lead target.",
            searchPrefix: "Search: {query}",
            recordsOne: "1 record",
            recordsMany: "{count} records",
            noSearchResults: "No results for this search",
            noLeads: "No leads extracted",
            searchTryAgain: "Try another name, phone number or email.",
            extractToFill: "Start a Google Maps extraction to populate this list.",
            nameNotIdentified: "Name not identified",
            profileMaps: "Google Maps profile",
            noPhone: "No phone",
            noEmail: "No email",
            noSite: "No website",
            withSite: "Has website",
            listsLibraryTitle: "Contact library",
            listsLibraryDescription: "Name, browse, download or combine extractions.",
            listsMergeSelected: "Merge selected",
            listsEmpty: "No saved lists",
            listsEmptyDescription: "After an extraction, use “Save as list”.",
            listUnnamed: "Unnamed list",
            listMetadata: "{contacts} contacts · {phones} phones · {date}",
            dateNotInformed: "date unavailable",
            selectList: "Select {name}",
            viewContacts: "View contacts",
            downloadThisList: "Download this list",
            useInSender: "Use in Sender",
            deleteList: "Delete list",
            deleteListConfirm: "Delete list “{name}”?",
            contactHeader: "CONTACT",
            qualificationHeader: "QUALIFICATION",
            listDeleted: "List deleted.",
            saveListsError: "Could not save the contact lists.",
            noContactsToSave: "There are no contacts to save.",
            modalMergeKicker: "Merge lists",
            modalSaveKicker: "Save extraction",
            modalMergeTitle: "Name the combined list",
            modalSaveTitle: "Name this list",
            modalMergeDescription: "{count} unique contacts will be combined without changing the original lists.",
            modalSaveDescription: "{count} contacts will be available for browsing, downloading and merging.",
            modalMergeConfirm: "Create merged list",
            modalSaveConfirm: "Save list",
            modalNameRequired: "Enter a name for the list.",
            listNamePlaceholder: "E.g. Curitiba dentists · August",
            modalCancel: "Cancel",
            mergedListsDefault: "Merged lists",
            defaultMapsLeads: "Google Maps leads",
            noValidPhone: "No valid phone number was found.",
            contactsSent: "{count} valid contacts were sent to Sender!",
            completionSummary: "{leads} unique leads · {phones} phone numbers ready to use.",
            dashboardActionError: "Could not change the current extraction.",
            dashboardStopping: "Stopping the extraction safely…",
            dashboardNoActiveExtraction: "There is no active extraction.",
            mergedListCreated: "Merged list created.",
            dashboardListSaved: "List saved in the dashboard.",
            templatesCreateTitle: "Create message template",
            templatesCreateDescription: "Save messages with Spintax and attachments for reuse in Sender.",
            templatesNameLabel: "Template name",
            templatesNamePlaceholder: "E.g. Dentist outreach",
            templatesMessageLabel: "Message",
            templatesMessagePlaceholder: "Write the template message...",
            templatesSpintaxHelp: "Working Spintax:",
            templatesSpintaxExample: "use {Hi|Hello} to vary each send.",
            templatesGeneratePreview: "Generate examples",
            templatesPreviewEmpty: "Message variations will appear here.",
            templatesVariant: "Variation",
            templatesAttach: "Attach image or document",
            templatesCancelEdit: "Cancel editing",
            templatesSave: "Save template",
            templatesUpdate: "Update template",
            templatesSavedTitle: "Saved templates",
            templatesSavedDescription: "Use, edit or delete your saved templates.",
            templatesEmpty: "No templates saved",
            templatesEmptyDescription: "Create your first template using the form above.",
            templatesWithAttachment: "With attachment",
            templatesUse: "Use in Sender",
            templatesEdit: "Edit template",
            templatesDelete: "Delete template",
            templatesDeleteConfirm: "Delete this template?",
            templatesSelectOptional: "Select a template (optional)...",
            templatesApplied: "Template applied to Sender.",
            templatesFileTooLarge: "Select a file smaller than 5 MB.",
            templatesNameRequired: "Give the template a name.",
            templatesContentRequired: "The template needs a message or attachment.",
            templatesSavedToast: "Template saved successfully!",
            templatesUpdatedToast: "Template updated successfully!",
            trialLabel: "Trial period",
            trialExpiredShort: "Expired",
            trialBuyTitle: "Manage license on Kiwify",
            senderQueueTitle: "List queue",
            senderQueueDescription: "Each list becomes a campaign and runs in the order below.",
            senderQueueSelect: "Select a saved list…",
            senderQueueAdd: "Add",
            senderQueueEmpty: "No list queued. You can also use manual contacts.",
            senderQueueContacts: "{count} contacts in this campaign",
            senderQueueMoveUp: "Move campaign up",
            senderQueueMoveDown: "Move campaign down",
            senderQueueRemove: "Remove campaign from queue",
            senderQueueAlreadyAdded: "This list is already in the campaign queue.",
            senderQueueAdded: "“{name}” added to the queue with {count} contacts.",
            senderManualCampaign: "Manual contacts",
            senderManualSource: "Manual input or imported file",
            senderProgressReady: "Ready to start",
            senderProgressSending: "Sending contact",
            senderProgressWaiting: "Waiting for next send",
            senderProgressCompleted: "Sending completed",
            senderProgressStopped: "Sending stopped",
            senderProgressCount: "{processed} of {total} contacts · {success} sent · {errors} failed",
            senderProgressCurrentList: "Current campaign: {name}",
            senderProgressAllDone: "All queued campaigns are complete",
            senderProgressStoppedDetail: "The queue was stopped before completion",
            senderProgressNoList: "No campaign running",
            senderStartingBackground: "Sending started. WhatsApp Web will open in the background when needed.",
            senderStartError: "Could not start sending.",
            campaignsTitle: "Campaigns and follow-ups",
            campaignsDescription: "Schedule additional attempts and stop automatically when a contact replies.",
            campaignsRefresh: "Refresh campaigns",
            campaignsSafetyNote: "Chrome resumes overdue tasks when it opens. Before each follow-up, GeoLead opens the conversation and checks whether the contact replied.",
            campaignsEmpty: "No campaigns yet",
            campaignsEmptyDescription: "Your next started send will appear here so you can configure follow-ups.",
            campaignUnnamed: "Unnamed campaign",
            campaignMetadata: "{contacts} contacts · created {date}",
            campaignStatusActive: "Active",
            campaignStatusPaused: "Paused",
            campaignStatusCompleted: "Completed",
            campaignStatusConfigure: "Configure",
            campaignStatusLogin: "Connect WhatsApp",
            campaignStatusReview: "Review",
            campaignMetricSent: "initial sent",
            campaignMetricWaiting: "waiting",
            campaignMetricReplied: "replied",
            campaignMetricReview: "review",
            campaignLoginNeeded: "Open WhatsApp Web and connect your account. The campaign will retry later.",
            campaignNextRun: "Next processing: {date}",
            campaignConfigureHint: "The initial send was recorded. Configure this campaign's follow-ups.",
            campaignNoPending: "No follow-up pending.",
            campaignEditPlan: "Edit plan",
            campaignConfigure: "Configure follow-ups",
            campaignViewContacts: "View campaign contacts",
            campaignResume: "Resume campaign",
            campaignPause: "Pause campaign",
            campaignDelete: "Delete campaign",
            campaignDeleteConfirm: "Delete campaign “{name}” and its schedules?",
            campaignDeleted: "Campaign deleted.",
            campaignRetryContact: "Reviewed: retry",
            campaignContactRetried: "Contact safely returned to the queue.",
            contactStatusInitialQueue: "Initial send queued",
            contactStatusAwaitingPlan: "Waiting for plan",
            contactStatusWaiting: "Waiting for due time",
            contactStatusChecking: "Checking reply",
            contactStatusReplied: "Replied · canceled",
            contactStatusCompleted: "Sequence completed",
            contactStatusInitialFailed: "Initial send failed",
            contactStatusInitialCancelled: "Initial send canceled",
            contactStatusReview: "Review required",
            followupModalKicker: "SAFE AUTOMATION",
            followupModalDescription: "Choose up to three text templates. Each delay starts after the last confirmed send.",
            followupWait: "Wait",
            followupUnit: "Unit",
            followupDays: "days",
            followupHours: "hours",
            followupTemplate: "Template",
            followupBusinessHours: "Respect sending hours",
            followupFrom: "From",
            followupTo: "To",
            followupWeekends: "Include weekends",
            followupConfirmation: "I reviewed this campaign's recipients, templates and schedule.",
            followupActivate: "Activate follow-ups",
            followupSelectTemplate: "Select a template...",
            followupNeedsTemplate: "Create at least one text template before configuring follow-ups.",
            followupConfirmRequired: "Confirm that you reviewed recipients, templates and schedule.",
            followupInvalidHours: "The end time must be later than the start time.",
            followupSelectAllTemplates: "Choose a text template for every active step.",
            followupOneStepRequired: "Enable at least one follow-up step.",
            followupSaveError: "Could not save the follow-up configuration.",
            followupActivated: "Follow-ups activated. Due times remain valid after Chrome restarts.",
            microphoneLabel: "Microphone",
            microphoneDefault: "System default",
            microphoneRefresh: "Refresh microphones",
            microphoneApiUnavailable: "Microphone recording is unavailable in this browser.",
            microphoneNotFound: "No active microphone was found. Check the operating system, connect or enable a device, then try again.",
            microphoneListError: "Could not refresh the microphone list.",
            microphonePermissionDenied: "Microphone access was blocked. Allow it on the page that opened.",
            microphoneBusy: "The microphone is busy or unavailable to Chrome.",
            microphoneAccessError: "Could not access the microphone:",
            behaviorFixed: "Fixed interval of {value} {unit}.",
            behaviorRandom: "Random interval from {min} to {max} {unit}.",
            behaviorPause: "Human pause of {duration} min every {every} messages.",
            behaviorWaitingDelay: "Next send in approximately {seconds}s.",
            behaviorWaitingPause: "Human pause active: resumes in approximately {seconds}s."
        }
    };

    const langSelect = document.getElementById('langSelect');

    function t(key, replacements = {}) {
        const dict = translations[currentLang] || translations.pt;
        const template = dict[key] || translations.pt[key] || key;
        return String(template).replace(/\{(\w+)\}/g, (_match, name) => replacements[name] ?? `{${name}}`);
    }

    function applyTranslations(lang) {
        currentLang = translations[lang] ? lang : 'pt';
        document.documentElement.lang = currentLang === 'en' ? 'en' : 'pt-BR';
        const dict = translations[currentLang] || translations.pt;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerHTML = dict[key];
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            if (dict[key]) el.setAttribute('placeholder', dict[key]);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (dict[key]) el.setAttribute('title', dict[key]);
        });
        // Translating specific select options
        const delayUnit = document.getElementById('delayUnit');
        if(delayUnit) {
            delayUnit.options[0].text = currentLang === 'en' ? 'Seconds' : 'Segundos';
            delayUnit.options[1].text = currentLang === 'en' ? 'Minutes' : 'Minutos';
        }
        if (delayUnitRandom) {
            delayUnitRandom.options[0].text = currentLang === 'en' ? 'Seconds' : 'Segundos';
            delayUnitRandom.options[1].text = currentLang === 'en' ? 'Minutes' : 'Minutos';
        }
        renderDashboard();
        renderSavedLists();
        renderTemplatesList();
        renderCampaigns();
        renderSenderListQueue();
        renderSenderSavedListOptions();
        if (latestSenderState) renderSenderProgress(latestSenderState);
        renderTemplateSelect();
        renderSpintaxPreview();
        renderAttachmentPreview(currentAttachment, attachmentName, t('noAttachment'));
        btnRemoveAttach.style.display = currentAttachment ? 'inline-block' : 'none';
        renderAttachmentPreview(currentTemplateAttachment, templateAttachmentName, t('noAttachment'));
        btnRemoveTemplateAttach.style.display = currentTemplateAttachment ? 'inline-block' : 'none';
        btnSaveTemplate.querySelector('span').textContent = t(editingTemplateId ? 'templatesUpdate' : 'templatesSave');
        updateBehaviorSummary();
        renderLicenseState();
        refreshMicrophoneDevices(microphoneSelect ? microphoneSelect.value : '');
    }

    chrome.storage.local.get(['geoLeadLang'], (res) => {
        const lang = res.geoLeadLang || 'pt';
        if(langSelect) langSelect.value = lang;
        applyTranslations(lang);
    });

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            chrome.storage.local.set({geoLeadLang: lang});
            applyTranslations(lang);
        });
    }
    // --- FIM TRADUÇÃO ---

    // --- SISTEMA DE LICENÇA (TRIAL) ---
    const licenseOverlay = document.getElementById('licenseOverlay');
    const successOverlay = document.getElementById('successOverlay');
    const btnCloseSuccess = document.getElementById('btnCloseSuccess');
    const licenseEmailInput = document.getElementById('licenseEmailInput');
    const btnActivateLicense = document.getElementById('btnActivateLicense');
    const licenseError = document.getElementById('licenseError');
    const trialStatusButton = document.getElementById('trialStatusButton');
    const trialCountdown = document.getElementById('trialCountdown');

    let glUserId = 'anonymous';
    let licenseState = { trialStart: 0, licensed: false };
    const TRIAL_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 dias para teste
    // Substitua pelo IP da sua VPS quando for fazer o deploy final
    const SERVER_URL = 'https://limiarcode.com.br';

    function formatTrialRemaining(remainingMs) {
        const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
        if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
        return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }

    function renderLicenseState() {
        if (!licenseState.trialStart && !licenseState.licensed) {
            licenseOverlay.style.display = 'none';
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
            return;
        }
        if (licenseState.licensed) {
            licenseOverlay.style.display = 'none';
            if (trialStatusButton) trialStatusButton.style.display = 'none';
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
            return;
        }

        const remaining = Math.max(0, TRIAL_DURATION_MS - (Date.now() - licenseState.trialStart));
        const expired = remaining <= 0;
        if (trialStatusButton) {
            trialStatusButton.style.display = 'flex';
            trialStatusButton.classList.toggle('is-ending', expired || remaining <= 6 * 60 * 60 * 1000);
            trialStatusButton.title = expired ? t('trialExpiredShort') : t('trialBuyTitle');
        }
        if (trialCountdown) trialCountdown.textContent = expired ? t('trialExpiredShort') : formatTrialRemaining(remaining);
        licenseOverlay.style.display = expired ? 'flex' : 'none';
        document.body.style.overflow = expired ? 'hidden' : 'auto';
        document.documentElement.style.overflow = expired ? 'hidden' : 'auto';
    }

    function checkLicense() {
        chrome.storage.sync.get(['gl_trial_start', 'gl_user_id', 'gl_license_email', 'gl_user_email'], (res) => {
            if (res.gl_user_id) glUserId = res.gl_user_id;
            
            // Auto-validação silenciosa para usuários pagantes
            if (!res.gl_license_email && res.gl_user_id) {
                fetch(`${SERVER_URL}/api/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: res.gl_user_email || 'auto_check', device_id: res.gl_user_id })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.valid) {
                        chrome.storage.sync.set({ gl_license_email: data.email || res.gl_user_email || res.gl_user_id });
                        licenseState.licensed = true;
                        renderLicenseState();
                    } else if (data.trialStart) {
                         // Caso o backend passe a controlar o início do trial no futuro
                         chrome.storage.sync.set({ gl_trial_start: data.trialStart });
                    }
                }).catch(() => {});
            }

            chrome.storage.local.get(['gl_trial_start_backup'], local => {
                let trialStart = Math.max(0, Number(res.gl_trial_start) || Number(local.gl_trial_start_backup) || 0);
                if (!trialStart) trialStart = Date.now();
                if (!res.gl_trial_start) chrome.storage.sync.set({ gl_trial_start: trialStart });
                if (Number(local.gl_trial_start_backup) !== trialStart) chrome.storage.local.set({ gl_trial_start_backup: trialStart });
                licenseState = { trialStart, licensed: Boolean(res.gl_license_email) };
                renderLicenseState();
            });
        });
    }

    // A data inicial fica persistida; o contador visual deriva de Date.now(),
    // portanto continua correto mesmo depois de fechar e reabrir o popup.
    setInterval(renderLicenseState, 1000);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (changes.gl_trial_start || changes.gl_license_email)) checkLicense();
    });

    btnActivateLicense.addEventListener('click', async () => {
        const email = licenseEmailInput.value.trim().toLowerCase();
        if (!email) return;

        btnActivateLicense.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btnActivateLicense.disabled = true;
        licenseError.style.display = 'none';

        try {
            const response = await fetch(`${SERVER_URL}/api/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, device_id: glUserId })
            });
            const data = await response.json();

            if (data.valid) {
                chrome.storage.sync.set({ gl_license_email: email }, () => {
                    licenseState.licensed = true;
                    // Mantém o loading por 1 segundo para dar sensação de processamento
                    setTimeout(() => {
                        licenseOverlay.style.display = 'none';
                        if (trialStatusButton) trialStatusButton.style.display = 'none';
                        successOverlay.style.display = 'flex';
                    }, 1000);
                });
            } else {
                licenseError.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message || 'E-mail não encontrado.'}`;
                licenseError.style.display = 'block';
            }
        } catch (error) {
            licenseError.innerHTML = `<i class="fas fa-exclamation-circle"></i> Erro ao conectar com o servidor. Tente novamente.`;
            licenseError.style.display = 'block';
        }

        btnActivateLicense.innerHTML = '<i class="fas fa-arrow-right"></i>';
        btnActivateLicense.disabled = false;
    });

    btnCloseSuccess.addEventListener('click', () => {
        successOverlay.style.display = 'none';
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
    });

    checkLicense();
    // --- FIM SISTEMA DE LICENÇA ---

    // ==========================================
    // EXTRATOR, DASHBOARD E LISTAS DE CONTATOS
    // ==========================================
    const btnStartExtract = document.getElementById('btnStartExtract');
    const btnStopExtract = document.getElementById('btnStopExtract');
    const btnSearchMaps = document.getElementById('btnSearchMaps');
    const extractQuery = document.getElementById('extractQuery');
    const extractLimit = document.getElementById('extractLimit');
    const extractionTerminal = document.getElementById('extractionTerminal');
    const extractionActions = document.getElementById('extractionActions');
    const extractionSummary = document.getElementById('extractionSummary');
    const btnDownloadExtracted = document.getElementById('btnDownloadExtracted');
    const btnSendToSendList = document.getElementById('btnSendToSendList');
    const btnSaveExtractionList = document.getElementById('btnSaveExtractionList');

    const dashboardProgressCard = document.getElementById('dashboardProgressCard');
    const dashStatus = document.getElementById('dashStatus');
    const dashProgressText = document.getElementById('dashProgressText');
    const dashPercent = document.getElementById('dashPercent');
    const dashProgressBar = document.getElementById('dashProgressBar');
    const dashCurrentLead = document.getElementById('dashCurrentLead');
    const dashUpdated = document.getElementById('dashUpdated');
    const dashTotal = document.getElementById('dashTotal');
    const dashPhones = document.getElementById('dashPhones');
    const dashEmails = document.getElementById('dashEmails');
    const dashNoSite = document.getElementById('dashNoSite');
    const dashListCount = document.getElementById('dashListCount');
    const dashboardLeadList = document.getElementById('dashboardLeadList');
    const dashboardSearch = document.getElementById('dashboardSearch');
    const btnDashboardPause = document.getElementById('btnDashboardPause');
    const btnDashboardStop = document.getElementById('btnDashboardStop');
    const btnDashboardExport = document.getElementById('btnDashboardExport');
    const btnDashboardSend = document.getElementById('btnDashboardSend');
    const dashTabCurrent = document.getElementById('dashTabCurrent');
    const dashTabLists = document.getElementById('dashTabLists');
    const dashTabTemplates = document.getElementById('dashTabTemplates');
    const dashTabCampaigns = document.getElementById('dashTabCampaigns');
    const dashboardCurrentPane = document.getElementById('dashboardCurrentPane');
    const dashboardListsPane = document.getElementById('dashboardListsPane');
    const dashboardTemplatesPane = document.getElementById('dashboardTemplatesPane');
    const dashboardCampaignsPane = document.getElementById('dashboardCampaignsPane');
    const dashSavedListCount = document.getElementById('dashSavedListCount');
    const dashCampaignCount = document.getElementById('dashCampaignCount');
    const savedListsContainer = document.getElementById('savedListsContainer');
    const btnMergeSelectedLists = document.getElementById('btnMergeSelectedLists');
    const btnRefreshCampaigns = document.getElementById('btnRefreshCampaigns');
    const campaignsContainer = document.getElementById('campaignsContainer');

    const contactListModal = document.getElementById('contactListModal');
    const contactListModalKicker = document.getElementById('contactListModalKicker');
    const contactListModalTitle = document.getElementById('contactListModalTitle');
    const contactListModalDescription = document.getElementById('contactListModalDescription');
    const contactListName = document.getElementById('contactListName');
    const btnCancelContactList = document.getElementById('btnCancelContactList');
    const btnConfirmContactList = document.getElementById('btnConfirmContactList');

    const followupModal = document.getElementById('followupModal');
    const followupModalTitle = document.getElementById('followupModalTitle');
    const followupBusinessHours = document.getElementById('followupBusinessHours');
    const followupStartTime = document.getElementById('followupStartTime');
    const followupEndTime = document.getElementById('followupEndTime');
    const followupIncludeWeekends = document.getElementById('followupIncludeWeekends');
    const followupConfirmAudience = document.getElementById('followupConfirmAudience');
    const btnCancelFollowup = document.getElementById('btnCancelFollowup');
    const btnSaveFollowup = document.getElementById('btnSaveFollowup');

    let extractedData = [];
    let savedContactLists = [];
    let selectedSavedListIds = new Set();
    let pendingContactsForList = [];
    let pendingListMode = 'save';
    let dashboardState = {
        isExtracting: false,
        isPaused: false,
        progress: { processed: 0, collected: 0, discovered: 0, target: null, percent: 0, stage: 'idle', currentLead: '' },
        meta: { query: '', startedAt: null, updatedAt: null }
    };

    function hasValidValue(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return Boolean(normalized && !['não encontrado', 'not found', 'sem nome', 'sem telefone', 'sem e-mail', 'sem site'].includes(normalized));
    }

    function cleanPhoneLocal(phone) {
        return String(phone || '').replace(/\D/g, '');
    }

    function getLeadInitials(name) {
        return String(hasValidValue(name) ? name : 'Lead').split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
    }

    function formatDashboardTime(timestamp) {
        if (!timestamp) return '—';
        return new Intl.DateTimeFormat(currentLang === 'en' ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
    }

    function formatListDate(timestamp) {
        if (!timestamp) return t('dateNotInformed');
        return new Intl.DateTimeFormat(currentLang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
    }

    function normalizeSocial(row) {
        if (Array.isArray(row.social)) return row.social.filter(Boolean).join(', ');
        return String(row.social || '');
    }

    function leadDedupeKey(row) {
        const phone = cleanPhoneLocal(row.telefone);
        if (phone.length >= 10) return `phone:${phone}`;
        if (row.placeKey) return `place:${row.placeKey}`;
        if (row.mapsUrl) return `maps:${String(row.mapsUrl).split('?')[0]}`;
        if (hasValidValue(row.email)) return `email:${String(row.email).toLowerCase()}`;
        return `fallback:${String(row.nome || '').toLowerCase()}|${String(row.endereco || '').toLowerCase()}`;
    }

    function mergeLeadRecords(base, incoming) {
        const merged = { ...base };
        ['nome', 'telefone', 'email', 'website', 'endereco', 'categoria', 'mapsUrl', 'placeKey'].forEach(field => {
            if (!hasValidValue(merged[field]) && hasValidValue(incoming[field])) merged[field] = incoming[field];
        });
        const socials = [...new Set(`${normalizeSocial(base)},${normalizeSocial(incoming)}`.split(',').map(item => item.trim()).filter(Boolean))];
        merged.social = socials.join(', ');
        merged.semSite = !hasValidValue(merged.website);
        merged.extraidoEm = merged.extraidoEm || incoming.extraidoEm;
        return merged;
    }

    function dedupeContacts(contacts) {
        const index = new Map();
        (Array.isArray(contacts) ? contacts : []).forEach(raw => {
            const row = { ...raw, social: normalizeSocial(raw) };
            const key = leadDedupeKey(row);
            if (index.has(key)) index.set(key, mergeLeadRecords(index.get(key), row));
            else index.set(key, row);
        });
        return [...index.values()];
    }

    function getDashboardStatusLabel(stage, isExtracting, isPaused) {
        if (isPaused) return t('statusPaused');
        if (isExtracting) {
            if (stage === 'filtering') return t('statusFiltering');
            if (stage === 'collecting') return t('statusCollected');
            if (stage === 'analyzing') return t('statusAnalyzing');
            if (stage === 'discovering') return t('statusDiscovering');
            return t('statusRunning');
        }
        if (stage === 'completed') return t('statusCompleted');
        if (stage === 'stopped') return t('statusStopped');
        if (stage === 'error') return t('statusError');
        return t('statusReady');
    }

    function makeDashboardEmpty(iconClass, titleText, descriptionText) {
        const empty = document.createElement('div');
        empty.className = 'dashboard-empty';
        const icon = document.createElement('span');
        icon.innerHTML = `<i class="${iconClass}"></i>`;
        const title = document.createElement('strong');
        title.textContent = titleText;
        const description = document.createElement('small');
        description.textContent = descriptionText;
        empty.append(icon, title, description);
        return empty;
    }

    function renderDashboardLeadList() {
        const term = dashboardSearch.value.trim().toLowerCase();
        const filtered = extractedData.filter(row => {
            const haystack = [row.nome, row.telefone, row.email, row.website, row.categoria, row.endereco].join(' ').toLowerCase();
            return !term || haystack.includes(term);
        });

        dashboardLeadList.innerHTML = '';
        dashListCount.textContent = filtered.length === 1 ? t('recordsOne') : t('recordsMany', { count: filtered.length });
        if (filtered.length === 0) {
            dashboardLeadList.appendChild(makeDashboardEmpty(
                'fas fa-location-dot',
                term ? t('noSearchResults') : t('noLeads'),
                term ? t('searchTryAgain') : t('extractToFill')
            ));
            return;
        }

        filtered.forEach(row => {
            const leadRow = document.createElement('div');
            leadRow.className = 'dashboard-lead-row';
            const main = document.createElement('div');
            main.className = 'dashboard-lead-main';
            const avatar = document.createElement('span');
            avatar.className = 'dashboard-lead-avatar';
            avatar.textContent = getLeadInitials(row.nome);
            const identity = document.createElement('div');
            const name = document.createElement('strong');
            name.textContent = hasValidValue(row.nome) ? row.nome : t('nameNotIdentified');
            const context = document.createElement('small');
            context.textContent = row.categoria || row.endereco || t('profileMaps');
            identity.append(name, context);
            main.append(avatar, identity);

            const contact = document.createElement('div');
            contact.className = 'dashboard-contact';
            const phone = document.createElement('span');
            phone.textContent = hasValidValue(row.telefone) ? row.telefone : t('noPhone');
            const email = document.createElement('span');
            email.textContent = hasValidValue(row.email) ? row.email : t('noEmail');
            contact.append(phone, email);

            const noSite = row.semSite === true || !hasValidValue(row.website);
            const status = document.createElement('span');
            status.className = `lead-status ${noSite ? 'no-site' : 'has-site'}`;
            status.textContent = noSite ? t('noSite') : t('withSite');
            leadRow.append(main, contact, status);
            dashboardLeadList.appendChild(leadRow);
        });
    }

    function renderDashboard() {
        const progress = dashboardState.progress || {};
        const meta = dashboardState.meta || {};
        const isActive = Boolean(dashboardState.isExtracting);
        const isPaused = Boolean(dashboardState.isPaused);
        const target = Number(progress.target) || 0;
        const processed = Number(progress.processed) || 0;
        const discovered = Number(progress.discovered) || 0;
        const collected = extractedData.length;
        const isIndeterminate = isActive && (progress.indeterminate === true || !target || progress.percent == null);
        const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));

        dashboardProgressCard.classList.toggle('is-active', isActive && !isPaused);
        dashboardProgressCard.classList.toggle('is-paused', isPaused);
        dashboardProgressCard.classList.toggle('is-indeterminate', isIndeterminate && !isPaused);
        dashStatus.innerHTML = `<i></i> ${getDashboardStatusLabel(progress.stage, isActive, isPaused)}`;
        dashProgressText.textContent = target
            ? t('profilesTarget', { processed, collected, target })
            : t('profilesMaximum', { processed, collected, discovered });
        dashPercent.textContent = isIndeterminate ? t('scanning') : `${percent}%`;
        dashPercent.title = isIndeterminate ? t('progressUnknownTitle') : t('progressTargetTitle');
        dashProgressBar.style.width = isIndeterminate ? '34%' : `${percent}%`;
        dashCurrentLead.textContent = currentLang === 'en'
            ? getDashboardStatusLabel(progress.stage, isActive, isPaused)
            : (progress.currentLead || t('dashWaitingMaps'));
        dashUpdated.textContent = formatDashboardTime(meta.updatedAt || meta.startedAt);

        dashTotal.textContent = collected;
        dashPhones.textContent = extractedData.filter(row => hasValidValue(row.telefone)).length;
        dashEmails.textContent = extractedData.filter(row => hasValidValue(row.email)).length;
        dashNoSite.textContent = extractedData.filter(row => row.semSite === true || !hasValidValue(row.website)).length;
        btnDashboardPause.disabled = !isActive;
        btnDashboardStop.disabled = !isActive;
        btnDashboardPause.innerHTML = isPaused ? `<i class="fas fa-play"></i> <span>${t('dashResume')}</span>` : `<i class="fas fa-pause"></i> <span>${t('dashPause')}</span>`;
        btnDashboardExport.disabled = collected === 0;
        btnDashboardSend.disabled = extractedData.filter(row => hasValidValue(row.telefone)).length === 0;
        renderDashboardLeadList();
        updateExtractionCompletionUI();
    }

    function applyDashboardState(response) {
        if (!response) return;
        dashboardState = {
            isExtracting: Boolean(response.isExtracting),
            isPaused: Boolean(response.isPaused),
            progress: response.extProgress || dashboardState.progress,
            meta: response.extMeta || dashboardState.meta
        };
        if (Array.isArray(response.extData)) extractedData = dedupeContacts(response.extData);
        renderDashboard();
    }

    function refreshDashboardState() {
        chrome.runtime.sendMessage({ action: 'get_ext_state' }, (response) => {
            if (!chrome.runtime.lastError && response) applyDashboardState(response);
        });
    }

    function setDashboardPane(pane) {
        const showLists = pane === 'lists';
        const showTemplates = pane === 'templates';
        const showCampaigns = pane === 'campaigns';
        dashTabCurrent.classList.toggle('active', !showLists && !showTemplates && !showCampaigns);
        dashTabLists.classList.toggle('active', showLists);
        dashTabTemplates.classList.toggle('active', showTemplates);
        dashTabCampaigns.classList.toggle('active', showCampaigns);
        dashboardCurrentPane.style.display = showLists || showTemplates || showCampaigns ? 'none' : 'block';
        dashboardListsPane.style.display = showLists ? 'block' : 'none';
        dashboardTemplatesPane.style.display = showTemplates ? 'block' : 'none';
        dashboardCampaignsPane.style.display = showCampaigns ? 'block' : 'none';
        if (showLists) renderSavedLists();
        if (showTemplates) {
            renderTemplatesList();
            renderSpintaxPreview();
        }
        if (showCampaigns) refreshFollowupCampaigns();
    }

    function saveContactLists() {
        chrome.storage.local.set({ glContactLists: savedContactLists }, () => {
            if (chrome.runtime.lastError) showToast(t('saveListsError'), 'error');
        });
        renderSavedLists();
        renderSenderSavedListOptions();
    }

    function createIconButton(iconClass, title, onClick, extraClass = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = extraClass;
        button.title = title;
        button.setAttribute('aria-label', title);
        button.innerHTML = `<i class="${iconClass}"></i>`;
        button.addEventListener('click', onClick);
        return button;
    }

    function renderSavedLists() {
        if (!savedListsContainer) return;
        const validIds = new Set(savedContactLists.map(list => list.id));
        selectedSavedListIds = new Set([...selectedSavedListIds].filter(id => validIds.has(id)));
        dashSavedListCount.textContent = savedContactLists.length;
        btnMergeSelectedLists.disabled = selectedSavedListIds.size < 2;
        savedListsContainer.innerHTML = '';

        if (savedContactLists.length === 0) {
            savedListsContainer.appendChild(makeDashboardEmpty('fas fa-folder-plus', t('listsEmpty'), t('listsEmptyDescription')));
            return;
        }

        savedContactLists.forEach(list => {
            const contacts = dedupeContacts(list.contacts);
            const card = document.createElement('article');
            card.className = 'saved-list-card';
            const summary = document.createElement('div');
            summary.className = 'saved-list-summary';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedSavedListIds.has(list.id);
            checkbox.setAttribute('aria-label', t('selectList', { name: list.name }));
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) selectedSavedListIds.add(list.id);
                else selectedSavedListIds.delete(list.id);
                btnMergeSelectedLists.disabled = selectedSavedListIds.size < 2;
            });
            const icon = document.createElement('span');
            icon.className = 'saved-list-icon';
            icon.innerHTML = '<i class="fas fa-address-book"></i>';
            const copy = document.createElement('div');
            copy.className = 'saved-list-copy';
            const name = document.createElement('strong');
            name.textContent = list.name || t('listUnnamed');
            const metadata = document.createElement('small');
            const phones = contacts.filter(row => hasValidValue(row.telefone)).length;
            metadata.textContent = t('listMetadata', { contacts: contacts.length, phones, date: formatListDate(list.createdAt) });
            copy.append(name, metadata);
            const actions = document.createElement('div');
            actions.className = 'saved-list-actions';
            actions.append(
                createIconButton('fas fa-eye', t('viewContacts'), () => card.classList.toggle('expanded')),
                createIconButton('fas fa-download', t('downloadThisList'), () => downloadContactsCsv(contacts, list.name)),
                createIconButton('fas fa-paper-plane', t('useInSender'), () => sendContactsToSender(contacts, {
                    sourceListId: list.id,
                    sourceName: list.name,
                    name: list.name
                })),
                createIconButton('fas fa-trash', t('deleteList'), () => {
                    if (!confirm(t('deleteListConfirm', { name: list.name }))) return;
                    savedContactLists = savedContactLists.filter(item => item.id !== list.id);
                    selectedSavedListIds.delete(list.id);
                    saveContactLists();
                    showToast(t('listDeleted'), 'info');
                }, 'delete')
            );
            summary.append(checkbox, icon, copy, actions);

            const details = document.createElement('div');
            details.className = 'saved-list-details';
            const detailsHead = document.createElement('div');
            detailsHead.className = 'saved-list-details-head';
            detailsHead.innerHTML = `<span>${t('contactHeader')}</span><span>${t('qualificationHeader')}</span>`;
            const contactsEl = document.createElement('div');
            contactsEl.className = 'saved-list-contacts';
            contacts.forEach(row => {
                const contactRow = document.createElement('div');
                contactRow.className = 'saved-list-contact';
                const identity = document.createElement('div');
                const contactName = document.createElement('strong');
                contactName.textContent = hasValidValue(row.nome) ? row.nome : t('nameNotIdentified');
                const context = document.createElement('small');
                context.textContent = row.categoria || row.endereco || 'Google Maps';
                identity.append(contactName, context);
                const contactData = document.createElement('div');
                const phone = document.createElement('strong');
                phone.textContent = hasValidValue(row.telefone) ? row.telefone : t('noPhone');
                const email = document.createElement('small');
                email.textContent = hasValidValue(row.email) ? row.email : t('noEmail');
                contactData.append(phone, email);
                const noSite = row.semSite === true || !hasValidValue(row.website);
                const status = document.createElement('span');
                status.className = `lead-status ${noSite ? 'no-site' : 'has-site'}`;
                status.textContent = noSite ? t('noSite') : t('withSite');
                contactRow.append(identity, contactData, status);
                contactsEl.appendChild(contactRow);
            });
            details.append(detailsHead, contactsEl);
            card.append(summary, details);
            savedListsContainer.appendChild(card);
        });
    }

    function getDefaultListName(prefix = '') {
        const query = dashboardState.meta.query && dashboardState.meta.query !== 'Busca atual do Google Maps' ? dashboardState.meta.query : t('defaultMapsLeads');
        const date = new Intl.DateTimeFormat(currentLang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date());
        return `${prefix || query} · ${date}`.slice(0, 60);
    }

    function openContactListModal(contacts, defaultName, mode = 'save') {
        pendingContactsForList = dedupeContacts(contacts);
        pendingListMode = mode;
        if (pendingContactsForList.length === 0) {
            showToast(t('noContactsToSave'), 'error');
            return;
        }
        const merging = mode === 'merge';
        contactListModalKicker.textContent = t(merging ? 'modalMergeKicker' : 'modalSaveKicker');
        contactListModalTitle.textContent = t(merging ? 'modalMergeTitle' : 'modalSaveTitle');
        contactListModalDescription.textContent = t(merging ? 'modalMergeDescription' : 'modalSaveDescription', { count: pendingContactsForList.length });
        contactListName.value = defaultName || getDefaultListName();
        btnConfirmContactList.innerHTML = `<i class="fas ${merging ? 'fa-code-merge' : 'fa-check'}"></i> ${t(merging ? 'modalMergeConfirm' : 'modalSaveConfirm')}`;
        contactListModal.style.display = 'flex';
        setTimeout(() => contactListName.select(), 30);
    }

    function closeContactListModal() {
        contactListModal.style.display = 'none';
        pendingContactsForList = [];
        pendingListMode = 'save';
    }

    function cleanFileName(value) {
        return String(value || 'lista_geolead').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70) || 'lista_geolead';
    }

    function downloadContactsCsv(contacts, fileName = 'extracao_geolead') {
        const rows = dedupeContacts(contacts);
        if (rows.length === 0) return;
        const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const header = ['NOME', 'TELEFONE', 'EMAIL', 'SITE', 'SEM_SITE', 'REDES_SOCIAIS', 'ENDERECO', 'CATEGORIA', 'MAPS_URL'];
        const body = rows.map(row => [
            row.nome || '', row.telefone || '', row.email || '', row.website || '',
            row.semSite === true || !hasValidValue(row.website) ? 'SIM' : 'NÃO',
            normalizeSocial(row), row.endereco || '', row.categoria || '', row.mapsUrl || ''
        ].map(csvCell).join(';'));
        const blob = new Blob([`\ufeff${header.join(';')}\n${body.join('\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${cleanFileName(fileName)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function sendContactsToSender(contacts, source = {}) {
        const cleanContacts = dedupeContacts(contacts);
        const sourceName = String(source.sourceName || dashboardState.meta.query || t('defaultMapsLeads'));
        return enqueueSenderList(cleanContacts, {
            sourceListId: String(source.sourceListId || ''),
            sourceName,
            name: String(source.name || sourceName).slice(0, 70)
        }, true);
    }

    function getCampaignCounts(campaign) {
        const contacts = Array.isArray(campaign.contacts) ? campaign.contacts : [];
        return {
            total: contacts.length,
            sent: contacts.filter(contact => Number(contact.initialSentAt) > 0).length,
            waiting: contacts.filter(contact => ['queued_initial', 'awaiting_plan', 'waiting', 'checking'].includes(contact.status)).length,
            replied: contacts.filter(contact => contact.status === 'replied').length,
            review: contacts.filter(contact => ['needs_review', 'initial_failed', 'initial_cancelled'].includes(contact.status)).length
        };
    }

    function formatCampaignDateTime(timestamp) {
        if (!timestamp) return '—';
        return new Intl.DateTimeFormat(currentLang === 'en' ? 'en-US' : 'pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).format(new Date(timestamp));
    }

    function campaignStatusKey(campaign) {
        if (campaign.lastIssue === 'login_required') return 'campaignStatusLogin';
        if ((campaign.contacts || []).some(contact => contact.status === 'needs_review')) return 'campaignStatusReview';
        if (campaign.status === 'active') return 'campaignStatusActive';
        if (campaign.status === 'paused') return 'campaignStatusPaused';
        if (campaign.status === 'completed') return 'campaignStatusCompleted';
        return 'campaignStatusConfigure';
    }

    function contactStatusKey(status) {
        const keys = {
            queued_initial: 'contactStatusInitialQueue',
            awaiting_plan: 'contactStatusAwaitingPlan',
            waiting: 'contactStatusWaiting',
            checking: 'contactStatusChecking',
            replied: 'contactStatusReplied',
            completed: 'contactStatusCompleted',
            initial_failed: 'contactStatusInitialFailed',
            initial_cancelled: 'contactStatusInitialCancelled',
            needs_review: 'contactStatusReview'
        };
        return keys[status] || 'contactStatusWaiting';
    }

    function renderCampaigns() {
        if (!campaignsContainer || !dashCampaignCount) return;
        dashCampaignCount.textContent = followupCampaigns.length;
        campaignsContainer.innerHTML = '';
        if (followupCampaigns.length === 0) {
            campaignsContainer.appendChild(makeDashboardEmpty('fas fa-clock-rotate-left', t('campaignsEmpty'), t('campaignsEmptyDescription')));
            return;
        }

        followupCampaigns.forEach(campaign => {
            const counts = getCampaignCounts(campaign);
            const attention = campaign.lastIssue === 'login_required' || counts.review > 0;
            const card = document.createElement('article');
            card.className = `campaign-card${attention ? ' attention' : ''}`;

            const head = document.createElement('div');
            head.className = 'campaign-card-head';
            const title = document.createElement('div');
            title.className = 'campaign-card-title';
            const titleText = document.createElement('strong');
            titleText.textContent = campaign.name || t('campaignUnnamed');
            const metadata = document.createElement('small');
            metadata.textContent = t('campaignMetadata', {
                contacts: counts.total,
                date: formatCampaignDateTime(campaign.createdAt)
            });
            title.append(titleText, metadata);
            const status = document.createElement('span');
            status.className = `campaign-status ${attention ? 'attention' : campaign.status === 'paused' ? 'paused' : campaign.status === 'completed' ? 'completed' : ''}`;
            status.textContent = t(campaignStatusKey(campaign));
            head.append(title, status);

            const metrics = document.createElement('div');
            metrics.className = 'campaign-metrics';
            [
                [counts.sent, 'campaignMetricSent'],
                [counts.waiting, 'campaignMetricWaiting'],
                [counts.replied, 'campaignMetricReplied'],
                [counts.review, 'campaignMetricReview']
            ].forEach(([value, key]) => {
                const metric = document.createElement('div');
                metric.className = 'campaign-metric';
                const number = document.createElement('strong');
                number.textContent = value;
                const label = document.createElement('span');
                label.textContent = t(key);
                metric.append(number, label);
                metrics.appendChild(metric);
            });

            const next = document.createElement('div');
            next.className = 'campaign-next-run';
            const nextTimestamp = Math.min(...(campaign.contacts || [])
                .filter(contact => contact.status === 'waiting' && Number(contact.nextFollowupAt) > 0)
                .map(contact => Number(contact.nextFollowupAt)));
            next.innerHTML = '<i class="fas fa-clock"></i>';
            const nextText = document.createElement('span');
            if (campaign.lastIssue === 'login_required') nextText.textContent = t('campaignLoginNeeded');
            else if (Number.isFinite(nextTimestamp)) nextText.textContent = t('campaignNextRun', { date: formatCampaignDateTime(nextTimestamp) });
            else if (campaign.status === 'awaiting_plan') nextText.textContent = t('campaignConfigureHint');
            else nextText.textContent = t('campaignNoPending');
            next.appendChild(nextText);

            const actions = document.createElement('div');
            actions.className = 'campaign-actions';
            const configure = document.createElement('button');
            configure.className = 'configure';
            configure.innerHTML = `<i class="fas fa-sliders"></i> ${t(campaign.steps && campaign.steps.length ? 'campaignEditPlan' : 'campaignConfigure')}`;
            configure.addEventListener('click', () => openFollowupModal(campaign.id));
            const view = document.createElement('button');
            view.title = t('campaignViewContacts');
            view.innerHTML = '<i class="fas fa-users"></i>';
            view.addEventListener('click', () => card.classList.toggle('expanded'));
            actions.append(configure, view);
            if (campaign.steps && campaign.steps.length && campaign.status !== 'completed') {
                const toggle = document.createElement('button');
                toggle.title = t(campaign.status === 'paused' ? 'campaignResume' : 'campaignPause');
                toggle.innerHTML = `<i class="fas ${campaign.status === 'paused' ? 'fa-play' : 'fa-pause'}"></i>`;
                toggle.addEventListener('click', () => toggleFollowupCampaign(campaign.id));
                actions.appendChild(toggle);
            }
            const remove = document.createElement('button');
            remove.className = 'delete';
            remove.title = t('campaignDelete');
            remove.innerHTML = '<i class="fas fa-trash"></i>';
            remove.addEventListener('click', () => deleteFollowupCampaign(campaign));
            actions.appendChild(remove);

            const details = document.createElement('div');
            details.className = 'campaign-contact-details';
            (campaign.contacts || []).forEach(contact => {
                const row = document.createElement('div');
                row.className = 'campaign-contact-row';
                const identity = document.createElement('div');
                const name = document.createElement('strong');
                name.textContent = contact.name || contact.phone || t('nameNotIdentified');
                const phone = document.createElement('small');
                phone.textContent = contact.phone || t('noPhone');
                identity.append(name, phone);
                const contactStatus = document.createElement('span');
                contactStatus.textContent = t(contactStatusKey(contact.status));
                row.append(identity, contactStatus);
                if (contact.status === 'needs_review' && campaign.steps && contact.followupIndex < campaign.steps.length) {
                    const retry = document.createElement('button');
                    retry.title = t('campaignRetryContact');
                    retry.innerHTML = '<i class="fas fa-rotate-right"></i>';
                    retry.addEventListener('click', () => retryFollowupContact(campaign.id, contact.id));
                    row.appendChild(retry);
                } else {
                    row.appendChild(document.createElement('span'));
                }
                details.appendChild(row);
            });

            card.append(head, metrics, next, actions, details);
            campaignsContainer.appendChild(card);
        });
    }

    function refreshFollowupCampaigns() {
        chrome.runtime.sendMessage({ action: 'get_followup_campaigns' }, response => {
            if (chrome.runtime.lastError || !response || response.status !== 'ok') return;
            followupCampaigns = Array.isArray(response.campaigns) ? response.campaigns : [];
            renderCampaigns();
        });
    }

    function populateFollowupTemplateSelect(select, selectedId = '') {
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('followupSelectTemplate');
        select.appendChild(placeholder);
        messageTemplates.filter(template => String(template.text || '').trim()).forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            select.appendChild(option);
        });
        if (messageTemplates.some(template => template.id === selectedId && String(template.text || '').trim())) select.value = selectedId;
    }

    function syncFollowupStepUi(index) {
        const enabled = document.getElementById(`followupStep${index}Enabled`).checked;
        const row = document.querySelector(`.followup-step[data-step="${index}"]`);
        row.classList.toggle('is-disabled', !enabled);
        ['Delay', 'Unit', 'Template'].forEach(suffix => {
            document.getElementById(`followupStep${index}${suffix}`).disabled = !enabled;
        });
    }

    function openFollowupModal(campaignId) {
        const campaign = followupCampaigns.find(item => item.id === campaignId);
        const textTemplates = messageTemplates.filter(template => String(template.text || '').trim());
        if (!campaign) return;
        if (textTemplates.length === 0) {
            showToast(t('followupNeedsTemplate'), 'error');
            setDashboardPane('templates');
            return;
        }
        editingFollowupCampaignId = campaignId;
        followupModalTitle.textContent = campaign.name || t('campaignUnnamed');
        const steps = Array.isArray(campaign.steps) ? campaign.steps : [];
        for (let index = 1; index <= 3; index++) {
            const step = steps[index - 1];
            const enabled = document.getElementById(`followupStep${index}Enabled`);
            const delayInput = document.getElementById(`followupStep${index}Delay`);
            const unitInput = document.getElementById(`followupStep${index}Unit`);
            const templateInput = document.getElementById(`followupStep${index}Template`);
            enabled.checked = Boolean(step) || (steps.length === 0 && index === 1);
            const delayMinutes = step ? Number(step.delayMinutes) : [1440, 4320, 10080][index - 1];
            const useDays = delayMinutes % 1440 === 0;
            unitInput.value = useDays ? 'days' : 'hours';
            delayInput.value = Math.max(1, Math.round(delayMinutes / (useDays ? 1440 : 60)));
            populateFollowupTemplateSelect(templateInput, step && step.templateId);
            if (!templateInput.value && index === 1) templateInput.value = textTemplates[0].id;
            syncFollowupStepUi(index);
        }
        const schedule = campaign.schedule || {};
        followupBusinessHours.checked = schedule.businessHoursEnabled !== false;
        followupStartTime.value = schedule.startTime || '09:00';
        followupEndTime.value = schedule.endTime || '18:00';
        followupIncludeWeekends.checked = Boolean(schedule.includeWeekends);
        followupConfirmAudience.checked = false;
        followupModal.style.display = 'flex';
    }

    function closeFollowupModal() {
        followupModal.style.display = 'none';
        editingFollowupCampaignId = '';
        followupConfirmAudience.checked = false;
    }

    function saveFollowupConfiguration() {
        if (!editingFollowupCampaignId) return;
        if (!followupConfirmAudience.checked) {
            showToast(t('followupConfirmRequired'), 'error');
            return;
        }
        if (followupBusinessHours.checked && followupStartTime.value >= followupEndTime.value) {
            showToast(t('followupInvalidHours'), 'error');
            return;
        }
        const steps = [];
        for (let index = 1; index <= 3; index++) {
            if (!document.getElementById(`followupStep${index}Enabled`).checked) continue;
            const delayValue = Math.max(1, Math.min(365, Math.round(Number(document.getElementById(`followupStep${index}Delay`).value) || 0)));
            const unit = document.getElementById(`followupStep${index}Unit`).value;
            const templateId = document.getElementById(`followupStep${index}Template`).value;
            const template = messageTemplates.find(item => item.id === templateId);
            if (!template || !String(template.text || '').trim()) {
                showToast(t('followupSelectAllTemplates'), 'error');
                return;
            }
            steps.push({
                id: `step_${index}`,
                delayMinutes: delayValue * (unit === 'hours' ? 60 : 1440),
                templateId: template.id,
                templateName: template.name,
                message: template.text
            });
        }
        if (steps.length === 0) {
            showToast(t('followupOneStepRequired'), 'error');
            return;
        }
        btnSaveFollowup.disabled = true;
        chrome.runtime.sendMessage({
            action: 'configure_followup_campaign',
            campaignId: editingFollowupCampaignId,
            steps,
            schedule: {
                businessHoursEnabled: followupBusinessHours.checked,
                startTime: followupStartTime.value,
                endTime: followupEndTime.value,
                includeWeekends: followupIncludeWeekends.checked
            }
        }, response => {
            btnSaveFollowup.disabled = false;
            if (chrome.runtime.lastError || !response || response.status !== 'configured') {
                showToast(t('followupSaveError'), 'error');
                return;
            }
            closeFollowupModal();
            showToast(t('followupActivated'), 'success');
            refreshFollowupCampaigns();
        });
    }

    function toggleFollowupCampaign(campaignId) {
        chrome.runtime.sendMessage({ action: 'toggle_followup_campaign', campaignId }, response => {
            if (!chrome.runtime.lastError && response && ['active', 'paused'].includes(response.status)) refreshFollowupCampaigns();
            else showToast(t('followupSaveError'), 'error');
        });
    }

    function deleteFollowupCampaign(campaign) {
        if (!confirm(t('campaignDeleteConfirm', { name: campaign.name || t('campaignUnnamed') }))) return;
        chrome.runtime.sendMessage({ action: 'delete_followup_campaign', campaignId: campaign.id }, response => {
            if (!chrome.runtime.lastError && response && response.status === 'deleted') {
                showToast(t('campaignDeleted'), 'info');
                refreshFollowupCampaigns();
            }
        });
    }

    function retryFollowupContact(campaignId, contactId) {
        chrome.runtime.sendMessage({ action: 'retry_followup_contact', campaignId, contactId }, response => {
            if (!chrome.runtime.lastError && response && response.status === 'queued') {
                showToast(t('campaignContactRetried'), 'success');
                refreshFollowupCampaigns();
            }
        });
    }

    function updateExtractionCompletionUI() {
        const ready = extractedData.length > 0 && !dashboardState.isExtracting;
        extractionActions.style.display = ready ? 'block' : 'none';
        if (ready) {
            const phoneCount = extractedData.filter(row => hasValidValue(row.telefone)).length;
            extractionSummary.textContent = t('completionSummary', { leads: extractedData.length, phones: phoneCount });
        }
    }

    dashboardSearch.addEventListener('input', renderDashboardLeadList);
    dashTabCurrent.addEventListener('click', () => setDashboardPane('current'));
    dashTabLists.addEventListener('click', () => setDashboardPane('lists'));
    dashTabTemplates.addEventListener('click', () => setDashboardPane('templates'));
    dashTabCampaigns.addEventListener('click', () => setDashboardPane('campaigns'));
    btnRefreshCampaigns.addEventListener('click', refreshFollowupCampaigns);
    btnCancelFollowup.addEventListener('click', closeFollowupModal);
    btnSaveFollowup.addEventListener('click', saveFollowupConfiguration);
    followupModal.addEventListener('click', event => {
        if (event.target === followupModal) closeFollowupModal();
    });
    for (let index = 1; index <= 3; index++) {
        document.getElementById(`followupStep${index}Enabled`).addEventListener('change', () => syncFollowupStepUi(index));
    }
    extractLimit.addEventListener('change', saveState);
    btnDashboardExport.addEventListener('click', () => downloadContactsCsv(extractedData, getDefaultListName('extracao_geolead')));
    btnDashboardSend.addEventListener('click', () => sendContactsToSender(extractedData, {
        sourceName: dashboardState.meta.query || t('defaultMapsLeads'),
        name: dashboardState.meta.query || t('defaultMapsLeads')
    }));
    btnDashboardPause.addEventListener('click', () => {
        const action = dashboardState.isPaused ? 'resume_extract' : 'pause_extract';
        chrome.runtime.sendMessage({ action }, response => {
            if (response && (response.status === 'paused' || response.status === 'resumed')) {
                dashboardState.isPaused = response.status === 'paused';
                renderDashboard();
            } else showToast(t('dashboardActionError'), 'error');
        });
    });
    btnDashboardStop.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stop_extract_control' }, response => {
            if (response && response.status === 'stopping') showToast(t('dashboardStopping'), 'info');
            else showToast(t('dashboardNoActiveExtraction'), 'error');
        });
    });

    btnMergeSelectedLists.addEventListener('click', () => {
        const selected = savedContactLists.filter(list => selectedSavedListIds.has(list.id));
        if (selected.length < 2) return;
        const merged = dedupeContacts(selected.flatMap(list => list.contacts || []));
        openContactListModal(merged, getDefaultListName(t('mergedListsDefault')), 'merge');
    });
    btnSaveExtractionList.addEventListener('click', () => openContactListModal(extractedData, getDefaultListName()));
    btnCancelContactList.addEventListener('click', closeContactListModal);
    contactListModal.addEventListener('click', event => {
        if (event.target === contactListModal) closeContactListModal();
    });
    contactListName.addEventListener('keydown', event => {
        if (event.key === 'Enter') btnConfirmContactList.click();
    });
    btnConfirmContactList.addEventListener('click', () => {
        const name = contactListName.value.trim();
        if (!name) {
            showToast(t('modalNameRequired'), 'error');
            contactListName.focus();
            return;
        }
        const now = Date.now();
        const completedMode = pendingListMode;
        savedContactLists.unshift({
            id: `list_${now}_${Math.random().toString(36).slice(2, 7)}`,
            name: name.slice(0, 60),
            createdAt: now,
            updatedAt: now,
            query: dashboardState.meta.query || '',
            contacts: dedupeContacts(pendingContactsForList)
        });
        savedContactLists = savedContactLists.slice(0, 50);
        selectedSavedListIds.clear();
        saveContactLists();
        closeContactListModal();
        setDashboardPane('lists');
        showToast(t(completedMode === 'merge' ? 'mergedListCreated' : 'dashboardListSaved'), 'success');
    });

    function addExtLog(msg, type = '') {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = msg;
        extractionTerminal.appendChild(div);
        extractionTerminal.scrollTop = extractionTerminal.scrollHeight;
    }

    const WEBSITE_ENRICH_ORIGINS = ['https://*/*', 'http://*/*'];
    let websiteEnrichmentPermissionGranted = false;
    if (chrome.permissions && chrome.permissions.contains) {
        chrome.permissions.contains({ origins: WEBSITE_ENRICH_ORIGINS }, granted => {
            websiteEnrichmentPermissionGranted = Boolean(granted);
        });
    }

    function requestWebsiteEnrichmentPermission() {
        if (websiteEnrichmentPermissionGranted) return Promise.resolve(true);
        if (!chrome.permissions || !chrome.permissions.request) {
            showToast(t('enrichmentPermissionUnavailable'), 'error');
            return Promise.resolve(false);
        }
        if (!confirm(t('enrichmentPermissionExplanation'))) {
            showToast(t('enrichmentPermissionDenied'), 'info');
            return Promise.resolve(false);
        }
        return new Promise(resolve => {
            chrome.permissions.request({ origins: WEBSITE_ENRICH_ORIGINS }, granted => {
                const accepted = !chrome.runtime.lastError && Boolean(granted);
                websiteEnrichmentPermissionGranted = accepted;
                showToast(t(accepted ? 'enrichmentPermissionGranted' : 'enrichmentPermissionDenied'), accepted ? 'success' : 'info');
                resolve(accepted);
            });
        });
    }

    let extractionAbortController = null;

    btnStartExtract.addEventListener('click', async () => {
        const query = extractQuery.value.trim();
        if (!query) {
            showToast('⚠️ Erro: Digite o que deseja buscar (ex: Dentistas em São Paulo).', 'error');
            extractQuery.focus();
            return;
        }

        const filterNoWebsite = document.getElementById('filterNoWebsite').checked;
        const reqPhone = document.getElementById('filterPhone').checked;
        const reqEmail = document.getElementById('filterEmail').checked;
        const reqSocial = document.getElementById('filterSocial').checked;
        const maxResults = Number(extractLimit.value) || 0;
        
        extractionTerminal.innerHTML = '';
        extractionActions.style.display = 'none';
        extractedData = [];
        
        btnStartExtract.disabled = true;
        btnStartExtract.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        btnStopExtract.style.display = 'block';
        addExtLog(`Iniciando varredura no servidor · meta ${maxResults || 'máxima disponível'}...`, 'system');
        
        chrome.runtime.sendMessage({
            action: 'start_extract',
            tabId: null,
            query: query,
            maxResults,
            filters: { noWebsite: filterNoWebsite, requirePhone: reqPhone, requireEmail: reqEmail, requireSocialMedia: reqSocial }
        }, async () => {
            refreshDashboardState();
            
            try {
                extractionAbortController = new AbortController();
                
                const url = new URL('http://82.29.61.16:3088/api/scrape-stream');
                url.searchParams.set('q', query);
                url.searchParams.set('limit', maxResults);
                url.searchParams.set('filterNoWebsite', filterNoWebsite ? '1' : '0');
                url.searchParams.set('requirePhone', reqPhone ? '1' : '0');
                url.searchParams.set('requireEmail', reqEmail ? '1' : '0');
                url.searchParams.set('requireSocial', reqSocial ? '1' : '0');

                const response = await fetch(url.toString(), {
                    signal: extractionAbortController.signal
                });

                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line

                    let currentEvent = null;
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEvent = line.substring(7).trim();
                        } else if (line.startsWith('data: ')) {
                            const dataStr = line.substring(6).trim();
                            if (currentEvent && dataStr) {
                                try {
                                    const data = JSON.parse(dataStr);
                                    if (currentEvent === 'log') {
                                        chrome.runtime.sendMessage({ type: 'EXTRACTION_LOG', message: data.message });
                                    } else if (currentEvent === 'progress') {
                                        chrome.runtime.sendMessage({ type: 'EXTRACTION_PROGRESS', payload: data });
                                    } else if (currentEvent === 'finish') {
                                        chrome.runtime.sendMessage({ type: 'EXTRACTION_FINISHED', payload: data });
                                    } else if (currentEvent === 'error') {
                                        chrome.runtime.sendMessage({ type: 'EXTRACTION_LOG', message: `❌ Erro do servidor: ${data.message}` });
                                    }
                                } catch (e) {
                                    console.error('Error parsing SSE data', e);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    addExtLog('⚠️ Extração interrompida pelo usuário.', 'error');
                } else {
                    addExtLog(`⚠️ Falha na conexão com o servidor: ${error.message}`, 'error');
                }
                chrome.runtime.sendMessage({ type: 'EXTRACTION_FINISHED', payload: { success: false, finishReason: 'user_stopped', data: extractedData } });
            } finally {
                extractionAbortController = null;
            }
        });
    });

    btnStopExtract.addEventListener('click', () => {
        addExtLog('⚠️ Encerrando a extração...', 'error');
        btnStopExtract.style.display = 'none';
        if (extractionAbortController) {
            extractionAbortController.abort();
            extractionAbortController = null;
        }
        chrome.runtime.sendMessage({ type: 'EXTRACTION_FINISHED', payload: { success: false, finishReason: 'user_stopped', data: extractedData } });
    });

    function resetExtractBtn() {
        btnStartExtract.disabled = false;
        btnStartExtract.innerHTML = '<i class="fas fa-magnifying-glass"></i> Buscar Leads';
        btnStopExtract.style.display = 'none';
    }

    chrome.runtime.onMessage.addListener(request => {
        if (request.type === 'FWD_EXTRACTION_LOG') {
            let type = '';
            if (request.message.includes('❌')) type = 'error';
            if (request.message.includes('✅')) type = 'system';
            addExtLog(request.message, type);
        } else if (request.type === 'FWD_EXTRACTION_PROGRESS') {
            if (Array.isArray(request.data)) extractedData = dedupeContacts(request.data);
            dashboardState = {
                isExtracting: true,
                isPaused: Boolean(request.isPaused),
                progress: request.payload || dashboardState.progress,
                meta: request.meta || dashboardState.meta
            };
            renderDashboard();
        } else if (request.type === 'FWD_EXTRACTION_FINISHED') {
            resetExtractBtn();
            if (request.payload && request.payload.success) {
                extractedData = dedupeContacts(request.payload.data || []);
                dashboardState.isExtracting = false;
                const finishTarget = Number(dashboardState.progress.target) || 0;
                const finishPercent = finishTarget ? Math.min(100, Math.round((extractedData.length / finishTarget) * 100)) : 100;
                const finishStage = request.payload.finishReason === 'user_stopped' ? 'stopped' : 'completed';
                dashboardState.progress = { ...dashboardState.progress, percent: finishPercent, indeterminate: false, stage: finishStage };
                updateExtractionCompletionUI();
                if (document.getElementById('autoSendAfter').checked && extractedData.length > 0) {
                    addExtLog('Iniciando auto-disparo...', 'system');
                    if (sendContactsToSender(extractedData, {
                        sourceName: dashboardState.meta.query || t('defaultMapsLeads'),
                        name: dashboardState.meta.query || t('defaultMapsLeads')
                    })) {
                        setTimeout(() => {
                            if (!startBtn.disabled) startBtn.click();
                            else showToast('Configure uma mensagem de texto ou áudio antes do disparo automático.', 'error');
                        }, 800);
                    }
                }
            }
            renderDashboard();
            refreshDashboardState();
        } else if (request.type === 'FOLLOWUP_CAMPAIGNS_UPDATED') {
            refreshFollowupCampaigns();
        }
    });

    btnDownloadExtracted.addEventListener('click', () => downloadContactsCsv(extractedData, getDefaultListName('extracao_geolead')));
    btnSendToSendList.addEventListener('click', () => sendContactsToSender(extractedData, {
        sourceName: dashboardState.meta.query || t('defaultMapsLeads'),
        name: dashboardState.meta.query || t('defaultMapsLeads')
    }));

    // --- CUSTOM COUNTRY SELECT LOGIC ---
    const customCountrySelect = document.getElementById('customCountrySelect');
    const countryCodeDisplay = document.getElementById('countryCodeDisplay');
    const countryCodeList = document.getElementById('countryCodeList');
    const countryCodeInput = document.getElementById('countryCode');

    if (customCountrySelect && countryCodeDisplay && countryCodeList && countryCodeInput) {
        countryCodeDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            countryCodeList.classList.toggle('show');
        });

        countryCodeList.querySelectorAll('li').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.getAttribute('data-value');
                const cc = item.getAttribute('data-cc');
                const code = item.getAttribute('data-code');
                countryCodeInput.value = value;
                countryCodeDisplay.innerHTML = `<img src="https://flagcdn.com/w20/${cc}.png" width="20" alt="${cc.toUpperCase()}"> ${code}`;
                countryCodeList.classList.remove('show');
            });
        });

        document.addEventListener('click', () => {
            countryCodeList.classList.remove('show');
        });
    }

    // --- FUNÇÃO GLOBAL DE TOAST ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        if (type === 'error') icon = 'fas fa-exclamation-circle';

        toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

});
