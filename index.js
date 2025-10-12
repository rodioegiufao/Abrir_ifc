import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; 

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

    // --- Carrega IFC ---
    async function loadIfc(url) {
        if (viewer) await viewer.dispose();
        viewer = CreateViewer(container);

        await viewer.IFC.setWasmPath("/wasm/");
        const model = await viewer.IFC.loadIfcUrl(url);
        currentModelID = model.modelID;

        // 🟢 PASSO 1 CRÍTICO: Oculta o modelo original
        model.mesh.visible = false; 

        // 🔸 Cria subset com todos os elementos visíveis
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        // O 'createSubset' cria o objeto Three.js (a nova malha de visualização)
        const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            // 🟢 PASSO 2: Garante o material correto
            material: model.mesh.material 
        });

        // 🟢 PASSO 3: Armazena o subset criado na variável global
        visibleSubset = subset; 

        // 🔸 Adiciona o subset visível à cena
        viewer.context.getScene().add(visibleSubset);

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
        
        // 🟢 PASSO 4: Oculta o item removendo-o da malha de visualização (visibleSubset)
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

        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        const model = viewer.IFC.get(); 

        // Recria o subset completo
        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            material: model.mesh.material 
        });

        if (!viewer.context.getScene().children.includes(visibleSubset)) {
            viewer.context.getScene().add(visibleSubset);
        }

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