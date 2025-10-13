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
        await viewer.IFC.setWasmPath("/wasm/"); 
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;
        
        viewer.shadowDropper.renderShadow(currentModelID);
        console.log("✅ Modelo IFC carregado com ID:", currentModelID);
        return model;
    }

    // =======================================================
    // 🔹 FUNÇÃO PARA EXIBIR PROPRIEDADES DE FORMA FORMATADA
    // =======================================================
    function showProperties(props, expressID) {
        const panel = document.getElementById('properties-panel');
        const title = document.getElementById('element-title');
        const details = document.getElementById('element-details');
        
        if (!panel || !details) return;

        // 1. EXTRAÇÃO DE INFORMAÇÕES BÁSICAS
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementType = props.constructor.name;
        const elementName = props.Name?.value || elementTypeName;

        title.textContent = elementName;
        let htmlContent = `
            <h4>Informações Básicas</h4>
            <p class="type-info"><strong>Tipo IFC:</strong> ${elementType}</p>
            <p><strong>ID IFC:</strong> ${expressID}</p>
            <p><strong>Global ID:</strong> ${props.GlobalId?.value || 'N/A'}</p>
            <hr>
            <h4>Conjuntos de Propriedades (Psets)</h4>
        `;

        // 2. EXTRAÇÃO DE PROPRIEDADES (psets)
        if (props.psets && props.psets.length > 0) {
            props.psets.forEach(pset => {
                const psetName = pset.Name?.value || 'Pset Desconhecido';
                
                // Aplica cor e negrito no Pset desejado
                const isAssociadosPset = psetName.includes("AltoQi_QiBuilder-Itens_Associados");
                const psetStyle = isAssociadosPset 
                                  ? 'style="color: #007bff; font-weight: bold;"' 
                                  : '';

                htmlContent += `
                    <h5 ${psetStyle}>${psetName}</h5>
                    <ul>
                `;

                if (pset.HasProperties) {
                    pset.HasProperties.forEach(propHandle => {
                        const prop = props[propHandle.value]; 

                        if (prop && prop.Name && prop.NominalValue) {
                            const propValue = prop.NominalValue.value;
                            const propName = prop.Name.value;

                            // CRÍTICO: Tratamento para "Itens Associados" (quebra de linha)
                            if (isAssociadosPset && typeof propValue === 'string') {
                                // Quebra a string por '\n', filtra linhas vazias e junta com <br>
                                const items = propValue.split('\n').map(line => line.trim()).filter(line => line).join('<br>');
                                
                                htmlContent += `
                                    <li style="
                                        margin-left: -20px; 
                                        border-left: 3px solid #007bff; 
                                        padding-left: 10px;
                                        white-space: pre-wrap; /* Garante quebras de linha */
                                    ">
                                        <strong>${propName}:</strong><br>${items}
                                    </li>
                                `;
                            } else {
                                // Exibe as propriedades de outros Psets
                                htmlContent += `<li><strong>${propName}:</strong> ${propValue}</li>`;
                            }
                        }
                    });
                }
                htmlContent += `</ul>`;
            });
        } else {
            htmlContent += `<p>Nenhum conjunto de propriedades (Psets) encontrado.</p>`;
        }

        // 3. EXIBE NO PAINEL
        details.innerHTML = htmlContent;
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
        
        // 1. Seleciona o item para destaque visual
        viewer.IFC.selector.unHighlightIfcItems();
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        // 2. Obtém as propriedades completas
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        
        // 🔹 SOLICITAÇÃO ATENDIDA: EXIBE NO CONSOLE O OBJETO COMPLETO
        console.log("🟩 Item selecionado (Objeto Completo):", props);
        
        // 3. Chama a função para formatar e exibir no painel
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