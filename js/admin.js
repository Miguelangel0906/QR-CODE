document.addEventListener('DOMContentLoaded', () => {
    // Elementos para generación masiva
    const bulkStationIdInput = document.getElementById('bulkStationId');
    const voucherPrefixInput = document.getElementById('voucherPrefix');
    const startNumberInput = document.getElementById('startNumber');
    const quantityInput = document.getElementById('quantity');
    const generateBulkBtn = document.getElementById('generateBulkBtn');
    const bulkContainer = document.getElementById('bulkContainer');
    const bulkQrCodeContainer = document.getElementById('bulkQrCodeContainer');
    const downloadBtn = document.getElementById('downloadBtn');

    // Elementos de depuración
    const generatedVouchersList = document.getElementById('generatedVouchers');
    // Función para cargar vales desde localStorage
    function loadVouchers() {
        const vouchers = JSON.parse(localStorage.getItem('gasVouchers')) || [];
        generatedVouchersList.innerHTML = '';
        vouchers.forEach(voucher => {
            const li = document.createElement('li');
            li.textContent = `ID: ${voucher.id}, Estación: ${voucher.station}, Canjeado: ${voucher.redeemed ? 'Sí' : 'No'}`;
            generatedVouchersList.appendChild(li);
        });
        return vouchers;
    }

    // Función para guardar vales en localStorage
    function saveVouchers(vouchers) {
        localStorage.setItem('gasVouchers', JSON.stringify(vouchers));
        loadVouchers(); // Recargar la lista para mostrar los cambios
    }

    generateBulkBtn.addEventListener('click', () => {
        const stationId = bulkStationIdInput.value.trim();
        const prefix = voucherPrefixInput.value.trim();
        const start = parseInt(startNumberInput.value, 10);
        const quantity = parseInt(quantityInput.value, 10);

        if (!stationId || !prefix || isNaN(start) || isNaN(quantity)) {
            alert('Por favor, completa todos los campos para la generación masiva.');
            return;
        }

        if (quantity <= 0) {
            alert('La cantidad debe ser mayor a cero.');
            return;
        }

        bulkQrCodeContainer.innerHTML = ''; // Limpiar contenedor
        bulkContainer.style.display = 'block';

        const vouchers = loadVouchers();
        const newVouchers = [];

        for (let i = 0; i < quantity; i++) {
            const number = start + i;
            const voucherId = `${prefix}${number.toString().padStart(4, '0')}`;

            // Verificar si ya existe
            if (vouchers.some(v => v.id === voucherId)) {
                alert(`El vale con ID "${voucherId}" ya existe. Se omitirá la generación a partir de este punto.`);
                break;
            }

            const voucherData = {
                id: voucherId,
                station: stationId,
                redeemed: false
            };
            newVouchers.push(voucherData);

            // Crear elementos visuales para el QR
            const qrCard = document.createElement('div');
            qrCard.className = 'qr-card';

            const canvas = document.createElement('canvas');
            // La librería qrcode.js (David Shim) reemplaza el contenido del elemento, no dibuja directamente en un canvas existente.
            // Por lo tanto, creamos un div temporal para que la librería lo use.
            const qrCodeDiv = document.createElement('div');
            const label = document.createElement('p');
            label.textContent = voucherId;

            qrCard.appendChild(qrCodeDiv); // La librería qrcode.js dibujará aquí
            qrCard.appendChild(label);
            bulkQrCodeContainer.appendChild(qrCard);

            // Generar el QR
            const qrContent = JSON.stringify({ id: voucherId, station: stationId });
            // Usamos la sintaxis de la librería qrcode.js (David Shim)
            new QRCode(qrCodeDiv, {
                text: qrContent,
                width: 150,
                height: 150, // Es buena práctica definir la altura también
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H // Nivel de corrección de error
            });
        }

        // Guardar todos los nuevos vales en localStorage
        if (newVouchers.length > 0) {
            saveVouchers([...vouchers, ...newVouchers]);
        }
    });

    downloadBtn.addEventListener('click', () => {
        const content = bulkQrCodeContainer.innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Vales de Gas LP para Imprimir</title>
                    <style>
                        body { font-family: sans-serif; }
                        .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; padding: 20px; }
                        .qr-card { border: 1px solid #ccc; border-radius: 8px; padding: 10px; text-align: center; page-break-inside: avoid; }
                        canvas { max-width: 100%; height: auto; }
                        p { font-size: 12px; font-weight: bold; margin-top: 5px; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <button onclick="window.print()">Imprimir Vales</button>
                    <div class="grid-container">${content}</div>
                </body>
            </html>
        `);
        printWindow.document.close();
    });

    // Cargar vales al iniciar la página
    loadVouchers();
});
