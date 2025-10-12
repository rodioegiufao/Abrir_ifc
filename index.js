import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; // 🟢 Variável para o subset visível

// ... (CreateViewer, loadIfc - Mantidos do seu código, mas com a captura do material do meu último código)
// **NOTA: SEU NOVO CÓDIGO NÃO ESTÁ CAPTURANDO O MATERIAL, PRECISAMOS DISSO!**
// ASSUMINDO QUE VOCÊ INTEGROU originalMaterial:

let originalMaterial = null; 

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

    // --- Obtém TODOS os IDs do modelo ---
    async function getAllExpressIDs() {
        if (currentModelID === -1) return [];
        
        try {
            // Seu método robusto de busca de IDs
            // ... (log de busca de IDs)
            return await viewer.IFC.loader.ifcManager.getAllItemsOfType(currentModelID, null, false);
        } catch (error) {
            // ... (log de erro)
            return [];
        }
    }

    // --- Cria/Atualiza subset visível com uma lista de IDs ---
    // 🟢 MODIFICADA PARA RECEBER A LISTA DE IDS E O MATERIAL
    async function updateVisibleSubset(idsToDisplay, material) {
        if (currentModelID === -1) return;

        // Se o subset antigo existir, removemos ele da cena
        if (visibleSubset) {
            viewer.context.getScene().remove(visibleSubset);
            // Opcional: Dispose do objeto antigo para liberar memória (não essencial para este teste)
            // visibleSubset.geometry.dispose();
            // visibleSubset = null;
        }

        // 🟢 Cria o NOVO subset com os IDs atuais e o material correto
        const newSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids: idsToDisplay,
            removePrevious: true,
            customID: "visibleSubset",
            material: material 
        });

        visibleSubset = newSubset;
        viewer.context.getScene().add(visibleSubset);
        console.log(`✅ ${idsToDisplay.length} elementos visíveis`);
    }

    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // 🟢 CRÍTICO: CAPTURA DO MATERIAL E OCULTAÇÃO DO ORIGINAL
        originalMaterial = model.mesh.material;
        model.mesh.visible = false; // Oculta o modelo original

        // 🔸 Mostra todos os elementos ao carregar
        await showAll(); 
        
        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Exibe todos os elementos (Recria o subset completo) ---
    async function showAll() {
        console.log("🔹 Mostrando todos os elementos...");
        const allIds = await getAllExpressIDs();
        await updateVisibleSubset(allIds, originalMaterial); // Atualiza com todos os IDs
    }

    // =======================================================
    // 🔹 CONTROLE DE VISIBILIDADE USANDO SUBSETS
    // =======================================================

    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressIDToHide = lastPickedItem.id;
        
        console.log(`🔹 Ocultando item ${expressIDToHide}`);

        // 🟢 ESTRATÉGIA "DELETAR E RECARREGAR" (Forçando a Recriação)
        
        // 1. Obtém a lista atual de IDs visíveis
        const allIds = await getAllExpressIDs();
        
        // 2. Filtra, removendo o ID a ser ocultado
        const newVisibleIds = allIds.filter(id => id !== expressIDToHide);

        // 3. Recria o subset (isso força a renderização do Three.js)
        await updateVisibleSubset(newVisibleIds, originalMaterial);

        console.log(`✅ Item ${expressIDToHide} ocultado com sucesso.`);
        viewer.IFC.selector.unpickIfcItems();
        viewer.IFC.selector.unHighlightIfcItems();
        lastPickedItem = null;
    }

    // ... (restante do código, event listeners)
    
    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;
    
    // ... (Inicialização e Interações)
    
    // --- Inicializa ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");
    
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (!item || item.modelID === undefined || item.id === undefined) {
             viewer.IFC.selector.unpickIfcItems();
             viewer.IFC.selector.unHighlightIfcItems();
             lastPickedItem = null;
             return;
        }

        lastPickedItem = item;
        
        // 🟢 NOVO COMPORTAMENTO: Isola a peça no double click (como você descreveu)
        const idsToDisplay = [item.id];
        await updateVisibleSubset(idsToDisplay, originalMaterial);
        
        // Não é necessário highlight se o item já está isolado
        
        const props = await viewer.IFC.getProperties(item.modelID, item.id, true);
        console.log("🟩 Item selecionado:", props);
    };

    // ... (Atalhos de teclado)
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') viewer.clipper.createPlane();
        else if (event.code === 'KeyO') viewer.clipper.deletePlane();
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            viewer.IFC.selector.unHighlightIfcItems();
            lastPickedItem = null;
            showAll(); // Opcional: volta a mostrar tudo no ESC
        }
    };
});