import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null;

// ✅ LISTA SIMPLES DE ARQUIVOS IFC LOCAIS
const IFC_MODELS_TO_LOAD = [
    'models/01.ifc',
    'models/02.ifc',
];

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
    // 🔹 FUNÇÃO CARREGAR MÚLTIPLOS IFCs (CORRIGIDA)
    // =======================================================
    async function loadMultipleIfcs(urls) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        currentModelID = -1;
        console.log(`🔄 Iniciando carregamento de ${urls.length} modelos...`);

        let loadedModels = 0;
        let loadedModelIDs = [];

        for (const url of urls) {
            try {
                console.log(`📦 Tentando carregar: ${url}`);
                
                const model = await viewer.IFC.loadIfcUrl(url);
                
                if (currentModelID === -1) {
                    currentModelID = model.modelID;
                }
                
                viewer.shadowDropper.renderShadow(model.modelID);
                loadedModels++;
                loadedModelIDs.push(model.modelID);
                
                console.log(`✅ Sucesso: ${url} (ID: ${model.modelID})`);
                
                // ✅ REMOVI O 'break' - AGORA CARREGA TODOS!
                // Continua para o próximo arquivo

            } catch (error) {
                console.error(`❌ Falha ao carregar: ${url}`, error.message);
                // Continua para a próxima URL mesmo com erro
            }
        }

        if (loadedModels === 0) {
            console.error("🚨 Nenhum modelo IFC pôde ser carregado!");
            showErrorMessage();
            return;
        }
        
        // Ajuste da câmera para visualizar todos os modelos
        const scene = viewer.context.getScene();
        await new Promise(resolve => setTimeout(resolve, 100));
        viewer.context.ifcCamera.cameraControls.fitToBox(scene, true, 0.5, true);

        console.log(`🎉 ${loadedModels}/${urls.length} modelos carregados com sucesso!`);
        console.log(`📊 IDs dos modelos: ${loadedModelIDs.join(', ')}`);
    }

    // 🔹 MENSAGEM DE ERRO SIMPLES
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
                Verifique se os arquivos estão na pasta 'models/':
            </p>
            <ul style="text-align: left; color: #721c24;">
                <li>01.ifc</li>
                <li>02.ifc</li>
            </ul>
            <button onclick="this.parentElement.remove()" 
                    style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                Fechar
            </button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    // =======================================================
    // 🔹 FUNÇÃO showProperties (MANTIDA)
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) {
            console.error("IDs de painel não encontrados. Verifique seu index.html.");
            return;
        }

        // 1. INFORMAÇÕES BÁSICAS DO ELEMENTO
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementType = props.constructor.name;
        const elementName = props.Name?.value || elementTypeName;

        title.textContent = elementName;
        
        let htmlContent = '';

        // 2. CABEÇALHO COM INFORMAÇÕES PRINCIPAIS
        htmlContent += `
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #007bff;">Informações Gerais</h4>
                <p style="margin: 4px 0;"><strong>Tipo IFC:</strong> ${elementType}</p>
                <p style="margin: 4px 0;"><strong>Nome:</strong> ${elementName}</p>
                <p style="margin: 4px 0;"><strong>ID IFC:</strong> ${expressID}</p>
                <p style="margin: 4px 0;"><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
                ${props.Description?.value ? `<p style="margin: 4px 0;"><strong>Descrição:</strong> ${props.Description.value}</p>` : ''}
                ${props.ObjectType?.value ? `<p style="margin: 4px 0;"><strong>Tipo de Objeto:</strong> ${props.ObjectType.value}</p>` : ''}
                ${props.Tag?.value ? `<p style="margin: 4px 0;"><strong>Tag:</strong> ${props.Tag.value}</p>` : ''}
            </div>
        `;

        // 3. PROCESSAR TODOS OS PSETS
        if (props.psets && props.psets.length > 0) {
            htmlContent += `<h4 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 5px;">Conjuntos de Propriedades (${props.psets.length} Psets)</h4>`;
            
            props.psets.forEach((pset, index) => {
                const psetName = pset.Name?.value || `Pset ${index + 1}`;
                const psetDescription = pset.Description?.value || '';
                
                htmlContent += `
                    <div style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 12px; margin-bottom: 15px;">
                        <h5 style="margin: 0 0 8px 0; color: #495057; font-size: 1.1em;">
                            ${psetName}
                            ${psetDescription ? `<br><small style="color: #6c757d; font-weight: normal;">${psetDescription}</small>` : ''}
                        </h5>
                `;

                // PROCESSAR PROPRIEDADES
                let propertiesFound = false;
                let propertiesHTML = '<ul style="list-style: none; padding-left: 0; margin: 0;">';

                // MÉTODO 1: HasProperties
                if (pset.HasProperties && pset.HasProperties.length > 0) {
                    pset.HasProperties.forEach(propHandle => {
                        const prop = props[propHandle.value];
                        
                        if (prop && prop.Name && prop.NominalValue) {
                            propertiesFound = true;
                            const propName = prop.Name.value;
                            let propValue = prop.NominalValue.value;
                            
                            propertiesHTML += formatProperty(propName, propValue);
                        }
                    });
                }

                propertiesHTML += '</ul>';
                
                if (propertiesFound) {
                    htmlContent += propertiesHTML;
                } else {
                    htmlContent += '<p style="color: #6c757d; margin: 5px 0;">Nenhuma propriedade encontrada neste Pset</p>';
                }
                
                htmlContent += `</div>`;
            });
        } else {
            htmlContent += `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; text-align: center;">
                    <h5 style="margin: 0; color: #856404;">⚠️ Nenhum Pset Encontrado</h5>
                    <p style="margin: 5px 0 0 0; color: #856404;">Este elemento não possui conjuntos de propriedades (Psets) definidos.</p>
                </div>
            `;
        }

        // 4. EXIBIR NO PAINEL
        details.innerHTML = htmlContent;
        panel.style.display = 'block';
        
        console.log(`📋 Elemento selecionado: ${elementName} (${elementType})`);
    }

    // 🔥 FUNÇÃO AUXILIAR PARA FORMATAR PROPRIEDADES
    function formatProperty(propName, propValue) {
        if (typeof propValue === 'boolean') {
            propValue = propValue ? '✅ Sim' : '❌ Não';
        } else if (propValue === null || propValue === undefined) {
            propValue = '<em style="color: #6c757d;">N/A</em>';
        } else if (typeof propValue === 'string' && propValue.trim() === '') {
            propValue = '<em style="color: #6c757d;">(vazio)</em>';
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

    // 🚀 INICIALIZAÇÃO SIMPLES
    async function initializeViewer() {
        try {
            await loadMultipleIfcs(IFC_MODELS_TO_LOAD);
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