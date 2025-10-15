import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;

// 🔥 VARIÁVEIS PARA MEDIÇÕES
let xeokitViewer;
let distanceMeasurements;
let distanceMeasurementsControl;
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

    // Inicializa o viewer principal (web-ifc-viewer/Three.js)
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

        // 2. Garante que as configurações do xeokit correspondam ao Three.js
        xeokitViewer.camera.perspective.fov = threeJSCamera.fov;
        xeokitViewer.camera.perspective.near = threeJSCamera.near;
        xeokitViewer.camera.perspective.far = threeJSCamera.far;
        xeokitViewer.camera.perspective.aspect = threeJSCamera.aspect;
    };

    // 🔥 INICIALIZAR XEOKIT VIEWER PARA MEDIÇÕES (AGORA COM O CANVAS CORRETO)
    async function initializeXeokitViewer() {
        try {
            console.log("🔄 Inicializando xeokit viewer...");

            // ✅ SOLUÇÃO: Acessa o SDK do escopo global (definido em index.html)
            const xeokitSDK = window.xeokitSDK;
            
            if (!xeokitSDK || !xeokitSDK.Viewer) {
                 console.error("❌ xeokit SDK não carregado no escopo global.");
                 return;
            }

            // 1. Cria um container dedicado para o xeokit (para isolar o canvas)
            xeokitContainer = document.createElement('div');
            xeokitContainer.id = 'xeokit-container';
            container.appendChild(xeokitContainer);

            // Adiciona estilos para garantir que ele cubra o viewer principal
            xeokitContainer.style.position = 'absolute';
            xeokitContainer.style.top = '0';
            xeokitContainer.style.left = '0';
            xeokitContainer.style.width = '100%';
            xeokitContainer.style.height = '100%';
            xeokitContainer.style.zIndex = '10'; // Garante que esteja acima do three.js canvas
            xeokitContainer.style.pointerEvents = 'none'; // Inicialmente, não captura eventos de mouse

            // 2. Cria o canvas que será usado pelo xeokit
            const xeokitCanvas = document.createElement('canvas');
            xeokitCanvas.id = 'xeokit-canvas';
            xeokitCanvas.style.display = 'block'; // Garante que o canvas seja visível
            xeokitContainer.appendChild(xeokitCanvas);
            
            // 3. Inicializa o Viewer, passando o ID do canvas (FIX!)
            xeokitViewer = new xeokitSDK.Viewer({
                canvasId: "xeokit-canvas", // FIX: Mandatory config
                transparent: true,
                doubleSided: true,
                saoEnabled: false,
                pbrEnabled: true
            });
            console.log("✅ xeokit viewer inicializado com sucesso.");

            // Inicializa as ferramentas de medição
            distanceMeasurementsControl = new xeokitSDK.DistanceMeasurementsControl(xeokitViewer);
            distanceMeasurements = new xeokitSDK.DistanceMeasurements(xeokitViewer, {
                control: distanceMeasurementsControl
            });

            // Ajusta o cursor quando o xeokit está ativo para medição
            distanceMeasurementsControl.on("mouseOver", (event) => {
                if (isMeasuring && xeokitContainer) {
                     xeokitContainer.style.cursor = 'crosshair';
                }
            });

        } catch (error) {
            console.error("❌ Erro ao inicializar xeokit viewer:", error);
        }
    }

    // 🔥 FUNÇÃO PARA CARREGAR MODELOS IFC MULTIPLOS (para URLs estáticas)
    async function loadMultipleIfcs(urls) {
        let loadedCount = 0;
        console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);

        // Reseta o mapa de modelos carregados para o carregamento inicial de URLs estáticas
        loadedModels.clear(); 
        document.getElementById('visibility-controls').innerHTML = '';

        for (const url of urls) {
            if (typeof url !== 'string') {
                console.error("❌ Erro de carregamento: URL inválida (não é uma string):", url);
                continue; // Pula URLs inválidas
            }

            console.log(`📦 Tentando carregar: ${url}`);
            try {
                // O web-ifc-viewer precisa de um URL ou de um objeto File
                const model = await viewer.IFC.loadIfcUrl(url, true); 
                
                if (model && model.modelID !== undefined) {
                    const name = url.split('/').pop();
                    loadedModels.set(model.modelID, { visible: true, name, url });
                    
                    // Opcional: constrói a estrutura espacial para navegação
                    await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
                    loadedCount++;
                    console.log(`✅ Sucesso no carregamento: ${name} (ID: ${model.modelID})`);
                }

            } catch (e) {
                console.error("❌ Erro ao carregar IFC.", e);
            }
        }
        
        console.log(`🎉 ${loadedCount}/${urls.length} modelo(s) carregados!`);
        updateVisibilityControls();

        if (loadedCount > 0) {
            // Ajusta o enquadramento apenas se houver modelos carregados
            viewer.context.fitToFrame(Array.from(loadedModels.keys()));
        }
    }

    // 🔥 FUNÇÃO PARA EXIBIR PROPRIEDADES
    function showProperties(props, id) {
        // ... (Corpo da função showProperties omitido, pois não foi alterado)
        const panel = document.getElementById('properties-panel');
        const details = document.getElementById('element-details');
        const title = document.getElementById('element-title');

        if (!props) {
            title.textContent = "Nenhuma propriedade encontrada";
            details.innerHTML = '';
            panel.style.display = 'block';
            return;
        }

        title.textContent = props.type ? `${props.type} (ID: ${id})` : `Elemento IFC (ID: ${id})`;
        details.innerHTML = ''; // Limpa o conteúdo anterior

        const formatValue = (value) => {
            if (typeof value === 'object' && value !== null && value.value) {
                return formatValue(value.value); // Desembrulha o IfcValue
            }
            if (typeof value === 'object' && value !== null) {
                return `<pre>${JSON.stringify(value, null, 2)}</pre>`;
            }
            return value;
        };

        const createPropertyItem = (key, value) => {
            const div = document.createElement('div');
            div.className = 'property-item';
            div.innerHTML = `<span class="property-key">${key}:</span> <span class="property-value">${formatValue(value)}</span>`;
            return div;
        };
        
        // Adiciona as propriedades diretas (como GlobalId)
        for (const key in props) {
            if (key !== 'expressID' && key !== 'type' && key !== 'pset') {
                details.appendChild(createPropertyItem(key, props[key]));
            }
        }

        // Adiciona Psets (Propriedades de Conjunto)
        if (props.hasPsets && props.psets) {
            props.psets.forEach(pset => {
                const psetHeader = document.createElement('h5');
                psetHeader.className = 'pset-header';
                psetHeader.textContent = `Conjunto de Propriedades: ${pset.Name?.value || 'Sem Nome'}`;
                details.appendChild(psetHeader);

                if (pset.properties) {
                    pset.properties.forEach(prop => {
                        details.appendChild(createPropertyItem(prop.Name?.value || 'Propriedade', prop.NominalValue?.value || 'N/A'));
                    });
                }
            });
        }

        panel.style.display = 'block';
    }


    // 🔥 FUNÇÃO PARA ALTERNAR O MODO DE MEDIÇÃO
    function toggleMeasurement() {
        const btn = document.getElementById('start-measurement');

        if (isMeasuring) {
            // DESATIVA
            isMeasuring = false;
            distanceMeasurementsControl.setActive(false);
            xeokitContainer.style.pointerEvents = 'none'; // Desabilita interação do xeokit
            btn.textContent = 'Iniciar Medição';
            btn.classList.remove('active');
        } else {
            // ATIVA
            isMeasuring = true;
            distanceMeasurementsControl.setActive(true);
            xeokitContainer.style.pointerEvents = 'auto'; // Habilita interação do xeokit
            btn.textContent = 'Parar Medição (ESC)';
            btn.classList.add('active');
        }
    }

    // 🔥 FUNÇÃO PARA CRIAR CONTROLES DE VISIBILIDADE DOS MODELOS
    function updateVisibilityControls() {
        const controlsDiv = document.getElementById('visibility-controls');
        const modelKeys = Array.from(loadedModels.keys());

        if (modelKeys.length === 0) {
            controlsDiv.style.display = 'none';
            return;
        }

        controlsDiv.style.display = 'block';
        controlsDiv.innerHTML = '<h4>👁️ Modelos Carregados</h4>';

        loadedModels.forEach((model, modelID) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'model-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `model-toggle-${modelID}`;
            checkbox.checked = model.visible;
            checkbox.onchange = () => {
                const isVisible = checkbox.checked;
                viewer.IFC.loader.ifcManager.setVisibility(modelID, isVisible);
                model.visible = isVisible;
                loadedModels.set(modelID, model);
            };

            const label = document.createElement('label');
            label.htmlFor = `model-toggle-${modelID}`;
            label.textContent = model.name;

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            controlsDiv.appendChild(itemDiv);
        });
    }

    // ============== INICIALIZAÇÃO PRINCIPAL ==============
    viewer = CreateViewer(container);
    
    // Inicia o viewer xeokit e as ferramentas de medição (AGORA CORRIGIDO)
    initializeXeokitViewer().then(() => {
        
        // Sincroniza câmeras continuamente, se o xeokit estiver pronto
        viewer.context.on
            .cameraChanged
            .add(() => syncCameras(viewer.context.ifcCamera.camera, viewer.context.ifcCamera.controls, xeokitViewer));
        
        // Configura eventos de botão
        const startBtn = document.getElementById('start-measurement');
        const clearBtn = document.getElementById('clear-measurements');

        if (startBtn) {
            startBtn.onclick = toggleMeasurement;
        }
        if (clearBtn) {
            clearBtn.onclick = () => {
                distanceMeasurements.clear();
            };
        }
    });

    // Carrega os modelos IFC iniciais
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    console.log("🎉 Aplicação inicializada com sucesso!");

    // ============== EVENTOS DE INTERAÇÃO COM O USUÁRIO ==============
    
    // EVENTO DE DUPLO CLIQUE (Dica: Use dblclick para ser mais responsivo em desktop)
    window.ondblclick = async () => {
        // Se estiver no modo de medição, o dblclick é usado pelo xeokit, então ignoramos a seleção
        if (isMeasuring) return; 

        // Tenta selecionar o elemento no web-ifc-viewer
        const result = await viewer.IFC.selector.pickIfcItem(true); 

        if (!result || !result.modelID || result.id === undefined) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            lastProps = null;
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(result.modelID, result.id, false);
        
        // O parâmetro 'true' (pesquisa profunda/recursiva) funciona agora que forçamos o cache.
        const props = await viewer.IFC.getProperties(result.modelID, result.id, true);
        
        lastProps = props; 
        console.log("🟩 Item selecionado:", lastProps);
        
        showProperties(props, result.id);
    };

    // EVENTO DE TECLA (ESC)
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
                    // Limpa todos os modelos existentes e carrega o novo arquivo
                    const model = await viewer.IFC.loadIfc(file, true); 
                    
                    if (model && model.modelID !== undefined) {
                         // Limpa a lista de modelos existentes (já que loadIfc limpa o viewer)
                        loadedModels.clear(); 
                        loadedModels.set(model.modelID, {
                            visible: true,
                            name: file.name,
                            url: `local://${file.name}`
                        });
                        
                        console.log(`✅ Sucesso no carregamento local: ${file.name} (ID: ${model.modelID})`);
                        await viewer.IFC.loader.ifcManager.get.spatialStructure.build(model.modelID);
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
