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
            localStorage.setItem('scannerStationId', currentStation);
            alert(`Estación del escáner establecida a: ${currentStation}`);
            startScanner(); // Reiniciar escáner con la nueva estación
        } else {
            alert('Por favor, ingresa la estación actual.');
        }
    });

    // Asegurar la ruta al worker de la librería qr-scanner (necesario cuando se carga desde CDN)
    QrScanner.WORKER_PATH = 'https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner-worker.min.js';

    // Instancia del nuevo escáner
    const qrScanner = new QrScanner(
        videoElement,
        result => {
            // 'result' es el texto decodificado del QR (no tiene propiedad .data)
            console.log(`QR Code detectado: ${result}`);
            processScannedVoucher(result);
        },
        {
            highlightScanRegion: true,
            highlightCodeOutline: true,
        }
    );

    function startScanner() {
        if (!currentStation) {
            resultDiv.innerHTML = '<p class="error">Por favor, establece la estación actual del escáner.</p>';
            return;
        }

        // Iniciar el nuevo escáner
        qrScanner.start().catch(err => {
            resultDiv.innerHTML = `<p class="error">Error al iniciar el escáner: ${err}</p>`;
        });
    }

    function processScannedVoucher(qrContent) {
        let voucherData;
        try {
            voucherData = JSON.parse(qrContent);
        } catch (e) {
            resultDiv.innerHTML = '<p class="error">QR inválido: No es un formato de vale reconocido.</p>';
            return;
        }

        if (!voucherData || !voucherData.id || !voucherData.station) {
            resultDiv.innerHTML = '<p class="error">QR inválido: Faltan datos del vale (ID o Estación).</p>';
            return;
        }

        const vouchers = JSON.parse(localStorage.getItem('gasVouchers')) || [];
        const voucherIndex = vouchers.findIndex(v => v.id === voucherData.id);

        if (voucherIndex === -1) {
            resultDiv.innerHTML = `<p class="error">Vale con ID "${voucherData.id}" no encontrado.</p>`;
            return;
        }

        const storedVoucher = vouchers[voucherIndex];

        if (storedVoucher.redeemed) {
            resultDiv.innerHTML = `<p class="warning">Vale "${storedVoucher.id}" ya ha sido canjeado.</p>`;
            return;
        }

        if (storedVoucher.station !== currentStation) {
            resultDiv.innerHTML = `<p class="error">Vale "${storedVoucher.id}" solo puede ser canjeado en la estación "${storedVoucher.station}". Esta es la estación "${currentStation}".</p>`;
            return;
        }

        // Marcar como canjeado
        storedVoucher.redeemed = true;
        localStorage.setItem('gasVouchers', JSON.stringify(vouchers));
        resultDiv.innerHTML = `<p class="success">¡Vale "${storedVoucher.id}" canjeado exitosamente en la estación "${currentStation}"!</p>`;
    }

    // Iniciar el escáner si ya hay una estación configurada
    if (currentStation) {
        startScanner();
    } else {
        resultDiv.innerHTML = '<p>Por favor, establece la estación actual del escáner para comenzar.</p>';
    }
});
