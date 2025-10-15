import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES XEOKIT
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl = null;
let isMeasuring = false;
let xeokitContainer;
let pointerLens;

// ✅ LISTA DE ARQUIVOS IFC 
const IFC_MODELS_TO_LOAD = [
    'models/01.ifc',
    'models/02.ifc',
];

// 🔥 CONTROLE DE VISIBILIDADE
let loadedModels = new Map();

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

    // 🔥 FUNÇÃO PARA SINCRONIZAR CÂMERAS
    function syncCamerasToXeokit() {
        if (!viewer || !xeokitViewer || !xeokitViewer.camera) {
            return;
        }
        
        try {
            const scene = viewer.context.getScene();
            if (!scene || !scene.camera) {
                return;
            }

            const threeCamera = scene.camera;
            const threeControls = viewer.context.ifcCamera?.controls;
            
            if (!threeCamera || !threeControls) {
                return;
            }

            const threePos = threeCamera.position;
            const threeTarget = threeControls.target;

            if (!threePos || !threeTarget) {
                return;
            }

            // Sincroniza posição e lookAt
            xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
            xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
            
            // Sincroniza FOV
            if (threeCamera.fov) {
                xeokitViewer.camera.perspective.fov = threeCamera.fov;
            }
            
        } catch (syncError) {
            console.warn("⚠️ Erro na sincronização de câmera:", syncError);
        }
    }

    // 🔥 FUNÇÃO PARA GARANTIR QUE O CANVAS ESTEJA PRONTO
    async function ensureCanvasReady() {
        const canvas = document.getElementById('xeokit-canvas');
        if (!canvas) {
            console.error("❌ Canvas não encontrado");
            return false;
        }

        // ✅ FORÇA REDIMENSIONAMENTO SE NECESSÁRIO
        if (canvas.width === 0 || canvas.height === 0) {
            console.warn("🔄 Canvas com dimensões zero, redimensionando...");
            const container = document.getElementById('viewer-container');
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                console.log("✅ Canvas redimensionado para:", canvas.width, "x", canvas.height);
            }
        }

        // ✅ AGUARDA O CANVAS ESTAR COMPLETAMENTE PRONTO
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            if (canvas.width > 0 && canvas.height > 0) {
                console.log("✅ Canvas pronto após", attempts + 1, "tentativas");
                return true;
            }
            
            console.log("🔄 Aguardando canvas... tentativa", attempts + 1);
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        console.error("❌ Timeout: Canvas não ficou pronto após", maxAttempts, "tentativas");
        return false;
    }

    // 🔥 INICIALIZAR XEOKIT VIEWER (VERSÃO MAIS ROBUSTA)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");
            
            const xeokitSDK = window.xeokitSDK;
            if (!xeokitSDK || !xeokitSDK.Viewer) {
                console.error("❌ xeokitSDK não disponível");
                return;
            }

            const viewerContainer = document.getElementById('viewer-container');
            if (!viewerContainer) {
                console.error("❌ Container principal não encontrado");
                return;
            }

            // ✅ CORREÇÃO: GARANTE QUE O CONTAINER XEOKIT EXISTA
            xeokitContainer = document.getElementById('xeokit-container');
            if (!xeokitContainer) {
                xeokitContainer = document.createElement('div');
                xeokitContainer.id = 'xeokit-container';
                // ✅ ESTILO CRÍTICO: DEVE SER VISÍVEL E COM DIMENSÕES
                xeokitContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10;
                    pointer-events: none;
                    display: block;  // ✅ MUDADO PARA block PARA GARANTIR VISIBILIDADE
                    visibility: visible;
                    opacity: 1;
                `;
                viewerContainer.appendChild(xeokitContainer);
                console.log("✅ xeokit-container criado e anexado.");
            }

            // ✅ CORREÇÃO: CRIA O CANVAS COM ESTILO EXPLÍCITO
            let xeokitCanvas = document.getElementById('xeokit-canvas');
            if (!xeokitCanvas) {
                xeokitCanvas = document.createElement('canvas');
                xeokitCanvas.id = 'xeokit-canvas';
                
                // ✅ DIMENSÕES EXPLÍCITAS E ESTILO GARANTIDO
                const containerWidth = viewerContainer.clientWidth;
                const containerHeight = viewerContainer.clientHeight;
                
                xeokitCanvas.width = containerWidth;
                xeokitCanvas.height = containerHeight;
                
                xeokitCanvas.style.cssText = `
                    width: ${containerWidth}px;
                    height: ${containerHeight}px;
                    display: block;
                    position: absolute;
                    top: 0;
                    left: 0;
                    visibility: visible;
                    opacity: 1;
                `;
                
                xeokitContainer.appendChild(xeokitCanvas);
                console.log("✅ Canvas criado com dimensões:", xeokitCanvas.width, "x", xeokitCanvas.height);
            }

            // ✅ AGUARDA O CANVAS ESTAR PRONTO
            const canvasReady = await ensureCanvasReady();
            if (!canvasReady) {
                throw new Error("Canvas não ficou pronto para inicialização");
            }

            console.log("🎯 Canvas verificado e pronto para uso");

            // ✅ INICIALIZAÇÃO DO VIEWER XEOKIT
            try {
                console.log("🔄 Criando viewer xeokit...");
                
                // ✅ TENTA DIFERENTES MÉTODOS DE INICIALIZAÇÃO
                let viewerInitialized = false;
                
                // Método 1: Com canvasId
                try {
                    xeokitViewer = new xeokitSDK.Viewer({
                        canvasId: "xeokit-canvas",
                        transparent: true,
                        alpha: true,
                        premultipliedAlpha: false
                    });
                    viewerInitialized = true;
                    console.log("✅ Viewer xeokit inicializado com canvasId");
                } catch (idError) {
                    console.warn("⚠️ Falha com canvasId, tentando canvasElement...");
                    
                    // Método 2: Com canvasElement
                    const canvasElement = document.getElementById('xeokit-canvas');
                    if (canvasElement) {
                        xeokitViewer = new xeokitSDK.Viewer({
                            canvasElement: canvasElement,
                            transparent: true,
                            alpha: true,
                            premultipliedAlpha: false
                        });
                        viewerInitialized = true;
                        console.log("✅ Viewer xeokit inicializado com canvasElement");
                    }
                }

                if (!viewerInitialized || !xeokitViewer) {
                    throw new Error("Não foi possível inicializar o viewer xeokit");
                }

                // ✅ AGUARDA O VIEWER ESTABILIZAR
                console.log("🔄 Aguardando viewer estabilizar...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // ✅ VERIFICA SE O VIEWER ESTÁ FUNCIONAL
                if (!xeokitViewer.scene) {
                    throw new Error("Viewer não tem scene inicializada");
                }
                
                console.log("✅ Viewer xeokit completamente inicializado e estável");

            } catch (viewerError) {
                console.error("❌ Erro ao inicializar viewer xeokit:", viewerError);
                return;
            }

            // ✅ INICIALIZAÇÃO DO PLUGIN DE MEDIÇÕES
            try {
                const xeokitSDK = window.xeokitSDK;
                
                if (xeokitSDK.DistanceMeasurementsPlugin) {
                    distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                        pointSize: 8,
                        lineWidth: 3,
                        fontColor: "#FFFFFF",
                        labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
                        lineColor: "#FF0000"
                    });
                    console.log("✅ DistanceMeasurementsPlugin inicializado");
                    
                } else {
                    console.error("❌ DistanceMeasurementsPlugin não disponível no SDK");
                    distanceMeasurements = null;
                }
                
            } catch (pluginError) {
                console.error("❌ Erro no plugin de medições:", pluginError);
                distanceMeasurements = null;
            }

            // ✅ CONFIGURA SINCRONIZAÇÃO DE CÂMERA
            if (viewer && viewer.context) {
                setInterval(() => {
                    syncCamerasToXeokit();
                }, 100);
                
                console.log("✅ Sincronização de câmera configurada.");
            }

        } catch (e) {
            console.error("❌ Erro ao inicializar xeokit viewer:", e);
        }
    }

    // 🔥 FUNÇÃO PARA INICIALIZAR O POINTERLENS (SEM VERIFICAÇÃO DE CANVAS)
    function initializePointerLens() {
        if (!xeokitViewer) {
            console.error("❌ xeokitViewer não disponível para PointerLens");
            return null;
        }

        const xeokitSDK = window.xeokitSDK;
        
        try {
            if (xeokitSDK.PointerLens) {
                console.log("🔄 Inicializando PointerLens...");
                
                // ✅ CORREÇÃO: INICIALIZA SEM VERIFICAR CANVAS (O VIEWER JÁ FAZ ISSO)
                const lens = new xeokitSDK.PointerLens(xeokitViewer, {
                    active: false, // Inicia desativado
                    zoomFactor: 2
                });

                console.log("✅ PointerLens inicializado");
                return lens;
                
            } else {
                console.warn("⚠️ PointerLens não disponível no SDK");
                return null;
            }
        } catch (lensError) {
            console.error("❌ Erro ao inicializar PointerLens:", lensError);
            return null;
        }
    }

    // 🔥 FUNÇÃO PARA INICIALIZAR O CONTROLE DE MEDIÇÕES
    function initializeMeasurementsControl() {
        if (!distanceMeasurements || !xeokitViewer) {
            console.error("❌ Plugin ou viewer não disponível para inicializar controle");
            return null;
        }

        const xeokitSDK = window.xeokitSDK;
        
        try {
            // ✅ INICIALIZA O POINTERLENS
            if (!pointerLens) {
                pointerLens = initializePointerLens();
            }

            // ✅ ABORDAGEM 1: Tenta DistanceMeasurementsMouseControl
            if (xeokitSDK.DistanceMeasurementsMouseControl) {
                console.log("🔄 Inicializando DistanceMeasurementsMouseControl...");
                
                const controlConfig = {};
                if (pointerLens) {
                    controlConfig.pointerLens = pointerLens;
                }
                
                const control = new xeokitSDK.DistanceMeasurementsMouseControl(distanceMeasurements, controlConfig);
                
                control.snapToVertex = true;
                control.snapToEdge = true;
                
                console.log("✅ DistanceMeasurementsMouseControl inicializado com sucesso");
                return control;
            }
            
            // ✅ ABORDAGEM 2: Tenta DistanceMeasurementsControl (fallback)
            else if (xeokitSDK.DistanceMeasurementsControl) {
                console.log("🔄 Inicializando DistanceMeasurementsControl (fallback)...");
                
                const controlConfig = {};
                if (pointerLens) {
                    controlConfig.pointerLens = pointerLens;
                }
                
                const control = new xeokitSDK.DistanceMeasurementsControl(distanceMeasurements, controlConfig);
                
                console.log("✅ DistanceMeasurementsControl inicializado com sucesso");
                return control;
            }
            else {
                console.error("❌ Nenhum controle de medições disponível no SDK");
                return null;
            }
            
        } catch (controlError) {
            console.error("❌ Erro ao inicializar controle de medições:", controlError);
            return null;
        }
    }

    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO (SIMPLIFICADA)
    function toggleMeasurement() {
        // ✅ VERIFICAÇÕES INICIAIS
        if (!xeokitViewer) {
            console.error("❌ xeokitViewer não inicializado.");
            alert("Sistema de medições não está disponível. Aguarde a inicialização completa.");
            return;
        }

        if (!distanceMeasurements) {
            console.error("❌ distanceMeasurements não inicializado.");
            alert("Plugin de medições não carregado.");
            return;
        }

        // ✅ INICIALIZA O CONTROLE SE NECESSÁRIO
        if (!distanceMeasurementsControl) {
            console.log("🔄 Inicializando controle de medições...");
            distanceMeasurementsControl = initializeMeasurementsControl();
            
            if (!distanceMeasurementsControl) {
                console.error("❌ Não foi possível inicializar o controle de medições");
                alert("Erro ao inicializar controle de medições.");
                return;
            }
        }

        isMeasuring = !isMeasuring;
        const button = document.getElementById('start-measurement');

        if (isMeasuring) {
            button.textContent = 'Parar Medição';
            button.classList.add('active');
            
            try {
                // ✅ CORREÇÃO: ATIVA DIRETAMENTE SEM VERIFICAÇÕES COMPLEXAS
                console.log("🔄 Ativando modo de medição...");
                
                // Torna o xeokit visível e interativo
                xeokitContainer.style.pointerEvents = 'all';
                xeokitContainer.style.display = 'block';
                
                // Ativa o controle
                if (typeof distanceMeasurementsControl.activate === 'function') {
                    distanceMeasurementsControl.activate();
                    console.log("✅ Modo de medição ATIVADO");
                }

                // Ativa o PointerLens se existir
                if (pointerLens) {
                    setTimeout(() => {
                        try {
                            pointerLens.active = true;
                            pointerLens.visible = true;
                            console.log("🔍 PointerLens ativado");
                        } catch (lensError) {
                            console.warn("⚠️ Erro ao ativar PointerLens:", lensError);
                        }
                    }, 500);
                }
                
                setupMeasurementEvents();
                
            } catch (activateError) {
                console.error("❌ Erro ao ativar medições:", activateError);
                isMeasuring = false;
                button.textContent = 'Iniciar Medição';
                button.classList.remove('active');
                alert("Erro ao ativar medições. Tente novamente.");
            }

        } else {
            button.textContent = 'Iniciar Medição';
            button.classList.remove('active');
            
            try {
                console.log("🔄 Desativando modo de medição...");
                
                // Desativa o PointerLens primeiro
                if (pointerLens) {
                    pointerLens.active = false;
                    pointerLens.visible = false;
                }

                // Desativa o controle
                if (typeof distanceMeasurementsControl.deactivate === 'function') {
                    distanceMeasurementsControl.deactivate();
                }

                // Torna o xeokit invisível
                xeokitContainer.style.pointerEvents = 'none';
                xeokitContainer.style.display = 'none';
                
                console.log("✅ Modo de medição DESATIVADO");
                removeMeasurementEvents();
                
            } catch (deactivateError) {
                console.error("❌ Erro ao desativar medições:", deactivateError);
            }
        }
    }

    // 🔥 CONFIGURA EVENTOS DAS MEDIÇÕES
    function setupMeasurementEvents() {
        if (!distanceMeasurements) return;

        distanceMeasurements.on("created", (e) => {
            console.log("📏 Medição criada:", e.measurement.id);
        });

        distanceMeasurements.on("destroyed", (e) => {
            console.log("🗑️ Medição destruída:", e.measurement.id);
        });

        console.log("✅ Event listeners de medições configurados");
    }

    // 🔥 REMOVE EVENT LISTENERS
    function removeMeasurementEvents() {
        if (!distanceMeasurements) return;
        
        distanceMeasurements.off("created");
        distanceMeasurements.off("destroyed");
        
        console.log("✅ Event listeners de medições removidos");
    }

    // ----------------------------------
    // CONFIGURAÇÃO INICIAL
    // ----------------------------------
    
    // 1. Cria o Viewer (web-ifc-viewer)
    viewer = CreateViewer(container);
    
    // 2. Inicializa o Viewer (web-ifc-viewer)
    viewer.IFC.setWasmPath('wasm/');
    viewer.IFC.loader.ifcManager.applyWebIfcConfig({
        COORDINATE_TO_ORIGIN: true,
        USE_FAST_BOOLS: true
    });
    
    // 3. Inicializa o xeokit viewer (para medições) - COM DELAY PARA GARANTIR ESTABILIDADE
    setTimeout(() => {
        console.log("🔄 Iniciando inicialização do xeokit...");
        initializeXeokitViewer();
    }, 3000);

    // 4. Carrega os modelos IFC
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    // 5. Configura Listeners de eventos
    
    // Listener de clique para Medição
    document.getElementById('start-measurement').addEventListener('click', () => {
        toggleMeasurement();
    });

    // Listener de clique para Limpar Medições
    document.getElementById('clear-measurements').addEventListener('click', () => {
        if (distanceMeasurements && typeof distanceMeasurements.clear === 'function') {
            distanceMeasurements.clear();
            console.log("🗑️ Todas as medições foram limpas.");
        }
    });

    // Listener de clique para Seleção (web-ifc-viewer)
    container.ondblclick = async (event) => {
        if (isMeasuring) {
            console.log("📏 Modo de medição ativo - seleção do IFC ignorada");
            return;
        }

        const result = await viewer.IFC.selector.pick(true);

        if (!result) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(result.modelID, result.id, false);
        
        const props = await viewer.IFC.getProperties(result.modelID, result.id, true);
        
        lastProps = props; 
        console.log("🟩 Item selecionado:", lastProps);
        
        showProperties(props, result.id);
    };

    window.onkeydown = (event) => {
        if (event.code === 'Escape') {
            if (isMeasuring) {
                toggleMeasurement();
                return;
            }
            if (viewer?.IFC?.selector) {
                viewer.IFC.selector.unpickIfcItems();
                viewer.IFC.selector.unHighlightIfcItems();
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
            }
        }
    };
    
    // UPLOAD DE ARQUIVO LOCAL
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                try {
                    const model = await viewer.IFC.loadIfc(file, true);
                    
                    if (model && model.modelID !== undefined) {
                        loadedModels.clear(); 
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: file.name,
                            url: `local://${file.name}`
                        });
                        
                        console.log(`✅ Sucesso no carregamento local: ${file.name} (ID: ${model.modelID})`);
                        
                        if (viewer.IFC.loader.ifcManager.get && viewer.IFC.loader.ifcManager.get.spatialStructure) {
                            await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                        }
                        
                        updateVisibilityControls();
                        viewer.context.fitToFrame([model.modelID]);
                    }
                } catch (e) {
                    console.error("❌ Erro ao carregar arquivo local IFC:", e);
                }
                document.getElementById('properties-panel').style.display = 'none';
            }
        });
    }

});

// ----------------------------------
// FUNÇÕES AUXILIARES (MANTIDAS)
// ----------------------------------

async function loadMultipleIfcs(urls) {
    console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);
    
    loadedModels.clear();

    const loadPromises = urls.map(async (url, index) => {
        console.log(`📦 Tentando carregar: ${url}`);
        try {
            const model = await viewer.IFC.loadIfcUrl(url, false);
            
            if (model && model.modelID !== undefined) {
                loadedModels.set(model.modelID, {
                    visible: true,
                    name: url.split('/').pop(),
                    url: url
                });
                console.log(`✅ Sucesso no carregamento: ${url} (ID: ${model.modelID})`);
                return model.modelID;
            }
            return null;

        } catch (e) {
            console.error(`❌ Erro ao carregar ${url}:`, e);
            return null;
        }
    });

    const loadedIDs = (await Promise.all(loadPromises)).filter(id => id !== null);

    if (loadedIDs.length > 0) {
        console.log(`🎉 ${loadedIDs.length}/${urls.length} modelo(s) carregados!`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            if (viewer.IFC && typeof viewer.IFC.loader.ifcManager.getSpatialStructure === 'function') {
                for (const modelID of loadedIDs) {
                    await viewer.IFC.loader.ifcManager.getSpatialStructure(modelID);
                }
            }
        } catch (error) {
            console.warn("⚠️ Estrutura espacial não pôde ser construída:", error.message);
        }

        viewer.context.fitToFrame(loadedIDs); 
        updateVisibilityControls();

    } else {
        console.warn("⚠️ Nenhum modelo IFC foi carregado com sucesso.");
    }
}

function showProperties(props, id) {
    const propertiesPanel = document.getElementById('properties-panel');
    const detailsContainer = document.getElementById('element-details');
    const titleElement = document.getElementById('element-title');

    titleElement.textContent = props.type ? `${props.type.value} [ID: ${id}]` : `Elemento [ID: ${id}]`;
    detailsContainer.innerHTML = '';
    
    const propTable = document.createElement('table');
    propTable.className = 'properties-table';

    if (props.GlobalId) addRow(propTable, 'GlobalId', props.GlobalId.value);
    if (props.Name) addRow(propTable, 'Name', props.Name.value);
    
    addHeader(propTable, 'Propriedades IFC');
    
    for (const key in props) {
        if (key !== 'expressID' && key !== 'type' && key !== 'GlobalId' && key !== 'Name' && key !== 'properties') {
            const prop = props[key];
            const value = formatValue(prop);
            addRow(propTable, key, value);
        }
    }
    
    if (props.properties) {
        addHeader(propTable, 'Conjuntos de Propriedades (Psets)', true);
        
        for (const psetName in props.properties) {
            const pset = props.properties[psetName];
            addPsetHeader(propTable, psetName);
            
            for (const propName in pset) {
                const prop = pset[propName];
                const value = formatValue(prop);
                addRow(propTable, propName, value);
            }
        }
    }

    detailsContainer.appendChild(propTable);
    propertiesPanel.style.display = 'block';
}

function formatValue(prop) {
    if (prop === undefined || prop === null) return 'N/A';
    if (prop.value !== undefined) {
        return prop.value;
    }
    if (prop.map) {
        return `[${prop.map(p => formatValue(p)).join(', ')}]`;
    }
    return prop.toString();
}

function addRow(table, key, value) {
    const row = table.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = value;
}

function addHeader(table, text, isSubHeader = false) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = text;
    cell.style.fontWeight = 'bold';
    cell.style.backgroundColor = isSubHeader ? '#ddd' : '#bbb';
    cell.style.marginTop = isSubHeader ? '10px' : '0';
    cell.style.paddingTop = '8px';
    cell.style.paddingBottom = '8px';
}

function addPsetHeader(table, text) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 2;
    cell.textContent = text;
    cell.style.fontWeight = 'bold';
    cell.style.backgroundColor = '#ccc';
    cell.style.padding = '5px';
    cell.style.marginTop = '5px';
}

function createIfcTreeItem(modelID, name, isVisible) {
    const item = document.createElement('div');
    item.className = 'ifc-tree-item';
    item.dataset.modelId = modelID;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isVisible;
    checkbox.addEventListener('change', () => toggleModelVisibility(modelID, checkbox.checked));
    
    const label = document.createElement('label');
    label.textContent = name;
    
    item.appendChild(checkbox);
    item.appendChild(label);
    return item;
}

async function toggleModelVisibility(modelID, visible) {
    if (!viewer || modelID === undefined) return;

    if (visible) {
        viewer.context.getScene().getMesh(modelID).visible = true;
    } else {
        viewer.context.getScene().getMesh(modelID).visible = false;
    }
    
    const modelData = loadedModels.get(modelID);
    if (modelData) {
        modelData.visible = visible;
        loadedModels.set(modelID, modelData);
    }
}

function updateVisibilityControls() {
    const controlPanel = document.getElementById('visibility-controls');
    controlPanel.innerHTML = '';
    
    if (loadedModels.size === 0) {
        controlPanel.style.display = 'none';
        return;
    }
    
    const title = document.createElement('h4');
    title.textContent = '👁️ Modelos Carregados';
    controlPanel.appendChild(title);

    loadedModels.forEach((data, id) => {
        const item = createIfcTreeItem(id, data.name, data.visible);
        controlPanel.appendChild(item);
    });
    
    controlPanel.style.display = 'block';
}