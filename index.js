import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null;

// 🔥 LINK DO GOOGLE DRIVE (formato de download direto)
const GOOGLE_DRIVE_LINK = 'https://drive.google.com/uc?export=download&id=1jXglRbnyhLMYz23iJdXl8Rbsg8HiCJmW';

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    function CreateViewer(container) {
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    // =======================================================
    // 🔹 ESTRATÉGIA INTELIGENTE - SIMULA DOWNLOAD DO NAVEGADOR
    // =======================================================
    
    // 🔥 MÉTODO 1: Usando fetch com credenciais (como o navegador faz)
    async function downloadViaFetch(url) {
        console.log('🔍 Tentando download via fetch...');
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include', // Inclui cookies como o navegador
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            console.log('✅ Download via fetch bem-sucedido!');
            return URL.createObjectURL(blob);
            
        } catch (error) {
            console.log('❌ Fetch falhou:', error.message);
            return null;
        }
    }

    // 🔥 MÉTODO 2: Simula clique em link (como usuário faria)
    async function downloadViaLinkSimulation(url) {
        return new Promise((resolve, reject) => {
            console.log('🔍 Simulando clique em link...');
            
            // Cria um link invisível
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;
            link.download = 'modelo.ifc'; // Nome do arquivo
            
            // Adiciona ao DOM
            document.body.appendChild(link);
            
            // Configura timeout
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout no download via link'));
            }, 10000);
            
            function cleanup() {
                clearTimeout(timeout);
                document.body.removeChild(link);
            }
            
            // Evento de load (funciona para alguns casos)
            link.onload = () => {
                cleanup();
                console.log('✅ Download via link bem-sucedido!');
                resolve(url); // Retorna a URL original
            };
            
            link.onerror = () => {
                cleanup();
                reject(new Error('Erro no download via link'));
            };
            
            // Simula o clique
            link.click();
        });
    }

    // 🔥 MÉTODO 3: Usando XMLHttpRequest (mais controle)
    async function downloadViaXHR(url) {
        return new Promise((resolve, reject) => {
            console.log('🔍 Tentando download via XHR...');
            
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.withCredentials = true; // Inclui credenciais
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const blob = xhr.response;
                    const objectURL = URL.createObjectURL(blob);
                    console.log('✅ Download via XHR bem-sucedido!');
                    resolve(objectURL);
                } else {
                    reject(new Error(`XHR failed: ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('XHR network error'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('XHR timeout'));
            };
            
            xhr.timeout = 15000;
            xhr.send();
        });
    }

    // 🔥 MÉTODO 4: Abre em nova janela (como usuário faria manualmente)
    async function downloadViaNewWindow(url) {
        return new Promise((resolve, reject) => {
            console.log('🔍 Abrindo em nova janela...');
            
            // Abre uma nova janela/janela
            const newWindow = window.open(url, '_blank');
            
            if (!newWindow) {
                reject(new Error('Popup bloqueado pelo navegador'));
                return;
            }
            
            // Não podemos controlar o download na nova janela,
            // mas podemos verificar se carregou
            setTimeout(() => {
                if (newWindow.closed) {
                    resolve(url); // Assume que download foi iniciado
                } else {
                    newWindow.close();
                    reject(new Error('Usuário não fechou a janela de download'));
                }
            }, 3000);
        });
    }

    // 🔥 MÉTODO PRINCIPAL - TENTA TODAS AS ESTRATÉGIAS
    async function downloadIFCFromDrive() {
        console.log('🚀 Iniciando download inteligente do Google Drive...');
        
        const methods = [
            { name: 'Fetch', fn: () => downloadViaFetch(GOOGLE_DRIVE_LINK) },
            { name: 'XHR', fn: () => downloadViaXHR(GOOGLE_DRIVE_LINK) },
            { name: 'Link Simulation', fn: () => downloadViaLinkSimulation(GOOGLE_DRIVE_LINK) },
            // { name: 'New Window', fn: () => downloadViaNewWindow(GOOGLE_DRIVE_LINK) }
        ];
        
        for (const method of methods) {
            try {
                console.log(`🔄 Tentando método: ${method.name}`);
                const result = await method.fn();
                
                if (result) {
                    console.log(`✅ Sucesso com método: ${method.name}`);
                    return result;
                }
            } catch (error) {
                console.warn(`❌ Método ${method.name} falhou:`, error.message);
                // Continua para o próximo método
            }
        }
        
        throw new Error('Todos os métodos de download falharam');
    }

    // =======================================================
    // 🔹 FUNÇÃO PRINCIPAL DE CARREGAMENTO
    // =======================================================
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        console.log(`📦 Carregando IFC: ${url}`);
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;
        
        viewer.shadowDropper.renderShadow(currentModelID);
        console.log("✅ Modelo IFC carregado com ID:", currentModelID);
        return model;
    }

    async function loadWithFallback() {
        try {
            console.log('🎯 Tentando carregar do Google Drive...');
            
            // Tenta baixar do Google Drive
            const downloadedUrl = await downloadIFCFromDrive();
            await loadIfc(downloadedUrl);
            
        } catch (driveError) {
            console.warn('❌ Falha no Google Drive, tentando arquivo local...');
            
            try {
                // Fallback para arquivo local
                await loadIfc('models/01.ifc');
            } catch (localError) {
                console.error('🚨 Todos os métodos falharam:', localError);
                showErrorMessage();
            }
        }
    }

    // 🔹 MENSAGEM DE ERRO
    function showErrorMessage() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            padding: 20px;
            max-width: 500px;
            text-align: center;
            z-index: 10000;
        `;
        
        errorDiv.innerHTML = `
            <h3 style="color: #721c24; margin-top: 0;">⚠️ Erro ao Carregar</h3>
            <p style="color: #721c24;">
                Não foi possível carregar o arquivo IFC automaticamente.
            </p>
            <p style="color: #721c24; margin-bottom: 15px;">
                <strong>Solução:</strong> Faça o download manual e faça upload abaixo.
            </p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                Fechar
            </button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // =======================================================
    // 🔹 FUNÇÕES DE PROPRIEDADES (MANTIDAS)
    // =======================================================
    function showProperties(props, expressID) {
        // ... (mantenha sua função showProperties atual)
    }

    function formatProperty(propName, propValue) {
        // ... (mantenha sua função formatProperty atual)
    }

    // 🚀 INICIALIZAÇÃO
    async function initializeViewer() {
        await loadWithFallback();
    }

    initializeViewer();

    // =======================================================
    // 🔹 EVENTOS DE INTERAÇÃO (MANTIDOS)
    // =======================================================
    window.onmousemove = () => viewer?.IFC?.selector?.prePickIfcItem();

    window.ondblclick = async (event) => {
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        
        lastProps = props; 
        console.log("🟩 Item selecionado:", lastProps);
        
        showProperties(props, item.id);
    };

    window.onkeydown = (event) => {
        if (event.code === 'Escape' && viewer?.IFC?.selector) {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            document.getElementById('properties-panel').style.display = 'none';
            lastProps = null;
        }
    };
    
    // UPLOAD DE ARQUIVO (fallback manual)
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
                
                const ifcURL = URL.createObjectURL(file);
                await loadIfc(ifcURL);
                URL.revokeObjectURL(ifcURL);
            }
        });
    }

    // 🔥 BOTÃO PARA FORÇAR DOWNLOAD MANUAL
    function addManualDownloadButton() {
        const button = document.createElement('button');
        button.textContent = '📥 Download Manual';
        button.style.cssText = `
            position: fixed;
            top: 50px;
            left: 10px;
            z-index: 2000;
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        button.onclick = () => {
            window.open(GOOGLE_DRIVE_LINK, '_blank');
        };
        
        document.body.appendChild(button);
    }

    addManualDownloadButton();

});