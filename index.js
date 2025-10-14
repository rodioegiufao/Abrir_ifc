import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null;

// 🚨 LISTA DE ARQUIVOS IFC - MULTIPLAS TENTATIVAS
const IFC_MODELS_TO_LOAD = [
    // Tentativa 1: Link direto com confirmação
    'https://drive.google.com/uc?export=download&id=1jXglRbnyhLMYz23iJdXl8Rbsg8HiCJmW&confirm=t',
    
    // Tentativa 2: Arquivo local como fallback
    'models/01.ifc',
];

// 🚨 FUNÇÃO PARA VERIFICAR DISPONIBILIDADE DO ARQUIVO
async function checkFileAvailability(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        console.log(`🔍 Status do arquivo ${url}: ${response.status}`);
        return response.ok;
    } catch (error) {
        console.log(`❌ Arquivo não acessível: ${url}`);
        return false;
    }
}

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
    // 🔹 FUNÇÃO CARREGAR MÚLTIPLOS IFCs (COM FALLBACK)
    // =======================================================
    async function loadMultipleIfcs(urls) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        currentModelID = -1;
        console.log(`Iniciando carregamento de ${urls.length} modelos...`);

        let loadedAnyModel = false;

        for (const url of urls) {
            try {
                console.log(`🔍 Verificando: ${url}`);
                
                // Para arquivos locais, não faz verificação HEAD
                if (url.startsWith('http')) {
                    const isAvailable = await checkFileAvailability(url);
                    if (!isAvailable) {
                        console.log(`⏭️  Pulando arquivo não disponível: ${url}`);
                        continue;
                    }
                }

                console.log(`📦 Carregando: ${url}`);
                const model = await viewer.IFC.loadIfcUrl(url);
                
                if (currentModelID === -1) {
                    currentModelID = model.modelID;
                }
                
                viewer.shadowDropper.renderShadow(model.modelID);
                loadedAnyModel = true;
                console.log(`✅ Sucesso ao carregar: ${url}`);

                // Se carregou um, para aqui para não tentar os outros
                break;

            } catch (e) {
                console.error(`❌ Falha ao carregar: ${url}`, e.message);
                // Continua para a próxima URL
            }
        }

        if (!loadedAnyModel) {
            console.error("🚨 Nenhum modelo IFC pôde ser carregado!");
            console.log("💡 Soluções:");
            console.log("   1. Verifique se o arquivo está compartilhado publicamente no Google Drive");
            console.log("   2. Use um servidor local para servir o arquivo IFC");
            console.log("   3. Coloque o arquivo IFC na pasta 'models' do seu projeto");
            return;
        }
        
        // Ajuste da câmera
        const scene = viewer.context.getScene();
        await new Promise(resolve => setTimeout(resolve, 100));
        viewer.context.ifcCamera.cameraControls.fitToBox(scene, true, 0.5, true);

        console.log("✅ Modelos IFC carregados com sucesso.");
    }

    // =======================================================
    // 🔹 FUNÇÃO showProperties (VERSÃO CORRIGIDA)
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

                // 🔥 CORREÇÃO: VERIFICAR DIFERENTES ESTRUTURAS DE PROPRIEDADES
                let propertiesFound = false;
                let propertiesHTML = '<ul style="list-style: none; padding-left: 0; margin: 0;">';

                // MÉTODO 1: HasProperties (estrutura mais comum)
                if (pset.HasProperties && pset.HasProperties.length > 0) {
                    console.log(`🔍 Processando Pset "${psetName}" via HasProperties:`, pset.HasProperties);
                    
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
                
                // MÉTODO 2: Propriedades diretas no Pset
                if (!propertiesFound) {
                    console.log(`🔍 Tentando método alternativo para Pset "${psetName}":`, pset);
                    
                    // Procura por propriedades diretamente no objeto pset
                    for (const [key, value] of Object.entries(pset)) {
                        if (key !== 'Name' && key !== 'Description' && key !== 'HasProperties' && 
                            key !== 'expressID' && key !== 'type' && value && value.value !== undefined) {
                            propertiesFound = true;
                            propertiesHTML += formatProperty(key, value.value);
                        }
                    }
                }
                
                // MÉTODO 3: Verifica se há propriedades em outros locais
                if (!propertiesFound && pset.properties) {
                    console.log(`🔍 Tentando método properties para Pset "${psetName}":`, pset.properties);
                    
                    for (const [propName, propValue] of Object.entries(pset.properties)) {
                        if (propValue !== null && propValue !== undefined) {
                            propertiesFound = true;
                            propertiesHTML += formatProperty(propName, propValue);
                        }
                    }
                }

                propertiesHTML += '</ul>';
                
                if (propertiesFound) {
                    htmlContent += propertiesHTML;
                    console.log(`✅ Pset "${psetName}": ${propertiesFound} propriedades encontradas`);
                } else {
                    htmlContent += '<p style="color: #6c757d; margin: 5px 0;">Nenhuma propriedade encontrada neste Pset</p>';
                    console.log(`❌ Pset "${psetName}": Nenhuma propriedade encontrada em nenhum método`);
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
        
        // 5. LOG NO CONSOLE PARA DEBUG
        console.log(`📋 Elemento selecionado: ${elementName} (${elementType})`);
        console.log(`📊 Total de Psets: ${props.psets ? props.psets.length : 0}`);
        if (props.psets) {
            props.psets.forEach((pset, index) => {
                const psetName = pset.Name?.value || `Pset ${index + 1}`;
                console.log(`   - ${psetName}:`, pset);
            });
        }
    }

    // 🔥 FUNÇÃO AUXILIAR PARA FORMATAR PROPRIEDADES
    function formatProperty(propName, propValue) {
        // FORMATAR VALORES ESPECIAIS
        if (typeof propValue === 'boolean') {
            propValue = propValue ? '✅ Sim' : '❌ Não';
        } else if (propValue === null || propValue === undefined) {
            propValue = '<em style="color: #6c757d;">N/A</em>';
        } else if (typeof propValue === 'string' && propValue.trim() === '') {
            propValue = '<em style="color: #6c757d;">(vazio)</em>';
        } else if (typeof propValue === 'object') {
            propValue = JSON.stringify(propValue).substring(0, 100) + '...';
        }
        
        // DESTACAR PROPRIEDADES IMPORTANTES
        const isImportant = ['Nome', 'Tipo', 'Material', 'Diâmetro', 'Comprimento', 'Altura', 'Largura', 'Insumo', 'Código', 'Quantidade', 'Preço'].includes(propName);
        const propStyle = isImportant ? 'font-weight: bold; color: #e83e8c;' : '';
        
        return `
            <li style="margin-bottom: 6px; padding: 3px 0; border-bottom: 1px dotted #f0f0f0;">
                <span style="${propStyle}">${propName}:</span> 
                <span style="float: right; text-align: right; max-width: 60%; word-break: break-word;">${propValue}</span>
            </li>
        `;
    }

    // 🚨 CHAMADA PRINCIPAL COM TRY-CATCH
    async function initializeViewer() {
        try {
            await loadMultipleIfcs(IFC_MODELS_TO_LOAD);
        } catch (error) {
            console.error("🚨 Erro crítico ao inicializar o visualizador:", error);
        }
    }

    initializeViewer();

    // =======================================================
    // 🔹 EVENTO DE DUPLO CLIQUE 
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
        console.log("🟩 Item selecionado (Objeto Completo):", lastProps);
        
        showProperties(props, item.id);
    };

    // Atalhos do teclado (Limpar seleção ao apertar ESC)
    window.onkeydown = (event) => {
        if (event.code === 'Escape' && viewer?.IFC?.selector) {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            document.getElementById('properties-panel').style.display = 'none';
            lastProps = null;
        }
    };
    
    // Lógica de Upload de arquivo local (mantida como fallback)
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                const ifcURL = URL.createObjectURL(file);
                // Para carregar um arquivo local, usamos a função de múltiplos com um só item
                await loadMultipleIfcs([ifcURL]); 
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
            }
        });
    }

});