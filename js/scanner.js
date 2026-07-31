document.addEventListener('DOMContentLoaded', () => {
    const resultDiv = document.getElementById('result');
    const currentStationIdInput = document.getElementById('currentStationId');
    const videoElement = document.getElementById('reader');
    const setStationBtn = document.getElementById('setStationBtn');
    let currentStation = localStorage.getItem('scannerStationId') || ''; // Cargar estación guardada

    currentStationIdInput.value = currentStation;

    setStationBtn.addEventListener('click', () => {
        currentStation = currentStationIdInput.value.trim();
        if (currentStation) {
            stopScanner(); // Stop current scanner before restarting with new station
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
        result => {
            console.log(`QR Code detectado: ${result.data}`);
            stopScanner(); // Stop scanner immediately after a scan
            processScannedVoucher(result.data);
        },
        {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            // Consider adding a throttle or debounce if rapid scans are an issue
            // delay: 500, // Example: wait 500ms before next scan attempt
        }
    );

    function stopScanner() {
        qrScanner.stop();
        console.log('Escáner detenido.');
    }

    function startScanner() {
        if (!currentStation) {
            resultDiv.innerHTML = '<p class="error">Por favor, establece la estación actual del escáner.</p>';
            return;
        }

        resultDiv.innerHTML = '<p>Escaneando...</p>'; // Clear previous result and show scanning status
        // Iniciar el nuevo escáner
        qrScanner.start().catch(err => {
            resultDiv.innerHTML = `<p class="error">Error al iniciar el escáner: ${err}. Asegúrate de que la cámara esté disponible y los permisos concedidos.</p>`;
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
        const { data: redemption, error } = await client.rpc('redeem_voucher', {
            voucher_id: voucherData.id,
            scanner_station: currentStation
        });

        if (error) {
            resultDiv.innerHTML = `<p class="error">Error al consultar la base de datos.</p>`;
            console.error('Error fetching voucher:', error);
            return;
        }

        const result = Array.isArray(redemption) ? redemption[0] : redemption;
        if (!result || !result.success) {
            const messages = {
                not_found: 'El vale no existe.',
                expired: 'El vale ha expirado.',
                already_redeemed: 'El vale ya fue canjeado.',
                wrong_station: 'El vale pertenece a otra estación.'
            };
            resultDiv.innerHTML = `<p class="error">${messages[result?.status] || 'No se pudo canjear el vale.'}</p>`;
            return;
        }

        resultDiv.innerHTML = `<p class="success">¡Vale "${voucherData.id}" canjeado exitosamente en la estación "${currentStation}"!</p>`;
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
