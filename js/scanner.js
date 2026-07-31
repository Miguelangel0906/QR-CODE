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

        // Buscar el vale en Supabase
        const { data: vouchers, error } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', voucherData.id)
            .limit(1);

        if (error) {
            resultDiv.innerHTML = `<p class="error">Error al consultar la base de datos.</p>`;
            console.error('Error fetching voucher:', error);
            return;
        }

        if (!vouchers || vouchers.length === 0) {
            resultDiv.innerHTML = `<p class="error">Vale con ID "${voucherData.id}" no encontrado. Asegúrate de que el vale haya sido generado en la sección de administración.</p>`;
            console.warn('Voucher not found:', voucherData.id);
            return;
        }

        const storedVoucher = vouchers[0];

        // Verificar Vigencia
        if (storedVoucher.validity) {
            const today = new Date();
            const validityDate = new Date(storedVoucher.validity + 'T23:59:59'); // Considerar el día completo
            today.setHours(0, 0, 0, 0); // Ignorar la hora para la comparación
            if (today > validityDate) {
                resultDiv.innerHTML = `<p class="error">Vale "${storedVoucher.id}" ha expirado. La fecha de vigencia era ${storedVoucher.validity}.</p>`;
                console.warn('Voucher expired:', storedVoucher.id, 'Validity:', storedVoucher.validity);
                return;
            }
        }

        if (storedVoucher.redeemed) {
            resultDiv.innerHTML = `<p class="warning">Vale "${storedVoucher.id}" ya ha sido canjeado.</p>`;
            console.warn('Voucher already redeemed:', storedVoucher.id);
            return;
        }

        if (storedVoucher.station !== currentStation) {
            resultDiv.innerHTML = `<p class="error">Vale "${storedVoucher.id}" solo puede ser canjeado en la estación "${storedVoucher.station}". Esta es la estación "${currentStation}".</p>`;
            console.warn('Voucher station mismatch:', storedVoucher.id, 'Expected:', storedVoucher.station, 'Current:', currentStation);
            return;
        }

        // Marcar como canjeado
        const { error: updateError } = await supabase
            .from('vouchers')
            .update({ redeemed: true })
            .eq('id', storedVoucher.id);

        if (updateError) {
            resultDiv.innerHTML = `<p class="error">Error al actualizar el vale en la base de datos.</p>`;
            console.error('Error updating voucher:', updateError);
            return;
        }

        resultDiv.innerHTML = `<p class="success">¡Vale "${storedVoucher.id}" canjeado exitosamente en la estación "${currentStation}"!</p>`;
        console.log('Voucher redeemed successfully:', storedVoucher.id);
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
