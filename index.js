import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl = null;
let isMeasuring = false;
let xeokitContainer;

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

    // 🔥 FUNÇÃO MELHORADA PARA SINCRONIZAR CÂMERAS
    function syncCamerasToXeokit() {
        if (!viewer || !xeokitViewer || !xeokitViewer.camera) {
            console.warn("⚠️ Sincronização: viewer ou xeokit não disponível");
            return;
        }
        
        try {
            // ✅ CORREÇÃO: Verifica se a estrutura da câmera existe
            const scene = viewer.context.getScene();
            if (!scene || !scene.camera) {
                console.warn("⚠️ Sincronização: câmera do Three.js não disponível");
                return;
            }

            const threeCamera = scene.camera;
            const threeControls = viewer.context.ifcCamera?.controls;
            
            if (!threeCamera || !threeControls) {
                console.warn("⚠️ Sincronização: câmera ou controles não encontrados");
                return;
            }

            const threePos = threeCamera.position;
            const threeTarget = threeControls.target;

            if (!threePos || !threeTarget) {
                console.warn("⚠️ Sincronização: posição ou target inválidos");
                return;
            }

            // Sincroniza posição e lookAt
            xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
            xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
            
            // Sincroniza FOV
            if (threeCamera.fov) {
                xeokitViewer.camera.perspective.fov = threeCamera.fov;
            }
            
            console.log("📸 Câmera sincronizada:", {
                eye: xeokitViewer.camera.eye,
                look: xeokitViewer.camera.look,
                fov: xeokitViewer.camera.perspective.fov
            });
            
        } catch (syncError) {
            console.warn("⚠️ Erro na sincronização de câmera:", syncError);
        }
    }

    // 🔥 FUNÇÃO DE DEBUG PARA VERIFICAR O ESTADO DO XEOKIT
    function debugXeokitState() {
        console.group("🔍 DEBUG XEOKIT STATE");
        console.log("📊 xeokitViewer:", !!xeokitViewer);
        console.log("📊 distanceMeasurements:", !!distanceMeasurements);
        console.log("📊 distanceMeasurementsControl:", !!distanceMeasurementsControl);
        console.log("📊 xeokitContainer:", !!xeokitContainer);
        
        if (xeokitViewer) {
            console.log("🎯 Camera:", xeokitViewer.camera ? "OK" : "MISSING");
            console.log("🎯 Scene:", xeokitViewer.scene ? "OK" : "MISSING");
        }
        
        // Verifica se as classes estão disponíveis
        const xeokitSDK = window.xeokitSDK;
        console.log("🔧 SDK disponível:", !!xeokitSDK);
        if (xeokitSDK) {
            console.log("🔧 DistanceMeasurementsControl:", !!xeokitSDK.DistanceMeasurementsControl);
            console.log("🔧 DistanceMeasurementsMouseControl:", !!xeokitSDK.DistanceMeasurementsMouseControl);
            console.log("🔧 DistanceMeasurementsPlugin:", !!xeokitSDK.DistanceMeasurementsPlugin);
        }
        console.groupEnd();
    }

    // 🔥 INICIALIZAR XEOKIT VIEWER (VERSÃO CORRIGIDA)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");
            
            const xeokitSDK = window.xeokitSDK;
            if (!xeokitSDK || !xeokitSDK.Viewer) {
                console.error("❌ xeokitSDK não disponível");
                return;
            }

            // ✅ CORREÇÃO: Verifica se as classes necessárias existem
            debugXeokitState();

            const viewerContainer = document.getElementById('viewer-container');
            if (!viewerContainer) {
                console.error("❌ Container principal não encontrado");
                return;
            }

            // ✅ CORREÇÃO: Cria o container do xeokit
            xeokitContainer = document.getElementById('xeokit-container');
            if (!xeokitContainer) {
                xeokitContainer = document.createElement('div');
                xeokitContainer.id = 'xeokit-container';
                xeokitContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10;
                    pointer-events: none;
                    display: none;
                `;
                viewerContainer.appendChild(xeokitContainer);
                console.log("✅ xeokit-container criado e anexado.");
            }

            // ✅ CORREÇÃO: Cria o canvas
            let xeokitCanvas = document.getElementById('xeokit-canvas');
            if (!xeokitCanvas) {
                xeokitCanvas = document.createElement('canvas');
                xeokitCanvas.id = 'xeokit-canvas';
                
                xeokitCanvas.width = viewerContainer.clientWidth;
                xeokitCanvas.height = viewerContainer.clientHeight;
                
                xeokitCanvas.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: block;
                `;
                
                xeokitContainer.appendChild(xeokitCanvas);
                console.log("✅ Canvas criado com ID:", xeokitCanvas.id);
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const canvasElement = document.getElementById('xeokit-canvas');
            if (!canvasElement) {
                throw new Error("Canvas não foi encontrado no DOM após criação");
            }

            console.log("🎯 Canvas encontrado no DOM");

            // ✅ CORREÇÃO: Inicializa o viewer
            let viewerInitialized = false;
            
            try {
                console.log("🔄 Tentando inicializar com canvasId...");
                xeokitViewer = new xeokitSDK.Viewer({
                    canvasId: "xeokit-canvas",
                    transparent: true,
                    alpha: true,
                    premultipliedAlpha: false
                });
                viewerInitialized = true;
                console.log("✅ Viewer inicializado com canvasId");
            } catch (idError) {
                console.warn("⚠️ Falha com canvasId, tentando com canvasElement...", idError.message);
                
                try {
                    xeokitViewer = new xeokitSDK.Viewer({
                        canvasElement: canvasElement,
                        transparent: true,
                        alpha: true,
                        premultipliedAlpha: false
                    });
                    viewerInitialized = true;
                    console.log("✅ Viewer inicializado com canvasElement");
                } catch (elementError) {
                    console.error("❌ Falha com canvasElement:", elementError.message);
                    throw new Error("Não foi possível inicializar o viewer com nenhum método");
                }
            }

            if (!viewerInitialized || !xeokitViewer) {
                throw new Error("Viewer não foi inicializado");
            }

            console.log("✅ xeokit viewer inicializado com sucesso.");

            // ✅ CORREÇÃO: INICIALIZAÇÃO DO PLUGIN DE MEDIÇÕES - TESTANDO DIFERENTES ABORDAGENS
            try {
                const xeokitSDK = window.xeokitSDK;
                
                // Tenta diferentes abordagens para inicializar o plugin
                if (xeokitSDK.DistanceMeasurementsPlugin) {
                    distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                        pointSize: 8,
                        lineWidth: 3,
                        fontColor: "#FFFFFF",
                        labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
                        lineColor: "#FF0000"
                    });
                    console.log("✅ Plugin de medições inicializado com DistanceMeasurementsPlugin");
                } else {
                    console.error("❌ DistanceMeasurementsPlugin não disponível no SDK");
                    distanceMeasurements = null;
                }
                
            } catch (pluginError) {
                console.error("❌ Erro no plugin de medições:", pluginError);
                distanceMeasurements = null;
            }

            // ✅ CORREÇÃO: CONFIGURA SINCRONIZAÇÃO DE CÂMERA
            if (viewer && viewer.context) {
                // Aguarda um pouco antes de configurar a sincronização
                setTimeout(() => {
                    try {
                        const scene = viewer.context.getScene();
                        if (scene && scene.camera) {
                            // Configura listener para mudanças de câmera
                            const originalUpdate = scene.camera.updateProjectionMatrix;
                            scene.camera.updateProjectionMatrix = function() {
                                originalUpdate.call(this);
                                syncCamerasToXeokit();
                            };
                            
                            // Sincroniza inicialmente
                            syncCamerasToXeokit();
                            console.log("✅ Sincronização de câmera configurada.");
                        }
                    } catch (syncError) {
                        console.warn("⚠️ Erro ao configurar sincronização:", syncError);
                    }
                }, 2000);
            }

        } catch (e) {
            console.error("❌ Erro ao inicializar xeokit viewer:", e);
        }
    }

    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO (VERSÃO CORRIGIDA)
    function toggleMeasurement() {
        isMeasuring = !isMeasuring;
        const button = document.getElementById('start-measurement');
        
        if (!xeokitViewer) {
            console.error("❌ xeokitViewer não inicializado.");
            isMeasuring = false;
            return;
        }

        if (!distanceMeasurements) {
            console.error("❌ distanceMeasurements não inicializado.");
            isMeasuring = false;
            return;
        }

        // ✅ CORREÇÃO CRÍTICA: TESTA DIFERENTES ABORDAGENS PARA O CONTROLE
        if (!distanceMeasurementsControl) {
            const xeokitSDK = window.xeokitSDK;
            
            try {
                // ABORDAGEM 1: Tenta DistanceMeasurementsControl tradicional
                if (xeokitSDK.DistanceMeasurementsControl) {
                    console.log("🔄 Tentando DistanceMeasurementsControl...");
                    distanceMeasurementsControl = new xeokitSDK.DistanceMeasurementsControl(distanceMeasurements, {
                        pointerLens: new xeokitSDK.PointerLens(xeokitViewer, {
                            active: true,
                            zoomFactor: 2
                        })
                    });
                    console.log("✅ DistanceMeasurementsControl inicializado com sucesso.");
                }
                // ABORDAGEM 2: Tenta DistanceMeasurementsMouseControl (mais moderna)
                else if (xeokitSDK.DistanceMeasurementsMouseControl) {
                    console.log("🔄 Tentando DistanceMeasurementsMouseControl...");
                    distanceMeasurementsControl = new xeokitSDK.DistanceMeasurementsMouseControl(distanceMeasurements, {
                        pointerLens: new xeokitSDK.PointerLens(xeokitViewer, {
                            active: true,
                            zoomFactor: 2
                        })
                    });
                    console.log("✅ DistanceMeasurementsMouseControl inicializado com sucesso.");
                }
                // ABORDAGEM 3: Tenta método direto no plugin
                else {
                    console.log("🔄 Usando controle direto do plugin...");
                    distanceMeasurementsControl = {
                        activate: () => {
                            distanceMeasurements.activate();
                            console.log("✅ Plugin ativado diretamente");
                        },
                        deactivate: () => {
                            distanceMeasurements.deactivate();
                            console.log("✅ Plugin desativado diretamente");
                        }
                    };
                }
                
            } catch (controlError) {
                console.error("❌ Erro ao criar controle de medições:", controlError);
                
                // ABORDAGEM 4: Fallback - usa o plugin diretamente
                console.log("🔄 Usando fallback direto...");
                distanceMeasurementsControl = {
                    activate: () => {
                        try {
                            distanceMeasurements.activate();
                            console.log("✅ Plugin ativado via fallback");
                        } catch (e) {
                            console.error("❌ Erro ao ativar plugin:", e);
                        }
                    },
                    deactivate: () => {
                        try {
                            distanceMeasurements.deactivate();
                            console.log("✅ Plugin desativado via fallback");
                        } catch (e) {
                            console.error("❌ Erro ao desativar plugin:", e);
                        }
                    }
                };
            }
        }

        if (isMeasuring) {
            button.textContent = 'Parar Medição';
            button.classList.add('active');
            
            // Torna o xeokit visível e interativo
            xeokitContainer.style.pointerEvents = 'all';
            xeokitContainer.style.display = 'block';
            
            try {
                // Sincroniza a câmera antes de ativar
                syncCamerasToXeokit();
                
                // Ativa o controle
                if (distanceMeasurementsControl && distanceMeasurementsControl.activate) {
                    distanceMeasurementsControl.activate();
                    console.log("▶️ Modo de Medição ATIVADO.");
                } else {
                    console.error("❌ Método activate não disponível no controle");
                }
                
                debugXeokitState();
            } catch (activateError) {
                console.error("❌ Erro ao ativar medições:", activateError);
                isMeasuring = false;
                button.textContent = 'Iniciar Medição';
                button.classList.remove('active');
            }

        } else {
            button.textContent = 'Iniciar Medição';
            button.classList.remove('active');
            
            // Torna o xeokit invisível e não interativo
            xeokitContainer.style.pointerEvents = 'none';
            xeokitContainer.style.display = 'none';

            try {
                // Desativa o controle
                if (distanceMeasurementsControl && distanceMeasurementsControl.deactivate) {
                    distanceMeasurementsControl.deactivate();
                    console.log("⏸️ Modo de Medição DESATIVADO.");
                }
            } catch (deactivateError) {
                console.error("❌ Erro ao desativar medições:", deactivateError);
            }
        }
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
    
    // 3. Inicializa o xeokit viewer (para medições)
    initializeXeokitViewer();

    // 4. Carrega os modelos IFC
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    // 5. Configura Listeners de eventos
    
    // Listener de clique para Medição
    document.getElementById('start-measurement').addEventListener('click', () => {
        if (!xeokitViewer) {
            console.error("❌ xeokitViewer não está disponível");
            alert("Sistema de medições não está disponível. Recarregue a página.");
            return;
        }
        
        if (!distanceMeasurements) {
            console.error("❌ Plugin de medições não está disponível");
            alert("Plugin de medições não carregado.");
            return;
        }
        
        toggleMeasurement();
    });

    // Listener de clique para Limpar Medições
    document.getElementById('clear-measurements').addEventListener('click', () => {
        if (distanceMeasurements) {
            distanceMeasurements.clear();
            console.log("🗑️ Todas as medições foram limpas.");
        }
    });

    // Listener de clique para Seleção (web-ifc-viewer)
    container.ondblclick = async (event) => {
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
// FUNÇÕES AUXILIARES
// ----------------------------------

// 🔥 Carrega múltiplos arquivos IFC de URLs
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
                console.log("🔄 Construindo estrutura espacial via getSpatialStructure...");
                for (const modelID of loadedIDs) {
                    await viewer.IFC.loader.ifcManager.getSpatialStructure(modelID);
                }
                console.log("✅ Estrutura espacial construída via getSpatialStructure.");
            }
            else if (viewer.IFC && viewer.IFC.loader.ifcManager.get && viewer.IFC.loader.ifcManager.get.spatialStructure) {
                console.log("🔄 Construindo estrutura espacial via spatialStructure.build...");
                const structurePromises = loadedIDs.map(id => 
                    viewer.IFC.loader.ifcManager.get.spatialStructure.build(id)
                );
                await Promise.all(structurePromises);
                console.log("✅ Estrutura espacial construída via spatialStructure.build.");
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

// 🔥 Mostra as propriedades de um elemento
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

// 🔥 Helper para formatar o valor da propriedade
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

// 🔥 Helper para adicionar linha na tabela de propriedades
function addRow(table, key, value) {
    const row = table.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = value;
}

// 🔥 Helper para adicionar cabeçalho na tabela de propriedades
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

// 🔥 Helper para adicionar cabeçalho Pset
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

// 🔥 Cria o item de controle de visibilidade
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

// 🔥 Alterna a visibilidade do modelo
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

// 🔥 Atualiza o painel de controle de visibilidade
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