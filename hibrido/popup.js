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
    
    let mediaRecorder = null;
    let audioChunks = [];
    let recordInterval = null;
    let recordSeconds = 0;
    
    let currentMode = 'text';
    let currentAttachment = null;
    let currentAudio = null;

    // Recupera dados salvos
    chrome.storage.local.get([
        'savedPhones', 'savedMessage', 'savedDelay', 'savedAttachment', 'savedAudio', 'savedMode',
        'savedUseRandomDelay', 'savedDelayMin', 'savedDelayMax', 'savedDelayUnitRandom',
        'savedUsePause', 'savedPauseDuration', 'savedPauseEvery',
        'savedFilterPhone', 'savedFilterEmail', 'savedFilterSocial'
    ], (data) => {
        if (data.savedPhones) {
            phoneList = data.savedPhones;
            renderPhones();
        }
        if (data.savedMessage) messageInput.value = data.savedMessage;
        if (data.savedDelayValue) delayValue.value = data.savedDelayValue;
        if (data.savedDelayUnit) delayUnit.value = data.savedDelayUnit;
        
        if (data.savedUseRandomDelay) {
            useRandomDelay.checked = data.savedUseRandomDelay;
            toggleRandomDelayUI();
        }
        if (data.savedDelayMin) delayMin.value = data.savedDelayMin;
        if (data.savedDelayMax) delayMax.value = data.savedDelayMax;
        if (data.savedDelayUnitRandom) delayUnitRandom.value = data.savedDelayUnitRandom;
        
        if (data.savedUsePause) {
            usePause.checked = data.savedUsePause;
            togglePauseUI();
        }
        if (data.savedPauseDuration) pauseDuration.value = data.savedPauseDuration;
        if (data.savedPauseEvery) pauseEvery.value = data.savedPauseEvery;
        
        if (data.savedFilterPhone) filterPhone.checked = data.savedFilterPhone;
        if (data.savedFilterEmail) filterEmail.checked = data.savedFilterEmail;
        if (data.savedFilterSocial) filterSocial.checked = data.savedFilterSocial;

        if (data.savedAttachment) {
            currentAttachment = data.savedAttachment;
            attachmentName.innerText = currentAttachment.name;
            btnRemoveAttach.style.display = 'inline-block';
        }
        if (data.savedAudio) {
            currentAudio = data.savedAudio;
            audioPreview.src = currentAudio.data;
            audioPreview.style.display = 'block';
            btnRemoveAudio.style.display = 'inline-block';
        }
        if (data.savedMode) {
            setMode(data.savedMode);
        }
        checkReady();
        
        // Sync Extractor State
        chrome.runtime.sendMessage({ action: 'get_ext_state' }, (res) => {
            if (res) {
                if (res.isExtracting) {
                    btnStartExtract.disabled = true;
                    btnStartExtract.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extraindo...';
                    btnStopExtract.style.display = 'block';
                    extractionTerminal.innerHTML = '';
                    res.extLogs.forEach(log => {
                        let type = '';
                        if (log.includes('❌')) type = 'error';
                        if (log.includes('✅')) type = 'system';
                        addExtLog(log, type);
                    });
                } else if (res.extData.length > 0) {
                    extractedData = res.extData;
                    extractionActions.style.display = 'flex';
                    extractionTerminal.innerHTML = '';
                    res.extLogs.forEach(log => {
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
        }
        saveState();
        checkReady();
    }

    tabText.addEventListener('click', () => setMode('text'));
    tabAudio.addEventListener('click', () => setMode('audio'));
    
    function toggleRandomDelayUI() {
        if (useRandomDelay.checked) {
            fixedDelayContainer.style.display = 'none';
            randomDelayContainer.style.display = 'flex';
        } else {
            fixedDelayContainer.style.display = 'flex';
            randomDelayContainer.style.display = 'none';
        }
        saveState();
    }
    
    function togglePauseUI() {
        if (usePause.checked) {
            pauseContainer.style.display = 'flex';
        } else {
            pauseContainer.style.display = 'none';
        }
        saveState();
    }

    useRandomDelay.addEventListener('change', toggleRandomDelayUI);
    usePause.addEventListener('change', togglePauseUI);

    function cleanPhone(phone) {
        return phone.replace(/\D/g, '');
    }

    function addPhones(rawList) {
        let added = false;
        rawList.forEach(p => {
            let clean = cleanPhone(String(p));
            if (clean.length === 10 || clean.length === 11) {
                clean = '55' + clean;
            }
            if (clean.length >= 12 && clean.length <= 15 && !phoneList.includes(clean)) {
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
        renderPhones();
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
            savedMode: currentMode
        });
    }

    btnAddPhone.addEventListener('click', () => {
        if (phoneInput.value.trim() !== '') {
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
            attachmentName.innerText = file.name;
            btnRemoveAttach.style.display = 'inline-block';
            saveState();
        };
        reader.readAsDataURL(file);
    });

    btnRemoveAttach.addEventListener('click', () => {
        currentAttachment = null;
        attachmentInput.value = '';
        attachmentName.innerText = 'Nenhum anexo selecionado';
        btnRemoveAttach.style.display = 'none';
        saveState();
    });

    function updateTimer() {
        recordSeconds++;
        const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const s = String(recordSeconds % 60).padStart(2, '0');
        recordTimer.innerText = `${m}:${s}`;
    }

    btnRecordAudio.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                const reader = new FileReader();
                reader.onload = (evt) => {
                    currentAudio = {
                        name: 'audio_gravado.mp3',
                        type: 'audio/mpeg',
                        data: evt.target.result
                    };
                    audioPreview.src = evt.target.result;
                    audioPreview.style.display = 'block';
                    btnRemoveAudio.style.display = 'inline-block';
                    saveState();
                    checkReady();
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            btnRecordAudio.style.display = 'none';
            btnStopRecord.style.display = 'inline-block';
            recordSeconds = 0;
            recordTimer.innerText = '00:00';
            recordInterval = setInterval(updateTimer, 1000);
            
            audioPreview.style.display = 'none';
            audioPreview.src = '';
            currentAudio = null;
            btnRemoveAudio.style.display = 'none';
            checkReady();
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.toLowerCase().includes('permission')) {
                chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
            } else {
                showToast('Não foi possível acessar o microfone: ' + err.message, "error");
            }
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
        audioPreview.style.display = 'none';
        audioPreview.src = '';
        btnRemoveAudio.style.display = 'none';
        saveState();
        checkReady();
    });

    function checkReady() {
        const msg = messageInput.value.trim();
        const hasText = msg !== '';
        const hasAudio = currentAudio !== null;
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
    delayValue.addEventListener('input', saveState);
    delayUnit.addEventListener('change', saveState);
    delayMin.addEventListener('input', saveState);
    delayMax.addEventListener('input', saveState);
    delayUnitRandom.addEventListener('change', saveState);
    pauseDuration.addEventListener('input', saveState);
    pauseEvery.addEventListener('input', saveState);
    filterPhone.addEventListener('change', saveState);
    filterEmail.addEventListener('change', saveState);
    filterSocial.addEventListener('change', saveState);

    function updateUI() {
        chrome.runtime.sendMessage({ action: 'get_state' }, (res) => {
            if (chrome.runtime.lastError || !res) return;
            
            sentCount.innerText = res.successCount;
            errCount.innerText = res.errorCount;
            
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
                tabText.disabled = true;
                tabAudio.disabled = true;
                
                chrome.storage.local.get(['whatsappQueue'], (data) => {
                    if (data.whatsappQueue && data.whatsappQueue.length !== phoneList.length) {
                        phoneList = data.whatsappQueue.map(q => q.phone);
                        renderPhones();
                    }
                });
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
                tabText.disabled = false;
                tabAudio.disabled = false;
                checkReady();
            }
        });
    }

    setInterval(updateUI, 1000);
    updateUI();

    startBtn.addEventListener('click', () => {
        if (startBtn.disabled) return;
        
        chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                showToast("Por favor, abra uma aba do WhatsApp Web primeiro!", "error");
                return;
            }
            
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
                if (chrome.runtime.lastError) {
                    showToast("Você precisa recarregar (apertar F5) a aba do WhatsApp Web para funcionar.", "error");
                    return;
                }
                
                let msg = '';
                let audio = null;
                if (currentMode === 'text') {
                    msg = messageInput.value.trim();
                } else if (currentMode === 'audio') {
                    audio = currentAudio;
                }
                
                const queue = phoneList.map(phone => ({ phone, message: msg }));
                const delay = {
                    random: useRandomDelay.checked,
                    value: parseInt(delayValue.value) || 10,
                    unit: parseInt(delayUnit.value) || 1,
                    min: parseInt(delayMin.value) || 10,
                    max: parseInt(delayMax.value) || 23,
                    randomUnit: parseInt(delayUnitRandom.value) || 1
                };
                const pauseConfig = {
                    enabled: usePause.checked,
                    duration: parseInt(pauseDuration.value) || 5,
                    every: parseInt(pauseEvery.value) || 30
                };

                chrome.runtime.sendMessage({ action: 'start', queue, delay, pauseConfig, attachment: currentAttachment, audio: audio }, (res) => {
                    if (res && res.status === 'started') {
                        updateUI();
                    }
                });
            });
        });
    });

    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stop' }, () => {
            updateUI();
        });
    });

    // ==========================================
    // LÓGICA DAS ABAS (EXTRATOR VS DISPARADOR)
    // ==========================================
    const navExtractor = document.getElementById('navExtractor');
    const navSender = document.getElementById('navSender');
    const viewExtractor = document.getElementById('viewExtractor');
    const viewSender = document.getElementById('viewSender');

    navExtractor.addEventListener('click', () => {
        navExtractor.classList.add('active');
        navSender.classList.remove('active');
        viewExtractor.style.display = 'block';
        viewSender.style.display = 'none';
    });

    navSender.addEventListener('click', () => {
        navSender.classList.add('active');
        navExtractor.classList.remove('active');
        viewSender.style.display = 'block';
        viewExtractor.style.display = 'none';
    });

    // --- TRADUÇÃO (i18n) ---
    const translations = {
        pt: {
            navExtractor: "1. Extrator",
            navSender: "2. Disparador",
            titleExtract: "Buscar Leads no Google Maps",
            helpText1: "1. Digite o que deseja buscar e clique na lupa para abrir o Maps.",
            placeholderSearch: "Ex: Dentistas em São Paulo",
            helpText2: "2. Com a página do Maps aberta e os resultados carregados, ajuste os filtros e clique abaixo:",
            filterNoWebsite: "Ignorar perfis que possuem site",
            autoSendAfter: "Começar disparo automático ao terminar",
            btnStartExtract: "Iniciar Extração na Aba Atual",
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
            btnAttach: "Anexar",
            noAttachment: "Nenhum anexo selecionado",
            btnRecord: "Gravar Áudio",
            btnStopRecord: "Parar Gravação",
            tipAudio: "O áudio será enviado como se tivesse sido gravado na hora!",
            msgWarning: "Você precisa definir uma mensagem de texto ou um áudio.",
            delayLabel: "Intervalo de Envio",
            btnStartSend: "Iniciar Disparos",
            btnStopSend: "Parar",
            statSent: "Enviados",
            statErrors: "Falhas"
        },
        en: {
            navExtractor: "1. Extractor",
            navSender: "2. Sender",
            titleExtract: "Search Leads on Google Maps",
            helpText1: "1. Type what you want to search and click the glass to open Maps.",
            placeholderSearch: "E.g. Dentists in New York",
            helpText2: "2. With Maps open and results loaded, adjust filters and click below:",
            filterNoWebsite: "Ignore profiles that have a website",
            autoSendAfter: "Start auto-sending when finished",
            btnStartExtract: "Start Extraction in Current Tab",
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
            btnAttach: "Attach",
            noAttachment: "No attachment selected",
            btnRecord: "Record Audio",
            btnStopRecord: "Stop Recording",
            tipAudio: "The audio will be sent as if it was recorded right now!",
            msgWarning: "You need to define a text message or an audio.",
            delayLabel: "Sending Interval",
            btnStartSend: "Start Sending",
            btnStopSend: "Stop",
            statSent: "Sent",
            statErrors: "Failed"
        }
    };

    const langSelect = document.getElementById('langSelect');
    
    function applyTranslations(lang) {
        const dict = translations[lang] || translations.pt;
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
            delayUnit.options[0].text = lang === 'en' ? 'Seconds' : 'Segundos';
            delayUnit.options[1].text = lang === 'en' ? 'Minutes' : 'Minutos';
        }
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
    
    let glUserId = 'anonymous';
    // Substitua pelo IP da sua VPS quando for fazer o deploy final
    const SERVER_URL = 'https://limiarcode.com.br';

    function checkLicense() {
        chrome.storage.sync.get(['gl_trial_start', 'gl_user_id', 'gl_license_email'], (res) => {
            if (res.gl_user_id) glUserId = res.gl_user_id;

            // Já ativou o e-mail antes?
            if (res.gl_license_email) {
                licenseOverlay.style.display = 'none';
                return;
            }

            let trialStart = res.gl_trial_start;
            // Se por algum motivo o background falhou em salvar, o popup salva na hora
            if (!trialStart) {
                trialStart = Date.now();
                chrome.storage.sync.set({ gl_trial_start: trialStart });
            }

            const now = Date.now();
            const elapsed = now - trialStart;
            const trialDuration = 48 * 60 * 60 * 1000; // 48 horas de teste grátis

            if (elapsed > trialDuration) {
                licenseOverlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                licenseOverlay.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Checa a cada 1 segundo em tempo real (para bloquear mesmo se o cliente estiver com a extensão aberta)
    setInterval(checkLicense, 1000);

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
                    // Mantém o loading por 1 segundo para dar sensação de processamento
                    setTimeout(() => {
                        licenseOverlay.style.display = 'none';
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
    });

    checkLicense();
    // --- FIM SISTEMA DE LICENÇA ---

    // ==========================================
    // ESTADO E VARIÁVEIS GERAIS
    // ==========================================
    const btnStartExtract = document.getElementById('btnStartExtract');
    const btnStopExtract = document.getElementById('btnStopExtract');
    const btnSearchMaps = document.getElementById('btnSearchMaps');
    const extractQuery = document.getElementById('extractQuery');
    const extractionTerminal = document.getElementById('extractionTerminal');
    const extractionActions = document.getElementById('extractionActions');
    const btnDownloadExtracted = document.getElementById('btnDownloadExtracted');
    const btnSendToSendList = document.getElementById('btnSendToSendList');
    
    let extractedData = [];

    function addExtLog(msg, type = '') {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = msg;
        extractionTerminal.appendChild(div);
        extractionTerminal.scrollTop = extractionTerminal.scrollHeight;
    }

    btnSearchMaps.addEventListener('click', () => {
        const query = extractQuery.value.trim();
        let url = 'https://www.google.com/maps';
        if (query) {
            url += `/search/${encodeURIComponent(query)}`;
        }
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('/maps')) {
                chrome.tabs.update(tabs[0].id, { url });
            } else {
                chrome.tabs.create({ url });
            }
        });
    });

    btnStartExtract.addEventListener('click', async () => {
        const filterNoWebsite = document.getElementById('filterNoWebsite').checked;
        
        extractionTerminal.innerHTML = '';
        extractionActions.style.display = 'none';
        extractedData = [];
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (!activeTab || !activeTab.url || !activeTab.url.includes('/maps')) {
                addExtLog("⚠️ Erro: Você precisa estar em uma aba do Google Maps para extrair.", "error");
                return;
            }
            
            btnStartExtract.disabled = true;
            btnStartExtract.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extraindo...';
            btnStopExtract.style.display = 'block';
            addExtLog("Iniciando injeção do extrator...", "system");
            
            const reqPhone = document.getElementById('filterPhone').checked;
            const reqEmail = document.getElementById('filterEmail').checked;
            const reqSocial = document.getElementById('filterSocial').checked;

            // Avisa o background que vai começar
            chrome.runtime.sendMessage({ action: 'start_extract' }, () => {
                // Injeta na aba
                chrome.tabs.sendMessage(activeTab.id, { 
                    action: 'START_EXTRACTION', 
                    filterNoWebsite,
                    requirePhone: reqPhone,
                    requireEmail: reqEmail,
                    requireSocialMedia: reqSocial
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        addExtLog("⚠️ Erro: Recarregue a aba do Google Maps (F5) e tente novamente.", "error");
                        resetExtractBtn();
                        chrome.runtime.sendMessage({ action: 'reset_extract' });
                    } else {
                        addExtLog("Script iniciado na página. Aguarde...", "system");
                    }
                });
            });
        });
    });

    btnStopExtract.addEventListener('click', () => {
        addExtLog("⚠️ Parando a extração...", "error");
        btnStopExtract.style.display = 'none';
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.url && activeTab.url.includes('/maps')) {
                chrome.tabs.sendMessage(activeTab.id, { action: 'STOP_EXTRACTION' });
            }
        });
    });

    function resetExtractBtn() {
        btnStartExtract.disabled = false;
        btnStartExtract.innerHTML = '<i class="fas fa-cogs"></i> Iniciar Extração na Aba Atual';
        btnStopExtract.style.display = 'none';
    }

    // Ouvir logs e resultado final do background.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'FWD_EXTRACTION_LOG') {
            let type = '';
            if (request.message.includes('❌')) type = 'error';
            if (request.message.includes('✅')) type = 'system';
            addExtLog(request.message, type);
        } else if (request.type === 'FWD_EXTRACTION_FINISHED') {
            resetExtractBtn();
            if (request.payload.success) {
                extractedData = request.payload.data;
                if (extractedData.length > 0) {
                    extractionActions.style.display = 'flex';
                    
                    const autoSend = document.getElementById('autoSendAfter').checked;
                    if (autoSend) {
                        addExtLog("Iniciando auto-disparo...", "system");
                        // 1. Envia pra lista
                        btnSendToSendList.click();
                        // 2. Inicia disparo
                        setTimeout(() => {
                            if (!startBtn.disabled) {
                                startBtn.click();
                            } else {
                                showToast("O disparo automático parou porque você não configurou uma mensagem (texto ou áudio) na aba do Disparador!", "error");
                            }
                        }, 800);
                    }
                }
            }
        }
    });

    // Baixar CSV
    btnDownloadExtracted.addEventListener('click', () => {
        if (extractedData.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,NOME;TELEFONE;EMAIL;REDES_SOCIAIS\n";
        extractedData.forEach(row => {
            csvContent += `"${row.nome}";"${row.telefone}";"${row.email || ''}";"${row.social || ''}"\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `extracao_maps_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });

    // Enviar para a aba de Disparos
    btnSendToSendList.addEventListener('click', () => {
        if (extractedData.length === 0) return;
        
        let phonesToAdd = [];
        extractedData.forEach(row => {
            const cleanPhone = cleanPhoneLocal(row.telefone);
            if (cleanPhone && cleanPhone.length >= 10) {
                phonesToAdd.push(cleanPhone);
            }
        });
        
        if (phonesToAdd.length > 0) {
            addPhones(phonesToAdd);
            showToast(`${phonesToAdd.length} contatos válidos foram enviados para o Disparador!`, "success");
        } else {
            showToast("Nenhum contato válido encontrado.", "error");
        }
        navSender.click(); // Muda de aba automaticamente
    });

    function cleanPhoneLocal(phone) {
        return phone.replace(/\D/g, '');
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
