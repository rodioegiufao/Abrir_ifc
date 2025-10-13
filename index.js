import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastProps = null; // Variável global para pesquisa no console

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

    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/"); 
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;
        
        viewer.shadowDropper.renderShadow(currentModelID);
        console.log("✅ Modelo IFC carregado com ID:", currentModelID);
        return model;
    }

    // =======================================================
    // 🔹 FUNÇÃO showProperties (Versão Robusta: TUDO VISÍVEL)
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) {
            console.error("IDs de painel não encontrados. Verifique seu index.html.");
            return;
        }

        // 1. EXTRAÇÃO DE DADOS BÁSICOS
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementType = props.constructor.name;
        const elementName = props.Name?.value || elementTypeName;

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
                const isAssociadosPset = psetName.includes("AltoQi_QiBuilder-Itens_Associados");
                
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
        
        // Finaliza o HTML de Identificação
        identificacaoPrincipalHTML += `
            <p class="type-info"><strong>Tipo IFC:</strong> ${elementType}</p>
            <p><strong>ID IFC:</strong> ${expressID}</p>
            <p><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
        </ul><hr>`;

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
    }

    // --- Inicialização ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc'); // Altere a URL conforme necessário

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
        
        // Armazena para pesquisa no console
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
    
    // Lógica de Upload de arquivo 
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                const ifcURL = URL.createObjectURL(file);
                await loadIfc(ifcURL);
                document.getElementById('properties-panel').style.display = 'none';
                lastProps = null;
            }
        });
    }

});