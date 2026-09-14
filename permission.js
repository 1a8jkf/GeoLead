document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        language: document.getElementById('language'),
        eyebrow: document.getElementById('eyebrow'),
        title: document.getElementById('permissionTitle'),
        description: document.getElementById('permissionDescription'),
        deviceTitle: document.getElementById('deviceTitle'),
        deviceLabel: document.getElementById('deviceLabel'),
        deviceCount: document.getElementById('deviceCount'),
        tipOne: document.getElementById('tipOne'),
        tipTwo: document.getElementById('tipTwo'),
        tipThree: document.getElementById('tipThree'),
        allow: document.getElementById('btnAllow'),
        retry: document.getElementById('btnRetry'),
        status: document.getElementById('status')
    };

    const copy = {
        pt: {
            eyebrow: 'Diagnóstico de áudio', title: 'Configure o microfone do GeoLead',
            description: 'Teste a entrada de áudio em uma página própria e volte ao Disparador quando o acesso estiver confirmado.',
            deviceTitle: 'Entradas de áudio detectadas', checking: 'Verificando os dispositivos disponíveis…',
            none: 'Nenhum microfone ativo foi encontrado pelo Chrome.', one: '1 entrada disponível', many: '{count} entradas disponíveis',
            unnamed: 'Microfone sem identificação', tipOne: 'Conecte ou habilite um microfone nas configurações do sistema.',
            tipTwo: 'Permita o microfone para esta página quando o Chrome solicitar.', tipThree: 'Feche outros aplicativos que possam estar usando a entrada de áudio.',
            allow: 'Testar e liberar microfone', retry: 'Atualizar dispositivos', testing: 'Testando…',
            success: 'Microfone “{label}” pronto. Você já pode fechar esta página e voltar ao Disparador.',
            notFound: 'O Chrome não encontrou um dispositivo de entrada. Conecte ou habilite um microfone no sistema e clique em “Atualizar dispositivos”.',
            denied: 'O acesso foi bloqueado. Use o controle de permissões ao lado do endereço desta página, permita o microfone e tente novamente.',
            busy: 'O dispositivo existe, mas não pôde ser aberto. Feche outros aplicativos de áudio ou selecione outra entrada.',
            generic: 'Não foi possível abrir o microfone: {message}', unavailable: 'Este navegador não disponibiliza a captura de microfone para a extensão.'
        },
        en: {
            eyebrow: 'Audio diagnostics', title: 'Set up the GeoLead microphone',
            description: 'Test the audio input on a dedicated page and return to Sender after access is confirmed.',
            deviceTitle: 'Detected audio inputs', checking: 'Checking available devices…',
            none: 'Chrome did not find an active microphone.', one: '1 input available', many: '{count} inputs available',
            unnamed: 'Unidentified microphone', tipOne: 'Connect or enable a microphone in the operating system settings.',
            tipTwo: 'Allow microphone access for this page when Chrome asks.', tipThree: 'Close other apps that may be using the audio input.',
            allow: 'Test and allow microphone', retry: 'Refresh devices', testing: 'Testing…',
            success: 'Microphone “{label}” is ready. You can close this page and return to Sender.',
            notFound: 'Chrome did not find an input device. Connect or enable a microphone in the system, then click “Refresh devices”.',
            denied: 'Access was blocked. Use the permission control beside this page address, allow the microphone, and try again.',
            busy: 'The device exists but could not be opened. Close other audio apps or select another input.',
            generic: 'Could not open the microphone: {message}', unavailable: 'This browser does not make microphone capture available to the extension.'
        }
    };
    let language = 'pt';

    function t(key, replacements = {}) {
        return String(copy[language][key] || key).replace(/\{(\w+)\}/g, (_match, name) => replacements[name] ?? `{${name}}`);
    }

    function applyLanguage(nextLanguage) {
        language = copy[nextLanguage] ? nextLanguage : 'pt';
        document.documentElement.lang = language === 'en' ? 'en' : 'pt-BR';
        document.title = language === 'en' ? 'Set up microphone · GeoLead' : 'Configurar microfone · GeoLead';
        elements.eyebrow.textContent = t('eyebrow');
        elements.title.textContent = t('title');
        elements.description.textContent = t('description');
        elements.deviceTitle.textContent = t('deviceTitle');
        elements.tipOne.textContent = t('tipOne');
        elements.tipTwo.textContent = t('tipTwo');
        elements.tipThree.textContent = t('tipThree');
        elements.allow.textContent = t('allow');
        elements.retry.textContent = t('retry');
        refreshDevices();
    }

    function setStatus(type, message) {
        elements.status.className = type;
        elements.status.textContent = message;
    }

    async function refreshDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            elements.deviceCount.textContent = '0';
            elements.deviceLabel.textContent = t('unavailable');
            setStatus('error', t('unavailable'));
            return [];
        }
        elements.deviceLabel.textContent = t('checking');
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(device => device.kind === 'audioinput');
            elements.deviceCount.textContent = String(inputs.length);
            if (!inputs.length) elements.deviceLabel.textContent = t('none');
            else elements.deviceLabel.textContent = inputs.length === 1 ? t('one') : t('many', { count: inputs.length });
            return inputs;
        } catch (error) {
            elements.deviceCount.textContent = '0';
            elements.deviceLabel.textContent = t('generic', { message: error.message || error.name });
            return [];
        }
    }

    async function requestAccess() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('error', t('unavailable'));
            return;
        }
        elements.allow.disabled = true;
        elements.retry.disabled = true;
        elements.allow.textContent = t('testing');
        setStatus('info', t('checking'));
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            const track = stream.getAudioTracks()[0];
            const label = (track && track.label) || t('unnamed');
            stream.getTracks().forEach(item => item.stop());
            await refreshDevices();
            setStatus('success', t('success', { label }));
        } catch (error) {
            const errorName = String(error && error.name || '');
            if (errorName === 'NotFoundError' || errorName === 'OverconstrainedError') setStatus('error', t('notFound'));
            else if (errorName === 'NotAllowedError' || errorName === 'SecurityError') setStatus('error', t('denied'));
            else if (errorName === 'NotReadableError' || errorName === 'AbortError') setStatus('error', t('busy'));
            else setStatus('error', t('generic', { message: error.message || errorName || 'erro desconhecido' }));
            await refreshDevices();
        } finally {
            elements.allow.disabled = false;
            elements.retry.disabled = false;
            elements.allow.textContent = t('allow');
        }
    }

    elements.allow.addEventListener('click', requestAccess);
    elements.retry.addEventListener('click', refreshDevices);
    elements.language.addEventListener('change', () => {
        chrome.storage.local.set({ geoLeadLang: elements.language.value });
        applyLanguage(elements.language.value);
    });
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    }

    chrome.storage.local.get(['geoLeadLang'], (stored) => {
        elements.language.value = stored.geoLeadLang === 'en' ? 'en' : 'pt';
        applyLanguage(elements.language.value);
        if (new URLSearchParams(location.search).get('reason') === 'not-found') setStatus('error', t('notFound'));
    });
});
