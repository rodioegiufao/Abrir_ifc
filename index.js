import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; // Armazenará o subset atual visível
let originalMaterial = null; // 🟢 NOVO: Variável para armazenar o material IFC

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

    // --- Cria o viewer ---
    function CreateViewer(container) {
        // ... (código CreateViewer idêntico)
        const newViewer = new IfcViewerAPI({
            container,
            backgroundColor: new Color(0xeeeeee)
        });
        newViewer.axes.setAxes();
        newViewer.grid.setGrid();
        newViewer.clipper.active = true;
        return newViewer;
    }

    // --- Cria subset visível com todos os elementos ---
    // 🟢 AGORA RECEBE O MATERIAL COMO PARÂMETRO
    async function createVisibleSubset(material) {
        if (currentModelID === -1) return;
        
        try {
            console.log("🔹 Criando subset visível...");
            
            // Método universal para obter todos os IDs
            const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
                currentModelID,
                null, // Tipo nulo busca todos
                false
            );

            console.log(`🔹 Encontrados ${ids.length} elementos`);
            
            if (ids.length === 0) {
                 console.error("ERRO CRÍTICO: Não foi possível obter IDs da geometria.");
                 return;
            }

            // 🟢 CRÍTICO: Passa o material para o subset
            const subset = viewer.IFC.loader.ifcManager.createSubset({
                modelID: currentModelID,
                ids,
                removePrevious: true,
                customID: "visibleSubset",
                material: material 
            });

            visibleSubset = subset;
            
            // Garante que o objeto está na cena
            if (!viewer.context.getScene().children.includes(visibleSubset)) {
                viewer.context.getScene().add(visibleSubset);
            }

            console.log("✅ Subset visível criado com sucesso");
            return subset;

        } catch (error) {
            console.error("Erro ao criar subset visível:", error);
        }
    }


    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // 🟢 CRÍTICO: Armazena o material original antes de ocultar
        originalMaterial = model.mesh.material;

        // 🔸 Oculta o modelo original
        model.mesh.visible = false;
        
        // Cria subset visível (agora passando o material)
        await createVisibleSubset(originalMaterial);
        
        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Lógica de Ocultar/Exibir ---

    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressID = lastPickedItem.id;
        
        // Remove o item do subset visível (Sintaxe correta)
        viewer.IFC.loader.ifcManager.removeFromSubset(
            currentModelID,
            [expressID],
            "visibleSubset"
        );

        console.log(`✅ Item ${expressID} ocultado com sucesso.`);
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
        
        // Garante que o highlight de seleção foi removido
        viewer.IFC.selector.unHighlightIfcItems();
    }

    async function showAll() {
        // Recria o subset completo com todos os IDs e o material
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            material: originalMaterial // Usa o material original
        });
        
        if (!viewer.context.getScene().children.includes(visibleSubset)) {
             viewer.context.getScene().add(visibleSubset);
        }

        console.log(`🔹 Todos os elementos foram exibidos novamente.`);
    }

    // --- Inicialização ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // --- Upload manual (mantido) ---
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            loadIfc(ifcURL);
        }, false);
    } 

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO
    // =======================================================
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    
    // 🟢 CRÍTICO 7: CORRIGE O COMPORTAMENTO DO DOUBLE CLICK
    window.ondblclick = async (event) => {
        // Previne comportamento de zoom que pode ser padrão
        event.preventDefault();
        event.stopPropagation();
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) {
             // Se nada for selecionado, desfaz a seleção anterior.
             viewer.IFC.selector.unpickIfcItems();
             viewer.IFC.selector.unHighlightIfcItems();
             lastPickedItem = null;
             return;
        }

        lastPickedItem = item;
        
        // Apenas destaca o item, SEM MODIFICAR SUBSETS AQUI
        viewer.IFC.selector.highlightIfcItem(item, false);
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        console.log("🟩 Item selecionado:", props);
    };

    // ... (Atalhos de teclado mantidos)
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') viewer.clipper.createPlane();
        else if (event.code === 'KeyO') viewer.clipper.deletePlane();
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            lastPickedItem = null;
        }
    };
});