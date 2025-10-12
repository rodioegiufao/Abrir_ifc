// CÓDIGO FINAL DE SUBSUMPTION NO index.js

import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; 
let originalMaterial = null; // Vamos guardar o material original para showAll


document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('viewer-container');

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

    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);

        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // 🟢 PASSO 1 CRÍTICO: Oculta o modelo original
        model.mesh.visible = false; 

        // Guarda o material original para que o subset o utilize
        originalMaterial = model.mesh.material; 

        // 🔸 Cria subset com todos os elementos visíveis
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            // 🟢 Usa o material original
            material: originalMaterial 
        });

        visibleSubset = subset; 
        viewer.context.getScene().add(visibleSubset);

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
        
        // ❌ CORREÇÃO CRÍTICA FINAL: Passa o ModelID e o ExpressID, e o CustomID do subset.
        // Remove o elemento do SUBSET (que está visível), e o elemento some.
        // Esta sintaxe de 3 argumentos é a que *deve* funcionar na sua versão.
        viewer.IFC.loader.ifcManager.removeFromSubset(
            currentModelID,
            [expressID],
            "visibleSubset"
        );
        
        // Se a sintaxe acima falhar, troque para esta:
        /*
        viewer.IFC.loader.ifcManager.removeFromSubset(
            currentModelID,
            [expressID],
            undefined,
            "visibleSubset"
        );
        */

        console.log(`🔹 Item ${expressID} ocultado.`);
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    async function showAll() {
        if (currentModelID === -1) return;

        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        // Recria o subset completo com o material original salvo
        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            material: originalMaterial 
        });

        if (!viewer.context.getScene().children.includes(visibleSubset)) {
            viewer.context.getScene().add(visibleSubset);
        }

        console.log(`🔹 Todos os elementos foram exibidos novamente.`);
    }

    // --- Inicialização e Event Listeners (Mantidos) ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');
    
    // ... (restante dos event listeners)

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (!item || item.modelID === undefined || item.id === undefined) return;
        lastPickedItem = item;
        console.log("🟩 Item selecionado:", await viewer.IFC.getProperties(item.modelID, item.id, true));
    };

    window.onkeydown = (event) => {
        if (event.code === 'KeyP') viewer.clipper.createPlane();
        else if (event.code === 'KeyO') viewer.clipper.deletePlane();
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        }
    };
});