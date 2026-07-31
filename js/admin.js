document.addEventListener('DOMContentLoaded', () => {
    // Elementos para generación masiva
    const bulkStationIdInput = document.getElementById('bulkStationId');
    const voucherValidityInput = document.getElementById('voucherValidity');
    const voucherPrefixInput = document.getElementById('voucherPrefix');
    const startNumberInput = document.getElementById('startNumber');
    const quantityInput = document.getElementById('quantity');
    const generateBulkBtn = document.getElementById('generateBulkBtn');
    const bulkContainer = document.getElementById('bulkContainer');
    const bulkQrCodeContainer = document.getElementById('bulkQrCodeContainer');
    const downloadBtn = document.getElementById('downloadBtn');

    // Elementos de depuración
    const generatedVouchersList = document.getElementById('generatedVouchers');

    const getSupabaseClient = () => {
        return window.supabaseClient || null;
    };

    const renderVoucherList = (vouchers = []) => {
        if (!generatedVouchersList) return;
        generatedVouchersList.innerHTML = '';
        vouchers.forEach(voucher => {
            const li = document.createElement('li');
            li.textContent = `ID: ${voucher.id}, Estación: ${voucher.station || 'N/A'}, Vigencia: ${voucher.validity || 'N/A'}, Canjeado: ${voucher.redeemed ? 'Sí' : 'No'}`;
            generatedVouchersList.appendChild(li);
        });
    };

    async function loadVouchers() {
        const client = getSupabaseClient();
        if (!client) {
            renderVoucherList([]);
            return [];
        }

        try {
            const { data: vouchers, error } = await client
                .from('vouchers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const list = Array.isArray(vouchers) ? vouchers : [];
            renderVoucherList(list);
            return list;
        } catch (err) {
            console.error('No se pudieron cargar los vales desde Supabase.', err);
            renderVoucherList([]);
            return [];
        }
    }

    // Plantilla HTML para un vale individual, basada en vale.html
    const voucherTemplate = (watermark) => `
        <div class="voucher-container">
            <div class="header">
                <div class="logo-container">
                    <div class="logo-icon">N</div>
                    <div class="logo-text">
                        GAS<br>EXPRESS<span>NIETO</span>
                    </div>
                </div>
                <div class="folio-qr-container">
                    <div class="folio">FOLIO: <span></span></div>
                    <div class="qr-code-box"></div>
                </div>
            </div>
            <div class="address">
                AV REVOLUCIÓN 307-A, EL SOL<br>
                QUERÉTARO, QRO. CP 76114
            </div>
            <div class="company-info">
                <div class="company-name">GAS EXPRESS NIETO S.A. DE C.V.</div>
                <div class="voucher-title">VALE DE GAS AMIGO EXPRESS</div>
                <div class="station-info">ESTACIÓN: EL SOL</div>
                <div class="donated-tag">GAS DONADO</div>
            </div>
            <div class="field-group">
                <span class="field-label">NOMBRE:</span>
                <div class="field-line"></div>
            </div>
            <div class="field-group">
                <span class="field-label">NÚMERO DE TELÉFONO:</span>
                <div class="field-line"></div>
            </div>
            <div class="description-container">
                <div class="validity-text">
                    Vigencia del canje: <span></span>
                </div>
                <div class="description-title">DESCRIPCIÓN</div>
                <div class="description-value">VALE POR 5 LITROS DE GAS</div>
            </div>
            <div class="signatures">
                <div class="signature-field">
                    <span class="signature-label">AUTORIZADO:</span>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-field">
                    <span class="signature-label">FIRMA DE RECIBIDO:</span>
                    <div class="signature-line"></div>
                </div>
            </div>
            <div class="watermark">${watermark}</div>
        </div>
    `;

    // Función para generar un par de vales (Original y Copia)
    const createVoucherPage = (voucherId, stationId, validity) => {
        const container = document.createElement('div');
        container.className = 'voucher-set'; // Usaremos esta clase para agrupar Original y Copia
        container.innerHTML = voucherTemplate('ORIGINAL') + voucherTemplate('COPIA');
        return container;
    };

    generateBulkBtn.addEventListener('click', async () => {
        const stationId = bulkStationIdInput.value.trim();
        const validity = voucherValidityInput.value;
        const prefix = voucherPrefixInput.value.trim();
        const start = parseInt(startNumberInput.value, 10);
        const quantity = parseInt(quantityInput.value, 10);

        if (!stationId || !validity || !prefix || isNaN(start) || isNaN(quantity)) {
            alert('Por favor, completa todos los campos para la generación masiva.');
            return;
        }

        if (quantity <= 0) {
            alert('La cantidad debe ser mayor a cero.');
            return;
        }

        bulkQrCodeContainer.innerHTML = ''; // Limpiar contenedor
        bulkContainer.style.display = 'block';

        const vouchers = await loadVouchers();
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
                redeemed: false,
                validity: validity
            };
            newVouchers.push(voucherData);

            // Crear la página con el par de vales
            const voucherSet = createVoucherPage(voucherId, stationId, validity);
            bulkQrCodeContainer.appendChild(voucherSet);

            // Rellenar datos y generar QR para ambos vales en la página
            const qrContent = JSON.stringify({ id: voucherId, station: stationId });
            voucherSet.querySelectorAll('.voucher-container').forEach(voucherEl => {
                // Insertar el folio
                voucherEl.querySelector('.folio span').textContent = voucherId;

                // Insertar la vigencia en su nueva posición
                voucherEl.querySelector('.validity-text span').textContent = validity; 

                // Insertar el QR en la esquina
                const qrContainer = voucherEl.querySelector('.qr-code-box');
                new QRCode(qrContainer, { text: qrContent, width: 60, height: 60 });
            });
        }

        if (newVouchers.length > 0) {
            const client = getSupabaseClient();
            if (client) {
                try {
                    const { error } = await client.from('vouchers').insert(newVouchers);
                    if (error) throw error;
                    alert(`${newVouchers.length} vales generados y guardados exitosamente.`);
                    loadVouchers();
                } catch (err) {
                    console.error('No se pudieron guardar los vales en Supabase.', err);
                    alert(`No se guardaron los vales: ${err.message || 'error de conexión con Supabase'}.`);
                }
            } else {
                alert('No se guardaron los vales porque Supabase no está disponible.');
            }
        }
    });

    downloadBtn.addEventListener('click', () => {
        const content = document.getElementById('bulkQrCodeContainer').innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Vales de Gas LP para Imprimir</title>
                    <style>
                        * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
                        body { 
                            background-color: #fff;
                            margin: 0;
                            padding: 2mm; /* Margen reducido */
                        }
                        .print-container {
                            display: flex;
                            flex-wrap: wrap;
                            justify-content: center;
                            width: 100%;
                        }
                        .voucher-set {
                            page-break-inside: avoid;
                            display: flex;
                            gap: 5mm; /* Espacio entre original y copia reducido */
                            margin-bottom: 5mm; /* Espacio entre juegos de vales reducido */
                            width: 100%;
                            justify-content: center;
                        }
                        .voucher-container { 
                            width: 95mm; /* Ancho aumentado para ocupar más espacio */
                            border: 1px dashed #ccc;
                            padding: 10px 15px;
                            position: relative; 
                            color: #000; 
                            height: fit-content;
                        }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                        .logo-container { display: flex; align-items: center; }
                        .logo-icon { color: #c8232a; font-size: 28px; font-weight: bold; line-height: 0.8; margin-right: 4px; font-family: 'Arial Black', sans-serif; }
                        .logo-text { color: #1a2b4c; font-weight: 900; font-size: 11px; line-height: 1.1; text-transform: uppercase; }
                        .logo-text span { color: #c8232a; display: block; }
                        .folio-qr-container { text-align: right; }
                        .folio { font-size: 11px; font-weight: bold; color: #c8232a; }
                        .folio span { font-size: 12px; font-weight: normal; margin-left: 4px; }
                        .qr-code-box { width: 64px; height: 64px; margin-top: 5px; margin-left: auto; padding: 2px; border: 1px solid #eee; }
                        .qr-code-box img { display: block; width: 100% !important; height: 100% !important; }
                        .address { font-size: 8px; text-align: left; margin-top: 3px; font-weight: bold; color: #333; }
                        .company-info { text-align: right; margin-top: -10px; margin-bottom: 10px; }
                        .company-name { font-size: 10px; font-weight: bold; }
                        .voucher-title { font-size: 10px; font-weight: 900; margin-top: 2px; }
                        .station-info { font-size: 9px; font-weight: bold; margin-top: 2px; }
                        .donated-tag { font-size: 10px; font-weight: bold; font-style: italic; margin-top: 2px; }
                        .validity-text { font-size: 9px; font-weight: bold; text-align: center; margin-bottom: 5px; }
                        .field-group { margin-bottom: 10px; display: flex; align-items: flex-end; font-size: 9px; font-weight: bold; }
                        .field-label { white-space: nowrap; margin-right: 5px; }
                        .field-line { flex-grow: 1; border-bottom: 1px solid #000; }
                        .description-container { text-align: center; margin: 10px 0; }
                        .description-title { font-size: 9px; font-weight: bold; font-style: italic; border-bottom: 1px dotted #000; padding-bottom: 2px; }
                        .description-value { font-size: 9px; font-weight: bold; font-style: italic; border-bottom: 1px dotted #000; padding: 2px 0; display: inline-block; width: 80%; margin-top: 2px; }
                        .signatures { margin-top: 20px; }
                        .signature-field { display: flex; align-items: flex-end; margin-bottom: 15px; font-size: 9px; font-weight: bold; }
                        .signature-label { width: 110px; }
                        .signature-line { flex-grow: 1; border-bottom: 1px solid #000; }
                        .watermark { text-align: right; font-size: 8px; font-weight: bold; margin-top: 5px; }
                        @media print {
                            @page { size: A4 portrait; margin: 0; }
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <button onclick="window.print()">Imprimir Vales</button>
                    <div class="print-container">${content}</div>
                </body>
            </html>
        `);
        printWindow.document.close();
    });

    // Cargar vales al iniciar la página
    loadVouchers();
});
