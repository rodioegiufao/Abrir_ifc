import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

let viewer;
let currentModelID = -1;
let lastPickedItem = null;
let visibleSubset = null; // 🟢 ESSENCIAL: Armazena o subset para que hideSelected possa modificá-lo

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

        // 🔸 Oculta o modelo original
        // 🔴 CORREÇÃO 1: ESSENCIAL para que o subset funcione. Apenas o subset deve ser visível.
        model.mesh.visible = false; 

        // 🔸 Cria subset com todos os elementos visíveis e o mesmo material do modelo original
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );

        // 🔴 CORREÇÃO 2: Usa model.mesh.material (o material real está no mesh, não no objeto model)
        const subset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            material: model.mesh.material 
        });

        // 🔴 CORREÇÃO 3: Atribui o subset criado à variável global 'visibleSubset'
        visibleSubset = subset;

        // 🔸 Adiciona o subset visível à cena (necessário para a versão 1.x)
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
        
        // 🟢 O código de removeFromSubset está correto para a versão 1.x, desde que
        // 'visibleSubset' esteja atribuído corretamente no loadIfc.
        viewer.IFC.loader.ifcManager.removeFromSubset(
            currentModelID,
            [lastPickedItem.id], // Usa o ID do item
            "visibleSubset"
        );

        console.log(`🔹 Item ${lastPickedItem.id} ocultado.`);
        viewer.IFC.selector.unpickIfcItems();
        lastPickedItem = null;
    }

    async function showAll() {
        if (currentModelID === -1) return;

        // Pega os IDs novamente
        const ids = await viewer.IFC.loader.ifcManager.getAllItemsOfType(
            currentModelID,
            null,
            false
        );
        
        // Recria o subset completo com o material do modelo original.
        // Necessário obter o material novamente (melhor prática, embora menos eficiente)
        // ou armazená-lo globalmente (o que a gente evitou para simplificar).
        const model = viewer.IFC.get(); // Pega a referência do modelo
        
        visibleSubset = viewer.IFC.loader.ifcManager.createSubset({
            modelID: currentModelID,
            ids,
            removePrevious: true,
            customID: "visibleSubset",
            material: model.mesh.material // 🔴 CORREÇÃO 4: Garante que o material seja usado na recriação
        });

        // Garante que está na cena (em caso de remoção prévia)
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