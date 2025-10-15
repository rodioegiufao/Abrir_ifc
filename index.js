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
let xeokitContainer; // Definido globalmente para fácil acesso aos estilos

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
        const threePos = threeJSCamera.position;
        const threeTarget = orbitControls.target;

        // 1. Sincroniza posição e orientação
        xeokitViewer.camera.eye = [threePos.x, threePos.y, threePos.z];
        xeokitViewer.camera.look = [threeTarget.x, threeTarget.y, threeTarget.z];
        xeokitViewer.camera.up = [threeJSCamera.up.x, threeJSCamera.up.y, threeJSCamera.up.z];
        
        // 2. Sincroniza parâmetros de projeção
        xeokitViewer.camera.projection = "perspective";
        xeokitViewer.camera.near = threeJSCamera.near;
        xeokitViewer.camera.far = threeJSCamera.far;
        xeokitViewer.camera.fovy = threeJSCamera.fov;

        // 3. Garante que o xeokit redesenhe
        xeokitViewer.scene.redraw();
    };

    // 🔥 INICIALIZAR XEOKIT VIEWER PARA MEDIÇÕES (COM SINCRONIZAÇÃO)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");

            // ✅ SOLUÇÃO: Importa dinamicamente o módulo xeokit
            const xeokitSDK = await import('./wasm/xeokit-sdk.es.js');
            
            console.log("✅ xeokit SDK importado:", Object.keys(xeokitSDK).slice(0, 10).concat('...'));

            // 1. Cria um contêiner para o xeokit DENTRO do viewer-container
            xeokitContainer = document.createElement('div');
            xeokitContainer.id = 'xeokit-container';
            xeokitContainer.style.position = 'absolute';
            xeokitContainer.style.top = '0';
            xeokitContainer.style.left = '0';
            xeokitContainer.style.width = '100%';
            xeokitContainer.style.height = '100%';
            // 🔥 CRUCIAL: Inicialmente, permite que eventos passem para o viewer IFC
            xeokitContainer.style.pointerEvents = 'none'; 
            document.getElementById('viewer-container').appendChild(xeokitContainer);

            // 2. Inicializa o xeokit Viewer
            xeokitViewer = new xeokitSDK.Viewer({
                canvasId: xeokitContainer.id,
                transparent: true, // Garante que o viewer IFC seja visto
                sRGBOutput: true
            });

            // 3. Configura a sincronização da câmera do Three.js para o Xeokit
            const threeJSCamera = viewer.context.camera;
            const orbitControls = viewer.context.controls;

            // CRUCIAL: Sincroniza a câmera sempre que o controle (rotação, pan, zoom) for alterado.
            orbitControls.addEventListener('change', () => syncCameras(threeJSCamera, orbitControls, xeokitViewer));
            
            // Sincroniza a câmera na inicialização
            syncCameras(threeJSCamera, orbitControls, xeokitViewer);

            // 4. Inicializa o plugin de medições
            distanceMeasurements = new xeokitSDK.DistanceMeasurementsPlugin(xeokitViewer, {
                fontFamily: "sans-serif",
                fontSize: "14px",
                scale: [1, 1, 1],
                // Cor do label do texto
                labelColor: "black",
                // Cor do background do label do texto
                labelBackgroundColor: "rgba(255, 255, 255, 0.7)" 
            });

            // 5. Adiciona o controle de mouse para medições de distância
            distanceMeasurementsControl = new xeokitSDK.DistanceMeasurementsMouseControl(distanceMeasurements);

            console.log("✅ Plugin de medições xeokit inicializado com sucesso");
            
        } catch (error) {
            console.error("❌ Erro ao inicializar xeokit viewer:", error);
            document.getElementById('start-measurement').disabled = true;
            document.getElementById('start-measurement').textContent = 'Erro de Medição';
        }
    }

    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO
    const toggleMeasurement = () => {
        if (!distanceMeasurementsControl || !xeokitContainer) return;

        isMeasuring = !isMeasuring;
        const startBtn = document.getElementById('start-measurement');
        
        if (isMeasuring) {
            startBtn.textContent = 'Parar Medição';
            startBtn.classList.add('active');
            
            // 1. Desativa os controles padrão do three.js para que o xeokit possa capturar os cliques
            viewer.context.controls.enabled = false;
            
            // 2. Permite que o xeokit capture os eventos do mouse/toque
            xeokitContainer.style.pointerEvents = 'auto'; 

            // 3. Ativa o controle de medição do xeokit
            distanceMeasurementsControl.setActive(true);
            console.log("📏 Modo medição ativado");
        } else {
            startBtn.textContent = 'Iniciar Medição';
            startBtn.classList.remove('active');
            
            // 1. Reativa os controles padrão do three.js
            viewer.context.controls.enabled = true;
            
            // 2. Permite que o Three.js/IFC Viewer capture os eventos novamente
            xeokitContainer.style.pointerEvents = 'none'; 

            // 3. Desativa o controle de medição do xeokit
            distanceMeasurementsControl.setActive(false);
            console.log("🚫 Modo medição desativado");
        }
        
        // Garante que o xeokit redesenhe após a mudança de estado
        if (xeokitViewer) xeokitViewer.scene.redraw();
    };

    // 🔥 FUNÇÃO PARA LIMPAR AS MEDIÇÕES
    const clearMeasurements = () => {
        if (distanceMeasurements) {
            distanceMeasurements.clear();
            if (xeokitViewer) xeokitViewer.scene.redraw();
        }
    };

    // -----------------------------------------------------------
    // FUNÇÕES DE SUPORTE
    // -----------------------------------------------------------

    const loadMultipleIfcs = async (ifcUrls) => {
        // ... (resto da função loadMultipleIfcs permanece o mesmo)
        if (viewer && ifcUrls && ifcUrls.length > 0) {
            console.log(`🔄 Iniciando carregamento de ${ifcUrls.length} modelo(s)...`);
            
            for (const ifcUrl of ifcUrls) {
                console.log(`📦 Tentando carregar: ${ifcUrl}`);
                try {
                    // Carrega o modelo com cachable: true
                    const model = await viewer.IFC.loadIfcUrl({
                        url: ifcUrl, 
                        // CRUCIAL: Mantenha 'true' para carregar todas as propriedades na memória
                        wasmsPath: 'wasm/', 
                        caching: true, 
                        autoSetWasm: true 
                    });
                    
                    if (model.modelID !== undefined) {
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: ifcUrl.split('/').pop(),
                            url: ifcUrl
                        });
                        console.log(`✅ Sucesso: ${ifcUrl.split('/').pop()} (ID: ${model.modelID})`);
                        // Força o cache das propriedades para a seleção ser rápida
                        await viewer.IFC.loader.ifcManager.get // Força o cache
                        .spatialStructure.build(model.modelID);
                        console.log(`✅ Cache populado lendo IfcProject (ID ${model.modelID}) para o modelo: ${ifcUrl.split('/').pop()}`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao carregar o modelo ${ifcUrl}:`, error);
                }
            }
            console.log(`🎉 ${loadedModels.size}/${ifcUrls.length} modelo(s) carregados!`);
            updateVisibilityControls();
            
            // Foca a câmera em todos os modelos carregados
            viewer.context.fitToFrame(loadedModels.keys()); 
        }
    };


    function updateVisibilityControls() {
        // ... (resto da função updateVisibilityControls permanece o mesmo)
        const controlsDiv = document.getElementById('visibility-controls');
        controlsDiv.style.display = 'block';
        controlsDiv.innerHTML = '<h4>👁️ Visibilidade dos Modelos</h4>';

        loadedModels.forEach((model, modelID) => {
            const container = document.createElement('div');
            container.className = 'model-control-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `model-toggle-${modelID}`;
            checkbox.checked = model.visible;
            checkbox.onchange = () => toggleModelVisibility(modelID, checkbox.checked);

            const label = document.createElement('label');
            label.htmlFor = `model-toggle-${modelID}`;
            label.textContent = model.name;

            container.appendChild(checkbox);
            container.appendChild(label);
            controlsDiv.appendChild(container);
        });
    }

    function toggleModelVisibility(modelID, visible) {
        // ... (resto da função toggleModelVisibility permanece o mesmo)
        const modelData = loadedModels.get(modelID);
        if (!modelData) return;

        modelData.visible = visible;
        loadedModels.set(modelID, modelData);

        viewer.IFC.loader.ifcManager.setVisibility(modelID, visible);

        // O xeokit não precisa de sincronização de visibilidade, pois desenha apenas as medições.
    }

    function showProperties(props, id) {
        // ... (resto da função showProperties permanece o mesmo)
        const panel = document.getElementById('properties-panel');
        const details = document.getElementById('element-details');
        
        document.getElementById('element-title').textContent = `ID ${id}: ${props.type || 'Elemento'}`;
        details.innerHTML = ''; 

        // Função recursiva para exibir subpropriedades (Psets, etc)
        const createPropertyTable = (properties, container) => {
            const table = document.createElement('table');
            table.className = 'props-table';
            
            for (const key in properties) {
                if (key === 'expressID' || key === 'type') continue; // Ignora chaves internas
                
                const value = properties[key];
                const tr = document.createElement('tr');
                
                const th = document.createElement('th');
                th.textContent = key;
                tr.appendChild(th);
                
                const td = document.createElement('td');
                
                if (typeof value === 'object' && value !== null) {
                    // Verifica se é uma lista de Psets ou um único Pset
                    if (Array.isArray(value)) {
                        td.textContent = `[${value.length} Itens]`;
                        // Se for uma lista de Psets, cria uma sub-lista de detalhes (opcional: pode ser muito longo)
                        
                        value.forEach(item => {
                            if (item.Name) {
                                const subSection = document.createElement('details');
                                const summary = document.createElement('summary');
                                summary.textContent = item.Name;
                                subSection.appendChild(summary);
                                createPropertyTable(item.properties, subSection);
                                container.appendChild(subSection);
                            }
                        });
                        
                        tr.remove(); // Remove a linha principal, pois já criamos o details abaixo
                    } else if (value.value !== undefined) {
                        // É uma propriedade simples com valor (e.g., IfcLabel: { value: 'nome', type: 1 })
                        td.textContent = value.value;
                    } else {
                        // É um objeto aninhado que queremos detalhar (e.g., Pset com Name e Properties)
                        
                        const subSection = document.createElement('details');
                        const summary = document.createElement('summary');
                        summary.textContent = value.Name || 'Detalhes';
                        subSection.appendChild(summary);
                        createPropertyTable(value, subSection);
                        container.appendChild(subSection);
                        
                        tr.remove(); // Remove a linha principal
                    }
                } else {
                    td.textContent = value;
                }
                
                if (tr.parentElement) { // Garante que a linha não foi removida
                    tr.appendChild(td);
                    table.appendChild(tr);
                }
            }
            if (table.rows.length > 0) {
                container.appendChild(table);
            }
        };

        createPropertyTable(props, details);
        panel.style.display = 'block';
    }


    // -----------------------------------------------------------
    // INICIALIZAÇÃO
    // -----------------------------------------------------------
    viewer = CreateViewer(container);
    
    // Inicializa o xeokit *após* o viewer principal
    initializeXeokitViewer().then(() => {
        // Vincula eventos dos botões de medição
        document.getElementById('start-measurement').onclick = toggleMeasurement;
        document.getElementById('clear-measurements').onclick = clearMeasurements;

        // Se a medição estiver ativa, desliga a rotação do three.js
        if (isMeasuring) {
             viewer.context.controls.enabled = false;
        }

        // Continua o carregamento dos modelos
        loadMultipleIfcs(IFC_MODELS_TO_LOAD).then(() => {
            console.log("🎉 Aplicação inicializada com sucesso!");
        });
    });

    // CLIQUE PARA SELEÇÃO DE PROPRIEDADES (apenas se a medição estiver desativada)
    window.ondblclick = async () => {
        if (isMeasuring) return; // Ignora se o modo de medição estiver ativo

        const result = await viewer.IFC.selector.pickIfcItem(true);
        if (!result) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(result.object, false);
        
        // O parâmetro 'true' (pesquisa profunda/recursiva) funciona agora que forçamos o cache.
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
                const ifcURL = URL.createObjectURL(file);
                await loadMultipleIfcs([ifcURL]); 
                document.getElementById('properties-panel').style.display = 'none';
                URL.revokeObjectURL(ifcURL); // Limpa o objeto URL
            }
        });
    }

});
