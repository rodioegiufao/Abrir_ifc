import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl;
let isMeasuring = false;

// ✅ LISTA DE ARQUIVOS IFC 
const IFC_MODELS_TO_LOAD = [
    'models/01.ifc',
    'models/02.ifc',
];

// 🔥 CONTROLE DE VISIBILIDADE
let loadedModels = new Map(); // Map<modelID, { visible: boolean, name: string, url: string }>

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

    // 🔥 INICIALIZAR XEOKIT VIEWER PARA MEDIÇÕES (VERSÃO CORRIGIDA)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");

            // ✅ SOLUÇÃO: Importa dinamicamente o módulo xeokit
            const xeokitSDK = await import('./wasm/xeokit-sdk.es.js');
            
            console.log("✅ xeokit SDK importado:", Object.keys(xeokitSDK));

            // Cria um container separado para o xeokit
            const xeokitContainer = document.createElement('div');
            xeokitContainer.id = 'xeokit-container';
            container.appendChild(xeokitContainer);

            // Cria canvas para o xeokit
            const xeokitCanvas = document.createElement('canvas');
            xeokitCanvas.id = 'xeokit-canvas';
            xeokitContainer.appendChild(xeokitCanvas);

            // ✅ Usa as classes do módulo importado
            const { Viewer, DistanceMeasurementsPlugin, DistanceMeasurementsMouseControl, PointerLens } = xeokitSDK;

            xeokitViewer = new Viewer({
                canvasId: "xeokit-canvas",
                transparent: true,
                alpha: true
            });

            // Configura os plugins de medição
            distanceMeasurements = new DistanceMeasurementsPlugin(xeokitViewer, {
                color: "#FF0000",
                fontFamily: "Arial",
                fontSize: 12
            });

            distanceMeasurementsControl = new DistanceMeasurementsMouseControl(distanceMeasurements, {
                pointerLens: new PointerLens(xeokitViewer)
            });

            // Configura snapping para melhor precisão
            distanceMeasurementsControl.snapToVertex = true;
            distanceMeasurementsControl.snapToEdge = true;

            console.log("✅ Plugin de medições xeokit inicializado com sucesso");

        } catch (error) {
            console.error("❌ Erro ao inicializar xeokit:", error);
            
            // Fallback: tenta carregar via CDN
            await loadXeokitFromCDN();
        }
    }

    // 🔥 FALLBACK: CARREGAR VIA CDN
    async function loadXeokitFromCDN() {
        try {
            console.log("🔄 Tentando carregar xeokit via CDN...");
            
            // Carrega o script do CDN
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@xeokit/xeokit-sdk/dist/xeokit-sdk.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });

            // Agora usa o xeokit do CDN (disponível globalmente)
            const { Viewer, DistanceMeasurementsPlugin, DistanceMeasurementsMouseControl, PointerLens } = window;
            
            // ... resto da inicialização igual ao código acima
            console.log("✅ xeokit SDK carregado via CDN");

        } catch (error) {
            console.error("❌ Falha ao carregar xeokit via CDN:", error);
        }
    }

    // 🔥 FUNÇÃO PARA CARREGAR O XEOKIT DINAMICAMENTE
    function loadXeokitSDK() {
        console.log("🔄 Tentando carregar xeokit SDK dinamicamente...");
        
        const script = document.createElement('script');
        script.src = './wasm/xeokit-sdk.es.js';
        script.type = 'module';
        
        script.onload = function() {
            console.log("✅ xeokit SDK carregado com sucesso");
            // Tenta inicializar novamente após o carregamento
            setTimeout(initializeXeokitViewer, 1000);
        };
        
        script.onerror = function() {
            console.error("❌ Falha ao carregar xeokit SDK");
            // Fallback: tenta carregar como script normal (não módulo)
            loadXeokitAsRegularScript();
        };
        
        document.head.appendChild(script);
    }

    // 🔥 FALLBACK: CARREGAR COMO SCRIPT REGULAR
    function loadXeokitAsRegularScript() {
        console.log("🔄 Tentando carregar xeokit como script regular...");
        
        const script = document.createElement('script');
        script.src = './wasm/xeokit-sdk.es.js';
        
        script.onload = function() {
            console.log("✅ xeokit SDK carregado como script regular");
            setTimeout(initializeXeokitViewer, 1000);
        };
        
        script.onerror = function() {
            console.error("❌ Falha completa ao carregar xeokit SDK");
        };
        
        document.head.appendChild(script);
    }

    // 🔥 CONTROLES DE MEDIÇÃO (ATUALIZADO)
    function setupMeasurementControls() {
        const startBtn = document.getElementById('start-measurement');
        const clearBtn = document.getElementById('clear-measurements');

        if (!startBtn || !clearBtn) {
            console.warn("⚠️ Botões de medição não encontrados");
            return;
        }

        startBtn.addEventListener('click', async () => {
            if (!isMeasuring) {
                // Iniciar medição
                try {
                    if (!distanceMeasurementsControl) {
                        console.error("❌ xeokit não inicializado corretamente");
                        return;
                    }

                    await distanceMeasurementsControl.activate();
                    
                    // Mostrar canvas do xeokit
                    const xeokitCanvas = document.getElementById('xeokit-canvas');
                    if (xeokitCanvas) {
                        xeokitCanvas.style.display = 'block';
                        xeokitCanvas.style.pointerEvents = 'auto';
                    }
                    
                    startBtn.textContent = 'Parar Medição';
                    startBtn.classList.add('active');
                    isMeasuring = true;
                    
                    console.log("📏 Modo medição ativado");
                } catch (error) {
                    console.error("❌ Erro ao ativar medições:", error);
                }
            } else {
                // Parar medição
                try {
                    if (distanceMeasurementsControl) {
                        await distanceMeasurementsControl.deactivate();
                    }
                    
                    // Esconder canvas do xeokit
                    const xeokitCanvas = document.getElementById('xeokit-canvas');
                    if (xeokitCanvas) {
                        xeokitCanvas.style.display = 'none';
                        xeokitCanvas.style.pointerEvents = 'none';
                    }
                    
                    startBtn.textContent = 'Iniciar Medição';
                    startBtn.classList.remove('active');
                    isMeasuring = false;
                    
                    console.log("📏 Modo medição desativado");
                } catch (error) {
                    console.error("❌ Erro ao desativar medições:", error);
                }
            }
        });

        clearBtn.addEventListener('click', () => {
            try {
                if (distanceMeasurements) {
                    distanceMeasurements.clear();
                    console.log("🗑️ Todas as medições removidas");
                }
            } catch (error) {
                console.error("❌ Erro ao limpar medições:", error);
            }
        });
    }

    // =======================================================
    // 🔹 FUNÇÃO CARREGAR MÚLTIPLOS IFCs (COM CORREÇÃO PARA ^1.0.218)
    // =======================================================
    async function loadMultipleIfcs(urls) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        currentModelID = -1;
        loadedModels.clear(); // Limpa modelos anteriores
        
        console.log(`🔄 Iniciando carregamento de ${urls.length} modelos...`);

        let loadedCount = 0;

        for (const url of urls) {
            try {
                console.log(`📦 Tentando carregar: ${url}`);
                
                const model = await viewer.IFC.loadIfcUrl(url);
                
                // 💡 CORREÇÃO CRÍTICA AQUI: MÉTODO COMPATÍVEL COM ^1.0.218
                const ifcProject = await viewer.IFC.getSpatialStructure(model.modelID, false);
                console.log(`✅ Cache populado lendo IfcProject (ID ${ifcProject.expressID}) para o modelo: ${url}`);
                
                viewer.shadowDropper.renderShadow(model.modelID);
                loadedCount++;
                
                // 🔥 ARMAZENA INFORMAÇÕES DO MODELO
                const modelName = getModelNameFromUrl(url);
                loadedModels.set(model.modelID, {
                    visible: true,
                    name: modelName,
                    url: url
                });
                
                console.log(`✅ Sucesso: ${modelName} (ID: ${model.modelID})`);

            } catch (error) {
                console.error(`❌ Falha ao carregar: ${url}`, error.message);
            }
        }

        if (loadedCount === 0) {
            console.error("🚨 Nenhum modelo IFC pôde ser carregado!");
            showErrorMessage();
            return;
        }
        
        // Ajuste da câmera
        const scene = viewer.context.getScene();
        await new Promise(resolve => setTimeout(resolve, 100));
        viewer.context.ifcCamera.cameraControls.fitToBox(scene, true, 0.5, true);

        // 🔥 CRIA OS BOTÕES DE CONTROLE
        createVisibilityControls();
        
        console.log(`🎉 ${loadedCount}/${urls.length} modelos carregados!`);
    }

    // 🔥 EXTRAI NOME DO ARQUIVO DA URL
    function getModelNameFromUrl(url) {
        const parts = url.split('/');
        return parts[parts.length - 1]; // Pega o último parte (nome do arquivo)
    }

    // 🔥 CRIA BOTÕES DE CONTROLE DE VISIBILIDADE
    function createVisibilityControls() {
        // Remove controles anteriores se existirem
        const existingControls = document.getElementById('visibility-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'visibility-controls';
        controlsDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            z-index: 2000;
            min-width: 200px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            font-family: Arial, sans-serif;
        `;
        
        let controlsHTML = `
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 14px;">👁️ Controle de Modelos</h4>
        `;
        
        // Cria um botão para cada modelo carregado
        loadedModels.forEach((modelInfo, modelID) => {
            const buttonText = modelInfo.visible ? '👁️ Ocultar' : '🙈 Mostrar';
            const buttonColor = modelInfo.visible ? '#dc3545' : '#28a745';
            
            controlsHTML += `
                <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 12px; color: #666;">${modelInfo.name}</span>
                    <button onclick="toggleModelVisibility(${modelID})" 
                            style="background: ${buttonColor}; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                        ${buttonText}
                    </button>
                </div>
            `;
        });
        
        // Botão para mostrar/ocultar todos
        controlsHTML += `
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
            <div style="display: flex; gap: 5px;">
                <button onclick="showAllModels()" 
                        style="flex: 1; background: #28a745; color: white; border: none; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    👁️ Todos
                </button>
                <button onclick="hideAllModels()" 
                        style="flex: 1; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    🙈 Nenhum
                </button>
            </div>
        `;
        
        controlsDiv.innerHTML = controlsHTML;
        document.body.appendChild(controlsDiv);
    }

    // 🔥 ALTERNA VISIBILIDADE DE UM MODELO ESPECÍFICO
    function toggleModelVisibility(modelID) {
        const modelInfo = loadedModels.get(modelID);
        if (!modelInfo) return;
        
        modelInfo.visible = !modelInfo.visible;
        
        // Encontra e altera a visibilidade do modelo
        viewer.context.items.ifcModels.forEach(model => {
            if (model.modelID === modelID) {
                model.visible = modelInfo.visible;
            }
        });
        
        // Atualiza os controles
        createVisibilityControls();
        
        console.log(`🔸 ${modelInfo.visible ? 'Mostrando' : 'Ocultando'} ${modelInfo.name}`);
    }

    // 🔥 MOSTRA TODOS OS MODELOS
    function showAllModels() {
        loadedModels.forEach((modelInfo, modelID) => {
            modelInfo.visible = true;
            
            viewer.context.items.ifcModels.forEach(model => {
                if (model.modelID === modelID) {
                    model.visible = true;
                }
            });
        });
        
        createVisibilityControls();
        console.log('🔸 Mostrando todos os modelos');
    }

    // 🔥 OCULTA TODOS OS MODELOS
    function hideAllModels() {
        loadedModels.forEach((modelInfo, modelID) => {
            modelInfo.visible = false;
            
            viewer.context.items.ifcModels.forEach(model => {
                if (model.modelID === modelID) {
                    model.visible = false;
                }
            });
        });
        
        createVisibilityControls();
        console.log('🔸 Ocultando todos os modelos');
    }

    // 🔥 EXPORTA FUNÇÕES PARA O ESCOPO GLOBAL
    window.toggleModelVisibility = toggleModelVisibility;
    window.showAllModels = showAllModels;
    window.hideAllModels = hideAllModels;

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
            max-width: 400px;
            text-align: center;
            z-index: 10000;
        `;
        
        errorDiv.innerHTML = `
            <h3 style="color: #721c24; margin-top: 0;">⚠️ Arquivos IFC Não Encontrados</h3>
            <p style="color: #721c24;">
                Verifique se os arquivos estão na pasta 'models/'
            </p>
            <button onclick="this.parentElement.remove()" 
                    style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                Fechar
            </button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // =======================================================
    // 🔹 FUNÇÃO showProperties (OTIMIZADA)
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) return;

        const elementType = props.constructor.name;
        const elementName = props.Name?.value || elementType;

        title.textContent = elementName;
        
        let htmlContent = '';

        // 🔥 DEBUG: EXPLORA A ESTRUTURA COMPLETA
        console.log('🔍 ESTRUTURA COMPLETA DO ELEMENTO:', props);
        console.log('📋 TODAS AS CHAVES DISPONÍVEIS:', Object.keys(props));

        htmlContent += `
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #007bff;">Informações Gerais</h4>
                <p style="margin: 4px 0;"><strong>Tipo IFC:</strong> ${elementType}</p>
                <p style="margin: 4px 0;"><strong>Nome:</strong> ${elementName}</p>
                <p style="margin: 4px 0;"><strong>ID IFC:</strong> ${expressID}</p>
                <p style="margin: 4px 0;"><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
            </div>
        `;

        if (props.psets && props.psets.length > 0) {
            htmlContent += `<h4 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 5px;">Conjuntos de Propriedades (${props.psets.length} Psets)</h4>`;
            
            props.psets.forEach((pset, index) => {
                const psetName = pset.Name?.value || `Pset ${index + 1}`;
                
                console.log(`🔍 PSET ${index}: ${psetName}`, pset);
                
                htmlContent += `
                    <div style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 12px; margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #495057; font-size: 1.1em;">${psetName}</h5>
                `;

                let propertiesFound = false;
                let propertiesHTML = '<ul style="list-style: none; padding-left: 0; margin: 0;">';

                // 🔥 BUSCA PROPRIEDADES NO OBJETO PRINCIPAL (props) ATRAVÉS DO HANDLE
                if (pset.HasProperties && pset.HasProperties.length > 0) {
                    console.log(`📋 ${psetName} - HasProperties: (${pset.HasProperties.length}) [Handles]`);
                    
                    pset.HasProperties.forEach((propHandle, propIndex) => {
                        const propExpressID = propHandle.value;
                        const prop = props[propExpressID]; // Acesso no cache populado
                        
                        if (prop && prop.Name) {
                            propertiesFound = true;
                            const propName = prop.Name.value || 'Sem nome';
                            let propValue = 'N/A';
                            
                            // Recupera o valor
                            if (prop.NominalValue && prop.NominalValue.value !== undefined) {
                                propValue = prop.NominalValue.value;
                            } else if (prop.Value && prop.Value.value !== undefined) { 
                                propValue = prop.Value.value;
                            }
                            
                            console.log(`   ✅ Propriedade encontrada (ID: ${propExpressID}): ${propName} = ${propValue}`);
                            propertiesHTML += formatProperty(propName, propValue);
                        } else {
                            console.log(`   ❌ Propriedade não encontrada para handle: Handle {value: ${propExpressID}, type: 5}`);
                        }
                    });
                }

                propertiesHTML += '</ul>';
                
                if (propertiesFound) {
                    htmlContent += propertiesHTML;
                    console.log(`✅ ${psetName}: PROPRIEDADES ENCONTRADAS!`);
                } else {
                    // Mensagem de aviso se o carregamento falhar
                    htmlContent += `
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 5px 0;">
                            <p style="margin: 0 0 5px 0; color: #856404; font-size: 12px; font-weight: bold;">
                                ⚠️ Estrutura do Pset detectada mas propriedades não encontradas
                            </p>
                            <p style="margin: 0; color: #856404; font-size: 11px;">
                                HasProperties: ${pset.HasProperties ? pset.HasProperties.length : 0} handles<br>
                                ExpressID: ${pset.expressID}<br>
                                Verifique o console para detalhes completos
                            </p>
                        </div>
                    `;
                    console.log(`❌ ${psetName}: Nenhuma propriedade encontrada após todas as tentativas`);
                }
                
                htmlContent += `</div>`;
            });
        } else {
            htmlContent += `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; text-align: center;">
                    <h5 style="margin: 0; color: #856404;">⚠️ Nenhum Pset Encontrado</h5>
                </div>
            `;
        }

        details.innerHTML = htmlContent;
        panel.style.display = 'block';
        
        console.log(`📋 Elemento selecionado: ${elementName} (${elementType})`);
        console.log(`📊 Total de Psets: ${props.psets ? props.psets.length : 0}`);
    }

    // 🔥 FUNÇÃO AUXILIAR PARA FORMATAR PROPRIEDADES
    function formatProperty(propName, propValue) {
        if (typeof propValue === 'boolean') {
            propValue = propValue ? '✅ Sim' : '❌ Não';
        } else if (propValue === null || propValue === undefined) {
            propValue = '<em style="color: #6c757d;">N/A</em>';
        } else if (typeof propValue === 'string' && propValue.trim() === '') {
            propValue = '<em style="color: #6c757d;">(vazio)</em>';
        } else if (typeof propValue === 'object' && propValue.constructor.name !== 'Object') {
             propValue = propValue.value !== undefined ? propValue.value : JSON.stringify(propValue);
        }
        
        const isImportant = ['Nome', 'Tipo', 'Material', 'Diâmetro', 'Comprimento', 'Altura', 'Largura', 'Insumo', 'Código', 'Quantidade', 'Preço'].includes(propName);
        const propStyle = isImportant ? 'font-weight: bold; color: #e83e8c;' : '';
        
        return `
            <li style="margin-bottom: 6px; padding: 3px 0; border-bottom: 1px dotted #f0f0f0;">
                <span style="${propStyle}">${propName}:</span> 
                <span style="float: right; text-align: right; max-width: 60%; word-break: break-word;">${propValue}</span>
            </li>
        `;
    }

    // 🚀 INICIALIZAÇÃO
    async function initializeViewer() {
        try {
            console.log("🚀 Iniciando aplicação...");
            
            // 🔥 INICIALIZA XEOKIT PRIMEIRO (agora com await)
            await initializeXeokitViewer();
            
            // 🔥 CONFIGURA CONTROLES DE MEDIÇÃO
            setupMeasurementControls();
            
            // 🔥 DEPOIS CARREGA OS MODELOS IFC
            await loadMultipleIfcs(IFC_MODELS_TO_LOAD);
            
            console.log("🎉 Aplicação inicializada com sucesso!");
            
        } catch (error) {
            console.error("🚨 Erro ao inicializar o visualizador:", error);
        }
    }

    initializeViewer();

    // =======================================================
    // 🔹 EVENTOS DE INTERAÇÃO
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
        
        // O parâmetro 'true' (pesquisa profunda/recursiva) funciona agora que forçamos o cache.
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
    
    // UPLOAD DE ARQUIVO LOCAL
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                const ifcURL = URL.createObjectURL(file);
                await loadMultipleIfcs([ifcURL]); 
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
            }
        });
    }
});