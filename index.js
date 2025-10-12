// index.js (Lógica Three.js Pura)

import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; 
let originalModelMesh = null; // Armazena a malha Three.js do modelo IFC
let allExpressIDs = []; // Armazena TODOS os IDs visíveis
let hiddenIDs = new Set(); // Conjunto de IDs ocultos

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

    // --- Recria a malha visível usando a API Three.js (Subsets forçados) ---
    async function updateVisibleSubset() {
        if (!originalModelMesh) return;
        
        // 1. Pega todos os IDs que DEVERIAM estar visíveis
        const visibleIDs = allExpressIDs.filter(id => !hiddenIDs.has(id));

        // 2. CRÍTICO: Usa a API de Subsets (que é a única forma de manipular a geometria carregada)
        // Se a lista de IDs visíveis for o modelo inteiro, ele recria o subset completo.
        // Se a lista for menor, ele cria um subset sem os IDs ocultos.
        
        // Oculta o modelo original
        originalModelMesh.visible = false;

        // Limpa o subset anterior (se existir)
        if (visibleSubset) {
            viewer.context.getScene().remove(visibleSubset);
            // IMPORTANTE: Dispor do subset antigo pode ser necessário para liberar memória
            // mas vamos focar na lógica por enquanto.
        }

        if (visibleIDs.length === 0) {
            console.log("Nenhum elemento visível. Subset limpo.");
            visibleSubset = null;
            return;
        }
        
        // 3. RECRIAR O SUBSET COM APENAS OS IDS VISÍVEIS
        // Esta é a única forma de "deletar temporariamente" a geometria no web-ifc-viewer.
        const material = originalModelMesh.material; 
        
        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids: visibleIDs,
            removePrevious: true,
            customID: "visibleSubset", // Reusa o ID para que o IFC saiba que é o mesmo objeto
            material: material 
        });

        viewer.context.getScene().add(visibleSubset);
        console.log(`✅ ${visibleIDs.length} elementos visíveis`);
    }

    // --- Carrega um IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);
        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;
        
        originalModelMesh = model.mesh; // Armazena a malha Three.js

        // Preenche a lista de todos os IDs (só faz uma vez)
        allExpressIDs = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );
        hiddenIDs.clear(); // Garante que nada está oculto no início

        await updateVisibleSubset();
        
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
        
        if (hiddenIDs.has(expressID)) {
            console.log(`🔹 Item ${expressID} já está oculto.`);
            return;
        }
        
        hiddenIDs.add(expressID); // Adiciona ID à lista de ocultos
        await updateVisibleSubset(); // Recria a malha visível

        console.log(`✅ Item ${expressID} ocultado com sucesso.`);
        viewer.IFC.selector.unpickIfcItems();
        viewer.IFC.selector.unHighlightIfcItems();
        lastPickedItem = null;
    }

    async function showAll() {
        hiddenIDs.clear(); // Limpa a lista de ocultos
        await updateVisibleSubset(); // Recria a malha completa
        console.log(`🔹 Todos os elementos foram exibidos novamente.`);
    }
    
    // --- Lógica de Isolamento (Duplo Clique) ---
    // Este é o comportamento que você descreveu: ao clicar, isola.
    async function isolateSelected() {
        if (!lastPickedItem || currentModelID === -1) return;
        
        const expressID = lastPickedItem.id;

        // Encontra todos os IDs que NÃO são o selecionado
        const idsToHide = allExpressIDs.filter(id => id !== expressID);
        
        // Adiciona todos para ocultar e recria o subset
        hiddenIDs = new Set(idsToHide);
        await updateVisibleSubset();
        
        console.log(`✅ Item ${expressID} isolado.`)
        viewer.IFC.selector.unHighlightIfcItems();
    }


    // --- Inicialização ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    // ... (Conexão de botões omitida para brevidade, mas deve ser mantida)
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");
    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO E ISOLAMENTO
    // =======================================================
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    
    window.ondblclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const item = await viewer.IFC.selector.pickIfcItem(true);

        if (!item || item.modelID === undefined || item.id === undefined) {
             showAll(); // Se clicar fora, exibe tudo
             return;
        }

        lastPickedItem = item;
        
        // ❌ AQUI ESTÁ O ISOLAMENTO QUE VOCÊ NOTOU
        await isolateSelected();

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
            showAll(); // Exibe tudo ao pressionar ESC
        }
    };
});