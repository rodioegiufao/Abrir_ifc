import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;

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

        // Cria subset inicial com tudo visível
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );
        viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset"
        });

        viewer.shadowDropper.renderShadow(currentModelID);
        return model;
    }

    // --- Inicializa ---
    viewer = CreateViewer(container);
    loadIfc('models/01.ifc');

    const input = document.getElementById("file-input");
    const hideSelectedButton = document.getElementById("hide-selected");
    const showAllButton = document.getElementById("show-all");

    // --- Upload manual ---
    if (input) {
        input.addEventListener("change", async (changed) => {
            const file = changed.target.files[0];
            const ifcURL = URL.createObjectURL(file);
            await loadIfc(ifcURL);
        }, false);
    }

    // =======================================================
    // 🔹 CONTROLE DE VISIBILIDADE USANDO SUBSETS
    // =======================================================

    async function hideSelected() {
        if (!lastPickedItem || currentModelID === -1) {
            alert("Nenhum item selecionado. Dê um duplo clique para selecionar primeiro.");
            return;
        }

        const expressID = lastPickedItem.id;

        // Remove o item do subset visível
        viewer.IFC.loader.ifcManager.removeFromSubset(
            currentModelID,
            [expressID],
            "visibleSubset"
        );

        console.log(`🔹 Item ${expressID} ocultado.`);
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    async function showAll() {
        if (currentModelID === -1) return;

        // Recria o subset completo
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset"
        });

        console.log(`🔹 Todos os elementos foram exibidos novamente.`);
    }

    if (hideSelectedButton) hideSelectedButton.onclick = hideSelected;
    if (showAllButton) showAllButton.onclick = showAll;

    // =======================================================
    // 🔹 INTERAÇÕES DE SELEÇÃO
    // =======================================================
    window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

    window.ondblclick = async () => {
        const item = await viewer.IFC.selector.pickIfcItem(true);
        if (!item || item.modelID === undefined || item.id === undefined) return;
        lastPickedItem = item;
        console.log("🟩 Item selecionado:", await viewer.IFC.getProperties(item.modelID, item.id, true));
    };

    // Atalhos do teclado
    window.onkeydown = (event) => {
        if (event.code === 'KeyP') viewer.clipper.createPlane();
        else if (event.code === 'KeyO') viewer.clipper.deletePlane();
        else if (event.code === 'Escape') {
            viewer.IFC.selector.unpickIfcItems();
            lastPickedItem = null;
        }
    };
});
