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
        // Prioriza o Nome do tipo de elemento (Ex: Curva horizontal 90º sem tampa)
        const elementTypeName = props.type[0]?.Name?.value || props.type[0]?.constructor.name || 'Elemento Desconhecido';
        const elementType = props.constructor.name; // Ex: IfcFlowFitting
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
                
                // Aplica cor diferente e negrito no Pset desejado
                const psetStyle = psetName.includes("Itens_Associados") 
                                  ? 'style="color: #d9534f; font-weight: bold;"' 
                                  : '';

                htmlContent += `
                    <h5 ${psetStyle}>${psetName}</h5>
                    <ul>
                `;

                if (pset.HasProperties) {
                    pset.HasProperties.forEach(propHandle => {
                        // O valor da propriedade é acessado pelo expressID do Handle
                        const prop = props[propHandle.value]; 

                        if (prop && prop.Name && prop.NominalValue) {
                            const propValue = prop.NominalValue.value;
                            const propName = prop.Name.value;

                            // Tratamento especial para "Itens Associados"
                            if (psetName.includes("Itens_Associados") && typeof propValue === 'string') {
                                // Quebra a string em linhas e substitui para HTML (mantendo o conteúdo original)
                                const items = propValue.split('\n').map(line => line.trim()).filter(line => line).join('<br>');
                                
                                htmlContent += `<li style="white-space: pre-wrap; margin-left: -20px; border-left: 3px solid #d9534f; padding-left: 10px;"><strong>${propName}:</strong><br>${items}</li>`;
                            } else {
                                // Exibe as propriedades de outros Psets (Dimensões, etc.)
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
    loadIfc('models/01.ifc'); // Carrega o modelo de teste (ajuste o caminho se necessário)

    // =======================================================
    // 🔹 EVENTO DE DUPLO CLIQUE (ATUALIZADO)
    // =======================================================
    
    // Pré-seleção (hover)
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    // Duplo Clique
    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        // Se não selecionou nada, oculta o painel
        if (!item || item.modelID === undefined || item.id === undefined) {
            document.getElementById('properties-panel').style.display = 'none';
            viewer.IFC.selector.unHighlightIfcItems();
            return;
        }
        
        // 1. Seleciona o item para destaque visual
        viewer.IFC.selector.unHighlightIfcItems(); // Limpa destaques anteriores
        viewer.IFC.selector.highlightIfcItem(item, false); // Destaca o novo item
        
        // 2. Obtém as propriedades completas (inclui psets e tipos)
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        
        // 🔹 3. EXIBE NO CONSOLE (Solicitado pelo usuário)
        console.log("🟩 Item selecionado (Objeto Completo):", props);
        
        // 4. Chama a função para formatar e exibir no painel
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
    
    // Lógica de Upload de arquivo (mantida)
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