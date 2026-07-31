document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.authReady;
    if (!auth) return;

    const resultDiv = document.getElementById('result');
    const currentStationIdInput = document.getElementById('currentStationId');
    const videoElement = document.getElementById('reader');
    const setStationBtn = document.getElementById('setStationBtn');
    let currentStation = auth.profile.station || '';
    let isProcessing = false;
    let restartTimer = null;

    currentStationIdInput.value = currentStation;

    setStationBtn.addEventListener('click', () => {
        currentStation = currentStationIdInput.value.trim();
        if (currentStation) {
            stopScanner(); // Stop current scanner before restarting with new station
            isProcessing = false;
            localStorage.setItem('scannerStationId', currentStation);
            alert(`Estación del escáner establecida a: ${currentStation}`);
            startScanner(); // Reiniciar escáner con la nueva estación
        } else {
            alert('Por favor, ingresa la estación actual.');
        }
    });

    // Instancia del nuevo escáner
    const qrScanner = new QrScanner(
        videoElement,
        async result => {
            if (isProcessing) return;
            isProcessing = true;
            console.log(`QR Code detectado: ${result.data}`);
            stopScanner();

            try {
                await processScannedVoucher(result.data);
            } finally {
                restartTimer = window.setTimeout(() => {
                    isProcessing = false;
                    startScanner();
                }, 4000);
            }
        },
        {
            preferredCamera: 'environment',
            maxScansPerSecond: 5,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            // Consider adding a throttle or debounce if rapid scans are an issue
            // delay: 500, // Example: wait 500ms before next scan attempt
        }
    );

    function stopScanner() {
        if (restartTimer) {
            window.clearTimeout(restartTimer);
            restartTimer = null;
        }
        qrScanner.stop();
        console.log('Escáner detenido.');
    }

    function startScanner() {
        if (!currentStation) {
            resultDiv.innerHTML = '<p class="error">Por favor, establece la estación actual del escáner.</p>';
            return;
        }

        resultDiv.innerHTML = '<p class="scanning">Cámara activa. Acerque un código QR...</p>';
        // Iniciar el nuevo escáner
        qrScanner.start().catch(err => {
            isProcessing = false;
            resultDiv.innerHTML = `<p class="error">No se pudo iniciar la cámara. Permite el acceso a la cámara y abre esta página mediante HTTPS o localhost.<br><small>${err.message || err}</small></p>`;
            console.error('Error starting QR scanner:', err);
        });
    }

    const getSupabaseClient = () => {
        return window.supabaseClient || null;
    };

    async function processScannedVoucher(qrContent) {
        let voucherData;
        try {
            voucherData = JSON.parse(qrContent);
        } catch (e) {
            resultDiv.innerHTML = '<p class="error">QR inválido: No es un formato de vale reconocido. Asegúrate de escanear un QR generado por esta aplicación.</p>';
            console.error('JSON parsing error for QR content:', qrContent, e);
            return;
        }

        if (!voucherData || !voucherData.id || !voucherData.station) {
            resultDiv.innerHTML = '<p class="error">QR inválido: Faltan datos del vale (ID o Estación). El QR debe contener `{ "id": "...", "station": "..." }`.</p>';
            console.error('Missing ID or Station in QR data:', voucherData);
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            resultDiv.innerHTML = '<p class="warning">No hay conexión disponible con la base de datos. No se pudo verificar el vale.</p>';
            return;
        }

        // Validar y canjear en una sola operación atómica en PostgreSQL.
        let redemption;
        let error;
        try {
            ({ data: redemption, error } = await client.rpc('redeem_voucher', {
                voucher_id: voucherData.id,
                scanner_station: currentStation
            }));
        } catch (requestError) {
            error = requestError;
        }

        if (error) {
            resultDiv.innerHTML = `<p class="error">No se pudo verificar el código QR en Supabase. Revisa tu conexión.</p>`;
            console.error('Error fetching voucher:', error);
            return;
        }

        const result = Array.isArray(redemption) ? redemption[0] : redemption;
        if (!result || !result.success) {
            const messages = {
                not_found: 'CÓDIGO QR NO VÁLIDO: el vale no existe.',
                expired: 'CÓDIGO QR VENCIDO: el vale ya expiró.',
                already_redeemed: `CÓDIGO QR YA UTILIZADO: el vale "${voucherData.id}" ya fue canjeado.`,
                wrong_station: 'CÓDIGO QR DE OTRA ESTACIÓN: no puede canjearse aquí.',
                unauthorized: 'Tu usuario no tiene permiso para canjear vales.',
                unauthorized_station: 'Tu usuario no está autorizado para operar esta estación.'
            };
            const messageClass = result?.status === 'already_redeemed' ? 'warning' : 'error';
            resultDiv.innerHTML = `<p class="${messageClass}">${messages[result?.status] || 'No se pudo canjear el vale.'}<br><small>El escáner se reactivará en 4 segundos.</small></p>`;
            return;
        }

        resultDiv.innerHTML = `<p class="success">CÓDIGO QR VÁLIDO<br>Vale "${voucherData.id}" canjeado correctamente en "${currentStation}".<br><small>El escáner se reactivará en 4 segundos.</small></p>`;
        console.log('Voucher redeemed successfully:', voucherData.id);
    }

    // Iniciar el escáner si ya hay una estación configurada
    if (currentStation) {
        startScanner();
    } else {
        resultDiv.innerHTML = '<p>Por favor, establece la estación actual del escáner para comenzar.</p>';
    }

    // Add an event listener to stop the scanner when the page is unloaded
    window.addEventListener('beforeunload', () => {
        qrScanner.stop();
        console.log('Scanner stopped due to page unload.');
    });
});
