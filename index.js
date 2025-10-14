import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null; // Variável global para debug

// 🚨 1. LISTA DE ARQUIVOS IFC PARA CARREGAR
// VOCÊ DEVE PREENCHER ESTA LISTA COM AS URLS DE DOWNLOAD DIRETO dos seus arquivos.
const IFC_MODELS_TO_LOAD = [
    // Exemplo de como carregar um arquivo local (dentro da pasta /models)
    //'models/01.ifc', 
    
    // Se você tiver mais modelos, adicione-os aqui.
    // Exemplo de como seria um link do Google Drive (o link deve ser de download direto!)
    'https://drive.google.com/uc?export=download&id=1jXglRbnyhLMYz23iJdXl8Rbsg8HiCJmW',
    // 'https://drive.google.com/uc?export=download&id=SEU_ID_DO_IFC_DA_INSTALACAO_1',
];


document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Cria o viewer ---
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
    // 🔹 FUNÇÃO: CARREGAR MÚLTIPLOS IFCs (CORRIGIDA PARA ERRO)
    // =======================================================
    async function loadMultipleIfcs(urls) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/"); 
        
        currentModelID = -1;
        console.log(`Iniciando carregamento de ${urls.length} modelos...`);

        for (const url of urls) {
            try {
                console.log(`Carregando: ${url}`);
                const model = await viewer.IFC.loadIfcUrl(url);
                
                if (currentModelID === -1) {
                    currentModelID = model.modelID;
                }
                
                viewer.shadowDropper.renderShadow(model.modelID); 

            } catch (e) {
                console.error(`❌ Falha ao carregar o arquivo IFC em: ${url}`, e);
            }
        }
        
        // 🚨 CORREÇÃO DO ERRO 'updateWorldMatrix': 
        // 1. Obtemos a cena completa.
        const scene = viewer.context.getScene();
        
        // 2. Adicionamos um pequeno delay para garantir que o Three.js finalize o processamento.
        await new Promise(resolve => setTimeout(resolve, 100)); 

        // 3. Enquadramos a câmera usando o objeto da cena.
        viewer.context.ifcCamera.cameraControls.fitToBox(scene, true, 0.5, true); 

        console.log("✅ Todos os modelos IFC carregados com sucesso.");
    }
    
    // =======================================================
    // 🔹 FUNÇÃO showProperties (TODAS AS MENSAGENS NO CONSOLE + VISUAL FORMATADO)
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) {
            console.error("IDs de painel não encontrados. Verifique seu index.html.");
            return;
        }

        // 🟢 ADICIONANDO AS MENSAGENS DE LOG NO CONSOLE
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementName = props.Name?.value || elementTypeName;
        
        console.log(`📋 Elemento selecionado: ${elementName} (${props.constructor.name})`);
        console.log(`📊 Total de Psets: ${props.psets ? props.psets.length : 0}`);

        // Log detalhado de cada Pset
        if (props.psets && props.psets.length > 0) {
            props.psets.forEach((pset) => {
                const psetName = pset.Name?.value || 'Pset Desconhecido';
                const propertyCount = pset.HasProperties ? pset.HasProperties.length : 0;
                console.log(`   - ${psetName}: ${propertyCount} propriedades`);
            });
        }

        // 1. EXTRAÇÃO DE DADOS BÁSICOS
        title.textContent = elementName;
        
        let identificacaoPrincipalHTML = '<h4>Identificação Principal</h4><ul>';
        let psetsRestantesHTML = '<h4>Outros Psets e Informações</h4>';
        
        const propriedadesPrincipais = ['Nome', 'Classe', 'Tipo', 'Rede', 'Aplicação', 'Descrição', 'Material', 'Diâmetro'];
        let propriedadesPrincipaisEncontradas = [];
        
        let associadosHTML = '';
        let associadosPsetFound = false;

        // 2. PERCORRE TODOS OS PSETS
        if (props.psets && props.psets.length > 0) {
            props.psets.forEach((pset) => {
                const psetName = pset.Name?.value || 'Pset Desconhecido';
                const isAssociadosPset = psetName && psetName.includes("Itens_Associados"); // Busca flexível
                
                let currentPsetPropertiesHTML = '';

                if (pset.HasProperties) {
                    pset.HasProperties.forEach(propHandle => {
                        const prop = props[propHandle.value]; 

                        if (prop && prop.Name && prop.NominalValue) {
                            const propValue = prop.NominalValue.value;
                            const propName = prop.Name.value;

                            // Se é uma propriedade principal, move para o topo
                            if (propriedadesPrincipais.includes(propName) && !propriedadesPrincipaisEncontradas.includes(propName)) {
                                propriedadesPrincipaisEncontradas.push(propName);
                                identificacaoPrincipalHTML += `<li><strong>${propName}:</strong> ${propValue}</li>`;
                            }
                            
                            // 🔹 TRATA ITENS ASSOCIADOS
                            else if (isAssociadosPset && typeof propValue === 'string') {
                                associadosPsetFound = true;
                                
                                // Formatação multilinha para o insumo
                                const items = propValue.split('\n')
                                    .map(line => line.trim())
                                    .filter(line => line)
                                    .join('<br>');
                                
                                // Acumula na variável de Associados
                                associadosHTML += `
                                    <li style="
                                        margin-left: -20px; 
                                        border-left: 3px solid #007bff; 
                                        padding-left: 10px;
                                        white-space: pre-wrap;
                                        margin-top: 10px;
                                    ">
                                        <strong>${propName}:</strong><br>${items}
                                    </li>
                                `;
                            } else {
                                // Se NÃO é de Associados e NÃO é principal, acumula no Pset normal
                                currentPsetPropertiesHTML += `<li><strong>${propName}:</strong> ${propValue}</li>`;
                            }
                        }
                    });
                }
                
                // Adiciona o Pset ao HTML restante SOMENTE se não for o Pset de Associados
                if (!isAssociadosPset && currentPsetPropertiesHTML.length > 0) {
                    psetsRestantesHTML += `<h5>${psetName}</h5><ul>${currentPsetPropertiesHTML}</ul>`;
                }
            });
        }
        
        // 3. MONTAGEM DO HTML FINAL
        
        // Finaliza o HTML de Identificação (CORREÇÃO: fechar a ul ANTES dos parágrafos)
        identificacaoPrincipalHTML += `</ul>`; // FECHA A UL PRIMEIRO
        
        // Agora adiciona os parágrafos
        identificacaoPrincipalHTML += `
            <p class="type-info"><strong>Tipo IFC:</strong> ${props.constructor.name}</p>
            <p><strong>ID IFC:</strong> ${expressID}</p>
            <p><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
            <hr>`;

        let finalDetailsHTML = identificacaoPrincipalHTML;
        
        // 🔹 3A. ADICIONA A SEÇÃO DE ASSOCIADOS (PRIORIDADE)
        if (associadosPsetFound) {
            finalDetailsHTML += '<h4>AltoQi_QiBuilder-Itens_Associados</h4>';
            finalDetailsHTML += `<ul style="margin-top: -10px;">${associadosHTML}</ul><hr>`;
        }
        
        // 🔹 3B. ADICIONA OS DEMAIS PSETS
        finalDetailsHTML += psetsRestantesHTML;
        
        if (!props.psets || props.psets.length === 0) {
            finalDetailsHTML += `<p>Nenhum conjunto de propriedades (Psets) encontrado.</p>`;
        }

        // 4. EXIBE O PAINEL
        details.innerHTML = finalDetailsHTML;
        panel.style.display = 'block';
        
        // DEBUG: Verifique o HTML gerado
        console.log("🟨 HTML Gerado:", finalDetailsHTML);
    }

    // 🚨 2. CHAMADA PRINCIPAL
    loadMultipleIfcs(IFC_MODELS_TO_LOAD);

    // =======================================================
    // 🔹 EVENTO DE DUPLO CLIQUE 
    // =======================================================
    
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
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
        if (event.code === 'Escape') {
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