import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl; // Será inicializado como null e criado sob demanda
let isMeasuring = false;
let xeokitContainer; // Definido para fácil acesso aos estilos e DOM

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

    // 🔥 FUNÇÃO PARA SINCRONIZAR CÂMERAS
    const syncCameras = (threeJSCamera, orbitControls, xeokitViewer) => {
        if (!xeokitViewer || !xeokitViewer.camera) return;

        const threePos = threeJSCamera.position;
        const threeTarget = orbitControls.target;

        // 1. Sincroniza posição e orientação
        xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
        xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];

        // 2. Sincroniza o fov (importante para zoom/perspectiva)
        xeokitViewer.camera.perspective.fov = threeJSCamera.fov;

        // 3. Renderiza o xeokit para aplicar a mudança
        // Nota: O xeokit por padrão cria seu próprio canvas dentro do container.
        // Se precisar de renderização manual, use xeokitViewer.scene.render();
    };


    // 🔥 INICIALIZAÇÃO CORRIGIDA DO PLUGIN DE MEDIÇÕES
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");
            
            const xeokitSDK = window.xeokitSDK;
            if (!xeokitSDK || !xeokitSDK.Viewer) {
                console.error("❌ xeokitSDK não disponível");
                return;
            }

            // ... (código anterior para criar container e canvas) ...

            // ✅ INICIALIZAÇÃO DO VIEWER
            xeokitViewer = new xeokitSDK.Viewer({
                canvasId: "xeokit-canvas",
                transparent: true,
                alpha: true,
                premultipliedAlpha: false
            });

            console.log("✅ xeokit viewer inicializado com sucesso.");

            // ✅ INICIALIZAÇÃO CORRIGIDA DO PLUGIN DE MEDIÇÕES
            try {
                distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                    // Configurações básicas
                    pointSize: 4,
                    lineWidth: 2,
                    fontColor: "#FFFFFF",
                    labelBackgroundColor: "rgba(0, 0, 0, 0.8)",
                    lineColor: "#FF0000",
                    labelPrefix: "Dist: ",
                    labelSuffix: " m"
                });

                console.log("✅ Plugin DistanceMeasurementsPlugin inicializado:", distanceMeasurements);
                
                // ✅ VERIFICA SE O PLUGIN FOI CRIADO CORRETAMENTE
                if (!distanceMeasurements || typeof distanceMeasurements !== 'object') {
                    throw new Error("Plugin de medições não foi criado corretamente");
                }

            } catch (pluginError) {
                console.error("❌ Erro ao inicializar plugin de medições:", pluginError);
                distanceMeasurements = null;
                return;
            }

            // ... (resto do código de sincronização de câmera) ...

        } catch (e) {
            console.error("❌ Erro ao inicializar xeokit viewer:", e);
        }
    }


    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO (VERSÃO CORRIGIDA)
    function toggleMeasurement() {
        isMeasuring = !isMeasuring;
        const button = document.getElementById('start-measurement');
        
        // ✅ CORREÇÃO: Verificações mais robustas
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

        // ✅ CORREÇÃO: Inicializa o controle APENAS na primeira vez com verificação
        if (!distanceMeasurementsControl) {
            const xeokitSDK = window.xeokitSDK;
            if (xeokitSDK && xeokitSDK.DistanceMeasurementsControl) {
                try {
                    // ✅ CORREÇÃO CRÍTICA: Passa o plugin correto
                    distanceMeasurementsControl = new xeokitSDK.DistanceMeasurementsControl(distanceMeasurements, {
                        // Configurações opcionais
                        pointerLens: new xeokitSDK.PointerLens(xeokitViewer, {
                            active: true,
                            zoomFactor: 2
                        })
                    });
                    console.log("✅ DistanceMeasurementsControl inicializado com sucesso.");
                } catch (controlError) {
                    console.error("❌ Erro ao criar DistanceMeasurementsControl:", controlError);
                    isMeasuring = false;
                    return;
                }
            } else {
                console.error("❌ DistanceMeasurementsControl não disponível no SDK.");
                isMeasuring = false;
                return;
            }
        }

        if (isMeasuring) {
            button.textContent = 'Parar Medição';
            button.classList.add('active');
            
            // Torna o xeokit visível e interativo
            xeokitContainer.style.pointerEvents = 'all';
            xeokitContainer.style.display = 'block';
            
            try {
                // ✅ CORREÇÃO: Usa activate() corretamente
                distanceMeasurementsControl.activate();
                console.log("▶️ Modo de Medição ATIVADO.");
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
                // ✅ CORREÇÃO: Usa deactivate() corretamente
                distanceMeasurementsControl.deactivate();
                console.log("⏸️ Modo de Medição DESATIVADO.");
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
    viewer.IFC.setWasmPath('wasm/'); // Define o caminho para os arquivos .wasm
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
        // ✅ VERIFICAÇÃO ANTES DE TENTAR MEDIR
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
             // Se estiver no modo de medição, a primeira tecla ESC deve desativá-lo
            if (isMeasuring) {
                toggleMeasurement();
                return;
            }
             // Se não estiver medindo, limpa a seleção
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
                // Para arquivos locais, usamos a função de carregamento de arquivos nativa do web-ifc-viewer
                // Não é necessário usar loadMultipleIfcs (que é otimizada para URLs)
                try {
                    const model = await viewer.IFC.loadIfc(file, true); // true para limpar modelos existentes
                    
                    if (model && model.modelID !== undefined) {
                         // Limpa a lista de modelos existentes (já que loadIfc limpa o viewer)
                        loadedModels.clear(); 
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: file.name,
                            url: `local://${file.name}`
                        });
                        
                        console.log(`✅ Sucesso no carregamento local: ${file.name} (ID: ${model.modelID})`);
                        // ✅ CORREÇÃO: Garante que o IFC Manager.get.spatialStructure existe antes de usá-lo
                        if (viewer.IFC.loader.ifcManager.get && viewer.IFC.loader.ifcManager.get.spatialStructure) {
                            await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                        } else {
                             console.warn("⚠️ Não foi possível construir a estrutura espacial, IfcManager.get.spatialStructure não está pronto.");
                        }

                        updateVisibilityControls();
                        viewer.context.fitToFrame([model.modelID]);
                    }
                } catch (e) {
                    console.error("❌ Erro ao carregar arquivo local IFC:", e);
                }
                document.getElementById('properties-panel').style.display = 'none';
                // O objeto URL.createObjectURL não é necessário aqui
            }
        });
    }

});

// ----------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------

// 🔥 Carrega múltiplos arquivos IFC de URLs (VERSÃO CORRIGIDA)
    async function loadMultipleIfcs(urls) {
        console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);
        
        // Limpa a lista antes de carregar novos modelos
        loadedModels.clear();

        const loadPromises = urls.map(async (url, index) => {
            console.log(`📦 Tentando carregar: ${url}`);
            try {
                // Usar 'loadIfcUrl' para carregar strings de URL de assets estáticos.
                const model = await viewer.IFC.loadIfcUrl(url, false); // false para NÃO limpar modelos existentes
                
                if (model && model.modelID !== undefined) {
                    loadedModels.set(model.modelID, {
                        visible: true,
                        name: url.split('/').pop(), // Usa o nome do arquivo como nome
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
            
            // ✅ CORREÇÃO: Aguarda um pouco para garantir que o IFC Manager esteja pronto
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // ✅ CORREÇÃO MELHOR: Usa a API correta do web-ifc-viewer para construir estrutura espacial
            try {
                // Método 1: Tenta usar a API pública do viewer
                if (viewer.IFC && typeof viewer.IFC.loader.ifcManager.getSpatialStructure === 'function') {
                    console.log("🔄 Construindo estrutura espacial via getSpatialStructure...");
                    for (const modelID of loadedIDs) {
                        await viewer.IFC.loader.ifcManager.getSpatialStructure(modelID);
                    }
                    console.log("✅ Estrutura espacial construída via getSpatialStructure.");
                }
                // Método 2: Tenta método alternativo
                else if (viewer.IFC && viewer.IFC.loader.ifcManager.get && viewer.IFC.loader.ifcManager.get.spatialStructure) {
                    console.log("🔄 Construindo estrutura espacial via spatialStructure.build...");
                    const structurePromises = loadedIDs.map(id => 
                        viewer.IFC.loader.ifcManager.get.spatialStructure.build(id)
                    );
                    await Promise.all(structurePromises);
                    console.log("✅ Estrutura espacial construída via spatialStructure.build.");
                }
                // Método 3: Tenta método mais recente
                else if (viewer.IFC && typeof viewer.IFC.loader.ifcManager.createSubset === 'function') {
                    console.log("🔄 Estrutura espacial será construída automaticamente pelo viewer...");
                    // O viewer moderno constrói automaticamente
                }
                else {
                    console.warn("⚠️ API de estrutura espacial não encontrada. Tentando método direto...");
                    // Método de fallback: tenta acessar diretamente
                    for (const modelID of loadedIDs) {
                        try {
                            await viewer.IFC.getSpatialStructure(modelID);
                        } catch (e) {
                            console.warn(`⚠️ Não foi possível construir estrutura para modelo ${modelID}:`, e.message);
                        }
                    }
                }
            } catch (error) {
                console.warn("⚠️ Estrutura espacial não pôde ser construída:", error.message);
                console.log("💡 O visualizador funcionará, mas algumas funcionalidades podem estar limitadas.");
            }

            // Ajusta a câmera para enquadrar todos os modelos
            viewer.context.fitToFrame(loadedIDs); 
            
            // Atualiza os controles de visibilidade
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

    // Propriedades Básicas
    if (props.GlobalId) addRow(propTable, 'GlobalId', props.GlobalId.value);
    if (props.Name) addRow(propTable, 'Name', props.Name.value);
    
    // Adiciona uma linha de separação
    addHeader(propTable, 'Propriedades IFC');
    
    // Outras Propriedades
    for (const key in props) {
        if (key !== 'expressID' && key !== 'type' && key !== 'GlobalId' && key !== 'Name' && key !== 'properties') {
            const prop = props[key];
            const value = formatValue(prop);
            addRow(propTable, key, value);
        }
    }
    
    // Propriedades do Pset (se existirem)
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
    if (prop.map) { // Se for uma lista de valores
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
