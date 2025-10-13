import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;

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
        // Ajuste o caminho para o WASM se necessário
        await viewer.IFC.setWasmPath("/wasm/"); 
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;
        
        viewer.shadowDropper.renderShadow(currentModelID);
        console.log("✅ Modelo IFC carregado com ID:", currentModelID);
        return model;
    }

    // =======================================================
    // 🔹 FUNÇÃO PARA EXIBIR PROPRIEDADES DE FORMA FORMATADA
    //    (Ajustada para a estrutura QiBuilder)
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) return;

        // 1. INFORMAÇÕES BÁSICAS
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementType = props.constructor.name;
        const elementName = props.Name?.value || elementTypeName;

        title.textContent = elementName;
        
        let identificacaoPrincipalHTML = '<h4>Identificação Principal</h4><ul>';
        let psetsRestantesHTML = '<h4>Outros Psets e Informações</h4>';
        
        // Lista de nomes de propriedades que queremos extrair para o topo
        const propriedadesPrincipais = ['Nome', 'Classe', 'Tipo', 'Rede', 'Aplicação', 'Descrição', 'Material', 'Diâmetro'];
        let propriedadesPrincipaisEncontradas = [];
        

        // 2. PERCORRE E EXTRAI PROPRIEDADES
        if (props.psets && props.psets.length > 0) {
            props.psets.forEach(pset => {
                const psetName = pset.Name?.value || 'Pset Desconhecido';
                const isAssociadosPset = psetName.includes("AltoQi_QiBuilder-Itens_Associados");
                
                // Abre a lista do Pset (será adicionada a psetsRestantesHTML)
                psetsRestantesHTML += `
                    <h5 ${isAssociadosPset ? 'style="color: #007bff; font-weight: bold;"' : ''}>${psetName}</h5>
                    <ul>
                `;
                
                if (pset.HasProperties) {
                    pset.HasProperties.forEach(propHandle => {
                        const prop = props[propHandle.value]; 

                        if (prop && prop.Name && prop.NominalValue) {
                            const propValue = prop.NominalValue.value;
                            const propName = prop.Name.value;

                            // Verifica se é uma propriedade a ser movida para o topo (Identificação Principal)
                            if (propriedadesPrincipais.includes(propName) && !propriedadesPrincipaisEncontradas.includes(propName)) {
                                propriedadesPrincipaisEncontradas.push(propName); // Previne duplicatas
                                identificacaoPrincipalHTML += `<li><strong>${propName}:</strong> ${propValue}</li>`;
                            }
                            
                            // Trata Itens Associados (formatação multilinha)
                            if (isAssociadosPset && typeof propValue === 'string') {
                                const items = propValue.split('\n').map(line => line.trim()).filter(line => line).join('<br>');
                                
                                psetsRestantesHTML += `
                                    <li style="
                                        margin-left: -20px; 
                                        border-left: 3px solid #007bff; 
                                        padding-left: 10px;
                                        white-space: pre-wrap;
                                    ">
                                        <strong>${propName}:</strong><br>${items}
                                    </li>
                                `;
                            } else {
                                // Exibe todas as outras propriedades nos Psets de origem
                                psetsRestantesHTML += `<li><strong>${propName}:</strong> ${propValue}</li>`;
                            }
                        }
                    });
                }
                psetsRestantesHTML += `</ul>`;
            });
        } else {
            psetsRestantesHTML = `<p>Nenhum conjunto de propriedades (Psets) encontrado.</p>`;
        }
        
        // Adiciona informações IFC básicas à seção principal
        identificacaoPrincipalHTML += `
            <p class="type-info"><strong>Tipo IFC:</strong> ${elementType}</p>
            <p><strong>ID IFC:</strong> ${expressID}</p>
            <p><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
        </ul><hr>`;

        // 3. MONTA E EXIBE O CONTEÚDO FINAL
        details.innerHTML = identificacaoPrincipalHTML + psetsRestantesHTML;
        panel.style.display = 'block';
    }


    // --- Inicialização ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc'); // Altere a URL conforme necessário

    // =======================================================
    // 🔹 EVENTO DE DUPLO CLIQUE (Inclui console.log do objeto completo)
    // =======================================================
    
    // Pré-seleção (hover)
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    // Duplo Clique
    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            return;
        }
        
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        
        // SOLICITAÇÃO ATENDIDA: EXIBE NO CONSOLE O OBJETO COMPLETO
        console.log("🟩 Item selecionado (Objeto Completo):", props);
        
        showProperties(props, item.id);
    };

    // Atalhos do teclado (Limpar seleção ao apertar ESC)
    window.onkeydown = (event) => {
        if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            document.getElementById('properties-panel').style.display = 'none';
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
            }
        });
    }

});