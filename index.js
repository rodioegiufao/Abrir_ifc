import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let lastProps = null;
let isMeasuring = false; // Controle de estado para medição

// ✅ LISTA DE ARQUIVOS IFC 
const IFC_MODELS_TO_LOAD = [
    'models/01.ifc',
    'models/02.ifc',
];

// 🔥 CONTROLE DE VISIBILIDADE
let loadedModels = new Map(); // Map<modelID, { visible: boolean, name: string, url: string }>

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // 1. Inicializa o viewer principal (web-ifc-viewer/Three.js)
    function CreateViewer(container) {
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        // ❌ LINHA REMOVIDA DAQUI: newViewer.measure.active = false;
        return newViewer;
    }

    // 🔥 FUNÇÃO PARA CARREGAR MODELOS IFC MULTIPLOS (para URLs estáticas)
    async function loadMultipleIfcs(urls) {
        let loadedCount = 0;
        console.log(`🔄 Iniciando carregamento de ${urls.length} modelo(s)...`);

        loadedModels.clear(); 
        document.getElementById('visibility-controls').innerHTML = '';

        for (const url of urls) {
            if (typeof url !== 'string') {
                console.error("❌ Erro de carregamento: URL inválida (não é uma string):", url);
                continue; 
            }

            console.log(`📦 Tentando carregar: ${url}`);
            try {
                // O web-ifc-viewer precisa de um URL ou de um objeto File
                const model = await viewer.IFC.loadIfcUrl(url, true); 
                
                if (model && model.modelID !== undefined) {
                    const name = url.split('/').pop();
                    loadedModels.set(model.modelID, { visible: true, name, url });
                    
                    loadedCount++;
                    console.log(`✅ Sucesso no carregamento: ${name} (ID: ${model.modelID})`);
                } else {
                     console.warn(`⚠️ Modelo IFC carregado, mas sem ID válido: ${url}`);
                }

            } catch (e) {
                console.error("❌ Erro ao carregar IFC.", e);
            }
        }
        
        console.log(`🎉 ${loadedCount}/${urls.length} modelo(s) carregados!`);
        updateVisibilityControls();

        if (loadedCount > 0) {
            viewer.context.fitToFrame(Array.from(loadedModels.keys()));
        }
    }

    // 🔥 FUNÇÃO PARA EXIBIR PROPRIEDADES (Mantida)
    function showProperties(props, id) {
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
        const containerDiv = document.getElementById('viewer-container');

        isMeasuring = !isMeasuring;
        viewer.measure.active = isMeasuring;

        if (isMeasuring) {
            // ATIVA
            btn.textContent = 'Parar Medição (ESC)';
            btn.classList.add('active');
            containerDiv.style.cursor = 'crosshair';
            console.log("📏 Modo de medição ATIVADO. Clique para marcar pontos.");
        } else {
            // DESATIVA
            btn.textContent = 'Iniciar Medição';
            btn.classList.remove('active');
            containerDiv.style.cursor = 'grab'; // Restaura o cursor de navegação
            console.log("📏 Modo de medição DESATIVADO.");
        }
    }

    // 🔥 FUNÇÃO PARA CRIAR CONTROLES DE VISIBILIDADE DOS MODELOS (Mantida)
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
    
    // ✅ CORREÇÃO: Define o estado inicial da medição APÓS a criação do viewer
    viewer.measure.active = isMeasuring; 

    // Configura eventos de botão
    const startBtn = document.getElementById('start-measurement');
    const clearBtn = document.getElementById('clear-measurements');

    if (startBtn) {
        startBtn.onclick = toggleMeasurement;
    }
    if (clearBtn) {
        // Limpa todas as medições visuais na cena
        clearBtn.onclick = () => {
            viewer.measure.removeTextAll();
            viewer.measure.removeDimensionsAll();
            console.log("Medições limpas.");
        };
    }

    // Carrega os modelos IFC iniciais
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    console.log("🎉 Aplicação inicializada com sucesso!");

    // ============== EVENTOS DE INTERAÇÃO COM O USUÁRIO ==============
    
    // EVENTO DE CLIQUE ÚNICO (Para Medição)
    window.onclick = () => {
        if (isMeasuring) {
            // Se a medição estiver ativa, o clique adiciona um ponto de medição
            // O web-ifc-viewer usa getDistance() para medição linear
            viewer.measure.getDistance() 
        }
    }
    
    // EVENTO DE DUPLO CLIQUE (Para Seleção/Propriedades)
    window.ondblclick = async () => {
        // Se estiver no modo de medição, o dblclick é usado para finalizar a linha, então ignoramos a seleção.
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
             // Se não estiver medindo, limpa a seleção e as medições pendentes
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
