import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Cria o viewer (A API já inclui controles e renderização) ---
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
        await viewer.IFC.setWasmPath("/wasm/"); // Certifique-se de que a pasta /wasm/ está correta
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;
        
        viewer.shadowDropper.renderShadow(currentModelID);
        console.log("✅ Modelo IFC carregado com ID:", currentModelID);
        return model;
    }

    // --- Inicialização ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc'); // Carrega o modelo de teste

    // =======================================================
    // 🔹 FUNÇÃO PARA ATUALIZAR O FEEDBACK VISUAL NA TELA
    // =======================================================
    function updateSelectionInfo(props, expressID = null) {
        // Usa o div 'selection-info' do seu index.html
        const selectionInfo = document.getElementById('selection-info');
        if (!selectionInfo) return;
        
        if (!props || !expressID) {
            selectionInfo.style.display = 'none';
            return;
        }
        
        // Tenta obter o nome ou o tipo do elemento
        const name = props.Name?.value || props.type || 'Elemento Sem Nome';
        
        // Constrói o conteúdo detalhado
        let content = `
            <strong>Tipo:</strong> ${props.type}<br>
            <strong>Nome:</strong> ${name}<br>
            <strong>ID IFC:</strong> ${expressID}<br>
        `;
        
        selectionInfo.innerHTML = content;
        selectionInfo.style.display = 'block';
    }


    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO
    // =======================================================
    
    // Pré-seleção (hover)
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    // Duplo Clique (SELEÇÃO E PROPRIEDADES)
    window.ondblclick = async (event) => {
        // Previne comportamento padrão que pode interferir
        event.preventDefault();
        event.stopPropagation();
        
        if (!viewer || !viewer.IFC || !viewer.IFC.selector) return;
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) {
            console.log("Nenhum item IFC selecionado");
            updateSelectionInfo(null); // Limpa o painel de seleção
            return;
        }
        
        // 1. Seleciona o item para destaque visual
        viewer.IFC.selector.unHighlightIfcItems(); // Limpa destaques anteriores
        viewer.IFC.selector.highlightIfcItem(item, false); // Destaca o novo item
        
        // 2. Obtém as propriedades do elemento (o 'true' inclui as propriedades do tipo)
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        
        // 3. Exibe no console e na tela
        console.log("🟩 Item selecionado:", props);
        updateSelectionInfo(props, item.id);
    };

    // Atalhos do teclado (Limpar seleção ao apertar ESC)
    window.onkeydown = (event) => {
        if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            updateSelectionInfo(null);
        }
    };
    
    // Lógica de Upload de arquivo (se você quiser manter)
    const input = document.getElementById("file-input");
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            if (file) {
                const ifcURL = URL.createObjectURL(file);
                await loadIfc(ifcURL);
                updateSelectionInfo(null);
            }
        });
    }
});